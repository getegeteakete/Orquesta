import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI CFO - freee連携 財務分析AI",
  description: "チャットで財務分析・記帳・請求書作成・異常検知を自動化",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
