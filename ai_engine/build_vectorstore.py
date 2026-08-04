"""
build_vectorstore.py
load_pdf.py 가 만든 chunks.jsonl 을 임베딩하여 Chroma 벡터스토어를 구축한다.

설계 메모:
- 임베딩: Qwen/Qwen3-Embedding-0.6B
  Qwen3 임베딩은 '쿼리에만' instruct 접두사를 붙이는 비대칭 구조다.
  문서(passage)에는 접두사를 붙이지 않는다.
  → rag_chain.py 에서 쿼리를 인코딩할 때 반드시 build_query() 를 재사용할 것.
    (여기와 다른 방식으로 인코딩하면 검색 품질이 크게 떨어짐)
- 정규화(normalize_embeddings=True) 후 코사인 유사도 사용.
- 메타데이터는 Chroma가 스칼라(str/int/float/bool)만 허용하므로 그대로 저장.

실행:
    python build_vectorstore.py                 # 기본 (GPU 있으면 GPU)
    python build_vectorstore.py --device cpu    # CPU 강제
    python build_vectorstore.py --rebuild       # 기존 인덱스 삭제 후 재생성
"""

import argparse
import json
import shutil
from pathlib import Path

import chromadb
import torch
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

# ---------------------------------------------------------------- 설정
CHUNKS_PATH = Path("../data/chunks.jsonl")
INDEX_DIR = Path("../data/vectorstore")
COLLECTION = "ev_subsidy"

EMBED_MODEL = "Qwen/Qwen3-Embedding-0.6B"

# Qwen3 임베딩 권장 형식: 쿼리에만 태스크 지시문을 붙인다.
QUERY_INSTRUCTION = (
    "Given a question about Korean electric vehicle purchase subsidies, "
    "retrieve relevant regulation passages"
)


def build_query(text: str) -> str:
    """쿼리 인코딩용 포맷. rag_chain.py 에서 이 함수를 import 해서 쓸 것."""
    return f"Instruct: {QUERY_INSTRUCTION}\nQuery: {text}"


# ---------------------------------------------------------------- 로드
def load_chunks(path: Path):
    if not path.exists():
        raise FileNotFoundError(
            f"청크 파일이 없습니다: {path.resolve()}\n"
            f"먼저 `python load_pdf.py` 를 실행하세요."
        )
    chunks = [json.loads(line) for line in path.open(encoding="utf-8")]
    if not chunks:
        raise ValueError("청크가 비어 있습니다.")
    return chunks


def pick_device(arg: str) -> str:
    if arg != "auto":
        return arg
    return "cuda" if torch.cuda.is_available() else "cpu"


# ---------------------------------------------------------------- 메인
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--rebuild", action="store_true", help="기존 인덱스 삭제 후 재생성")
    args = ap.parse_args()

    chunks = load_chunks(CHUNKS_PATH)
    print(f"청크 로드: {len(chunks)}개")

    device = pick_device(args.device)
    print(f"디바이스: {device}")
    if device == "cuda":
        print(f"  GPU: {torch.cuda.get_device_name(0)}")

    # 기존 인덱스 처리
    if args.rebuild and INDEX_DIR.exists():
        shutil.rmtree(INDEX_DIR)
        print("기존 인덱스 삭제")
    INDEX_DIR.mkdir(parents=True, exist_ok=True)

    # ---- 임베딩 ----
    print(f"\n임베딩 모델 로드: {EMBED_MODEL}")
    model = SentenceTransformer(EMBED_MODEL, device=device)
    dim = model.get_sentence_embedding_dimension()
    print(f"  차원: {dim} / 최대 시퀀스: {model.max_seq_length}")

    texts = [c["text"] for c in chunks]
    print(f"\n문서 임베딩 중... ({len(texts)}개)")
    embeddings = model.encode(
        texts,                        # 문서에는 instruct 접두사를 붙이지 않는다
        batch_size=args.batch_size,
        normalize_embeddings=True,    # 코사인 유사도용 정규화
        show_progress_bar=True,
        convert_to_numpy=True,
    )
    print(f"완료: {embeddings.shape}")

    # ---- Chroma 저장 ----
    client = chromadb.PersistentClient(
        path=str(INDEX_DIR),
        settings=Settings(anonymized_telemetry=False),
    )

    # 같은 이름의 컬렉션이 있으면 교체
    try:
        client.delete_collection(COLLECTION)
        print(f"기존 컬렉션 '{COLLECTION}' 삭제")
    except Exception:
        pass

    collection = client.create_collection(
        name=COLLECTION,
        metadata={"hnsw:space": "cosine", "embed_model": EMBED_MODEL},
    )

    collection.add(
        ids=[c["id"] for c in chunks],
        documents=texts,
        embeddings=embeddings.tolist(),
        metadatas=[c["metadata"] for c in chunks],
    )
    print(f"\n저장 완료: {INDEX_DIR.resolve()}")
    print(f"컬렉션 '{COLLECTION}' 문서 수: {collection.count()}")

    # ---- 동작 확인 ----
    print("\n" + "=" * 60)
    print("검색 테스트")
    print("=" * 60)
    test_queries = [
        "청년이 생애 첫 차로 사면 얼마나 더 받나요?",
        "대구에 얼마나 살아야 신청할 수 있나요?",
        "차값이 6천만원이면 보조금 다 나오나요?",
    ]
    for q in test_queries:
        q_emb = model.encode(
            [build_query(q)], normalize_embeddings=True, convert_to_numpy=True
        )
        res = collection.query(query_embeddings=q_emb.tolist(), n_results=2)
        print(f"\nQ. {q}")
        for doc, meta, dist in zip(
            res["documents"][0], res["metadatas"][0], res["distances"][0]
        ):
            body = doc.split("\n", 1)[-1]
            print(f"  [유사도 {1 - dist:.3f}] {meta['section']}")
            print(f"    {body[:100]}...")


if __name__ == "__main__":
    main()