"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { classify } from "@/lib/chat";
import { askChat, getHealth } from "@/lib/api";

const bold = (t) =>
  String(t).split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p
  );

function SubsidyCard({ s }) {
  const conv = (s.전환지원금국비 || 0) + (s.전환지원금지방비 || 0);
  return (
    <div className="rcard">
      <div className="rcard-h">{s.시군구} · {s.제조사} {s.모델명}</div>
      <div className="rcard-big">{Number(s.총액).toLocaleString()} <span>만원</span></div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        국비 {s.국비}만원 · 지방비 {s.지방비}만원
        {conv > 0 && <> · 전환지원금 {conv}만원</>}
      </div>
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

function Bot({ m, onPick }) {
  return (
    <>
      {m.answer && <div>{bold(m.answer)}</div>}
      {m.subsidy && <SubsidyCard s={m.subsidy} />}
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
  "전환지원금 조건 알려줘",
  "지도 3D로 보여줘",
];

export default function Chatbot({ onMapMode, mapMode }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(null);
  const ctx = useRef({ region: null, model: null, lastQ: "" }); // 대화 맥락
  const bodyRef = useRef(null);

  useEffect(() => {
    getHealth()
      .then((h) => setOnline(h.status === "ok" || h.status === "loading"))
      .catch(() => setOnline(false));
  }, []);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [messages, loading]);

  async function callBackend(question, region, model, displayText) {
    setMessages((m) => [...m, { role: "user", text: displayText ?? question }]);
    setLoading(true);
    try {
      const data = await askChat({ question, region, model });
      if (data.entities?.region) ctx.current.region = data.entities.region;
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
    const local = classify(q);
    if (local.kind === "map") {
      const mode = local.arg || (mapMode === "3d" ? "2d" : "3d");
      onMapMode(mode);
      setMessages((m) => [
        ...m,
        { role: "user", text: q },
        { role: "bot", answer: `지도를 **${mode.toUpperCase()}** 모드로 전환했어요.` },
      ]);
      return;
    }
    ctx.current = { region: null, model: null, lastQ: q };
    callBackend(q, null, null);
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
    <div className="card chat">
      <div className="card-h">
        <span className="t">🤖 보조금 상담 챗봇</span>
        <span className="s" style={{ color: online === false ? "#ef4444" : "var(--accent)" }}>
          ● {online === false ? "offline" : online === null ? "연결 확인 중" : "online"}
        </span>
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
              {m.role === "user" ? m.text : <Bot m={m} onPick={pickNeed} />}
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && <div className="msg bot" style={{ color: "var(--muted)" }}>답변 생성 중… (규정 질문은 CPU LLM이라 느릴 수 있어요)</div>}
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
  );
}
