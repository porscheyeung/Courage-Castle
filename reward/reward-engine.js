// 勇氣寶庫規則：不碰畫面，可在 Node 測試。所有函數都回傳新 state，不改動傳入的 state。
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RewardEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const KEY = 'courage-reward-v1';
  const TIERS = {
    common: { name: '普通', en: 'COMMON', weight: 12, order: 0 },
    rare: { name: '稀有', en: 'RARE', weight: 6, order: 1 },
    epic: { name: '史詩', en: 'EPIC', weight: 3, order: 2 },
    legend: { name: '傳說', en: 'LEGEND', weight: 1, order: 3 },
  };
  const ARTS = {
    tv: '電視時間', snack: '美味小食', book: '故事書', game: '遊戲時間',
    meal: '特別晚餐', outing: '出外玩', gift: '小禮物', crown: '大獎皇冠',
  };
  const MAX_PIECES = 6, MAX_REWARDS = 40, MAX_LOG = 2000, MAX_BAG = 500;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const clean = (t, n) => String(t ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, n);
  const int = (v, a, b, d) => (Number.isInteger(v) ? Math.max(a, Math.min(b, v)) : d);

  const DEFAULT_REWARDS = [
    { id: 'r1', name: '看電視 10 分鐘', note: '揀一套喜歡的節目，安心看 10 分鐘。', art: 'tv', tier: 'common', pieces: 1 },
    { id: 'r2', name: '小零食一份', note: '向家長換一份喜歡的小零食。', art: 'snack', tier: 'common', pieces: 1 },
    { id: 'r3', name: '睡前故事加一本', note: '今晚可以多聽一個故事。', art: 'book', tier: 'common', pieces: 1 },
    { id: 'r4', name: '桌上遊戲 15 分鐘', note: '邀請家長一起玩 15 分鐘。', art: 'game', tier: 'rare', pieces: 1 },
    { id: 'r5', name: '揀今晚晚餐', note: '由你決定一餐吃甚麼。', art: 'meal', tier: 'rare', pieces: 1 },
    { id: 'r6', name: '公園放風箏', note: '週末一起去公園玩。', art: 'outing', tier: 'epic', pieces: 1 },
    { id: 'r7', name: '小禮物', note: '集齊 3 片碎片，換一份小禮物。', art: 'gift', tier: 'epic', pieces: 3 },
    { id: 'r8', name: '神秘大禮物', note: '集齊 5 片碎片，換一份大禮物！', art: 'crown', tier: 'legend', pieces: 5 },
  ];

  function makeReward(r, id) {
    const tier = Object.hasOwn(TIERS, r.tier) ? r.tier : 'common';
    return {
      id: typeof r.id === 'string' && /^[\w-]{1,20}$/.test(r.id) ? r.id : id,
      name: clean(r.name, 24) || '新獎賞',
      note: clean(r.note, 60),
      art: Object.hasOwn(ARTS, r.art) ? r.art : 'gift',
      tier,
      pieces: int(r.pieces, 1, MAX_PIECES, 1),
      weight: int(r.weight, 0, 100, TIERS[tier].weight),
      stock: r.stock === null || r.stock === undefined || r.stock === '' ? null : int(Number(r.stock), 0, 999, null),
      active: r.active !== false,
    };
  }

  function fresh() {
    return {
      version: 1, pin: null,
      settings: { chapterBonus: false, sound: true, motion: true },
      rewards: DEFAULT_REWARDS.map((r) => makeReward(r, r.id)),
      tickets: 0, claimed: [], frags: {}, bag: [], log: [], seq: 1,
    };
  }

  function read(raw) {
    const d = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
    if (!d || d.version !== 1) return fresh();
    const s = fresh();
    s.pin = d.pin && typeof d.pin.hash === 'string' && typeof d.pin.salt === 'string' ? { hash: d.pin.hash.slice(0, 128), salt: d.pin.salt.slice(0, 64) } : null;
    const st = d.settings || {};
    s.settings = { chapterBonus: st.chapterBonus === true, sound: st.sound !== false, motion: st.motion !== false };
    if (Array.isArray(d.rewards)) {
      const seen = new Set();
      s.rewards = d.rewards.slice(0, MAX_REWARDS).map((r, i) => makeReward(r || {}, `r${i + 1}`)).filter((r) => !seen.has(r.id) && seen.add(r.id));
    }
    s.tickets = int(d.tickets, 0, 9999, 0);
    s.claimed = Array.isArray(d.claimed) ? d.claimed.filter((k) => typeof k === 'string' && k.length < 80).slice(-2000) : [];
    for (const [k, v] of Object.entries(d.frags || {})) {
      if (/^[\w-]{1,20}$/.test(k) && Array.isArray(v) && v.length <= MAX_PIECES) s.frags[k] = v.map((n) => int(n, 0, 999, 0));
    }
    s.bag = Array.isArray(d.bag) ? d.bag.filter((b) => b && typeof b.id === 'string').slice(-MAX_BAG).map((b) => ({
      id: b.id.slice(0, 20), rewardId: String(b.rewardId || '').slice(0, 20), name: clean(b.name, 24), art: Object.hasOwn(ARTS, b.art) ? b.art : 'gift',
      tier: Object.hasOwn(TIERS, b.tier) ? b.tier : 'common', ts: Number(b.ts) || 0, from: b.from === 'merge' ? 'merge' : 'draw',
      status: b.status === 'done' ? 'done' : 'waiting', doneTs: Number(b.doneTs) || null,
    })) : [];
    s.log = Array.isArray(d.log) ? d.log.filter((e) => e && typeof e.type === 'string').slice(-MAX_LOG) : [];
    s.seq = int(d.seq, 1, 1e9, 1);
    return s;
  }

  const nextId = (s, p) => `${p}${s.seq++}`;
  function addLog(s, e, now) {
    s.log.push({ id: nextId(s, 'L'), ts: now, ...e });
    if (s.log.length > MAX_LOG) s.log = s.log.slice(-MAX_LOG);
  }

  // 由勇氣城堡存檔算出可領的抽獎券。castle = { seed, target, complete, extra }
  function castleKeys(castle, s) {
    if (!castle || !castle.complete) return [];
    const base = `${castle.seed}:${castle.target}`, keys = [{ key: base, reason: `完成勇氣城堡（${castle.target} 題）` }];
    if (s.settings.chapterBonus) {
      for (let k = 1; k <= Math.floor((castle.extra || 0) / 20); k++) keys.push({ key: `${base}:ch${k}`, reason: `城堡擴建第 ${k} 區` });
    }
    return keys;
  }
  function syncCastle(state, castle, now = Date.now()) {
    const s = clone(state), granted = [];
    for (const k of castleKeys(castle, s)) {
      if (s.claimed.includes(k.key)) continue;
      s.claimed.push(k.key); s.tickets++; granted.push(k);
      addLog(s, { type: 'grant', n: 1, reason: k.reason }, now);
    }
    return { state: s, granted };
  }
  const pendingFromCastle = (state, castle) => castleKeys(castle, state).filter((k) => !state.claimed.includes(k.key)).length;

  const drawable = (r) => r.active && r.weight > 0 && r.stock !== 0;
  function odds(state) {
    const pool = state.rewards.filter(drawable), sum = pool.reduce((n, r) => n + r.weight, 0);
    return pool.map((r) => ({ reward: r, p: sum ? r.weight / sum : 0 }));
  }
  function tierOdds(state) {
    const out = Object.fromEntries(Object.keys(TIERS).map((t) => [t, 0]));
    for (const o of odds(state)) out[o.reward.tier] += o.p;
    return out;
  }
  const fragCounts = (state, r) => Array.from({ length: r.pieces }, (_, i) => (state.frags[r.id] || [])[i] || 0);

  function draw(state, rng = Math.random, now = Date.now()) {
    if (state.tickets < 1) return { error: '未有抽獎券' };
    const list = odds(state);
    if (!list.length) return { error: '寶庫暫時沒有獎賞，請家長加入。' };
    const s = clone(state);
    let x = rng(), pick = list[list.length - 1].reward;
    for (const o of list) { if (x < o.p) { pick = o.reward; break; } x -= o.p; }
    const r = s.rewards.find((q) => q.id === pick.id);
    s.tickets--;
    const res = { reward: clone(r), piece: null, dup: false, merged: false, bagId: null };
    if (r.pieces > 1) {
      const c = fragCounts(s, r), missing = c.map((n, i) => (n ? -1 : i)).filter((i) => i >= 0);
      const piece = missing.length && rng() < 0.7 ? missing[Math.floor(rng() * missing.length)] : Math.floor(rng() * r.pieces);
      res.piece = piece; res.dup = c[piece] > 0; c[piece]++;
      s.frags[r.id] = c;
      addLog(s, { type: 'draw', rewardId: r.id, name: r.name, tier: r.tier, art: r.art, piece, pieces: r.pieces, dup: res.dup }, now);
      if (c.every((n) => n > 0)) {
        s.frags[r.id] = c.map((n) => n - 1);
        res.merged = true;
        res.bagId = addBag(s, r, 'merge', now);
        addLog(s, { type: 'merge', rewardId: r.id, name: r.name, tier: r.tier, art: r.art }, now);
      }
    } else {
      res.bagId = addBag(s, r, 'draw', now);
      addLog(s, { type: 'draw', rewardId: r.id, name: r.name, tier: r.tier, art: r.art }, now);
    }
    res.fragsAfter = r.pieces > 1 ? fragCounts(s, r) : null;
    return { state: s, result: res };
  }
  function addBag(s, r, from, now) {
    const id = nextId(s, 'B');
    s.bag.push({ id, rewardId: r.id, name: r.name, art: r.art, tier: r.tier, ts: now, from, status: 'waiting', doneTs: null });
    if (r.stock !== null) r.stock = Math.max(0, r.stock - 1);
    return id;
  }

  function redeem(state, bagId, now = Date.now()) {
    const s = clone(state), b = s.bag.find((x) => x.id === bagId);
    if (!b || b.status === 'done') return { error: '找不到這份獎賞' };
    b.status = 'done'; b.doneTs = now;
    addLog(s, { type: 'redeem', name: b.name, tier: b.tier, art: b.art }, now);
    return { state: s };
  }
  function adjustTickets(state, n, reason, now = Date.now()) {
    const s = clone(state), d = Math.max(-s.tickets, int(n, -99, 99, 0));
    if (!d) return { state: s, applied: 0 };
    s.tickets += d;
    addLog(s, { type: 'adjust', n: d, reason: clean(reason, 40) || (d > 0 ? '家長送出' : '家長收回') }, now);
    return { state: s, applied: d };
  }
  function adjustFrag(state, rewardId, piece, delta) {
    const s = clone(state), r = s.rewards.find((q) => q.id === rewardId);
    if (!r || r.pieces < 2 || piece < 0 || piece >= r.pieces) return { error: '碎片不存在' };
    const c = fragCounts(s, r); c[piece] = Math.max(0, c[piece] + delta); s.frags[r.id] = c;
    return { state: s };
  }
  function saveReward(state, data) {
    const s = clone(state);
    const i = s.rewards.findIndex((r) => r.id === data.id);
    if (i < 0 && s.rewards.length >= MAX_REWARDS) return { error: `最多 ${MAX_REWARDS} 款獎賞` };
    let id = data.id;
    if (i < 0) do { id = nextId(s, 'c'); } while (s.rewards.some((r) => r.id === id));
    const r = makeReward({ ...data, id }, id);
    if (!clean(data.name, 24)) return { error: '請輸入獎賞名稱' };
    if (i >= 0) {
      if (s.rewards[i].pieces !== r.pieces) delete s.frags[r.id];
      s.rewards[i] = r;
    } else s.rewards.push(r);
    return { state: s, reward: r };
  }
  function removeReward(state, id) {
    const s = clone(state);
    s.rewards = s.rewards.filter((r) => r.id !== id); delete s.frags[id];
    return { state: s };
  }
  function stats(state) {
    const draws = state.log.filter((e) => e.type === 'draw');
    const byTier = Object.fromEntries(Object.keys(TIERS).map((t) => [t, 0]));
    draws.forEach((e) => { if (byTier[e.tier] !== undefined) byTier[e.tier]++; });
    const got = new Set(state.log.filter((e) => e.type === 'draw' || e.type === 'merge').map((e) => e.rewardId));
    return {
      draws: draws.length, byTier,
      earned: state.log.filter((e) => e.type === 'grant' || (e.type === 'adjust' && e.n > 0)).reduce((n, e) => n + e.n, 0),
      waiting: state.bag.filter((b) => b.status === 'waiting').length,
      redeemed: state.bag.filter((b) => b.status === 'done').length,
      collected: state.rewards.filter((r) => got.has(r.id)).length,
      got,
    };
  }

  return { KEY, TIERS, ARTS, MAX_PIECES, DEFAULT_REWARDS, fresh, read, makeReward, castleKeys, syncCastle, pendingFromCastle, odds, tierOdds, fragCounts, draw, redeem, adjustTickets, adjustFrag, saveReward, removeReward, stats };
});
