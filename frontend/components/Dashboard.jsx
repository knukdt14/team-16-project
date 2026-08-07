"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import KpiCards from "./KpiCards";
import Chatbot from "./Chatbot";
import RegionCompare from "./RegionCompare";
import ModelCompare from "./ModelCompare";
import CompareCart from "./CompareCart";
import CarDetail from "./CarDetail";
import Tour from "./Tour";
import { getHealth } from "@/lib/api";

const KoreaMap = dynamic(() => import("./KoreaMap"), {
  ssr: false,
  loading: () => (
    <div className="map-skel">
      <div className="skel skel-map" />
      <div className="skel-row">
        <div className="skel skel-pill" /><div className="skel skel-pill" /><div className="skel skel-pill" />
      </div>
      <span className="skel-txt">지도 불러오는 중…</span>
    </div>
  ),
});

const TABS = [
  ["map", "보조금 조회"],
  ["region", "지역 비교"],
  ["model", "차종 비교"],
  ["cart", "관심목록"],
];

export default function Dashboard() {
  const [tab, setTab] = useState("map");
  const [mapMode, setMapMode] = useState("3d");
  const [focus, setFocus] = useState(null);
  const [regionAsk, setRegionAsk] = useState(null);
  const [dark, setDark] = useState(false);
  const [cart, setCart] = useState([]);
  const [metric, setMetric] = useState("max");
  const [regionStats, setRegionStats] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [detailCar, setDetailCar] = useState(null);
  const [mapAmount, setMapAmount] = useState(null);
  const [health, setHealth] = useState(null);

  const addCompare = (s) => setCart((c) =>
    c.some((x) => x.시군구 === s.시군구 && x.모델명 === s.모델명) ? c
      : [...c, { 시군구: s.시군구, 제조사: s.제조사, 모델명: s.모델명, 국비: s.국비, 지방비: s.지방비, 총액: s.총액 }]);

  useEffect(() => { getHealth().then(setHealth).catch(() => setHealth(null)); }, []);
  useEffect(() => {
    if (dark) document.body.classList.add("dark");
    else document.body.classList.remove("dark");
  }, [dark]);
  const online = !!health && health.status !== "error";

  return (
    <div className={"app" + (dark ? " dark" : "")}>
      <div className="loadbar" />
      <motion.div className="topbar"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: "easeOut" }}>
        <Link href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>EV <b>SUBSIDY</b></Link>
        <div className="nav">
          {TABS.map(([k, label]) => (
            <motion.span key={k} className={"navtab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}
              whileTap={{ scale: 0.94 }} style={{ cursor: "pointer" }}>
              {tab === k && (
                <motion.span layoutId="navpill" className="navpill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              )}
              <span className="navtab-label">
                {k === "cart" && cart.length ? `${label} (${cart.length})` : label}
              </span>
            </motion.span>
          ))}
        </div>
        <button className="theme-btn" onClick={() => setDark((d) => !d)}>{dark ? "☀️" : "🌙"}</button>
      </motion.div>

      {/* 히어로 */}
      <div className="hero">
        <div className="hero-kick">2026 전기차 구매보조금</div>
        <h1 className="hero-h">지금 내 지역, 얼마나 <span className="em">받을까?</span></h1>
        <p className="hero-p">지역과 차종을 고르면 국비·지방비를 합친 실수령 보조금을 바로 보여드려요.</p>
      </div>

      <div className="main">
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28, ease: "easeOut" }}>
            {tab === "map" && (
              <div className="card">
                <div className="card-h">
                  <span className="t">지역별 보조금 지도</span>
                  <div className="toggle">
                    <button className={mapMode === "2d" ? "on" : ""} onClick={() => setMapMode("2d")}>2D</button>
                    <button className={mapMode === "3d" ? "on" : ""} onClick={() => setMapMode("3d")}>3D</button>
                  </div>
                </div>
                <div className="map-stage">
                  <KoreaMap mode={mapMode} focus={focus}
                    onClearFocus={() => { setFocus(null); setMapAmount(null); }}
                    onRegionAsk={(s) => { setRegionAsk({ sido: s, ts: Date.now() }); setChatOpen(true); }}
                    metric={metric} onStats={setRegionStats} amount={mapAmount} />
                </div>
              </div>
            )}
            {tab === "region" && <RegionCompare />}
            {tab === "model" && <ModelCompare onSelectCar={setDetailCar} />}
            {tab === "cart" && (
              <CompareCart items={cart}
                onRemove={(i) => setCart((c) => c.filter((_, idx) => idx !== i))}
                onClear={() => setCart([])} />
            )}
          </motion.div>
        </AnimatePresence>
        {tab === "map" && <KpiCards metric={metric} onMetric={setMetric} stats={regionStats} />}
      </div>

      <div className="foot">
        <span className={online ? "ok" : "off"}>{online ? "● FastAPI 연결됨" : "○ FastAPI 미연결"}</span>
        <span className={health?.llm_loaded ? "ok" : "off"}>{health?.llm_loaded ? "● RAG·LLM 준비됨" : "○ LLM 로딩/미연결"}</span>
        <span>EV SUBSIDY · 2026 지침 기준</span>
      </div>

      {/* 플로팅 챗봇 (현대처럼 눌러서 열기) */}
      <button className="chat-fab" onClick={() => setChatOpen((o) => !o)}
        title="보조금 상담 챗봇">{chatOpen ? "✕" : "💬"}</button>
      <Chatbot open={chatOpen} onClose={() => setChatOpen(false)}
        onMapMode={(m) => { setMapMode(m); setTab("map"); }}
        mapMode={mapMode}
        onFocus={(r) => { setFocus(r); setTab("map"); }}
        regionAsk={regionAsk}
        onAddCompare={addCompare}
        onAmount={setMapAmount} />

      <CarDetail sel={detailCar} onClose={() => setDetailCar(null)} onAdd={addCompare} />
      <Tour />
    </div>
  );
}
