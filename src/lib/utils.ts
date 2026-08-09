import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface PlannerLinkTarget {
  latitude: number;
  longitude: number;
  name?: string;
  elevation?: number;
  night?: string;
  model?: "icon" | "gfs" | "aifs";
  forecastTime?: string | null;
  observationTime?: string | null;
  overlayMode?: "satellite-cloud" | "forecast-cloud" | "night-lights";
}

/**
 * Build a /planner URL carrying a location (and optional night) using the
 * shared lat/lng/name/elevation/night protocol. The planner reads these on
 * mount and auto-adds the point to its tracked list — this is the "候选到
 * 星野决策跟踪" bridge.
 */
export function buildPlannerHref(target: PlannerLinkTarget): string {
  const params = new URLSearchParams();
  params.set("lat", String(target.latitude));
  params.set("lng", String(target.longitude));
  if (target.name) params.set("name", target.name);
  if (target.elevation != null) params.set("elevation", String(target.elevation));
  if (target.night) params.set("night", target.night);
  if (target.model) params.set("model", target.model);
  if (target.forecastTime) params.set("forecastTime", target.forecastTime);
  if (target.observationTime) params.set("observationTime", target.observationTime);
  if (target.overlayMode) params.set("overlay", target.overlayMode);
  return `/planner?${params.toString()}`;
}
