"use client";
import { useEffect, useState } from "react";
import { compareSubsidy, getModels } from "@/lib/api";

export default function RegionCompare({ initialModel = "EV6" }) {
  const [model, setModel] = useState(initialModel);
  const [rows, setRows] = useState([]);
  const [matchedModels, setMatchedModels] = useState([]);
  const [allModels, setAllModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    load(initialModel || "EV6");
    getModels()
      .then((data) => {
        const list = [];
        for (const [mfr, mlist] of Object.entries(data.models_by_manufacturer || {})) {
          for (const m of mlist) list.push(m);
        }
        setAllModels(list);
      })
      .catch(() => {});
  }, [initialModel]);

  async function load(m) {
    if (!m || !m.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await compareSubsidy(m, { limit: 30, order: "desc" });
      setRows(r.rows || []);
      setMatchedModels(r.matched_models || []);
      if (!(r.rows || []).length) {
        setErr(`'${m}' 에 해당하는 보조금 데이터를 찾지 못했어요.`);
      }
    } catch (e) {
      setErr("백엔드에 연결하지 못했거나 차종을 찾지 못했어요.");
      setRows([]);
      setMatchedModels([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectTrim(trimName) {
    setModel(trimName);
    load(trimName);
  }

  const max = Math.max(1, ...rows.map((r) => r.총액));

  // 입력된 키워드에 부합하는 모든 모델 자동완성 후보
  const suggestions = model.trim().length >= 1
    ? allModels.filter((m) => m.toLowerCase().includes(model.toLowerCase())).slice(0, 10)
    : [];

  return (
    <div className="card">
      <div className="card-h">
        <span className="t">📊 지역 비교</span>
        <span className="s">차종별 전국 지자체 보조금 순위</span>
      </div>
      <div style={{ padding: 14 }}>
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); load(model); }}>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="차종 (예: EV6, 아이오닉, 코나, 테슬라)"
          />
          <button type="submit">조회</button>
        </form>

        {/* 1) 검색어와 부분일치하는 전체 DB 차량 후보 자동추천 */}
        {suggestions.length > 0 && model !== suggestions[0] && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>💡 연관 차량 키워드:</div>
            <div className="chips">
              {suggestions.map((s) => (
                <button
                  key={s}
                  style={{ fontSize: 12, padding: "3px 8px" }}
                  onClick={() => handleSelectTrim(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2) 조회 결과 여러 차량/트림이 포함된 경우 선택 가능한 리스트 표시 */}
        {matchedModels.length > 1 && (
          <div style={{ marginTop: 12, padding: 10, background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--accent)", marginBottom: 6 }}>
              🚗 세부 트림 선택 ({matchedModels.length}개 검색됨)
            </div>
            <div className="chips">
              {matchedModels.map((mName) => (
                <button
                  key={mName}
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderColor: model === mName ? "var(--accent)" : undefined,
                    background: model === mName ? "rgba(52,211,153,0.15)" : undefined,
                  }}
                  onClick={() => handleSelectTrim(mName)}
                >
                  {mName}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && <p className="muted" style={{ marginTop: 12 }}>데이터 불러오는 중…</p>}
        {err && <p className="muted" style={{ marginTop: 12 }}>{err}</p>}

        <div className="hbars" style={{ marginTop: 14 }}>
          {rows.map((r, i) => (
            <div className="hbar" key={r.시도 + r.시군구 + r.모델명 + i}>
              <span className="hbar-l" title={r.모델명}>{r.시도} {r.시군구} <small style={{ opacity: 0.6 }}>({r.모델명})</small></span>
              <div className="hbar-t"><i style={{ width: `${(r.총액 / max) * 100}%` }} /></div>
              <span className="hbar-v">{r.총액.toLocaleString()}만원</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
