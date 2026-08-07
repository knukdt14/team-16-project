"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";

const FEATS = [
  { ic: "🗺️", t: "지도로 한눈에", d: "시도별 보조금을 색으로. 클릭하면 시군구별 상세까지." },
  { ic: "🤖", t: "AI 챗봇 상담", d: "\"부산 EV6 얼마야?\" 물어보면 근거와 함께 즉답." },
  { ic: "📊", t: "차종·지역 비교", d: "관심 차종과 지역을 담아 나란히 비교." },
];

const STATS = [
  { to: 976, suf: "만원", k: "최대 보조금" },
  { to: 121, suf: "종", k: "지원 차종" },
  { to: 159, suf: "곳", k: "시·군·구" },
];

export default function Landing() {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const cv = canvasRef.current;
    const ctx = cv.getContext("2d");
    let w, h, pts, raf;

    function init() {
      w = cv.width = window.innerWidth;
      h = cv.height = window.innerHeight;
      pts = Array.from({ length: Math.min(70, Math.floor(w / 22)) }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 2.4 + 0.6,
        vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
        a: Math.random() * 0.4 + 0.15,
      }));
    }
    function tick() {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28);
        ctx.fillStyle = "rgba(16,185,129," + p.a + ")"; ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    }
    init(); tick();
    const onResize = () => init();
    window.addEventListener("resize", onResize);

    // 마우스 패럴랙스 + 글로우
    const blobs = root.querySelectorAll(".lp2-blob");
    const chips = root.querySelectorAll(".lp2-chip");
    const glow = root.querySelector(".lp2-glow");
    const onMove = (e) => {
      const dx = e.clientX / window.innerWidth - 0.5;
      const dy = e.clientY / window.innerHeight - 0.5;
      blobs.forEach((b, i) => { b.style.marginLeft = dx * (20 + i * 12) + "px"; b.style.marginTop = dy * (20 + i * 12) + "px"; });
      chips.forEach((c, i) => { c.style.transform = `translate(${dx * (-30 - i * 10)}px,${dy * (-30 - i * 10)}px)`; });
      if (glow) { glow.style.left = e.clientX + "px"; glow.style.top = e.clientY + "px"; }
    };
    window.addEventListener("mousemove", onMove);

    // 자석 버튼
    const mag = root.querySelector(".lp2-magnet");
    const onMag = (e) => {
      const r = mag.getBoundingClientRect();
      mag.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.4}px,${(e.clientY - r.top - r.height / 2) * 0.5 - 3}px)`;
    };
    const onMagLeave = () => { mag.style.transform = ""; };
    if (mag) { mag.addEventListener("mousemove", onMag); mag.addEventListener("mouseleave", onMagLeave); }

    // 숫자 카운트업
    const nums = root.querySelectorAll(".lp2-n");
    const timers = [];
    nums.forEach((el) => {
      const to = +el.dataset.to, suf = el.dataset.suf || ""; let s = null;
      const step = (t) => {
        if (!s) s = t;
        const p = Math.min((t - s) / 1100, 1);
        el.textContent = Math.floor(p * to).toLocaleString() + suf;
        if (p < 1) requestAnimationFrame(step);
      };
      timers.push(setTimeout(() => requestAnimationFrame(step), 900));
    });

    // ⚡ 클릭 → 초록 색종이
    const bolt = root.querySelector(".lp2-c4");
    const onBolt = () => {
      const r = bolt.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const cols = ["#10b981", "#34d399", "#059669", "#6ee7b7", "#a7f3d0"];
      for (let i = 0; i < 28; i++) {
        const d = document.createElement("div");
        d.style.cssText = `position:fixed;z-index:99;left:${cx}px;top:${cy}px;width:9px;height:9px;border-radius:2px;background:${cols[i % cols.length]};pointer-events:none`;
        document.body.appendChild(d);
        const ang = Math.random() * 6.28, sp = Math.random() * 140 + 60;
        const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp - 40;
        d.animate(
          [{ transform: "translate(0,0) rotate(0)", opacity: 1 },
           { transform: `translate(${vx}px,${vy + 160}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }],
          { duration: 900 + Math.random() * 500, easing: "cubic-bezier(.2,.7,.3,1)" }
        ).onfinish = () => d.remove();
      }
    };
    if (bolt) bolt.addEventListener("click", onBolt);

    // 스크롤 등장
    const io = new IntersectionObserver((es) => {
      es.forEach((en) => { if (en.isIntersecting) en.target.classList.add("in"); });
    }, { threshold: 0.2 });
    root.querySelectorAll(".lp2-reveal").forEach((el) => io.observe(el));

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMove);
      if (mag) { mag.removeEventListener("mousemove", onMag); mag.removeEventListener("mouseleave", onMagLeave); }
      if (bolt) bolt.removeEventListener("click", onBolt);
      timers.forEach(clearTimeout);
      io.disconnect();
    };
  }, []);

  return (
    <div className="lp2" ref={rootRef}>
      <style jsx global>{`
        .lp2{position:relative;min-height:100vh;background:#fff;color:#0b1f17;overflow-x:hidden;
          font-family:"Pretendard","Apple SD Gothic Neo",system-ui,-apple-system,sans-serif}
        .lp2-bg{position:fixed;inset:0;z-index:0;overflow:hidden;background:#fff}
        .lp2-blob{position:absolute;border-radius:50%;filter:blur(70px);opacity:.55;mix-blend-mode:multiply;transition:margin .3s ease-out}
        .lp2-blob.b1{width:52vw;height:52vw;background:radial-gradient(circle at 30% 30%,#34d399,#10b981);top:-14vw;left:-10vw;animation:lp2d1 18s ease-in-out infinite}
        .lp2-blob.b2{width:46vw;height:46vw;background:radial-gradient(circle at 70% 40%,#a7f3d0,#059669);bottom:-16vw;right:-8vw;animation:lp2d2 22s ease-in-out infinite}
        .lp2-blob.b3{width:34vw;height:34vw;background:radial-gradient(circle at 50% 50%,#6ee7b7,#10b981);top:35%;left:45%;animation:lp2d3 26s ease-in-out infinite}
        @keyframes lp2d1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(8vw,6vh) scale(1.15)}}
        @keyframes lp2d2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-7vw,-5vh) scale(1.1)}}
        @keyframes lp2d3{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-6vw,4vh) scale(1.2)}66%{transform:translate(5vw,-6vh) scale(.9)}}
        .lp2-dots{position:fixed;inset:0;z-index:1;pointer-events:none}
        .lp2-glow{position:fixed;width:340px;height:340px;border-radius:50%;z-index:2;pointer-events:none;left:-999px;
          background:radial-gradient(circle,rgba(16,185,129,.18),transparent 60%);transform:translate(-50%,-50%)}

        .lp2-nav{position:relative;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:26px 6vw}
        .lp2-brand{font-weight:800;letter-spacing:-.5px;font-size:20px}
        .lp2-brand b{color:#059669}
        .lp2-navcta{background:#0b1f17;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:700}

        .lp2-hero{position:relative;z-index:5;min-height:calc(100vh - 92px);display:flex;flex-direction:column;
          justify-content:center;padding:0 6vw;max-width:1100px}
        .lp2-kick{align-self:flex-start;font-weight:700;font-size:13px;letter-spacing:1px;color:#059669;
          background:rgba(16,185,129,.12);padding:8px 16px;border-radius:999px;opacity:0;animation:lp2rise .8s .1s forwards}
        .lp2-h1{font-size:clamp(40px,7vw,88px);line-height:1.05;letter-spacing:-2px;font-weight:800;margin:22px 0 0}
        .lp2-h1 .l{display:block;opacity:0;transform:translateY(30px);animation:lp2rise .9s forwards}
        .lp2-h1 .l:nth-child(1){animation-delay:.15s}
        .lp2-h1 .l:nth-child(2){animation-delay:.32s}
        .lp2-h1 .em{color:#059669;position:relative;display:inline-block}
        .lp2-h1 .em::after{content:"✦";position:absolute;top:-10px;right:-26px;font-size:24px;color:#34d399;animation:lp2tw 1.8s ease-in-out infinite}
        @keyframes lp2tw{0%,100%{opacity:.2;transform:scale(.7) rotate(0)}50%{opacity:1;transform:scale(1.1) rotate(90deg)}}
        .lp2-sub{margin-top:26px;font-size:clamp(16px,2vw,21px);color:#5b6b64;max-width:620px;line-height:1.6;opacity:0;animation:lp2rise 1s .5s forwards}
        .lp2-cta-row{margin-top:38px;display:flex;gap:14px;opacity:0;animation:lp2rise 1s .68s forwards}
        .lp2-btn{padding:16px 30px;border-radius:999px;font-weight:700;font-size:16px;text-decoration:none;cursor:pointer;
          border:none;transition:transform .2s,box-shadow .2s;display:inline-block}
        .lp2-btn.p{background:linear-gradient(135deg,#10b981,#059669);color:#fff;box-shadow:0 12px 30px rgba(16,185,129,.35)}
        .lp2-btn.p:hover{box-shadow:0 18px 40px rgba(16,185,129,.45)}
        .lp2-btn.s{background:#fff;color:#0b1f17;border:1.5px solid #d5e7de}
        .lp2-btn.s:hover{transform:translateY(-3px);border-color:#34d399}
        @keyframes lp2rise{to{opacity:1;transform:translateY(0)}}

        .lp2-stats{display:flex;gap:40px;margin-top:44px;opacity:0;animation:lp2rise 1s .85s forwards}
        .lp2-stat .lp2-n{font-size:34px;font-weight:800;color:#059669;letter-spacing:-1px}
        .lp2-stat .lp2-k{font-size:13px;color:#5b6b64;font-weight:600;margin-top:2px}

        .lp2-floaties{position:fixed;inset:0;z-index:3;pointer-events:none}
        .lp2-chip{position:absolute;background:rgba(255,255,255,.75);backdrop-filter:blur(8px);
          border:1px solid rgba(16,185,129,.25);border-radius:20px;padding:14px 18px;font-weight:700;
          box-shadow:0 20px 40px rgba(6,95,70,.12);color:#059669;font-size:15px;transition:transform .3s ease-out}
        .lp2-c1{top:22%;right:9vw;animation:lp2bob 6s ease-in-out infinite}
        .lp2-c2{top:52%;right:20vw;animation:lp2bob 7.5s ease-in-out .6s infinite}
        .lp2-c3{top:70%;right:6vw;animation:lp2bob 5.5s ease-in-out 1.1s infinite}
        .lp2-c4{top:36%;right:26vw;font-size:34px;padding:16px;border-radius:50%;cursor:pointer;pointer-events:auto}
        .lp2-c4:active{transform:scale(.9)}
        @keyframes lp2bob{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-18px) rotate(2deg)}}

        .lp2-feats{position:relative;z-index:5;display:grid;grid-template-columns:repeat(3,1fr);gap:22px;
          max-width:1100px;margin:0 auto;padding:40px 6vw 90px}
        .lp2-feat{background:rgba(255,255,255,.8);backdrop-filter:blur(6px);border:1px solid #e5f0ea;border-radius:22px;
          padding:28px;opacity:0;transform:translateY(24px);transition:opacity .6s,transform .6s}
        .lp2-feat.in{opacity:1;transform:none}
        .lp2-feat-ic{font-size:34px}
        .lp2-feat-t{font-weight:800;font-size:19px;margin:14px 0 8px}
        .lp2-feat-d{color:#5b6b64;font-size:14px;line-height:1.6}
        .lp2-foot{position:relative;z-index:5;text-align:center;color:#8ba39a;font-size:13px;padding:0 0 40px}

        @media(max-width:820px){.lp2-feats{grid-template-columns:1fr}.lp2-floaties{opacity:.3}.lp2-stats{gap:22px}}
      `}</style>

      <div className="lp2-bg">
        <div className="lp2-blob b1" />
        <div className="lp2-blob b2" />
        <div className="lp2-blob b3" />
      </div>
      <canvas ref={canvasRef} className="lp2-dots" />
      <div className="lp2-glow" />

      <div className="lp2-floaties">
        <div className="lp2-chip lp2-c4">⚡</div>
        <div className="lp2-chip lp2-c1">국비 + 지방비 합산</div>
        <div className="lp2-chip lp2-c2">159개 시·군·구</div>
        <div className="lp2-chip lp2-c3">AI 챗봇 상담</div>
      </div>

      <nav className="lp2-nav">
        <div className="lp2-brand">EV <b>SUBSIDY</b></div>
      </nav>

      <section className="lp2-hero">
        <span className="lp2-kick">2026 전기차 구매보조금</span>
        <h1 className="lp2-h1">
          <span className="l">내 지역, 내 차,</span>
          <span className="l">얼마나 <span className="em">받을까?</span></span>
        </h1>
        <p className="lp2-sub">
          지역과 차종만 고르면 국비·지방비를 합친 실수령 보조금을 즉시 확인.
          전국 데이터와 2026 지침 RAG를 결합한 AI 상담 챗봇이 근거까지 알려드려요.
        </p>
        <div className="lp2-cta-row">
          <Link href="/dashboard" className="lp2-btn p lp2-magnet">대시보드 들어가기 →</Link>
        </div>
        <div className="lp2-stats">
          {STATS.map((s) => (
            <div className="lp2-stat" key={s.k}>
              <div className="lp2-n" data-to={s.to} data-suf={s.suf}>0</div>
              <div className="lp2-k">{s.k}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp2-feats">
        {FEATS.map((f) => (
          <div className="lp2-feat lp2-reveal" key={f.t}>
            <div className="lp2-feat-ic">{f.ic}</div>
            <div className="lp2-feat-t">{f.t}</div>
            <div className="lp2-feat-d">{f.d}</div>
          </div>
        ))}
      </section>

      <div className="lp2-foot">EV SUBSIDY · 2026 지침 기준 · 지역별 실수령 보조금 안내</div>
    </div>
  );
}
