// Dark-sky (Bortle) sampling — client-side pixel sampling of the China VIIRS
// 2024 value tiles, plus classification into Bortle-equivalent classes.
//
// Value encoding (vnp46a4-2024.json): 0 = nodata; 1..255 =>
//   14 + (value - 1) / 254 * 8  mag/arcsec²
//
// Outside China the World-Atlas value encoding is unknown, so those samples are
// marked `uncertain`. This mirrors perseids' own uncertainty handling.

import {
  MPSAS_MAX,
  MPSAS_MIN,
  VIIRS_SAMPLE_BASE,
  VIIRS_VALUE_BASE,
} from "./constants";
import { isInChinaBounds } from "./nighttime";
import type { BortleClass, DarkSkySample } from "./types";
import { BORTLE_CLASSES, BORTLE_LOWER_BOUNDS_MPSAS } from "@/data/viirsMeta";

const TILE_ZOOM = 8;
const TILE_SIZE = 256;

/** Convert a VIIRS value (0..255) to mpsas; 0 is nodata → null. */
export function mpsasFromValue(value: number): number | null {
  if (value === 0) return null;
  return MPSAS_MIN + ((value - 1) / 254) * (MPSAS_MAX - MPSAS_MIN);
}

/** Classify an mpsas value into a Bortle-equivalent class. */
export function classifyBortle(mpsas: number | null): BortleClass {
  if (mpsas === null) {
    return BORTLE_CLASSES[BORTLE_CLASSES.length - 1]; // B9
  }
  for (let index = 0; index < BORTLE_LOWER_BOUNDS_MPSAS.length; index += 1) {
    if (mpsas >= BORTLE_LOWER_BOUNDS_MPSAS[index]) {
      return BORTLE_CLASSES[index];
    }
  }
  return BORTLE_CLASSES[BORTLE_CLASSES.length - 1];
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

const tileCanvasCache = new Map<string, Promise<HTMLCanvasElement | null>>();

function loadTileCanvas(x: number, y: number): Promise<HTMLCanvasElement | null> {
  const key = `${x}-${y}`;
  const cached = tileCanvasCache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return null;
    }
    const candidates = [
      `${VIIRS_VALUE_BASE}/8/${x}/${y}.webp`,
      `${VIIRS_SAMPLE_BASE}/vnp46a4-2024-values-8-${x}-${y}.webp`,
    ];
    for (const url of candidates) {
      try {
        const value = await loadImageToCanvas(url);
        if (value) return value;
      } catch {
        // try next candidate (e.g. the sample tile fallback)
      }
    }
    return null;
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
  // nodata is signalled by value 0 or fully transparent pixel
  if (data[3] === 0) return 0;
  return data[0];
}

/**
 * Sample the night-sky brightness at a coordinate.
 * - Inside China: reads the VIIRS 2024 value tile pixel.
 * - Outside China: marks the sample uncertain (World-Atlas encoding unknown).
 * - Tile load failure: returns a null/uncertain B9 sample.
 */
export async function sampleBortle(
  latitude: number,
  longitude: number,
): Promise<DarkSkySample> {
  if (!isInChinaBounds(latitude, longitude)) {
    const b9 = BORTLE_CLASSES[BORTLE_CLASSES.length - 1];
    return {
      latitude,
      longitude,
      mpsas: null,
      bortle: b9.level,
      bortleName: b9.name,
      source: "world-atlas-2015",
      uncertain: true,
    };
  }

  const { x, y, px, py } = lngLatToTile(latitude, longitude, TILE_ZOOM);
  const canvas = await loadTileCanvas(x, y);
  if (!canvas) {
    const b9 = BORTLE_CLASSES[BORTLE_CLASSES.length - 1];
    return {
      latitude,
      longitude,
      mpsas: null,
      bortle: b9.level,
      bortleName: b9.name,
      source: "none",
      uncertain: true,
    };
  }

  const value = readPixel(canvas, px, py);
  const mpsas = mpsasFromValue(value);
  const klass = classifyBortle(mpsas);
  return {
    latitude,
    longitude,
    mpsas,
    bortle: klass.level,
    bortleName: klass.name,
    source: "viirs-2024",
    uncertain: mpsas === null,
  };
}
