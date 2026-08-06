"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const CARS = ["eqa.png", "ioniq5.png", "ev6.png", "model3.png", "gv60.png", "casper.png", "ray.png"];

const FEATS = [
  { icon: "🗺️", t: "지도로 한눈에", d: "시도별 보조금을 색으로. 클릭하면 시군구별 상세까지." },
  { icon: "🤖", t: "AI 챗봇 상담", d: '"부산 EV6 얼마야?" 물어보면 근거와 함께 즉답.' },
  { icon: "📊", t: "차종·지역 비교", d: "관심 차종과 지역을 담아 나란히 비교." },
];

export default function Landing() {
  const [carIdx, setCarIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCarIdx((prev) => (prev + 1) % CARS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="lp">
      <div className="lp-nav">
        <div className="brand">EV <b>SUBSIDY</b></div>
      </div>

      <div className="lp-hero">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}>
          <div className="lp-kick">2026 전기차 구매보조금</div>
          <h1 className="lp-h1">전기차 보조금,<br />지금 내 지역은 얼마?</h1>
          <p className="lp-sub">
            지역과 차종만 고르면 국비 + 지방비 실수령 보조금을 즉시 확인.<br />
            지도·AI 챗봇·비교까지 한 곳에서.
          </p>
          <div className="lp-actions">
            <Link href="/dashboard" className="lp-cta">보조금 조회 시작 →</Link>
          </div>
        </motion.div>
        <motion.div className="lp-visual" initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.15 }}>
          <div className="lp-car" style={{ position: "relative", width: "360px", height: "220px", margin: "0 auto 10px" }}>
            <AnimatePresence mode="wait">
              <motion.img
                key={CARS[carIdx]}
                src={`/car_img/${CARS[carIdx]}`}
                alt="EV"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
                style={{ width: "360px", height: "220px", objectFit: "contain", position: "absolute", top: 0, left: 0 }}
              />
            </AnimatePresence>
          </div>
          <span>EV LINEUP</span>
        </motion.div>
      </div>

      <div className="lp-feats">
        {FEATS.map((f, i) => (
          <motion.div key={f.t} className="lp-feat"
            initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.4 }}>
            <div className="lp-feat-ic">{f.icon}</div>
            <div className="lp-feat-t">{f.t}</div>
            <div className="lp-feat-d">{f.d}</div>
          </motion.div>
        ))}
      </div>

      <div className="lp-foot">EV SUBSIDY · 2026 지침 기준 · 지역별 실수령 보조금 안내</div>
    </div>
  );
}
