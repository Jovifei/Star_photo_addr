// City dark-sky candidate data (from cities.json) plus the 34-feature selection
// shown in the side panel. The full 370-row file is fetched at runtime (static
// asset) rather than bundled.

import { CITY_CANDIDATES_URL } from "@/lib/constants";
import type { CityCandidate } from "@/lib/types";

/** Raw city row as stored in cities.json (before normalisation to CityCandidate). */
interface CityRow {
  id: string | number;
  adcode: string | number;
  province: string;
  city: string;
  name: string;
  longitude: number;
  latitude: number;
  bortle: number;
  kind?: string;
  note?: string;
}

/** Fetch and normalise the full set of 370 candidate cities. */
export async function fetchCityCandidates(): Promise<CityCandidate[]> {
  try {
    const response = await fetch(CITY_CANDIDATES_URL);
    if (!response.ok) return [];
    const raw = (await response.json()) as CityRow[];
    return raw.map((item) => ({
      id: String(item.id),
      adcode: Number(item.adcode),
      province: String(item.province),
      city: String(item.city),
      name: String(item.name),
      longitude: Number(item.longitude),
      latitude: Number(item.latitude),
      bortle: Number(item.bortle),
      kind: String(item.kind ?? "modeled"),
      note: String(item.note ?? ""),
    }));
  } catch {
    return [];
  }
}

/**
 * Deterministically derive a province-diverse, darkness-prioritised set of
 * `count` featured candidates (default 34) from the full list.
 */
export function selectFeatured(
  cities: CityCandidate[],
  count = 34,
): CityCandidate[] {
  if (cities.length <= count) {
    return [...cities].sort((a, b) => a.bortle - b.bortle);
  }
  const byProvince = new Map<string, CityCandidate[]>();
  for (const candidate of cities) {
    const list = byProvince.get(candidate.province) ?? [];
    list.push(candidate);
    byProvince.set(candidate.province, list);
  }
  const queues = [...byProvince.values()].map((list) =>
    list.slice().sort((a, b) => a.bortle - b.bortle),
  );
  const picked: CityCandidate[] = [];
  let added = true;
  while (picked.length < count && added) {
    added = false;
    for (const queue of queues) {
      if (queue.length && picked.length < count) {
        picked.push(queue.shift() as CityCandidate);
        added = true;
      }
    }
  }
  return picked.sort((a, b) => a.bortle - b.bortle);
}
