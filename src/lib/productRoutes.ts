/**
 * Route helpers shared by compatibility entry points.
 *
 * Keep the allow-list explicit: navigation may carry observation context, but
 * unrelated query parameters must not be reflected into a redirect target.
 */
export type ProductRouteSearchParams = Record<
  string,
  string | string[] | undefined
>;

const OBSERVATION_CONTEXT_KEYS = [
  "lat",
  "lng",
  "name",
  "elevation",
  "night",
  "model",
  "forecastTime",
  "observationTime",
  "overlay",
] as const;

function firstNonEmpty(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value.find((item) => item.trim().length > 0) ?? null;
  }
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * `/sites` is a compatibility route for the recommendation workspace now
 * embedded in the main map. Preserve the originating location/model/session
 * while forcing the canonical light-pollution + sites-panel view.
 */
export function buildSitesRedirect(
  searchParams: ProductRouteSearchParams,
): string {
  const target = new URLSearchParams();

  for (const key of OBSERVATION_CONTEXT_KEYS) {
    const value = firstNonEmpty(searchParams[key]);
    if (value !== null) target.set(key, value);
  }

  target.set("view", "light-pollution");
  target.set("panel", "sites");

  return `/?${target.toString()}`;
}
