"use client";

import { CircleMarker, Tooltip } from "react-leaflet";
import { useStore } from "@/lib/store";
import { isInNight } from "@/lib/nighttime";

function cloudColor(value?: number): string {
  if (value == null) return "#91a4ab";
  if (value < 20) return "#79cfe2";
  if (value < 50) return "#d4b273";
  if (value < 80) return "#fc5a49";
  return "#cb7768";
}

const VARIABLE_LABEL: Record<string, string> = {
  total: "总云",
  low: "低云",
  mid: "中云",
  high: "高云",
};

/**
 * Simplified cloud indicator (Phase 1). Renders a marker at the selected
 * location coloured by the chosen cloud variable at the chosen time index.
 * The real `.om` raster rendering is reserved behind `renderCloudModel`.
 */
export default function CloudLayer() {
  const { state } = useStore();
  const { cloudState, selectedLocation, forecast, selectedNight } = state;
  if (!cloudState.enabled || !selectedLocation || !forecast) return null;

  const nightHours = forecast.hourly.filter((hour) =>
    isInNight(hour.time, selectedNight),
  );
  const hour =
    nightHours[Math.min(cloudState.timeIndex, Math.max(0, nightHours.length - 1))] ??
    nightHours[0];
  if (!hour) return null;

  const variable = cloudState.variable;
  const value =
    variable === "low"
      ? hour.cloudLow
      : variable === "mid"
        ? hour.cloudMid
        : variable === "high"
          ? hour.cloudHigh
          : hour.cloudCover;

  return (
    <CircleMarker
      center={[selectedLocation.latitude, selectedLocation.longitude]}
      radius={16}
      pathOptions={{
        color: cloudColor(value),
        fillColor: cloudColor(value),
        fillOpacity: 0.4,
        weight: 2,
      }}
    >
      <Tooltip direction="top">
        {VARIABLE_LABEL[variable]} {Math.round(value ?? 0)}%
      </Tooltip>
    </CircleMarker>
  );
}

/**
 * Reserved interface for the future Open-Meteo `.om` raster decoding
 * (Phase 2). Replacing its body with real tile decoding must not change the
 * CloudControl UI. Returns null until implemented.
 */
export function renderCloudModel(
  _model: string,
  _variable: string,
  _time: number,
): null {
  return null;
}
