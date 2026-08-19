import { expect, test } from "@playwright/test";

test("sites compatibility route preserves context and opens the recommendation panel", async ({
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
  await expect(page.locator(".detail-overlay-host")).toHaveClass(/is-open/);
  await expect(
    page.getByRole("navigation", { name: "页面导航" }).getByText("推荐观星地点"),
  ).toHaveAttribute("aria-current", "page");
});

test("source disclosure keeps the current observation context when opening recommendations", async ({
  page,
}) => {
  await page.route("**/api/forecast?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ locations: [] }),
    });
  });

  await page.goto(
    "/?lat=30.1234&lng=120.5678&name=%E4%B8%9C%E7%99%BD%E5%B1%B1&" +
      "elevation=1188&model=gfs&overlay=forecast-cloud",
  );
  await expect(page.locator(".detail-overlay-host")).toHaveClass(/is-open/);

  await page.getByRole("button", { name: "数据依据与局限" }).click();
  const dialog = page.getByRole("dialog", { name: "数据依据与局限" });
  const recommendationLink = dialog.getByRole("link", {
    name: "推荐观星地点",
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
    page.getByRole("navigation", { name: "页面导航" }).getByText("推荐观星地点"),
  ).toHaveAttribute("aria-current", "page");
});
