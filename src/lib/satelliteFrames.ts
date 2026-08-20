import type { SatelliteFrame } from "@/lib/types";

function isSatelliteFrame(
  value: unknown,
  kind: SatelliteFrame["kind"],
): value is SatelliteFrame {
  if (!value || typeof value !== "object") return false;
  const frame = value as Partial<SatelliteFrame>;
  return (
    frame.kind === kind &&
    frame.source === "NASA GIBS" &&
    frame.observed === true &&
    frame.isForecast === false &&
    typeof frame.time === "string" &&
    frame.time.length > 0 &&
    typeof frame.observedAt === "string" &&
    frame.observedAt.length > 0 &&
    typeof frame.tileTemplate === "string" &&
    frame.tileTemplate.includes("{TileMatrix}") &&
    frame.tileTemplate.includes("{TileRow}") &&
    frame.tileTemplate.includes("{TileCol}")
  );
}

/**
 * Keep only frames belonging to the requested product. Without this guard a
 * failed mode switch could display the previous cloud frame as night lights.
 */
export function validSatelliteFrames(
  kind: SatelliteFrame["kind"],
  values: unknown,
): SatelliteFrame[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is SatelliteFrame =>
    isSatelliteFrame(value, kind),
  );
}

/** NASA GIBS matrix sets used by the server route stop at these zoom levels. */
export function satelliteMaxNativeZoom(
  kind: SatelliteFrame["kind"],
): number {
  return kind === "cloud" ? 6 : 8;
}
