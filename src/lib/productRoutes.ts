import type { CloudOverlayMode, CloudState, Location } from "@/lib/types";

/**
 * Route helpers shared by compatibility entry points and product navigation.
 *
 * Keep the allow-list explicit: navigation may carry observation context, but
 * unrelated query parameters must not be reflected into a redirect target.
 */
export type ProductRouteSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type ProductPath = "/" | "/sites" | "/planner";

export interface ProductLinkContext {
  location?: Pick<
    Location,
    "latitude" | "longitude" | "name" | "elevation"
  > | null;
  night?: string | null;
  model?: CloudState["model"] | null;
  forecastTime?: string | null;
  observationTime?: string | null;
  overlay?: CloudOverlayMode | null;
}

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

function setNonEmpty(
  params: URLSearchParams,
  key: string,
  value: string | null | undefined,
) {
  const normalized = value?.trim();
  if (normalized) params.set(key, normalized);
}

function hasValidCoordinates(
  location: ProductLinkContext["location"],
): location is NonNullable<ProductLinkContext["location"]> {
  return Boolean(
    location &&
      Number.isFinite(location.latitude) &&
      Number.isFinite(location.longitude) &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      location.longitude >= -180 &&
      location.longitude <= 180,
  );
}

/**
 * Build a product-workspace URL from one canonical observation context.
 *
 * `/` intentionally omits `night` when `includeNight` is false because the
 * primary map is tonight-first. Other session values remain available so a
 * workspace change does not silently reset the selected point or data model.
 */
export function buildProductHref(
  path: ProductPath,
  context: ProductLinkContext = {},
  options: { includeNight?: boolean } = {},
): string {
  const target = new URLSearchParams();
  const { location } = context;

  if (hasValidCoordinates(location)) {
    target.set("lat", String(location.latitude));
    target.set("lng", String(location.longitude));
    setNonEmpty(target, "name", location.name);
    if (Number.isFinite(location.elevation)) {
      target.set("elevation", String(location.elevation));
    }
  }

  if (options.includeNight !== false) {
    setNonEmpty(target, "night", context.night);
  }
  setNonEmpty(target, "model", context.model);
  setNonEmpty(target, "forecastTime", context.forecastTime);
  setNonEmpty(target, "observationTime", context.observationTime);
  setNonEmpty(target, "overlay", context.overlay);

  const query = target.toString();
  return query ? `${path}?${query}` : path;
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
