"""
main.py
전기차 보조금 상담 챗봇 백엔드.

역할:
    프론트엔드(HTTP)와 AI 엔진(파이썬) 사이의 통신 계층.
    비즈니스 로직은 ai_engine 에 있고, 여기서는 요청/응답 변환만 담당한다.

설계 메모:
1) lifespan 으로 모델을 1회만 로드한다.
   요청마다 임베딩·LLM 을 올리면 첫 응답에 수십 초가 걸린다.

2) LLM 로딩은 백그라운드로 돌린다.
   서버는 즉시 뜨고, LLM 준비 전 요청은 검색 결과만 반환한다.
   (개발 중 프론트가 백엔드를 기다리지 않아도 되도록)

3) 무거운 추론은 스레드풀로 넘긴다.
   transformers 추론은 동기 blocking 이라 async 이벤트 루프를 막는다.

실행:
    uvicorn main:app --reload --port 8000
    문서: http://localhost:8000/docs
"""

import asyncio
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# ai_engine 모듈 경로 등록 (상대경로 유지를 위해 작업 디렉터리도 이동)
AI_DIR = (Path(__file__).parent.parent / "ai_engine").resolve()
sys.path.insert(0, str(AI_DIR))

from schemas import (  # noqa: E402
    ChatRequest, ChatResponse, CompareResponse, HealthResponse,
    ModelsResponse, RegionsResponse, SubsidyResponse,
)

# 전역 상태
STATE: dict = {"pipeline": None, "llm_ready": False, "error": None}
EXECUTOR = ThreadPoolExecutor(max_workers=2)


def _load_pipeline(with_llm: bool):
    """ai_engine 은 상대경로(../data)를 쓰므로 해당 디렉터리에서 로드한다."""
    import os
    cwd = os.getcwd()
    try:
        os.chdir(AI_DIR)
        from pipeline import Pipeline
        return Pipeline(load_llm=with_llm)
    finally:
        os.chdir(cwd)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1단계: 검색만 먼저 올려서 서버를 빠르게 기동
    print("[startup] 검색 엔진 로드 중...")
    try:
        STATE["pipeline"] = await asyncio.get_event_loop().run_in_executor(
            EXECUTOR, _load_pipeline, False
        )
        print("[startup] 검색 엔진 준비 완료")
    except Exception as e:
        STATE["error"] = str(e)
        print(f"[startup] 실패: {e}")

    # 2단계: LLM 은 백그라운드로 로드
    async def load_llm():
        try:
            print("[startup] LLM 로드 중... (수 분 소요 가능)")
            STATE["pipeline"] = await asyncio.get_event_loop().run_in_executor(
                EXECUTOR, _load_pipeline, True
            )
            STATE["llm_ready"] = True
            print("[startup] LLM 준비 완료")
        except Exception as e:
            STATE["error"] = str(e)
            print(f"[startup] LLM 로드 실패: {e}")

    task = asyncio.create_task(load_llm())
    yield
    task.cancel()
    EXECUTOR.shutdown(wait=False)


app = FastAPI(
    title="전기차 보조금 상담 API",
    description=(
        "2026년 전기자동차 보급사업 보조금 업무처리지침(RAG)과 "
        "지자체 차종별 보조금 데이터(CSV)를 결합한 상담 API.\n\n"
        "**금액은 CSV 조회값만 사용하며 LLM 이 생성하지 않습니다.**"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # 개발용. 배포 시 프론트 도메인으로 제한할 것
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_pipeline():
    if STATE["pipeline"] is None:
        raise HTTPException(503, "엔진 로딩 중입니다. 잠시 후 다시 시도해주세요.")
    return STATE["pipeline"]


# ---------------------------------------------------------------- 챗봇
@app.post("/chat", response_model=ChatResponse, tags=["챗봇"])
async def chat(req: ChatRequest):
    """
    자연어 질문에 답변한다.

    - 지역/트림이 특정되지 않으면 `status="need_info"` 로 되묻는다.
    - 금액은 CSV 조회값을 그대로 사용하며 LLM 이 계산하지 않는다.
    - `region`, `model` 은 화면에서 선택한 값을 보내면 질문을 보완한다.
    """
    p = get_pipeline()
    t0 = time.time()

    result = await asyncio.get_event_loop().run_in_executor(
        EXECUTOR,
        lambda: p.answer(req.question, region=req.region, model=req.model,
                         top_k=req.top_k, mode=req.mode),
    )

    return ChatResponse(
        status=result["status"],
        answer=result["answer"],
        subsidy=result.get("subsidy"),
        sources=result.get("sources", []),
        need=result.get("need"),
        extra=result.get("extra"),
        entities=result.get("entities", {}),
        elapsed_ms=int((time.time() - t0) * 1000),
    )


# ---------------------------------------------------------------- 금액 조회
@app.get("/subsidy", response_model=SubsidyResponse, tags=["보조금"])
async def get_subsidy(
    model: str = Query(..., description="차종. 별칭 가능", examples=["EV6"]),
    region: str | None = Query(None, description="지역", examples=["성남시"]),
):
    """
    지역·차종으로 보조금 금액을 조회한다.

    지역이나 트림이 모호하면 `status` 에 되묻기 유형과 선택지가 담긴다.
    - `need_sigungu`: 시도만 알 때. min/max 범위와 시군구 목록 제공
    - `need_trim`: 트림이 여럿일 때. trims 목록 제공
    - `need_region`: 지역명이 중복될 때 (예: 광주광역시 / 경기 광주시)
    """
    p = get_pipeline()
    r = p.lookup.lookup(region, model)

    if r["status"] == "ok":
        return SubsidyResponse(status="ok", subsidy=r)
    return SubsidyResponse(**{k: v for k, v in r.items()
                              if k in SubsidyResponse.model_fields})


@app.get("/subsidy/compare", response_model=CompareResponse, tags=["보조금"])
async def compare(
    model: str = Query(..., description="비교할 차종", examples=["EV6"]),
    sido: str | None = Query(None, description="특정 시도로 한정", examples=["경기"]),
    limit: int = Query(30, ge=1, le=200, description="반환 개수"),
    order: str = Query("desc", pattern="^(asc|desc)$", description="총액 정렬"),
):
    """
    같은 차종을 지역별로 비교한다. 지도·차트용.

    트림이 여러 개면 지역별 최고 금액 트림 기준으로 집계한다.
    """
    p = get_pipeline()
    models = p.lookup.resolve_model(model)
    if not models:
        raise HTTPException(404, f"'{model}' 에 해당하는 차량을 찾지 못했습니다.")

    df = p.lookup.df[p.lookup.df["모델명"].isin(models)]
    if sido:
        df = df[df["시도"] == sido]
        if df.empty:
            raise HTTPException(404, f"'{sido}' 지역 데이터가 없습니다.")

    df = df.dropna(subset=["보조금(만원)"])
    if df.empty:
        raise HTTPException(404, f"'{model}' 에 대한 유효한 보조금 데이터가 없습니다.")

    # 지역별 최고 금액 1건씩
    idx = df.groupby(["시도", "시군구"])["보조금(만원)"].idxmax()
    df = (df.loc[idx]
          .sort_values("보조금(만원)", ascending=(order == "asc"))
          .head(limit))

    rows = [
        {
            "시도": r["시도"], "시군구": r["시군구"], "모델명": r["모델명"],
            "국비": int(r["국비(만원)"]), "지방비": int(r["지방비(만원)"]),
            "총액": int(r["보조금(만원)"]),
        }
        for _, r in df.iterrows()
    ]
    return CompareResponse(
        model_query=model, matched_models=models, count=len(rows), rows=rows
    )


# ---------------------------------------------------------------- 메타
@app.get("/regions", response_model=RegionsResponse, tags=["메타"])
async def regions():
    """지역 드롭다운용 시도/시군구 목록"""
    p = get_pipeline()
    df = p.lookup.df
    return RegionsResponse(
        sido=sorted(df["시도"].unique().tolist()),
        sigungu_by_sido={
            s: sorted(df[df["시도"] == s]["시군구"].unique().tolist())
            for s in sorted(df["시도"].unique())
        },
    )


@app.get("/models", response_model=ModelsResponse, tags=["메타"])
async def models(
    car_type: str | None = Query(None, description="차종 필터", examples=["일반승용"])
):
    """차량 드롭다운용 제조사/모델 목록"""
    p = get_pipeline()
    df = p.lookup.df
    if car_type:
        df = df[df["차종"] == car_type]
    return ModelsResponse(
        manufacturers=sorted(df["제조사"].unique().tolist()),
        models_by_manufacturer={
            m: sorted(df[df["제조사"] == m]["모델명"].unique().tolist())
            for m in sorted(df["제조사"].unique())
        },
        car_types=sorted(p.lookup.df["차종"].unique().tolist()),
    )


@app.get("/health", response_model=HealthResponse, tags=["시스템"])
async def health():
    """헬스체크. Docker healthcheck 및 프론트 로딩 표시에 사용."""
    p = STATE["pipeline"]
    if p is None:
        return HealthResponse(
            status="error" if STATE["error"] else "loading",
            llm_loaded=False, chunks=0, subsidy_rows=0,
            embed_model="-", llm_model="-",
        )

    from build_vectorstore import EMBED_MODEL
    from rag_chain import LLM_MODEL

    return HealthResponse(
        status="ok",
        llm_loaded=STATE["llm_ready"],
        chunks=len(p.retriever.chunks),
        subsidy_rows=len(p.lookup.df),
        embed_model=EMBED_MODEL,
        llm_model=LLM_MODEL,
    )


@app.get("/", include_in_schema=False)
async def root():
    return {"service": "전기차 보조금 상담 API", "docs": "/docs"}