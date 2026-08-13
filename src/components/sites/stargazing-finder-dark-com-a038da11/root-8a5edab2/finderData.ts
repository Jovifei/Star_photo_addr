import snapshot from "./finder-locations.json";
import type { FinderLocation } from "@/lib/stargazingFinderTypes";

export type { FinderLabelMode, FinderLocation, FinderMode } from "@/lib/stargazingFinderTypes";

interface SnapshotLocation {
  id: string;
  name: string;
  area: string;
  province: string;
  lng: number;
  lat: number;
  bortle: 1 | 2 | 3 | 4;
  cityCode: string;
  description: string;
}

export const FINDER_LOCATIONS: FinderLocation[] = (snapshot.locations as SnapshotLocation[]).map((location) => ({
  id: location.id,
  name: location.name,
  area: location.area,
  province: location.province,
  latitude: location.lat,
  longitude: location.lng,
  elevation: parseElevation(location.description),
  bortle: location.bortle,
  cityCode: location.cityCode,
  reason: location.description,
}));

export const FINDER_SOURCE = "darkmap.cn / IUCN / 中国绿发会 / VIIRS";
export const FINDER_MAP_SOURCE = "光污染底图 © darkmap.cn（VIIRS 2023）";
export const FINDER_GEOJSON_URL = "/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/province-boundaries.geojson";

export const FINDER_LEGEND_ROWS = [
  { label: "完全符合", color: "cyan", description: "夜间全晴 + 前后 12h 全晴" },
  { label: "非常符合", color: "blue", description: "夜间全晴，前后 12h 有云" },
  { label: "比较符合", color: "green", description: "夜间有云时间占比 < 30%" },
  { label: "不太符合", color: "yellow", description: "夜间有云时间占比 30–50%" },
  { label: "完全不符", color: "red", description: "夜间有云时间占比 > 50%" },
] as const;

export const FINDER_RISK_ROWS = [
  { label: "高海拔警示", description: "海拔 ≥ 2000m，天气多变、温差大", symbol: "↑" },
  { label: "商业不完善", description: "出发前确认道路、补给与现场安全", symbol: "!" },
  { label: "风速风险", description: "夜间小时均风峰值 > 5.5m/s 时降级", symbol: "≈" },
] as const;

function parseElevation(description: string): number | null {
  const match = description.match(/(?:海拔|平均海拔)\s*(\d{3,5})\s*(?:m|米)/);
  return match ? Number(match[1]) : null;
}

export function getShanghaiDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addFinderDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatFinderDate(value: string): string {
  const [, month, day] = value.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

export function weekdayLabel(value: string): string {
  const labels = ["日", "一", "二", "三", "四", "五", "六"];
  return labels[new Date(`${value}T12:00:00Z`).getUTCDay()] ?? "—";
}

export function dateLabel(value: string, tonight: boolean): string {
  return `${tonight ? "今晚" : "日期"} ${formatFinderDate(value)} 周${weekdayLabel(value)}`;
}
