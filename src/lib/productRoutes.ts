import { readLocationIdentity, type LocationIdentity } from "./locationIdentity";
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

export type ProductPath = "/" | "/sites" | "/planner" | "/fireglow" | "/cloudsea";

export interface ProductLinkContext {
  identity?: LocationIdentity | null;
  contextVersion?: 2;
  phase?: "morning" | "evening";
  location?: Pick<
    Location,
    "latitude" | "longitude" | "name" | "elevation"
  > | null;
  night?: string | null;
  model?: CloudState["model"] | null;
  forecastTime?: string | null;
  forecastEpoch?: number | null;
  observationTime?: string | null;
  overlay?: CloudOverlayMode | null;
}

const OBSERVATION_CONTEXT_KEYS = [
  "contextVersion", "sourceScope", "sourceId", "canonicalId", "phase", "forecastEpoch",
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

function copyObservationContext(
  source: ProductRouteSearchParams,
  target: URLSearchParams,
) {
  for (const key of OBSERVATION_CONTEXT_KEYS) {
    const value = firstNonEmpty(source[key]);
    if (value !== null) target.set(key, value);
  }
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
  const location = context.identity ? { ...context.identity, elevation: context.location?.elevation ?? null } : context.location;
  if (context.contextVersion === 2) target.set("contextVersion", "2");
  if (context.identity) {
    target.set("sourceScope", context.identity.sourceScope);
    if (context.identity.sourceId) target.set("sourceId", context.identity.sourceId);
    target.set("canonicalId", context.identity.canonicalId);
  }
  setNonEmpty(target, "phase", context.phase);

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
  if (Number.isSafeInteger(context.forecastEpoch)) target.set("forecastEpoch", String(context.forecastEpoch));
  setNonEmpty(target, "observationTime", context.observationTime);
  setNonEmpty(target, "overlay", context.overlay);

  const query = target.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * Preserve an old bookmark's observation context while moving it into the
 * canonical light-pollution workspace. This is shared by `/viirs` and the old
 * `/stargazing-finder-dark` entry point.
 */
export function buildLightPollutionRedirect(
  searchParams: ProductRouteSearchParams,
): string {
  const target = new URLSearchParams();
  copyObservationContext(searchParams, target);
  target.set("view", "light-pollution");
  return `/?${target.toString()}`;
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
  copyObservationContext(searchParams, target);
  target.set("view", "light-pollution");
  target.set("panel", "sites");
  return `/?${target.toString()}`;
}

export function readProductLinkContext(params: Pick<URLSearchParams, "get">): ProductLinkContext {
  const identity = readLocationIdentity(params);
  const phase = params.get("phase");
  return { identity, location: identity ? { ...identity, elevation: null } : null,
    contextVersion: params.get("contextVersion") === "2" ? 2 : undefined,
    night: params.get("night"), forecastTime: params.get("forecastTime"),
    forecastEpoch: params.get("forecastEpoch") && Number.isSafeInteger(Number(params.get("forecastEpoch"))) ? Number(params.get("forecastEpoch")) : null,
    phase: phase === "morning" || phase === "evening" ? phase : undefined };
}
