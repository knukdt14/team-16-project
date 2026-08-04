"""
evaluate.py
검색 성능을 정량 측정한다. Dense / BM25 / Hybrid 를 같은 평가셋으로 비교.

지표:
  Hit@k  - 상위 k개 안에 정답 청크가 하나라도 있는 비율
  MRR    - 정답이 처음 등장한 순위의 역수 평균 (1위면 1.0, 2위면 0.5, ...)
  Recall@k - 정답 청크 중 상위 k개에서 회수한 비율

입력:
  ../eval/questions.csv    qid, question, type, note
  ../eval/references.csv   qid, gold_chunk_ids  (여러 개면 | 로 구분)
출력:
  ../eval/results.csv

주의 - 평가셋 작성 시 데이터 누출:
  질문을 청크 원문 문장 그대로 베껴 쓰면 BM25 가 단어를 그대로 매칭해
  MRR 이 실제보다 크게 부풀려진다. 반드시 실제 사용자가 쓸 법한
  다른 표현으로 작성할 것. (questions.csv 는 그 원칙으로 작성됨)

실행:
    python evaluate.py                  # 전체 비교
    python evaluate.py --k 3            # top-3 기준
    python evaluate.py --show-fail      # 실패 사례 출력
"""

import argparse
from pathlib import Path

import pandas as pd

from rag_chain import Retriever

Q_PATH = Path("../eval/questions.csv")
R_PATH = Path("../eval/references.csv")
OUT_PATH = Path("../eval/results.csv")

MODES = ["dense", "bm25", "hybrid"]


def load_testset():
    if not Q_PATH.exists() or not R_PATH.exists():
        raise FileNotFoundError(
            f"평가셋이 없습니다.\n  {Q_PATH.resolve()}\n  {R_PATH.resolve()}"
        )
    q = pd.read_csv(Q_PATH)
    r = pd.read_csv(R_PATH)
    df = q.merge(r, on="qid", how="inner")
    df["gold"] = df["gold_chunk_ids"].map(lambda s: set(str(s).split("|")))
    if len(df) < len(q):
        missing = set(q["qid"]) - set(df["qid"])
        print(f"[경고] 정답 라벨이 없는 질문: {sorted(missing)}")
    return df


def evaluate_one(retriever, question, gold, k, mode):
    """단일 질문 평가 → (hit, rr, recall, 검색된 id 목록)"""
    hits = retriever.search(question, k=k, mode=mode)
    ids = [h["id"] for h in hits]

    hit = int(any(i in gold for i in ids))

    rr = 0.0
    for rank, i in enumerate(ids, start=1):
        if i in gold:
            rr = 1.0 / rank
            break

    recall = len(gold & set(ids)) / len(gold) if gold else 0.0
    return hit, rr, recall, ids


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--device", default=None)
    ap.add_argument("--show-fail", action="store_true", help="실패 사례 출력")
    args = ap.parse_args()

    df = load_testset()
    print(f"평가셋: {len(df)}문항 / top-{args.k}\n")

    retriever = Retriever(device=args.device)

    summary = []
    detail_rows = []

    for mode in MODES:
        hits, rrs, recalls = [], [], []
        for _, row in df.iterrows():
            h, rr, rec, ids = evaluate_one(
                retriever, row["question"], row["gold"], args.k, mode
            )
            hits.append(h)
            rrs.append(rr)
            recalls.append(rec)
            detail_rows.append({
                "qid": row["qid"], "mode": mode, "question": row["question"],
                "hit": h, "rr": round(rr, 4), "recall": round(rec, 4),
                "gold": "|".join(sorted(row["gold"])),
                "retrieved": "|".join(ids),
            })

        summary.append({
            "mode": mode,
            f"Hit@{args.k}": round(sum(hits) / len(hits), 4),
            "MRR": round(sum(rrs) / len(rrs), 4),
            f"Recall@{args.k}": round(sum(recalls) / len(recalls), 4),
            "n": len(hits),
        })

    # ---- 결과 출력 ----
    res = pd.DataFrame(summary)
    print("=" * 58)
    print("검색 방식별 성능")
    print("=" * 58)
    print(res.to_string(index=False))
    print()

    best = res.loc[res["MRR"].idxmax(), "mode"]
    base = res.loc[res["mode"] == "dense", "MRR"].iloc[0]
    top = res["MRR"].max()
    if base > 0:
        print(f"최고 성능: {best} (MRR {top:.4f}, dense 대비 "
              f"{(top - base) / base * 100:+.1f}%)")
    print()

    # ---- 유형별 분석 ----
    detail = pd.DataFrame(detail_rows)
    merged = detail.merge(df[["qid", "type"]], on="qid", how="left")
    by_type = (merged.groupby(["mode", "type"])[["hit", "rr"]]
               .mean().round(4).reset_index())
    print("유형별 (참고)")
    print(by_type.to_string(index=False))
    print()

    # ---- 실패 사례 ----
    fails = detail[(detail["mode"] == "hybrid") & (detail["hit"] == 0)]
    if len(fails):
        print(f"하이브리드 실패 {len(fails)}건:")
        for _, f in fails.iterrows():
            print(f"  [{f['qid']}] {f['question']}")
            print(f"        정답: {f['gold']}")
            print(f"        검색: {f['retrieved']}")
        print()
    else:
        print("하이브리드 실패 없음\n")

    if args.show_fail:
        for mode in MODES:
            mf = detail[(detail["mode"] == mode) & (detail["hit"] == 0)]
            print(f"[{mode}] 실패 {len(mf)}건: {list(mf['qid'])}")

    # ---- 저장 ----
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    res.to_csv(OUT_PATH, index=False, encoding="utf-8-sig")
    detail.to_csv(OUT_PATH.with_name("results_detail.csv"),
                  index=False, encoding="utf-8-sig")
    print(f"저장: {OUT_PATH}")
    print(f"      {OUT_PATH.with_name('results_detail.csv')}")


if __name__ == "__main__":
    main()