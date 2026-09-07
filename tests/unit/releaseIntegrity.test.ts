import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("release integrity invariants", () => {
  it("does not ship synthetic cloudsea weather or nearby-disk forecast relabelling", () => {
    const cloudseaRoute = fs.readFileSync("src/app/api/cloudsea/snapshot/route.ts", "utf8");
    const forecastRoute = fs.readFileSync("src/app/api/forecast/route.ts", "utf8");
    expect(cloudseaRoute).not.toContain("generateFallbackWeather");
    expect(cloudseaRoute).not.toContain("using resilient fallback");
    expect(forecastRoute).not.toContain("findNearestDiskForecast");
  });

  it("never labels the selected forecast valid time as the data update time", () => {
    const summary = fs.readFileSync("src/components/workspace/DecisionSummary.tsx", "utf8");
    expect(summary).not.toContain("state.cloudState.activeForecastTime ??");
    expect(summary).toContain("state.forecastAvailability.lastSuccessAt");
  });

  it("keeps uncalibrated fireglow output as a condition index rather than probability copy", () => {
    const app = fs.readFileSync("src/app/fireglow/FireglowApp.tsx", "utf8");
    const model = fs.readFileSync("src/lib/fireglow.ts", "utf8");
    expect(app).toContain("火烧云条件指数");
    expect(app).toContain("条件指数 =");
    expect(app).toContain("IDW 插值，不是卫星或雷达像素场");
    expect(app).not.toContain("概率排行");
    expect(app).not.toContain("三日概率");
    expect(app).not.toContain("概率 =");
    expect(model).toContain("not calibrated event probabilities");
    expect(model).not.toMatch(/label: "\d+–\d+%"/);
  });

  it("never converts missing twilight cloud inputs into clear-sky zeroes", () => {
    const model = fs.readFileSync("src/lib/fireglow.ts", "utf8");
    expect(model).not.toContain("cloudLow: hourly.cloud_cover_low?.[index] ?? 0");
    expect(model).not.toContain("cloudMid: hourly.cloud_cover_mid?.[index] ?? 0");
    expect(model).not.toContain("cloudHigh: hourly.cloud_cover_high?.[index] ?? 0");
    expect(model).not.toContain("precip: hourly.precipitation?.[index] ?? 0");
    expect(model).toContain("晨昏窗口关键云量或降水数据不完整");
  });

  it("keeps fireglow morning/evening direction copy phase-aware and opens three-day detail on the winning date", () => {
    const app = fs.readFileSync("src/app/fireglow/FireglowApp.tsx", "utf8");
    const detail = fs.readFileSync("src/app/fireglow/FireglowSiteDetail.tsx", "utf8");
    expect(app).toContain("selectedDateKey");
    expect(app).toContain("dateKey={selectedDateKey}");
    expect(detail).toContain('phase === "evening" ? 270 : 90');
    expect(detail).toContain('phase === "evening" ? "正西" : "正东"');
    expect(detail).toContain("镜头构图{solarEventLabel}朝向");
    expect(detail).not.toContain("镜头构图日落朝向");
    expect(detail).not.toContain('const high = win.highCloud ?? 0');
  });

  it("does not claim pressure-profile or inversion analysis in the surface-only cloudsea workspace", () => {
    const app = fs.readFileSync("src/app/cloudsea/CloudSeaApp.tsx", "utf8");
    const model = fs.readFileSync("src/lib/cloudsea.ts", "utf8");
    expect(app).not.toContain("逆温层数据");
    expect(app).not.toContain("综合气压层高度");
    expect(model).toContain("does not claim a");
    expect(model).toContain("pressure-profile or inversion diagnosis");
  });

  it("keeps production metadata on the project domain instead of the reference site", () => {
    const layout = fs.readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toContain("https://photo.joviluma.com");
    expect(layout).not.toContain("https://perseids.giraffetree.cn");
    expect(layout).not.toContain("canonical: \"/\"");
  });

  it("does not expose the internal integration audit page in production", () => {
    const integrationPage = fs.readFileSync("src/app/integration-plan/page.tsx", "utf8");
    expect(integrationPage).toContain('process.env.NODE_ENV === "production"');
    expect(integrationPage).toContain("notFound()");
    expect(integrationPage).toContain("index: false");
  });

  it("identifies the package as the current four-workspace project rather than the clone template", () => {
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
      author?: string;
      description?: string;
    };
    expect(packageJson.author).toBe("Jovifei");
    expect(packageJson.description).toContain("火烧云");
    expect(packageJson.description).toContain("高山云海");
  });

  it("does not reintroduce the retired standalone planner implementation", () => {
    expect(fs.existsSync("src/features/planner")).toBe(false);
    expect(fs.existsSync("tests/planner")).toBe(false);
    const detailCharts = fs.readFileSync("src/components/LocationDetailCharts.tsx", "utf8");
    const e2eMock = fs.readFileSync("tests/e2e/mock-open-meteo.js", "utf8");
    expect(detailCharts).toContain('from "@/lib/cloudLayers"');
    expect(detailCharts).not.toContain("@/features/planner");
    expect(e2eMock).not.toContain("src/features/planner");
  });

  it("marks the runtime-mounted fireglow snapshot volume as excluded from Turbopack tracing", () => {
    const fireglowRoute = fs.readFileSync("src/app/api/fireglow/snapshot/route.ts", "utf8");
    expect(fireglowRoute).toContain("OBSERVING_SNAPSHOT_DIR");
    expect(fireglowRoute).toContain("turbopackIgnore: true");
    expect(fireglowRoute).toContain("runtime-configurable");
  });
});
