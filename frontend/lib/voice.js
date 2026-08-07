// Web Speech API 유틸 — 브라우저 네이티브 음성인식(STT)/음성합성(TTS)
// ⚠️ Streamlit에서는 이 브라우저 API에 직접 접근할 수 없습니다. (Next.js/클라이언트 전용)

// 음성인식 지원 여부
export function sttSupported() {
  if (typeof window === "undefined") return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// 음성합성 지원 여부
export function ttsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// 음성인식 인스턴스 생성 (한국어)
export function createRecognition({ onResult, onEnd, onError } = {}) {
  if (!sttSupported()) return null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = "ko-KR";
  rec.interimResults = true; // 중간 결과도 실시간 표시
  rec.continuous = false;
  rec.maxAlternatives = 1;

  rec.onresult = (e) => {
    let interim = "";
    let final = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    onResult?.({ interim, final, isFinal: !!final });
  };
  rec.onerror = (e) => onError?.(e.error || "error");
  rec.onend = () => onEnd?.();
  return rec;
}

// **bold**, 줄바꿈, 근거표기 등 마크업을 걷어내고 읽기 좋은 평문으로
function cleanForSpeech(text) {
  return String(text)
    .replace(/\*\*/g, "")
    .replace(/[•·]/g, ", ")
    .replace(/\n+/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// 한국어 보이스 우선 선택
function pickKoVoice() {
  const voices = window.speechSynthesis.getVoices() || [];
  return (
    voices.find((v) => v.lang === "ko-KR") ||
    voices.find((v) => (v.lang || "").startsWith("ko")) ||
    voices[0] ||
    null
  );
}

// 답변 음성 낭독
export function speak(text) {
  if (!ttsSupported() || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel(); // 이전 낭독 중단
  const u = new SpeechSynthesisUtterance(cleanForSpeech(text));
  u.lang = "ko-KR";
  u.rate = 1.05;
  u.pitch = 1;
  const v = pickKoVoice();
  if (v) u.voice = v;
  synth.speak(u);
}

// 낭독 중단
export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
