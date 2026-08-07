import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const EXE = 'C:/Users/zhuxi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const URL = 'https://perseids.giraffetree.cn/';
const OUT = 'docs/design-references';
const log = (...a) => console.error('[step]', ...a);

const NET = [];
const launched = await chromium.launch({
  executablePath: EXE, headless: true, chromiumSandbox: false,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
log('launched');

async function newPage(w, h, opts = {}) {
  const ctx = await launched.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 1,
    permissions: opts.geolocation ? ['geolocation'] : [],
    geolocation: opts.geolocation,
  });
  const page = await ctx.newPage();
  page.on('response', (r) => {
    const u = r.url();
    if (/api\.open-meteo|map\.qq\.com|map-tiles\.open-meteo|usno\.navy|cartocdn|basemaps\.cartocdn/.test(u)) {
      NET.push({ status: r.status(), url: u });
    }
  });
  return { ctx, page };
}

try {
  // DESKTOP
  const { ctx: dctx, page: dpage } = await newPage(1440, 900);
  log('desktop context');
  await dpage.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  log('desktop goto');
  await dpage.waitForTimeout(22000);
  await dpage.screenshot({ path: `${OUT}/perseids-desktop.png` });
  await dpage.screenshot({ path: `${OUT}/perseids-desktop-full.png`, fullPage: true });
  log('desktop shots');

  // MOBILE
  const { ctx: mctx, page: mpage } = await newPage(390, 844);
  await mpage.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await mpage.waitForTimeout(22000);
  await mpage.screenshot({ path: `${OUT}/perseids-mobile.png` });
  log('mobile shots');

  // SEARCH STATE
  try {
    const box = await dpage.locator('.search-box input');
    await box.click();
    await box.type('北京', { delay: 40 });
    await dpage.waitForTimeout(1800);
    await dpage.screenshot({ path: `${OUT}/perseids-state-search.png` });
    log('search state');
  } catch (e) { log('search failed', e.message); }

  // BORTLE HELP
  try {
    await dpage.locator('.bortle-info-trigger').click();
    await dpage.waitForTimeout(800);
    await dpage.screenshot({ path: `${OUT}/perseids-state-bortle-help.png` });
    await dpage.keyboard.press('Escape');
    log('bortle help');
  } catch (e) { log('bortle help failed', e.message); }

  // CLOUD TOGGLE
  try {
    await dpage.locator('.cloud-master-toggle').click();
    await dpage.waitForTimeout(7000);
    await dpage.screenshot({ path: `${OUT}/perseids-state-cloud.png` });
    log('cloud state');
  } catch (e) { log('cloud failed', e.message); }

  // GEOLOCATION
  try {
    const { ctx: gctx, page: gpage } = await newPage(1440, 900, {
      geolocation: { latitude: 39.9042, longitude: 116.4074 },
    });
    await gpage.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await gpage.waitForTimeout(7000);
    await gpage.locator('.locate-button').click();
    await gpage.waitForTimeout(7000);
    await gpage.screenshot({ path: `${OUT}/perseids-state-locate.png` });
    await gctx.close();
    log('locate state');
  } catch (e) { log('locate failed', e.message); }

  // TOKENS
  const tokens = await dpage.evaluate(() => {
    const cs = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const s = getComputedStyle(el);
      return {
        background: s.backgroundColor, color: s.color, fontFamily: s.fontFamily,
        fontSize: s.fontSize, fontWeight: s.fontWeight, padding: s.padding,
        margin: s.margin, borderRadius: s.borderRadius, border: s.border,
        boxShadow: s.boxShadow, letterSpacing: s.letterSpacing, lineHeight: s.lineHeight,
      };
    };
    const root = getComputedStyle(document.documentElement);
    const vars = {};
    for (const name of root) { if (name.startsWith('--')) vars[name] = root.getPropertyValue(name).trim(); }
    const bortle = [...document.querySelectorAll('.layer-scale .scale-bands i')].map((i) => ({
      bg: getComputedStyle(i).backgroundColor, title: i.getAttribute('title'),
    }));
    return {
      body: cs('body'), appShell: cs('.app-shell'), topbar: cs('.topbar'),
      brandMark: cs('.brand-mark'), brandStrong: cs('.brand-block strong'),
      eventStatus: cs('.event-status'), mapHeadlineH1: cs('.map-headline h1'),
      searchBox: cs('.search-box'), locateButton: cs('.locate-button'),
      cloudControl: cs('.cloud-control'), cloudToggle: cs('.cloud-master-toggle'),
      bortleControl: cs('.bortle-control'), bortleToggle: cs('.bortle-toggle'),
      sourceButton: cs('.source-button'), detailRestore: cs('.detail-restore'),
      rootVars: vars, bortleScale: bortle,
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  });
  writeFileSync('scripts/recon-tmp/tokens.json', JSON.stringify(tokens, null, 2));
  writeFileSync('scripts/recon-tmp/network.json', JSON.stringify(NET, null, 2));
  log('TOKENS done');
  console.log('TOKENS_JSON_START');
  console.log(JSON.stringify(tokens, null, 2));
  console.log('TOKENS_JSON_END');
  console.log('NETWORK_COUNT', NET.length);

  await dctx.close();
  await mctx.close();
} catch (e) {
  log('FATAL', e.stack || e.message);
  process.exitCode = 4;
} finally {
  await launched.close();
  log('closed');
}
