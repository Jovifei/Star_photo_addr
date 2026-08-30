import { expect, test } from "@playwright/test";

function buildForecastResponse(requestUrl: string) {
  const url = new URL(requestUrl);
  const latitude = Number(url.searchParams.get("latitude") ?? 0);
  const longitude = Number(url.searchParams.get("longitude") ?? 0);
  const model = url.searchParams.get("model") ?? "icon";
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const start = Date.parse(`${date}T00:00:00Z`);
  const fetchedAt = new Date().toISOString();
  const hourly = Array.from({ length: 48 }, (_, index) => ({
    time: new Date(start + index * 3_600_000).toISOString().slice(0, 16),
    temperature: 12 + (index % 8),
    humidity: 62,
    dewPoint: 8,
    precipitationProbability: 0,
    precipitation: 0,
    weatherCode: 0,
    cloudCover: 18,
    cloudLow: 10,
    cloudMid: 8,
    cloudHigh: 12,
    visibility: 25_000,
    windSpeed: 2,
    windGust: 4,
  }));

  return {
    locations: [
      {
        locationId: `e2e-${latitude.toFixed(5)}-${longitude.toFixed(5)}`,
        modelLatitude: latitude,
        modelLongitude: longitude,
        modelElevation: 0,
        timezone: "Asia/Shanghai",
        utcOffsetSeconds: 28_800,
        fetchedAt,
        metadata: {
          source: "E2E",
          model,
          fetchedAt,
          stale: false,
          units: {
            cloudCover: "%",
            precipitation: "mm",
            windSpeed: "m/s",
            windDirection: "°",
          },
        },
        hourly,
      },
    ],
  };
}

test("sites compatibility route preserves context and opens the dark-sky site panel", async ({
  page,
  request,
}) => {
  const response = await request.get(
    "/sites?lat=30.1234&lng=120.5678&name=%E4%B8%9C%E7%99%BD%E5%B1%B1&" +
      "elevation=1188&model=gfs&overlay=forecast-cloud",
    { maxRedirects: 0 },
  );

  expect([307, 308]).toContain(response.status());
  const location = response.headers().location;
  expect(location).toBeTruthy();

  const target = new URL(location!, "http://127.0.0.1:3100");
  expect(target.pathname).toBe("/");
  expect(target.searchParams.get("lat")).toBe("30.1234");
  expect(target.searchParams.get("lng")).toBe("120.5678");
  expect(target.searchParams.get("name")).toBe("东白山");
  expect(target.searchParams.get("elevation")).toBe("1188");
  expect(target.searchParams.get("model")).toBe("gfs");
  expect(target.searchParams.get("overlay")).toBe("forecast-cloud");
  expect(target.searchParams.get("view")).toBe("light-pollution");
  expect(target.searchParams.get("panel")).toBe("sites");

  await page.goto("/?view=light-pollution&panel=sites");
  await expect(page.getByTestId("workspace-shell")).toBeVisible();
  await expect(page.locator(".nav-tabs .nav-tab")).toHaveText([
    "今夜观测天气与窗口",
    "暗夜选址长期暗空",
    "火烧云晨晚霞窗口",
    "观星计划附近排行",
  ]);
  await expect(
    page.getByRole("navigation", { name: "页面导航" }).locator("a.nav-tab", { hasText: "暗夜选址" }),
  ).toHaveAttribute("aria-current", "page");
});

test("legacy light-pollution entry points preserve bookmark context", async ({
  request,
}) => {
  for (const path of ["/viirs", "/stargazing-finder-dark"]) {
    const response = await request.get(
      `${path}?lat=29.447&lng=118.579&name=%E5%BC%80%E5%8C%96%E6%9A%97%E5%A4%9C%E7%82%B9&` +
        "elevation=980&model=aifs&overlay=night-lights",
      { maxRedirects: 0 },
    );

    expect([307, 308]).toContain(response.status());
    const location = response.headers().location;
    expect(location).toBeTruthy();
    const target = new URL(location!, "http://127.0.0.1:3100");
    expect(target.pathname).toBe("/");
    expect(target.searchParams.get("lat")).toBe("29.447");
    expect(target.searchParams.get("lng")).toBe("118.579");
    expect(target.searchParams.get("name")).toBe("开化暗夜点");
    expect(target.searchParams.get("elevation")).toBe("980");
    expect(target.searchParams.get("model")).toBe("aifs");
    expect(target.searchParams.get("overlay")).toBe("night-lights");
    expect(target.searchParams.get("view")).toBe("light-pollution");
    expect(target.searchParams.has("panel")).toBe(false);
  }
});

test("historical home links are normalized without re-running the bridge", async ({
  page,
}) => {
  let selectedLocationRequests = 0;
  await page.route("**/api/forecast?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (
      requestUrl.searchParams.get("latitude") === "30.1234" &&
      requestUrl.searchParams.get("longitude") === "120.5678"
    ) {
      selectedLocationRequests += 1;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildForecastResponse(route.request().url())),
    });
  });

  await page.goto(
    "/?lat=30.1234&lng=120.5678&name=%E4%B8%9C%E7%99%BD%E5%B1%B1&" +
      "night=2000-01-01&forecastTime=2000-01-01T22%3A00&model=gfs",
  );

  await expect.poll(() => {
    const target = new URL(page.url());
    return `${target.searchParams.has("night")}|${target.searchParams.has("forecastTime")}`;
  }).toBe("false|false");
  await expect(page.getByTestId("observation-reason-card")).toBeVisible();
  await expect.poll(() => selectedLocationRequests).toBe(1);
});

test("source disclosure keeps the current observation context when opening dark-sky site selection", async ({
  page,
}) => {
  await page.route("**/api/forecast?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildForecastResponse(route.request().url())),
    });
  });

  await page.goto(
    "/?lat=30.1234&lng=120.5678&name=%E4%B8%9C%E7%99%BD%E5%B1%B1&" +
      "elevation=1188&model=gfs&overlay=forecast-cloud",
  );
  await expect(page.getByTestId("observation-reason-card")).toBeVisible();

  await page.getByRole("button", { name: "数据依据与局限" }).click();
  const dialog = page.getByRole("dialog", { name: "数据依据与局限" });
  const recommendationLink = dialog.getByRole("link", {
    name: "暗夜选址",
  });

  await expect.poll(async () => {
    const href = await recommendationLink.getAttribute("href");
    if (!href) return "";
    const target = new URL(href, "http://127.0.0.1:3100");
    return [
      target.pathname,
      target.searchParams.get("lat"),
      target.searchParams.get("lng"),
      target.searchParams.get("name"),
      target.searchParams.get("elevation"),
      target.searchParams.get("model"),
      target.searchParams.get("overlay"),
    ].join("|");
  }).toBe("/sites|30.1234|120.5678|东白山|1188|gfs|forecast-cloud");

  await recommendationLink.click();
  await expect(page).toHaveURL(/panel=sites/);
  const finalUrl = new URL(page.url());
  expect(finalUrl.searchParams.get("lat")).toBe("30.1234");
  expect(finalUrl.searchParams.get("lng")).toBe("120.5678");
  expect(finalUrl.searchParams.get("name")).toBe("东白山");
  expect(finalUrl.searchParams.get("model")).toBe("gfs");
  expect(finalUrl.searchParams.get("view")).toBe("light-pollution");
  await expect(
    page.getByRole("navigation", { name: "页面导航" }).locator("a.nav-tab", { hasText: "暗夜选址" }),
  ).toHaveAttribute("aria-current", "page");
});

test.describe("mobile product header", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("keeps data-source disclosure reachable without crowding the navigation", async ({
    page,
  }) => {
    await page.goto("/");

    const sourceButton = page.getByRole("button", { name: "数据依据与局限" });
    await expect(sourceButton).toBeVisible();
    await expect(sourceButton).toHaveCSS("width", "36px");

    await sourceButton.click();
    await expect(
      page.getByRole("dialog", { name: "数据依据与局限" }),
    ).toBeVisible();
  });
});
