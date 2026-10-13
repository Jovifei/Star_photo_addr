import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const guard = resolve("scripts/offline-network-guard.cjs");

describe("offline E2E server egress guard", () => {
  it("rejects provider transports before network and still serves loopback", () => {
    const script = `
      import net from "node:net";
      import tls from "node:tls";
      import http from "node:http";
      import https from "node:https";
      const operations = [
        () => net.connect({host: "provider.invalid", port: 443}),
        () => new net.Socket().connect({host: "provider.invalid", port: 443}),
        () => tls.connect({host: "provider.invalid", port: 443}),
        () => http.get("http://provider.invalid/private?token=fixture"),
        () => https.get("https://provider.invalid/private?token=fixture"),
      ];
      for (const operation of operations) {
        try { operation(); throw Error("outbound connection allowed"); }
        catch (error) { if (error.code !== "E2E_OFFLINE_EGRESS") throw error; }
      }
      try { await fetch("https://provider.invalid/private?token=fixture"); throw Error("outbound fetch allowed"); }
      catch (error) { if (error.code !== "E2E_OFFLINE_EGRESS") throw error; }
      const server = http.createServer((_request, response) => response.end("local fixture"));
      await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
      const response = await fetch("http://127.0.0.1:" + server.address().port);
      if (await response.text() !== "local fixture") throw Error("loopback blocked");
      await new Promise(resolve => server.close(resolve));
      console.log("six outbound operations denied; loopback passed");
    `;
    const result = spawnSync(process.execPath, ["--require", guard, "--input-type=module", "-e", script], {
      env: { ...process.env, E2E_OFFLINE: "1", E2E_OFFLINE_AUDIT: "" },
      encoding: "utf8",
      timeout: 15_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("six outbound operations denied; loopback passed");
  });

  it("refuses to preload into a normal runtime", () => {
    const result = spawnSync(process.execPath, ["--require", guard, "-e", ""], {
      env: { ...process.env, E2E_OFFLINE: "", E2E_OFFLINE_AUDIT: "" },
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Offline guard requires E2E_OFFLINE=1");
  });
});
