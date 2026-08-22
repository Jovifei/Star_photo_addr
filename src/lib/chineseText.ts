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
  const name = toSimplifiedChinese(location.name ?? null);
  const province = toSimplifiedChinese(location.province ?? null);
  const area = toSimplifiedChinese(location.area ?? null);
  if (name === location.name && province === location.province && area === location.area) return location;
  return { ...location, ...(name !== null ? { name } : {}), ...(province !== null ? { province } : {}), ...(area !== null ? { area } : {}) };
}
