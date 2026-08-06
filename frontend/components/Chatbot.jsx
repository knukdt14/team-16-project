"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { askChat, getHealth, compareSubsidy, getModels } from "@/lib/api";
import { PROVINCES } from "@/lib/korea";
import { baseModelsFrom } from "@/lib/models";
import { tierOf } from "@/lib/tier";
import { getCarImage } from "@/lib/carImages";

// 줄바굀()을 <br>(또는 파라그래프)로 변환하고, **bold** 마크업을 <b>로 적용
function renderAnswer(text) {
  return String(text)
    .split(/\n/)
    .map((line, i, arr) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
        p.startsWith("**") ? <b key={j}>{p.slice(2, -2)}</b> : p
      );
      return (
        <span key={i}>
          {parts}
          {i < arr.length - 1 && <br />}
        </span>
      );
    });
}

// 스트리밍(타이핑) 효과 + 줄바굀 렌더링
function Typing({ text }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    let raf, start;
    const total = String(text).length;
    const dur = Math.min(2000, 180 + total * 20);
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(total * p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text]);
  return <span>{renderAnswer(String(text).slice(0, n))}</span>;
}

function TierBadge({ total }) {
  const t = tierOf(total);
  return <span className={"tier " + t.cls} title={`보조금 ${Number(total).toLocaleString()}만원`}>{t.icon} {t.label}</span>;
}

function SubsidyCard({ s, onAdd }) {
  const conv = (s.전환지원금국비 || 0) + (s.전환지원금지방비 || 0);
  const imgSrc = getCarImage(s.모델명);
  return (
    <div className="rcard">
      <div className="rcard-h">{s.시군구} · {s.제조사} {s.모델명}</div>
      {imgSrc && (
        <div style={{ textAlign: "center", margin: "8px 0 4px" }}>
          <img
            src={imgSrc}
            alt={s.모델명}
            style={{ maxWidth: "100%", maxHeight: 120, objectFit: "contain", borderRadius: 8 }}
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </div>
      )}
      <div className="rcard-big">
        {Number(s.총액).toLocaleString()} <span>만원</span> <TierBadge total={s.총액} />
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        국비 {s.국비}만원 · 지방비 {s.지방비}만원
        {conv > 0 && <> · 전환지원금 {conv}만원</>}
      </div>
      {onAdd && <button className="add-cart" onClick={() => onAdd(s)}>＋ 관심목록 담기</button>}
    </div>
  );
}

// need_info 선택지: 각 항목이 '지역'인지 '차종(트림)'인지 구분해서 전달
function NeedChoices({ need, onPick }) {
  if (!need) return null;
  const regionOpts = [].concat(need.sigungu_list || [], need.candidates_region || []);
  const modelOpts = []
    .concat((need.trims || []).map((t) => t.모델명 || t.name || ""))
    .concat(need.candidates_model || []);
  const all = [
    ...regionOpts.map((v) => [v, "region"]),
    ...modelOpts.map((v) => [v, "model"]),
  ].filter(([v]) => v);
  if (!all.length) return null;
  return (
    <div className="chips" style={{ padding: "8px 0 0" }}>
      {all.slice(0, 8).map(([v, t]) => (
        <button key={t + v} onClick={() => onPick(v, t)}>{v}</button>
      ))}
    </div>
  );
}

function Bot({ m, onPick, onAdd }) {
  return (
    <>
      {m.answer && <div><Typing text={m.answer} /></div>}
      {m.subsidy && <SubsidyCard s={m.subsidy} onAdd={onAdd} />}
      {m.status === "need_info" && <NeedChoices need={m.need} onPick={onPick} />}
      {m.sources?.length > 0 && (
        <div className="src">
          근거: {m.sources.map((x) => `${x.section} (p.${x.page})`).join(" · ")}
        </div>
      )}
      {m._offline && <div className="src">⚠︎ 백엔드 미연결 — 데모 응답</div>}
    </>
  );
}

const CHIPS = [
  "EV6 부산 보조금 얼마야?",
  "청년이 첫 차로 사면 얼마나 더 받아?",
  "부산 지도에서 보여줘",
  "지도 3D로 보여줘",
];

export default function Chatbot({ onMapMode, mapMode, onFocus, regionAsk, onAddCompare, open, onClose, onAmount }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(null);
  const [models, setModels] = useState([]); // 대표차종 [{label, query}]
  const ctx = useRef({ region: null, model: null, lastQ: "" }); // 대화 맥락
  const bodyRef = useRef(null);

  useEffect(() => {
    getModels().then((r) => setModels(baseModelsFrom(r))).catch(() => { });
  }, []);

  useEffect(() => {
    getHealth()
      .then((h) => setOnline(h.status === "ok" || h.status === "loading"))
      .catch(() => setOnline(false));
  }, []);

  // 지도에서 지역 클릭 → 챗봇이 차종을 되물음
  useEffect(() => {
    if (regionAsk?.sido) {
      ctx.current.region = regionAsk.sido;
      setMessages((m) => [
        ...m,
        { role: "bot", answer: `**${regionAsk.sido}** 지역의 어떤 차종 지원금이 궁금하신가요? (예: EV6, 아이오닉5, 코나)` },
      ]);
    }
  }, [regionAsk]);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [messages, loading]);

  async function callBackend(question, region, model, displayText) {
    setMessages((m) => [...m, { role: "user", text: displayText ?? question }]);
    setLoading(true);
    try {
      const data = await askChat({ question, region, model });
      if (data.entities?.region) ctx.current.region = data.entities.region;
      // 트림 확정되어 금액이 나오면 지도에 숫자로
      if (data.subsidy) onAmount?.({ region: data.subsidy.시도, label: data.subsidy.모델명, amount: data.subsidy.총액 });
      setMessages((m) => [...m, { role: "bot", ...data }]);
      setOnline(true);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "bot", answer: "백엔드에 연결하지 못했어요. 백엔드(:8000)가 켜져 있는지 확인해주세요.", _offline: true },
      ]);
      setOnline(false);
    } finally { setLoading(false); }
  }

  // 새 질문 (입력창/추천칩): 맥락 초기화
  function send(q) {
    if (!q.trim() || loading) return;
    setText("");
    const s = q.replace(/\s/g, "").toLowerCase();
    // 1) 명시적 2D/3D 전환만 모드 변경
    const modeCmd = /(3d|입체|기울|쓰리디)/.test(s) ? "3d"
      : /(2d|평면|납작|위에서)/.test(s) ? "2d" : null;
    if (modeCmd) {
      onMapMode(modeCmd);
      setMessages((m) => [...m,
      { role: "user", text: q },
      { role: "bot", answer: `지도를 **${modeCmd.toUpperCase()}** 모드로 전환했어요.` }]);
      return;
    }
    // 2) "부산 보여줘 / 부산 지도에서 보여줘" → 해당 지역 확대·강조 (우선)
    const fp = PROVINCES.find((p) => q.includes(p.name));
    if (fp && /(보여|지도|위치|어디|확대|강조)/.test(q) && !/(얼마|가격)/.test(q)) {
      onFocus?.(fp.name);
      setMessages((m) => [...m,
      { role: "user", text: q },
      { role: "bot", answer: `지도에서 **${fp.name}**을(를) 확대해서 보여드릴게요.` }]);
      return;
    }
    // 2.5) "대구 코나 지원금 얼마야" → 지도 확대 + 그 지역·차종 최대 지원금
    const money = /(얼마|지원금|보조금|가격|받)/.test(q);
    if (fp && money) {
      onFocus?.(fp.name);                    // 지도 그 지역으로 확대 + 시군구 목록 쫘악
      // 차종이 확정되면 그 지역·차종 최대 지원금을 '지도'에 숫자로
      const nq = q.replace(/\s/g, "").toLowerCase();
      const mdl = models.find((m) => {
        const core = m.query.replace(/\s/g, "").toLowerCase();
        const first = (m.query.split(/\s+/)[0] || "").toLowerCase();
        return nq.includes(core) || (first.length >= 2 && nq.includes(first));
      });
      if (mdl) {
        compareSubsidy(mdl.query, { sido: fp.name, limit: 200 })
          .then((res) => {
            const mx = Math.max(0, ...(res.rows || []).map((r) => r.총액));
            if (mx > 0) onAmount?.({ region: fp.name, label: mdl.label, amount: mx });
          })
          .catch(() => { });
      }
      ctx.current = { region: fp.name, model: mdl ? mdl.query : null, lastQ: q };
      callBackend(q, fp.name, null);         // 챗봇은 백엔드 응답(트림 목록 등) 그대로
      return;
    }
    // 3) 지역 없이 "지도"만 언급 → 모드 토글
    if (q.includes("지도")) {
      const mode = mapMode === "3d" ? "2d" : "3d";
      onMapMode(mode);
      setMessages((m) => [...m,
      { role: "user", text: q },
      { role: "bot", answer: `지도를 **${mode.toUpperCase()}** 모드로 전환했어요.` }]);
      return;
    }
    const reg = fp ? fp.name : ctx.current.region;
    ctx.current = { region: reg, model: ctx.current.model, lastQ: q };
    callBackend(q, reg, ctx.current.model);
  }

  // 되묻기 선택: 이전 질문 + 누적 힌트(지역/차종)로 다시 질의
  function pickNeed(value, type) {
    if (loading) return;
    if (type === "region") ctx.current.region = value;
    else ctx.current.model = value;
    // 이전 질문의 모호한 키워드(EV6 등)를 빼고, 확정된 지역·차종으로 새 질의를 만든다
    const parts = [ctx.current.region, ctx.current.model].filter(Boolean);
    const q = parts.join(" ") || value;
    callBackend(q, ctx.current.region, ctx.current.model, value);
  }

  return (
    <div className={"chat-dock" + (open ? " open" : "")}>
      <div className="card chat">
        <div className="card-h">
          <span className="t">🤖 보조금 상담 챗봇</span>
          <span className="s" style={{ color: online === false ? "#ef4444" : "var(--accent)" }}>
            ● {online === false ? "offline" : online === null ? "연결 확인 중" : "online"}
          </span>
          <button className="chat-close" onClick={onClose}>✕</button>
        </div>

        <div className="chat-body" ref={bodyRef}>
          {messages.length === 0 && (
            <div className="hint">
              👋 아래 추천 질문을 누르거나 직접 물어보세요.<br />
              지역·차종을 함께 말하면 실제 금액을, 지침 질문은 근거와 함께 답해요.
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }} className={"msg " + m.role}>
                {m.role === "user" ? m.text : <Bot m={m} onPick={pickNeed} onAdd={onAddCompare} />}
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && <div className="msg bot" style={{ color: "var(--muted)" }}>💬 답변을 생성하고 있습니다…</div>}
        </div>

        <div className="chips">
          {CHIPS.map((c) => <button key={c} onClick={() => send(c)}>{c}</button>)}
        </div>

        <form className="inputbar" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input value={text} onChange={(e) => setText(e.target.value)}
            placeholder="전기차 보조금에 대해 물어보세요…" />
          <button type="submit">전송</button>
        </form>
      </div>
    </div>
  );
}
