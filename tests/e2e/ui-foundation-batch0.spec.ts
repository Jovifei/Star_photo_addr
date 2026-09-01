import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  installGeocodingMock,
  installNextApiMock,
  installOpenMeteoMock,
} from "./mock-open-meteo.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"),
);

const OSM_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const DUPLICATE_CANDIDATES = [
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
    note: "score-45",
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
    bortle: 4,
    kind: "自定义",
    note: "score-38",
  },
];

async function mockBasemapTiles(page: Page) {
  await page.route(/https:\/\/tile\.openstreetmap\.org\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: OSM_PNG }),
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
});

test("四个地图入口默认请求 OSM 且不请求 CARTO 匿名瓦片", async ({ page }) => {
  await mockBasemapTiles(page);
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));

  for (const path of ["/", "/sites", "/fireglow", "/planner"]) {
    requested.length = 0;
    await page.goto(`${path}?overlay=forecast-cloud&view=combined`);
    if (path === "/planner") {
      await page.locator("nav:visible").getByRole("button", { name: "地图" }).click();
    }
    await expect(page.locator(".leaflet-container").first()).toBeVisible({
      timeout: 15000,
    });
    await expect
      .poll(() => requested.some((url) => url.includes("tile.openstreetmap.org")))
      .toBe(true);
    expect(requested.some((url) => url.includes("basemaps.cartocdn.com"))).toBe(
      false,
    );
    await expect(page.locator(".leaflet-control-attribution")).toContainText(
      "OpenStreetMap",
    );
  }
});

test("同坐标候选只保留先出现的一条，深链点位不会静默新增收藏", async ({
  page,
}) => {
  await page.addInitScript((candidates) => {
    localStorage.setItem(
      "perseids-custom-candidates-v1",
      JSON.stringify(candidates),
    );
  }, DUPLICATE_CANDIDATES);
  await page.goto(
    "/planner?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4",
  );
  await expect(page.locator(".rank-card")).toHaveCount(1, { timeout: 20000 });
  await expect(page.locator(".detail-drawer")).toHaveCount(0);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem("perseids-custom-candidates-v1");
        return raw ? JSON.parse(raw) : [];
      }),
    )
    .toEqual([
      expect.objectContaining({ id: "duplicate-a", name: "同一机位 A" }),
    ]);
  await page.reload();
  await expect(page.locator(".rank-card")).toHaveCount(1, { timeout: 20000 });
  const afterReload = await page.evaluate(() => {
    const raw = localStorage.getItem("perseids-custom-candidates-v1");
    return raw ? JSON.parse(raw) : [];
  });
  expect(afterReload).toHaveLength(1);
  expect(afterReload[0]?.id).toBe("duplicate-a");
});

test("相距较远的两个地点不会被坐标去重误删", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "perseids-custom-candidates-v1",
      JSON.stringify([
        {
          id: "linan",
          adcode: 0,
          province: "浙江",
          city: "临安",
          name: "天荒坪",
          longitude: 119.5978,
          latitude: 30.4694,
          elevation: 958.4,
          bortle: 3,
          kind: "自定义",
          note: "",
        },
        {
          id: "shanghai",
          adcode: 0,
          province: "上海",
          city: "上海",
          name: "余山",
          longitude: 121.196,
          latitude: 31.096,
          elevation: 98,
          bortle: 6,
          kind: "自定义",
          note: "",
        },
      ]),
    );
  });
  await page.goto("/planner");
  await expect(page.locator(".rank-card")).toHaveCount(2, { timeout: 20000 });
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem("perseids-custom-candidates-v1");
        return raw ? JSON.parse(raw).length : 0;
      }),
    )
    .toBe(2);
});

test("风险原因带语义标题和可执行说明，且不伪造无雷暴", async ({ page }) => {
  await page.goto(
    "/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4",
  );
  const card = page.getByTestId("observation-reason-card");
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card.locator("dt").nth(1)).toHaveText(
    /主要风险|未见已接入门禁|评分未知|选点引导/,
  );
  await expect(card.locator("dd").nth(1)).not.toHaveText(/^降水风险$|^雷暴风险$/);
  await expect(card).not.toContainText("无雷暴");
  await expect(card).not.toContainText("安全");
});

test("规划器空状态不再使用残缺多夜文案", async ({ page }) => {
  await page.goto("/planner");
  const empty = page.locator(".empty-state");
  await expect(empty).toBeVisible({ timeout: 15000 });
  await expect(empty).not.toContainText("这里会比较晚");
  await expect(empty).toContainText("未来 3、5、7");
});

test("规划器页头视图按钮保持横向且触控高度不少于 44px", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "桌面页头几何只需验证一次");
  await page.goto(
    "/planner?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4",
  );
  const nav = page.locator(".desktop-nav");
  await expect(nav).toBeVisible({ timeout: 15000 });
  const buttons = nav.locator("button");
  await expect(buttons).toHaveCount(4);
  const style = await nav.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { display: computed.display, direction: computed.flexDirection };
  });
  expect(style.display).toBe("flex");
  expect(style.direction).toBe("row");
  const boxes = await buttons.evaluateAll((items) =>
    items.map((item) => {
      const rect = item.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
  );
  expect(new Set(boxes.map((box) => Math.round(box.y))).size).toBe(1);
  expect(boxes.every((box) => box.height >= 44)).toBe(true);
  await expect(page.locator(".nearby-ranking-panel")).toHaveCount(0);

  await page.setViewportSize({ width: 1024, height: 768 });
  const midBoxes = await buttons.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().height),
  );
  expect(midBoxes.every((height) => height >= 44)).toBe(true);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(true);
});

test("附近推荐按钮不重叠、高度不少于 44px，且 200 km 可被真实点击", async ({
  page,
}) => {
  const start = page.viewportSize() ?? { width: 1440, height: 1000 };
  const sizes =
    start.width >= 1000
      ? [
          { width: 1440, height: 1000 },
          { width: 1024, height: 768 },
        ]
      : [
          { width: 375, height: 812 },
          { width: 390, height: 844 },
          { width: 812, height: 375 },
          { width: 844, height: 390 },
        ];

  await page.goto(
    "/planner?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4",
  );
  const nearby = page.locator('[aria-label="附近观星点推荐范围"]');
  await expect(nearby).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".nearby-ranking-panel")).toHaveCount(0);

  for (const size of sizes) {
    await page.setViewportSize(size);
    await expect(nearby).toBeVisible();
    const buttons = nearby.getByRole("button");
    await expect(buttons).toHaveCount(5);
    const geometry = await buttons.evaluateAll((items) =>
      items.map((item, index) => {
        const rect = item.getBoundingClientRect();
        return {
          index,
          name: item.textContent?.trim() ?? "",
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
        };
      }),
    );
    expect(geometry.every((box) => box.height >= 44)).toBe(true);
    for (let i = 0; i < geometry.length; i += 1) {
      for (let j = i + 1; j < geometry.length; j += 1) {
        const a = geometry[i]!;
        const b = geometry[j]!;
        const overlap =
          a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
        expect(overlap, `${a.name} overlaps ${b.name} at ${size.width}x${size.height}`).toBe(
          false,
        );
      }
    }

    const twoHundred = nearby.getByRole("button", { name: "200 km" });
    const box = await twoHundred.boundingBox();
    expect(box).not.toBeNull();
    const sampleX = box!.x + box!.width / 2;
    const sampleY = box!.y + box!.height / 2;
    const hit = await page.evaluate(
      ({ x, y }) => {
        const node = document.elementFromPoint(x, y);
        return node instanceof HTMLElement
          ? node.closest("button")?.textContent?.trim() ?? node.textContent?.trim()
          : null;
      },
      { x: sampleX, y: sampleY },
    );
    expect(hit).toContain("200");
    await twoHundred.click();
    await expect(twoHundred).toHaveAttribute("aria-pressed", "true");
    const noOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    );
    expect(noOverflow).toBe(true);
  }
});
