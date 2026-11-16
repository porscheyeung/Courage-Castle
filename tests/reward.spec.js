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

test('完成城堡 → 城堡出現寶庫提示 → 得抽獎券 → 開寶箱 → 家長兌現 → 紀錄', async ({ page }) => {
  const errors = watch(page);
  await seed(page, [[E.K2, castle(5, 4)], [E.EXTRAS_KEY, { seenV3: true }]]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.click('#resume');
  await expect(page.locator('#rewardDot')).toBeHidden();
  await page.click('#add');
  await expect(page.locator('#dialog h2')).toContainText('勇氣城堡建成了');
  await expect(page.locator('#goReward')).toBeVisible();
  await expect(page.locator('#rewardDot')).toBeVisible();
  await page.click('#goReward');
  await expect(page).toHaveURL(/reward\.html/);
  await expect(page.locator('.granted h2')).toHaveText('做得好！');
  await expect(page.locator('.granted')).toContainText('完成勇氣城堡（5 題）');
  await page.click('.granted [data-act=closeModal]');
  await expect(page.locator('#ticketNum')).toHaveText('1');
  await page.evaluate(() => {});
  await page.goto('/reward.html?test');
  await expect(page.locator('#ticketNum')).toHaveText('1');
  await expect(page.locator('.granted')).toHaveCount(0);
  await page.evaluate(() => window.__rw.setRng(() => 0.01));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openChest(page);
  await expect(page.locator('.fx-name')).toHaveText('看電視 10 分鐘');
  await expect(page.locator('.fb-tier')).toHaveText('普通');
  await expect(page.locator('[data-act=fxAgain]')).toHaveCount(0);
  await page.click('[data-act=fxClose]');
  await expect(page.locator('.draw-btn')).toBeDisabled();
  await expect(page.locator('.tab-badge').first()).toHaveText('1');
  await page.click('.tabs [data-tab=bag]');
  await expect(page.locator('.bag-item')).toHaveCount(1);
  await expect(page.locator('.bag-item .wait')).toHaveText('等家長兌現');
  await setPin(page);
  await page.click('[data-act=pTab][data-p=redeem]');
  await page.click('[data-act=redeem]');
  await expect(page.locator('.p-body')).toContainText('全部獎賞都已兌現');
  await page.click('.p-head [data-act=closeModal]');
  await expect(page.locator('.bag-item')).toHaveCount(0);
  await expect(page.locator('.done-list')).toContainText('看電視 10 分鐘');
  await page.click('.tabs [data-tab=log]');
  await expect(page.locator('.lg')).toHaveCount(3);
  await expect(page.locator('.log')).toContainText('獲得抽獎券');
  await expect(page.locator('.log')).toContainText('抽中「看電視 10 分鐘」');
  await expect(page.locator('.log')).toContainText('已兌現「看電視 10 分鐘」');
  await page.goto('/');
  await expect(page.locator('#rewardDot')).toBeHidden();
  expect(errors).toEqual([]);
});

test('家長：密碼、加入碎片獎賞、送抽獎券、集齊碎片合成', async ({ page }) => {
  const errors = watch(page);
  await page.goto('/reward.html?test');
  await expect(page.locator('.draw-btn')).toBeDisabled();
  await expect(page.locator('.castle-card')).toContainText('還未開始勇氣城堡');
  await setPin(page);
  await page.click('[data-act=newReward]');
  await page.fill('.r-form [name=name]', '新畫冊');
  await page.fill('.r-form [name=note]', '集齊兩片換新畫冊');
  await page.click('.art-pick label:has-text("故事書")');
  await page.click('.seg.tiers label:has-text("傳說")');
  await page.click('.r-form .seg label:has-text("2 片")');
  await page.fill('.r-form [name=weight]', '100');
  await expect(page.locator('#rfPreview .rc-name')).toHaveText('新畫冊');
  await expect(page.locator('#rfOdds')).toContainText('抽中機率約');
  await page.click('.r-form button:has-text("儲存")');
  await expect(page.locator('.p-list')).toContainText('新畫冊');
  let s = await stored(page);
  expect(s.rewards.find((r) => r.name === '新畫冊')).toMatchObject({ pieces: 2, tier: 'legend', art: 'book', weight: 100 });
  for (const r of s.rewards.filter((x) => x.name !== '新畫冊')) {
    await page.click(`[data-act=editReward][data-id=${r.id}]`);
    await page.click('.r-form .switch');
    await page.click('.r-form button:has-text("儲存")');
  }
  await page.click('[data-act=pTab][data-p=tickets]');
  await page.fill('.tk-form [name=reason]', '在學校完成城堡');
  await page.click('[data-act=adj][data-n="1"]');
  await page.click('[data-act=adj][data-n="1"]');
  await expect(page.locator('#pTickets')).toHaveText('2');
  await page.click('.p-head [data-act=closeModal]');
  await page.evaluate(() => { let i = 0; const q = [0.2, 0.1, 0.0, 0.2, 0.1, 0.9]; window.__rw.setRng(() => q[i++ % q.length]); });
  await openChest(page);
  await expect(page.locator('.fb-tier')).toHaveText('傳說');
  await expect(page.locator('.fx-name')).toHaveText('新畫冊 碎片');
  await expect(page.locator('.fx-frag')).toContainText('得到碎片');
  await page.click('[data-act=fxAgain]');
  for (let i = 0; i < 3; i++) await page.click('.fx-chest');
  await page.click('.fx-card');
  await expect(page.locator('.fx-frag p')).toHaveText('碎片集齊，合成成功！');
  await expect(page.locator('.fb-tier')).toHaveText('合成成功');
  await page.click('[data-act=fxClose]');
  await page.click('.tabs [data-tab=bag]');
  await expect(page.locator('.bag-item')).toContainText('碎片合成');
  s = await stored(page);
  expect(s.tickets).toBe(0);
  expect(s.log.filter((e) => e.type === 'adjust').map((e) => e.reason)).toEqual(['在學校完成城堡', '在學校完成城堡']);
  await page.click('#parentBtn');
  await page.fill('[name=a]', '1111');
  await page.click('button:has-text("進入")');
  await expect(page.locator('#pinErr')).toHaveText('密碼不正確');
  expect(errors).toEqual([]);
});

test('關閉動畫及略過：直接顯示結果；寶庫不影響城堡存檔', async ({ page }) => {
  const errors = watch(page);
  const c = castle(5, 5);
  await seed(page, [[E.K2, c], [R.KEY, { ...R.fresh(), tickets: 2, settings: { motion: false, sound: false } }]]);
  await page.goto('/reward.html?test');
  await page.click('.granted [data-act=closeModal]');
  await expect(page.locator('#ticketNum')).toHaveText('3');
  await page.click('.draw-btn');
  await expect(page.locator('.fx.st-result .fx-name')).toBeVisible();
  await page.click('[data-act=fxClose]');
  await page.evaluate(() => { const s = window.__rw.state; s.settings.motion = true; localStorage.setItem('courage-reward-v1', JSON.stringify(s)); window.__rw.reload(); });
  await page.click('.draw-btn');
  await page.click('.fx-skip');
  await expect(page.locator('.fx.st-result .fx-name')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#fx')).toBeHidden();
  const after = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), E.K2);
  expect(after.history).toEqual(c.history);
  expect(errors).toEqual([]);
});

