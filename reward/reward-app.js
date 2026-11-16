// 勇氣寶庫介面。規則在 reward-engine.js。
(() => {
  'use strict';
  const R = window.RewardEngine, CE = window.CourageEngine;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TEST = new URLSearchParams(location.search).has('test');
  let rng = Math.random;
  let state = R.read(localStorage.getItem(R.KEY));
  let lastReason = '', forgotAns = -1, tab = 'home', parentOpen = false, parentTab = 'rewards', unlocked = false, editing = null, logFilter = 'all';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const ICON = {
    gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M12 21 8 9l4-6 4 6-4 12"/>',
    ticket: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
    chest: '<path d="M3 10a6 6 0 0 1 6-6h6a6 6 0 0 1 6 6v10H3z"/><path d="M3 12h18M10 12v3h4v-3"/>',
    bag: '<path d="M6 8h12l1 13H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    book: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="m17 9 5 6M22 9l-5 6"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    puzzle: '<path d="M10 3h4v3a2 2 0 1 0 4 0V3h3v7h-3a2 2 0 1 0 0 4h3v7h-7v-3a2 2 0 1 0-4 0v3H3v-7h3a2 2 0 1 0 0-4H3V3z"/>',
    castle: '<path d="M3 21V9h3v3h3V6h2V3h2v3h2v6h3V9h3v12z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
    gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8S10 3 7.5 4 9 8 12 8zM12 8s2-5 4.5-4S15 8 12 8z"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  };
  const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
  const ART_ICON = { tv: 'clock', snack: 'star', book: 'book', game: 'star', meal: 'star', outing: 'sparkle', gift: 'gift', crown: 'gem' };
  const T = R.TIERS;

  // ---------- 存檔、城堡 ----------
  function save() { try { localStorage.setItem(R.KEY, JSON.stringify(state)); } catch (e) { toast('儲存失敗：瀏覽器空間不足'); } }
  function castleInfo() {
    try {
      const d = CE.readData(JSON.parse(localStorage.getItem(CE.K2) || 'null'));
      if (!d) return null;
      const v = CE.view(d);
      return { seed: d.seed, target: d.target, complete: v.complete, built: v.built.length, extra: v.extra.length, name: d.name };
    } catch (e) { return null; }
  }
  const motionOn = () => state.settings.motion && !matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 音效（WebAudio 合成，不用音檔） ----------
  let ac = null;
  let gestured = false;
  addEventListener('pointerdown', () => { gestured = true; }, { once: true, capture: true });
  addEventListener('keydown', () => { gestured = true; }, { once: true, capture: true });
  function audio() { if (!state.settings.sound || !gestured) return null; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; } catch (e) { return null; } }
  function tone(f, d = 0.15, type = 'sine', vol = 0.12, when = 0, slide = 0) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + 0.05);
  }
  function noise(d = 0.5, vol = 0.18, from = 400, to = 4000) {
    const a = audio(); if (!a) return;
    const b = a.createBuffer(1, a.sampleRate * d, a.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = b; f.type = 'bandpass'; f.frequency.setValueAtTime(from, a.currentTime); f.frequency.exponentialRampToValueAtTime(to, a.currentTime + d);
    g.gain.value = vol; src.connect(f).connect(g).connect(a.destination); src.start();
  }
  const SFX = {
    tap: (n) => { tone(180 + n * 60, 0.12, 'square', 0.06); tone(520 + n * 140, 0.18, 'triangle', 0.08, 0.02); },
    open: () => { noise(0.7, 0.22, 300, 6000); tone(220, 0.6, 'sawtooth', 0.05, 0, 880); },
    rise: () => tone(330, 0.9, 'sine', 0.06, 0, 990),
    flip: () => { noise(0.25, 0.1, 2000, 7000); tone(880, 0.2, 'triangle', 0.08); },
    fanfare: (tier) => {
      const seq = { common: [523, 659, 784], rare: [523, 659, 784, 1047], epic: [523, 659, 784, 1047, 1319], legend: [392, 523, 659, 784, 1047, 1319, 1568] }[tier];
      seq.forEach((f, i) => { tone(f, 0.35, 'triangle', 0.1, i * 0.09); tone(f * 2, 0.25, 'sine', 0.03, i * 0.09); });
      if (tier === 'legend') [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.8, 'sine', 0.05, 0.75 + i * 0.05));
    },
    merge: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.5, 'triangle', 0.09, i * 0.12)),
    coin: () => { tone(988, 0.08, 'square', 0.05); tone(1319, 0.3, 'square', 0.05, 0.08); },
  };

  // ---------- 卡牌 ----------
  function slices(r, lit) {
    if (r.pieces < 2) return '';
    return `<span class="rc-slices" style="--n:${r.pieces}">${Array.from({ length: r.pieces }, (_, i) => `<i class="${lit(i) ? 'on' : 'off'}"></i>`).join('')}</span>`;
  }
  function card(r, { piece = null, owned = null, cls = '', tilt = true, locked = false, count = null } = {}) {
    const n = r.pieces, lit = piece != null ? (i) => i === piece : owned ? (i) => owned[i] > 0 : () => true;
    const label = n > 1 && piece != null ? `${r.name} 碎片` : r.name;
    return `<article class="rcard tier-${r.tier} ${locked ? 'locked' : ''} ${cls}"${tilt ? ' data-tilt' : ''}>
      <div class="rc-frame">
        <header class="rc-head"><span class="rc-gem">${ic(n > 1 ? 'puzzle' : ART_ICON[r.art] || 'star')}</span><h3 class="rc-name">${esc(label)}</h3></header>
        <div class="rc-art"><img src="reward/art/${r.art}.webp" alt="" draggable="false" loading="lazy">${slices(r, lit)}<span class="rc-rarity">${T[r.tier].name}</span>${locked ? '<span class="rc-lock">?</span>' : ''}</div>
        <div class="rc-type"><span>${n > 1 ? (piece != null ? `碎片 ${piece + 1}/${n}` : `${n} 片合成`) : '獎賞卡'}</span><span>${n > 1 ? `集齊 ${n} 片兌現` : '抽中即可兌現'}</span></div>
        <p class="rc-text">${esc(r.note || (n > 1 ? `集齊 ${n} 片碎片，換「${r.name}」。` : `向家長兌現「${r.name}」。`))}</p>
        <footer class="rc-foot"><span>COURAGE TREASURY</span><span>${T[r.tier].en}</span></footer>
      </div>
      <span class="rc-shine"></span>${piece != null && n > 1 ? `<span class="rc-piece">${piece + 1}/${n}</span>` : ''}${count ? `<span class="rc-count">×${count}</span>` : ''}
    </article>`;
  }
  const cardBack = () => `<div class="rback"><div class="rb-inner"><span class="rb-crest">${ic('castle')}</span><span class="rb-ring"></span><b>勇氣寶庫</b></div></div>`;
  const pieceStrip = (r, counts, fresh = -1) => `<div class="piece-strip" style="--n:${r.pieces}">${counts.map((c, i) => `<span class="pc ${c > 0 ? 'on' : ''} ${i === fresh ? 'fresh' : ''}" style="--i:${i}"><img src="reward/art/${r.art}.webp" alt=""><b>${i + 1}</b>${c > 1 ? `<em>×${c}</em>` : ''}</span>`).join('')}</div>`;

  // ---------- 主畫面 ----------
  const fmt = (ts) => { const d = new Date(ts); return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const fmtDay = (ts) => { const d = new Date(ts); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; };

  function viewHome() {
    const c = castleInfo(), n = state.tickets, to = R.tierOdds(state), pool = R.odds(state);
    const castle = c ? (c.complete
      ? `<div class="castle-card done">${ic('castle')}<div><b>勇氣城堡已完成</b><span>${c.built} 題全部完成${c.extra ? `，再擴建 ${c.extra} 塊` : ''}</span></div></div>`
      : `<div class="castle-card"><div class="cc-head">${ic('castle')}<div><b>勇氣城堡進度</b><span>還差 ${c.target - c.built} 題，就可以得到抽獎券！</span></div></div><div class="cc-bar"><i style="--v:${Math.round(c.built / c.target * 100)}%"></i></div><small>${c.built} / ${c.target}</small></div>`)
      : `<div class="castle-card">${ic('castle')}<div><b>還未開始勇氣城堡</b><span>完成城堡，就可以得到抽獎券。</span></div></div>`;
    return `<section class="hero">
      <div class="altar" data-act="${n ? 'draw' : ''}">
        <div class="halo"></div><div class="rays"></div>
        <img class="chest-img" src="reward/art/chest.webp" alt="寶箱" draggable="false">
        <div class="glints">${'<i></i>'.repeat(10)}</div>
      </div>
      <div class="hero-side">
        <p class="eyebrow">勇敢完成城堡的獎勵</p>
        <h2 class="display">打開寶箱，<br>抽一張獎賞卡！</h2>
        <div class="ticket-box ${n ? 'has' : ''}"><span class="tk-ic">${ic('ticket')}</span><span class="tk-num" id="ticketNum">${n}</span><span class="tk-lbl">張抽獎券</span></div>
        <button class="draw-btn" data-act="draw" ${n && pool.length ? '' : 'disabled'}><span>${ic('chest')}${n ? '打開寶箱' : '未有抽獎券'}</span></button>
        <p class="hint">${!pool.length ? '寶庫暫時沒有獎賞，請家長加入。' : n ? `每次打開寶箱用 1 張抽獎券。` : '完成一座勇氣城堡，就有一次抽獎機會。'}</p>
        ${castle}
      </div>
    </section>
    <section class="panel odds-panel">
      <div class="sec-head"><h3>${ic('gem')}寶箱裏有甚麼？</h3><button class="link" data-act="tab" data-tab="dex">看全部卡牌</button></div>
      <div class="tier-odds">${Object.keys(T).map((t) => `<div class="to tier-${t}"><span class="to-gem"></span><b>${T[t].name}</b><span>${(to[t] * 100).toFixed(1)}%</span><i><em style="--v:${(to[t] * 100).toFixed(1)}%"></em></i></div>`).join('')}</div>
      <div class="pool-strip">${pool.slice().sort((a, b) => T[b.reward.tier].order - T[a.reward.tier].order).map((o, i) => `<div class="ps" style="--i:${i}">${card(o.reward, { cls: 'mini', tilt: false })}</div>`).join('')}</div>
    </section>`;
  }

  function viewBag() {
    const waiting = state.bag.filter((b) => b.status === 'waiting').slice().reverse();
    const done = state.bag.filter((b) => b.status === 'done').slice().reverse();
    const fr = state.rewards.filter((r) => r.pieces > 1 && R.fragCounts(state, r).some(Boolean));
    const fakeR = (b) => ({ name: b.name, art: b.art, tier: b.tier, pieces: 1, note: '' });
    return `<div class="page-head"><h2>${ic('bag')}我的寶物袋</h2><p>抽到的獎賞放在這裏，請家長幫你兌現。</p></div>
      <section class="panel"><div class="sec-head"><h3>等待兌現 <span class="pill">${waiting.length}</span></h3></div>
        ${waiting.length ? `<div class="bag-grid">${waiting.map((b, i) => `<div class="bag-item" style="--i:${i}">${card(fakeR(b), { cls: 'mini', tilt: true })}<div class="bag-cap"><b>${esc(b.name)}</b><small>${b.from === 'merge' ? '碎片合成 · ' : ''}${fmt(b.ts)}</small><span class="wait">${ic('clock')}等家長兌現</span></div></div>`).join('')}</div>`
        : `<div class="empty">${ic('chest')}<p>寶物袋暫時空空的。完成勇氣城堡，打開寶箱吧！</p></div>`}
      </section>
      <section class="panel"><div class="sec-head"><h3>${ic('puzzle')}碎片收集</h3></div>
        ${fr.length ? `<div class="frag-list">${fr.map((r) => { const c = R.fragCounts(state, r), have = c.filter(Boolean).length; return `<div class="frag-row">${card(r, { owned: c, cls: 'mini', tilt: false })}<div><b>${esc(r.name)}</b><span class="muted">已有 ${have} / ${r.pieces} 片${have === r.pieces - 1 ? ' · 只差 1 片！' : ''}</span>${pieceStrip(r, c)}</div></div>`; }).join('')}</div>`
        : `<div class="empty small">${ic('puzzle')}<p>抽到碎片卡會在這裏拼起來，集齊就可以換禮物。</p></div>`}
      </section>
      ${done.length ? `<section class="panel"><div class="sec-head"><h3>${ic('check')}已兌現 <span class="pill soft">${done.length}</span></h3></div><ul class="done-list">${done.slice(0, 30).map((b) => `<li class="tier-${b.tier}"><span class="dl-gem"></span><b>${esc(b.name)}</b><time>${fmt(b.doneTs || b.ts)}</time></li>`).join('')}</ul></section>` : ''}`;
  }

  function viewDex() {
    const st = R.stats(state), od = Object.fromEntries(R.odds(state).map((o) => [o.reward.id, o.p]));
    const list = state.rewards.filter((r) => r.active).slice().sort((a, b) => T[b.tier].order - T[a.tier].order);
    return `<div class="page-head"><h2>${ic('book')}獎賞圖鑑</h2><p>已收集 <b>${st.collected}</b> / ${list.length} 款。未抽過的卡會保持神秘。</p></div>
      <div class="dex-bar"><i style="--v:${list.length ? st.collected / list.length * 100 : 0}%"></i></div>
      <div class="dex-grid">${list.map((r, i) => `<div class="dex-item" style="--i:${i}">${card(r, { locked: !st.got.has(r.id), owned: r.pieces > 1 ? R.fragCounts(state, r) : null })}<div class="dex-cap"><span class="tier-tag tier-${r.tier}">${T[r.tier].name}</span><span>${od[r.id] ? `機率 ${(od[r.id] * 100).toFixed(1)}%` : r.stock === 0 ? '已送完' : '暫停'}</span></div></div>`).join('') || '<div class="empty">未有獎賞</div>'}</div>`;
  }

  function logLine(e) {
    const m = {
      grant: [ 'ticket', '獲得抽獎券', `${esc(e.reason || '')} · +${e.n}`, 'grant' ],
      adjust: [ 'ticket', e.n > 0 ? '家長送出抽獎券' : '家長收回抽獎券', `${esc(e.reason || '')} · ${e.n > 0 ? '+' : ''}${e.n}`, e.n > 0 ? 'grant' : 'minus' ],
      draw: [ e.pieces ? 'puzzle' : 'chest', `抽中「${esc(e.name)}」${e.pieces ? ` 碎片 ${e.piece + 1}/${e.pieces}` : ''}`, `${T[e.tier] ? T[e.tier].name : ''}${e.dup ? ' · 重複碎片' : ''}`, `tier-${e.tier}` ],
      merge: [ 'sparkle', `碎片合成「${esc(e.name)}」`, '集齊全部碎片', `tier-${e.tier}` ],
      redeem: [ 'check', `已兌現「${esc(e.name)}」`, '家長確認', 'redeem' ],
      pin: [ 'key', '家長密碼已更改', '', 'minus' ],
    }[e.type];
    if (!m) return '';
    return `<li class="lg ${m[3]}"><span class="lg-ic">${ic(m[0])}</span><div><b>${m[1]}</b><small>${m[2]}</small></div><time>${fmt(e.ts)}</time></li>`;
  }
  function viewLog() {
    const st = R.stats(state);
    const F = { all: '全部', draw: '抽獎', grant: '抽獎券', redeem: '兌現' };
    const items = state.log.filter((e) => logFilter === 'all' || (logFilter === 'draw' ? ['draw', 'merge'].includes(e.type) : logFilter === 'grant' ? ['grant', 'adjust'].includes(e.type) : e.type === logFilter)).slice().reverse();
    let day = '', html = '';
    for (const e of items.slice(0, 300)) { const d = fmtDay(e.ts); if (d !== day) { html += `<li class="day">${d}</li>`; day = d; } html += logLine(e); }
    return `<div class="page-head"><h2>${ic('clock')}寶庫紀錄</h2><p>每一張抽獎券、每一次抽獎和兌現都記在這裏。</p></div>
      <div class="stat-row">
        <div class="stat"><span>累計抽獎券</span><b>${st.earned}</b></div>
        <div class="stat"><span>打開寶箱</span><b>${st.draws}</b></div>
        <div class="stat"><span>已兌現</span><b>${st.redeemed}</b></div>
        <div class="stat"><span>等待兌現</span><b>${st.waiting}</b></div>
      </div>
      <div class="tier-count">${Object.keys(T).map((t) => `<span class="tier-tag tier-${t}">${T[t].name} ${st.byTier[t]}</span>`).join('')}</div>
      <div class="seg" role="tablist">${Object.entries(F).map(([k, v]) => `<button class="${logFilter === k ? 'on' : ''}" data-act="logFilter" data-f="${k}">${v}</button>`).join('')}</div>
      <section class="panel"><ul class="log">${html || '<li class="empty small">暫時未有紀錄</li>'}</ul></section>`;
  }

  function render() {
    const views = { home: viewHome, bag: viewBag, dex: viewDex, log: viewLog };
    $('#view').innerHTML = views[tab]();
    $('#view').className = `view v-${tab}`;
    $$('.tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    const w = state.bag.filter((b) => b.status === 'waiting').length;
    $$('.tab-badge').forEach((el) => { el.textContent = w; el.hidden = !w; });
    $('#soundBtn').innerHTML = ic(state.settings.sound ? 'sound' : 'mute');
    $('#soundBtn').setAttribute('aria-label', state.settings.sound ? '關閉音效' : '開啟音效');
    document.body.classList.toggle('no-motion', !motionOn());
    if (TEST) window.__rw.state = state;
  }

  // ---------- 粒子 ----------
  const cv = () => $('#fxCanvas') || $('#pageFx');
  let parts = [], raf = 0;
  function sizeCanvas() { const c = cv(); if (!c) return; const d = Math.min(1.5, devicePixelRatio || 1); c.width = innerWidth * d; c.height = innerHeight * d; c.getContext('2d').setTransform(d, 0, 0, d, 0, 0); }
  const TIER_COLORS = { common: ['#7dd3fc', '#bae6fd', '#ffffff', '#38bdf8'], rare: ['#c4b5fd', '#a78bfa', '#f0abfc', '#ffffff'], epic: ['#fde68a', '#fbbf24', '#fb923c', '#ffffff'], legend: ['#f472b6', '#facc15', '#4ade80', '#38bdf8', '#a78bfa', '#ffffff'] };
  function burst(x, y, n, colors, { speed = 9, gravity = 0.18, kind = 'mix', life = 90 } = {}) {
    if (!motionOn()) return;
    n = Math.min(n, 450 - parts.length);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.35 + Math.random()) * speed;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.25, g: gravity, life: life * (0.6 + Math.random() * 0.6), age: 0, c: colors[i % colors.length], s: 2 + Math.random() * 5, k: kind === 'mix' ? ['rect', 'star', 'dot'][i % 3] : kind, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3 });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function rain(n, colors) {
    if (!motionOn()) return;
    n = Math.min(n, 450 - parts.length);
    for (let i = 0; i < n; i++) parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.6, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, g: 0.02, life: 260, age: 0, c: colors[i % colors.length], s: 4 + Math.random() * 5, k: 'rect', r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.25 });
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function star(ctx, r) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
  function tick() {
    const c = cv(); if (!c) { raf = 0; return; }
    const ctx = c.getContext('2d'); ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => p.age < p.life);
    for (const p of parts) {
      p.age++; p.vx *= 0.985; p.vy = p.vy * 0.985 + p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p.age / p.life); ctx.fillStyle = p.c; ctx.translate(p.x, p.y); ctx.rotate(p.r);
      if (p.k === 'rect') ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      else if (p.k === 'star') { ctx.shadowColor = p.c; ctx.shadowBlur = 8; star(ctx, p.s); }
      else { ctx.shadowColor = p.c; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    raf = parts.length ? requestAnimationFrame(tick) : 0;
  }
  const center = (el) => { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };

  // ---------- 抽獎動畫 ----------
  let fx = null;
  async function startDraw() {
    if (fx) return;
    const out = R.draw(state, rng);
    if (out.error) { toast(out.error); return; }
    state = out.state; save();
    const res = out.result, tier = res.reward.tier;
    fx = { res, taps: 0, stage: 'chest', done: false };
    const el = $('#fx');
    el.className = `fx tier-${tier} st-chest`; el.hidden = false;
    el.innerHTML = `<div class="fx-bg"></div><div class="fx-rays"></div><div class="fx-flash"></div><canvas id="fxCanvas"></canvas>
      <button class="fx-skip" data-act="fxSkip">略過 ${ic('back', 'flip-x')}</button>
      <div class="fx-stage">
        <div class="fx-chest" data-act="fxTap"><div class="fx-chest-glow"></div><img src="reward/art/chest.webp" alt="寶箱" draggable="false"><div class="fx-beam"></div></div>
        <div class="fx-card" data-act="fxFlip"><div class="fx-aura"></div><div class="fx-ring"></div><div class="spin"><div class="flip"><div class="face back">${cardBack()}</div><div class="face front">${card(res.reward, { piece: res.piece, tilt: false })}</div></div></div></div>
        <div class="fx-banner"><span class="fb-tier">${T[tier].name}</span><span class="fb-en">${T[tier].en}</span></div>
      </div>
      <div class="fx-caption"><p class="fx-prompt">點擊寶箱 <b>3</b> 次打開它！</p><div class="fx-dots">${'<i></i>'.repeat(3)}</div></div>
      <div class="fx-result"></div>`;
    sizeCanvas();
    document.body.classList.add('fx-open');
    if (!motionOn()) { await reveal(true); return; }
    SFX.rise();
  }
  function tapChest() {
    if (!fx || fx.stage !== 'chest') return;
    fx.taps++;
    const el = $('#fx'), chest = $('.fx-chest', el);
    el.style.setProperty('--charge', fx.taps / 3);
    $$('.fx-dots i', el).forEach((d, i) => d.classList.toggle('on', i < fx.taps));
    chest.classList.remove('shake'); void chest.offsetWidth; chest.classList.add('shake');
    if (fx.taps >= 2) el.classList.add('hint-tier');
    SFX.tap(fx.taps);
    const [x, y] = center(chest);
    burst(x, y, 14 + fx.taps * 8, fx.taps >= 2 ? TIER_COLORS[fx.res.reward.tier] : ['#fde68a', '#ffffff'], { speed: 6 + fx.taps * 2, kind: 'dot', life: 50 });
    const left = 3 - fx.taps;
    $('.fx-prompt', el).innerHTML = left > 0 ? `再點 <b>${left}</b> 次！` : '寶箱打開了！';
    if (fx.taps >= 3) openChest();
  }
  async function openChest() {
    const el = $('#fx'), tier = fx.res.reward.tier;
    fx.stage = 'opening';
    el.classList.add('st-open'); el.classList.remove('st-chest');
    SFX.open();
    if (navigator.vibrate) navigator.vibrate(tier === 'legend' ? [40, 40, 80] : 30);
    await sleep(380);
    if (!fx) return;
    const [x, y] = center($('.fx-chest', el));
    burst(x, y, tier === 'legend' ? 160 : tier === 'epic' ? 110 : 70, TIER_COLORS[tier], { speed: 13 });
    el.classList.add('st-emerge');
    await sleep(1250);
    if (!fx) return;
    fx.stage = 'card';
    el.classList.add('st-ready');
    $('.fx-prompt', el).innerHTML = '點擊卡牌翻開！';
    $('.fx-dots', el).hidden = true;
  }
  async function reveal(instant = false) {
    if (!fx || fx.done) return;
    fx.done = true; fx.stage = 'reveal';
    const el = $('#fx'), res = fx.res, tier = res.reward.tier;
    el.classList.add('st-open', 'st-emerge', 'st-ready', 'st-flip', 'hint-tier');
    el.classList.remove('st-chest');
    if (instant) el.classList.add('instant');
    $('.fx-caption', el).hidden = true;
    if (!instant) {
      SFX.flip();
      await sleep(420);
      if (!fx) return;
      const [x, y] = center($('.fx-card', el));
      burst(x, y, tier === 'legend' ? 220 : tier === 'epic' ? 150 : 90, TIER_COLORS[tier], { speed: tier === 'legend' ? 16 : 12 });
      SFX.fanfare(tier);
      if (tier === 'legend' || tier === 'epic') { el.classList.add('quake'); rain(tier === 'legend' ? 160 : 80, TIER_COLORS[tier]); }
      await sleep(650);
    }
    if (!fx) return;
    el.classList.add('st-result');
    const r = res.reward, left = state.tickets;
    const counts = res.fragsAfter;
    let fragHtml = '';
    if (r.pieces > 1) {
      const shown = res.merged ? counts.map((n) => n + 1) : counts;
      fragHtml = `<div class="fx-frag"><p>${res.merged ? '碎片集齊了！' : res.dup ? `這是重複的碎片 ${res.piece + 1}/${r.pieces}，已收進寶物袋。` : `得到碎片 ${res.piece + 1}/${r.pieces}！`}</p>${pieceStrip(r, shown, res.piece)}<small>${res.merged ? '' : `已有 ${counts.filter(Boolean).length} / ${r.pieces} 片`}</small></div>`;
    }
    $('.fx-result', el).innerHTML = `<h2 class="fx-name">${esc(r.name)}${r.pieces > 1 && !res.merged ? ' 碎片' : ''}</h2>
      ${fragHtml}
      <p class="fx-msg">${r.pieces > 1 && !res.merged ? '集齊全部碎片，就可以換這份禮物。' : '已放進寶物袋，請家長幫你兌現！'}</p>
      <div class="fx-btns"><button class="btn ghost" data-act="fxClose">${ic('bag')}收進寶物袋</button>${left ? `<button class="btn gold" data-act="fxAgain">${ic('chest')}再開一次（剩 ${left} 張）</button>` : ''}</div>`;
    if (res.merged && !instant) {
      await sleep(900);
      if (!fx) return;
      el.classList.add('st-merge');
      SFX.merge();
      const [x, y] = center($('.fx-card', el));
      burst(x, y, 140, TIER_COLORS[tier], { speed: 14 });
      $('.fx-card .face.front', el).innerHTML = card(r, { tilt: false });
      $('.fx-banner', el).innerHTML = '<span class="fb-tier">合成成功</span><span class="fb-en">COMPLETE</span>';
      $('.fx-frag p', el).textContent = '碎片集齊，合成成功！';
    } else if (res.merged) {
      $('.fx-card .face.front', el).innerHTML = card(r, { tilt: false });
    }
    render();
  }
  function closeFx() {
    const el = $('#fx');
    el.hidden = true; el.innerHTML = ''; el.className = 'fx';
    document.body.classList.remove('fx-open');
    parts = []; fx = null; render();
  }

  // ---------- 對話框、提示 ----------
  function toast(t) {
    const el = $('#toast'); el.textContent = t; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function modal(html, cls = '') {
    const m = $('#modal'); m.hidden = false; m.className = `modal ${cls}`;
    $('#sheet').innerHTML = html; $('#sheet').scrollTop = 0;
    const f = $('#sheet [autofocus]'); if (f) setTimeout(() => f.focus(), 50);
  }
  function closeModal() { $('#modal').hidden = true; $('#sheet').innerHTML = ''; if (parentOpen) unlocked = false; parentOpen = false; editing = null; }

  function grantedDialog(granted) {
    modal(`<div class="granted">
      <div class="g-ticket">${ic('ticket')}<b>+${granted.length}</b></div>
      <h2>做得好！</h2>
      <p>${granted.map((g) => esc(g.reason)).join('、')}</p>
      <p class="muted">你得到 ${granted.length} 張抽獎券，快去打開寶箱！</p>
      <button class="btn gold big" data-act="closeModal" autofocus>${ic('chest')}去打開寶箱</button>
    </div>`, 'center');
    SFX.coin();
    setTimeout(() => { const t = $('.g-ticket'); if (t) { const [x, y] = center(t); burstOnPage(x, y); } }, 300);
  }
  function burstOnPage(x, y) { sizeCanvas(); burst(x, y, 70, TIER_COLORS.epic, { speed: 10 }); }

  // ---------- 家長 ----------
  const buf2hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  async function hashPin(pin, salt) {
    const data = new TextEncoder().encode(`${salt}:${pin}`);
    if (crypto.subtle) return buf2hex(await crypto.subtle.digest('SHA-256', data));
    let h = 2166136261; for (const x of data) h = Math.imul(h ^ x, 16777619) >>> 0; return `f${h.toString(16)}`;
  }
  function openParent() {
    parentOpen = true;
    if (unlocked) return renderParent();
    if (!state.pin) {
      modal(`<form class="pin-form" data-form="setPin"><div class="pin-ic">${ic('key')}</div><h2>設定家長密碼</h2><p class="muted">家長區可加入獎賞、送抽獎券及兌現獎賞。請設定 4 至 8 位數字密碼，小朋友就不能自己改。</p>
        <label>新密碼<input name="a" inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8" autocomplete="new-password" type="password" required autofocus></label>
        <label>再輸入一次<input name="b" inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8" autocomplete="new-password" type="password" required></label>
        <p class="err" id="pinErr"></p>
        <div class="row-btns"><button type="button" class="btn ghost" data-act="closeModal">取消</button><button class="btn gold">設定並進入</button></div></form>`, 'center');
    } else {
      modal(`<form class="pin-form" data-form="checkPin"><div class="pin-ic">${ic('lock')}</div><h2>家長區</h2><p class="muted">請輸入家長密碼。</p>
        <label>密碼<input name="a" inputmode="numeric" maxlength="8" autocomplete="current-password" type="password" required autofocus></label>
        <p class="err" id="pinErr"></p>
        <div class="row-btns"><button type="button" class="btn ghost" data-act="closeModal">取消</button><button class="btn gold">進入</button></div>
        <button type="button" class="link small" data-act="forgotPin">忘記密碼？</button></form>`, 'center');
    }
  }
  function renderParent() {
    const P = { rewards: '獎賞', tickets: '抽獎券', redeem: '兌現', settings: '設定' };
    const waiting = state.bag.filter((b) => b.status === 'waiting').length;
    let body = '';
    if (editing) body = rewardForm(editing);
    else if (parentTab === 'rewards') body = parentRewards();
    else if (parentTab === 'tickets') body = parentTickets();
    else if (parentTab === 'redeem') body = parentRedeem();
    else body = parentSettings();
    modal(`<div class="parent">
      <header class="p-head"><div><span class="p-badge">${ic('lock')}家長區</span><h2>${editing ? (editing.id ? '修改獎賞' : '新增獎賞') : '寶庫管理'}</h2></div><button class="icon-btn" data-act="closeModal" aria-label="關閉">${ic('close')}</button></header>
      ${editing ? '' : `<nav class="p-tabs">${Object.entries(P).map(([k, v]) => `<button class="${parentTab === k ? 'on' : ''}" data-act="pTab" data-p="${k}">${v}${k === 'redeem' && waiting ? `<span class="dot-n">${waiting}</span>` : ''}</button>`).join('')}</nav>`}
      <div class="p-body">${body}</div></div>`, 'full');
  }
  function parentRewards() {
    const od = Object.fromEntries(R.odds(state).map((o) => [o.reward.id, o.p]));
    return `<div class="p-intro"><p>機率按「權重」計算：權重越大越易抽中。碎片獎賞要集齊全部碎片才可兌現。</p><button class="btn gold" data-act="newReward">${ic('plus')}新增獎賞</button></div>
      <div class="p-list">${state.rewards.map((r) => `<div class="p-item ${r.active ? '' : 'off'}">
        <div class="p-thumb tier-${r.tier}"><img src="reward/art/${r.art}.webp" alt=""></div>
        <div class="p-info"><b>${esc(r.name)}</b><small><span class="tier-tag tier-${r.tier}">${T[r.tier].name}</span>${r.pieces > 1 ? `${r.pieces} 片碎片` : '完整獎賞'} · 權重 ${r.weight} · ${r.stock === null ? '不限數量' : `剩 ${r.stock} 份`}</small></div>
        <span class="p-odds">${od[r.id] ? `${(od[r.id] * 100).toFixed(1)}%` : r.active ? (r.stock === 0 ? '已送完' : '0%') : '暫停'}</span>
        <button class="icon-btn" data-act="editReward" data-id="${r.id}" aria-label="修改 ${esc(r.name)}">${ic('edit')}</button>
      </div>`).join('')}</div>`;
  }
  function rewardForm(r) {
    return `<form class="r-form" data-form="reward">
      <div class="rf-preview" id="rfPreview">${card(r, { tilt: false })}</div>
      <div class="rf-fields">
        <label>獎賞名稱<input name="name" maxlength="24" value="${esc(r.name)}" required placeholder="例如：看電視 10 分鐘"></label>
        <label>說明（可留空）<input name="note" maxlength="60" value="${esc(r.note)}" placeholder="例如：揀一套喜歡的節目"></label>
        <fieldset><legend>卡面插畫</legend><div class="art-pick">${Object.entries(R.ARTS).map(([k, v]) => `<label class="ap"><input type="radio" name="art" value="${k}" ${r.art === k ? 'checked' : ''}><img src="reward/art/${k}.webp" alt=""><span>${v}</span></label>`).join('')}</div></fieldset>
        <fieldset><legend>稀有度</legend><div class="seg tiers">${Object.keys(T).map((t) => `<label class="tier-${t}"><input type="radio" name="tier" value="${t}" ${r.tier === t ? 'checked' : ''}><span>${T[t].name}</span></label>`).join('')}</div></fieldset>
        <fieldset><legend>獎賞類型</legend><div class="seg">${[1, 2, 3, 4, 5, 6].map((n) => `<label><input type="radio" name="pieces" value="${n}" ${r.pieces === n ? 'checked' : ''}><span>${n === 1 ? '完整' : `${n} 片`}</span></label>`).join('')}</div><small class="muted">選「完整」即抽中就可兌現；選碎片要集齊才可兌現，適合較大的禮物。</small></fieldset>
        <div class="two">
          <label>權重（0–100）<input name="weight" type="number" min="0" max="100" value="${r.weight}"><small class="muted" id="rfOdds"></small></label>
          <label>數量（留空 = 不限）<input name="stock" type="number" min="0" max="999" value="${r.stock ?? ''}" placeholder="不限"></label>
        </div>
        <label class="switch"><input type="checkbox" name="active" ${r.active ? 'checked' : ''}><span></span>放入寶箱</label>
        <p class="err" id="rfErr"></p>
        <div class="row-btns">${r.id ? `<button type="button" class="btn danger" data-act="delReward" data-id="${r.id}">${ic('trash')}刪除</button>` : ''}<span class="grow"></span><button type="button" class="btn ghost" data-act="cancelEdit">取消</button><button class="btn gold">${ic('check')}儲存</button></div>
      </div></form>`;
  }
  function formReward(form) {
    const f = new FormData(form);
    return { ...editing, name: f.get('name'), note: f.get('note'), art: f.get('art'), tier: f.get('tier'), pieces: Number(f.get('pieces')), weight: Number(f.get('weight')), stock: f.get('stock') === '' ? null : Number(f.get('stock')), active: f.get('active') === 'on' };
  }
  function updatePreview(form) {
    const d = R.makeReward(formReward(form), editing.id || 'new');
    if (!d.name || d.name === '新獎賞') d.name = form.name.value.trim() || '新獎賞';
    $('#rfPreview').innerHTML = card(d, { tilt: false });
    const others = state.rewards.filter((r) => r.id !== editing.id && r.active && r.weight > 0 && r.stock !== 0).reduce((n, r) => n + r.weight, 0);
    const mine = d.active && d.stock !== 0 ? d.weight : 0;
    $('#rfOdds').textContent = `抽中機率約 ${mine + others ? (mine / (mine + others) * 100).toFixed(1) : 0}%`;
  }
  function parentTickets() {
    const c = castleInfo(), pend = c ? R.pendingFromCastle(state, c) : 0;
    const recent = state.log.filter((e) => e.type === 'grant' || e.type === 'adjust').slice(-8).reverse();
    return `<div class="tk-big"><span class="tk-ic">${ic('ticket')}</span><div><small>現有抽獎券</small><b id="pTickets">${state.tickets}</b></div></div>
      <div class="castle-status">${ic('castle')}<div>${c ? `<b>${esc(c.name || '勇氣城堡')}：${c.complete ? '已完成' : `${c.built} / ${c.target} 題`}</b><small>${c.complete ? (pend ? `有 ${pend} 張抽獎券等待自動發出` : '這座城堡的抽獎券已經發出') : '完成城堡後，打開寶庫會自動得到 1 張抽獎券。'}</small>` : '<b>這部機未有勇氣城堡紀錄</b><small>城堡和寶庫要用同一部機、同一個瀏覽器。在其他機完成的話，可以在這裏手動送出。</small>'}</div></div>
      <form class="tk-form" data-form="adjust">
        <label>原因（會記錄）<input name="reason" maxlength="40" value="${esc(lastReason)}" placeholder="例如：在學校完成城堡"></label>
        <div class="row-btns"><button type="button" class="btn ghost" data-act="adj" data-n="-1">${ic('minus')}收回 1 張</button><button type="button" class="btn gold" data-act="adj" data-n="1">${ic('plus')}送出 1 張</button></div>
      </form>
      <label class="switch"><input type="checkbox" data-act="chapterBonus" ${state.settings.chapterBonus ? 'checked' : ''}><span></span>城堡完成後每擴建 20 塊，再送 1 張</label>
      ${recent.length ? `<h4>最近</h4><ul class="log compact">${recent.map(logLine).join('')}</ul>` : ''}`;
  }
  function parentRedeem() {
    const w = state.bag.filter((b) => b.status === 'waiting').slice().reverse();
    const d = state.bag.filter((b) => b.status === 'done').slice(-10).reverse();
    return `<p class="p-intro">小朋友抽到的獎賞會在這裏等候。給了獎賞之後按「已兌現」。</p>
      ${w.length ? `<div class="p-list">${w.map((b) => `<div class="p-item"><div class="p-thumb tier-${b.tier}"><img src="reward/art/${b.art}.webp" alt=""></div><div class="p-info"><b>${esc(b.name)}</b><small>${b.from === 'merge' ? '碎片合成 · ' : ''}${fmt(b.ts)}</small></div><button class="btn gold sm" data-act="redeem" data-id="${b.id}">${ic('check')}已兌現</button></div>`).join('')}</div>` : `<div class="empty small">${ic('check')}<p>全部獎賞都已兌現。</p></div>`}
      ${d.length ? `<h4>最近兌現</h4><ul class="done-list">${d.map((b) => `<li class="tier-${b.tier}"><span class="dl-gem"></span><b>${esc(b.name)}</b><time>${fmt(b.doneTs)}</time></li>`).join('')}</ul>` : ''}
      ${state.rewards.some((r) => r.pieces > 1) ? `<h4>碎片調整</h4><p class="muted small">碎片數量有誤時可以在這裏修正。</p>${state.rewards.filter((r) => r.pieces > 1).map((r) => `<div class="frag-adj"><b>${esc(r.name)}</b><div>${R.fragCounts(state, r).map((n, i) => `<span><button class="icon-btn sm" data-act="fragAdj" data-id="${r.id}" data-i="${i}" data-d="-1" ${n ? '' : 'disabled'} aria-label="減少碎片 ${i + 1}">${ic('minus')}</button><i>${i + 1}/${r.pieces} ×${n}</i><button class="icon-btn sm" data-act="fragAdj" data-id="${r.id}" data-i="${i}" data-d="1" aria-label="增加碎片 ${i + 1}">${ic('plus')}</button></span>`).join('')}</div></div>`).join('')}` : ''}`;
  }
  function parentSettings() {
    return `<div class="set-list">
      <label class="switch"><input type="checkbox" data-act="setSound" ${state.settings.sound ? 'checked' : ''}><span></span>音效</label>
      <label class="switch"><input type="checkbox" data-act="setMotion" ${state.settings.motion ? 'checked' : ''}><span></span>開寶箱動畫（關閉後直接顯示結果）</label>
      <div class="set-row"><div><b>更改家長密碼</b><small>下次進入家長區要用新密碼。</small></div><button class="btn ghost" data-act="changePin">${ic('key')}更改</button></div>
      <div class="set-row"><div><b>下載備份</b><small>獎賞、抽獎券、寶物袋及全部紀錄。</small></div><button class="btn ghost" data-act="export">${ic('download')}下載</button></div>
      <div class="set-row"><div><b>還原備份</b><small>用備份檔取代這部機的寶庫資料。</small></div><label class="btn ghost file">${ic('upload')}選擇檔案<input type="file" accept="application/json,.json" data-act="import" hidden></label></div>
      <div class="set-row danger-zone"><div><b>清除抽獎紀錄</b><small>保留獎賞設定及密碼，清除抽獎券、寶物袋、碎片和紀錄。</small></div><button class="btn danger" data-act="resetData">${ic('trash')}清除</button></div>
      <p class="muted small">資料只存在這部機的瀏覽器，不會上傳。勇氣城堡和寶庫要用同一部機才可以自動發抽獎券。</p>
    </div>`;
  }

  // ---------- 事件 ----------
  const acts = {
    tab: (el) => { tab = el.dataset.tab; render(); window.scrollTo({ top: 0, behavior: motionOn() ? 'smooth' : 'auto' }); },
    draw: () => startDraw(),
    fxTap: () => tapChest(),
    fxFlip: () => { if (fx && fx.stage === 'card') reveal(); },
    fxSkip: () => { if (!fx) return; if (!fx.done) reveal(true); else closeFx(); },
    fxClose: () => { closeFx(); },
    fxAgain: () => { closeFx(); startDraw(); },
    closeModal: () => { closeModal(); render(); },
    logFilter: (el) => { logFilter = el.dataset.f; render(); },
    sound: () => { state.settings.sound = !state.settings.sound; save(); render(); if (state.settings.sound) SFX.coin(); },
    parent: () => openParent(),
    forgotPin: () => {
      const a = 13 + Math.floor(Math.random() * 80), b = 13 + Math.floor(Math.random() * 80);
      forgotAns = a * b;
      modal(`<form class="pin-form" data-form="forgot"><div class="pin-ic">${ic('key')}</div><h2>重設家長密碼</h2><p class="muted">請家長答這條數，答對就可以重設密碼。獎賞和紀錄都會保留，紀錄會寫低「家長密碼已更改」。</p>
        <label>${a} × ${b} = ?<input name="a" inputmode="numeric" required autofocus></label><p class="err" id="pinErr"></p>
        <div class="row-btns"><button type="button" class="btn ghost" data-act="closeModal">取消</button><button class="btn danger">重設密碼</button></div></form>`, 'center');
    },
    pTab: (el) => { parentTab = el.dataset.p; renderParent(); },
    newReward: () => { editing = R.makeReward({ name: '', tier: 'common', art: 'gift', pieces: 1 }, ''); editing.id = ''; editing.name = ''; renderParent(); },
    editReward: (el) => { editing = { ...state.rewards.find((r) => r.id === el.dataset.id) }; renderParent(); },
    cancelEdit: () => { editing = null; renderParent(); },
    delReward: (el) => {
      const r = state.rewards.find((x) => x.id === el.dataset.id);
      if (!confirm(`刪除「${r.name}」？已抽到的獎賞和紀錄會保留。`)) return;
      state = R.removeReward(state, r.id).state; save(); editing = null; renderParent(); toast('已刪除');
    },
    adj: (el) => {
      const reason = lastReason = $('.tk-form [name=reason]').value;
      const out = R.adjustTickets(state, Number(el.dataset.n), reason);
      if (!out.applied) { toast('沒有抽獎券可收回'); return; }
      state = out.state; save(); renderParent(); toast(out.applied > 0 ? '已送出 1 張抽獎券' : '已收回 1 張抽獎券'); if (out.applied > 0) SFX.coin();
    },
    chapterBonus: (el) => { state.settings.chapterBonus = el.checked; save(); syncNow(false); renderParent(); },
    redeem: (el) => { state = R.redeem(state, el.dataset.id).state; save(); renderParent(); toast('已兌現，記錄好了'); SFX.coin(); },
    fragAdj: (el) => { const out = R.adjustFrag(state, el.dataset.id, Number(el.dataset.i), Number(el.dataset.d)); if (out.state) { state = out.state; save(); renderParent(); } },
    setSound: (el) => { state.settings.sound = el.checked; save(); },
    setMotion: (el) => { state.settings.motion = el.checked; save(); },
    changePin: () => { state.pin = null; save(); unlocked = false; openParent(); },
    export: () => {
      const blob = new Blob([JSON.stringify({ app: 'courage-reward', exported: new Date().toISOString(), data: state }, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      const d = new Date(); a.download = `勇氣寶庫備份-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    resetData: () => {
      if (!confirm('清除抽獎券、寶物袋、碎片和全部紀錄？獎賞設定和密碼會保留。建議先下載備份。')) return;
      const keep = { rewards: state.rewards, pin: state.pin, settings: state.settings, claimed: state.claimed };
      state = { ...R.fresh(), ...JSON.parse(JSON.stringify(keep)) }; save(); renderParent(); toast('已清除紀錄');
    },
  };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !el.dataset.act || el.matches('input')) return;
    if (el.tagName === 'A') return;
    const f = acts[el.dataset.act]; if (f) { e.preventDefault(); f(el); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.matches('input[type=checkbox][data-act]') && acts[el.dataset.act]) acts[el.dataset.act](el);
    if (el.matches('input[type=file][data-act=import]')) importFile(el.files[0]);
  });
  document.addEventListener('input', (e) => { const f = e.target.closest('form[data-form=reward]'); if (f) updatePreview(f); });
  document.addEventListener('submit', async (e) => {
    const form = e.target, kind = form.dataset.form; if (!kind) return;
    e.preventDefault();
    const f = new FormData(form);
    if (kind === 'setPin') {
      const a = String(f.get('a')), b = String(f.get('b'));
      if (!/^\d{4,8}$/.test(a)) return void ($('#pinErr').textContent = '請輸入 4 至 8 位數字');
      if (a !== b) return void ($('#pinErr').textContent = '兩次輸入不相同');
      const salt = Math.random().toString(36).slice(2, 12);
      state.pin = { salt, hash: await hashPin(a, salt) }; save(); unlocked = true; renderParent();
    } else if (kind === 'checkPin') {
      const ok = (await hashPin(String(f.get('a')), state.pin.salt)) === state.pin.hash;
      if (!ok) { $('#pinErr').textContent = '密碼不正確'; form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); return; }
      unlocked = true; renderParent();
    } else if (kind === 'forgot') {
      if (Number(f.get('a')) !== forgotAns) { $('#pinErr').textContent = '答案不正確'; return; }
      state.pin = null; state.log.push({ id: `L${state.seq++}`, ts: Date.now(), type: 'pin' }); save(); openParent();
    } else if (kind === 'reward') {
      const out = R.saveReward(state, formReward(form));
      if (out.error) { $('#rfErr').textContent = out.error; return; }
      state = out.state; save(); editing = null; parentTab = 'rewards'; renderParent(); toast('已儲存獎賞');
    }
  });
  async function importFile(file) {
    if (!file) return;
    try {
      const j = JSON.parse(await file.text()), d = j && j.app === 'courage-reward' ? j.data : j;
      if (!d || d.version !== 1) throw new Error();
      if (!confirm('用備份取代這部機的寶庫資料？')) return;
      state = R.read(d); save(); unlocked = !state.pin ? false : unlocked; renderParent(); toast('已還原備份');
    } catch (e) { toast('這不是勇氣寶庫的備份檔'); }
  }

  // 卡牌傾斜光澤
  document.addEventListener('pointermove', (e) => {
    const c = e.target.closest && e.target.closest('[data-tilt]'); if (!c || !motionOn()) return;
    const b = c.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
    c.style.setProperty('--rx', `${(0.5 - y) * 16}deg`); c.style.setProperty('--ry', `${(x - 0.5) * 18}deg`);
    c.style.setProperty('--mx', `${x * 100}%`); c.style.setProperty('--my', `${y * 100}%`); c.classList.add('tilting');
  });
  document.addEventListener('pointerout', (e) => {
    const c = e.target.closest && e.target.closest('[data-tilt]'); if (!c || c.contains(e.relatedTarget)) return;
    c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); c.classList.remove('tilting');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (fx) { if (fx.done) closeFx(); else reveal(true); }
    else if (!$('#modal').hidden) { closeModal(); render(); }
  });
  addEventListener('resize', sizeCanvas);

  // 背景星空
  function stars() {
    const c = $('#stars'), d = Math.min(2, devicePixelRatio || 1);
    c.width = innerWidth * d; c.height = innerHeight * d;
    const ctx = c.getContext('2d'); ctx.scale(d, d);
    for (let i = 0; i < 140; i++) { ctx.globalAlpha = 0.2 + Math.random() * 0.7; ctx.fillStyle = i % 9 ? '#fff' : '#fde68a'; ctx.beginPath(); ctx.arc(Math.random() * innerWidth, Math.random() * innerHeight, Math.random() * 1.4, 0, 7); ctx.fill(); }
  }

  function syncNow(show = true) {
    const c = castleInfo(); if (!c) return;
    const out = R.syncCastle(state, c);
    if (out.granted.length) { state = out.state; save(); render(); if (show) grantedDialog(out.granted); }
  }

  if (TEST) window.__rw = { state, setRng: (f) => { rng = f; }, reload: () => { state = R.read(localStorage.getItem(R.KEY)); render(); } };
  $('#soundBtn').dataset.act = 'sound';
  $('#parentBtn').dataset.act = 'parent';
  stars();
  render();
  syncNow(true);
  addEventListener('storage', (e) => { if (e.key === CE.K2 || e.key === R.KEY) { state = R.read(localStorage.getItem(R.KEY)); syncNow(true); render(); } });
  addEventListener('focus', () => syncNow(true));
})();
