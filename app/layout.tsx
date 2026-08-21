import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://microcomputer-849.hebuyijiangnan.chatgpt.site"),
  title: "849微机研习社｜微机原理及应用刷题学习平台",
  description: "面向上海理工大学849微机原理及应用的11章、52专题、200题学习平台，支持账户同步、学习计划、随机组卷与错题间隔复测。",
  openGraph: {
    title: "849微机研习社",
    description: "11章52专题200题 · 账户同步 · 学习计划 · 组卷考试 · 错题间隔复测",
    type: "website",
    images: [{ url: "/og.png", width: 1729, height: 910, alt: "849微机研习社" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "849微机研习社",
    description: "11章52专题200题 · 账户同步 · 学习计划 · 组卷考试 · 错题间隔复测",
    images: ["/og.png"],
  },
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
