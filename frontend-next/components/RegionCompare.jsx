"use client";
import { useEffect, useState } from "react";
import { compareSubsidy } from "@/lib/api";

export default function RegionCompare() {
  const [model, setModel] = useState("EV6");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => { load("EV6"); }, []);

  async function load(m) {
    setLoading(true); setErr(null);
    try {
      const r = await compareSubsidy(m, { limit: 15, order: "desc" });
      setRows(r.rows || []);
      if (!(r.rows || []).length) setErr("해당 차종 데이터를 찾지 못했어요.");
    } catch (e) {
      setErr("백엔드에 연결하지 못했거나 차종을 찾지 못했어요.");
      setRows([]);
    } finally { setLoading(false); }
  }

  const max = Math.max(1, ...rows.map((r) => r.총액));

  return (
    <div className="card">
      <div className="card-h">
        <span className="t">📊 지역 비교</span>
        <span className="s">차종별 지역 보조금 순위</span>
      </div>
      <div style={{ padding: 14 }}>
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); load(model); }}>
          <input value={model} onChange={(e) => setModel(e.target.value)}
                 placeholder="차종 (예: EV6, 아이오닉5, 코나)" />
          <button type="submit">조회</button>
        </form>
        {loading && <p className="muted">불러오는 중…</p>}
        {err && <p className="muted">{err}</p>}
        <div className="hbars">
          {rows.map((r) => (
            <div className="hbar" key={r.시도 + r.시군구 + r.모델명}>
              <span className="hbar-l">{r.시도} {r.시군구}</span>
              <div className="hbar-t"><i style={{ width: `${(r.총액 / max) * 100}%` }} /></div>
              <span className="hbar-v">{r.총액.toLocaleString()}만원</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
