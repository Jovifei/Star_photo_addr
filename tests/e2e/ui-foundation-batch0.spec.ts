import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  installGeocodingMock,
  installNextApiMock,
  installOpenMeteoMock,
} from "./mock-open-meteo.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"),
);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.name !== "__preserve_ui_batch0_storage__") {
      localStorage.clear();
    }
  });
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
});

test("默认底图不再请求会显示 API KEY REQUIRED 的 CARTO 匿名瓦片", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));
  await page.route(/https:\/\/tile\.openstreetmap\.org\/.*/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.goto("/?overlay=forecast-cloud&view=combined");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect
    .poll(() => requested.some((url) => url.includes("tile.openstreetmap.org")))
    .toBe(true);
  expect(requested.some((url) => url.includes("basemaps.cartocdn.com"))).toBe(false);
});

test("同坐标候选只保留一条且深链点位不会静默新增收藏", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.name = "__preserve_ui_batch0_storage__";
    localStorage.setItem(
      "perseids-custom-candidates-v1",
      JSON.stringify([
        {
          id: "duplicate-a",
          adcode: 0,
          province: "浙江",
          city: "临安",
          name: "同一机位 A",
          longitude: 119.5978,
          latitude: 30.4694,
          elevation: 958.4,
          bortle: 3,
          kind: "自定义",
          note: "",
        },
        {
          id: "duplicate-b",
          adcode: 0,
          province: "浙江",
          city: "临安",
          name: "同一机位 B",
          longitude: 119.5978,
          latitude: 30.4694,
          elevation: 958.4,
          bortle: 3,
          kind: "自定义",
          note: "",
        },
      ]),
    );
  });
  await page.goto(
    "/planner?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4",
  );
  await expect(page.locator(".rank-card")).toHaveCount(1, { timeout: 20000 });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("perseids-custom-candidates-v1");
        return raw ? JSON.parse(raw).length : 0;
      }),
    )
    .toBe(1);
});

test("风险原因带语义标题和可执行说明", async ({ page }) => {
  await page.goto(
    "/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4",
  );
  const card = page.getByTestId("observation-reason-card");
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card.locator("strong")).toHaveText(/主要风险|当前结论/);
  await expect(card.locator("p")).not.toHaveText(/^降水风险$|^雷暴风险$/);
});

test("规划器页头视图按钮保持横向且旧附近浮层不再遮挡内容", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "桌面页头几何只需验证一次");
  await page.goto(
    "/planner?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4",
  );
  const nav = page.locator(".desktop-nav");
  await expect(nav).toBeVisible({ timeout: 15000 });
  const buttons = nav.locator("button");
  await expect(buttons).toHaveCount(4);
  const boxes = await buttons.evaluateAll((items) =>
    items.map((item) => {
      const rect = item.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
  );
  expect(new Set(boxes.map((box) => Math.round(box.y))).size).toBe(1);
  expect(boxes.every((box) => box.width >= 54 && box.height <= 44)).toBe(true);
  await expect(page.locator(".nearby-ranking-panel")).toHaveCount(0);
});
