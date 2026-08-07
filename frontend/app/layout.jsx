import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

export const metadata = {
  title: "EV Subsidy AI · 전기차 보조금 챗봇",
  description: "2026년 전기차 구매보조금 상담·비교 대시보드 & 챗봇",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EV보조금",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#10b981",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
