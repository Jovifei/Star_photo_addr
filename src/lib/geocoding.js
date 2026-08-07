const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

export function normalizeGeocodingResult(result) {
  if (!result || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) return null;
  const context = [result.admin1, result.admin2, result.country].filter(Boolean);
  return {
    id: `search-${result.id ?? `${result.latitude}-${result.longitude}`}`,
    name: result.name || "未命名地点",
    context: context.join(" · "),
    latitude: Number(result.latitude),
    longitude: Number(result.longitude),
    elevation: Number.isFinite(result.elevation) ? Number(result.elevation) : null,
    timezone: result.timezone || "Asia/Shanghai",
    source: "Open-Meteo 地名搜索",
  };
}

export async function searchChinaPlaces(query, signal) {
  const keyword = query.trim();
  if (keyword.length < 2) return [];
  const params = new URLSearchParams({
    name: keyword,
    count: "8",
    language: "zh",
    format: "json",
    countryCode: "CN",
  });
  const response = await fetch(`${GEOCODING_URL}?${params}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`地点搜索返回 ${response.status}`);
  const data = await response.json();
  return (data.results ?? []).map(normalizeGeocodingResult).filter(Boolean);
}
