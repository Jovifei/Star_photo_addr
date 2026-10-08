// Input qualification only: never a forecast accuracy or physical-device verdict.
const MAX_AGE = 6 * 60 * 60_000;
const MODELS = ["icon", "gfs", "aifs", "best_match"];
const sameCoordinate = (actual, expected) => typeof actual === "number" && Number.isFinite(actual) && actual.toFixed(5) === expected.toFixed(5);
const age = (value, now) => {
  if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(value)) return Infinity;
  const instant = Date.parse(value);
  return Number.isFinite(instant) && instant <= now + 300_000 ? Math.max(0, now - instant) : Infinity;
};
function clockMatches(hour, timezone) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(hour.epochSeconds * 1000)).map(part => [part.type, part.value]));
    const time = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
    return time === hour.time && (Date.parse(`${time}:${parts.second}Z`) - hour.epochSeconds * 1000) / 1000 === hour.utcOffsetSeconds;
  } catch { return false; }
}
function axisIssues(hours, timezone, version) {
  if (version !== "epoch-v1" || !Array.isArray(hours) || !hours.length || typeof timezone !== "string" || !timezone) return ["missing-absolute-axis"];
  return hours.every((hour, index) => Number.isSafeInteger(hour?.epochSeconds) && (index === 0 || hour.epochSeconds > hours[index - 1].epochSeconds) && clockMatches(hour, timezone)) ? [] : ["invalid-absolute-axis"];
}
const range = (value, min, max = Infinity) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const required = {
  cloudCover: [0, 100], cloudLow: [0, 100], cloudMid: [0, 100], cloudHigh: [0, 100],
  temperature: [-100, 70], humidity: [0, 100], dewPoint: [-120, 70],
  precipitationProbability: [0, 100], precipitation: [0, Infinity], windSpeed: [0, Infinity],
  windGust: [0, Infinity], visibility: [0, Infinity], weatherCode: [0, 99],
};
const outcome = (issues, complete, facts) => ({
  status: issues.length ? "INVALID_INPUT" : complete ? "QUALIFIED_INPUT" : "PARTIAL_INPUT",
  issues, ...facts, scientificAccuracy: "NOT_RUN", physicalDevice: "NOT_RUN", screenReader: "NOT_RUN",
});
export function qualifySurface(body, expected, now = Date.now()) {
  const point = body?.locations?.[0];
  if (!point || body.locations.length !== 1) return outcome(["coordinate-count-mismatch"], false, {});
  const metadata = point.metadata;
  const issues = axisIssues(point.hourly, point.timezone, metadata?.timeAxisVersion);
  if (metadata?.model !== expected.model || body.metadata?.model !== expected.model) issues.push("model-mismatch");
  if (!sameCoordinate(point.requestedLatitude, expected.latitude) || !sameCoordinate(point.requestedLongitude, expected.longitude)) issues.push("coordinate-mismatch");
  if (!range(point.modelLatitude, -90, 90) || !range(point.modelLongitude, -180, 180)) issues.push("unknown-model-grid");
  if (metadata?.stale !== false || body.metadata?.stale !== false) issues.push("stale-or-unknown");
  if ([metadata?.sourceFetchedAt, metadata?.fetchedAt, point.fetchedAt, body.metadata?.fetchedAt].some(time => age(time, now) > MAX_AGE)) issues.push("source-time-unqualified");
  const hours = Array.isArray(point.hourly) ? point.hourly : [];
  const missing = Object.fromEntries(Object.entries(required).map(([field, limits]) => [field, hours.filter(hour => !range(hour[field], ...limits)).length]).filter(([, count]) => count));
  const completeHours = hours.filter(hour => Object.entries(required).every(([field, limits]) => range(hour[field], ...limits))).length;
  return outcome(issues, completeHours === hours.length && hours.length > 0, {
    hours: hours.length, completeHours, missing, visibilityCount: hours.filter(hour => range(hour.visibility, 0)).length,
    sourceFetchedAt: metadata?.sourceFetchedAt ?? null, timezone: point.timezone ?? null,
    requestedLatitude: point.requestedLatitude ?? null, requestedLongitude: point.requestedLongitude ?? null,
    modelLatitude: point.modelLatitude ?? null, modelLongitude: point.modelLongitude ?? null,
    providerRunAt: metadata?.providerRunAt ?? null, observedAt: metadata?.observedAt ?? null,
  });
}
export function qualifyPressure(body, expected, now = Date.now()) {
  const issues = axisIssues(body?.hourly, body?.timezone, body?.timeAxisVersion);
  if (body?.model !== expected.model) issues.push("model-mismatch");
  if (!sameCoordinate(body?.requestedLatitude, expected.latitude) || !sameCoordinate(body?.requestedLongitude, expected.longitude)) issues.push("coordinate-mismatch");
  if (body?.stale !== false) issues.push("stale-or-unknown");
  if (body?.source !== "Open-Meteo" || age(body?.fetchedAt, now) > MAX_AGE) issues.push("source-time-unqualified");
  if (!range(body?.modelElevation, -500, 10000)) issues.push("unknown-model-elevation");
  const hours = Array.isArray(body?.hourly) ? body.hourly : [];
  const completeHours = hours.filter(hour => {
    const profile = body.profilesByEpoch?.[String(hour.epochSeconds)];
    if (!Array.isArray(profile)) return false;
    const usable = profile.filter(level => range(level.pressure, 1, 1100) && range(level.cloudCover, 0, 100) && range(level.humidity, 0, 100) && range(level.temperature, -150, 80) && range(level.heightMsl, -1000, 60000));
    return new Set(usable.map(level => level.pressure)).size >= 6;
  }).length;
  return outcome(issues, completeHours === hours.length && hours.length > 0, { hours: hours.length, completeHours, sourceFetchedAt: body?.fetchedAt ?? null, timezone: body?.timezone ?? null, providerRunAt: null, observedAt: null });
}
export function qualifyTopic(body, expected, now = Date.now()) {
  const issues = [];
  if (body?.model !== expected.model || body?.date !== expected.date) issues.push("topic-context-mismatch");
  if (body?.stale !== false) issues.push("stale-or-unknown");
  const sites = body?.sites && typeof body.sites === "object" ? Object.entries(body.sites) : [];
  if (!sites.length) issues.push("no-sites");
  const provenance = body?.provenance;
  const datasets = expected.product === "cloudsea" ? ["surface", "pressure"] : ["surface"];
  if (provenance?.version !== 1 || sites.some(([id]) => datasets.some(dataset => !provenance.sourcesBySite?.[id]?.some(source => source.dataset === dataset && source.provider === "Open-Meteo" && source.model === expected.model && age(source.sourceFetchedAt, now) <= MAX_AGE)))) issues.push("source-time-unqualified");
  const windows = sites.flatMap(([, site]) => [site?.morning, site?.evening]);
  const scoredWindows = windows.filter(window => range(window?.score, 0, 100)).length;
  return outcome(issues, windows.length > 0 && scoredWindows === windows.length, { siteCount: sites.length, scoredWindows, windows: windows.length, generatedAt: body?.generatedAt ?? null, servedAt: body?.transport?.servedAt ?? null, provenance: provenance ?? null });
}
export async function collectWeatherEvidence({ base, date, fetcher = fetch, now = Date.now() }) {
  const points = [
    ["Shanghai", 31.2304, 121.4737], ["Niubeishan-observing", 29.782, 102.582],
    ["Niubeishan-cloudsea", 29.742, 102.325], ["Los-Angeles", 34.0522, -118.2437], ["Kathmandu", 27.7172, 85.324],
  ];
  const evidence = { schemaVersion: 2, mode: "CACHE_ONLY", collectedAt: new Date(now).toISOString(), base: new URL(base).origin, date, rows: [], stopped: false, scientificAccuracy: "NOT_RUN", physicalDevice: "NOT_RUN", screenReader: "NOT_RUN" };
  const requests = MODELS.flatMap(model => [
    ...points.flatMap(([name, latitude, longitude]) => ["surface", "pressure"].map(product => ({ product, name, latitude, longitude, model }))),
    ...["fireglow", "cloudsea"].map(product => ({ product, model, date })),
  ]);
  for (const expected of requests) {
    if (evidence.stopped) { evidence.rows.push({ ...expected, status: "NOT_RUN", reason: "cooldown-stop" }); continue; }
    const path = expected.product === "surface" ? "/api/forecast" : expected.product === "pressure" ? "/api/pressure-forecast" : `/api/${expected.product}/snapshot`;
    const url = new URL(path, base);
    const params = { model: expected.model, cache_only: "1", ...(expected.latitude != null ? { latitude: String(expected.latitude), longitude: String(expected.longitude), days: "3" } : { date }) };
    url.search = new URLSearchParams(params).toString();
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(30000), redirect: "error" });
      const retryAfter = response.headers.get("retry-after");
      if (response.status === 429 || retryAfter) evidence.stopped = true;
      const body = await response.json().catch(() => null);
      const qualification = expected.product === "surface" ? qualifySurface : expected.product === "pressure" ? qualifyPressure : qualifyTopic;
      evidence.rows.push({ ...expected, http: response.status, retryAfter, ...(response.ok ? qualification(body, expected, now) : { status: "NOT_RUN", reason: body?.error ?? `HTTP ${response.status}` }) });
    } catch (error) { evidence.rows.push({ ...expected, status: "NOT_RUN", reason: String(error) }); }
  }
  return evidence;
}
