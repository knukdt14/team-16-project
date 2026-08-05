"use client";
import { motion } from "framer-motion";
import { MAX_PASSENGER, AVG_PASSENGER } from "@/lib/data";

const CARDS = [
  { label: "최고 보조금", value: MAX_PASSENGER, unit: "만원", tag: "부산 ▲", cls: "up" },
  { label: "광역시 평균", value: AVG_PASSENGER, unit: "만원", tag: "승용 기준", cls: "mut" },
  { label: "경·소형", value: 637, unit: "만원", tag: "전 지역 동일", cls: "mut" },
];

export default function KpiCards() {
  return (
    <div className="kpis">
      {CARDS.map((c, i) => (
        <motion.div
          className="kpi"
          key={c.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.3 }}
        >
          <small>{c.label}</small>
          <div className="v">
            {c.value.toLocaleString()}<u>{c.unit}</u>
          </div>
          <div className={"tag " + c.cls}>{c.tag}</div>
        </motion.div>
      ))}
    </div>
  );
}
