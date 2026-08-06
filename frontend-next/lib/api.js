// FastAPI 백엔드(team-16-project/backend) 연동 클라이언트 — 브라우저 fetch
//
// 실제 계약(backend/schemas.py 기준)
// ---------------------------------------------------------------------------
// POST /chat  body: { question, region?, model?, top_k?, mode? }
//   → ChatResponse {
//        status: "answered" | "need_info",
//        answer: string,
//        subsidy: null | {
//          시도, 시군구, 제조사, 모델명, 차종,
//          국비, 지방비, 총액, 전환지원금국비, 전환지원금지방비   // 단위: 만원
//        },
//        sources: [ { id, section, page, score, text } ],
//        need: object | null,      // status=need_info 일 때 되묻기 항목/선택지
//        extra: object | null,     // 추가지원금 계산 내역
//        entities: object,
//        elapsed_ms: number
//     }
// GET /subsidy?model=&region=            → 단건 조회
// GET /subsidy/compare?model=&sido=&limit=&order=  → 지역별 비교(지도/차트용)
// GET /regions                            → 시도/시군구 목록
// GET /models?car_type=                   → 제조사/모델 목록
// GET /health                             → 로딩 상태
//
// 환경변수: .env.local 에  NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function j(res) {
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

const qs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

export async function askChat({ question, region = null, model = null, top_k = 4, mode = "hybrid" }) {
  return j(
    await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, region, model, top_k, mode }),
    })
  );
}

export async function getSubsidy(model, region = null) {
  return j(await fetch(`${API_BASE}/subsidy?${qs({ model, region })}`));
}

export async function compareSubsidy(model, { sido = null, limit = 30, order = "desc" } = {}) {
  return j(await fetch(`${API_BASE}/subsidy/compare?${qs({ model, sido, limit, order })}`));
}

export async function getRegions() {
  return j(await fetch(`${API_BASE}/regions`));
}

export async function getModels(car_type = null) {
  return j(await fetch(`${API_BASE}/models?${qs({ car_type })}`));
}

export async function getHealth() {
  return j(await fetch(`${API_BASE}/health`));
}

export { API_BASE };
