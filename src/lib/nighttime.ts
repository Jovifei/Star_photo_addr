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

/** "8月12日" style label for a night key, in the given timezone. */
export function formatNightLabel(dateKey: string, compact = false): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: compact ? "numeric" : "long",
    day: "numeric",
    weekday: compact ? undefined : "short",
  }).format(date);
}

/** "HH:mm" from a local hourly time string. */
export function formatHour(timeString: string): string {
  return timeString.slice(11, 16);
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
