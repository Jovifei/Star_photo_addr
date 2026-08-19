import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { StoreProvider } from "@/lib/store";
import ProductStateBridge from "@/components/ProductStateBridge";
import "./globals.css";
import "./theme-unified.css";
import "./data-pipeline.css";

export const metadata: Metadata = {
  title: "逐星｜今夜观测",
  description:
    "搜索任意地点，在今夜观测中查看逐小时云量、卫星云观测、夜光影像与天文条件。",
  keywords: [
    "逐星",
    "今夜观测",
    "暗夜选址",
    "观星计划",
    "今晚云量",
    "卫星云图",
    "天文观测",
    "观星天气",
  ],
  authors: [{ name: "逐星 PERSEIDS OBSERVATORY" }],
  openGraph: {
    title: "逐星｜今夜观测",
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
    title: "逐星｜今夜观测",
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
