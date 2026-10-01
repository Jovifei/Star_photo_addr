import type { ForecastModel } from "./types";

/** Pure provider horizons, shared by browser and server. */
export const FORECAST_MODEL_MAX_DAYS: Readonly<Record<ForecastModel, number>> = Object.freeze({
  best_match: 16, icon: 8, gfs: 16, aifs: 15,
});

export function maxForecastDaysForModel(model: ForecastModel): number {
  return FORECAST_MODEL_MAX_DAYS[model];
}
