// 보조금 총액(만원) → 등급 뱃지
export function tierOf(total) {
  const t = Number(total) || 0;
  if (t >= 900) return { label: "PLATINUM", icon: "🥇", cls: "t-plat" };
  if (t >= 700) return { label: "GOLD", icon: "🥈", cls: "t-gold" };
  if (t >= 500) return { label: "SILVER", icon: "🥉", cls: "t-silver" };
  return { label: "BASIC", icon: "⚫", cls: "t-basic" };
}
