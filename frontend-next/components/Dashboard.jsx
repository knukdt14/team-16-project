"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import KpiCards from "./KpiCards";

const KoreaMap = dynamic(() => import("./KoreaMap"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 400, display: "grid", placeItems: "center", color: "var(--muted)" }}>
      지도 불러오는 중…
    </div>
  ),
});
import Chatbot from "./Chatbot";
import RegionCompare from "./RegionCompare";
import ModelCompare from "./ModelCompare";
import { getHealth } from "@/lib/api";

const TABS = [
  ["map", "대시보드"],
  ["region", "지역 비교"],
  ["model", "차종 비교"],
];

export default function Dashboard() {
  const [tab, setTab] = useState("map");
  const [mapMode, setMapMode] = useState("3d");
  const [health, setHealth] = useState(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  const online = !!health && health.status !== "error";

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="dot">⚡</span> EV Subsidy <b>AI</b>
        </div>
        <div className="nav">
          {TABS.map(([k, label]) => (
            <span key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}
                  style={{ cursor: "pointer" }}>
              {label}
            </span>
          ))}
        </div>
        <div className="pill">2026 지침 기준</div>
      </div>

      <div className="grid">
        <div>
          {tab === "map" && (
            <motion.div className="card" initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <div className="card-h">
                <span className="t">🗺️ 지역별 보조금 지도</span>
                <div className="toggle">
                  <button className={mapMode === "2d" ? "on" : ""} onClick={() => setMapMode("2d")}>2D</button>
                  <button className={mapMode === "3d" ? "on" : ""} onClick={() => setMapMode("3d")}>3D</button>
                </div>
              </div>
              <div className="map-stage"><KoreaMap mode={mapMode} /></div>
            </motion.div>
          )}
          {tab === "region" && <RegionCompare />}
          {tab === "model" && <ModelCompare />}
          {tab === "map" && <KpiCards />}
        </div>

        <Chatbot
          onMapMode={(m) => { setMapMode(m); setTab("map"); }}
          mapMode={mapMode}
        />
      </div>

      <div className="foot">
        <span className={online ? "ok" : "off"}>
          {online ? "● FastAPI 연결됨" : "○ FastAPI 미연결"}
        </span>
        <span className={health?.llm_loaded ? "ok" : "off"}>
          {health?.llm_loaded ? "● RAG·LLM 준비됨" : "○ LLM 로딩/미연결"}
        </span>
        <span>Next.js</span>
        <span>framer-motion</span>
      </div>
    </div>
  );
}
