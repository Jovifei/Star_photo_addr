import { expect } from "@playwright/test";

export async function openMobileMapPanel(page, panel) {
  const mobileLabels = {
    layers: "图层",
    places: "地点",
    cloud: "云量",
    recommendations: "推荐",
  };
  const mobile = await page.evaluate(() =>
    window.matchMedia(
      "(max-width: 1199px), (max-height: 520px) and (max-width: 1199px)",
    ).matches,
  );
  if (!mobile) {
    const tab = page.getByRole("tab", { name: "图层与偏好", exact: true });
    if ((await tab.count()) === 0) return false;
    await tab.click();
    return false;
  }
  await page.getByTestId("mobile-map-panel-dock").waitFor({ state: "visible", timeout: 15000 });
  const drawer = page.getByTestId("mobile-map-panel-drawer");
  // A usable drawer must accept a real click. Playwright checks visibility,
  // geometry stability and hit testing; computed transform strings can report
  // an intermediate compositor sample in WebKit even after controls are usable.
  if ((await drawer.count()) > 0 && (await drawer.getAttribute("aria-hidden")) === "false") {
    const tab = drawer.locator(".mobile-map-panel-tabs").getByRole("tab", { name: mobileLabels[panel] });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(drawer).toHaveAttribute("aria-hidden", "false");
    return true;
  }
  const trigger = page.getByTestId("mobile-map-panel-open-tools");
  if ((await trigger.count()) === 0) return false;
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  await expect(drawer).toHaveAttribute("aria-hidden", "false", { timeout: 5000 });
  const tab = drawer.locator(".mobile-map-panel-tabs").getByRole("tab", { name: mobileLabels[panel] });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  return true;
}

export async function closeMobileMapPanel(page) {
  const drawer = page.getByTestId("mobile-map-panel-drawer");
  if ((await drawer.count()) === 0) return false;
  if ((await drawer.getAttribute("aria-hidden")) === "false") {
    await drawer.getByRole("button", { name: "关闭地图工具侧边栏" }).click();
  }
  return true;
}
