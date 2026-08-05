"use client";
import { useEffect, useState } from "react";
import { compareSubsidy, getRegions, getModels } from "@/lib/api";

// 화면에 보여줄 대표 차종(짧은 라벨) — 실제 모델명은 백엔드 목록에서 매칭
const KEYWORDS = ["EV6", "아이오닉5", "아이오닉6", "코나", "니로", "캐스퍼", "EV3", "EV9", "토레스"];

export default function ModelCompare() {
  const [sidos, setSidos] = useState([]);
  const [sido, setSido] = useState("부산");
  const [pairs, setPairs] = useState([]); // [{label, model}]
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // 지역 목록 + 실제 모델 매칭 준비
  useEffect(() => {
    getRegions().then((r) => setSidos(r.sido || [])).catch(() => {});
    getModels()
      .then((r) => {
        const all = Object.values(r.models_by_manufacturer || {}).flat();
        const found = [];
        for (const kw of KEYWORDS) {
          const hit = all.find((m) => m.replace(/\s/g, "").includes(kw.replace(/\s/g, "")));
          if (hit) found.push({ label: kw, model: hit });
        }
        setPairs(found);
      })
      .catch(() => setPairs(KEYWORDS.map((k) => ({ label: k, model: k }))));
  }, []);

  useEffect(() => { if (pairs.length) load(sido); }, [sido, pairs]);

  async function load(s) {
    setLoading(true); setErr(null);
    const out = [];
    for (const { label, model } of pairs) {
      try {
        const r = await compareSubsidy(model, { sido: s, limit: 200 });
        const mx = Math.max(0, ...(r.rows || []).map((x) => x.총액));
        if (mx > 0) out.push({ label, 총액: mx });
      } catch (e) { /* 해당 지역/차종 없음 → 스킵 */ }
    }
    out.sort((a, b) => b.총액 - a.총액);
    setRows(out);
    if (!out.length) setErr("데이터를 불러오지 못했어요. 백엔드(:8000)가 켜져 있는지 확인해주세요.");
    setLoading(false);
  }

  const max = Math.max(1, ...rows.map((r) => r.총액));
  const options = sidos.length ? sidos : ["부산", "서울", "대구", "경기"];

  return (
    <div className="card">
      <div className="card-h">
        <span className="t">🚗 차종 비교</span>
        <span className="s">지역 내 차종별 최고 보조금</span>
      </div>
      <div style={{ padding: 14 }}>
        <div className="inline-form">
          <select value={sido} onChange={(e) => setSido(e.target.value)}>
            {options.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="muted">지역 선택 · {pairs.length}개 차종 비교</span>
        </div>
        {loading && <p className="muted">불러오는 중…</p>}
        {err && <p className="muted">{err}</p>}
        <div className="hbars">
          {rows.map((r) => (
            <div className="hbar" key={r.label}>
              <span className="hbar-l">{r.label}</span>
              <div className="hbar-t"><i style={{ width: `${(r.총액 / max) * 100}%` }} /></div>
              <span className="hbar-v">{r.총액.toLocaleString()}만원</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
