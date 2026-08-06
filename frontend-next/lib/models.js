// 백엔드 /models 응답(트림 121종)을 '대표 차종'으로 묶는다.
// 트림/세부옵션을 떼고 중복 제거 → 깔끔한 체크박스 목록.
// query(=대표명)로 compareSubsidy 하면 백엔드가 해당 트림 전체에서 최고액을 돌려준다.

const STRIP = new RegExp(
  [
    "\\(.*?\\)",              // (단종), (Facelift) 등 괄호
    "더\\s?뉴", "the\\s?all-?new", "the\\s?new", "\\bnew\\b",
    "빌트인\\s?캠(\\s?미적용)?",
    "N\\s?라인", "GT-?\\s?line", "\\bGT\\b",
    "롱\\s?레인지", "스탠다드", "스탠더드", "long\\s?range", "standard",
    "single\\s?motor", "twin\\s?motor", "\\bER\\b", "\\bLR\\b",
    "active", "dynamic", "performance", "prestige", "exclusive", "premium", "plus", "pro", "max",
    "facelift", "4matic", "awd", "rwd", "[0-9]+\\s?wd", "[0-9]+wd",
    "[0-9]+인치", "[0-9]+인승", "승용", "밴", "화물",
    "CY[0-9]+\\S*",
  ].join("|"),
  "gi"
);

export function baseModelsFrom(resp) {
  const all = Object.values(resp?.models_by_manufacturer || {}).flat();
  const seen = new Map();
  for (const m of all) {
    const raw = String(m).replace(/^\(단종\)\s*/, "");
    let b = raw.replace(STRIP, " ").replace(/\s+/g, " ").trim();
    if (b.length < 2) b = raw.trim();
    const key = b.replace(/\s/g, "").toLowerCase();
    if (b && !seen.has(key)) seen.set(key, { label: b, query: b });
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, "ko"));
}
