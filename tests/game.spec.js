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
async function seed(page, state, extras) {
  await page.addInitScript(([k, v, ek, ev]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, v); if (ev) localStorage.setItem(ek, ev);
  }, [E.K2, typeof state === 'string' ? state : JSON.stringify(state), E.EXTRAS_KEY, extras ? JSON.stringify(extras) : null]);
}
function watch(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
async function clickBrick(page, id) {
  const box = await page.locator(`[data-oid="${id}"] rect`).last().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test('首次使用：建城、改正寫紙條、氣泡、日記、復原、重新載入', async ({ page }) => {
  const errors = watch(page);
  await page.goto('/');
  await expect(page.locator('#dialog h2')).toHaveText('歡迎來到勇氣城堡！');
  await page.keyboard.press('Escape');
  await expect(page.locator('#dialog')).toBeVisible();
  await page.fill('#kidName', '朗朗');
  await page.click('[data-n="20"]');
  await page.click('#start');
  await expect(page.locator('#title')).toHaveText('朗朗的勇氣城堡');
  await expect(page.locator('#chipLeft')).toContainText('還差 20 塊');
  await expect(page.locator('#shine')).toBeDisabled();
  for (let i = 0; i < 3; i++) { await page.click('#add'); await expect(page.locator('#add')).toBeEnabled(); }
  await expect(page.locator('#current')).toHaveText('3');
  await expect(page.locator('.next-slot')).toHaveCount(1);

  await clickBrick(page, 'c1');
  await expect(page.locator('[data-oid="c1"]')).toHaveClass(/object-selected/);
  await page.click('#shine');
  await expect(page.locator('#sayAction')).toHaveText('✏️ 寫日記');
  await expect(page.locator('#noteText')).toHaveCount(0);
  expect((await saved(page)).history.at(-1).note).toBeUndefined();
  await page.click('#sayAction');
  await expect(page.locator('#noteText')).toBeVisible();
  await page.click('[data-idea="單位要寫"]');
  await page.click('#saveNote');
  let s = await saved(page);
  expect(s.history.at(-1)).toMatchObject({ type: 'shine', id: 'c1', note: '單位要寫' });
  expect(typeof s.history.at(-1).ts).toBe('number');
  await expect(page.locator('#lampText')).toHaveText('💡 1 盞');

  await clickBrick(page, 'c1');
  await expect(page.locator('#bubble')).toBeVisible();
  await expect(page.locator('#bubble .b-note')).toContainText('單位要寫');
  await page.click('#bEdit');
  await page.fill('#noteText', '先看清楚題目');
  await page.click('#saveNote');
  expect((await saved(page)).history.at(-1).note).toBe('先看清楚題目');

  await page.click('#diaryBtn');
  await expect(page.locator('.diary-list li')).toHaveCount(1);
  await expect(page.locator('.diary-list .d-note')).toHaveText('先看清楚題目');
  await page.click('#dClose');

  await page.click('#shine');
  await expect(page.locator('#sayAction')).toHaveText('✏️ 寫日記');
  await expect(page.locator('#dialog')).toBeHidden();
  await page.click('#undo');
  await expect(page.locator('#lampText')).toHaveText('💡 1 盞');
  await page.reload();
  await expect(page.locator('#dialog h2')).toContainText('歡迎回來');
  await page.click('#resume');
  expect(await snap(page)).toMatchObject({ built: 3, lit: 1 });
  expect(errors).toEqual([]);
});

test('舊存檔升級：保留進度、另存備份，舊版 V2.3 仍可讀寫', async ({ page }) => {
  const errors = watch(page);
  const old = make(30, 12, 4);
  const raw = JSON.stringify(old);
  await seed(page, raw);
  await page.goto('/');
  await expect(page.locator('#dialog h2')).toContainText('城堡升級了');
  await expect(page.locator('#dialog')).toContainText('12 塊積木和 4 次改正');
  expect(await page.evaluate((k) => localStorage.getItem(k), E.SNAP_KEY)).toBe(raw);
  await page.click('#go');
  expect(await snap(page)).toMatchObject({ built: 12, lit: 4 });
  await page.click('#shine'); await page.click('#sayAction'); await page.fill('#noteText', '要檢查'); await page.click('#saveNote');
  await page.reload();
  await expect(page.locator('#dialog h2')).toContainText('歡迎回來');

  await page.goto('/v2.3.html');
  await page.click('#resume');
  await expect(page.locator('#current')).toHaveText('12');
  await page.click('#add');
  await page.waitForTimeout(900);
  const s = await saved(page);
  expect(s.history.filter((e) => e.type === 'add')).toHaveLength(13);
  expect(s.history.find((e) => e.note === '要檢查')).toBeTruthy();
  expect(await page.evaluate((k) => localStorage.getItem(k), E.SNAP_KEY)).toBe(raw);
  expect(errors).toEqual([]);
});

test('夜景、小騎士巡邏、燈串、回放', async ({ page }) => {
  const errors = watch(page);
  await seed(page, make(40, 40, 10, { notes: true }), { seenV3: true });
  await page.goto('/');
  await page.click('#resume');
  await page.click('#nightBtn');
  await expect(page.locator('body')).toHaveClass(/night/);
  await expect(page.locator('#castleSvg text')).toHaveCount(10);
  await page.locator('#knight').click({ force: true });
  await expect(page.locator('#say')).toContainText('小騎士');
  await page.click('#sayAction');
  await expect(page.locator('#bubble')).toBeVisible();
  await page.click('#garlandBtn');
  await expect(page.locator('.lamp-dots i.on')).toHaveCount(2);
  await expect(page.locator('.res:not(.locked)')).toHaveCount(10);
  await expect(page.locator('#dialog')).toContainText('1騎士巡邏');
  await page.click('#gClose');
  await page.click('#replayBtn');
  await expect(page.locator('#chipLeft')).toContainText('回放');
  await expect(page.locator('#add')).toBeDisabled();
  await expect(page.locator('#chipLeft')).not.toContainText('回放', { timeout: 15000 });
  expect(await snap(page)).toMatchObject({ built: 40, lit: 10 });
  expect((await saved(page)).history).toHaveLength(50);
  await page.reload();
  await page.click('#resume');
  await expect(page.locator('body')).toHaveClass(/night/);
  expect(errors).toEqual([]);
});

test('完成城堡、選主題、繼續建造、決定完成', async ({ page }) => {
  const errors = watch(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, make(5, 4, 0), { seenV3: true });
  await page.goto('/');
  await page.click('#resume');
  await page.click('#add');
  await expect(page.locator('#dialog h2')).toContainText('勇氣城堡建成了');
  await page.click('#more');
  await page.click('[data-theme="village"]');
  await page.click('#add');
  await expect(page.locator('#current')).toHaveText('6');
  await expect(page.locator('#finish')).toBeVisible();
  await page.click('#finish');
  await page.click('#yesFinish');
  await expect(page.locator('#dialog h2')).toContainText('勇氣城堡');
  await expect(page.locator('#add')).toBeDisabled();
  const dl = page.waitForEvent('download');
  await page.click('#downloadPNG');
  expect((await dl).suggestedFilename()).toMatch(/\.png$/);
  expect(errors).toEqual([]);
});

