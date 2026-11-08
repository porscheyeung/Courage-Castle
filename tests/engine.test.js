const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const E = require('../engine.js');

function oldMakeSlots(state) {
  // 直接執行 V2.3 的原始排位程式，確保 V3 不會令舊城堡變樣。
  const html = fs.readFileSync(__dirname + '/../v2.3.html', 'utf8');
  const src = html.slice(html.indexOf('function split'), html.indexOf('function replay'));
  const rnd = html.slice(html.indexOf('function rand'), html.indexOf('const colors'));
  const fn = new Function('state', 'palettes', `const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));let slots;${rnd}
    const colors=()=>palettes[Math.floor(rand(7,22)*palettes.length)],shape=()=>Math.floor(rand(5,88)*3);${src};makeSlots();return slots;`);
  return fn(state, E.palettes);
}

test('排位與 V2.3 完全相同', () => {
  for (const seed of [1, 2026, 4242, 99999, 123456789]) for (const target of [1, 7, 8, 20, 63, 100, 257, 500]) {
    const s = E.fresh(); s.seed = seed; s.target = target;
    assert.deepStrictEqual(E.makeSlots(s), oldMakeSlots(s));
  }
});

test('讀取舊存檔：保留 ts 及小紙條，略過壞資料', () => {
  const d = { version: 2, target: 10, seed: 5, name: '小明', history: [
    { type: 'add', id: 'c0', ts: 1700000000000 }, { type: 'shine', id: 'c0', ts: 1700000001000, note: '單位要寫\u0007' },
    { type: 'boom', id: 'x' }, null, { type: 'add', id: 'c1', ts: -5 }] };
  const s = E.readData(d);
  assert.deepStrictEqual(s.history, [{ type: 'add', id: 'c0', ts: 1700000000000 }, { type: 'shine', id: 'c0', ts: 1700000001000, note: '單位要寫' }, { type: 'add', id: 'c1' }]);
  assert.strictEqual(E.readData({ version: 2, target: 0, history: [] }), null);
  const v1 = E.readV1({ version: 1, target: 5, seed: 3, history: [{ type: 'add', slot: 0 }, { type: 'shine', slot: 0 }] });
  assert.deepStrictEqual(v1.history, [{ type: 'add', id: 'c0' }, { type: 'shine', id: 'c0' }]);
});

test('改正、燈串、住客及日記', () => {
  const s = E.fresh(); s.target = 30; s.seed = 77;
  for (let i = 0; i < 30; i++) s.history.push({ type: 'add', id: `c${i}` });
  let v = E.view(s);
  assert.strictEqual(E.pickWindow(s, v, 'c5'), 'c5');
  for (let k = 0; k < 19; k++) { s.history.push({ type: 'shine', id: E.pickWindow(s, v, null) }); v = E.view(s); }
  assert.strictEqual(v.lit.size, 19);
  assert.deepStrictEqual(E.garland(19), { done: 2, lamps: 3, current: 3 });
  const d = E.diary(s, v);
  assert.strictEqual(new Set(d.slice(0, 12).map((x) => x.resident.id)).size, 12);
  assert.strictEqual(d[12].resident.id, d[0].resident.id);
  for (let k = 19; k < 30; k++) { s.history.push({ type: 'shine', id: E.pickWindow(s, v, null) }); v = E.view(s); }
  assert.strictEqual(E.pickWindow(s, v, null), null);
});

test('每日統計及連續天數', () => {
  const now = new Date(2026, 10, 8, 15).getTime(), day = 86400000;
  const h = [{ type: 'add', ts: now }, { type: 'shine', ts: now }, { type: 'add', ts: now - day }, { type: 'add', ts: now - 3 * day }, { type: 'add' }];
  const st = E.stats(h, now);
  assert.deepStrictEqual(st.today, { label: '今', add: 1, shine: 1 });
  assert.strictEqual(st.streak, 2);
  assert.strictEqual(st.week.length, 7);
});
