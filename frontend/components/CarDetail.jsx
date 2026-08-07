"use client";
import { useEffect, useState } from "react";
import { compareSubsidy } from "@/lib/api";
import { tierOf } from "@/lib/tier";
import { getCarImage } from "@/lib/carImages";

function carLink(제조사 = "", 모델명 = "") {
  // 정확한 모델명으로 검색 → 첫 결과가 해당 차량의 제조사 페이지
  return "https://www.google.com/search?q=" + encodeURIComponent(`${제조사} ${모델명}`.trim());
}

export default function CarDetail({ sel, onClose, onAdd }) {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sel) return;
    setLoading(true); setRow(null);
    compareSubsidy(sel.query, { sido: sel.sido, limit: 200 })
      .then((res) => {
        const rows = (res.rows || []).slice().sort((a, b) => b.총액 - a.총액);
        setRow(rows[0] || null);
      })
      .catch(() => setRow(null))
      .finally(() => setLoading(false));
  }, [sel]);

  if (!sel) return null;
  const t = row ? tierOf(row.총액) : null;

  return (
    <div className="cd-overlay" onClick={onClose}>
      <div className="cd" onClick={(e) => e.stopPropagation()}>
        <button className="cd-x" onClick={onClose}>✕</button>
        <div className="cd-img">
          {(() => {
            const imgSrc = getCarImage(sel.label) || (row ? getCarImage(row.모델명) : null);
            return imgSrc
              ? <img src={imgSrc} alt={sel.label} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} onError={(e) => { e.target.replaceWith(document.createTextNode("🚗")); }} />
              : <span style={{ fontSize: 64 }}>🚗</span>;
          })()}
        </div>
        <div className="cd-body">
          <div className="cd-model">{sel.label}</div>
          {loading && <p className="muted">불러오는 중…</p>}
          {!loading && !row && <p className="muted">{sel.sido}에서 해당 차종 데이터를 찾지 못했어요.</p>}
          {row && (
            <>
              <div className="cd-region">📍 {row.시군구} · {row.모델명}</div>
              <div className="cd-total">
                {row.총액.toLocaleString()}<span>만원</span>
                {t && <span className={"tier " + t.cls}>{t.icon} {t.label}</span>}
              </div>
              <div className="cd-sub">국비 {row.국비}만원 · 지방비 {row.지방비}만원</div>
              <div className="cd-actions">
                <button className="cd-add" onClick={() => { onAdd && onAdd(row); onClose(); }}>＋ 관심목록 담기</button>
                <a className="cd-link" href={carLink("", row.모델명)} target="_blank" rel="noreferrer">차량 정보 보기 →</a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
