// Mirror the VIIRS 2024 (VNP46A4) tile sets from perseids.giraffetree.cn into
// the local public asset directory.
//
//   visual tiles : /data/vnp46a4/2024/{z}/{x}/{y}.webp            (z 3..8)
//   value tiles  : /data/vnp46a4/2024-values/8/{x}/{y}.webp      (z 8 only)
//
// The China output bounds are [72,3,136,55] (west, south, east, north).
// If the network is unavailable the script still copies the bundled sample
// tiles (tiles-sample/) into the data path so the Beijing-area sample works
// offline.

import { mkdir, copyFile, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_BASE = join(ROOT, "public", "images", "perseids", "data");
const SAMPLE_BASE = join(ROOT, "public", "images", "perseids", "tiles-sample");
const HOST = "https://perseids.giraffetree.cn";
const BOUNDS = { west: 72, south: 3, east: 136, north: 55 };
const CONCURRENCY = 12;

function lngToX(lng, z) {
  return ((lng + 180) / 360) * 2 ** z;
}
function latToY(lat, z) {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z
  );
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  if (await exists(dest)) return "skip";
  await mkdir(dirname(dest), { recursive: true });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(dest, buffer);
  return "ok";
}

async function pooled(tasks) {
  let index = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (index < tasks.length) {
      const task = tasks[index++];
      try {
        await task();
      } catch {
        // tolerate individual tile failures (keeps the mirror best-effort)
      }
    }
  });
  await Promise.all(workers);
}

async function copySample(x, y) {
  const srcVisual = join(SAMPLE_BASE, `vnp46a4-2024-8-${x}-${y}.webp`);
  const srcValue = join(SAMPLE_BASE, `vnp46a4-2024-values-8-${x}-${y}.webp`);
  const dstVisual = join(DATA_BASE, "vnp46a4", "2024", "8", String(x), `${y}.webp`);
  const dstValue = join(
    DATA_BASE,
    "vnp46a4",
    "2024-values",
    "8",
    String(x),
    `${y}.webp`,
  );
  if (await exists(srcVisual)) {
    await mkdir(dirname(dstVisual), { recursive: true });
    await copyFile(srcVisual, dstVisual);
  }
  if (await exists(srcValue)) {
    await mkdir(dirname(dstValue), { recursive: true });
    await copyFile(srcValue, dstValue);
  }
}

async function main() {
  const tasks = [];
  // Visual tiles z 3..8 across China bounds.
  for (let z = 3; z <= 8; z += 1) {
    const xMin = Math.floor(lngToX(BOUNDS.west, z));
    const xMax = Math.ceil(lngToX(BOUNDS.east, z));
    const yMin = Math.floor(latToY(BOUNDS.north, z));
    const yMax = Math.ceil(latToY(BOUNDS.south, z));
    for (let x = xMin; x <= xMax; x += 1) {
      for (let y = yMin; y <= yMax; y += 1) {
        const url = `${HOST}/data/vnp46a4/2024/${z}/${x}/${y}.webp`;
        const dest = join(
          DATA_BASE,
          "vnp46a4",
          "2024",
          String(z),
          String(x),
          `${y}.webp`,
        );
        tasks.push(() => download(url, dest));
      }
    }
  }
  // Value tiles z 8 only.
  {
    const z = 8;
    const xMin = Math.floor(lngToX(BOUNDS.west, z));
    const xMax = Math.ceil(lngToX(BOUNDS.east, z));
    const yMin = Math.floor(latToY(BOUNDS.north, z));
    const yMax = Math.ceil(latToY(BOUNDS.south, z));
    for (let x = xMin; x <= xMax; x += 1) {
      for (let y = yMin; y <= yMax; y += 1) {
        const url = `${HOST}/data/vnp46a4/2024-values/8/${x}/${y}.webp`;
        const dest = join(
          DATA_BASE,
          "vnp46a4",
          "2024-values",
          "8",
          String(x),
          `${y}.webp`,
        );
        tasks.push(() => download(url, dest));
      }
    }
  }

  console.log(`Queued ${tasks.length} tile downloads.`);
  await pooled(tasks);

  // Guarantee the bundled sample tile is available offline.
  await copySample(210, 97);
  console.log("Done. Sample tile (210/97) copied as offline fallback.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
