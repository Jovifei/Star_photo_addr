import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { installNextApiMock, installOpenMeteoMock, installGeocodingMock } from "./mock-open-meteo.js";

const fixture = JSON.parse(readFileSync(new URL('./fixtures/open-meteo.json', import.meta.url), 'utf8'));
test.beforeEach(async ({page}) => {
  await page.addInitScript(() => {localStorage.clear(); sessionStorage.clear();});
  await installNextApiMock(page, fixture);
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
});

for (const width of [360, 390, 768, 1024]) {
  test(`document scrolling and optional filters at ${width}px`, async ({page}, info) => {
    test.skip(info.project.name !== 'mobile');
    await page.setViewportSize({width, height:844});
    await page.goto('/');
    const filters=page.getByRole('button',{name:'时间与地点筛选'});
    await expect(filters).toBeVisible();
    await expect(page.getByRole('slider',{name:'推荐分数门槛'})).toBeHidden();
    expect((await page.locator('.workspace-commandbar').boundingBox())!.height).toBeLessThan(140);
    await filters.click();
    const threshold=page.getByRole('slider',{name:'推荐分数门槛'});
    await expect(threshold).toBeVisible();
    await threshold.focus();
    await page.keyboard.press('ArrowRight');
    await page.getByRole('button',{name:'收起时间与地点筛选'}).click();
    const map=page.locator('.leaflet-container');
    await expect(map).toHaveClass(/map-page-scroll/);
    await page.getByRole('button',{name:'移动地图，开启地图拖动',exact:true}).click();
    await expect(map).not.toHaveClass(/map-page-scroll/);
    await page.getByRole('button',{name:'完成移动地图，恢复页面滑动',exact:true}).click();
    await expect(map).toHaveClass(/map-page-scroll/);
    // Trusted touch events exercise browser scrolling; do not fake scrollTop.
    const cdp=await page.context().newCDPSession(page);
    const box=(await map.boundingBox())!;
    const start=Math.min(730,box.y+box.height-30);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width/2,y:start}]});
    for(let step=1;step<=10;step++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:width/2,y:start-step*25}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(80);
    await expect.poll(()=>page.locator('.app-header').evaluate(el=>el.getBoundingClientRect().top)).toBeLessThan(-80);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:`tmp/scroll-${width}.png`});
  });
}

for (const route of ['/fireglow','/cloudsea']) {
  test(`${route} header scrolls away and map releases vertical gestures`,async({page},info)=>{
    test.skip(info.project.name !== 'mobile');
    await page.goto(route);
    await expect(page.getByRole('button',{name:'移动地图，开启地图拖动',exact:true})).toBeVisible();
    await expect(page.locator('.leaflet-container')).toHaveClass(/map-page-scroll/);
    await page.mouse.move(180,600);
    await page.mouse.wheel(0,450);
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(100);
    expect(await page.locator('.app-header').evaluate(el=>el.getBoundingClientRect().top)).toBeLessThan(-100);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  });
}
