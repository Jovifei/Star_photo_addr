// Dark-sky (Bortle) sampling — client-side pixel sampling of the China VIIRS
// 2024 value tiles, plus classification into Bortle-equivalent classes.
//
// Value encoding (vnp46a4-2024.json): 0 = nodata; 1..255 =>
//   14 + (value - 1) / 254 * 8  mag/arcsec²
//
// DEGRADATION CONTRACT (see docs/PUBLIC_ASSETS_AUDIT.md):
//   * The value-tile bundle is not distributed with this repository. When it is
//     absent we return `layer-unavailable` WITHOUT issuing any network request,
//     so a missing bundle can never produce a 404 storm.
//   * nodata is NEVER reported as a trustworthy B9/SQM reading. `mpsas`,
//     `bortle` and `bortleName` are all null unless a real pixel was decoded.
//   * Outside the China grid the World-Atlas encoding is unknown, so those
//     coordinates are reported as `unsupported-region`, not as "very bright".

import {
  MPSAS_MAX,
  MPSAS_MIN,
  VIIRS_VALUE_BASE,
} from "./constants";
import { hasAsset } from "./assets";
import { isInChinaBounds } from "./nighttime";
import type { BortleClass, DarkSkySample, DarkSkyStatus } from "./types";
import { BORTLE_CLASSES, BORTLE_LOWER_BOUNDS_MPSAS } from "@/data/viirsMeta";

const TILE_ZOOM = 8;
const TILE_SIZE = 256;

/** Convert a VIIRS value (0..255) to mpsas; 0 is nodata → null. */
export function mpsasFromValue(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return MPSAS_MIN + ((value - 1) / 254) * (MPSAS_MAX - MPSAS_MIN);
}

/**
 * Classify an mpsas value into a Bortle-equivalent class.
 *
 * Returns `null` for nodata (`null` input). It deliberately does NOT fall back
 * to B9: "no measurement" and "city-centre sky" are different statements and
 * conflating them fabricates confidence the data does not support.
 */
export function classifyBortle(mpsas: number | null): BortleClass | null {
  if (mpsas === null || !Number.isFinite(mpsas)) return null;
  for (let index = 0; index < BORTLE_LOWER_BOUNDS_MPSAS.length; index += 1) {
    if (mpsas >= BORTLE_LOWER_BOUNDS_MPSAS[index]) {
      return BORTLE_CLASSES[index];
    }
  }
  return BORTLE_CLASSES[BORTLE_CLASSES.length - 1];
}

/** Build an explicit "no trustworthy value" sample. */
function emptySample(
  latitude: number,
  longitude: number,
  status: Exclude<DarkSkyStatus, "ok">,
): DarkSkySample {
  return {
    latitude,
    longitude,
    mpsas: null,
    bortle: null,
    bortleName: null,
    source: "none",
    status,
    uncertain: true,
  };
}

/** Short Chinese explanation for a sample state, used by the side panel. */
export function describeDarkSkyStatus(status: DarkSkyStatus): string {
  switch (status) {
    case "ok":
      return "来自中国 2024 VIIRS 增强层的等效分级。";
    case "nodata":
      return "该像元为 nodata（无有效观测），不代表天空很暗。";
    case "unsupported-region":
      return "该位置在中国 VIIRS 网格之外，全球底图数值编码未知，无法给出等级。";
    case "layer-unavailable":
      return "本地暗夜数据未随仓库分发（许可未确认），暂不提供等级。";
    default:
      return "暗夜数据状态未知。";
  }
}

interface TileCoord {
  x: number;
  y: number;
  px: number;
  py: number;
}

function lngLatToTile(latitude: number, longitude: number, z: number): TileCoord {
  const n = 2 ** z;
  const xf = ((longitude + 180) / 360) * n;
  const latRad = (latitude * Math.PI) / 180;
  const yf =
    ((1 -
      Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
      2) *
    n;
  const x = Math.floor(xf);
  const y = Math.floor(yf);
  const px = Math.min(TILE_SIZE - 1, Math.max(0, Math.floor((xf - x) * TILE_SIZE)));
  const py = Math.min(TILE_SIZE - 1, Math.max(0, Math.floor((yf - y) * TILE_SIZE)));
  return { x, y, px, py };
}

// Promises (including failed ones resolving to null) are cached forever, so a
// missing tile is requested at most once per session.
const tileCanvasCache = new Map<string, Promise<HTMLCanvasElement | null>>();

/** Test seam: drop the negative cache so a re-installed bundle is picked up. */
export function resetTileCache(): void {
  tileCanvasCache.clear();
}

function loadTileCanvas(x: number, y: number): Promise<HTMLCanvasElement | null> {
  const key = `${x}-${y}`;
  const cached = tileCanvasCache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return null;
    }
    try {
      return await loadImageToCanvas(`${VIIRS_VALUE_BASE}/8/${x}/${y}.webp`);
    } catch {
      // Missing/undecodable tile: cache the null result, never retry.
      return null;
    }
  })();

  tileCanvasCache.set(key, promise);
  return promise;
}

function loadImageToCanvas(url: string): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = TILE_SIZE;
        canvas.height = TILE_SIZE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          reject(new Error("no 2d context"));
          return;
        }
        ctx.drawImage(img, 0, 0, TILE_SIZE, TILE_SIZE);
        resolve(canvas);
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error(`tile load failed: ${url}`));
    img.src = url;
  });
}

function readPixel(canvas: HTMLCanvasElement, px: number, py: number): number {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  const data = ctx.getImageData(px, py, 1, 1).data;
  // nodata is signalled by value 0 or a fully transparent pixel
  if (data[3] === 0) return 0;
  return data[0];
}

/**
 * Sample the night-sky brightness at a coordinate.
 *
 * Resolution order:
 *  1. No local raster bundle installed  → `layer-unavailable` (no request).
 *  2. Outside the China VIIRS grid      → `unsupported-region`.
 *  3. Tile missing or undecodable       → `layer-unavailable`.
 *  4. Pixel encodes 0                   → `nodata`.
 *  5. Otherwise                         → `ok` with a real mpsas + class.
 *
 * This function never throws; callers always receive a well-formed sample.
 */
export async function sampleBortle(
  latitude: number,
  longitude: number,
): Promise<DarkSkySample> {
  if (!hasAsset("viirsTiles")) {
    return emptySample(latitude, longitude, "layer-unavailable");
  }

  if (!isInChinaBounds(latitude, longitude)) {
    return emptySample(latitude, longitude, "unsupported-region");
  }

  const { x, y, px, py } = lngLatToTile(latitude, longitude, TILE_ZOOM);

  let canvas: HTMLCanvasElement | null = null;
  try {
    canvas = await loadTileCanvas(x, y);
  } catch {
    canvas = null;
  }
  if (!canvas) {
    return emptySample(latitude, longitude, "layer-unavailable");
  }

  let value = 0;
  try {
    value = readPixel(canvas, px, py);
  } catch {
    // Tainted canvas or out-of-range read: treat as unavailable, not as dark.
    return emptySample(latitude, longitude, "layer-unavailable");
  }

  const mpsas = mpsasFromValue(value);
  const klass = classifyBortle(mpsas);
  if (mpsas === null || klass === null) {
    return {
      ...emptySample(latitude, longitude, "nodata"),
      source: "viirs-2024",
    };
  }

  return {
    latitude,
    longitude,
    mpsas,
    bortle: klass.level,
    bortleName: klass.name,
    source: "viirs-2024",
    status: "ok",
    uncertain: false,
  };
}
