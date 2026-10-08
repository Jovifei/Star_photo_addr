import { writeFile } from "node:fs/promises";
const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, "").split("=")));
if (!args.base || !("cache-only" in args)) throw new Error("Require --base=URL --cache-only; this evidence runner never calls suppliers.");
const base = new URL(args.base);
const date = args.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
const points = [
  ["Shanghai", 31.2304, 121.4737], ["Niubeishan-observing", 29.782, 102.582],
  ["Niubeishan-cloudsea", 29.742, 102.325], ["Los-Angeles", 34.0522, -118.2437],
  ["Kathmandu", 27.7172, 85.324],
];
const evidence = { mode: "CACHE_ONLY", collectedAt: new Date().toISOString(), base: base.origin, date, rows: [] };
for (const model of ["icon", "gfs", "aifs", "best_match"]) {
  for (const [name, latitude, longitude] of points) {
    const url = new URL("/api/forecast", base);
    url.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), model, days: "3", cache_only: "1" }).toString();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      const body = await response.json();
      const point = body.locations?.[0];
      evidence.rows.push({ product: "tonight/sites", name, model, status: response.ok ? "READ" : "NOT_RUN",
        http: response.status, stale: point?.metadata?.stale ?? null, sourceFetchedAt: point?.metadata?.sourceFetchedAt ?? null,
        requestedLatitude: point?.requestedLatitude ?? null, requestedLongitude: point?.requestedLongitude ?? null,
        epochVersion: point?.metadata?.timeAxisVersion ?? null,
        hours: point?.hourly?.length ?? 0, visibilityCount: point?.hourly?.filter(hour => Number.isFinite(hour.visibility)).length ?? 0,
        reason: body.error ?? null });
    } catch (error) { evidence.rows.push({ name, model, status: "NOT_RUN", reason: String(error) }); }
  }
  for (const product of ["fireglow", "cloudsea"]) {
    const url = new URL("/api/" + product + "/snapshot", base);
    url.search = new URLSearchParams({ date, model, cache_only: "1" }).toString();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      const body = await response.json();
      evidence.rows.push({ product, model, status: response.ok ? "READ" : "NOT_RUN", http: response.status,
        stale: body.stale ?? null, generatedAt: body.generatedAt ?? null, provenance: body.provenance ?? null,
        servedAt: body.transport?.servedAt ?? null, reason: body.error ?? null });
    } catch (error) { evidence.rows.push({ product, model, status: "NOT_RUN", reason: String(error) }); }
  }
}
if (args.output) await writeFile(args.output, JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify(evidence, null, 2));
// Reading real cached facts is evidence collection, never a scientific-accuracy verdict.
