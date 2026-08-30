import { expect } from "@playwright/test";

export async function openMobileMapPanel(page, panel) {
  const labels = {
    layers: "图层",
    places: "地点",
    cloud: "云量",
    recommendations: "推荐",
  };
  const width = page.viewportSize()?.width ?? 0;
  if (width > 768) {
    const tab = page.getByRole("tab", { name: labels[panel], exact: true });
    if ((await tab.count()) === 0) return false;
    await tab.click();
    return false;
  }
  await page.getByTestId("mobile-map-panel-dock").waitFor({ state: "visible", timeout: 15000 });
  const drawer = page.getByTestId("mobile-map-panel-drawer");
  if ((await drawer.count()) > 0 && (await drawer.getAttribute("aria-hidden")) === "false") {
    await drawer.getByRole("tab", { name: labels[panel] }).click({ force: true });
    await expect(drawer).toHaveAttribute("aria-hidden", "false");
    return true;
  }
  const trigger = page.getByTestId(`mobile-map-panel-open-${panel}`);
  if ((await trigger.count()) === 0) return false;
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click({ force: true });
  }
  await expect(drawer).toHaveAttribute("aria-hidden", "false", { timeout: 5000 });
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
