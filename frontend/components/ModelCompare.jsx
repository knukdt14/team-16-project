"use client";
import { useEffect, useState } from "react";
import { compareSubsidy, getRegions, getModels } from "@/lib/api";
import { baseModelsFrom } from "@/lib/models";

export default function ModelCompare({ onSelectCar }) {
  const [sidos, setSidos] = useState([]);
  const [sido, setSido] = useState("부산");
  const [available, setAvailable] = useState([]); // [{label, query}]
  const [checked, setChecked] = useState({});
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    getRegions().then((r) => setSidos(r.sido || [])).catch(() => {});
    getModels().then((r) => {
      const list = baseModelsFrom(r);
      setAvailable(list);
      const init = {};
      list.slice(0, 5).forEach((m) => (init[m.label] = true));
      setChecked(init);
    }).catch(() => {});
  }, []);

  const selected = available.filter((a) => checked[a.label]);

  useEffect(() => { if (selected.length) load(); /* eslint-disable-next-line */ },
    [sido, JSON.stringify(checked), available.length]);

  async function load() {
    setLoading(true); setErr(null);
    const out = [];
    for (const { label, query } of selected) {
      try {
        const r = await compareSubsidy(query, { sido, limit: 200 });
        const mx = Math.max(0, ...(r.rows || []).map((x) => x.총액));
        if (mx > 0) out.push({ label, query, 총액: mx });
      } catch (e) { /* skip */ }
    }
    out.sort((a, b) => b.총액 - a.총액);
    setRows(out);
    if (!out.length) setErr("데이터를 불러오지 못했어요. 백엔드(:8000) 확인.");
    setLoading(false);
  }

  const max = Math.max(1, ...rows.map((r) => r.총액));
  const options = sidos.length ? sidos : ["부산", "서울", "대구", "경기"];

  return (
    <div className="card">
      <div className="card-h">
        <span className="t">🚗 차종 비교</span>
        <span className="s">지역 선택 후 비교할 차종 체크 ({available.length}종)</span>
      </div>
      <div style={{ padding: 14 }}>
        <div className="inline-form">
          <select value={sido} onChange={(e) => setSido(e.target.value)}>
            {options.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="muted">지역</span>
        </div>
        <div className="checks scrolly">
          {available.map((a) => (
            <label key={a.label} className={"chk" + (checked[a.label] ? " on" : "")}>
              <input type="checkbox" checked={!!checked[a.label]}
                     onChange={(e) => setChecked((c) => ({ ...c, [a.label]: e.target.checked }))} />
              {a.label}
            </label>
          ))}
        </div>
        {loading && <p className="muted">불러오는 중…</p>}
        {err && <p className="muted">{err}</p>}
        <div className="hbars">
          {rows.map((r) => (
            <div className="hbar hbar-clk" key={r.label}
                 onClick={() => onSelectCar && onSelectCar({ query: r.query, label: r.label, sido })}
                 title="클릭 → 차량 상세">
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
