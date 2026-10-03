// Forecast times and observation nights in the workspace use China time.
// Format display labels consistently without changing the original ISO source.
const sourceTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatSourceUpdateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return sourceTimeFormatter.format(date);
}
