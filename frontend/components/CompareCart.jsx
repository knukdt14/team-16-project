"use client";
import { tierOf } from "@/lib/tier";
import { getCarImage } from "@/lib/carImages";

// 제조사/모델 → 차량 정보 링크 (사진은 API 키가 필요해 링크로 대체)
function carLink(제조사 = "", 모델명 = "") {
  // 정확한 모델명으로 검색 → 첫 결과가 해당 차량의 제조사 페이지
  return "https://www.google.com/search?q=" + encodeURIComponent(`${제조사} ${모델명}`.trim());
}

export default function CompareCart({ items, onRemove, onClear }) {
  if (!items.length) {
    return (
      <div className="card">
        <div className="card-h"><span className="t">❤️ 관심목록</span></div>
        <div className="hint" style={{ padding: 34 }}>
          챗봇에서 차량 보조금을 조회한 뒤 <b>＋ 관심목록 담기</b>를 누르면 여기 모여요.<br />
          여러 대를 나란히 한 번에 비교할 수 있어요.
        </div>
      </div>
    );
  }
  const best = Math.max(...items.map((i) => i.총액));
  return (
    <div className="card">
      <div className="card-h">
        <span className="t">❤️ 관심목록 ({items.length})</span>
        <button className="cart-clear" onClick={onClear}>전체 비우기</button>
      </div>
      <div className="cart-grid">
        {items.map((it, idx) => {
          const t = tierOf(it.총액);
          const isBest = it.총액 === best;
          return (
            <div className={"cart-card" + (isBest ? " best" : "")} key={idx}>
              <button className="cart-x" onClick={() => onRemove(idx)}>✕</button>
              {isBest && <div className="cart-best">최고 보조금 ⭐</div>}
              <div className="cart-model">{it.제조사} {it.모델명}</div>
              {(() => {
                const imgSrc = getCarImage(it.모델명);
                return imgSrc ? (
                  <div style={{ textAlign: "center", margin: "6px 0" }}>
                    <img
                      src={imgSrc}
                      alt={it.모델명}
                      style={{ maxWidth: "100%", maxHeight: 90, objectFit: "contain", borderRadius: 6 }}
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  </div>
                ) : null;
              })()}
              <div className="cart-region">📍 {it.시군구}</div>
              <div className="cart-total">{Number(it.총액).toLocaleString()}<span>만원</span></div>
              <div className={"tier " + t.cls}>{t.icon} {t.label}</div>
              <div className="cart-sub">국비 {it.국비} · 지방비 {it.지방비}</div>
              <a className="cart-link" href={carLink(it.제조사, it.모델명)} target="_blank" rel="noreferrer">
                🔗 차량 정보 보기
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
