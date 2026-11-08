const { test, expect, devices } = require('@playwright/test');
const E = require('../engine.js');

const snap = (page) => page.evaluate(() => window.courageCastle.snapshot());
const saved = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), E.K2);
function make(target, adds, shines, opts = {}) {
  const s = E.fresh(); s.name = opts.name || '小明'; s.target = target; s.seed = opts.seed || 4242;
  for (let i = 0; i < adds; i++) s.history.push({ type: 'add', id: `c${i}`, ts: Date.now() - 86400000 });
  let v = E.view(s);
  for (let k = 0; k < shines; k++) { s.history.push({ type: 'shine', id: E.pickWindow(s, v, null), ...(opts.notes ? { note: `紙條${k}` } : {}) }); v = E.view(s); }
  return s;
}
test.use({ browserName: 'webkit' });

for (const [label, device] of [['iPhone 13', devices['iPhone 13']], ['iPhone SE', devices['iPhone SE']], ['iPhone 15 Pro Max', devices['iPhone 15 Pro Max'] || devices['iPhone 14 Pro Max']]]) {
  test.describe(label, () => {
    const { defaultBrowserType, ...rest } = device;
    test.use(rest);
    test(`${label}：文字及按鈕不遮住城堡`, async ({ page }) => {
      for (const night of [false, true]) {
        await page.context().clearCookies();
        await page.addInitScript(([k, v, ek, ev]) => { localStorage.setItem(k, v); localStorage.setItem(ek, ev); }, [E.K2, JSON.stringify(make(100, 100, 45)), E.EXTRAS_KEY, JSON.stringify({ seenV3: true, night })]);
        await page.goto('/');
        await page.click('#resume');
        await page.waitForTimeout(300);
        const castle = await page.evaluate(() => {
          const r = [...document.querySelectorAll('#castleBricks [data-oid] rect:nth-of-type(2), #castleFinish path, #knight')].map((n) => n.getBoundingClientRect());
          return { l: Math.min(...r.map((x) => x.left)), r: Math.max(...r.map((x) => x.right)), t: Math.min(...r.map((x) => x.top)), b: Math.max(...r.map((x) => x.bottom)) };
        });
        const stage = await page.locator('#stage').boundingBox();
        expect(castle.l).toBeGreaterThanOrEqual(stage.x);
        expect(castle.r).toBeLessThanOrEqual(stage.x + stage.width);
        for (const sel of ['#chipLeft', '#chipRight', '.scene-tools', '#replayCelebration']) {
          const b = await page.locator(sel).boundingBox();
          if (!b) continue;
          const hit = b.x < castle.r && b.x + b.width > castle.l && b.y < castle.b && b.y + b.height > castle.t;
          expect(hit, `${sel} 遮住城堡 ${JSON.stringify({b, castle, night})}`).toBe(false);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const add = await page.locator('#add').boundingBox();
        expect(add.y).toBeGreaterThan(stage.y + stage.height);
        const lit = await page.evaluate(() => document.querySelector('#castleBricks [data-oid].sparkling, #castleBricks [data-oid] text')?.closest('[data-oid]').dataset.oid);
        const r = await page.locator(`[data-oid="${lit}"] rect`).last().boundingBox();
        await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
        await expect(page.locator('#bubble')).toBeHidden();
        await expect(page.locator('#say'), String(night)).toContainText('還沒有小紙條');
        await expect(page.locator('#sayAction')).toContainText('寫下');
      }
    });
  });
}
