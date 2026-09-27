import { expect } from "@playwright/test";

export async function expandMobileDataSheet(page) {
  const sheet = page.getByTestId("mobile-data-sheet");
  for (let step = 0; step < 2; step++) {
    if (await sheet.getAttribute("data-level") === "full") break;
    await sheet.getByRole("button", { name: "展开数据面板" }).click();
  }
  await expect(sheet).toHaveAttribute("data-level", "full");
  return sheet;
}
