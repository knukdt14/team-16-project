"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from "react-simple-maps";
import { PROVINCES } from "@/lib/korea";
import { compareSubsidy } from "@/lib/api";
import { tierOf } from "@/lib/tier";

const GEO_URL =
  "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_provinces_geo_simple.json";
const MODEL = "EV6";

const FULL2SHORT = {
  서울특별시: "서울", 부산광역시: "부산", 대구광역시: "대구", 인천광역시: "인천",
  광주광역시: "광주", 대전광역시: "대전", 울산광역시: "울산", 세종특별자치시: "세종",
  세종특별시: "세종", 경기도: "경기", 강원도: "강원", 강원특별자치도: "강원",
  충청북도: "충북", 충청남도: "충남", 전라북도: "전북", 전북특별자치도: "전북",
  전라남도: "전남", 경상북도: "경북", 경상남도: "경남",
  제주특별자치도: "제주", 제주도: "제주",
};
const toShort = (nm = "") => FULL2SHORT[nm] || nm.slice(0, 2);

function colorFor(t) {
  const a = [209, 240, 222], b = [4, 120, 87];
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function ripple(e) {
  const d = document.createElement("div");
  d.className = "map-ripple";
  d.style.left = e.clientX + "px";
  d.style.top = e.clientY + "px";
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 650);
}

// 숫자 카운트업 애니메이션 (0 → 목표 금액을 부드럽게 굴림)
function CountUp({ value = 0, dur = 900 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf, start;
    const from = 0, to = Number(value) || 0;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setN(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, dur]);
  return <>{n.toLocaleString()}</>;
}

export default function KoreaMap({ mode, focus, onClearFocus, onRegionAsk, metric = "max", onStats, amount }) {
  const is3d = mode !== "2d";
  const [maxByS, setMaxByS] = useState({});
  const [avgByS, setAvgByS] = useState({});
  const [miniByS, setMiniByS] = useState({});
  const [live, setLive] = useState(false);
  const [sel, setSel] = useState(null);       // 선택한 시도
  const [detail, setDetail] = useState(null); // 시군구 목록
  const [pos, setPos] = useState({ coordinates: [127.8, 35.5], zoom: 1 });
  const [tip, setTip] = useState(null); // 지도 hover 툴팁

  // 시도별 값
  useEffect(() => {
    compareSubsidy(MODEL, { limit: 5000 })
      .then((res) => {
        const mx = {}, sum = {}, cnt = {};
        for (const r of res.rows || []) {
          mx[r.시도] = Math.max(mx[r.시도] || 0, r.총액);
          sum[r.시도] = (sum[r.시도] || 0) + r.총액;
          cnt[r.시도] = (cnt[r.시도] || 0) + 1;
        }
        if (Object.keys(mx).length) {
          setMaxByS(mx);
          setAvgByS(Object.fromEntries(Object.keys(sum).map((k) => [k, Math.round(sum[k] / cnt[k])])));
          setLive(true);
        } else {
          const base = Object.fromEntries(PROVINCES.map((p) => [p.name, p.base]));
          setMaxByS(base); setAvgByS(base);
        }
      })
      .catch(() => {
        const base = Object.fromEntries(PROVINCES.map((p) => [p.name, p.base]));
        setMaxByS(base); setAvgByS(base);
      });
    // 경·소형 지도용 (레이 EV 등)
    compareSubsidy("레이", { limit: 5000 })
      .then((res) => {
        const mn = {};
        for (const r of res.rows || []) mn[r.시도] = Math.max(mn[r.시도] || 0, r.총액);
        if (Object.keys(mn).length) setMiniByS(mn);
      })
      .catch(() => {});
  }, []);

  function openSido(sido) {
    if (!sido) return;
    setSel(sido);
    setDetail(null);
    const p = PROVINCES.find((x) => x.name === sido);
    if (p) setPos({ coordinates: [p.lon, p.lat], zoom: 3.2 });
    // 선택 지역 통계를 KPI로 올림 (경·소형은 지역 기준으로 다시 조회해 정확히)
    const baseStats = { region: sido, max: maxByS[sido], avg: avgByS[sido], mini: miniByS[sido] };
    onStats && onStats(baseStats);
    compareSubsidy("레이", { sido, limit: 200 })
      .then((res) => {
        const mx = Math.max(0, ...(res.rows || []).map((r) => r.총액));
        onStats && onStats({ ...baseStats, mini: mx || baseStats.mini });
      })
      .catch(() => {});
    compareSubsidy(MODEL, { sido, limit: 200 })
      .then((res) => {
        const byG = {};
        for (const r of res.rows || []) {
          if (!byG[r.시군구] || r.총액 > byG[r.시군구].총액)
            byG[r.시군구] = { 시군구: r.시군구, 국비: r.국비, 지방비: r.지방비, 총액: r.총액 };
        }
        setDetail(Object.values(byG).sort((a, b) => b.총액 - a.총액));
      })
      .catch(() => setDetail([]));
  }

  function clearSel() {
    setSel(null); setDetail(null);
    setPos({ coordinates: [127.8, 35.5], zoom: 1 });
    onClearFocus && onClearFocus();
    onStats && onStats(null);
  }

  // 챗봇 "부산 보여줘" → focus
  useEffect(() => { if (focus) openSido(focus); /* eslint-disable-next-line */ }, [focus]);

  const values = metric === "avg" ? avgByS
    : metric === "mini" ? (Object.keys(miniByS).length ? miniByS : maxByS)
    : maxByS;
  const vals = Object.values(values);
  const min = Math.min(...vals, 0), max = Math.max(...vals, 1);
  const norm = (v) => (max === min ? 0.5 : (v - min) / (max - min));

  return (
    <div className="map-wrap">
      {tip && tip.v != null && typeof document !== "undefined" && createPortal(
        <div className="map-tip" style={{ left: tip.x, top: tip.y }}>
          {tip.name}<b>{tip.v.toLocaleString()}만원</b>
        </div>, document.body)}
      <div className="zoom-ctl">
        {sel ? <button title="전체 보기" onClick={clearSel}>⤢</button> : null}
      </div>
      {amount && (
        <div className="map-amount" key={`${amount.region}-${amount.label}-${amount.amount}`}>
          <span className="pulse-ring" aria-hidden />
          💰 {amount.region} · {amount.label} 최대
          <b><CountUp value={amount.amount} />만원</b>
        </div>
      )}

      {!sel && Object.keys(values).length > 0 && (
        <div className="map-rank">
          <div className="rank-title">지역 TOP 5</div>
          {Object.entries(values).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, val], i) => (
            <div className="rank-row" key={name}>
              <span className="rank-n">{i + 1}</span>
              <span className="rank-name">{name}</span>
              <div className="rank-bar"><i style={{ width: (max ? (val / max) * 100 : 0) + "%" }} /></div>
              <span className="rank-val">{val}</span>
            </div>
          ))}
        </div>
      )}

      <div className={"map-inner" + (is3d ? " tilt" : "")}>
        <ComposableMap projection="geoMercator"
                       width={700} height={560}
                       projectionConfig={{ center: [127.8, 35.6], scale: 6200 }}
                       style={{ width: "100%", height: "100%" }}>
          <ZoomableGroup center={pos.coordinates} zoom={pos.zoom} onMoveEnd={setPos}
                         minZoom={1} maxZoom={10}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const nm = geo.properties.name || geo.properties.NAME_1 || "";
                  const s = toShort(nm);
                  const v = values[s];
                  const dim = sel && s !== sel;
                  return (
                  <Geography key={geo.rsmKey} geography={geo}
                      onClick={(e) => { ripple(e); openSido(s); onRegionAsk && onRegionAsk(s); }}
                      onMouseMove={(e) => setTip({ name: s, v, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setTip(null)}
                      stroke="#ffffff" strokeWidth={0.7}
                      style={{
                        default: { fill: v != null ? colorFor(norm(v)) : "#eef2f6", outline: "none", opacity: dim ? 0.3 : 1, transition: "opacity .3s, fill .2s" },
                        hover:   { fill: "#0ea5e9", outline: "none", cursor: "pointer", opacity: 1 },
                        pressed: { fill: "#0284c7", outline: "none", opacity: 1 },
                      }} />
                  );
                })
              }
            </Geographies>
            {PROVINCES.map((p) => values[p.name] != null && (!sel || sel === p.name) && (
              <Marker key={p.name} coordinates={[p.lon, p.lat]}>
                <text className="mlabel" textAnchor="middle" y={2}>{p.name} {values[p.name]}</text>
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {sel && (
        <div className="drill">
            <div className="drill-h">
              <span>📍 {sel} · 시군구별 (EV6, 만원)</span>
              <button onClick={clearSel}>✕</button>
            </div>
            <div className="drill-list">
              {detail === null && <div className="muted">불러오는 중…</div>}
              {detail && detail.length === 0 && <div className="muted">데이터 없음</div>}
              {detail && detail.map((d) => (
                <div className="drill-row" key={d.시군구}>
                  <span>{tierOf(d.총액).icon} {d.시군구}</span>
                  <span className="drill-amt">
                    <b>{d.총액.toLocaleString()}</b>
                    <em>국비 {d.국비} · 지방비 {d.지방비}</em>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      <div className="map-legend">
        {sel ? `🔎 ${sel} 집중 · 시군구별 보조금 (⤢ 전체 보기)` :
          `${is3d ? "3D" : "2D"} · ${metric === "mini" ? "경·소형" : metric === "avg" ? "EV6 지역 평균" : "EV6 지역 최고"} 보조금${live ? "" : " (개요)"} · 시도 클릭 → 시군구 상세 · 드래그 회전·휠 확대`}
      </div>
    </div>
  );
}
