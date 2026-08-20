// Planner-side adapter. All provider traffic goes through the same-origin
// Next route handlers so the map and planner share timezone, model, validation
// and stale-fallback semantics. Planner reads are explicit refresh operations;
// the route still coalesces identical work and applies its public cooldown.

let latestSurfaceRequest = null;

async function responseError(response, fallback) {
  const body = await response.json().catch(() => null);
  return new Error(body?.error ?? `${fallback} (${response.status})`);
}

function linkedController(signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", abort, { once: true });
  }
  return {
    controller,
    cleanup: () => signal?.removeEventListener("abort", abort),
  };
}

async function requestSurfaceForecasts(
  locations,
  days,
  signal,
  model,
) {
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

export async function fetchSurfaceForecasts(
  locations,
  days = 14,
  signal,
  model = "best_match",
) {
  if (!locations.length) return [];

  latestSurfaceRequest?.controller.abort();
  const { controller, cleanup } = linkedController(signal);
  const entry = {
    controller,
    promise: requestSurfaceForecasts(
      locations,
      days,
      controller.signal,
      model,
    ),
  };
  latestSurfaceRequest = entry;

  try {
    return await entry.promise;
  } catch (error) {
    // A model/location change superseded this request. Resolve the older
    // caller with the newest result so it cannot overwrite fresh state or show
    // a misleading timeout banner after the replacement request succeeds.
    if (latestSurfaceRequest !== entry) {
      return latestSurfaceRequest.promise;
    }
    throw error;
  } finally {
    cleanup();
  }
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
