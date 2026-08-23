// Simplified-Chinese normalization for user-facing place names.
//
// GeoNames (the Open-Meteo geocoding backend) stores Chinese names in a mix
// of scripts, so searches like "临安" can come back as "臨安". Every boundary
// that ingests external or stored place names normalizes through this helper
// so the console stays in Simplified Chinese. The t2cn build only bundles the
// traditional→simplified dictionaries (~40 KB gzipped).

import * as OpenCC from "opencc-js/t2cn";

const convert = OpenCC.Converter({ from: "t", to: "cn" });
const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;

export function toSimplifiedChinese<T extends string | null | undefined>(input: T): T {
  if (typeof input !== "string" || !input || !CJK.test(input)) return input;
  const converted = convert(input);
  return (converted === input ? input : converted) as T;
}

export function normalizeLocationTexts<T extends { name?: string | null; province?: string | null; area?: string | null }>(location: T): T {
  if (!location) return location;
  const rawName = location.name ?? null;
  const rawProvince = location.province ?? null;
  const rawArea = location.area ?? null;
  const name = toSimplifiedChinese(rawName);
  const province = toSimplifiedChinese(rawProvince);
  const area = toSimplifiedChinese(rawArea);
  // Preserve the original reference when nothing changed so memoized
  // dependents keep their identity across hydration.
  if (name === rawName && province === rawProvince && area === rawArea) return location;
  return { ...location, ...(name !== null ? { name } : {}), ...(province !== null ? { province } : {}), ...(area !== null ? { area } : {}) };
}
