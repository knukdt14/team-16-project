"use client";
import { useEffect, useState } from "react";

// 서비스워커 등록 + '앱 설치' 버튼 (beforeinstallprompt)
export default function PwaRegister() {
  const [deferred, setDeferred] = useState(null); // 설치 프롬프트 이벤트
  const [standalone, setStandalone] = useState(false); // 이미 설치된 앱으로 실행 중?
  const [hint, setHint] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const isStandalone = () =>
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true;
    setStandalone(isStandalone());

    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => {
      setDeferred(null);
      setHint("설치 완료! 홈 화면·앱 목록에서 실행할 수 있어요.");
      setTimeout(() => setHint(""), 4000);
    };
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onDisplay = () => setStandalone(isStandalone());

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    mq?.addEventListener?.("change", onDisplay);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      mq?.removeEventListener?.("change", onDisplay);
    };
  }, []);

  async function onClick() {
    // 네이티브 설치 프롬프트가 준비돼 있으면 바로 띄우기
    if (deferred) {
      deferred.prompt();
      try { await deferred.userChoice; } catch {}
      setDeferred(null);
      return;
    }
    // 이미 설치했거나 프롬프트가 아직 준비 안 된 경우: 안내
    setHint("이미 설치되어 있거나, 브라우저 주소창의 설치 아이콘(⊕)으로 설치·실행할 수 있어요.");
    setTimeout(() => setHint(""), 5000);
  }

  // 이미 '설치된 앱'으로 실행 중이면 버튼 불필요 → 숨김
  if (standalone) return null;

  // 브라우저에서 볼 때는 항상 버튼 유지 (설치 후에도 사라지지 않음)
  return (
    <div className="pwa-wrap">
      {hint && <div className="pwa-hint">{hint}</div>}
      <button className="pwa-install" onClick={onClick} title="이 앱을 기기에 설치">
        ⬇ 앱 설치
      </button>
    </div>
  );
}
