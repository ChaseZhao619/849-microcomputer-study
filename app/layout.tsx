import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://microcomputer-849.hebuyijiangnan.chatgpt.site"),
  title: "849微机研习社｜微机原理及应用刷题学习平台",
  description: "面向上海理工大学849微机原理及应用的结构化刷题、错题复测与掌握度学习平台。",
  openGraph: {
    title: "849微机研习社",
    description: "微机原理及应用 · 刷题与掌握度学习平台",
    type: "website",
    images: [{ url: "/og.png", width: 1729, height: 910, alt: "849微机研习社" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "849微机研习社",
    description: "微机原理及应用 · 刷题与掌握度学习平台",
    images: ["/og.png"],
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
