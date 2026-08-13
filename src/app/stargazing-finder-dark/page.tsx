import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "🌍 中国观星地点查询 (公测版)",
  description: "光污染等级与天气预报结合的全国观星地点查询地图。",
};

export default function StargazingFinderDarkPage() {
  redirect("/?view=light-pollution");
}
