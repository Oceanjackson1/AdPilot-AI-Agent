import "./globals.css";
import Providers from "@/components/Providers";

export const metadata = {
  title: "AdPilot — AI 广告投放优化师",
  description: "基于 AI 的广告投放优化助手，上传投放数据，获取专业分析与优化建议。让每一分广告预算都花在刀刃上。",
  keywords: "广告投放, AI优化, 广告分析, ROI, ROAS, 投放建议",
  icons: {
    icon: "/favicon.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
