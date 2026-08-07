"use client";
import { useEffect, useState, useCallback } from "react";

const STEPS = [
  { sel: ".map-stage", title: "① 지역별 보조금 지도", text: "시도를 클릭하면 그 안 시군구별 보조금이 떠요. 마우스 드래그로 회전, 휠로 확대돼요." },
  { sel: ".chat-fab", title: "② AI 상담 챗봇", text: '우하단 버튼을 누르면 챗봇이 열려요. "EV6 부산 얼마야?"처럼 물어보고, "부산 보여줘"라고 하면 지도가 그 지역으로 이동해요.' },
  { sel: ".nav", title: "③ 비교 탭", text: "지역 비교·차종 비교로 여러 조건을 한눈에, 비교함에 담아 모아 볼 수도 있어요." },
];

export default function Tour() {
  const [i, setI] = useState(-1);
  const [rect, setRect] = useState(null);

  const measure = useCallback((idx) => {
    const el = document.querySelector(STEPS[idx].sel);
    if (!el) return null;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }, []);

  useEffect(() => {
    try { if (!localStorage.getItem("ev_tour_done")) setTimeout(() => setI(0), 900); } catch (e) {}
  }, []);

  useEffect(() => {
    if (i < 0) return;
    const upd = () => setRect(measure(i));
    const t = setTimeout(upd, 60);
    window.addEventListener("resize", upd);
    return () => { clearTimeout(t); window.removeEventListener("resize", upd); };
  }, [i, measure]);

  function finish() { try { localStorage.setItem("ev_tour_done", "1"); } catch (e) {} setI(-1); }
  function next() { i >= STEPS.length - 1 ? finish() : setI(i + 1); }

  const tipStyle = rect
    ? { top: Math.min(rect.top + rect.height + 14, (typeof window !== "undefined" ? window.innerHeight : 800) - 190),
        left: Math.max(12, Math.min(rect.left, (typeof window !== "undefined" ? window.innerWidth : 1200) - 320)) }
    : { top: 90, left: 40 };

  return (
    <>
      <button className="tour-help" onClick={() => setI(0)} title="사용법 안내">?</button>
      {i >= 0 && (
        <div className="tour-overlay" onClick={finish}>
          {rect && (
            <div className="tour-hole"
                 style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} />
          )}
          <div className="tour-tip" style={tipStyle} onClick={(e) => e.stopPropagation()}>
            <div className="tour-title">{STEPS[i].title}</div>
            <div className="tour-text">{STEPS[i].text}</div>
            <div className="tour-actions">
              <span className="tour-count">{i + 1} / {STEPS.length}</span>
              <div>
                <button className="tour-skip" onClick={finish}>건너뛰기</button>
                <button className="tour-next" onClick={next}>{i >= STEPS.length - 1 ? "완료" : "다음"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
