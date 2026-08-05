"use client";
import { useEffect, useMemo, useState } from "react";
import { OUTLINE, JEJU, PROVINCES, makeProjector } from "@/lib/korea";
import { compareSubsidy } from "@/lib/api";

const DEFAULT_MODEL = "EV6";

function lerpColor(t) {
  const r = Math.round(190 + (4 - 190) * t);
  const g = Math.round(233 + (120 - 233) * t);
  const b = Math.round(213 + (87 - 213) * t);
  return `rgb(${r},${g},${b})`;
}

export default function KoreaMap({ mode }) {
  const is3d = mode === "3d";
  const [zoom, setZoom] = useState(1);
  const [values, setValues] = useState(() =>
    Object.fromEntries(PROVINCES.map((p) => [p.name, p.base]))
  );
  const [live, setLive] = useState(false);

  useEffect(() => {
    compareSubsidy(DEFAULT_MODEL, { limit: 200 })
      .then((res) => {
        const byS = {};
        for (const r of res.rows || []) byS[r.시도] = Math.max(byS[r.시도] || 0, r.총액);
        if (Object.keys(byS).length) { setValues((v) => ({ ...v, ...byS })); setLive(true); }
      })
      .catch(() => setLive(false));
  }, []);

  const { project, width, height } = useMemo(() => makeProjector({ width: 360, pad: 30 }), []);

  // 2.5D: 3D 모드면 지면을 수직으로 눌러(squash) 눕히고 아래로 내린다 → 막대는 그 위에 수직으로 세움
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
        </defs>

        {/* 지면 */}
        <path d={outlinePath} className="land" />
        <ellipse cx={jx} cy={jy} rx="13" ry={is3d ? 5 : 8} className="land" />

        {/* 막대 + 라벨 */}
        {PROVINCES.filter((p) => p.name !== "제주").map((p) => {
          const [cx, cy] = disp(p.lon, p.lat);
          const t = norm(values[p.name]);
          const hot = values[p.name] === max;
          if (is3d) {
            const h = 16 + t * 92;
            return (
              <g key={p.name}>
                <ellipse cx={cx} cy={cy + 2} rx="7" ry="3" fill="rgba(0,0,0,.14)" />
                <rect x={cx - 5} y={cy - h} width="10" height={h} rx="3"
                      fill={hot ? "#f59e0b" : "url(#barg)"} />
                <ellipse cx={cx} cy={cy - h} rx="5" ry="2.2"
                         fill={hot ? "#fbbf24" : "#6ee7b7"} />
                <text x={cx} y={cy - h - 6} className="mlabel">{p.name} {values[p.name]}</text>
              </g>
            );
          }
          const col = lerpColor(t);
          return (
            <g key={p.name}>
              <circle cx={cx} cy={cy} r={8 + t * 8} fill={col}
                      stroke={hot ? "#f59e0b" : "#0f766e"} strokeWidth={hot ? 2.5 : 1} />
              <text x={cx} y={cy - 12} className="mlabel">{p.name} {values[p.name]}</text>
            </g>
          );
        })}
        <text x={jx} y={jy + (is3d ? 14 : 22)} className="mlabel">제주 {values["제주"]}</text>
      </svg>

      <div className="map-legend">
        {live ? "EV6 기준 · 백엔드 연동" : "승용 개요(백엔드 미연결)"} · 색·높이 = 보조금 총액(만원) · 스크롤/＋−로 확대
      </div>
    </div>
  );
}
