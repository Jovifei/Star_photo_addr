import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, it } from "vitest";
it("the actual CI supplier smoke stops on 429 without retrying or probing the next forecast model", async () => {
  let calls = 0;
  const server = createServer((_request, response) => {
    calls += 1; response.writeHead(429, { "Retry-After": "600" }); response.end("rate limited fixture");
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test address");
    let failure: unknown;
    try {
      await promisify(execFile)(process.execPath, ["scripts/live-smoke.mjs"], {
        cwd: process.cwd(), env: { ...process.env, OPEN_METEO_FORECAST_URL: "http://127.0.0.1:" + address.port + "/forecast" },
      });
    } catch (error) { failure = error; }
    expect(String(failure)).toContain("Retry-After=600");
    expect(calls).toBe(1);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
