import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { expandMobileDataSheet } from "./mobile-data-sheet.js";
import { installGeocodingMock, installNextApiMock, installOpenMeteoMock } from "./mock-open-meteo.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"));
const transparentTile = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const textSelector = "button, span, p, label, h1, h2, h3, a, td, th, summary, input";
const startUrl = "/?lat=30.4694&lng=119.5978&name=release-audit&model=icon";
const tolerance = 1;
type Box = { x: number; y: number; width: number; height: number };
type Evidence = Record<string, unknown>[];
const validatedThrough = new WeakMap<Evidence, number>();

test.beforeEach(async ({ page }, info) => {
  await page.setViewportSize(info.project.name === "mobile" ? { width: 375, height: 812 } : { width: 1440, height: 1000 });
  await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.fallback() : route.abort());
  await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });
  await installOpenMeteoMock(page, fixture);
  await installNextApiMock(page, fixture);
  await installGeocodingMock(page);
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: transparentTile }));
  await page.route("https://lpm.darkmap.cn/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: transparentTile }));
});

async function openForecast(page: Page) {
  await page.goto(startUrl);
  await expect(page.getByTestId("home-context-strip")).toHaveAttribute("data-updated-at", /\d{4}-/);
  await page.evaluate(() => document.fonts.ready);
}

// Snapshot every computed size before writing any of them. This is measured
// text-only scaling, with unchanged viewport, DPR and visual viewport scale.
// Restore prior overrides before another state is measured: retry can remount
// the error span, and full mobile sheets lazily mount candidates/timeline.
async function measureTextScale(page: Page, multiplier: number, evidence: Evidence) {
  const measured = await page.evaluate(({ selector, multiplier }) => {
    const state = window as Window & {
      __controlReadabilityOriginalFonts?: WeakMap<HTMLElement, { value: string; priority: string }>;
    };
    const originals = state.__controlReadabilityOriginalFonts ??= new WeakMap();
    const targets = [...document.querySelectorAll<HTMLElement>(selector)];
    for (const element of targets) {
      const original = originals.get(element);
      if (original) {
        if (original.value) element.style.setProperty("font-size", original.value, original.priority);
        else element.style.removeProperty("font-size");
      } else originals.set(element, { value: element.style.getPropertyValue("font-size"), priority: element.style.getPropertyPriority("font-size") });
    }
    const sizes = targets.map((element) => parseFloat(getComputedStyle(element).fontSize));
    targets.forEach((element, index) => element.style.setProperty("font-size", `${sizes[index] * multiplier}px`, "important"));
    const samples = targets.map((element, index) => ({
      className: element.className,
      text: element.textContent?.trim().slice(0, 120) ?? "",
      before: sizes[index],
      after: parseFloat(getComputedStyle(element).fontSize),
      ratio: parseFloat(getComputedStyle(element).fontSize) / sizes[index],
    }));
    return { multiplier, innerWidth, innerHeight, dpr: devicePixelRatio, scale: visualViewport?.scale, samples };
  }, { selector: textSelector, multiplier });
  evidence.push({ kind: "measured-text", ...measured });
  expect(measured.samples.length).toBeGreaterThan(4);
  for (const sample of measured.samples) expect(sample.ratio, `${sample.className}: ${sample.text}`).toBeCloseTo(multiplier, 2);
  expect(measured.innerWidth).toBe(page.viewportSize()!.width);
  expect(measured.innerHeight).toBe(page.viewportSize()!.height);
  expect(measured.scale).toBe(1);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

// Range rectangles include the original glyphs hidden behind CSS ellipsis.
// Checking textContent, accessible names or toBeVisible alone misses that loss.
async function checkText(locator: Locator, ancestors: string[], label: string, evidence: Evidence) {
  await expect(locator, label).toBeVisible();
  const result = await locator.evaluate((element, { ancestors, tolerance }) => {
    const box = (value: DOMRect) => ({ x: value.x, y: value.y, width: value.width, height: value.height });
    const own = element.getBoundingClientRect();
    const ownStyle = getComputedStyle(element);
    const clipsOwnX = /^(hidden|clip|scroll|auto)$/.test(ownStyle.overflowX);
    const clipsOwnY = /^(hidden|clip|scroll|auto)$/.test(ownStyle.overflowY);
    const boundaries = [
      { selector: "visible viewport", box: { x: 0, y: 0, width: innerWidth, height: innerHeight } },
      { selector: "self horizontal bounds", box: { x: own.x, y: 0, width: own.width, height: innerHeight } },
    ];
    // Glyph ascent/descent may legitimately exceed a non-clipping span's
    // line-height. The control bounds and actual clipping ancestors are the
    // vertical limits; always constrain horizontal glyph bounds so visible
    // overflow cannot silently invade a neighboring control.
    if (element.matches("button") || clipsOwnX || clipsOwnY) boundaries.push({ selector: "self", box: box(own) });
    const failures: string[] = [];
    for (const selector of ancestors) {
      const ancestor = element.closest(selector);
      if (!ancestor) failures.push(`missing boundary: ${selector}`);
      else boundaries.push({ selector, box: box(ancestor.getBoundingClientRect()) });
    }
    // A DOM-visible node can still be clipped by the candidate sheet/rail.
    // Only the selected, scrolled-into-view label is checked, not every
    // intentionally offscreen child of a horizontal scroller.
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      const rect = ancestor.getBoundingClientRect();
      const clipsX = /^(hidden|clip|scroll|auto)$/.test(style.overflowX);
      const clipsY = /^(hidden|clip|scroll|auto)$/.test(style.overflowY);
      if (clipsX || clipsY) boundaries.push({
        selector: `clipping ancestor ${ancestor.className}`,
        box: {
          x: clipsX ? rect.left + ancestor.clientLeft : 0,
          y: clipsY ? rect.top + ancestor.clientTop : 0,
          width: clipsX ? ancestor.clientWidth : innerWidth,
          height: clipsY ? ancestor.clientHeight : innerHeight,
        },
      });
    }
    const runs: { text: string; boxes: Box[] }[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const boxes = [...range.getClientRects()].filter((rect) => rect.width && rect.height).map(box);
      runs.push({ text: node.textContent, boxes });
      for (const rect of boxes) for (const boundary of boundaries) {
        const limit = boundary.box;
        if (rect.x < limit.x - tolerance || rect.y < limit.y - tolerance || rect.x + rect.width > limit.x + limit.width + tolerance || rect.y + rect.height > limit.y + limit.height + tolerance) {
          failures.push(`${JSON.stringify(node.textContent)} exceeds ${boundary.selector}`);
        }
      }
    }
    if (!runs.length || runs.some((run) => !run.boxes.length)) failures.push("missing rendered text rectangles");
    if (clipsOwnX && element.clientWidth && element.scrollWidth > element.clientWidth + tolerance) failures.push("horizontal text overflow");
    if (clipsOwnY && element.clientHeight && element.scrollHeight > element.clientHeight + tolerance) failures.push("vertical text overflow");
    return { text: element.textContent, fontSize: getComputedStyle(element).fontSize, own: box(own), boundaries, runs, failures };
  }, { ancestors, tolerance });
  evidence.push({ kind: "text-geometry", label, ...result });
  return result;
}

function inside(inner: Box, outer: Box) {
  return inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance && inner.x + inner.width <= outer.x + outer.width + tolerance && inner.y + inner.height <= outer.y + outer.height + tolerance;
}

function overlap(a: Box, b: Box) {
  return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > tolerance && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > tolerance;
}

async function checkGroups(groups: { label: string; locator: Locator }[], container: Locator, label: string, evidence: Evidence) {
  const outer = await container.boundingBox();
  expect(outer, `${label} container`).not.toBeNull();
  const boxes: { label: string; box: Box }[] = [];
  const failures: string[] = [];
  for (const group of groups) {
    const box = await group.locator.boundingBox();
    expect(box, group.label).not.toBeNull();
    boxes.push({ label: group.label, box: box! });
    if (!inside(box!, outer!)) failures.push(`${group.label} exceeds ${label}`);
  }
  for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
    if (overlap(boxes[a].box, boxes[b].box)) failures.push(`${boxes[a].label} overlaps ${boxes[b].label}`);
  }
  evidence.push({ kind: "group-geometry", label, outer, boxes, failures });
}

async function capture(page: Page, info: TestInfo, name: string, evidence: Evidence) {
  const viewport = await page.evaluate(() => ({ innerWidth, innerHeight, dpr: devicePixelRatio, scale: visualViewport?.scale, horizontalOverflow: document.documentElement.scrollWidth - innerWidth }));
  await info.attach(`${name}-geometry`, { body: Buffer.from(JSON.stringify({ viewport, evidence }, null, 2)), contentType: "application/json" });
  await info.attach(`${name}-view`, { body: await page.screenshot({ fullPage: false }), contentType: "image/png" });
  // Attach evidence before asserting geometry, including on the RED baseline.
  expect.soft(viewport.horizontalOverflow, `${name}: document horizontal overflow`).toBeLessThanOrEqual(tolerance);
  for (const record of evidence.slice(validatedThrough.get(evidence) ?? 0)) {
    if (Array.isArray(record.failures)) expect.soft(record.failures, String(record.label ?? record.kind)).toEqual([]);
  }
  validatedThrough.set(evidence, evidence.length);
}

for (const multiplier of [1, 2]) {
  test(`${multiplier * 100}% candidate identity and both ends of the date strip remain readable`, async ({ page }, info) => {
    const evidence: Evidence = [];
    const mobile = info.project.name === "mobile";
    await openForecast(page);
    if (mobile) await expandMobileDataSheet(page);
    const pane = page.locator(mobile ? ".mobile-sheet-candidates" : ".workspace-input");
    const card = pane.getByRole("group", { name: "宝兴达瓦更扎 候选预报", exact: true });
    await expect(card).toBeVisible();
    await expect(card.getByTestId("candidate-provenance")).toContainText(/原始抓取：\d{4}-/);
    await card.scrollIntoViewIfNeeded();
    await measureTextScale(page, multiplier, evidence);
    await card.scrollIntoViewIfNeeded();
    const name = card.locator(".candidate-name");
    await name.scrollIntoViewIfNeeded();
    await expect(name).toHaveText("宝兴达瓦更扎");
    await checkText(name, [".candidate-name-box", ".candidate-card-identity", ".candidate-card"], "complete candidate name", evidence);
    await checkText(card.locator(".candidate-meta"), [".candidate-card-identity", ".candidate-card"], "candidate province and elevation", evidence);
    await checkText(card.locator(".candidate-status-pill"), [".candidate-card-score-box", ".candidate-card"], "candidate decision", evidence);
    await checkGroups([
      { label: "identity", locator: card.locator(".candidate-card-identity") },
      { label: "score and actions", locator: card.locator(".candidate-card-score-box") },
    ], card.locator(".candidate-card-top"), "candidate header", evidence);
    await capture(page, info, `candidate-${multiplier * 100}`, evidence);

    const tabs = pane.getByRole("tablist", { name: "7天日期切换" });
    const dates = tabs.getByRole("tab");
    await expect(dates).toHaveCount(7);
    // Horizontal scrolling is allowed here. Validate one revealed endpoint at
    // a time instead of falsely rejecting every intentionally offscreen tab.
    for (const endpoint of ["first", "last"] as const) {
      const date = endpoint === "first" ? dates.first() : dates.last();
      await date.scrollIntoViewIfNeeded();
      await checkText(date.locator(".candidate-date-tab-title"), [".candidate-date-tab", ".candidate-date-tabs"], `${endpoint} date title`, evidence);
      await checkText(date.locator(".candidate-date-tab-sub"), [".candidate-date-tab", ".candidate-date-tabs"], `${endpoint} full date`, evidence);
      await date.click();
      await expect(date).toHaveAttribute("aria-selected", "true");
      await capture(page, info, `candidate-date-${endpoint}-${multiplier * 100}`, evidence);
    }
  });

  test(`${multiplier * 100}% desktop forecast controls retain full time and nonoverlapping groups`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Desktop control layout is separate from the mobile full-sheet layout");
    const evidence: Evidence = [];
    await openForecast(page);
    const timeline = page.locator(".workspace-canvas .cloud-timeline");
    await expect(timeline).toBeVisible();
    const toggle = timeline.getByRole("button", { name: /逐小时预报/ });
    if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(timeline.locator(".cloud-tick").first()).toBeVisible();
    await measureTextScale(page, multiplier, evidence);
    const current = timeline.locator(".cloud-timeline-current");
    const track = timeline.locator(".cloud-track");
    const inspectToolbar = async (state: string) => {
      // Collapse/expand transitions must finish before recording a boundary.
      await timeline.evaluate(async (element) => {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
      });
      const activeTime = await timeline.getAttribute("data-active-time");
      expect(activeTime).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
      await expect(current).toContainText(activeTime!.slice(11, 16));
      await expect(current).toContainText(/\d+月\d+日/);
      await checkText(current, [".cloud-timeline-bar", ".cloud-timeline"], "full current forecast date and hour", evidence);
      await checkText(timeline.locator(".cloud-timeline-title"), [".cloud-timeline-bar"], "forecast title", evidence);
      const speed = timeline.getByRole("group", { name: "播放速度" });
      const range = timeline.getByRole("group", { name: "预报夜数" });
      await expect(speed.getByRole("button")).toHaveText(["½×", "1×", "2×"]);
      await expect(range.getByRole("button")).toHaveText(["今晚", "5 夜", "7 夜"]);
      for (const [label, group] of [["speed", speed], ["range", range]] as const) {
        for (const button of await group.getByRole("button").all()) await checkText(button, [label === "speed" ? ".cloud-timeline-speed" : ".cloud-timeline-range", ".cloud-timeline-bar"], `${label}: ${await button.innerText()}`, evidence);
        await checkGroups(await Promise.all((await group.getByRole("button").all()).map(async (locator) => ({ locator, label: await locator.innerText() }))), group, `${label} buttons`, evidence);
      }
      await checkGroups([
        { label: "title", locator: timeline.locator(".cloud-timeline-title") },
        { label: "play", locator: timeline.locator(".cloud-timeline-play") },
        { label: "speed", locator: speed },
        { label: "track", locator: track },
        { label: "range", locator: range },
        { label: "current", locator: current },
      ], timeline.locator(".cloud-timeline-bar"), "forecast control bar", evidence);
      await capture(page, info, `forecast-${state}-${multiplier * 100}`, evidence);
    };
    await inspectToolbar("expanded-initial");
    for (let cycle = 1; cycle <= 2; cycle++) {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(timeline).toHaveClass(/is-collapsed/);
      await inspectToolbar(`collapsed-${cycle}`);
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(timeline).toHaveClass(/is-expanded/);
      await inspectToolbar(`expanded-${cycle}`);
    }

    for (const endpoint of ["first", "last"] as const) {
      const ticks = track.locator(".cloud-tick");
      const tick = endpoint === "first" ? ticks.first() : ticks.last();
      await tick.scrollIntoViewIfNeeded();
      await checkGroups([{ label: `${endpoint} tick`, locator: tick }], track, "locally scrollable track", evidence);
      const visibleLabel = tick.locator(".cloud-tick-label");
      if (await visibleLabel.count()) await checkText(visibleLabel, [".cloud-tick", ".cloud-track"], `${endpoint} hour label`, evidence);
      await tick.click();
      await expect(tick).toHaveAttribute("aria-pressed", "true");
      await checkText(current, [".cloud-timeline-bar", ".cloud-timeline"], `${endpoint} selected full time`, evidence);
      await capture(page, info, `forecast-track-${endpoint}-${multiplier * 100}`, evidence);
    }
  });

  test(`${multiplier * 100}% map failure copy and retry remain contained through failure and recovery`, async ({ page }, info) => {
    const evidence: Evidence = [];
    const mobile = info.project.name === "mobile";
    let fail = true;
    let failedRequests = 0;
    let recoveredRequests = 0;
    await page.route("https://tile.openstreetmap.org/**", (route) => {
      if (fail) { failedRequests++; return route.fulfill({ status: 503, contentType: "text/plain", body: "tile unavailable" }); }
      recoveredRequests++;
      return route.fulfill({ status: 200, contentType: "image/png", body: transparentTile });
    });
    await openForecast(page);
    // Keep the mobile map in peek state for the entire failure/retry flow.
    // Candidates and the mobile timeline are intentionally not assumed mounted.
    if (mobile) {
      const sheet = page.getByTestId("mobile-data-sheet");
      for (let step = 0; step < 2 && await sheet.getAttribute("data-level") !== "peek"; step++) await sheet.getByRole("button", { name: "收起数据面板" }).click();
      await expect(sheet).toHaveAttribute("data-level", "peek");
    }
    const map = page.locator(".map-viewport");
    const status = page.getByTestId("map-tile-render-status");
    const retry = status.getByRole("button", { name: "重试地图图层", exact: true });
    const inspectFailure = async (state: string) => {
      await expect(status).toBeVisible();
      await expect(status.locator(":scope > span")).toHaveText("地图底图或图层加载失败；当前画布不代表天气数据为空。");
      await measureTextScale(page, multiplier, evidence);
      await checkText(status.locator(":scope > span"), [".map-render-status--tile", ".map-viewport"], `${state}: complete map failure explanation`, evidence);
      await checkText(retry, [".map-render-status--tile", ".map-viewport"], `${state}: retry label`, evidence);
      await checkGroups([{ label: "explanation", locator: status.locator(":scope > span") }, { label: "retry", locator: retry }], status, `${state}: error content`, evidence);
      const controls = [{ label: "tile failure", locator: status }];
      if (mobile) {
        const rail = page.getByTestId("mobile-map-panel-open-tools");
        await expect(rail.locator("span")).toHaveText("图层");
        await checkText(rail.locator("span"), ["button", ".mobile-map-panel-rail", ".map-viewport"], `${state}: complete mobile layers label`, evidence);
        const railBox = await rail.boundingBox();
        evidence.push({ kind: "touch-target", label: `${state}: mobile layers target`, railBox,
          failures: railBox && railBox.width >= 48 && railBox.height >= 48 ? [] : ["layers target smaller than 48px"] });
        controls.push({ label: "layers button", locator: rail });
      } else controls.push({ label: "map layer bar", locator: page.locator(".map-viewport .map-layer-bar") });
      await checkGroups(controls, map, `${state}: map safe zones`, evidence);
      if (!mobile) {
        const statusBox = await status.boundingBox();
        const toggleBox = await page.locator(".workspace-canvas .cloud-timeline-toggle").boundingBox();
        evidence.push({ kind: "map-timeline-separation", label: `${state}: timeline toggle separation`, state, statusBox, toggleBox,
          failures: statusBox && toggleBox && !overlap(statusBox, toggleBox) ? [] : ["missing or overlapping error/timeline toggle"] });
      }
      evidence.push({ kind: "tile-requests", state, failedRequests, recoveredRequests });
      await capture(page, info, `map-${state}-${multiplier * 100}`, evidence);
    };
    await inspectFailure("failed");
    const beforeRetry = failedRequests;
    await retry.click();
    await expect.poll(() => failedRequests).toBeGreaterThan(beforeRetry);
    await inspectFailure("failed-again");
    fail = false;
    await retry.click();
    await expect.poll(() => recoveredRequests).toBeGreaterThan(0);
    await expect(status).toHaveCount(0);
    if (mobile) await expect(page.getByTestId("mobile-map-panel-drawer")).toHaveAttribute("aria-hidden", "true");
    await measureTextScale(page, multiplier, evidence);
    evidence.push({ kind: "tile-requests", state: "recovered", failedRequests, recoveredRequests });
    await capture(page, info, `map-recovered-${multiplier * 100}`, evidence);
  });
}
