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

3) 하이브리드 결합은 가중 RRF(Reciprocal Rank Fusion).
   Dense 점수(코사인)와 BM25 점수(무한대 범위)는 스케일이 달라
   가중합이 불안정하므로 순위 기반으로 결합한다.

   [실측 결과] 가중치 스윕(eval/results_sweep.csv) 결과 BM25 비중이
   커질수록 성능이 단조 감소하여, Dense 단독이 최적으로 확인됨.

       w_dense 1.00 → MRR 0.5020   (채택)
       w_dense 0.90 → MRR 0.4953
       w_dense 0.70 → MRR 0.4487
       w_dense 0.00 → MRR 0.2890

   단, 평가셋이 자연어 질의 위주로 작성되어(원문 표현 회피)
   BM25 가 강점을 보이는 정확 매칭 질의(조항번호·트림명 등)가
   포함되지 않았다. BM25 자체가 무용한 것이 아니라
   현 평가셋의 질의 유형에서 기여하지 못한 것으로 해석해야 한다.
   따라서 hybrid 모드는 제거하지 않고 비교·확장용으로 유지한다.

4) 금액은 절대 LLM 이 생성하지 않는다. lookup.py 결과만 사용한다.
   프롬프트에서도 문서에 없는 숫자 생성을 강하게 금지한다.

5) LLM 은 Upstage Solar(API)와 HuggingFace(로컬) 중 선택할 수 있다.
   - Upstage: 빠르고(수 초) 규정 해석 정확도가 높다. API 키 필요.
   - HuggingFace: 키 없이 동작하나 CPU 에서 70~170초 소요.

   LLM_PROVIDER=auto 이면 키가 있을 때 Upstage, 없으면 HuggingFace 를 쓴다.
   Upstage 호출이 실패(토큰 소진·인증 오류·네트워크)하면 자동으로
   HuggingFace 로 전환하고, 이후 요청은 폴백 모델로 처리한다.
   → 채점자가 키 없이 clone 해도 서비스가 동작한다.
"""

import json
import os
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

# ---- LLM 설정 ----
# LLM_PROVIDER : auto | upstage | huggingface
#   auto        - UPSTAGE_API_KEY 가 있으면 Upstage, 없으면 HuggingFace
#   upstage     - Upstage 강제 (실패 시 HuggingFace 로 폴백)
#   huggingface - 로컬 모델만 사용
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "auto").lower()

# HuggingFace 로컬 모델. Codespaces 등 저사양 환경은 compose 에서 1.5B 지정
LLM_MODEL = os.getenv("LLM_MODEL", "Qwen/Qwen2.5-3B-Instruct")
MAX_NEW_TOKENS = int(os.getenv("MAX_NEW_TOKENS", "400"))

# Upstage
UPSTAGE_API_KEY = os.getenv("UPSTAGE_API_KEY", "").strip()
UPSTAGE_MODEL = os.getenv("UPSTAGE_MODEL", "solar-pro2")
UPSTAGE_URL = "https://api.upstage.ai/v1/chat/completions"
UPSTAGE_TIMEOUT = int(os.getenv("UPSTAGE_TIMEOUT", "60"))

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
    def search(self, query: str, k: int = 5, mode: str = "hybrid",
               rrf_k: int = 60, w_dense: float = 1.0, w_bm25: float = 0.0):
        """
        mode: dense | bm25 | hybrid
        w_dense / w_bm25: 가중 RRF 비율.
            기본값은 스윕 결과 최적점(1.0 : 0.0 = Dense 단독).
            sweep_weights.py 로 재탐색 가능.
        """
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
                fused[h["id"]] = fused.get(h["id"], 0) + w_dense / (rrf_k + rank + 1)
            for rank, h in enumerate(b):
                fused[h["id"]] = fused.get(h["id"], 0) + w_bm25 / (rrf_k + rank + 1)
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

## 답변 규칙

1. 제공된 문서에 없는 내용은 절대 만들어내지 마세요.
   없으면 "해당 정보는 확인되지 않습니다"라고 답하세요.

2. 아래 조회된 금액이 제시되면 그 값을 그대로 쓰세요.
   항목 제목이나 머리말을 답변에 옮기지 말고 실제 숫자만 쓰세요.

3. 질문에 대해서만 답하세요. 묻지 않은 다른 지원 조건(택시, 법인,
   화물차 등)은 언급하지 마세요.

4. 문서에 여러 차종(승용/화물/승합) 규정이 섞여 있습니다.
   질문이 어떤 차종인지 확인하고, 해당 차종 규정만 사용하세요.
   차종이 불분명하면 전기승용차 기준으로 답하세요.

5. 조건을 반대로 서술하지 마세요.
   "3개월 이상 거주해야 함" → "3개월 미만이면 신청 불가"
   "최초 1대만 지원" → "2대째는 지원 불가"
   문서 문장을 그대로 옮기기 어렵다면 문서 표현을 인용하세요.

6. 답변 끝에 근거 조항을 표기하세요. 예: (근거: 4-1-2 중·대형, 소형)

7. 3~4문장으로 간결하게 답하고, 마지막에 관할 지자체 공고 확인을
   안내하세요."""


def build_prompt(question: str, docs: list, lookup_result: dict = None) -> list:
    ctx = "\n\n".join(
        f"문서 {i+1}. {d['text']}" for i, d in enumerate(docs)
    )
    parts = [f"## 참고 문서\n\n{ctx}"]

    if lookup_result and lookup_result.get("status") == "ok":
        # 항목명을 LLM 이 그대로 복사하지 않도록 자연어 문장으로 제공
        parts.append(
            "아래 금액은 데이터베이스에서 조회한 확정 값입니다. 그대로 사용하세요.\n"
            f"{lookup_result['시군구']}에서 {lookup_result['모델명']} 구매 시 "
            f"국비 {lookup_result['국비']}만원과 지방비 {lookup_result['지방비']}만원을 "
            f"합쳐 총 {lookup_result['총액']}만원입니다. "
            f"노후 내연기관차를 교체하는 경우 전환지원금 "
            f"{lookup_result['전환지원금국비'] + lookup_result['전환지원금지방비']}만원이 "
            f"별도로 추가됩니다."
        )

    parts.append(f"## 질문\n\n{question}")
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "\n\n".join(parts)},
    ]


# ---------------------------------------------------------------- 생성기
class UpstageBackend:
    """Upstage Solar API. OpenAI 호환 형식."""

    name = "upstage"

    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or UPSTAGE_API_KEY
        self.model = model or UPSTAGE_MODEL
        if not self.api_key:
            raise ValueError("UPSTAGE_API_KEY 가 설정되지 않았습니다.")

    def generate(self, messages: list, max_new_tokens: int = None) -> str:
        import requests

        r = requests.post(
            UPSTAGE_URL,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "messages": messages,
                "temperature": 0.3,
                "top_p": 0.9,
                "max_tokens": max_new_tokens or MAX_NEW_TOKENS,
            },
            timeout=UPSTAGE_TIMEOUT,
        )
        # 401 인증 실패 / 429 토큰 소진 / 5xx 서버 오류 → 폴백 대상
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()


class HuggingFaceBackend:
    """로컬 transformers 모델. API 키 없이 동작."""

    name = "huggingface"

    def __init__(self, model_name: str = LLM_MODEL, device: str = None):
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        kwargs = {
            "torch_dtype": torch.float16 if self.device == "cuda" else torch.float32
        }
        if self.device == "cuda":
            kwargs["device_map"] = "auto"
        self.model = AutoModelForCausalLM.from_pretrained(model_name, **kwargs)
        if self.device != "cuda":
            self.model.to(self.device)

    def generate(self, messages: list, max_new_tokens: int = None) -> str:
        max_new_tokens = max_new_tokens or MAX_NEW_TOKENS
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


class Generator:
    """
    프로바이더를 선택하고, Upstage 실패 시 HuggingFace 로 자동 전환한다.

    폴백 모델은 미리 로드하지 않는다(지연 로딩).
    Upstage 를 쓰는데 6GB 모델을 받아둘 이유가 없기 때문이다.
    단, 첫 폴백 시 모델 다운로드/로드 시간이 발생한다.
    이를 피하려면 preload_fallback=True 로 생성한다.
    """

    def __init__(self, provider: str = None, device: str = None,
                 preload_fallback: bool = False):
        self.device = device
        self.provider_setting = (provider or LLM_PROVIDER).lower()
        self._hf = None            # 지연 로딩
        self.fallback_reason = None

        want_upstage = (
            self.provider_setting == "upstage"
            or (self.provider_setting == "auto" and bool(UPSTAGE_API_KEY))
        )

        if want_upstage:
            try:
                self.backend = UpstageBackend()
                print(f"[LLM] Upstage {UPSTAGE_MODEL} 사용")
            except Exception as e:
                print(f"[LLM] Upstage 초기화 실패 → HuggingFace 폴백: {e}")
                self.fallback_reason = str(e)
                self.backend = self._get_hf()
        else:
            self.backend = self._get_hf()
            print(f"[LLM] HuggingFace {LLM_MODEL} 사용 ({self.backend.device})")

        if preload_fallback and self.backend.name == "upstage":
            self._get_hf()

    def _get_hf(self):
        if self._hf is None:
            self._hf = HuggingFaceBackend(device=self.device)
        return self._hf

    @property
    def active(self) -> str:
        return self.backend.name

    def generate(self, messages: list, max_new_tokens: int = None) -> str:
        try:
            return self.backend.generate(messages, max_new_tokens)
        except Exception as e:
            if self.backend.name != "upstage":
                raise
            # 토큰 소진 / 인증 오류 / 네트워크 장애 → 로컬 모델로 영구 전환
            print(f"[LLM] Upstage 호출 실패 → HuggingFace 로 전환: {e}")
            self.fallback_reason = str(e)
            self.backend = self._get_hf()
            return self.backend.generate(messages, max_new_tokens)


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
        for mode in ["dense", "bm25"]:
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
        print(f"활성 백엔드: {g.active}\n")
        q = queries[0]
        docs = r.search(q, k=3, mode="hybrid")
        msgs = build_prompt(q, docs)
        print(f"Q. {q}\n")
        print(g.generate(msgs))