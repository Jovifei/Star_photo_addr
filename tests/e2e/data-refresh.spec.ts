import { expect, test } from "@playwright/test";
import { openMobileMapPanel } from "./mobile-map-panel.js";

function hourlyTimes(): string[] {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const start = Date.parse(`${date}T00:00:00Z`);
  return Array.from({ length: 72 }, (_, index) =>
    new Date(start + index * 3_600_000).toISOString().slice(0, 16),
  );
}

function forecastPayload(requestUrl: string) {
  const url = new URL(requestUrl);
  const latitudes = (url.searchParams.get("latitude") ?? "30.2741")
    .split(",")
    .map(Number);
  const longitudes = (url.searchParams.get("longitude") ?? "120.1551")
    .split(",")
    .map(Number);
  const model = url.searchParams.get("model") ?? "icon";
  const times = hourlyTimes();
  const fetchedAt = new Date().toISOString();
  const locations = latitudes.map((latitude, index) => ({
    locationId: `e2e-${index}`,
    modelLatitude: latitude,
    modelLongitude: longitudes[index] ?? 120.1551,
    modelElevation: 20,
    timezone: "Asia/Shanghai",
    utcOffsetSeconds: 28_800,
    fetchedAt,
    metadata: {
      source: "E2E",
      model,
      fetchedAt,
      stale: false,
      units: { cloudCover: "%", precipitation: "mm", windSpeed: "m/s" },
    },
    hourly: times.map((time, hourIndex) => ({
      time,
      temperature: 18,
      humidity: 60,
      dewPoint: 10,
      precipitationProbability: 0,
      precipitation: 0,
      weatherCode: 0,
      cloudCover: 10 + (hourIndex % 5),
      cloudLow: 5,
      cloudMid: 8,
      cloudHigh: 12,
      visibility: 25_000,
      windSpeed: 2,
      windGust: 4,
      windDirection: 180,
    })),
  }));
  return { locations, metadata: locations[0]?.metadata };
}

const healthySources = {
  status: "ok",
  checkedAt: new Date().toISOString(),
  cached: false,
  sources: {
    weather: {
      id: "weather",
      label: "天气 / Open-Meteo",
      status: "available",
      detail: "云量字段可用",
      checkedAt: new Date().toISOString(),
    },
    satellite: {
      id: "satellite",
      label: "卫星 / NASA GIBS",
      status: "available",
      detail: "目录可用",
      checkedAt: new Date().toISOString(),
    },
    "light-pollution": {
      id: "light-pollution",
      label: "光污染参考 / VIIRS 2023",
      status: "available",
      detail: "瓦片可用",
      checkedAt: new Date().toISOString(),
    },
    tianditu: {
      id: "tianditu",
      label: "中文注记 / 天地图",
      status: "unconfigured",
      detail: "使用内置注记",
      checkedAt: new Date().toISOString(),
    },
    "local-dark-sky": {
      id: "local-dark-sky",
      label: "Bortle / SQM 本地栅格",
      status: "not-installed",
      detail: "未安装",
      checkedAt: new Date().toISOString(),
    },
  },
};

test("manual refresh bypasses application caches for weather, health and site scores", async ({
  page,
}) => {
  let forcedForecastRequests = 0;
  let forcedHealthRequests = 0;
  let forcedSnapshotRequests = 0;

  await page.route("**/healthz", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        version: "0.3.1",
        buildRevision: "e2e",
      }),
    }),
  );
  await page.route("**/api/data-status**", (route) => {
    if (new URL(route.request().url()).searchParams.get("refresh") === "1") {
      forcedHealthRequests += 1;
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(healthySources),
    });
  });
  await page.route("**/api/forecast?**", (route) => {
    if (new URL(route.request().url()).searchParams.get("refresh") === "1") {
      forcedForecastRequests += 1;
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(forecastPayload(route.request().url())),
    });
  });
  await page.route("**/api/observing/snapshot?**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("refresh") === "1") {
      forcedSnapshotRequests += 1;
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date: url.searchParams.get("date"),
        days: Number(url.searchParams.get("days") ?? 1),
        model: url.searchParams.get("model") ?? "gfs",
        generatedAt: new Date().toISOString(),
        source: "E2E",
        stale: false,
        sites: {},
        focusTime: url.searchParams.get("time") ?? undefined,
        focusScores: {},
      }),
    });
  });
  await page.route("**/api/air-quality?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hourly: [] }),
    }),
  );
  await page.route("**/api/space-weather/kp**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ frames: [] }),
    }),
  );

  await page.goto(
    "/?lat=30.2741&lng=120.1551&name=%E6%9D%AD%E5%B7%9E%E6%B5%8B%E8%AF%95%E7%82%B9&" +
      "model=gfs&view=combined&overlay=forecast-cloud",
  );
  await expect(page.locator(".detail-overlay-host")).toHaveClass(/is-open/);
  await openMobileMapPanel(page, "cloud");
  await expect(page.getByText("天气 / Open-Meteo")).toBeVisible();

  await page
    .getByRole("button", {
      name: "强制刷新天气、卫星目录和数据源状态",
    })
    .click();

  await expect
    .poll(
      () =>
        `${forcedForecastRequests > 0}|${forcedHealthRequests > 0}|${forcedSnapshotRequests > 0}`,
      { timeout: 20_000 },
    )
    .toBe("true|true|true");
});
