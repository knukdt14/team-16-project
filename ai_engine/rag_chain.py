"""
rag_chain.py
검색(Dense + BM25 하이브리드)과 답변 생성을 담당한다.

설계 메모:
1) 쿼리 인코딩은 반드시 build_vectorstore.build_query() 를 재사용한다.
   Qwen3 임베딩은 쿼리에만 instruct 접두사를 붙이는 비대칭 구조라,
   인덱싱과 검색의 인코딩 방식이 어긋나면 검색 품질이 크게 떨어진다.

2) BM25 토크나이저는 형태소 + 원형을 함께 넣는다.
   Kiwi 는 "EV6" 를 ['EV','6'] 으로 쪼개는데, 이것만 쓰면
   EV6 와 EV9 의 구분력이 약해진다. 원본 영숫자 덩어리도 토큰에 추가.

3) 하이브리드 결합은 RRF(Reciprocal Rank Fusion).
   Dense 점수(코사인)와 BM25 점수(무한대 범위)는 스케일이 달라
   가중합이 불안정하다. 순위 기반 결합이 튜닝 없이 안정적이다.

4) 금액은 절대 LLM 이 생성하지 않는다. lookup.py 결과만 사용한다.
   프롬프트에서도 문서에 없는 숫자 생성을 강하게 금지한다.
"""

import json
import re
from pathlib import Path

import chromadb
import numpy as np
import torch
from chromadb.config import Settings
from kiwipiepy import Kiwi
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

from build_vectorstore import (
    COLLECTION,
    EMBED_MODEL,
    INDEX_DIR,
    build_query,
)

CHUNKS_PATH = Path("../data/chunks.jsonl")

LLM_MODEL = "Qwen/Qwen2.5-3B-Instruct"   # 배포(CPU) 고려한 소형 instruct 모델

_kiwi = Kiwi()


# ---------------------------------------------------------------- 토크나이저
def tokenize(text: str):
    """형태소 + 영숫자 원형을 함께 반환 (BM25용)"""
    toks = [t.form.lower() for t in _kiwi.tokenize(text)]
    # "EV6", "2WD", "19인치" 같은 덩어리를 원형 그대로 보존
    raw = re.findall(r"[A-Za-z]+\d+|\d+[A-Za-z]+|[A-Za-z]{2,}", text)
    toks += [r.lower() for r in raw]
    return toks


# ---------------------------------------------------------------- 검색기
class Retriever:
    def __init__(self, device: str = None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")

        # 원문 청크 (BM25 및 결과 조립용)
        self.chunks = [json.loads(l) for l in CHUNKS_PATH.open(encoding="utf-8")]
        self.by_id = {c["id"]: c for c in self.chunks}

        # Dense
        self.model = SentenceTransformer(EMBED_MODEL, device=self.device)
        client = chromadb.PersistentClient(
            path=str(INDEX_DIR), settings=Settings(anonymized_telemetry=False)
        )
        self.collection = client.get_collection(COLLECTION)

        # BM25
        corpus = [tokenize(c["text"]) for c in self.chunks]
        self.bm25 = BM25Okapi(corpus)
        self.ids = [c["id"] for c in self.chunks]

    # ---------------- 개별 검색
    def search_dense(self, query: str, k: int = 5):
        emb = self.model.encode(
            [build_query(query)], normalize_embeddings=True, convert_to_numpy=True
        )
        res = self.collection.query(query_embeddings=emb.tolist(), n_results=k)
        return [
            {"id": i, "score": 1 - d}
            for i, d in zip(res["ids"][0], res["distances"][0])
        ]

    def search_bm25(self, query: str, k: int = 5):
        scores = self.bm25.get_scores(tokenize(query))
        top = np.argsort(scores)[::-1][:k]
        return [{"id": self.ids[i], "score": float(scores[i])} for i in top]

    # ---------------- 하이브리드 (RRF)
    def search(self, query: str, k: int = 5, mode: str = "hybrid", rrf_k: int = 60):
        """mode: dense | bm25 | hybrid"""
        if mode == "dense":
            hits = self.search_dense(query, k)
        elif mode == "bm25":
            hits = self.search_bm25(query, k)
        else:
            pool = max(k * 3, 10)
            d = self.search_dense(query, pool)
            b = self.search_bm25(query, pool)
            fused = {}
            for rank, h in enumerate(d):
                fused[h["id"]] = fused.get(h["id"], 0) + 1 / (rrf_k + rank + 1)
            for rank, h in enumerate(b):
                fused[h["id"]] = fused.get(h["id"], 0) + 1 / (rrf_k + rank + 1)
            hits = [
                {"id": i, "score": s}
                for i, s in sorted(fused.items(), key=lambda x: -x[1])[:k]
            ]

        return [
            {
                "id": h["id"],
                "score": h["score"],
                "text": self.by_id[h["id"]]["text"],
                "metadata": self.by_id[h["id"]]["metadata"],
            }
            for h in hits
        ]


# ---------------------------------------------------------------- 프롬프트
SYSTEM_PROMPT = """당신은 전기차 구매보조금 상담 도우미입니다.

반드시 지킬 규칙:
1. 제공된 [참고 문서]와 [조회된 금액]에 없는 숫자는 절대 만들어내지 마세요.
   문서에 없으면 "해당 정보는 확인되지 않습니다"라고 답하세요.
2. 금액을 말할 때는 [조회된 금액] 값을 그대로 사용하세요. 계산해서 바꾸지 마세요.
3. 답변 끝에 근거가 된 문서의 조항을 표기하세요. 예: (근거: 4-1-2 중·대형, 소형)
4. 지역·트림에 따라 달라지는 내용은 그 사실을 함께 안내하세요.
5. 최종 확인은 관할 지자체 공고를 참고하도록 안내하세요.
6. 간결하게, 3~5문장으로 답하세요."""


def build_prompt(question: str, docs: list, lookup_result: dict = None) -> list:
    ctx = "\n\n".join(
        f"[문서 {i+1}] {d['text']}" for i, d in enumerate(docs)
    )
    parts = [f"[참고 문서]\n{ctx}"]

    if lookup_result and lookup_result.get("status") == "ok":
        parts.append(
            "[조회된 금액]\n"
            f"{lookup_result['시군구']} / {lookup_result['모델명']}\n"
            f"국비 {lookup_result['국비']}만원 + 지방비 {lookup_result['지방비']}만원 "
            f"= 총 {lookup_result['총액']}만원\n"
            f"(전환지원금 별도: 국비 {lookup_result['전환지원금국비']}만원 + "
            f"지방비 {lookup_result['전환지원금지방비']}만원)"
        )

    parts.append(f"[질문]\n{question}")
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "\n\n".join(parts)},
    ]


# ---------------------------------------------------------------- 생성기
class Generator:
    def __init__(self, model_name: str = LLM_MODEL, device: str = None):
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_name,
            dtype=torch.float16 if self.device == "cuda" else torch.float32,
            device_map=self.device,
        )

    def generate(self, messages: list, max_new_tokens: int = 400) -> str:
        text = self.tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        inputs = self.tokenizer(text, return_tensors="pt").to(self.device)
        with torch.no_grad():
            out = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=0.3,        # 사실 전달이 목적이므로 낮게
                do_sample=True,
                top_p=0.9,
                repetition_penalty=1.05,
                pad_token_id=self.tokenizer.eos_token_id,
            )
        gen = out[0][inputs["input_ids"].shape[1]:]
        return self.tokenizer.decode(gen, skip_special_tokens=True).strip()


# ---------------------------------------------------------------- 테스트
if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--no-llm", action="store_true", help="검색만 테스트")
    ap.add_argument("--device", default=None)
    args = ap.parse_args()

    r = Retriever(device=args.device)
    print(f"청크 {len(r.chunks)}개 로드 / 디바이스 {r.device}\n")

    queries = [
        "청년이 생애 첫 차로 사면 얼마나 더 받나요?",
        "대구에 얼마나 살아야 신청할 수 있나요?",
        "전에 보조금 받았는데 또 받을 수 있나요?",
        "차값 6천만원이면 보조금 다 나오나요?",
    ]

    for q in queries:
        print("=" * 60)
        print(f"Q. {q}")
        for mode in ["dense", "bm25", "hybrid"]:
            hits = r.search(q, k=3, mode=mode)
            print(f"\n  [{mode}]")
            for i, h in enumerate(hits, 1):
                print(f"   {i}. {h['metadata']['section']}  ({h['score']:.4f})")
        print()

    if not args.no_llm:
        print("\n" + "=" * 60)
        print("답변 생성 테스트")
        print("=" * 60)
        g = Generator(device=args.device)
        q = queries[0]
        docs = r.search(q, k=3, mode="hybrid")
        msgs = build_prompt(q, docs)
        print(f"Q. {q}\n")
        print(g.generate(msgs))