"use client";
import { useEffect, useMemo, useState } from "react";
import { OUTLINE, JEJU, PROVINCES, makeProjector } from "@/lib/korea";
import { compareSubsidy } from "@/lib/api";

function lerpColor(t) {
  const r = Math.round(190 + (4 - 190) * t);
  const g = Math.round(233 + (120 - 233) * t);
  const b = Math.round(213 + (87 - 213) * t);
  return `rgb(${r},${g},${b})`;
}

function findProvinceName(regionText) {
  if (!regionText) return null;
  const str = String(regionText);
  for (const p of PROVINCES) {
    if (str.includes(p.name)) return p.name;
  }
  if (str.includes("서울")) return "서울";
  if (str.includes("부산")) return "부산";
  if (str.includes("대구")) return "대구";
  if (str.includes("인천")) return "인천";
  if (str.includes("광주")) return "광주";
  if (str.includes("대전")) return "대전";
  if (str.includes("울산")) return "울산";
  if (str.includes("세종")) return "세종";
  if (str.includes("경기") || str.includes("성남") || str.includes("수원") || str.includes("용인") || str.includes("고양") || str.includes("부천")) return "경기";
  if (str.includes("강원") || str.includes("춘천") || str.includes("원주") || str.includes("강릉")) return "강원";
  if (str.includes("충북") || str.includes("청주") || str.includes("충주")) return "충북";
  if (str.includes("충남") || str.includes("천안") || str.includes("아산") || str.includes("서산")) return "충남";
  if (str.includes("전북") || str.includes("전주") || str.includes("익산") || str.includes("군산")) return "전북";
  if (str.includes("전남") || str.includes("목포") || str.includes("여수") || str.includes("순천")) return "전남";
  if (str.includes("경북") || str.includes("포항") || str.includes("구미") || str.includes("경주")) return "경북";
  if (str.includes("경남") || str.includes("창원") || str.includes("김해") || str.includes("진주")) return "경남";
  if (str.includes("제주")) return "제주";
  return null;
}

export default function KoreaMap({ mode, highlightRegion, selectedModel = "EV6" }) {
  const is3d = mode === "3d";
  const [zoom, setZoom] = useState(1);
  const [values, setValues] = useState(() =>
    Object.fromEntries(PROVINCES.map((p) => [p.name, p.base]))
  );
  const [live, setLive] = useState(false);

  const activeProvName = useMemo(() => findProvinceName(highlightRegion), [highlightRegion]);

  useEffect(() => {
    const modelToQuery = selectedModel || "EV6";
    compareSubsidy(modelToQuery, { limit: 200 })
      .then((res) => {
        const byS = {};
        for (const r of res.rows || []) {
          byS[r.시도] = Math.max(byS[r.시도] || 0, r.총액);
        }
        if (Object.keys(byS).length) {
          setValues((v) => ({ ...v, ...byS }));
          setLive(true);
        }
      })
      .catch(() => setLive(false));
  }, [selectedModel]);

  const { project, width, height } = useMemo(() => makeProjector({ width: 360, pad: 30 }), []);

  const squash = is3d ? 0.62 : 1;
  const yOff = is3d ? height * 0.16 : 0;
  const disp = (lon, lat) => {
    const [x, y] = project(lon, lat);
    return [x, y * squash + yOff];
  };

  const outlinePath = useMemo(() => {
    return (
      OUTLINE.map(([lo, la], i) => {
        const [x, y] = disp(lo, la);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(" ") + " Z"
    );
    // eslint-disable-next-line
  }, [project, is3d]);

  const vals = Object.values(values);
  const min = Math.min(...vals), max = Math.max(...vals);
  const norm = (v) => (max === min ? 0.5 : (v - min) / (max - min));
  const [jx, jy] = disp(JEJU.lon, JEJU.lat);
  const isJejuActive = activeProvName === "제주";

  return (
    <div className="map-wrap"
         onWheel={(e) => setZoom((z) => Math.min(3, Math.max(1, +(z + (e.deltaY < 0 ? 0.2 : -0.2)).toFixed(2))))}>
      <div className="zoom-ctl">
        <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.3).toFixed(2)))}>+</button>
        <button onClick={() => setZoom((z) => Math.max(1, +(z - 0.3).toFixed(2)))}>−</button>
        {zoom > 1 && <button onClick={() => setZoom(1)}>⟲</button>}
      </div>

      <svg className="mapsvg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet"
           style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}>
        <defs>
          <linearGradient id="barg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="barhl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 지면 */}
        <path d={outlinePath} className="land" />
        <ellipse cx={jx} cy={jy} rx="13" ry={is3d ? 5 : 8} className="land"
                 stroke={isJejuActive ? "#ef4444" : "none"} strokeWidth={isJejuActive ? 2 : 0} />

        {/* 막대 + 라벨 */}
        {PROVINCES.filter((p) => p.name !== "제주").map((p) => {
          const [cx, cy] = disp(p.lon, p.lat);
          const t = norm(values[p.name]);
          const isHighlighted = activeProvName === p.name;
          const hot = isHighlighted || values[p.name] === max;
          const barColor = isHighlighted ? "url(#barhl)" : hot ? "#f59e0b" : "url(#barg)";
          const topColor = isHighlighted ? "#fef08a" : hot ? "#fbbf24" : "#6ee7b7";

          if (is3d) {
            const h = 16 + t * 92;
            return (
              <g key={p.name} filter={isHighlighted ? "url(#glow)" : undefined}>
                <ellipse cx={cx} cy={cy + 2} rx={isHighlighted ? "10" : "7"} ry={isHighlighted ? "4.5" : "3"} fill="rgba(0,0,0,.2)" />
                {isHighlighted && (
                  <ellipse cx={cx} cy={cy + 2} rx="14" ry="6" fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.8" />
                )}
                <rect x={cx - (isHighlighted ? 7 : 5)} y={cy - h} width={isHighlighted ? 14 : 10} height={h} rx="3"
                      fill={barColor} />
                <ellipse cx={cx} cy={cy - h} rx={isHighlighted ? 7 : 5} ry={isHighlighted ? 3 : 2.2}
                         fill={topColor} />
                <text x={cx} y={cy - h - (isHighlighted ? 8 : 6)}
                      className={"mlabel" + (isHighlighted ? " active-label" : "")}
                      style={{ fontWeight: isHighlighted ? "bold" : "normal", fill: isHighlighted ? "#fbbf24" : undefined }}>
                  {isHighlighted ? `📍 ${p.name}` : p.name} {values[p.name]}
                </text>
              </g>
            );
          }
          const col = isHighlighted ? "#f59e0b" : lerpColor(t);
          return (
            <g key={p.name} filter={isHighlighted ? "url(#glow)" : undefined}>
              {isHighlighted && (
                <circle cx={cx} cy={cy} r={16 + t * 8} fill="none" stroke="#f59e0b" strokeWidth="2.5" opacity="0.8" />
              )}
              <circle cx={cx} cy={cy} r={8 + t * 8} fill={col}
                      stroke={hot ? "#f59e0b" : "#0f766e"} strokeWidth={hot ? 2.5 : 1} />
              <text x={cx} y={cy - 12} className={"mlabel" + (isHighlighted ? " active-label" : "")}
                    style={{ fontWeight: isHighlighted ? "bold" : "normal", fill: isHighlighted ? "#fbbf24" : undefined }}>
                {isHighlighted ? `📍 ${p.name}` : p.name} {values[p.name]}
              </text>
            </g>
          );
        })}
        <text x={jx} y={jy + (is3d ? 14 : 22)} className="mlabel">제주 {values["제주"]}</text>
      </svg>

      <div className="map-legend">
        {activeProvName && <span style={{ color: "#fbbf24", fontWeight: "bold", marginRight: 8 }}>📍 {activeProvName} 선택됨</span>}
        <span style={{ color: "var(--accent)", fontWeight: "bold" }}>🚗 {selectedModel}</span> {live ? "기준 · 백엔드 실시간 연동" : "기준"} · 색·높이 = 보조금 총액(만원)
      </div>
    </div>
  );
}
