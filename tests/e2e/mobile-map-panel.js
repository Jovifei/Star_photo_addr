import { expect } from "@playwright/test";

export async function openMobileMapPanel(page, panel) {
  // Desktop renders floating controls, not the mobile dock: calling this
  // helper there is a no-op so specs can share one flow across projects.
  const width = page.viewportSize()?.width ?? 0;
  if (width > 768) return false;
  const labels = {
    layers: "图层",
    places: "地点",
    cloud: "云量",
    recommendations: "推荐",
  };
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
