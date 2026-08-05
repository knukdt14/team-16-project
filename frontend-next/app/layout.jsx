import "./globals.css";

export const metadata = {
  title: "EV Subsidy AI · 전기차 보조금 챗봇",
  description: "2026년 전기차 구매보조금 상담·비교 대시보드 & 챗봇",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
