"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MAX_PASSENGER, AVG_PASSENGER } from "@/lib/data";

const BASE = [
  { key: "max", label: "최고 보조금", fb: MAX_PASSENGER, pick: (s) => s?.max },
  { key: "avg", label: "지역 평균", fb: AVG_PASSENGER, pick: (s) => s?.avg },
  { key: "mini", label: "경·소형", fb: 637, pick: (s) => s?.mini },
];

function useCountUp(target, dur = 700) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf, start;
    const from = 0;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return n;
}

function Kpi({ i, k, label, value, metric, onMetric }) {
  const n = useCountUp(value);
  const active = metric === k;
  return (
    <motion.div
      className={"kpi kpi-clk" + (active ? " kpi-on" : "")}
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.08, duration: 0.3, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      onClick={() => onMetric(k)}
    >
      <small>{label}</small>
      <div className="v">{n.toLocaleString()}<u>만원</u></div>
      <div className={"tag " + (active ? "up" : "mut")}>{active ? "지도 기준 ●" : "클릭 → 지도"}</div>
    </motion.div>
  );
}

export default function KpiCards({ metric = "max", onMetric = () => {}, stats = null }) {
  return (
    <div className="kpis">
      {BASE.map((c, i) => {
        const raw = c.pick(stats);
        const value = Math.round(Number(raw != null ? raw : c.fb)) || c.fb;
        const label = stats?.region ? `${stats.region} · ${c.label}` : c.label;
        return <Kpi key={c.key} i={i} k={c.key} label={label} value={value}
                    metric={metric} onMetric={onMetric} />;
      })}
    </div>
  );
}
