// Local public-asset availability registry.
//
// The `public/images/perseids/*` bundle (VIIRS tiles, World-Atlas raster,
// candidate cities, administrative boundaries) is NOT distributed with this
// repository: no variant found in git history had a confirmed licence.
// See `docs/PUBLIC_ASSETS_AUDIT.md` for the per-asset provenance record.
//
// Every consumer MUST consult this registry before issuing a request, so that
// a missing bundle degrades to an explicit "no data" state instead of an
// endless stream of 404s or fabricated values.
//
// To enable a group after obtaining a licensed copy, drop the files under
// `public/images/perseids/` and set the matching `NEXT_PUBLIC_ASSET_*` flag.

/** The four independently-licensable local asset groups. */
export type PublicAssetGroup =
  | "viirsTiles"
  | "worldAtlas"
  | "cityCandidates"
  | "boundaries";

/**
 * Parse a build-time feature flag.
 * Only the explicit opt-in strings enable a group; anything else (including
 * `undefined`, `""`, `"0"`, `"false"`) keeps it disabled.
 */
export function isAssetFlagEnabled(raw: string | undefined | null): boolean {
  if (typeof raw !== "string") return false;
  const normalised = raw.trim().toLowerCase();
  return (
    normalised === "1" ||
    normalised === "true" ||
    normalised === "on" ||
    normalised === "yes"
  );
}

// NOTE: `process.env.NEXT_PUBLIC_*` must be referenced with literal member
// access for Next.js to inline it into the client bundle. Do not refactor
// these into a dynamic lookup.
export const PUBLIC_ASSETS: Readonly<Record<PublicAssetGroup, boolean>> =
  Object.freeze({
    viirsTiles: isAssetFlagEnabled(process.env.NEXT_PUBLIC_ASSET_VIIRS_TILES),
    worldAtlas: isAssetFlagEnabled(process.env.NEXT_PUBLIC_ASSET_WORLD_ATLAS),
    cityCandidates: isAssetFlagEnabled(
      process.env.NEXT_PUBLIC_ASSET_CITY_CANDIDATES,
    ),
    boundaries: isAssetFlagEnabled(process.env.NEXT_PUBLIC_ASSET_BOUNDARIES),
  });

/** True when the given local asset group is present and licensed. */
export function hasAsset(group: PublicAssetGroup): boolean {
  return PUBLIC_ASSETS[group] === true;
}

/**
 * True when at least one dark-sky raster source exists. Drives the default
 * state of the Bortle toggle: with no source at all the control starts off
 * and is not interactive.
 */
export function hasDarkSkyLayer(): boolean {
  return hasAsset("viirsTiles") || hasAsset("worldAtlas");
}

/** Human-readable reason shown next to a disabled control. */
export const ASSET_UNAVAILABLE_HINT =
  "本地暗夜数据未随仓库分发（许可未确认），当前显示为无数据。";
