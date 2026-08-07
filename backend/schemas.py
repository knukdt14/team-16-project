"""
schemas.py
API 요청/응답 형식 정의. 프론트엔드와의 계약서 역할을 한다.

이 파일이 정해지면 프론트는 실제 동작 없이도 화면을 만들 수 있고,
백엔드는 내부 구현을 자유롭게 바꿀 수 있다.
"""

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------- 공통
class Source(BaseModel):
    """답변 근거로 사용된 문서 조각"""
    id: str = Field(..., description="청크 ID", examples=["guide_0045"])
    section: str = Field(..., description="지침 조항", examples=["4-1-2. 중·대형, 소형"])
    page: int = Field(..., description="원문 페이지", examples=[12])
    score: float = Field(..., description="검색 점수", examples=[0.8721])
    text: str = Field(..., description="청크 본문")


class Subsidy(BaseModel):
    """조회된 보조금 금액 (단위: 만원)"""
    시도: str = Field(..., examples=["부산"])
    시군구: str = Field(..., examples=["부산광역시"])
    제조사: str = Field(..., examples=["기아"])
    모델명: str = Field(..., examples=["더뉴EV6 스탠다드"])
    차종: str = Field(..., examples=["일반승용"])
    국비: int = Field(..., examples=[501])
    지방비: int = Field(..., examples=[180])
    총액: int = Field(..., examples=[681])
    전환지원금국비: int = Field(..., examples=[100])
    전환지원금지방비: int = Field(..., examples=[30])


# ---------------------------------------------------------------- /chat
class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500,
                          examples=["청년이 첫 차로 사면 얼마나 더 받나요?"])
    region: Optional[str] = Field(
        None, description="화면에서 선택한 지역. 질문에 지역이 없을 때 보완용",
        examples=["성남시"])
    model: Optional[str] = Field(
        None, description="화면에서 선택한 차종", examples=["EV6"])
    top_k: int = Field(4, ge=1, le=10, description="검색할 문서 수")
    mode: Literal["dense", "bm25", "hybrid"] = Field(
        "dense",
        description="검색 방식. 평가셋 기준 dense 가 최적이라 기본값. "
                    "bm25/hybrid 는 비교 실험용")


class ChatResponse(BaseModel):
    status: Literal["answered", "need_info"] = Field(
        ..., description="need_info 면 지역·트림 등 추가 정보가 필요한 상태")
    answer: str
    subsidy: Optional[Subsidy] = None
    sources: list[Source] = []
    need: Optional[dict[str, Any]] = Field(
        None, description="되물을 항목과 선택지 (status=need_info 일 때)")
    extra: Optional[dict[str, Any]] = Field(
        None, description="추가지원금 계산 내역 (해당 시)")
    entities: dict[str, Any] = Field(
        default_factory=dict, description="질문에서 추출한 지역·모델·자격조건")
    llm_backend: str | None = Field(
        None, description="실제 사용된 LLM (upstage | huggingface)")
    elapsed_ms: int = 0


# ---------------------------------------------------------------- /subsidy
class SubsidyResponse(BaseModel):
    status: Literal["ok", "need_region", "need_sigungu", "need_trim", "not_found"]
    message: Optional[str] = None
    subsidy: Optional[Subsidy] = None
    # 되묻기용 정보
    min: Optional[int] = None
    max: Optional[int] = None
    sido: Optional[str] = None
    sigungu_list: Optional[list[str]] = None
    trims: Optional[list[dict[str, Any]]] = None
    candidates_region: Optional[list[str]] = None
    candidates_model: Optional[list[str]] = None


class CompareRow(BaseModel):
    시도: str
    시군구: str
    모델명: str
    국비: int
    지방비: int
    총액: int


class CompareResponse(BaseModel):
    model_query: str = Field(..., description="조회한 모델 키워드")
    matched_models: list[str] = Field(..., description="매칭된 실제 모델명")
    count: int
    rows: list[CompareRow]


# ---------------------------------------------------------------- 메타
class RegionsResponse(BaseModel):
    sido: list[str]
    sigungu_by_sido: dict[str, list[str]]


class ModelsResponse(BaseModel):
    manufacturers: list[str]
    models_by_manufacturer: dict[str, list[str]]
    car_types: list[str]


class HealthResponse(BaseModel):
    status: Literal["ok", "loading", "error"]
    llm_loaded: bool
    chunks: int
    subsidy_rows: int
    embed_model: str
    llm_model: str
    llm_provider: str = Field("-", description="설정값 (auto/upstage/huggingface)")
    llm_backend: str = Field("-", description="실제 사용 중인 백엔드")
    fallback_reason: str | None = Field(None, description="폴백이 발생한 경우 사유")


class ErrorResponse(BaseModel):
    detail: str