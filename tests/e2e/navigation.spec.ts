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
