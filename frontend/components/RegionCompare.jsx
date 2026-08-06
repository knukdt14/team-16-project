"use client";
import { useEffect, useState } from "react";
import { compareSubsidy, getRegions, getModels } from "@/lib/api";
import { baseModelsFrom } from "@/lib/models";

const DEFAULT_SIDO = ["서울", "부산", "대구", "인천", "경기", "경북"];
const norm = (s) => String(s).replace(/\s/g, "").toLowerCase();

export default function RegionCompare() {
  const [models, setModels] = useState([]);   // 대표차종 [{label, query}]
  const [allModels, setAllModels] = useState([]); // 전체 트림명
  const [model, setModel] = useState("");      // 선택 대표차종
  const [trim, setTrim] = useState("");         // 선택 트림(빈값=전체)
  const [sidos, setSidos] = useState([]);
  const [checked, setChecked] = useState({});
  const [byS, setByS] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    getRegions().then((r) => {
      const list = r.sido || [];
      setSidos(list);
      const init = {};
      list.forEach((s) => { if (DEFAULT_SIDO.includes(s)) init[s] = true; });
      setChecked(init);
    }).catch(() => {});
    getModels().then((r) => {
      setModels(baseModelsFrom(r));
      setAllModels(Object.values(r.models_by_manufacturer || {}).flat());
      const b = baseModelsFrom(r);
      if (b.length) setModel(b[0].query);
    }).catch(() => {});
  }, []);

  // 선택 대표차종의 트림들
  const trims = model ? allModels.filter((m) => norm(m).includes(norm(model))) : [];

  useEffect(() => { setTrim(""); }, [model]);           // 차종 바뀌면 트림 초기화
  useEffect(() => { if (model) load(trim || model); /* eslint-disable-next-line */ }, [model, trim]);

  async function load(q) {
    setLoading(true); setErr(null);
    try {
      const r = await compareSubsidy(q, { limit: 200 });
      const agg = {};
      for (const row of r.rows || []) agg[row.시도] = Math.max(agg[row.시도] || 0, row.총액);
      setByS(agg);
      if (!Object.keys(agg).length) setErr("데이터를 찾지 못했어요.");
    } catch (e) { setErr("백엔드(:8000) 연결을 확인해주세요."); setByS({}); }
    finally { setLoading(false); }
  }

  const allList = sidos.length ? sidos : DEFAULT_SIDO;
  const allOn = allList.length > 0 && allList.every((s) => checked[s]);
  const toggleAll = (v) => { const next = {}; allList.forEach((s) => (next[s] = v)); setChecked(next); };

  const rows = allList
    .filter((s) => checked[s] && byS[s] != null)
    .map((s) => ({ label: s, 총액: byS[s] }))
    .sort((a, b) => b.총액 - a.총액);
  const max = Math.max(1, ...rows.map((r) => r.총액));

  return (
    <div className="card">
      <div className="card-h">
        <span className="t">📊 지역 비교</span>
        <span className="s">차종·트림 선택 후 비교할 지역 체크</span>
      </div>
      <div style={{ padding: 14 }}>
        <div className="inline-form">
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {models.map((m) => <option key={m.label} value={m.query}>{m.label}</option>)}
          </select>
          <select value={trim} onChange={(e) => setTrim(e.target.value)}>
            <option value="">전체 트림(대표)</option>
            {trims.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="checks">
          <label className={"chk chk-all" + (allOn ? " on" : "")}>
            <input type="checkbox" checked={allOn} onChange={(e) => toggleAll(e.target.checked)} />
            전체 {allOn ? "해제" : "선택"}
          </label>
          {allList.map((s) => (
            <label key={s} className={"chk" + (checked[s] ? " on" : "")}>
              <input type="checkbox" checked={!!checked[s]}
                     onChange={(e) => setChecked((c) => ({ ...c, [s]: e.target.checked }))} />
              {s}
            </label>
          ))}
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
