// Test-only fetch replacement loaded by the isolated Node subprocess; no network.
const scenario = process.env.RECOVERY_WORKER_SCENARIO;
const requests = [];
globalThis.fetch = async (input) => {
  const url = new URL(input);
  requests.push({ path: url.pathname, model: url.searchParams.get("model"), date: url.searchParams.get("date"), time: url.searchParams.get("time") });
  if ((scenario === "failure" && requests.length === 1) || (scenario === "topic-failure" && requests.length === 2)) {
    return new Response(JSON.stringify({ error: "HTTP 503" }), { status: 503 });
  }
  return new Response(JSON.stringify({
    stale: scenario === "stale", date: url.searchParams.get("date"), model: scenario === "wrong-model" ? "icon" : "gfs",
    sourceFetchedAt: new Date().toISOString(), integrityVersion: "weather-integrity-v2",
  }), { status: 200 });
};
const finish = () => {
  console.log(`RECOVERY_REQUESTS=${JSON.stringify(requests)}`);
  if (process.platform === "win32") {
    process.exit(0);
  }
  process.kill(process.pid, "SIGTERM");
};
// Timers in the worker are genuine; stop after its initial cycle instead of
// waiting hours. The parent subprocess has an independent timeout as well.
setTimeout(finish, 150);
