import { redirect } from "next/navigation";
import {
  buildSitesRedirect,
  type ProductRouteSearchParams,
} from "@/lib/productRoutes";

/**
 * Compatibility entry point. The old recommendation map was a third product
 * shell with its own point data and stale cache. The unified map now owns the
 * light-pollution layer, site filters and candidate workflow.
 *
 * Preserve the observation context supplied by 星野决策/逐星 instead of
 * resetting the user to the default map session during the redirect.
 */
export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<ProductRouteSearchParams>;
}) {
  redirect(buildSitesRedirect(await searchParams));
}
