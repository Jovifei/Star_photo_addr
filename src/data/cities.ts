// City dark-sky candidate data (from cities.json) plus the 34-feature selection
// shown in the side panel. The full 370-row file is fetched at runtime (static
// asset) rather than bundled.
//
// DEGRADATION: cities.json is not distributed with this repository — every row's
// `bortle` value is derived from the unlicensed light-pollution model (see
// docs/PUBLIC_ASSETS_AUDIT.md). When the file is absent we report `unavailable`
// without issuing a request, and the side panel says so explicitly instead of
// spinning on "正在加载…" forever.

import { CITY_CANDIDATES_URL } from "@/lib/constants";
import { hasAsset } from "@/lib/assets";
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

/** Load outcome, so the UI can distinguish "still loading" from "no data". */
export type CityCandidateStatus = "loading" | "ok" | "empty" | "unavailable";

export interface CityCandidateResult {
  status: CityCandidateStatus;
  candidates: CityCandidate[];
}

/** A row is usable only if it carries finite, in-range coordinates. */
function normaliseRow(item: CityRow): CityCandidate | null {
  const latitude = Number(item?.latitude);
  const longitude = Number(item?.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return null;
  }
  const bortle = Number(item?.bortle);
  return {
    id: String(item.id ?? `${latitude},${longitude}`),
    adcode: Number(item.adcode) || 0,
    province: String(item.province ?? ""),
    city: String(item.city ?? ""),
    name: String(item.name ?? "未命名候选点"),
    longitude,
    latitude,
    // Out-of-range/absent values are dropped rather than clamped into a
    // plausible-looking class.
    bortle: Number.isFinite(bortle) && bortle >= 1 && bortle <= 9 ? bortle : 0,
    kind: String(item.kind ?? "modeled"),
    note: String(item.note ?? ""),
  };
}

/** Fetch and normalise the full set of candidate cities. Never throws. */
export async function fetchCityCandidates(): Promise<CityCandidateResult> {
  if (!hasAsset("cityCandidates")) {
    return { status: "unavailable", candidates: [] };
  }
  try {
    const response = await fetch(CITY_CANDIDATES_URL);
    if (!response.ok) return { status: "unavailable", candidates: [] };
    const raw = (await response.json()) as unknown;
    if (!Array.isArray(raw)) return { status: "unavailable", candidates: [] };
    const candidates = raw
      .map((item) => normaliseRow(item as CityRow))
      .filter((item): item is CityCandidate => item !== null);
    return {
      status: candidates.length > 0 ? "ok" : "empty",
      candidates,
    };
  } catch {
    return { status: "unavailable", candidates: [] };
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
