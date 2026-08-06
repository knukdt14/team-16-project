// 경량 한국 지도 데이터 (외곽선 + 17개 시도 위치)
// 좌표는 [경도(lon), 위도(lat)]. 실측 근사값.

// 남한 본토 외곽선(간이) — 시계방향
export const OUTLINE = [
  // 북부 DMZ (서→동)
  [126.55, 37.75], [126.68, 37.95], [126.90, 38.00], [127.35, 38.28],
  [127.90, 38.30], [128.36, 38.62],
  // 동해안 (북→남, 비교적 직선)
  [129.10, 37.75], [129.42, 37.10], [129.56, 36.05], [129.42, 35.55],
  [129.28, 35.10],
  // 남해안 (동→서, 굴곡)
  [128.95, 34.98], [128.68, 35.08], [128.40, 34.85], [128.05, 34.95],
  [127.75, 34.75], [127.45, 34.90], [127.30, 34.58], [127.05, 34.75],
  [126.90, 34.55], [126.70, 34.60], [126.52, 34.35], [126.38, 34.55],
  // 서해안 (남→북, 굴곡 + 태안 돌출)
  [126.48, 34.90], [126.35, 35.10], [126.55, 35.55], [126.42, 35.75],
  [126.62, 36.00], [126.48, 36.35], [126.15, 36.55], [126.55, 36.75],
  [126.42, 36.95], [126.62, 37.10], [126.42, 37.30], [126.62, 37.45],
  [126.50, 37.60], [126.55, 37.75],
];

// 제주도(간이 타원 대체용 중심/반경)
export const JEJU = { lon: 126.53, lat: 33.38 };

// 17개 시도 대표 좌표 + 백엔드 미연결 시 사용할 승용 보조금(국비+지방비 최대, 만원)
export const PROVINCES = [
  { name: "서울", lon: 126.98, lat: 37.57, base: 842 },
  { name: "인천", lon: 126.71, lat: 37.46, base: 842 },
  { name: "경기", lon: 127.20, lat: 37.30, base: 1000 },
  { name: "강원", lon: 128.20, lat: 37.80, base: 972 },
  { name: "충북", lon: 127.70, lat: 36.80, base: 1296 },
  { name: "충남", lon: 126.80, lat: 36.50, base: 1248 },
  { name: "세종", lon: 127.29, lat: 36.48, base: 842 },
  { name: "대전", lon: 127.38, lat: 36.35, base: 842 },
  { name: "전북", lon: 127.10, lat: 35.70, base: 1351 },
  { name: "전남", lon: 126.90, lat: 34.90, base: 1300 },
  { name: "광주", lon: 126.85, lat: 35.16, base: 842 },
  { name: "경북", lon: 128.70, lat: 36.30, base: 1315 },
  { name: "대구", lon: 128.60, lat: 35.87, base: 842 },
  { name: "경남", lon: 128.20, lat: 35.30, base: 900 },
  { name: "부산", lon: 129.08, lat: 35.18, base: 872 },
  { name: "울산", lon: 129.31, lat: 35.54, base: 842 },
  { name: "제주", lon: 126.53, lat: 33.38, base: 1095 },
];

// 경도/위도 → SVG 좌표 투영 (등거리, 경도는 중위도 cos 보정)
export function makeProjector({ width = 300, pad = 26 } = {}) {
  const pts = [...OUTLINE, ...PROVINCES.map((p) => [p.lon, p.lat]), [JEJU.lon, JEJU.lat]];
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const lonMin = Math.min(...lons), lonMax = Math.max(...lons);
  const latMin = Math.min(...lats), latMax = Math.max(...lats);
  const midLat = (latMin + latMax) / 2;
  const cos = Math.cos((midLat * Math.PI) / 180);
  const lonW = (lonMax - lonMin) * cos;
  const latH = latMax - latMin;
  const scale = (width - 2 * pad) / lonW;
  const height = latH * scale + 2 * pad;
  const project = (lon, lat) => [
    pad + (lon - lonMin) * cos * scale,
    pad + (latMax - lat) * scale,
  ];
  return { project, width, height };
}
