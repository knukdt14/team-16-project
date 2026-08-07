// Next.js 14 앱 라우트 매니페스트 → /manifest.webmanifest 로 자동 서빙
export default function manifest() {
  return {
    name: "EV Subsidy AI · 전기차 보조금 챗봇",
    short_name: "EV보조금",
    description: "2026년 전기차 구매보조금 상담·비교 대시보드 & 챗봇",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0f17",
    theme_color: "#10b981",
    orientation: "portrait-primary",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
