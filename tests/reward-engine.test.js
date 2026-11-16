const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../reward/reward-engine.js');

const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const castle = (extra = 0, complete = true) => ({ seed: 4242, target: 50, complete, extra });

test('預設獎賞及機率', () => {
  const s = R.fresh();
  assert.equal(s.rewards.length, 8);
  assert.ok(s.rewards.some((r) => r.name === '看電視 10 分鐘' && r.pieces === 1));
  assert.ok(s.rewards.some((r) => r.pieces > 1));
  const sum = R.odds(s).reduce((n, o) => n + o.p, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  const t = R.tierOdds(s);
  assert.ok(t.common > t.rare && t.rare > t.epic && t.epic > t.legend);
});

test('完成城堡只發一次抽獎券；擴建獎勵要家長開啟', () => {
  let s = R.fresh();
  let out = R.syncCastle(s, castle(0, false));
  assert.equal(out.granted.length, 0);
  out = R.syncCastle(s, castle(45)); s = out.state;
  assert.equal(s.tickets, 1); assert.equal(out.granted.length, 1);
  out = R.syncCastle(s, castle(45)); assert.equal(out.granted.length, 0); assert.equal(out.state.tickets, 1);
  s.settings.chapterBonus = true;
  assert.equal(R.pendingFromCastle(s, castle(45)), 2);
  s = R.syncCastle(s, castle(45)).state;
  assert.equal(s.tickets, 3);
  s = R.syncCastle(s, { ...castle(0), seed: 99 }).state;
  assert.equal(s.tickets, 4, '新城堡（新 seed）可再得一張');
  assert.equal(s.log.filter((e) => e.type === 'grant').length, 4);
});

test('抽完整獎賞：扣券、入寶物袋、扣數量，送完不再抽中', () => {
  let s = R.fresh();
  s.rewards = [R.makeReward({ id: 'a', name: 'A', tier: 'common', stock: 1 }, 'a'), R.makeReward({ id: 'b', name: 'B', tier: 'rare' }, 'b')];
  s.tickets = 2;
  let out = R.draw(s, seq(0));
  assert.equal(out.result.reward.id, 'a');
  s = out.state;
  assert.equal(s.tickets, 1); assert.equal(s.bag.length, 1); assert.equal(s.bag[0].status, 'waiting');
  assert.equal(s.rewards[0].stock, 0);
  assert.deepEqual(R.odds(s).map((o) => o.reward.id), ['b']);
  out = R.draw(s, seq(0)); assert.equal(out.result.reward.id, 'b'); s = out.state;
  assert.equal(s.tickets, 0);
  assert.ok(R.draw(s, seq(0)).error);
});

test('碎片：優先補缺、重複會記錄、集齊自動合成', () => {
  let s = R.fresh();
  s.rewards = [R.makeReward({ id: 'g', name: '小禮物', tier: 'epic', pieces: 3 }, 'g')];
  s.tickets = 5;
  const pieces = [];
  for (let i = 0; i < 3; i++) { const out = R.draw(s, seq(0, 0.1, 0)); s = out.state; pieces.push(out.result.piece); if (i < 2) assert.equal(out.result.merged, false); else assert.equal(out.result.merged, true); }
  assert.deepEqual(pieces.sort(), [0, 1, 2]);
  assert.deepEqual(R.fragCounts(s, s.rewards[0]), [0, 0, 0]);
  assert.equal(s.bag.length, 1); assert.equal(s.bag[0].from, 'merge');
  const out = R.draw(s, seq(0, 0.9, 0.1)); s = out.state;
  assert.equal(out.result.piece, 0); assert.equal(out.result.dup, false);
  const dup = R.draw(s, seq(0, 0.9, 0.1));
  assert.equal(dup.result.dup, true);
  assert.deepEqual(R.fragCounts(dup.state, s.rewards[0]), [2, 0, 0]);
});

test('兌現、家長加減券、改碎片', () => {
  let s = R.fresh(); s.tickets = 1;
  s = R.draw(s, seq(0)).state;
  const id = s.bag[0].id;
  s = R.redeem(s, id, 1000).state;
  assert.equal(s.bag[0].status, 'done'); assert.equal(s.bag[0].doneTs, 1000);
  assert.ok(R.redeem(s, id).error);
  let a = R.adjustTickets(s, -3, ''); assert.equal(a.applied, 0);
  a = R.adjustTickets(s, 2, '在學校完成'); s = a.state; assert.equal(s.tickets, 2);
  assert.equal(s.log.at(-1).reason, '在學校完成');
  const g = s.rewards.find((r) => r.pieces > 1);
  s = R.adjustFrag(s, g.id, 1, 1).state;
  assert.equal(R.fragCounts(s, g)[1], 1);
  const st = R.stats(s);
  assert.equal(st.draws, 1); assert.equal(st.redeemed, 1); assert.equal(st.earned, 2);
});

test('新增、修改、刪除獎賞；改碎片數會清除舊碎片', () => {
  let s = R.fresh();
  let out = R.saveReward(s, { name: '  公園踩單車 ', tier: 'legend', art: 'outing', pieces: 2, weight: 5, stock: 3 });
  s = out.state; const r = out.reward;
  assert.equal(r.name, '公園踩單車'); assert.equal(r.stock, 3); assert.equal(s.rewards.length, 9);
  assert.ok(R.saveReward(s, { name: '' }).error);
  s = R.adjustFrag(s, r.id, 0, 1).state;
  s = R.saveReward(s, { ...r, pieces: 4 }).state;
  assert.equal(s.frags[r.id], undefined);
  s = R.removeReward(s, r.id).state;
  assert.equal(s.rewards.length, 8);
});

test('讀取壞資料不會出錯，並清理欄位', () => {
  assert.equal(R.read('not json').tickets, 0);
  assert.equal(R.read({ version: 9 }).rewards.length, 8);
  const s = R.read({ version: 1, tickets: -5, rewards: [{ id: 'x', name: '<b>糖</b>', tier: 'mythic', art: 'zzz', pieces: 99, weight: 500 }, { id: 'x', name: '重複' }], frags: { x: [1, 'a'] }, bag: [{ id: 'B1', status: 'odd', tier: 'rare' }] });
  assert.equal(s.tickets, 0);
  assert.equal(s.rewards.length, 1);
  assert.deepEqual([s.rewards[0].name, s.rewards[0].tier, s.rewards[0].art, s.rewards[0].pieces, s.rewards[0].weight], [' b 糖 /b'.trim(), 'common', 'gift', 6, 100]);
  assert.deepEqual(s.frags.x, [1, 0]);
  assert.equal(s.bag[0].status, 'waiting');
});

test('不改動傳入的 state', () => {
  const s = R.fresh(); s.tickets = 1;
  const before = JSON.stringify(s);
  R.draw(s, seq(0.5)); R.syncCastle(s, castle()); R.adjustTickets(s, 1); R.saveReward(s, { name: 'x' });
  assert.equal(JSON.stringify(s), before);
});
