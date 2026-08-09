"use client";

import { useMemo, type CSSProperties } from "react";
import type { HourEvaluation, HourWeather } from "@/lib/types";
import { NIGHT_END, NIGHT_START } from "@/lib/constants";
import { formatHour, formatHourWithDate } from "@/lib/nighttime";

type MatrixHour = HourWeather &
  Partial<Pick<HourEvaluation, "moonAltitude" | "moonIllumination" | "score">>;

interface HourlyForecastMatrixProps {
  nightKey: string;
  hours: MatrixHour[];
  selectedTime?: string | null;
  onSelectTime: (time: string) => void;
  title?: string;
  loading?: boolean;
  className?: string;
}

const ROWS = [
  { key: "weather", label: "天气", unit: "" },
  { key: "cloudCover", label: "总云量", unit: "%", tone: "cloud" },
  { key: "cloudHigh", label: "高云", unit: "%", tone: "cloud" },
  { key: "cloudMid", label: "中云", unit: "%", tone: "cloud" },
  { key: "cloudLow", label: "低云", unit: "%", tone: "cloud" },
  { key: "temperature", label: "气温", unit: "°C", tone: "temperature" },
  { key: "dewPoint", label: "露点", unit: "°C", tone: "temperature" },
  { key: "precipitation", label: "降水", unit: "mm", tone: "precipitation" },
  { key: "visibility", label: "能见度", unit: "km" },
  { key: "windSpeed", label: "风速", unit: "m/s" },
  { key: "windDirection", label: "风向", unit: "°" },
  { key: "moon", label: "月亮高度/照明率", unit: "" },
] as const;

function buildNightTimes(nightKey: string): string[] {
  const [year, month, day] = nightKey.split("-").map(Number);
  return Array.from({ length: 10 }, (_, index) => {
    const hour = (NIGHT_START + index) % 24;
    const offset = hour <= NIGHT_END ? 1 : 0;
    const date = new Date(Date.UTC(year, month - 1, day + offset));
    return `${date.toISOString().slice(0, 10)}T${String(hour).padStart(2, "0")}:00`;
  });
}

function displayNumber(value: number | null | undefined, digits = 0): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function weatherGlyph(code: number | null | undefined): string {
  if (typeof code !== "number") return "—";
  if (code >= 95) return "⛈";
  if (code >= 80) return "🌦";
  if (code >= 61) return "🌧";
  if (code >= 45) return "☁";
  if (code >= 1) return "🌤";
  return "☀";
}

function valueFor(row: (typeof ROWS)[number], hour: MatrixHour): string {
  if (row.key === "weather") return weatherGlyph(hour.weatherCode);
  if (row.key === "moon") {
    if (hour.moonAltitude == null && hour.moonIllumination == null) return "—";
    const altitude = displayNumber(hour.moonAltitude, 0);
    const illumination = displayNumber(
      hour.moonIllumination == null ? null : hour.moonIllumination * 100,
      0,
    );
    return `${altitude}° / ${illumination}%`;
  }
  const value = hour[row.key as keyof HourWeather];
  const digits = row.key === "precipitation" || row.key === "windSpeed" ? 1 : 0;
  if (row.key === "visibility" && typeof value === "number") return displayNumber(value / 1000, 1);
  return displayNumber(value as number | null | undefined, digits);
}

function numericValue(row: (typeof ROWS)[number], hour: MatrixHour): number | null {
  if (row.key === "moon" || row.key === "weather") return null;
  const value = hour[row.key as keyof HourWeather];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (row.key === "visibility") return Math.min(100, value / 1000);
  if (row.key === "temperature" || row.key === "dewPoint") return Math.max(0, Math.min(100, (value + 10) * 2.5));
  if (row.key === "precipitation") return Math.min(100, value * 35);
  return Math.max(0, Math.min(100, value));
}

export default function HourlyForecastMatrix({
  nightKey,
  hours,
  selectedTime,
  onSelectTime,
  title = "单夜小时预报",
  loading = false,
  className = "",
}: HourlyForecastMatrixProps) {
  const times = useMemo(() => buildNightTimes(nightKey), [nightKey]);
  const hourMap = useMemo(() => new Map(hours.map((hour) => [hour.time, hour])), [hours]);
  const columns = times.map((time) => ({ time, hour: hourMap.get(time) ?? { time } }));
  const selectedIndex = Math.max(0, times.indexOf(selectedTime ?? ""));

  const selectByIndex = (index: number) => {
    const next = times[(index + times.length) % times.length];
    if (next) onSelectTime(next);
  };

  return (
    <section className={`hourly-matrix ${className}`} aria-label={`${title}：${nightKey}`}>
      <div className="hourly-matrix-head">
        <div>
          <span className="section-kicker">逐小时数据</span>
          <h3>{title}</h3>
        </div>
        {loading && <span className="hourly-matrix-status" role="status">数据加载中…</span>}
      </div>
      <div className="hourly-matrix-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">指标</th>
              {columns.map(({ time }, index) => (
                <th key={time} scope="col" className={index === selectedIndex ? "selected" : ""}>
                  <button
                    type="button"
                    className="hourly-matrix-time"
                    aria-label={`选择 ${formatHourWithDate(time, nightKey)}`}
                    aria-pressed={time === selectedTime}
                    onClick={() => onSelectTime(time)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowLeft") { event.preventDefault(); selectByIndex(index - 1); }
                      if (event.key === "ArrowRight") { event.preventDefault(); selectByIndex(index + 1); }
                    }}
                  >
                    <span>{formatHour(time)}</span>
                    <small>{time.slice(0, 10) === nightKey ? "当晚" : "次日"}</small>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}<small>{row.unit}</small></th>
                {columns.map(({ time, hour }, index) => {
                  const value = valueFor(row, hour);
                  const numeric = numericValue(row, hour);
                  return (
                    <td key={`${row.key}-${time}`} className={`${"tone" in row ? row.tone : ""} ${index === selectedIndex ? "selected" : ""}`} style={numeric == null ? undefined : { "--matrix-value": `${numeric}%` } as CSSProperties}>
                      <button
                        type="button"
                        aria-label={`${row.label} ${formatHour(time)} ${value}`}
                        aria-pressed={time === selectedTime}
                        onClick={() => onSelectTime(time)}
                        onKeyDown={(event) => {
                          if (event.key === "ArrowLeft") { event.preventDefault(); selectByIndex(index - 1); }
                          if (event.key === "ArrowRight") { event.preventDefault(); selectByIndex(index + 1); }
                        }}
                      >{row.key === "windDirection" && value !== "—" ? `↗ ${value}` : value}</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="hourly-matrix-legend" aria-label="矩阵色阶图例">
        <span><i className="legend-swatch cloud" />云量 0–100%</span>
        <span><i className="legend-swatch temperature" />温度</span>
        <span><i className="legend-swatch precipitation" />降水量</span>
        <span>选中：{selectedTime ? formatHourWithDate(selectedTime, nightKey) : "—"}</span>
      </div>
    </section>
  );
}

export { buildNightTimes };
