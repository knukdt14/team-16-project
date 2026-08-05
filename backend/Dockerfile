# backend/Dockerfile
# ai_engine 과 backend 를 함께 담는다.
# (pipeline.py 를 import 로 호출하므로 같은 이미지에 있어야 함)

FROM python:3.11-slim

# 빌드 도구 (kiwipiepy 등 일부 패키지가 컴파일 필요)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# torch 를 먼저 CPU 버전으로 설치 (기본 휠은 CUDA 포함이라 수 GB 더 큼)
RUN pip install --no-cache-dir \
        torch --index-url https://download.pytorch.org/whl/cpu

# 의존성 레이어 분리 (코드만 바뀌면 재설치 안 함)
COPY ai_engine/requirements.txt /app/ai_engine/requirements.txt
COPY backend/requirements.txt   /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/ai_engine/requirements.txt \
    && pip install --no-cache-dir -r /app/backend/requirements.txt

# 소스
COPY ai_engine/ /app/ai_engine/
COPY backend/   /app/backend/

# HuggingFace 캐시를 볼륨으로 빼기 위한 경로
ENV HF_HOME=/models \
    PYTHONUNBUFFERED=1

EXPOSE 8000

# 인덱스가 없으면 자동 생성 후 서버 기동
# (Codespaces 에서 clone 직후에도 docker compose up 한 번으로 동작하도록)
COPY backend/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=5 \
    CMD curl -fs http://localhost:8000/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]