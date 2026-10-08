import { expect, it } from "vitest";
import { cachedForecast, forecastCacheKey } from "@/lib/store";
import type { LocationForecast } from "@/lib/types";
it("same source ID/model cannot reuse weather from contradictory requested coordinates", () => {
  const forecast = { locationId: "same", requestedLatitude: 29.782, requestedLongitude: 102.582,
    metadata: { model: "icon" } } as LocationForecast;
  const cache = new Map([[forecastCacheKey("same", "icon"), forecast]]);
  expect(cachedForecast(cache, "same", "icon", { latitude: 29.742, longitude: 102.325 })).toBeNull();
  expect(cachedForecast(cache, "same", "icon", { latitude: 29.782, longitude: 102.582 })).toBe(forecast);
});
