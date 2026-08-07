// 챗봇 의도 분류 + 리치 응답 생성 (프론트 데모용).
// 실제 서비스에선 doc 답변을 FastAPI(RAG) 호출로 교체하세요.
import { REGIONS } from "./data";

// 지침 요약 미니 지식베이스 (RAG 대체용)
const GUIDE = [
  {
    k: ["전환지원금", "폐차", "내연차", "교체"],
    a: "**전환지원금**: 출고 후 3년 이상 경과한 내연기관차(하이브리드 제외)를 폐차·판매하고 전기차를 구매하면 **최대 100만원**을 추가 지원합니다. (2026년 신설)",
  },
  {
    k: ["청년", "생애", "첫차"],
    a: "**청년 추가지원**: 만 19~34세 청년이 생애 첫 자동차로 전기승용차를 구매하면 **국비 지원액의 20%**를 추가 지원합니다.",
  },
  {
    k: ["다자녀", "자녀"],
    a: "**다자녀 추가지원**: 18세 이하 자녀 2명 이상 가구는 자녀 수에 따라 추가 지원 — 2자녀 100만원 / 3자녀 200만원 / 4자녀 이상 300만원.",
  },
  {
    k: ["가격", "구간", "5300", "8500", "상한"],
    a: "**가격구간(승용)**: 기본가격 5,300만원 미만은 보조금 100%, 5,300~8,500만원 미만은 50%, 8,500만원 이상은 미지원. (2027년 5,000/8,000만원으로 강화 예정)",
  },
  {
    k: ["차상위", "저소득"],
    a: "**차상위 이하 계층 추가지원**: 승용은 국비의 20%, 화물은 국비의 30%를 추가 지원합니다.",
  },
];

export function classify(q) {
  const s = q.toLowerCase().replace(/\s/g, "");
  if (/(3d|입체|기울|쓰리디)/.test(s)) return { kind: "map", arg: "3d" };
  if (/(2d|평면|납작|위에서)/.test(s)) return { kind: "map", arg: "2d" };
  if (q.includes("지도")) return { kind: "map", arg: null };
  if (/(비교|순위|랭킹|제일|가장)/.test(q)) return { kind: "compare", arg: null };
  const hit = REGIONS.find((r) => q.includes(r.name) || q.includes(r.full));
  if (hit) return { kind: "region", arg: hit };
  return { kind: "doc", arg: null };
}

export function answerDoc(q) {
  let best = null, score = 0;
  for (const g of GUIDE) {
    const sc = g.k.reduce((n, k) => n + (q.includes(k) ? 1 : 0), 0);
    if (sc > score) { best = g; score = sc; }
  }
  return best
    ? best.a
    : "질문을 지침에서 찾지 못했어요. '전환지원금 조건', '청년 추가지원', '가격구간', '다자녀' 등을 물어보세요. (실제 서비스에선 지침 PDF 전체를 RAG로 검색합니다.)";
}
