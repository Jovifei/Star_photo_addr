import { redirect } from "next/navigation";
import {
  buildLightPollutionRedirect,
  type ProductRouteSearchParams,
} from "@/lib/productRoutes";

/** Backwards-compatible entry for old bookmarks and data-source links. */
export default async function ViirsRedirect({
  searchParams,
}: {
  searchParams: Promise<ProductRouteSearchParams>;
}) {
  redirect(buildLightPollutionRedirect(await searchParams));
}
