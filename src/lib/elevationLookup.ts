import { FINDER_LOCATIONS } from "@/data/observingSites/catalog";

/**
 * Known prominent mountain summits and viewpoints with curated elevations (m ASL).
 * These values are used only for exact place-name matches, never nearby map clicks.
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

function normalizePlaceName(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\s·・,，。_-]+/g, "");
}

function isValidElevation(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -500 && value <= 9000;
}

/**
 * Resolve only elevations with an explicit source: a supplied geocoder value
 * or one unambiguous exact curated-place name. Coordinates and descriptive
 * labels are not enough to borrow a nearby site's elevation.
 */
export function resolveElevation(name?: string, rawElevation?: number | null): number | null {
  if (isValidElevation(rawElevation)) return Math.round(rawElevation);

  const normalizedName = name ? normalizePlaceName(name) : "";
  if (!normalizedName) return null;

  const famousPeak = Object.entries(FAMOUS_PEAK_ELEVATIONS).find(
    ([peak]) => normalizePlaceName(peak) === normalizedName,
  );
  if (famousPeak) return famousPeak[1];

  const matchingSites = FINDER_LOCATIONS.filter((location) =>
    isValidElevation(location.elevation) &&
    [location.name, location.area]
      .filter((part): part is string => Boolean(part))
      .some((part) => normalizePlaceName(part) === normalizedName),
  );
  if (matchingSites.length !== 1) return null;
  return Math.round(matchingSites[0]!.elevation!);
}
