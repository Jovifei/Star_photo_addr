export async function openMobileMapPanel(page, panel) {
  const trigger = page.getByTestId(`mobile-map-panel-open-${panel}`);
  if ((await trigger.count()) === 0) return false;
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
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
