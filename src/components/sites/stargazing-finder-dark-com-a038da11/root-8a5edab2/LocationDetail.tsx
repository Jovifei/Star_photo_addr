"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Cloud, GripHorizontal, MapPin, Mountain, MoveVertical, Wind, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { evaluateFinderLocation, ratingColor, ratingLabel } from "@/lib/stargazingFinder";
import type { FinderLocation, FinderMode, FinderWeatherRecord } from "@/lib/stargazingFinderTypes";
import { formatFinderDate } from "./finderData";
import styles from "./stargazing-finder.module.css";

interface LocationDetailProps {
  date: string;
  location: FinderLocation | null;
  mode: FinderMode;
  record: FinderWeatherRecord | undefined;
  onClose: () => void;
}

type ChartValue = number | null;

function display(value: number | null | undefined, suffix = ""): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

function buildPath(values: ChartValue[], maxValue: number, width: number, height: number): string {
  const points = values.flatMap((value, index) => value === null ? [] : [[
    values.length <= 1 ? 0 : (index / (values.length - 1)) * width,
    height - (Math.max(0, Math.min(maxValue, value)) / maxValue) * height,
  ]]);
  return points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

function FinderChart({ record }: { record: FinderWeatherRecord | undefined }) {
  const hourly = record?.hourly;
  if (!hourly || hourly.time.length === 0) return <div className={styles.chartEmpty}>暂无逐小时天气数据，当前地点将保留空值。</div>;
  const width = 720;
  const height = 150;
  const cloud = hourly.cloud_cover;
  const wind = hourly.wind_speed_10m;
  const precipitation = hourly.precipitation;
  return (
    <div className={styles.chartWrap}>
      <svg className={styles.weatherChart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="33小时云量和风速趋势图">
        <line x1="0" y1={height * 0.2} x2={width} y2={height * 0.2} className={styles.chartGrid} />
        <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} className={styles.chartGrid} />
        <line x1="0" y1={height * 0.8} x2={width} y2={height * 0.8} className={styles.chartGrid} />
        <path d={buildPath(cloud, 100, width, height)} className={styles.cloudPath} />
        <path d={buildPath(wind, 20, width, height)} className={styles.windPath} />
        {precipitation.map((value, index) => value === null || value <= 0 ? null : <circle key={index} cx={(index / Math.max(1, precipitation.length - 1)) * width} cy={height - Math.min(1, value / 5) * height} r="3" className={styles.rainPoint} />)}
      </svg>
      <div className={styles.chartLegend}>
        <span><i className={styles.cloudLegend} /> 云量 (%)</span>
        <span><i className={styles.windLegend} /> 风速 (m/s)</span>
        <span><i className={styles.rainLegend} /> 降水 (&gt;0)</span>
        <small>黄色线=风速 · 蓝色线=云量 · 红点=降水</small>
      </div>
    </div>
  );
}

export default function LocationDetail({ date, location, mode, record, onClose }: LocationDetailProps) {
  const [height, setHeight] = useState(520);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const evaluation = useMemo(() => location ? evaluateFinderLocation(location, record, date, mode) : null, [date, location, mode, record]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragRef.current) return;
      const next = dragRef.current.startHeight + dragRef.current.startY - event.clientY;
      setHeight(Math.max(360, Math.min(Math.round(window.innerHeight * 0.78), next)));
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, []);

  if (!location || !evaluation) return null;
  const hourly = record?.hourly;
  const labels = hourly?.time ?? [];
  const rows = [
    { label: "天气", unit: "WMO", values: hourly?.weather_code ?? [], format: (value: number | null) => value === null ? "—" : `${value} ${evaluation.analysis?.nightHours.find((hour) => hour.code === value)?.type ?? ""}` },
    { label: "总云量", unit: "%", values: hourly?.cloud_cover ?? [], format: (value: number | null) => display(value, "%") },
    { label: "低云", unit: "%", values: hourly?.cloud_cover_low ?? [], format: (value: number | null) => display(value, "%") },
    { label: "中云", unit: "%", values: hourly?.cloud_cover_mid ?? [], format: (value: number | null) => display(value, "%") },
    { label: "高云", unit: "%", values: hourly?.cloud_cover_high ?? [], format: (value: number | null) => display(value, "%") },
    { label: "降水", unit: "mm", values: hourly?.precipitation ?? [], format: (value: number | null) => display(value, " mm") },
    { label: "能见度", unit: "km", values: (hourly?.visibility ?? []).map((value) => value === null ? null : value / 1000), format: (value: number | null) => display(value, " km") },
    { label: "风速", unit: "m/s", values: hourly?.wind_speed_10m ?? [], format: (value: number | null) => display(value, " m/s") },
    { label: "温度", unit: "°C", values: hourly?.temperature_2m ?? [], format: (value: number | null) => display(value, "°C") },
  ];

  return (
    <section className={styles.detailPanel} style={{ height: `${height}px` }} role="dialog" aria-label={`${location.name}地点详情`}>
      <button
        type="button"
        className={styles.detailResizeHandle}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { startY: event.clientY, startHeight: height }; }}
        aria-label="上下拖动调整地点详情高度"
        title="拖动调整详情高度"
      >
        <GripHorizontal size={19} aria-hidden="true" /><MoveVertical size={14} aria-hidden="true" />
      </button>
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.detailEyebrow}><MapPin size={13} aria-hidden="true" /> 地点详情 · {formatFinderDate(date)} 夜间（19:00–次日04:00）</p>
          <h2>{location.name}</h2>
          <p className={styles.detailMeta}><span>{location.province} · {location.area}</span><span>{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</span><span>{location.elevation === null ? "海拔 —" : `海拔 ${location.elevation}m`}</span></p>
        </div>
        <div className={styles.detailActions}>
          <span className={styles.bortleChip}>B{location.bortle}</span>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="关闭地点详情"><X size={18} /></button>
        </div>
      </div>

      <div className={styles.detailBody}>
        <div className={styles.detailColumns}>
          <div className={styles.detailSummary}>
            <div className={styles.detailScore}>
              <div className={styles.scoreRing} style={{ "--score-color": ratingColor(evaluation.rating) } as React.CSSProperties}><strong>{evaluation.score ?? "—"}</strong><span>观星分</span></div>
              <div><span className={styles.detailLabel}>评级</span><strong className={styles.detailWindow} style={{ color: ratingColor(evaluation.rating) }}>{ratingLabel(evaluation.rating)}</strong><small>{evaluation.ratingDetail}</small></div>
            </div>
            <div className={styles.metricGrid}>
              <div><Cloud size={15} aria-hidden="true" /><span>夜间总云量</span><strong>{display(evaluation.analysis?.nightHours[0]?.cloud, "%")}</strong></div>
              <div><Wind size={15} aria-hidden="true" /><span>最大风速</span><strong>{display(evaluation.analysis?.nightMaxWind, " m/s")}</strong></div>
              <div><Mountain size={15} aria-hidden="true" /><span>夜间阵风</span><strong>{display(evaluation.analysis?.nightMaxGust, " m/s")}</strong></div>
              <div><CalendarDays size={15} aria-hidden="true" /><span>数据状态</span><strong>{record?.status === "available" ? "已加载" : record?.status === "stale" ? "陈旧" : "—"}</strong></div>
            </div>
            <div className={styles.detailNotes}>
              {evaluation.windWarning && <p data-level={evaluation.windWarning.level}><Wind size={14} aria-hidden="true" /> {evaluation.windWarning.text}</p>}
              {evaluation.altitudeWarning && <p data-level={evaluation.altitudeWarning.level}><Mountain size={14} aria-hidden="true" /> {evaluation.altitudeWarning.text}</p>}
              {evaluation.hazardWarning && <p data-level="warning">! {evaluation.hazardWarning}</p>}
              {!evaluation.hazardWarning && !evaluation.altitudeWarning && <p className={styles.detailReason}>{location.reason}</p>}
            </div>
            <div className={styles.detailFooter}>
              <span>数据源：Open-Meteo · 地点来源：darkmap.cn / IUCN / 中国绿发会 / VIIRS</span>
              <Link href="/" className={styles.openMainButton}>在逐星中打开 <ArrowRight size={15} /></Link>
            </div>
          </div>

          <div className={styles.detailForecast}>
            <div className={styles.forecastHeading}><div><span className={styles.detailLabel}>天气预报</span><strong>33 小时逐小时数据</strong></div><span className={styles.forecastRange}>07:00 → 次日15:00</span></div>
            <FinderChart record={record} />
            <div className={styles.hourlyTableWrap}>
              <table className={styles.hourlyTable}>
                <thead><tr><th>指标</th>{labels.map((time) => <th key={time}>{time.slice(5, 10)}<br />{time.slice(11, 16)}</th>)}</tr></thead>
                <tbody>{rows.map((row) => <tr key={row.label}><th>{row.label}<small>{row.unit}</small></th>{row.values.map((value, index) => <td key={`${row.label}-${index}`}>{row.format(value)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
