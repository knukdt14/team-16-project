// 2026년 광역시 전기승용 보조금 (국비+지방비 최대금액, 만원) — ev.or.kr 크롤링 데이터
export const REGIONS = [
  { name: "서울", full: "서울특별시", passenger: 842, mini: 637, lat: 37.5665, lon: 126.9780 },
  { name: "부산", full: "부산광역시", passenger: 872, mini: 637, lat: 35.1796, lon: 129.0756 },
  { name: "대구", full: "대구광역시", passenger: 842, mini: 637, lat: 35.8714, lon: 128.6014 },
  { name: "인천", full: "인천광역시", passenger: 842, mini: 637, lat: 37.4563, lon: 126.7052 },
  { name: "광주", full: "광주광역시", passenger: 842, mini: 637, lat: 35.1595, lon: 126.8526 },
  { name: "대전", full: "대전광역시", passenger: 842, mini: 637, lat: 36.3504, lon: 127.3845 },
  { name: "울산", full: "울산광역시", passenger: 842, mini: 637, lat: 35.5384, lon: 129.3114 },
  { name: "세종", full: "세종특별자치시", passenger: 842, mini: 637, lat: 36.4801, lon: 127.2890 },
];

export const MAX_PASSENGER = Math.max(...REGIONS.map((r) => r.passenger));
export const AVG_PASSENGER = Math.round(
  REGIONS.reduce((s, r) => s + r.passenger, 0) / REGIONS.length
);
export const GUK_MAX = 580; // 중·대형 승용 국비 최대 (2026 지침)
