import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  buildLightPollutionRedirect,
  type ProductRouteSearchParams,
} from "@/lib/productRoutes";

export const metadata: Metadata = {
  title: "暗夜选址兼容入口｜逐星",
  description: "旧中国观星地点查询入口已并入逐星统一暗夜选址工作区。",
  robots: { index: false, follow: false },
};

/** Backwards-compatible entry for the retired standalone Finder UI. */
export default async function StargazingFinderDarkPage({
  searchParams,
}: {
  searchParams: Promise<ProductRouteSearchParams>;
}) {
  redirect(buildLightPollutionRedirect(await searchParams));
}
