import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { StoreProvider } from "@/lib/store";
import ProductStateBridge from "@/components/ProductStateBridge";
import "./globals.css";

export const metadata: Metadata = {
  title: "逐星｜今晚云量与卫星云图",
  description:
    "搜索任意地点，查看今晚到未来时间节点的逐小时云量、卫星云观测与夜光影像。",
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
    title: "逐星｜今晚云量与卫星云图",
    description:
      "以今晚为起点，查看未来小时云量变化、卫星观测与可用数据源状态。",
    url: "https://perseids.giraffetree.cn",
    type: "website",
    locale: "zh_CN",
    // No `images`: the previous /images/perseids/og.png was never distributed
    // with this repository (unlicensed copy, see docs/PUBLIC_ASSETS_AUDIT.md).
    // Declaring it made every social crawler fetch a 404.
  },
  twitter: {
    // `summary` rather than `summary_large_image` — we have no owned OG asset.
    card: "summary",
    title: "逐星｜今晚云量与卫星云图",
    description:
      "把今晚暗夜、月光、天文事件与当地可靠天气放在一张地图上。",
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
      <body className="min-h-full antialiased">
        <StoreProvider>
          <Suspense fallback={null}>
            <ProductStateBridge />
          </Suspense>
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
