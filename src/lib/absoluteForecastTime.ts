import type { HourWeather } from "./types";
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  let value = formatters.get(timeZone);
  if (!value) {
    value = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    if (formatters.size >= 32) formatters.delete(formatters.keys().next().value!);
    formatters.set(timeZone, value);
  }
  return value;
}
/** Official hourly unixtime is a UTC epoch. Offsets are display facts, never added to it. */
export function normalizeEpochHours(epochs: number[], timeZone: string): HourWeather[] {
  if (!epochs.length || epochs.some((epoch, index) => !Number.isSafeInteger(epoch) || Math.abs(epoch) > 8640000000000 || (index > 0 && epoch <= epochs[index - 1]))) throw new Error("天气上游返回了重复或无效绝对时间轴");
  const fmt = formatter(timeZone);
  return epochs.map(epochSeconds => {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(epochSeconds * 1000)).map(part => [part.type, part.value]));
    const time = parts.year + "-" + parts.month + "-" + parts.day + "T" + parts.hour + ":" + parts.minute;
    const utcOffsetSeconds = (Date.parse(time + ":" + parts.second + "Z") - epochSeconds * 1000) / 1000;
    return { time, epochSeconds, utcOffsetSeconds };
  });
}
export function validAbsoluteHours(hours: HourWeather[], timeZone?: string): boolean {
  if (timeZone) {
    try {
      const canonical = normalizeEpochHours(hours.map(hour => hour.epochSeconds!), timeZone);
      if (canonical.some((clock, index) => clock.time !== hours[index].time || clock.utcOffsetSeconds !== hours[index].utcOffsetSeconds)) return false;
    } catch { return false; }
  }
  return hours.length > 0 && hours.every((hour, index) => Number.isSafeInteger(hour?.epochSeconds) &&
    (index === 0 || hour.epochSeconds! > hours[index - 1].epochSeconds!));
}
export function hourInstantMs(hour: HourWeather, legacyOffsetSeconds = 0): number {
  return hour.epochSeconds !== undefined ? hour.epochSeconds * 1000 : Date.parse(hour.time + (hour.time.length === 16 ? ":00Z" : "Z")) - legacyOffsetSeconds * 1000;
}
/** Legacy wall-clock URLs choose first occurrence; an epoch selects the exact repeat; gaps stay missing. */
export function resolveWallHour(hours: HourWeather[], time: string, epochSeconds?: number | null): HourWeather | null {
  return hours.find(hour => hour.time === time && (epochSeconds == null || hour.epochSeconds === epochSeconds)) ?? null;
}
