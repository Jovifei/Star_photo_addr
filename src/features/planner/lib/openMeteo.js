// Planner-side adapter. All provider traffic goes through the same-origin
// Next route handlers so the map and planner share cache, timezone, model and
// failure semantics.

export async function fetchSurfaceForecasts(locations, days = 14, signal, model = "best_match") {
  if (!locations.length) return [];
  const params = new URLSearchParams({
    latitude: locations.map((item) => item.latitude).join(","),
    longitude: locations.map((item) => item.longitude).join(","),
    days: String(days),
    model,
  });
  const response = await fetch(`/api/forecast?${params}`, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`天气请求失败 (${response.status})`);
  const data = await response.json();
  return data.locations ?? [];
}

export async function fetchPressureForecast(location, days = 7, signal, model = "best_match") {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    days: String(days),
    model,
  });
  const response = await fetch(`/api/pressure-forecast?${params}`, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`气压请求失败 (${response.status})`);
  return response.json();
}
