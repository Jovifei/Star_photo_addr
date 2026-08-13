import { redirect } from "next/navigation";

/**
 * Compatibility entry point. The old recommendation map was a third product
 * shell with its own point data and stale cache. The unified map now owns the
 * light-pollution layer, site filters and candidate workflow.
 */
export default function SitesPage() {
  redirect("/?view=light-pollution&panel=sites");
}
