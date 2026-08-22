"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, MapPin, Radar } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  formatElevationMeters,
  rankNearbySites,
} from "@/lib/locationPresentation";
import {
  recommendationColor,
  recommendationLabel,
} from "@/lib/observingSites";
import { currentNightKey } from "@/lib/nighttime";
import { useStore } from "@/lib/store";
import type { ForecastModel, ObservationSnapshot } from "@/lib/types";

const RADIUS_OPTIONS = [10, 50, 100, 200] as const;

type SnapshotState = {
  key: string;
  status: "ready" | "error";
  snapshot: ObservationSnapshot | null;
};

function parseCoordinate(value: string | null, minimum: number, maximum: number) {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

function plannerHref(
  current: URLSearchParams,
  item: ReturnType<typeof rankNearbySites>[number],
  night: string,
  model: ForecastModel,
): string {
  const params = new URLSearchParams(current.toString());
  params.set("lat", String(item.site.latitude));
  params.set("lng", String(item.site.longitude));
  params.set("name", item.site.name);
  params.set("elevation", String(item.site.altitude ?? 0));
  params.set("night", night);
  params.set("model", model);
  return `/planner?${params.toString()}`;
}

/** Nearby ranking for a user-selected sample point on the planning page. */
export default function NearbySiteRanking() {
  const searchParams = useSearchParams();
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const [radiusKm, setRadiusKm] = useState<(typeof RADIUS_OPTIONS)[number]>(
    100,
  );
  const [snapshotState, setSnapshotState] = useState<SnapshotState>({
    key: "",
    status: "error",
    snapshot: null,
  });

  const queryLatitude = parseCoordinate(searchParams.get("lat"), -90, 90);
  const queryLongitude = parseCoordinate(searchParams.get("lng"), -180, 180);
  const selected = state.selectedLocation;
  const centerLatitude = queryLatitude ?? selected?.latitude ?? null;
  const centerLongitude = queryLongitude ?? selected?.longitude ?? null;
  const center =
    centerLatitude !== null && centerLongitude !== null
      ? { latitude: centerLatitude, longitude: centerLongitude }
      : null;
  const centerName =
    searchParams.get("name")?.trim() || selected?.name || "当前取样点";
  const night = searchParams.get("night") || state.selectedNight || currentNightKey();
  const modelRaw = searchParams.get("model") || state.cloudState.model;
  const model: ForecastModel =
    modelRaw === "gfs" || modelRaw === "aifs" || modelRaw === "best_match"
      ? modelRaw
      : "icon";
  const focusTime =
    searchParams.get("forecastTime") || state.cloudState.activeForecastTime;
  const requestKey = center
    ? `${night}|${model}|${focusTime ?? ""}|${centerLatitude}|${centerLongitude}`
    : "";

  useEffect(() => {
    if (!open || centerLatitude === null || centerLongitude === null) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      date: night,
      days: "1",
      model,
    });
    if (focusTime) params.set("time", focusTime);
    fetch(`/api/observing/snapshot?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) {
          throw new Error(payload?.error ?? "附近地点评分快照不可用");
        }
        return payload as ObservationSnapshot;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setSnapshotState({ key: requestKey, status: "ready", snapshot: payload });
      })
      .catch((error) => {
        if (error?.name === "AbortError" || controller.signal.aborted) return;
        setSnapshotState({ key: requestKey, status: "error", snapshot: null });
      });
    return () => controller.abort();
  }, [
    centerLatitude,
    centerLongitude,
    focusTime,
    model,
    night,
    open,
    requestKey,
  ]);

  const activeSnapshot =
    snapshotState.key === requestKey ? snapshotState.snapshot : null;
  const status = !open || !center
    ? "idle"
    : snapshotState.key === requestKey
      ? snapshotState.status
      : "loading";
  const ranked = useMemo(
    () => (center ? rankNearbySites(center, radiusKm, activeSnapshot, 10) : []),
    [activeSnapshot, center, radiusKm],
  );

  return (
    <aside
      className={`nearby-ranking-panel${open ? " open" : ""}`}
      aria-label="附近观星地点排行"
    >
      <button
        type="button"
        className="nearby-ranking-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="nearby-ranking-body"
      >
        <Radar size={16} aria-hidden="true" />
        <span>附近排行</span>
        {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
      </button>
      {open && (
        <div id="nearby-ranking-body" className="nearby-ranking-body">
          <header>
            <div>
              <small>中心位置</small>
              <strong>{centerName}</strong>
            </div>
            <label>
              半径
              <select
                value={radiusKm}
                onChange={(event) =>
                  setRadiusKm(
                    Number(event.target.value) as (typeof RADIUS_OPTIONS)[number],
                  )
                }
                aria-label="附近地点排行半径"
              >
                {RADIUS_OPTIONS.map((radius) => (
                  <option key={radius} value={radius}>
                    {radius} km
                  </option>
                ))}
              </select>
            </label>
          </header>

          {!center && (
            <p className="nearby-ranking-empty">
              请先从今夜观测选择地点，或在 URL 中提供有效经纬度。
            </p>
          )}
          {center && status === "loading" && (
            <p className="nearby-ranking-empty">正在读取当前夜晚评分…</p>
          )}
          {center && status === "error" && (
            <p className="nearby-ranking-empty">
              评分暂不可用，仍可按距离查看候选地点。
            </p>
          )}
          {center && status !== "loading" && ranked.length === 0 && (
            <p className="nearby-ranking-empty">
              {radiusKm} km 内暂无整理过的观星地点，请扩大范围。
            </p>
          )}

          {ranked.length > 0 && (
            <ol className="nearby-ranking-list">
              {ranked.map((item, index) => {
                const band = item.score?.band ?? "unknown";
                return (
                  <li key={item.site.id}>
                    <Link
                      href={plannerHref(
                        new URLSearchParams(searchParams.toString()),
                        item,
                        night,
                        model,
                      )}
                    >
                      <span className="nearby-rank-index">{index + 1}</span>
                      <span className="nearby-rank-copy">
                        <strong>{item.site.name}</strong>
                        <small>
                          {item.site.province} · {item.site.area || "区域待补充"}
                        </small>
                        <em>
                          {item.distanceKm < 10
                            ? item.distanceKm.toFixed(1)
                            : Math.round(item.distanceKm)}{" "}
                          km · {formatElevationMeters(item.site.altitude)} · B
                          {item.site.bortle}
                        </em>
                      </span>
                      <span
                        className="nearby-rank-score"
                        style={{ color: recommendationColor(band) }}
                      >
                        <b>{item.score?.score ?? "—"}</b>
                        <small>{recommendationLabel(band)}</small>
                      </span>
                      <MapPin size={14} aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="nearby-ranking-note">
            距离为直线距离；实际出行仍需核对道路、景区开放和现场安全。
          </p>
        </div>
      )}
    </aside>
  );
}
