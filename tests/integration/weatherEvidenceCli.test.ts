import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, it } from "vitest";
it("executes the actual cache-only CLI with48 read-only requests and records misses without science/device PASS", async () => {
  const requests: URL[] = [];
  const server = createServer((request, response) => {
    requests.push(new URL(request.url ?? "", "http://localhost"));
    response.writeHead(503, { "Content-Type": "application/json" }); response.end(JSON.stringify({ error: "cache-only-miss" }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); if (!address || typeof address === "string") throw new Error("No test address");
    const { stdout } = await promisify(execFile)(process.execPath, ["scripts/acceptance-weather-matrix.mjs", `--base=http://127.0.0.1:${address.port}`, "--cache-only", "--date=2026-10-08"]);
    const evidence = JSON.parse(stdout);
    expect(requests).toHaveLength(48);
    expect(requests.every(url => url.searchParams.get("cache_only") === "1" && !url.searchParams.has("refresh"))).toBe(true);
    expect(evidence.rows.every((row: { status: string }) => row.status === "NOT_RUN")).toBe(true);
    expect(evidence.scientificAccuracy).toBe("NOT_RUN"); expect(evidence.physicalDevice).toBe("NOT_RUN");
    expect(evidence.rows.filter((row: { product: string }) => row.product === "pressure")).toHaveLength(20);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
