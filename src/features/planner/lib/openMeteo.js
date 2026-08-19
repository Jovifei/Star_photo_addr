// Planner-side adapter. All provider traffic goes through the same-origin
// Next route handlers so the map and planner share timezone, model, validation
// and stale-fallback semantics. Planner refreshes are explicit user actions, so
// this adapter bypasses the fresh in-memory value while the route may still
// return a clearly marked stale fallback when the upstream is unavailable.

async function responseError(response, fallback) {
  const body = await response.json().catch(() => null);
  return new Error(body?.error ?? `${fallback} (${response.status})`);
}

export async function fetchSurfaceForecasts(
  locations,
  days = 14,
  signal,
  model = "best_match",
) {
  if (!locations.length) return [];
  const params = new URLSearchParams({
    latitude: locations.map((item) => item.latitude).join(","),
    longitude: locations.map((item) => item.longitude).join(","),
    days: String(days),
    model,
    refresh: "1",
  });
  const response = await fetch(`/api/forecast?${params}`, {
    signal,
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw await responseError(response, "天气请求失败");
  const data = await response.json();
  const forecasts = data.locations ?? [];
  if (forecasts.length !== locations.length) {
    throw new Error(
      `天气响应数量不匹配：请求 ${locations.length} 个地点，收到 ${forecasts.length} 个地点`,
    );
  }
  return forecasts.map((forecast, index) => ({
    ...forecast,
    locationId: locations[index]?.id ?? forecast.locationId,
  }));
}

export async function fetchPressureForecast(
  location,
  days = 7,
  signal,
  model = "best_match",
) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    days: String(days),
    model,
    refresh: "1",
  });
  const response = await fetch(`/api/pressure-forecast?${params}`, {
    signal,
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw await responseError(response, "气压请求失败");
  return response.json();
}
