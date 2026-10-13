import { test as base } from "@playwright/test";
import { readFileSync } from "node:fs";
import { installNextApiMock, installOpenMeteoMock, installGeocodingMock } from "./mock-open-meteo.js";

export * from "@playwright/test";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"));
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const isLocal = (url: URL) => ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);

// Page-specific routes in each test take precedence over these context routes.
// The default fixtures cover normal navigation; omitted APIs never reach Next.
export const test = process.env.E2E_OFFLINE === "1" ? base.extend<{ offlineGuard: void }>({
  offlineGuard: [async ({ context }, use, info) => {
    const activity: Record<string, number> = {};
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (isLocal(url)) return route.fallback();
      const image = route.request().resourceType() === "image";
      const key = `${image ? "synthetic-image" : "blocked"}:${url.hostname}`;
      activity[key] = (activity[key] ?? 0) + 1;
      if (image) return route.fulfill({ status: 200, contentType: "image/png", body: pixel });
      return route.abort("blockedbyclient");
    });
    await context.routeWebSocket(/.*/, (socket) => {
      if (isLocal(new URL(socket.url()))) socket.connectToServer();
      else socket.close({ code: 1008, reason: "offline E2E" });
    });
    await installNextApiMock(context, fixture);
    await installOpenMeteoMock(context, fixture);
    await installGeocodingMock(context);
    // Curated search is implemented by the local Next route, not the browser.
    // Let that route run under the server egress guard instead of replacing its
    // catalogue lookup with the generic empty geocoding fixture. Page mocks win.
    await context.route("**/api/geocode?**", (route) => {
      if (isLocal(new URL(route.request().url()))) return route.continue();
      return route.abort("blockedbyclient");
    });
    await use();
    await info.attach("offline-network", { body: JSON.stringify(activity), contentType: "application/json" });
  }, { auto: true }],
}) : base;
