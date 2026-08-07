import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "逐星｜全球英仙座流星雨观测地图",
  description:
    "搜索全球任意地点，比较全球 2015 暗夜参考与中国 2024 VIIRS 增强层，并按地点当地时区查看 2026 英仙座流星雨逐夜天气。",
  keywords: [
    "逐星",
    "英仙座流星雨",
    "Perseids",
    "暗夜地图",
    "Bortle",
    "天文观测",
    "流星雨",
  ],
  authors: [{ name: "逐星 PERSEIDS OBSERVATORY" }],
  openGraph: {
    title: "逐星｜全球英仙座流星雨观测地图",
    description:
      "8 月 7—17 日共 11 晚，搜索全球地点、读取暗夜参考，并按当地时区查看可靠天气窗口。",
    url: "https://perseids.giraffetree.cn",
    type: "website",
    locale: "zh_CN",
    images: [
      {
        url: "/images/perseids/og.png",
        width: 1200,
        height: 630,
        alt: "逐星：全球英仙座流星雨观测地图",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "逐星｜全球英仙座流星雨观测地图",
    description:
      "把全球 11 晚暗夜、月光、流星活动与当地可靠天气放在一张地图上。",
    images: ["/images/perseids/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#02070b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // No web fonts are loaded — the design uses system CJK font stacks only.
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
