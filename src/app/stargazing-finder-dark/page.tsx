import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  buildLightPollutionRedirect,
  type ProductRouteSearchParams,
} from "@/lib/productRoutes";

export const metadata: Metadata = {
  title: "🌍 中国观星地点查询 (公测版)",
  description: "光污染等级与天气预报结合的全国观星地点查询地图。",
};

export default async function StargazingFinderDarkPage({
  searchParams,
}: {
  searchParams: Promise<ProductRouteSearchParams>;
}) {
  redirect(buildLightPollutionRedirect(await searchParams));
}
