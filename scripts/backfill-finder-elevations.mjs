// Backfill missing site elevations in finder-locations.json.
//
// The curated source has no elevation field; finderData.ts parses what it can
// from description text (peaks like 太子尖 keep their hand-checked values,
// which beat 90 m DEM smoothing). Only sites with no parseable elevation are
// filled from the Open-Meteo elevation API (Copernicus DEM GLO-90).
//
// Usage: node scripts/backfill-finder-elevations.mjs [--dry-run]

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DATA_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/finder-locations.json",
);
const BATCH_SIZE = 100; // Open-Meteo accepts up to 100 coordinates per call.
const MAX_ATTEMPTS = 3;

const dryRun = process.argv.includes("--dry-run");

function parseElevation(description) {
  const match = String(description ?? "").match(/(?:海拔|平均海拔)\s*(\d{3,5})\s*(?:m|米)/);
  return match ? Number(match[1]) : null;
}

async function fetchElevations(points) {
  const params = new URLSearchParams({
    latitude: points.map((point) => point.lat).join(","),
    longitude: points.map((point) => point.lng).join(","),
  });
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/elevation?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.elevation) || payload.elevation.length !== points.length) {
        throw new Error("unexpected payload shape");
      }
      return payload.elevation;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  throw new Error("unreachable");
}

const snapshot = JSON.parse(await readFile(DATA_FILE, "utf8"));
const locations = snapshot.locations;
const curated = locations.filter((location) => parseElevation(location.description) != null).length;
const missing = locations.filter(
  (location) => location.elevation == null && parseElevation(location.description) == null,
);
console.log(`total=${locations.length} curated-from-description=${curated} missing=${missing.length}`);

const failures = [];
for (let offset = 0; offset < missing.length; offset += BATCH_SIZE) {
  const batch = missing.slice(offset, offset + BATCH_SIZE);
  let elevations;
  try {
    elevations = await fetchElevations(batch.map((location) => ({ lat: location.lat, lng: location.lng })));
  } catch (error) {
    failures.push(...batch.map((location) => location.id));
    console.error(`batch ${offset / BATCH_SIZE + 1} failed: ${error.message}`);
    continue;
  }
  batch.forEach((location, index) => {
    const value = elevations[index];
    if (Number.isFinite(value)) location.elevation = Math.round(value);
    else failures.push(location.id);
  });
  console.log(`batch ${Math.floor(offset / BATCH_SIZE) + 1}: filled ${batch.length}`);
}

const stillMissing = locations.filter((location) => location.elevation == null && parseElevation(location.description) == null);
if (dryRun) {
  console.log(`dry-run: would fill ${missing.length - failures.length}, ${stillMissing.length + failures.length} remain unknown`);
  process.exit(failures.length ? 1 : 0);
}

// Keep the curated description values out of the file where they already
// exist; the runtime mapper prefers the explicit field, so seed those too.
for (const location of locations) {
  if (location.elevation == null) {
    const parsed = parseElevation(location.description);
    if (parsed != null) location.elevation = parsed;
  }
}
snapshot.elevationBackfill = {
  source: "Open-Meteo elevation API (Copernicus DEM GLO-90)",
  backfilledAt: new Date().toISOString(),
  demFilled: missing.length - failures.length,
};

await writeFile(DATA_FILE, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`filled=${missing.length - failures.length} stillUnknown=${stillMissing.length + failures.length}`);
if (failures.length) {
  console.error(`failed ids: ${failures.join(", ")}`);
  process.exit(1);
}
