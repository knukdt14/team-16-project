#!/bin/sh
# backend/entrypoint.sh
# 인덱스가 없으면 만들고 서버를 띄운다.
# git 에 인덱스를 커밋해 두면 이 단계는 건너뛴다.

set -e

cd /app/ai_engine

if [ ! -f /app/data/chunks.jsonl ]; then
    echo "[entrypoint] chunks.jsonl 없음 → PDF 파싱 시작"
    python load_pdf.py
fi

if [ ! -d /app/data/vectorstore ] || [ -z "$(ls -A /app/data/vectorstore 2>/dev/null)" ]; then
    echo "[entrypoint] 벡터스토어 없음 → 인덱싱 시작 (수 분 소요)"
    python build_vectorstore.py --device cpu
fi

echo "[entrypoint] 서버 기동"
cd /app/backend
exec uvicorn main:app --host 0.0.0.0 --port 8000