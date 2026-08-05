"""
sweep_weights.py
하이브리드 검색의 Dense:BM25 가중치를 훑어 최적점을 찾는다.

배경:
    동등 가중(0.5:0.5) RRF 는 성능이 낮은 BM25 가 Dense 결과를 끌어내려
    하이브리드가 Dense 단독보다 나빠지는 현상이 관측됐다.
    (dense MRR 0.502 vs hybrid 0.449)
    가중치를 조정해 BM25 가 보완만 하고 방해하지 않는 지점을 찾는다.

실행:
    python sweep_weights.py
    python sweep_weights.py --k 3
출력:
    ../eval/results_sweep.csv
"""

import argparse
from pathlib import Path

import pandas as pd

from rag_chain import Retriever

Q_PATH = Path("../eval/questions.csv")
R_PATH = Path("../eval/references.csv")
OUT_PATH = Path("../eval/results_sweep.csv")

WEIGHTS = [1.0, 0.9, 0.85, 0.8, 0.75, 0.7, 0.6, 0.5, 0.3, 0.0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--device", default=None)
    args = ap.parse_args()

    q = pd.read_csv(Q_PATH)
    r = pd.read_csv(R_PATH)
    df = q.merge(r, on="qid")
    df["gold"] = df["gold_chunk_ids"].map(lambda s: set(str(s).split("|")))
    print(f"평가셋 {len(df)}문항 / top-{args.k}\n")

    retriever = Retriever(device=args.device)
    rows = []

    for w in WEIGHTS:
        hits, rrs = [], []
        for _, row in df.iterrows():
            res = retriever.search(
                row["question"], k=args.k, mode="hybrid",
                w_dense=w, w_bm25=round(1 - w, 3),
            )
            ids = [h["id"] for h in res]
            hits.append(int(any(i in row["gold"] for i in ids)))
            rrs.append(next((1 / i for i, d in enumerate(ids, 1)
                             if d in row["gold"]), 0.0))

        rec = {
            "w_dense": w,
            "w_bm25": round(1 - w, 3),
            f"Hit@{args.k}": round(sum(hits) / len(hits), 4),
            "MRR": round(sum(rrs) / len(rrs), 4),
        }
        rows.append(rec)
        print(f"  dense {w:.2f} : bm25 {1-w:.2f}  →  "
              f"Hit@{args.k} {rec[f'Hit@{args.k}']:.4f}  MRR {rec['MRR']:.4f}")

    res = pd.DataFrame(rows)
    best = res.loc[res["MRR"].idxmax()]

    print("\n" + "=" * 50)
    print(f"최적: dense {best['w_dense']} : bm25 {best['w_bm25']}")
    print(f"      MRR {best['MRR']:.4f}  Hit@{args.k} {best[f'Hit@{args.k}']:.4f}")

    dense_only = res[res["w_dense"] == 1.0]["MRR"].iloc[0]
    if best["MRR"] <= dense_only:
        print("\n[결론] 이 코퍼스에서는 BM25 결합이 Dense 단독을 넘지 못했다.")
        print("       하이브리드가 항상 우월하지는 않음을 보여주는 결과.")
    else:
        print(f"\n[결론] Dense 단독 대비 "
              f"{(best['MRR'] - dense_only) / dense_only * 100:+.1f}% 개선")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    res.to_csv(OUT_PATH, index=False, encoding="utf-8-sig")
    print(f"\n저장: {OUT_PATH}")


if __name__ == "__main__":
    main()