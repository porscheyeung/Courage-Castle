// 勇氣城堡 V3 規則：不碰畫面，可在 Node 測試。
// 排位演算法沿用 V2.3，改動會令舊存檔的城堡變樣。
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CourageEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const K2 = 'courage-castle-save-v2', K1 = 'courage-castle-save-v1';
  const EXTRAS_KEY = 'courage-castle-v3-extras', SNAP_KEY = 'courage-castle-save-v2-before-v3';
  const MAX_HISTORY = 24998, NOTE_MAX = 80, LAMPS = 8;
  const themes = { garden: ['🌷', '夢幻花園', '花朵、小樹、蝴蝶'], village: ['🏡', '勇氣小村莊', '小屋、石路、路燈'], guards: ['🛡️', '勇氣守護隊', '可愛守衛、盾牌、小馬'], party: ['🎈', '王國慶典', '氣球、彩旗、星星'] };
  const palettes = [['#e7aebb', '#adc8e4', '#c6b0de', '#eed19a', '#b7d6c4'], ['#a5cbe4', '#b5ddd6', '#d4b8e5', '#f2d298', '#e4b8bb'], ['#b3d5ba', '#e6c293', '#a9c9e1', '#e3b7d6', '#efb4a5'], ['#eec2a3', '#e6a7ae', '#f3d9ab', '#b3cde1', '#cbb5d5'], ['#d4aedf', '#a7c9dc', '#efd99e', '#a9d0b8', '#edb9bd']];
  const residents = [
    { id: 'cat', name: '小貓阿橘', line: '最喜歡趴在窗台，看你再試一次。' },
    { id: 'dog', name: '小狗豆豆', line: '你一改正，牠的尾巴就搖個不停。' },
    { id: 'rabbit', name: '小兔棉花', line: '耳朵長長，專門聽你說學到甚麼。' },
    { id: 'bear', name: '小熊蜜糖', line: '會給每個勇敢的人一個大擁抱。' },
    { id: 'squirrel', name: '松鼠栗子', line: '把你的小紙條當寶物般收好。' },
    { id: 'hedgehog', name: '刺蝟毛毛', line: '外表有刺，心裏非常溫柔。' },
    { id: 'owl', name: '貓頭鷹圓圓', line: '晚上替全城看守亮著的窗。' },
    { id: 'duck', name: '小鴨布丁', line: '跌倒了，就搖搖擺擺再站起來。' },
    { id: 'sheep', name: '綿羊雲朵', line: '軟綿綿的毛，最適合累的時候靠一靠。' },
    { id: 'deer', name: '小鹿點點', line: '走得慢也不要緊，牠會陪你。' },
    { id: 'pig', name: '小豬桃桃', line: '每次聽到你答對，都開心得打滾。' },
    { id: 'penguin', name: '企鵝小冰', line: '一步一步走，總會走到。' },
  ];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const randomSeed = () => Math.floor(Math.random() * 2147483640) + 1;
  const fresh = () => ({ version: 2, name: '小小建築師', kingdom: '', target: 100, seed: 2026, sound: true, history: [], themes: {}, finalized: false, finalDate: null });
  function rand(s, i, k = 0) {
    let x = (Math.imul(i + 13, 374761393) + Math.imul(s.seed, 668265263) + k) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }
  const colors = (s) => palettes[Math.floor(rand(s, 7, 22) * palettes.length)];
  const shape = (s) => Math.floor(rand(s, 5, 88) * 3);
  const clean = (t, n) => String(t ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

  // 只保留認得的欄位。ts、note 放在事件內，V2.3 及強壯城堡讀取時都會略過。
  function cleanEvent(a) {
    if (!a || !['add', 'extra', 'shine'].includes(a.type) || typeof a.id !== 'string' || a.id.length >= 50) return null;
    const e = { type: a.type, id: a.id };
    if (Number.isFinite(a.ts) && a.ts > 0 && a.ts < 8.64e15) e.ts = a.ts;
    if (a.type === 'shine' && typeof a.note === 'string') {
      const note = clean(a.note, NOTE_MAX);
      if (note) e.note = note;
    }
    return e;
  }
  function readData(d) {
    if (!d || d.version !== 2 || !Number.isInteger(d.target) || d.target < 1 || d.target > 500 || !Array.isArray(d.history) || d.history.length > 25000) return null;
    const x = fresh();
    x.target = d.target; x.seed = Number.isInteger(d.seed) ? d.seed : randomSeed();
    x.name = String(d.name || '小小建築師').slice(0, 30); x.kingdom = String(d.kingdom || '').slice(0, 40); x.sound = d.sound !== false;
    x.history = d.history.map(cleanEvent).filter(Boolean).slice(0, 25000);
    for (const [k, v] of Object.entries(d.themes || {})) if (/^\d{1,4}$/.test(k) && Object.hasOwn(themes, v)) x.themes[k] = v;
    x.finalized = d.finalized === true;
    x.finalDate = typeof d.finalDate === 'string' && !Number.isNaN(Date.parse(d.finalDate)) ? d.finalDate : null;
    return x;
  }
  function readV1(v1) {
    if (!v1 || v1.version !== 1 || !Number.isInteger(v1.target) || v1.target < 1 || v1.target > 500 || !Array.isArray(v1.history)) return null;
    const x = fresh();
    x.target = v1.target; x.seed = Number.isInteger(v1.seed) ? v1.seed : randomSeed(); x.sound = v1.sound !== false;
    x.history = v1.history.filter((e) => e && Number.isInteger(e.slot) && (e.type === 'add' || e.type === 'shine')).map((e) => ({ type: e.type, id: `c${e.slot}` }));
    return x;
  }
  const freshExtras = () => ({ seenV3: false, night: false, patrols: 0 });
  function readExtras(d) {
    const x = freshExtras();
    if (!d || typeof d !== 'object') return x;
    x.seenV3 = d.seenV3 === true; x.night = d.night === true;
    x.patrols = Number.isInteger(d.patrols) ? clamp(d.patrols, 0, 99999) : 0;
    return x;
  }

  function split(n, weights) {
    const vals = weights.map((w) => w * n), out = vals.map(Math.floor);
    const left = n - out.reduce((a, b) => a + b, 0);
    vals.map((v, i) => ({ i, f: v - out[i] })).sort((a, b) => b.f - a.f).slice(0, left).forEach((x) => out[x.i]++);
    return out;
  }
  function section(a, count) {
    if (!count) return [];
    const rows = clamp(Math.round(Math.sqrt(count * a.h / a.w)), 1, count), out = [];
    let left = count;
    for (let r = 0; r < rows; r++) {
      const cols = Math.ceil(left / (rows - r)); left -= cols;
      for (let c = 0; c < cols; c++) { const w = a.w / cols, h = a.h / rows; out.push({ x: a.x + c * w, y: a.y + a.h - (r + 1) * h, w, h, section: a.id }); }
    }
    return out;
  }
  function makeSlots(s) {
    const n = s.target; let areas;
    if (n < 8) areas = [{ x: 425, y: 424, w: 150, h: 130, id: 'mini' }];
    else if (shape(s) === 0) areas = [{ x: 255, y: 280, w: 120, h: 273, id: 'left' }, { x: 625, y: 280, w: 120, h: 273, id: 'right' }, { x: 375, y: 413, w: 96, h: 140, id: 'wingL' }, { x: 529, y: 413, w: 96, h: 140, id: 'wingR' }, { x: 471, y: 332, w: 58, h: 221, id: 'keep' }];
    else if (shape(s) === 1) areas = [{ x: 270, y: 330, w: 116, h: 223, id: 'left' }, { x: 614, y: 330, w: 116, h: 223, id: 'right' }, { x: 386, y: 423, w: 72, h: 130, id: 'wingL' }, { x: 542, y: 423, w: 72, h: 130, id: 'wingR' }, { x: 458, y: 236, w: 84, h: 317, id: 'keep' }];
    else areas = [{ x: 260, y: 345, w: 106, h: 208, id: 'left' }, { x: 447, y: 285, w: 106, h: 268, id: 'keep' }, { x: 634, y: 345, w: 106, h: 208, id: 'right' }, { x: 366, y: 437, w: 81, h: 116, id: 'wingL' }, { x: 553, y: 437, w: 81, h: 116, id: 'wingR' }];
    const weights = areas.map((a) => a.w * a.h), sum = weights.reduce((a, b) => a + b, 0), numbers = split(n, weights.map((w) => w / sum)), c = colors(s);
    const all = areas.flatMap((a, i) => section(a, numbers[i]));
    all.sort((a, b) => (b.y + b.h) - (a.y + a.h) || Math.abs(a.x - 500) - Math.abs(b.x - 500));
    return all.map((q, i) => ({ ...q, id: `c${i}`, color: c[Math.floor(rand(s, i, 44) * c.length)] }));
  }
  // 由 history 重算現況；傳入較短的 history 就是建造回放的某一刻。
  function view(s) {
    const built = [], extra = [], lit = new Set(), have = new Set(), good = [];
    for (const e of s.history) {
      if (e.type === 'add' && built.length < s.target && e.id === `c${built.length}`) { built.push(e.id); have.add(e.id); good.push(e); }
      else if (e.type === 'extra' && built.length === s.target && e.id === `e${extra.length}`) { extra.push(e.id); have.add(e.id); good.push(e); }
      else if (e.type === 'shine' && have.has(e.id) && !lit.has(e.id)) { lit.add(e.id); good.push(e); }
    }
    return { built, extra, lit, good, complete: built.length === s.target, total: built.length + extra.length, chapter: Math.floor(extra.length / 20) };
  }

  const themeAt = (s, i) => s.themes[String(Math.floor(i / 20))] || 'garden';
  const meadowSequence = [1, 0, 3, 2, 5, 4, 0, 1, 2, 3, 4, 5, 1, 0, 3, 2, 4, 5, 0, 1];
  const layoutCell = 96;
  let layoutToken = '', placedExtras = [], layoutBuckets = new Map();
  function meadowZone(s, ch, zone) {
    const expand = ch * 93;
    const areas = [
      { x: 135 - expand, y: 523, rx: 83, ry: 43 }, { x: 865 + expand, y: 519, rx: 86, ry: 43 },
      { x: 137 - expand * 0.85, y: 389, rx: 85, ry: 48 }, { x: 863 + expand * 0.85, y: 397, rx: 85, ry: 48 },
      { x: 66 - expand * 0.60, y: 462, rx: 94, ry: 54 }, { x: 934 + expand * 0.60, y: 460, rx: 95, ry: 54 },
    ];
    const a = areas[zone];
    return { ...a, y: a.y + (rand(s, ch * 11 + zone, 402) - 0.5) * 21 };
  }
  const extraScale = (s, i) => 0.82 + rand(s, i, 813) * 0.33 + (i % 11 === 0 ? 0.16 : 0);
  function footprint(s, i, x, y) {
    const type = themeAt(s, i), v = Math.floor(rand(s, i, 318) * 5), k = extraScale(s, i);
    let left = 29, right = 29, up = 47, down = 19;
    if (type === 'village') {
      if (v === 2) { left = 13; right = 13; up = 45; down = 20; }
      else if (v === 4) { left = 24; right = 24; up = 14; down = 21; }
      else { left = 26; right = 26; up = 46; down = 20; }
    } else if (type === 'guards') {
      if (v === 2) { left = 45; right = 28; up = 41; down = 29; }
      else { left = 21; right = 33; up = 48; down = 31; }
    } else if (type === 'party') { left = 29; right = 35; up = 64; down = 19; }
    else if (v === 3) { left = 32; right = 32; up = 46; down = 18; }
    return { left: x - left * k - 8, right: x + right * k + 8, top: y - up * k - 8, bottom: y + down * k + 8 };
  }
  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  function cellsFor(r) {
    const cells = [];
    for (let x = Math.floor(r.left / layoutCell); x <= Math.floor(r.right / layoutCell); x++)
      for (let y = Math.floor(r.top / layoutCell); y <= Math.floor(r.bottom / layoutCell); y++) cells.push(`${x},${y}`);
    return cells;
  }
  function occupied(r) {
    for (const key of cellsFor(r)) for (const old of layoutBuckets.get(key) || []) if (overlaps(r, old)) return true;
    return false;
  }
  function reserve(r) {
    for (const key of cellsFor(r)) {
      if (!layoutBuckets.has(key)) layoutBuckets.set(key, []);
      layoutBuckets.get(key).push(r);
    }
  }
  function positionFor(s, i) {
    const ch = Math.floor(i / 20), j = i % 20, zone = meadowSequence[(j + ch * 3) % 20];
    let seq = 0;
    for (let k = 0; k < j; k++) if (meadowSequence[(k + ch * 3) % 20] === zone) seq++;
    const a = meadowZone(s, ch, zone), offset = rand(s, ch * 13 + zone, 706) * Math.PI * 2;
    const castleArea = { left: 237, right: 763, top: 200, bottom: 587 };
    for (let attempt = 0; attempt < 240; attempt++) {
      const angle = (seq + attempt) * 2.3999632297 + offset + rand(s, i, 705) * 0.38;
      const radius = Math.sqrt((seq + 0.65) / 4) + attempt * 0.075;
      const x = a.x + Math.cos(angle) * a.rx * radius + (rand(s, i, 711) - 0.5) * 11;
      const y = a.y + Math.sin(angle) * a.ry * radius + (rand(s, i, 712) - 0.5) * 8;
      const r = footprint(s, i, x, y);
      if (r.top < 275 || r.bottom > 574 || overlaps(r, castleArea)) continue;
      if (occupied(r)) continue;
      reserve(r);
      return { x, y };
    }
    const side = (zone === 0 || zone === 2 || zone === 4) ? -1 : 1;
    for (let step = 0; step < 10000; step++) {
      const column = Math.floor(step / 5), row = step % 5;
      const x = 500 + side * (500 + ch * 60 + column * 69 + (rand(s, i, 832) - 0.5) * 9);
      const y = 344 + row * 48 + (rand(s, i, 833) - 0.5) * 9;
      const r = footprint(s, i, x, y);
      if (!occupied(r)) { reserve(r); return { x, y }; }
    }
    throw Error('無法為新景物找到足夠的擺放空間');
  }
  function extraXY(s, i) {
    const token = s.seed + ':' + JSON.stringify(s.themes);
    if (layoutToken !== token) { layoutToken = token; placedExtras = []; layoutBuckets = new Map(); }
    while (placedExtras.length <= i) placedExtras.push(positionFor(s, placedExtras.length));
    return placedExtras[i];
  }
  function edges(s, v) {
    if (!v.extra.length) return { min: 0, max: 1000, top: 60, bottom: 650 };
    let min = 0, max = 1000, top = 60, bottom = 650;
    for (let i = 0; i < v.extra.length; i++) {
      const p = extraXY(s, i);
      min = Math.min(min, p.x - 62); max = Math.max(max, p.x + 62);
      top = Math.min(top, p.y - 85); bottom = Math.max(bottom, p.y + 65);
    }
    return { min, max, top, bottom };
  }

  // 每位住客按改正次序搬進來；次序由城堡 seed 決定，舊存檔重開仍是同一批。
  function residentOrder(s) {
    const order = residents.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand(s, i, 2301) * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }
  function residentAt(s, n) { return residents[residentOrder(s)[n % residents.length]]; }
  // 新的改正分散亮在城堡各處；選中的積木優先。結果記入 history，不影響舊紀錄。
  function pickWindow(s, v, selected) {
    const options = [...v.built, ...v.extra].filter((id) => !v.lit.has(id));
    if (!options.length) return null;
    if (selected && options.includes(selected)) return selected;
    return options[Math.floor(rand(s, v.lit.size * 7 + v.total, 1201) * options.length)];
  }
  const brickNumber = (s, id) => (id[0] === 'c' ? Number(id.slice(1)) + 1 : s.target + Number(id.slice(1)) + 1);
  function diary(s, v) {
    return v.good.filter((e) => e.type === 'shine').map((e, n) => ({ id: e.id, ts: e.ts || null, note: e.note || '', n, no: brickNumber(s, e.id), resident: residentAt(s, n) }));
  }
  const garland = (n) => ({ done: Math.floor(n / LAMPS), lamps: n % LAMPS, current: Math.floor(n / LAMPS) + 1 });
  function dayKey(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function stats(history, now = Date.now()) {
    const days = new Map();
    for (const e of history) {
      if (!e.ts) continue;
      const k = dayKey(e.ts), d = days.get(k) || { add: 0, shine: 0 };
      if (e.type === 'shine') d.shine++; else d.add++;
      days.set(k, d);
    }
    const base = new Date(now), at = (back) => new Date(base.getFullYear(), base.getMonth(), base.getDate() - back, 12).getTime();
    const week = [];
    for (let b = 6; b >= 0; b--) {
      const t = at(b), d = days.get(dayKey(t)) || { add: 0, shine: 0 };
      week.push({ label: b === 0 ? '今' : '日一二三四五六'[new Date(t).getDay()], ...d });
    }
    let streak = 0, back = days.has(dayKey(at(0))) ? 0 : 1;
    while (days.has(dayKey(at(back)))) { streak++; back++; }
    return { today: week[6], week, streak };
  }
  return { K1, K2, EXTRAS_KEY, SNAP_KEY, MAX_HISTORY, NOTE_MAX, LAMPS, themes, palettes, residents, clamp, randomSeed, fresh, rand, colors, shape, clean, readData, readV1, freshExtras, readExtras, makeSlots, view, themeAt, extraXY, extraScale, meadowZone, edges, residentAt, pickWindow, brickNumber, diary, garland, dayKey, stats };
});
