const { test, expect, devices } = require('@playwright/test');
const E = require('../engine.js');
const R = require('../reward/reward-engine.js');

function castle(target, adds) {
  const s = E.fresh(); s.name = '小明'; s.target = target; s.seed = 4242;
  for (let i = 0; i < adds; i++) s.history.push({ type: 'add', id: `c${i}`, ts: Date.now() - 86400000 });
  return s;
}
async function seed(page, items) {
  await page.addInitScript((kv) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of kv) localStorage.setItem(k, v);
  }, items.map(([k, v]) => [k, JSON.stringify(v)]));
}
function watch(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), R.KEY);
async function setPin(page, pin = '2468') {
  await page.click('#parentBtn');
  await page.fill('[name=a]', pin); await page.fill('[name=b]', pin);
  await page.click('button:has-text("設定並進入")');
  await expect(page.locator('.p-head h2')).toHaveText('寶庫管理');
}
async function openChest(page) {
  await page.click('.draw-btn');
  for (let i = 0; i < 3; i++) await page.click('.fx-chest');
  await expect(page.locator('.fx.st-ready')).toBeVisible();
  await page.click('.fx-card');
  await expect(page.locator('.fx.st-result .fx-btns')).toBeVisible();
}

const { defaultBrowserType, ...iphone } = devices['iPhone SE'];
test.use({ ...iphone, browserName: 'webkit' });
{
  test('iPhone SE：各分頁沒有橫向捲動，開寶箱結果完整在畫面內', async ({ page }) => {
    const errors = watch(page);
    await seed(page, [[R.KEY, { ...R.fresh(), tickets: 3, settings: { sound: false, motion: false } }]]);
    await page.goto('/reward.html?test');
    for (const t of ['home', 'bag', 'dex', 'log']) {
      await page.click(`.tabs [data-tab=${t}]`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.click('.tabs [data-tab=home]');
    await page.evaluate(() => { let i = 0; const q = [0.999, 0.1, 0.0]; window.__rw.setRng(() => q[i++ % q.length]); });
    await page.click('.draw-btn');
    await expect(page.locator('.fx.st-result .fx-btns')).toBeVisible();
    const boxes = await page.evaluate(() => ['.fx-banner', '.fx-card', '.fx-name', '.fx-btns'].map((sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return [sel, b.top, b.bottom, innerHeight]; }));
    for (const [sel, top, bottom, vh] of boxes) {
      expect(top, sel).toBeGreaterThanOrEqual(0);
      expect(bottom, sel).toBeLessThanOrEqual(vh + 1);
    }
    await page.click('[data-act=fxClose]');
    await setPin(page);
    await page.click('[data-act=editReward][data-id=r1]');
    expect(await page.evaluate(() => document.getElementById('sheet').scrollTop)).toBe(0);
    expect(errors).toEqual([]);
  });
}
