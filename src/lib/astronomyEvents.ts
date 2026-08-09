import { localDateKey } from "./nighttime";

export interface AstronomyEvent {
  id: string;
  title: string;
  date: string;
  dateLabel: string;
  detail: string;
  priority: number;
  sourceUrl: string;
}

/** Reviewed sky events shown as auxiliary context beside the weather outlook. */
export const ASTRONOMY_EVENTS: AstronomyEvent[] = [
  {
    id: "perseids-2026",
    title: "英仙座流星雨",
    date: "2026-08-12",
    dateLabel: "8月12—13日",
    detail: "年度流星雨峰值，适合夜间观测",
    priority: 1,
    sourceUrl: "https://science.nasa.gov/science-research/planetary-science/26jul_perseids/",
  },
  {
    id: "solar-eclipse-2026",
    title: "北半球日全食",
    date: "2026-08-12",
    dateLabel: "8月12日",
    detail: "全食带经过格陵兰、冰岛、西班牙等地",
    priority: 2,
    sourceUrl: "https://science.nasa.gov/eclipses/future-eclipses/total-solar-eclipse-on-august-12-2026/",
  },
  {
    id: "lunar-eclipse-2026",
    title: "偏食月食",
    date: "2026-08-28",
    dateLabel: "8月28日",
    detail: "可见区域覆盖太平洋、美洲、欧洲和非洲",
    priority: 3,
    sourceUrl: "https://science.nasa.gov/moon/eclipses/",
  },
];

export function upcomingAstronomyEvents(
  now = new Date(),
  limit = 3,
): AstronomyEvent[] {
  const today = localDateKey(now, "Asia/Shanghai");
  const upcoming = ASTRONOMY_EVENTS
    .filter((event) => event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.priority - b.priority);
  return (upcoming.length
    ? upcoming
    : [...ASTRONOMY_EVENTS].sort((a, b) => b.date.localeCompare(a.date)))
    .slice(0, Math.max(1, limit));
}
