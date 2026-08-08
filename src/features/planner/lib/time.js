const CHINA_OFFSET = "+08:00";

export function parseProviderTime(value) {
  return new Date(`${value}:00${CHINA_OFFSET}`);
}

export function localDateKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDays(dateKey, count) {
  const date = new Date(`${dateKey}T12:00:00${CHINA_OFFSET}`);
  date.setUTCDate(date.getUTCDate() + count);
  return localDateKey(date);
}

export function nextNightKeys(days, now = new Date()) {
  const today = localDateKey(now);
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  const first = hour >= 7 ? today : addDays(today, -1);
  return Array.from({ length: days }, (_, index) => addDays(first, index));
}

export function isInNight(timeString, nightKey) {
  const next = addDays(nightKey, 1);
  return (
    (timeString.startsWith(nightKey) && Number(timeString.slice(11, 13)) >= 20) ||
    (timeString.startsWith(next) && Number(timeString.slice(11, 13)) <= 5)
  );
}

export function formatNightLabel(dateKey, compact = false) {
  const date = new Date(`${dateKey}T12:00:00${CHINA_OFFSET}`);
  const base = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: compact ? "numeric" : "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
  if (compact) {
    const [, month, day] = dateKey.split("-").map(Number);
    const weekday = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      weekday: "short",
    }).format(date);
    return `${month}/${day} ${weekday}夜`;
  }
  return `${base} 夜间（20:00–次日05:00）`;
}

export function formatHour(timeString) {
  return timeString.slice(11, 16);
}

export function relativeFreshness(isoString) {
  if (!isoString) return "尚未更新";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(isoString).getTime()) / 60000));
  if (minutes < 1) return "刚刚更新";
  if (minutes < 60) return `${minutes} 分钟前更新`;
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时前更新`;
}
