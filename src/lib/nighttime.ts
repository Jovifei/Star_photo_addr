// Night-window helpers (ported from star-weather's time.js, timezone-aware).
//
// Times coming from Open-Meteo (`timezone=auto`) are already expressed in the
// location's LOCAL wall-clock as "YYYY-MM-DDTHH:mm". The observation window is
// faithful to perseids: 20:00 of the evening date → 05:00 the next morning
// (NOT the old 18:00–06:00 window).
//
// To compute astronomy we must recover the true UTC instant behind a local
// wall-clock string. We do that with the location's `utcOffsetSeconds`.

import {
  CHINA_BOUNDS,
  METEOR_SHOWER_NIGHTS,
  NIGHT_END,
  NIGHT_START,
} from "./constants";

/** Parse a local "YYYY-MM-DDTHH:mm" string into the true UTC instant. */
export function parseProviderTime(
  value: string,
  utcOffsetSeconds = 0,
): Date {
  const normalized = value.length === 16 ? `${value}:00` : value;
  const asIfUtc = Date.parse(`${normalized}Z`);
  return new Date(asIfUtc - utcOffsetSeconds * 1000);
}

/** Local date key (en-CA => YYYY-MM-DD) for a given Date in a timezone. */
export function localDateKey(date: Date, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDays(dateKey: string, count: number, timeZone = "UTC"): string {
  const base = new Date(`${dateKey}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + count);
  return localDateKey(base, timeZone);
}

/** The fixed 11 Perseids observation nights (evening-date keys). */
export function meteorShowerNightKeys(): string[] {
  return [...METEOR_SHOWER_NIGHTS];
}

/**
 * Upcoming nights relative to `now`. If it is already past the local 07:00 the
 * first night is "today" (evening), otherwise we start from "yesterday" so the
 * current ongoing night is included. Falls back to the fixed shower window.
 */
export function nextNightKeys(days: number, now = new Date()): string[] {
  const timeZone = "Asia/Shanghai";
  const today = localDateKey(now, timeZone);
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  const first = hour >= 7 ? today : addDays(today, -1, timeZone);
  return Array.from({ length: days }, (_, index) =>
    addDays(first, index, timeZone),
  );
}

/** Whether a local hourly time string belongs to the night of `nightKey`. */
export function isInNight(timeString: string, nightKey: string): boolean {
  const next = addDays(nightKey, 1);
  const hour = Number(timeString.slice(11, 13));
  return (
    (timeString.startsWith(nightKey) && hour >= NIGHT_START) ||
    (timeString.startsWith(next) && hour <= NIGHT_END)
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Human-readable night window, e.g. "20:00–次日05:00". */
const NIGHT_WINDOW_TEXT = `${pad2(NIGHT_START)}:00–次日${pad2(NIGHT_END)}:00`;

/**
 * Night label anchored on the EVENING date (the night of 8/7 runs 8/7 20:00 →
 * 8/8 05:00, and is always keyed by "2026-08-07").
 *
 * - `compact = false` → "8月7日 周三 夜间（20:00–次日05:00）" (full, for tooltips)
 * - `compact = true`  → "8/7 周五夜" (short, with the weekday users plan around)
 *
 * The explicit "夜间（…）" suffix makes the cross-midnight semantics obvious so
 * users never mistake a 01:00 reading for the same calendar day.
 */
export function formatNightLabel(dateKey: string, compact = false): string {
  const [, m, d] = dateKey.split("-");
  const month = Number(m);
  const day = Number(d);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return dateKey; // 兜底
  const weekday = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
  }).format(new Date(`${dateKey}T12:00:00Z`)); // 12:00Z = 上海 20:00，锚定傍晚日
  if (compact) return `${month}/${day} ${weekday}夜`;
  return `${month}月${day}日 ${weekday} 夜间（${NIGHT_WINDOW_TEXT}）`;
}

/**
 * "HH:mm" from a local hourly time string.
 *
 * Kept for backwards compatibility — `scoring.ts` builds `windowLabel` with it
 * (e.g. "20:00–02:00（6h）") and compact UI slots (timeline endpoints) rely on
 * the un-suffixed form. Do NOT change this signature or behaviour; use
 * `formatHourWithDate` when a next-day hint is needed.
 */
export function formatHour(timeString: string): string {
  return timeString.slice(11, 16);
}

/**
 * Hour label with an explicit cross-midnight hint, relative to `nightKey`.
 *
 *   20:00–23:00 → "20:00"
 *   00:00–05:00 → "01:00（次日）"
 *
 * Resolution order:
 *   1. If both the time string's date part and `nightKey` are full "YYYY-MM-DD"
 *      keys, a mismatch means the reading belongs to the morning after.
 *   2. Otherwise fall back to the hour: anything at or before `NIGHT_END` is
 *      treated as next-day.
 */
export function formatHourWithDate(timeString: string, nightKey: string): string {
  const hhmm = timeString.slice(11, 16);
  const datePart = timeString.slice(0, 10);
  const hour = Number(timeString.slice(11, 13));
  const isNextDay =
    datePart.length === 10 && nightKey.length === 10
      ? datePart !== nightKey
      : Number.isFinite(hour) && hour <= NIGHT_END;
  return isNextDay ? `${hhmm}（次日）` : hhmm;
}

export function relativeFreshness(isoString?: string | null): string {
  if (!isoString) return "尚未更新";
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(isoString).getTime()) / 60000),
  );
  if (minutes < 1) return "刚刚更新";
  if (minutes < 60) return `${minutes} 分钟前更新`;
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时前更新`;
}

/** Whether a coordinate falls inside the China VIIRS enhancement bounds. */
export function isInChinaBounds(latitude: number, longitude: number): boolean {
  return (
    longitude >= CHINA_BOUNDS.west &&
    longitude <= CHINA_BOUNDS.east &&
    latitude >= CHINA_BOUNDS.south &&
    latitude <= CHINA_BOUNDS.north
  );
}
