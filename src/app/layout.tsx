import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { StoreProvider } from "@/lib/store";
import ProductStateBridge from "@/components/ProductStateBridge";
import "./globals.css";
import "./theme-unified.css";
import "@/components/workspace/workspace-shell.css";
import "./data-pipeline.css";
import "./viewport-recommendations.css";
import "./viewport-recommendations-mobile.css";
import "./ux-map-v2.css";
import "./mobile-map-controls.css";

const PUBLIC_SITE_URL = "https://photo.joviluma.com";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title: "逐星｜今夜观测",
  description:
    "搜索任意地点，在今夜观测中查看逐小时云量、卫星云观测、暗夜参考、天文条件，并进入火烧云与高山云海摄影工作区。",
  keywords: [
    "逐星",
    "今夜观测",
    "暗夜选址",
    "火烧云",
    "高山云海",
    "今晚云量",
    "卫星云图",
    "天文观测",
    "观星天气",
    "星空摄影",
  ],
  authors: [{ name: "逐星 PERSEIDS OBSERVATORY" }],
  openGraph: {
    title: "逐星｜星空摄影观测平台",
    description:
      "把今晚能不能拍、去哪里拍、几点拍，以及火烧云与高山云海条件放在同一套地图决策工作流中。",
    url: PUBLIC_SITE_URL,
    siteName: "逐星",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary",
    title: "逐星｜星空摄影观测平台",
    description:
      "逐小时云量、卫星云观测、暗夜选址、火烧云与高山云海摄影条件的一体化地图工作台。",
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
