import snapshot from "./catalog.json";
import type { FinderLocation } from "@/lib/stargazingFinderTypes";

export type { FinderLabelMode, FinderLocation, FinderMode } from "@/lib/stargazingFinderTypes";

interface SnapshotLocation {
  id: string;
  name: string;
  area: string;
  province: string;
  lng: number;
  lat: number;
  /** Curated catalog reference only; not a live raster/SQM measurement. */
  bortle: 1 | 2 | 3 | 4;
  cityCode: string;
  description: string;
  /** Metres ASL; curated from descriptions or backfilled from Copernicus DEM. */
  elevation?: number;
}

/**
 * Curated observing-site catalog used by the modern recommendation/weather
 * pipeline. `bortle` is reference metadata for catalog filtering only; live
 * decision scores must not treat it as a measured dark-sky sample.
 */
export const FINDER_LOCATIONS: FinderLocation[] = (
  snapshot.locations as SnapshotLocation[]
).map((location) => ({
  id: location.id,
  name: location.name,
  area: location.area,
  province: location.province,
  latitude: location.lat,
  longitude: location.lng,
  elevation: location.elevation ?? parseElevation(location.description),
  bortle: location.bortle,
  cityCode: location.cityCode,
  reason: location.description,
}));

function parseElevation(description: string): number | null {
  const match = description.match(/(?:海拔|平均海拔)\s*(\d{3,5})\s*(?:m|米)/);
  return match ? Number(match[1]) : null;
}

export function getShanghaiDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addFinderDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
