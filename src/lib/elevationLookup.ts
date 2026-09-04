import { FINDER_LOCATIONS } from "@/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/finderData";

/**
 * Known prominent mountain summits and viewpoints with curated elevations (m ASL).
 * Prevents user searches or clicks from degrading to "海拔 0 m".
 */
const FAMOUS_PEAK_ELEVATIONS: Record<string, number> = {
  太子尖: 1557,
  牵牛岗: 1490,
  大明山: 1489,
  天荒坪: 980,
  江南天池: 980,
  四明山: 1018,
  黄山: 1864,
  光明顶: 1860,
  华顶山: 1098,
  百山祖: 1856,
  黄茅尖: 1929,
  牛背山: 3660,
  轿子雪山: 4223,
  贡嘎: 7556,
  子梅垭口: 4500,
  鱼子西: 4200,
  瓦屋山: 2830,
  金顶: 3079,
  峨眉山: 3079,
  华山: 2155,
  泰山: 1545,
  武功山: 1918,
  庐山: 1474,
  三清山: 1819,
  长白山: 2691,
};

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Resolves a reliable elevation in metres for a given coordinate and/or name.
 * 1. Checks curated famous peaks dictionary by name.
 * 2. Checks exact or partial name in FINDER_LOCATIONS library.
 * 3. Checks closest site in FINDER_LOCATIONS within 5km radius.
 * 4. Falls back to rawElevation (if > 0), else estimated default.
 */
export function resolveElevation(
  latitude: number,
  longitude: number,
  name?: string,
  rawElevation?: number,
): number {
  if (rawElevation != null && rawElevation > 0) {
    return Math.round(rawElevation);
  }

  // 1. Match famous peak names
  if (name) {
    for (const [peak, ele] of Object.entries(FAMOUS_PEAK_ELEVATIONS)) {
      if (name.includes(peak)) {
        return ele;
      }
    }
  }

  // 2. Match FINDER_LOCATIONS by name or area
  if (name) {
    const matched = FINDER_LOCATIONS.find(
      (loc) =>
        loc.elevation &&
        loc.elevation > 0 &&
        (name.includes(loc.name) ||
          loc.name.includes(name) ||
          (loc.area && name.includes(loc.area))),
    );
    if (matched?.elevation) {
      return Math.round(matched.elevation);
    }
  }

  // 3. Proximity lookup within 5km of known observation sites
  let closestDist = Number.POSITIVE_INFINITY;
  let closestEle = 0;
  for (const loc of FINDER_LOCATIONS) {
    if (!loc.elevation || loc.elevation <= 0) continue;
    const dist = calculateDistanceKm(latitude, longitude, loc.latitude, loc.longitude);
    if (dist < closestDist && dist <= 5) {
      closestDist = dist;
      closestEle = loc.elevation;
    }
  }

  if (closestEle > 0) {
    return Math.round(closestEle);
  }

  return rawElevation && rawElevation > 0 ? Math.round(rawElevation) : 0;
}
