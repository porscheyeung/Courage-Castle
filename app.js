// 勇氣城堡 V3 介面。規則在 engine.js；這裏只負責畫面、存檔及操作。
(() => {
'use strict';
const E = window.CourageEngine, $ = (id) => document.getElementById(id), svg = $('castleSvg');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const faces = { cat: '🐱', dog: '🐶', rabbit: '🐰', bear: '🐻', squirrel: '🐿️', hedgehog: '🦔', owl: '🦉', duck: '🦆', sheep: '🐑', deer: '🦌', pig: '🐷', penguin: '🐧' };
const cheerful = ['又完成一題！', '努力又累積了一點！', '城堡慢慢長高了！', '每一步都很珍貴！', '藍圖又填滿一格！'];
const courage = ['勇敢改正，真了不起！', '錯誤也是學習的機會！', '願意再試一次，就是勇氣！', '城堡又多一扇亮著的窗！'];
const noteIdeas = ['看清楚題目', '單位要寫', '再檢查一次', '慢慢計', '記住步驟', '字要寫清楚'];
const lampColors = ['#ffd77a', '#f5a8bd', '#a9d3f0', '#bfe3b4', '#d8c1f0'];

let state = E.fresh(), extras = E.freshExtras(), slots = [], geo = null, V = E.view(state);
let selected = null, busy = false, newest = '', newLamp = -1, newWindow = '', replaying = null, sayTimer, fireFrame, audioCtx;
let cam = { x: 500, y: 375, zoom: 1 }, drag = null, moved = false, panFrame = null;

const name = () => state.kingdom || `${state.name}的勇氣城堡`;
const lampsOn = () => V.lit.size;
const isPhone = () => matchMedia('(max-width:820px)').matches;

function persist() {
  try { localStorage.setItem(E.K2, JSON.stringify(state)); } catch (e) { say('暫時無法儲存，請在設定下載備份。'); }
}
function persistExtras() { try { localStorage.setItem(E.EXTRAS_KEY, JSON.stringify(extras)); } catch (e) {} }
function recompute() { V = E.view(state); state.history = V.good; }
function rebuild() {
  slots = E.makeSlots(state);
  const sec = {};
  for (const s of slots) {
    const a = sec[s.section] || (sec[s.section] = { l: 1e9, r: -1e9, y: 1e9, ids: [] });
    a.l = Math.min(a.l, s.x); a.r = Math.max(a.r, s.x + s.w); a.y = Math.min(a.y, s.y); a.ids.push(s.id);
  }
  for (const [k, a] of Object.entries(sec)) { a.m = (a.l + a.r) / 2; a.peak = a.y - (k === 'keep' ? 55 : 65); }
  geo = sec;
  recompute();
}
function load() {
  try {
    const raw = localStorage.getItem(E.K2);
    extras = E.readExtras(JSON.parse(localStorage.getItem(E.EXTRAS_KEY) || 'null'));
    const saved = E.readData(JSON.parse(raw || 'null'));
    if (saved) {
      // 第一次用 V3 打開時，原封不動另存一份 V2 存檔，方便回到舊版。
      if (raw && localStorage.getItem(E.SNAP_KEY) === null) localStorage.setItem(E.SNAP_KEY, raw);
      state = saved; rebuild(); return true;
    }
    const v1 = E.readV1(JSON.parse(localStorage.getItem(E.K1) || 'null'));
    if (!v1) return false;
    state = v1; rebuild(); persist(); return true;
  } catch (e) { return false; }
}

/* ---------- 畫面 ---------- */
function star(x, y, r = 12, fill = '#fff8de') {
  const p = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r * 0.45 : r; return `${(x + Math.cos(a) * d).toFixed(1)},${(y + Math.sin(a) * d).toFixed(1)}`; }).join(' ');
  return `<polygon points="${p}" fill="${fill}" stroke="#c39b5c" stroke-width="1.5"/>`;
}
function dark(hex, f) { return '#' + [1, 3, 5].map((i) => E.clamp(Math.round(parseInt(hex.slice(i, i + 2), 16) * f), 0, 255).toString(16).padStart(2, '0')).join(''); }
function shineOrder() { const m = new Map(); E.diary(state, V).forEach((d) => m.set(d.id, d)); return m; }

function brick(s, id, o, order) {
  const glow = V.lit.has(id), night = o.night, cx = s.x + s.w / 2, cy = s.y + s.h / 2, small = Math.min(s.w, s.h);
  const col = glow ? (night ? '#ffd889' : '#f5cd77') : (night ? dark(s.color, 0.52) : s.color);
  const edge = dark(col, 0.8), light = dark(col, 1.13), r = Math.min(5, s.h * 0.16), side = Math.max(1.7, s.w * 0.08);
  const cls = ['object-selectable', glow && !night ? 'sparkling' : '', selected === id ? 'object-selected' : '', newest === id ? 'new-object' : '', newWindow === id ? 'window-new' : ''].join(' ');
  let deco = '';
  if (glow && night) {
    const d = order.get(id), face = d ? faces[d.resident.id] : '';
    deco = `<path d="M${cx} ${s.y + 3}V${s.y + s.h - 4}M${s.x + 3} ${cy}H${s.x + s.w - side - 3}" stroke="#d9a24c" stroke-width="1.6" opacity=".75"/>`;
    if (face && small >= 17) deco += `<text x="${cx - side / 2}" y="${cy + small * 0.22}" font-size="${(small * 0.58).toFixed(1)}" text-anchor="middle">${face}</text>`;
  } else if (glow) {
    deco = `<g class="twinkle">${star(cx, cy, small * 0.27)}</g>${star(s.x + s.w * 0.75, s.y + s.h * 0.24, small * 0.1)}`;
  }
  return `<g data-oid="${id}" class="${cls}">
 ${glow ? `<ellipse cx="${cx}" cy="${cy}" rx="${s.w * (night ? 1.05 : 0.62)}" ry="${s.h * (night ? 1.25 : 0.75)}" fill="url(#goldAura)"${night ? ' class="lamp-glow"' : ' opacity=".7"'}/>` : ''}
 <rect x="${s.x + 1}" y="${s.y + 2}" width="${s.w - 2}" height="${s.h - 2}" rx="${r}" fill="${edge}"/>
 <rect x="${s.x + 1}" y="${s.y + 1}" width="${Math.max(1, s.w - side - 2)}" height="${Math.max(1, s.h - 4)}" rx="${r}" stroke="${edge}" stroke-width="1.5" fill="${col}"/>
 <path d="M${s.x + 4} ${s.y + Math.min(7, s.h * 0.2)}Q${cx} ${s.y + 1} ${s.x + s.w - side - 4} ${s.y + Math.min(7, s.h * 0.2)}" fill="none" stroke="${light}" stroke-width="2"/>
 ${night ? '' : `<rect x="${s.x + 3}" y="${s.y + 3}" width="${Math.max(0, s.w - side - 5)}" height="${Math.max(0, s.h - 7)}" fill="url(#grain)" opacity=".45" rx="${r}"/>`}
 ${deco}</g>`;
}
function plan(s, i, o) {
  const next = i === V.built.length && !o.export;
  if (next) {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2, k = Math.min(s.w, s.h) * 0.24;
    return `<g class="next-slot"><rect x="${s.x + 1.5}" y="${s.y + 1.5}" width="${s.w - 3}" height="${s.h - 3}" rx="5" fill="${o.night ? '#3d4a86' : '#ffffffd9'}" stroke="${o.night ? '#9fb6f0' : '#6f9fd0'}" stroke-width="2.4"/>
 <path d="M${cx - k} ${cy}H${cx + k}M${cx} ${cy - k}V${cy + k}" stroke="${o.night ? '#cfe0ff' : '#5c8fc4'}" stroke-width="2.6" stroke-linecap="round"/></g>`;
  }
  return `<rect x="${s.x + 1.5}" y="${s.y + 1.5}" width="${s.w - 3}" height="${s.h - 3}" rx="4" fill="${o.night ? '#ffffff08' : '#ffffff40'}" stroke="${o.night ? '#7d89c4' : '#9db8d6'}" stroke-width="1.4" stroke-dasharray="5 4"/>`;
}
function hat(part, o) {
  const a = geo[part];
  if (!a || part.startsWith('wing')) return '';
  const done = a.ids.every((id) => V.built.includes(id)), roof = E.colors(state)[2];
  if (!done) {
    if (o.export) return '';
    return `<path d="M${a.l - 8} ${a.y + 2}L${a.m} ${a.peak}L${a.r + 8} ${a.y + 2}" fill="none" stroke="${o.night ? '#7d89c4' : '#9db8d6'}" stroke-width="2" stroke-dasharray="7 5"/>`;
  }
  const col = o.night ? dark(roof, 0.6) : roof;
  return `<g class="flag-wave"><path d="M${a.l - 8} ${a.y + 2}L${a.m} ${a.peak}L${a.r + 8} ${a.y + 2}Z" fill="${col}" stroke="${dark(col, 0.76)}" stroke-width="4"/>
 <path d="M${a.m} ${a.peak}v-28" stroke="#9c8395" stroke-width="3"/><path d="M${a.m + 2} ${a.peak - 28}l33 11-33 14Z" fill="${o.night ? '#f2c46f' : '#f0be8f'}" stroke="#b99080" stroke-width="2"/></g>`;
}
function door(o) {
  if (!V.complete) return o.export ? '' : `<path d="M465 554V495a35 35 0 0 1 70 0v59" fill="none" stroke="${o.night ? '#7d89c4' : '#9db8d6'}" stroke-width="2" stroke-dasharray="7 5"/>`;
  return `${o.night ? '<ellipse cx="500" cy="520" rx="70" ry="60" fill="url(#goldAura)" class="lamp-glow"/>' : ''}
 <path d="M465 554V495a35 35 0 0 1 70 0v59Z" fill="${o.night ? '#7a5a52' : '#bb937e'}" stroke="#947369" stroke-width="4"/>
 ${o.night ? '<path d="M470 496a30 30 0 0 1 60 0Z" fill="#ffd889"/>' : ''}
 <path d="M500 461v93" stroke="#906d69" stroke-width="2"/><circle cx="488" cy="517" r="4" fill="#ffe9a1"/>
 ${o.night ? '' : star(500, 128, 12) + star(221, 349, 9) + star(778, 355, 9)}`;
}
// 每改正 8 次掛好一串燈。頭兩串連起塔頂，之後由塔頂向兩旁草地拉開。
function strand(k) {
  const L = geo.left, R = geo.right, M = geo.keep || geo.mini;
  const pt = (a) => ({ x: a.m, y: a.peak + 6 });
  if (L && R && M) {
    if (k === 0) return { a: pt(L), b: pt(M), sag: 40 };
    if (k === 1) return { a: pt(M), b: pt(R), sag: 40 };
    const left = k % 2 === 0, d = Math.floor((k - 2) / 2);
    const eave = (a, dir) => ({ x: dir < 0 ? a.l - 6 : a.r + 6, y: a.y + 4 + (d % 3) * 3 });
    return left ? { a: eave(L, -1), b: { x: L.l - 40 - d * 46, y: 562 - (d % 2) * 8 }, sag: 18, post: true } : { a: eave(R, 1), b: { x: R.r + 40 + d * 46, y: 562 - (d % 2) * 8 }, sag: 18, post: true };
  }
  const left = k % 2 === 0, d = Math.floor(k / 2);
  return { a: pt(M), b: { x: left ? M.l - 40 - d * 46 : M.r + 40 + d * 46, y: 562 }, sag: 22, post: true };
}
function garlands(o) {
  const g = E.garland(lampsOn());
  let wires = '', bulbs = '', posts = '';
  const count = g.done + (g.lamps ? 1 : 0) + (!o.export && !g.lamps ? 1 : 0);
  for (let k = 0; k < count; k++) {
    const st = strand(k), c = { x: (st.a.x + st.b.x) / 2, y: (st.a.y + st.b.y) / 2 + st.sag }, current = k === g.done;
    const at = (t) => ({ x: (1 - t) ** 2 * st.a.x + 2 * (1 - t) * t * c.x + t * t * st.b.x, y: (1 - t) ** 2 * st.a.y + 2 * (1 - t) * t * c.y + t * t * st.b.y });
    if (current && !g.lamps && o.export) continue;
    wires += `<path d="M${st.a.x} ${st.a.y}Q${c.x} ${c.y} ${st.b.x} ${st.b.y}" fill="none" stroke="${o.night ? '#c8b98f' : '#a8917c'}" stroke-width="1.6"${current ? ' stroke-dasharray="4 4" opacity=".7"' : ''}/>`;
    if (st.post) posts += `<path d="M${st.b.x} ${st.b.y}v26" stroke="#9c7f6c" stroke-width="4" stroke-linecap="round"/><circle cx="${st.b.x}" cy="${st.b.y}" r="4" fill="#c9a07d"/>`;
    for (let i = 0; i < E.LAMPS; i++) {
      const p = at((i + 0.5) / E.LAMPS), on = !current || i < g.lamps, n = k * E.LAMPS + i, col = lampColors[n % lampColors.length];
      if (on) bulbs += `<g${n === newLamp ? ' class="lamp-new"' : ''}><path d="M${p.x} ${p.y}v4" stroke="#8a7a6a" stroke-width="1.4"/>${o.night ? `<circle cx="${p.x}" cy="${p.y + 9}" r="11" fill="url(#goldAura)" class="lamp-glow"/>` : ''}<circle cx="${p.x}" cy="${p.y + 9}" r="5.4" fill="${col}" stroke="${dark(col, 0.78)}" stroke-width="1.3"/><circle cx="${p.x - 1.6}" cy="${p.y + 7.4}" r="1.6" fill="#fff" opacity=".8"/></g>`;
      else if (!o.export) bulbs += `<circle cx="${p.x}" cy="${p.y + 9}" r="5" fill="none" stroke="${o.night ? '#9aa3d6' : '#c8b49c'}" stroke-width="1.3" stroke-dasharray="2 2"/>`;
    }
  }
  return `<g id="garlands">${posts}${wires}${bulbs}</g>`;
}
function knight(o) {
  return `<g id="knight" transform="translate(214 610)" role="button" aria-label="提燈小騎士"><g class="knight-bob">
 <ellipse cx="2" cy="1" rx="23" ry="5" fill="#000" opacity=".16"/>
 <path d="M-12 -30Q-30 -12 -20 -2L-4 -6Z" fill="#e88fa6" stroke="#c97489" stroke-width="1.5"/>
 <rect x="-10" y="-6" width="8" height="7" rx="3" fill="#7f8fa8"/><rect x="3" y="-6" width="8" height="7" rx="3" fill="#7f8fa8"/>
 <rect x="-13" y="-32" width="27" height="29" rx="10" fill="#a6c6e6" stroke="#7398bd" stroke-width="2"/>
 <path d="M-6 -20h13" stroke="#e7c47d" stroke-width="3" stroke-linecap="round"/>
 <circle cx="0" cy="-47" r="17" fill="#e3ebf4" stroke="#8ea4bd" stroke-width="2.5"/>
 <rect x="-11" y="-53" width="22" height="14" rx="6.5" fill="#fde6d2"/>
 <circle cx="-4.5" cy="-46" r="2" fill="#5d5068"/><circle cx="4.5" cy="-46" r="2" fill="#5d5068"/>
 <circle cx="-8" cy="-42" r="2.2" fill="#f4b3b8" opacity=".7"/><circle cx="8" cy="-42" r="2.2" fill="#f4b3b8" opacity=".7"/>
 <path d="M-2.5 -42.5q2.5 2.6 5 0" stroke="#b9787a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
 <path d="M1 -63q9 -17 16 -6q-7 2 -12 9z" fill="#ef8fa8" stroke="#cf7189" stroke-width="1.2"/>
 <g transform="translate(11 -25)"><g class="lantern-arm"><path d="M0 0L11 7" stroke="#a6c6e6" stroke-width="6" stroke-linecap="round"/>
  <path d="M12 7v5" stroke="#8a7a6a" stroke-width="2"/>
  <circle cx="13" cy="20" r="${o.night ? 20 : 12}" fill="url(#goldAura)"${o.night ? ' class="lamp-glow"' : ''}/>
  <rect x="7" y="12" width="12" height="15" rx="3" fill="#ffe08a" stroke="#c99a4a" stroke-width="2"/><path d="M7 17h12" stroke="#c99a4a" stroke-width="1.2"/></g></g>
 </g></g>`;
}
function terrainDetail() {
  let out = '';
  const patches = ['#d0dda8', '#e5d3bc', '#c9d8d3', '#e2d5cf'];
  for (let i = 0; i < V.extra.length; i++) {
    if (i % 3 !== 0) continue;
    const { x, y } = E.extraXY(state, i), c = patches[Object.keys(E.themes).indexOf(E.themeAt(state, i))] || patches[0];
    const rx = 47 + E.rand(state, i, 714) * 23, ry = 22 + E.rand(state, i, 715) * 17;
    out += `<ellipse cx="${x}" cy="${y + 9}" rx="${rx}" ry="${ry}" fill="${c}" opacity=".30" transform="rotate(${(E.rand(state, i, 717) - 0.5) * 29} ${x} ${y + 9})"/>`;
  }
  for (let ch = 0; ch < Math.ceil(V.extra.length / 20); ch++) for (const z of [0, 1]) {
    const a = E.meadowZone(state, ch, z);
    out += `<path d="M500 570 Q${(500 + a.x) / 2} ${a.y + 84} ${a.x} ${a.y + 24}" stroke="#f8eccd" stroke-width="9" fill="none" opacity=".22" stroke-dasharray="2 17" stroke-linecap="round"/>`;
  }
  return out;
}
function ornament(type, i, x, y) {
  const v = Math.floor(E.rand(state, i, 318) * 5);
  if (type === 'garden') {
    if (v === 0 || v === 4) return `<path d="M${x} ${y + 13}q-6-18 4-34" stroke="#76a48a" stroke-width="3.5" fill="none"/><circle cx="${x + 4}" cy="${y - 23}" r="14" fill="#b7d4ab" stroke="#86aa8d" stroke-width="2"/><circle cx="${x - 9}" cy="${y - 17}" r="11" fill="#a2caa4"/><circle cx="${x + 15}" cy="${y - 13}" r="10" fill="#c4d9a4"/>`;
    if (v === 3) return `<path d="M${x - 12} ${y - 8}q-19-26-8-32q18-3 22 17q4-23 19-17q11 12-4 30" fill="#dec5ef" stroke="#b6a0d4" stroke-width="2"/><ellipse cx="${x}" cy="${y - 11}" rx="3" ry="12" fill="#a294b2"/>`;
    const c = v === 1 ? '#ebadc2' : '#c1b4e6';
    return `<path d="M${x} ${y + 13}v-28" stroke="#75a48b" stroke-width="3"/>${Array.from({ length: 5 }, (_, k) => { const a = k * Math.PI * 2 / 5; return `<circle cx="${x + Math.cos(a) * 10}" cy="${y - 18 + Math.sin(a) * 10}" r="8" fill="${c}"/>`; }).join('')}<circle cx="${x}" cy="${y - 18}" r="6.5" fill="#f0d595"/>`;
  }
  if (type === 'village') {
    if (v === 2) return `<path d="M${x} ${y + 13}v-38" stroke="#9c8080" stroke-width="4"/><circle cx="${x}" cy="${y - 28}" r="9" fill="#ffe3a6" stroke="#d8b184" stroke-width="2"/>`;
    if (v === 4) return `<path d="M${x - 19} ${y + 10}Q${x} ${y - 7} ${x + 19} ${y + 10}" fill="none" stroke="#c6aa94" stroke-width="7"/><path d="M${x - 19} ${y + 16}h38" stroke="#9c8177" stroke-width="3"/>`;
    const c = ['#e8b8ab', '#c3d6e2', '#d6b8e5', '#efd5a5'][v % 4];
    return `<rect x="${x - 16}" y="${y - 17}" width="32" height="30" rx="3" fill="${c}" stroke="${dark(c, 0.8)}" stroke-width="2"/><path d="M${x - 21} ${y - 18}l21-21 22 21Z" fill="#ba9eb5" stroke="#9f809b" stroke-width="2.5"/><rect x="${x - 4}" y="${y}" width="9" height="13" fill="#b48b7b"/><rect x="${x - 13}" y="${y - 12}" width="8" height="8" fill="#ffebb6"/>`;
  }
  if (type === 'guards') {
    if (v === 2) return `<ellipse cx="${x}" cy="${y + 2}" rx="21" ry="13" fill="#ecd8b6" stroke="#cfb497" stroke-width="2"/><path d="M${x - 10} ${y - 4}q-22-30-26-8" stroke="#d0b5a2" stroke-width="6" fill="none"/><circle cx="${x + 13}" cy="${y - 11}" r="9" fill="#edc5aa"/><circle cx="${x + 15}" cy="${y - 14}" r="2" fill="#756979"/><path d="M${x - 11} ${y + 9}v12M${x + 10} ${y + 9}v12" stroke="#a98c84" stroke-width="5"/>`;
    const c = ['#a8c5df', '#d6b8e7', '#e9b7af', '#acd0b8'][v % 4];
    return `<rect x="${x - 12}" y="${y - 1}" width="24" height="22" rx="8" fill="${c}" stroke="${dark(c, 0.8)}" stroke-width="2"/><circle cx="${x}" cy="${y - 14}" r="12" fill="#f1d1b1" stroke="#d8b29d" stroke-width="2"/><path d="M${x - 13} ${y - 19}q13-25 26 0v8h-26Z" fill="#afc2d1" stroke="#8b9eaf" stroke-width="2"/><circle cx="${x - 4}" cy="${y - 14}" r="1.5" fill="#695d62"/><circle cx="${x + 5}" cy="${y - 14}" r="1.5" fill="#695d62"/><path d="M${x - 4} ${y - 9}q5 6 9 0" fill="none" stroke="#9f7c79" stroke-width="1.5"/><path d="M${x + 10} ${y}l13 6-3 15-10 4-9-9 1-12Z" fill="#e4bf8b" stroke="#b28e65" stroke-width="2"/>${star(x + 11, y + 12, 5)}`;
  }
  if (v % 2 === 0) return `<path d="M${x} ${y + 12}v-37" stroke="#a28ba6" stroke-width="2.6"/><path d="M${x} ${y - 24}q-20-26-18-32q17-11 19 10q18-25 23-4q5 13-24 26Z" fill="${v === 0 ? '#efb5bf' : '#b5cce5'}" stroke="#b59fb0" stroke-width="2"/>`;
  return `<path d="M${x} ${y + 14}v-45" stroke="#998093" stroke-width="3"/><path d="M${x} ${y - 31}l28 9-28 12Z" fill="${v === 1 ? '#e5b2bd' : '#b4cde0'}" stroke="#a995ad" stroke-width="2"/>${star(x - 16, y - 13, 7)}`;
}
function extraGraphic(i, o) {
  const id = `e${i}`, { x, y } = E.extraXY(state, i), glow = V.lit.has(id), k = E.extraScale(state, i);
  const cls = ['object-selectable', glow ? 'sparkling' : '', selected === id ? 'object-selected' : '', newest === id ? 'new-object' : '', newWindow === id ? 'window-new' : ''].join(' ');
  return `<g data-oid="${id}" class="${cls}"><g transform="translate(${x} ${y}) scale(${k}) translate(${-x} ${-y})"${o.night && !glow ? ' filter="url(#dim)"' : ''}>
 ${glow ? `<circle cx="${x}" cy="${y - 16}" r="40" fill="url(#goldAura)"/>` : ''}
 <ellipse cx="${x}" cy="${y + 13}" rx="20" ry="5" fill="#6f9782" opacity=".25"/>${ornament(E.themeAt(state, i), i, x, y)}
 ${glow ? `<g class="twinkle">${star(x + 18, y - 34, 10)}</g>${star(x - 14, y - 29, 5)}` : ''}</g></g>`;
}
function scene(o = {}) {
  const b = E.edges(state, V), gaps = Math.ceil((b.max - b.min) / 500) + 2, start = Math.floor(b.min / 500) * 500, night = o.night;
  let clouds = '', hills = '', blossoms = '', sky = '';
  for (let j = 0; j < gaps; j++) {
    const x = start + j * 500, y = 150 + E.rand(state, j, 520) * 42;
    if (night) for (let k = 0; k < 16; k++) sky += `<circle cx="${(x + E.rand(state, j * 40 + k, 640) * 500).toFixed(1)}" cy="${(-200 + E.rand(state, j * 40 + k, 641) * 520).toFixed(1)}" r="${(0.8 + E.rand(state, j * 40 + k, 642) * 1.7).toFixed(1)}" fill="#fff8e1" opacity="${(0.45 + E.rand(state, j * 40 + k, 643) * 0.5).toFixed(2)}"/>`;
    else clouds += `<g fill="#fffdf4" opacity=".55"><ellipse cx="${x + 180}" cy="${y + 12}" rx="81" ry="18"/><circle cx="${x + 140}" cy="${y}" r="33"/><circle cx="${x + 196}" cy="${y - 7}" r="38"/></g>`;
    hills += `<ellipse cx="${x + 260}" cy="603" rx="360" ry="178" fill="${night ? (j % 2 ? '#34506a' : '#2c4860') : (j % 2 ? '#dce6d0' : '#c4dac4')}"/>`;
    for (let k = 0; k < 9; k++) {
      const fx = x + E.rand(state, j * 20 + k, 612) * 500, fy = 588 + E.rand(state, j * 20 + k, 613) * 34;
      blossoms += night ? `<circle cx="${fx}" cy="${fy - 14}" r="2.2" fill="#fff3a8" class="lamp-glow"/>` : `<circle cx="${fx}" cy="${fy}" r="3" fill="${k % 2 ? '#f0b8c4' : '#fff0cc'}"/>`;
    }
  }
  const defs = `<defs>
 <linearGradient id="v3Sky" x1="0" y1="0" x2="0" y2="1">${night ? '<stop stop-color="#1d2350"/><stop offset=".6" stop-color="#363d78"/><stop offset="1" stop-color="#47507f"/>' : '<stop stop-color="#f9e1e6"/><stop offset=".64" stop-color="#fff0df"/><stop offset="1" stop-color="#dbe9df"/>'}</linearGradient>
 <radialGradient id="goldAura"><stop stop-color="#ffe6a1" stop-opacity=".95"/><stop offset="1" stop-color="#ffe7a1" stop-opacity="0"/></radialGradient>
 <pattern id="grain" width="19" height="19" patternUnits="userSpaceOnUse"><path d="M2 3l4 1M14 10l-3 2M4 16l3-1" stroke="white" stroke-width="1" opacity=".45"/></pattern>
 <filter id="dim"><feColorMatrix type="matrix" values=".5 0 0 0 .03 0 .5 0 0 .04 0 0 .62 0 .1 0 0 0 1 0"/></filter>
 <mask id="moonCut"><rect x="700" y="0" width="260" height="240" fill="#fff"/><circle cx="805" cy="88" r="46" fill="#000"/></mask>
 </defs>`;
  const W = b.max - b.min + 600;
  const bg = `<rect x="${b.min - 300}" y="-250" width="${W}" height="1150" fill="url(#v3Sky)"/>${sky}${clouds}
 ${night ? '<circle cx="829" cy="104" r="51" fill="#fff3c4" mask="url(#moonCut)"/><circle cx="829" cy="104" r="80" fill="url(#goldAura)" opacity=".25"/>' : '<circle cx="829" cy="104" r="51" fill="#fff0bf" opacity=".78"/>'}${hills}
 <rect x="${b.min - 300}" y="553" width="${W}" height="400" fill="${night ? '#27404f' : '#b5d5b8'}"/>
 <path d="M${b.min - 300} 582 Q500 551 ${b.max + 300} 582" fill="none" stroke="${night ? '#33526a' : '#a0c6a3'}" stroke-width="8"/>
 ${blossoms}<g id="kingdomLandscape">${terrainDetail()}</g><ellipse cx="500" cy="572" rx="306" ry="33" fill="${night ? '#0d1a2a70' : '#607f7460'}"/>`;
  const order = shineOrder();
  const planned = o.export ? '' : slots.map((s, i) => (i >= V.built.length ? plan(s, i, o) : '')).join('');
  return `${defs}${bg}<g id="blueprint">${planned}</g>
 <g id="castleBricks">${V.built.map((id, i) => brick(slots[i], id, o, order)).join('')}</g>
 <g id="castleFinish">${Object.keys(geo).map((k) => hat(k, o)).join('')}${door(o)}</g>
 ${garlands(o)}<g id="kingdomExtras">${V.extra.map((_, i) => extraGraphic(i, o)).join('')}</g>${knight(o)}`;
}

/* ---------- 鏡頭：城堡永遠放在兩粒標籤之下，iPhone 上文字不會遮住城堡 ---------- */
function stageBox() { const r = $('stage').getBoundingClientRect(); return { w: Math.max(1, r.width), h: Math.max(1, r.height) }; }
function cameraView() {
  const { w, h } = stageBox(), height = 580 / cam.zoom, width = height * Math.max(0.3, w / h);
  return { x: cam.x - width / 2, y: cam.y - height / 2, width, height };
}
function applyCamera() { const v = cameraView(); svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.width} ${v.height}`); }
function frame(box, padTop, padBottom, padSide) {
  const { w, h } = stageBox();
  const s = Math.min((w - padSide * 2) / box.w, (h - padTop - padBottom) / box.h);
  const shift = ((padTop + h - padBottom) / 2 - h / 2) / s;
  cam = { x: box.x + box.w / 2, y: box.y + box.h / 2 - shift, zoom: E.clamp(580 * s / h, 0.07, 4) };
  applyCamera();
}
function castleBox() { return { x: 180, y: 128, w: 640, h: 492 }; }
function home() { const p = isPhone(); frame(castleBox(), p ? 44 : 54, p ? 54 : 56, p ? 6 : 16); }
function fit() {
  const b = E.edges(state, V), c = castleBox();
  const l = Math.min(b.min - 40, c.x), r = Math.max(b.max + 40, c.x + c.w);
  const p = isPhone();
  frame({ x: l, y: Math.min(b.top - 30, c.y), w: r - l, h: Math.max(b.bottom, c.y + c.h) - Math.min(b.top - 30, c.y) }, p ? 44 : 54, p ? 46 : 54, 8);
}
function reveal(x, y) {
  const v = cameraView();
  let tx = cam.x, ty = cam.y;
  const l = v.x + v.width * 0.1, r = v.x + v.width * 0.9, t = v.y + v.height * 0.15, btm = v.y + v.height * 0.88;
  if (x < l) tx += x - l; else if (x > r) tx += x - r;
  if (y < t) ty += y - t; else if (y > btm) ty += y - btm;
  if (Math.abs(tx - cam.x) < 3 && Math.abs(ty - cam.y) < 3) return;
  if (panFrame) cancelAnimationFrame(panFrame);
  const sx = cam.x, sy = cam.y, t0 = performance.now(), dur = reduced.matches ? 0 : 440;
  const step = (now) => {
    const f = dur ? E.clamp((now - t0) / dur, 0, 1) : 1, e = 1 - Math.pow(1 - f, 3);
    cam.x = sx + (tx - sx) * e; cam.y = sy + (ty - sy) * e; applyCamera();
    panFrame = f < 1 ? requestAnimationFrame(step) : null;
  };
  panFrame = requestAnimationFrame(step);
}

/* ---------- 面板 ---------- */
function btn(emoji, title, sub) { return `<span class="emoji">${emoji}</span><span>${title}<small>${sub}</small></span>`; }
function render() {
  const night = extras.night;
  document.body.classList.toggle('night', night);
  svg.innerHTML = scene({ night }); applyCamera();
  const g = E.garland(lampsOn()), left = state.target - V.built.length;
  $('title').textContent = name();
  document.title = `${name()} · 勇氣城堡 V3`;
  $('subtitle').textContent = night ? 'COURAGE CASTLE V3 · 每次改正，都是城堡的一盞燈' : 'COURAGE CASTLE V3 · 一題一積木，改正亮一盞燈';
  $('nightBtn').innerHTML = night ? '☀️ <span>日間</span>' : '🌙 <span>夜景</span>';
  $('progLabel').textContent = V.complete ? `原定目標 ${state.target} 題已完成` : '原定目標';
  $('current').textContent = V.complete ? V.total : V.built.length;
  $('goalText').textContent = state.target;
  $('barfill').style.width = `${Math.min(1, V.built.length / state.target) * 100}%`;
  $('lampText').textContent = `💡 ${lampsOn()} 盞`;
  $('chipLeft').textContent = replaying ? '🎬 回放中…' : night ? (isPhone() ? '🌙 夜景' : '🌙 夜晚的勇氣王國') : state.finalized ? '👑 王國已完成' : V.complete ? `🏰 城堡完成！額外 +${V.extra.length}` : (isPhone() ? `🗺️ 還差 ${left} 塊` : `🗺️ 城堡藍圖：還差 ${left} 塊`);
  $('chipRight').textContent = lampsOn() ? (g.done ? (isPhone() ? `💡 ${g.done} 串燈` : `💡 已掛好 ${g.done} 串燈`) : `💡 ${g.lamps}/${E.LAMPS} 盞`) : '';
  const off = busy || !!replaying || state.finalized;
  $('add').disabled = off;
  $('add').innerHTML = V.complete ? btn('🌱', '繼續建造', '為王國增加新風景') : btn('🧱', '完成一題', '為城堡加一塊積木');
  $('shine').disabled = off || lampsOn() === V.total;
  $('shine').innerHTML = btn('✨', '勇敢改正', selected ? '點亮選好的積木' : isPhone() ? '亮一盞燈' : '亮一盞燈，再寫下學到甚麼');
  $('undo').disabled = off || !state.history.length;
  $('replayBtn').disabled = busy || state.history.length < 2;
  $('replayBtn').innerHTML = replaying ? '⏹ <span>停止</span>' : '🎬 <span>回放</span>';
  $('replayBtn').classList.toggle('on', !!replaying);
  $('finish').hidden = !V.complete || state.finalized;
  $('replayCelebration').hidden = !V.complete || !!replaying;
  $('sound').textContent = state.sound ? '♫' : '♪';
  renderStats();
}
function renderStats() {
  const st = E.stats(state.history), max = Math.max(1, ...st.week.map((d) => d.add + d.shine));
  const bars = st.week.map((d) => {
    const a = d.add / max * 100, s = d.shine / max * 100;
    return `<div class="col" title="${d.add} 題、改正 ${d.shine} 次">${d.add + d.shine ? `${s ? `<div class="seg s" style="height:${s}%"></div>` : ''}${a ? `<div class="seg a" style="height:${a}%"></div>` : ''}` : '<div class="seg zero"></div>'}</div>`;
  }).join('');
  $('stats').innerHTML = `<div class="s-top">今日 <b>${st.today.add}</b> 題 · 改正 <b>${st.today.shine}</b> 次 · 連續 <b>${st.streak}</b> 天</div>
 <div class="bars">${bars}</div><div class="bars-l">${st.week.map((d, i) => `<span${i === 6 ? ' class="today"' : ''}>${d.label}</span>`).join('')}</div>`;
}
function say(text, opt = {}) {
  const box = $('say'), act = $('sayAction');
  clearTimeout(sayTimer);
  $('sayText').textContent = text;
  box.classList.toggle('gold', !!opt.gold);
  box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
  if (opt.action) { act.hidden = false; act.textContent = opt.action[0]; act.onclick = () => { act.hidden = true; opt.action[1](); }; }
  else act.hidden = true;
  if (!opt.stay) sayTimer = setTimeout(idleSay, opt.action ? 12000 : 7000);
}
function idleSay() {
  $('say').classList.remove('gold'); $('sayAction').hidden = true;
  const g = E.garland(lampsOn());
  let t;
  if (state.finalized) t = '👑 這是你親手建成的勇氣王國。';
  else if (!V.built.length) t = '🧱 完成第一題，砌下第一塊積木吧！';
  else if (!V.complete) t = `🗺️ 「＋」就是下一塊積木的位置，還差 ${state.target - V.built.length} 塊。`;
  else t = `🌱 城堡已完成！再改正 ${E.LAMPS - g.lamps} 次，就掛好第 ${g.current} 串燈。`;
  $('sayText').textContent = t;
}
function music(kind) {
  if (!state.sound) return;
  try {
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    audioCtx ??= new A(); if (audioCtx.state === 'suspended') audioCtx.resume();
    const tones = kind === 'shine' ? [523, 659, 784] : kind === 'win' ? [392, 523, 659, 784, 1047] : kind === 'patrol' ? [784, 988, 1175] : kind === 'garland' ? [523, 659, 784, 1047, 1319] : [349, 440];
    tones.forEach((f, i) => {
      const t = audioCtx.currentTime + i * 0.085, o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = kind === 'patrol' ? 'triangle' : 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 0.028); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 0.32);
    });
  } catch (e) {}
}

/* ---------- 操作 ---------- */
function dialog(html) { hideBubble(); $('dialog').innerHTML = html; $('overlay').classList.remove('hidden'); $('dialog').scrollTop = 0; }
function closeDialog() { $('overlay').classList.add('hidden'); }
function doAction(evt) {
  if (busy || state.finalized || replaying) return;
  if (state.history.length >= E.MAX_HISTORY) { say('建造紀錄已非常豐富，請在設定下載備份。'); return; }
  evt.ts = Date.now();
  busy = true; selected = null; hideBubble();
  state.history.push(evt); recompute(); persist();
  if (evt.type === 'shine') { newWindow = evt.id; newLamp = lampsOn() - 1; } else newest = evt.id;
  render();
  if (evt.type === 'extra') { const p = E.extraXY(state, V.extra.length - 1); reveal(p.x, p.y); }
  music(evt.type === 'shine' ? 'shine' : 'add');
  if (evt.type === 'add') say(cheerful[Math.floor(E.rand(state, V.total, 951) * cheerful.length)]);
  else if (evt.type === 'extra') say('你的勇氣王國又多一道風景！');
  setTimeout(() => {
    newest = ''; newWindow = ''; newLamp = -1; busy = false; render();
    if (evt.type === 'shine') celebrateShine(evt.id);
    else if (evt.type === 'add' && V.complete) fireworks('castle');
    else if (evt.type === 'extra' && V.extra.length % 20 === 0) say('🎉 一個新區域建成了！', { gold: true });
  }, reduced.matches ? 80 : 760);
}
function action(kind) {
  if (busy || state.finalized || replaying) return;
  if (kind === 'add') {
    if (!V.complete) doAction({ type: 'add', id: `c${V.built.length}` });
    else if (!state.themes[String(V.chapter)]) themeDialog();
    else doAction({ type: 'extra', id: `e${V.extra.length}` });
    return;
  }
  const id = E.pickWindow(state, V, selected);
  if (!id) { say(V.total ? '每一塊積木都亮著了，先再完成一題吧！' : '先完成一題，就有積木可以點亮。'); return; }
  doAction({ type: 'shine', id });
}
function undo() {
  if (busy || state.finalized || replaying || !state.history.length) return;
  const e = state.history.pop(); selected = null; hideBubble(); recompute(); persist(); render();
  say(e.type === 'shine' ? '已收起剛才那盞燈。' : '已復原上一步建造。');
}
function shineEvent(id) { return state.history.find((e) => e.type === 'shine' && e.id === id); }
function celebrateShine(id) {
  const d = E.diary(state, V).find((x) => x.id === id), g = E.garland(lampsOn());
  if (!d) return;
  const write = ['✏️ 寫日記', () => noteDialog(id)];
  if (g.lamps === 0) { music('garland'); say(`🎉 第 ${g.done} 串勇氣燈掛好了！`, { gold: true, action: write }); }
  else say(`✦ ${courage[d.n % courage.length]} ${d.resident.name}搬進來了。`, { gold: true, action: write });
}
function noteDialog(id) {
  const e = shineEvent(id); if (!e) return;
  const d = E.diary(state, V).find((x) => x.id === id);
  dialog(`<div class="dialog-art">${faces[d.resident.id]}</div>
 <h2>第 ${d.no} 塊積木的小紙條</h2>
 <p>想寫就寫，不寫也可以。</p>
 <label for="noteText">這次學到甚麼？（可以略過）</label>
 <textarea id="noteText" class="note-input" maxlength="${E.NOTE_MAX}" placeholder="例如：要先看清楚單位">${esc(e.note || '')}</textarea>
 <div class="note-count"><span id="noteCount">${(e.note || '').length}</span>/${E.NOTE_MAX}</div>
 <div class="chips">${noteIdeas.map((t) => `<button data-idea="${t}">${t}</button>`).join('')}</div>
 <button class="primary" id="saveNote">📒 放進勇氣日記</button>
 <button class="quiet" id="skipNote">取消</button>`);
  const box = $('noteText'), count = () => { $('noteCount').textContent = box.value.length; };
  box.oninput = count;
  document.querySelectorAll('[data-idea]').forEach((b) => b.onclick = () => {
    box.value = (box.value ? `${box.value}，` : '') + b.dataset.idea; box.value = box.value.slice(0, E.NOTE_MAX); count(); box.focus();
  });
  $('saveNote').onclick = () => {
    const note = E.clean(box.value, E.NOTE_MAX);
    if (note) e.note = note; else delete e.note;
    persist(); closeDialog(); render();
    say(note ? '📒 已放進勇氣日記。點一下亮著的積木就能重溫。' : '紙條已清空，隨時可以再寫。', { gold: !!note });
  };
  $('skipNote').onclick = () => closeDialog();
  if (!isPhone()) setTimeout(() => box.focus({ preventScroll: true }), 60);
}

/* ---------- 小紙條氣泡 ---------- */
function hideBubble() { $('bubble').hidden = true; }
function showBubble(id) {
  const d = E.diary(state, V).find((x) => x.id === id), node = svg.querySelector(`[data-oid="${id}"]`);
  if (!d || !node) return;
  const date = d.ts ? new Date(d.ts).toLocaleDateString('zh-HK', { month: 'long', day: 'numeric' }) : '早前';
  if (isPhone()) {
    // 手機畫面細，紙條放在城堡下面的訊息欄，不蓋住城堡。
    node.classList.remove('patrol-twinkle'); void node.getBoundingClientRect(); node.classList.add('patrol-twinkle');
    say(`${faces[d.resident.id]} 第 ${d.no} 塊 · ${date}：${d.note ? `「${d.note}」` : `${d.resident.name}住在這裏，還沒有小紙條。`}`, { gold: true, action: [d.note ? '✏️ 修改' : '✏️ 寫下', () => noteDialog(id)] });
    $('say').scrollIntoView({ block: 'nearest', behavior: reduced.matches ? 'auto' : 'smooth' });
    return;
  }
  const b = $('bubble');
  b.innerHTML = `<button class="b-x" aria-label="關閉">×</button><div class="b-date">${faces[d.resident.id]} ${date} · 第 ${d.no} 塊積木</div>
 <div class="b-note${d.note ? '' : ' empty'}">${d.note ? `「${esc(d.note)}」` : '這盞燈還沒有小紙條。'}</div>
 <div class="b-meta">${esc(d.resident.name)}住在這扇窗：${esc(d.resident.line)}</div>
 <div class="b-row"><button id="bEdit">${d.note ? '✏️ 修改' : '✏️ 寫下學到甚麼'}</button></div>`;
  b.hidden = false;
  b.querySelector('.b-x').onclick = hideBubble;
  $('bEdit').onclick = () => noteDialog(id);
  const st = $('stage').getBoundingClientRect(), r = node.getBoundingClientRect(), bw = b.offsetWidth, bh = b.offsetHeight;
  let x = E.clamp(r.left + r.width / 2 - st.left - bw / 2, 12, st.width - bw - 12);
  let y = r.top - st.top - bh - 10;
  if (y < 8) y = Math.min(st.height - bh - 8, r.bottom - st.top + 10);
  b.style.left = `${x}px`; b.style.top = `${Math.max(8, y)}px`;
}

/* ---------- 提燈小騎士 ---------- */
function patrol() {
  if (busy || replaying) return;
  const k = svg.querySelector('#knight');
  k?.classList.remove('knight-hop', 'knight-raise'); void k?.getBoundingClientRect();
  k?.classList.add('knight-hop', 'knight-raise');
  setTimeout(() => k?.classList.remove('knight-hop', 'knight-raise'), 1100);
  const list = E.diary(state, V);
  if (!list.length) { say('🛡️ 小騎士提著燈等你：勇敢改正一次，城堡就會亮起第一扇窗！'); music('add'); return; }
  extras.patrols++; persistExtras();
  const d = list[Math.floor(E.rand(state, extras.patrols, 2401) * list.length)];
  const node = svg.querySelector(`[data-oid="${d.id}"]`);
  node?.classList.remove('patrol-twinkle'); void node?.getBoundingClientRect(); node?.classList.add('patrol-twinkle');
  music('patrol');
  say(d.note ? `🛡️ 小騎士巡到第 ${d.no} 塊：「${d.note}」` : `🛡️ 小騎士向${d.resident.name}揮手：${d.resident.line}`, { gold: true, action: ['看看', () => showBubble(d.id)] });
}

/* ---------- 回放 ---------- */
function stopReplay(msg = true) {
  if (!replaying) return;
  clearTimeout(replaying.timer); replaying = null; newest = ''; recompute(); render();
  if (msg) say('回放完畢。每一塊積木，都是你一題一題砌出來的！', { gold: true });
}
function playReplay() {
  if (replaying) { stopReplay(false); idleSay(); return; }
  if (busy || state.history.length < 2) return;
  closeDialog(); hideBubble(); selected = null;
  const full = state.history.slice(), gap = E.clamp(9000 / full.length, 22, 380);
  replaying = { i: 0 };
  say('🎬 由第一塊積木開始重看…', { stay: true });
  const step = () => {
    if (!replaying) return;
    replaying.i++;
    V = E.view({ ...state, history: full.slice(0, replaying.i) });
    const e = full[replaying.i - 1];
    newest = gap > 120 && e.type !== 'shine' ? e.id : '';
    render();
    if (replaying.i < full.length) replaying.timer = setTimeout(step, gap);
    else replaying.timer = setTimeout(() => stopReplay(true), 900);
  };
  render(); replaying.timer = setTimeout(step, 300);
}

/* ---------- 對話框 ---------- */
function themeDialog() {
  const c = V.chapter;
  dialog(`<div class="dialog-art">🌈</div><h2>接下來想建造甚麼？</h2>
 <p>城堡已經建成！現在由你決定王國的下一個角落，每 20 題建成一區。</p>
 <div class="theme-grid">${Object.entries(E.themes).map(([k, t]) => `<button class="theme-card" data-theme="${k}"><span class="theme-icon">${t[0]}</span>${t[1]}<small>${t[2]}</small></button>`).join('')}</div>
 <button id="later" class="quiet">下次再決定</button>`);
  document.querySelectorAll('[data-theme]').forEach((b) => b.onclick = () => {
    state.themes[String(c)] = b.dataset.theme; persist(); closeDialog();
    say(`太好了！開始建造${E.themes[b.dataset.theme][1]}吧！`);
  });
  $('later').onclick = closeDialog;
}
function garlandDialog() {
  const g = E.garland(lampsOn()), met = Math.min(E.residents.length, lampsOn());
  const known = new Set(E.diary(state, V).slice(0, E.residents.length).map((d) => d.resident.id));
  dialog(`<div class="dialog-art">💡</div><h2>勇氣燈串</h2>
 <p>每勇敢改正一次，就亮一盞燈；<br>每 ${E.LAMPS} 盞連成一串，掛在城堡上。</p>
 <div class="stat-row"><div class="stat-card"><b>${lampsOn()}</b>亮著的燈</div><div class="stat-card"><b>${g.done}</b>掛好的燈串</div><div class="stat-card"><b>${extras.patrols}</b>騎士巡邏</div></div>
 <div class="success-tag">第 ${g.current} 串：${g.lamps} / ${E.LAMPS} 盞</div>
 <div class="lamp-dots">${Array.from({ length: E.LAMPS }, (_, i) => `<i class="${i < g.lamps ? 'on' : ''}"></i>`).join('')}</div>
 <h2 style="font-size:20px;margin-top:16px">窗後小住客 ${met}/${E.residents.length}</h2>
 <p>每次改正，就有一位小住客搬進亮燈的窗。<br>切換到夜景，就看得見牠們。</p>
 <div class="res-grid">${E.residents.map((r) => known.has(r.id) ? `<div class="res" title="${esc(r.line)}"><span class="r-face">${faces[r.id]}</span>${esc(r.name)}</div>` : '<div class="res locked"><span class="r-face">🏠</span>等待入住</div>').join('')}</div>
 <p>🛡️ 點一下提燈小騎士，牠會去巡邏亮著的窗。</p>
 <button class="primary" id="gNight">${extras.night ? '☀️ 回到日間' : '🌙 看看夜景'}</button>
 <button class="quiet" id="gClose">返回城堡</button>`);
  $('gNight').onclick = () => { closeDialog(); toggleNight(); };
  $('gClose').onclick = closeDialog;
}
function diaryDialog(filter = 'notes') {
  const all = E.diary(state, V).reverse(), list = filter === 'notes' ? all.filter((d) => d.note) : all;
  const day = (ts) => ts ? new Date(ts).toLocaleDateString('zh-HK', { month: 'numeric', day: 'numeric' }) : '早前';
  dialog(`<div class="dialog-art">📒</div><h2>勇氣日記</h2>
 <p>${all.length ? `一共改正了 ${all.length} 次，寫下 ${all.filter((d) => d.note).length} 張小紙條。` : '勇敢改正之後，可以在這裏寫下學到甚麼。'}</p>
 <div class="diary-tools"><button data-f="notes" class="${filter === 'notes' ? 'on' : ''}">有紙條的</button><button data-f="all" class="${filter === 'all' ? 'on' : ''}">全部亮燈</button>${all.some((d) => d.note) ? '<button id="printDiary">🖨️ 列印</button>' : ''}</div>
 ${list.length ? `<ul class="diary-list">${list.map((d) => `<li><span class="d-face">${faces[d.resident.id]}</span><div class="d-body"><div class="d-note${d.note ? '' : ' empty'}">${d.note ? esc(d.note) : '還沒有小紙條'}</div><div class="d-meta">${day(d.ts)} · 第 ${d.no} 塊積木 · ${esc(d.resident.name)}</div></div><button data-see="${d.id}">看看</button><button data-edit="${d.id}">✏️</button></li>`).join('')}</ul>` : `<div class="empty-box">${filter === 'notes' && all.length ? '還沒有小紙條，點「全部亮燈」補寫吧。' : '還沒有亮燈的積木。'}</div>`}
 <button class="quiet" id="dClose">返回城堡</button>`);
  document.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => diaryDialog(b.dataset.f));
  document.querySelectorAll('[data-see]').forEach((b) => b.onclick = () => { closeDialog(); focusOn(b.dataset.see); });
  document.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => noteDialog(b.dataset.edit));
  if ($('printDiary')) $('printDiary').onclick = printDiary;
  $('dClose').onclick = closeDialog;
}
function focusOn(id) {
  const n = id[0] === 'c' ? Number(id.slice(1)) : -1;
  if (n >= 0) { const s = slots[n]; reveal(s.x + s.w / 2, s.y + s.h / 2); }
  else { const p = E.extraXY(state, Number(id.slice(1))); reveal(p.x, p.y - 15); }
  setTimeout(() => showBubble(id), reduced.matches ? 30 : 480);
}
function printDiary() {
  const list = E.diary(state, V).filter((d) => d.note);
  $('printArea').innerHTML = `<h1>${esc(name())} · 勇氣日記</h1><p>${esc(state.name)} 一共勇敢改正了 ${lampsOn()} 次。</p><ol>${list.map((d) => `<li>${esc(d.note)}<div class="pm">${d.ts ? new Date(d.ts).toLocaleDateString('zh-HK') : ''} · 第 ${d.no} 塊積木 · ${esc(d.resident.name)}</div></li>`).join('')}</ol>`;
  closeDialog(); setTimeout(() => window.print(), 80);
}
function stopFireworks() { if (fireFrame) cancelAnimationFrame(fireFrame); fireFrame = null; $('fireworks').style.display = 'none'; }
function fireworks(occasion = 'replay') {
  stopFireworks(); music('win');
  const after = () => { if (occasion === 'castle') castleDialog(); else if (occasion === 'final') resultDialog(); };
  if (reduced.matches) { if (occasion === 'replay') say('🎆 你的王國閃耀著勇氣的光芒！', { gold: true }); after(); return; }
  const cvs = $('fireworks'); cvs.style.display = 'block';
  const r = $('stage').getBoundingClientRect(), ctx = cvs.getContext('2d');
  if (!ctx || r.width <= 0 || r.height <= 0) { stopFireworks(); after(); return; }
  const dpr = Math.min(devicePixelRatio || 1, 2); cvs.width = r.width * dpr; cvs.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const parts = [], t0 = performance.now(), duration = occasion === 'replay' ? 5200 : 6100; let old = -1;
  const burst = () => {
    const x = r.width * (0.12 + Math.random() * 0.76), y = r.height * (0.12 + Math.random() * 0.4), color = ['#ed9fcb', '#8fc8e9', '#f4ce76', '#8dd3b1', '#beaae9'][Math.floor(Math.random() * 5)];
    for (let k = 0; k < 64; k++) { const a = k * Math.PI / 32, v = 1.4 + Math.random() * 3.5; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color, size: 1.8 + Math.random() * 2.2 }); }
  };
  const tick = (t) => {
    const el = t - t0; ctx.clearRect(0, 0, r.width, r.height);
    if (Math.floor(el / 650) > old && el < duration - 1000) { burst(); old = Math.floor(el / 650); }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.042; p.life -= 0.016;
      ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, p.size * p.life), 0, Math.PI * 2); ctx.fill();
      if (p.life <= 0) parts.splice(i, 1);
    }
    ctx.globalAlpha = 1;
    if (el < duration) fireFrame = requestAnimationFrame(tick); else { stopFireworks(); after(); }
  };
  fireFrame = requestAnimationFrame(tick);
}
function castleDialog() {
  if (!V.complete || state.finalized) return;
  dialog(`<div class="dialog-art">🎊🏰</div><div class="success-tag">✦ 原定目標，完成了！ ✦</div>
 <h2>${esc(state.name)}，勇氣城堡建成了！</h2>
 <p>你完成了 <b>${state.target}</b> 題，亮起 <b>${lampsOn()}</b> 盞勇氣燈。<br>現在可以欣賞成果，也可以自願繼續挑戰。</p>
 <div class="dialog-actions"><button class="minor-action" id="rest">🌙 今天完成了</button><button class="primary" id="more">🌱 繼續挑戰！</button></div>`);
  $('rest').onclick = () => { closeDialog(); say('今天的努力非常棒，隨時都可以再回來！', { gold: true }); };
  $('more').onclick = themeDialog;
}
function finishDialog() {
  if (!V.complete || state.finalized) return;
  dialog(`<div class="dialog-art">👑</div><h2>由你決定何時完成！</h2>
 <p>你已完成原定目標，還額外挑戰了 <b>${V.extra.length}</b> 題！<br>覺得王國已經建好了嗎？<br>繼續或現在完成，都是很棒的選擇。</p>
 <div class="dialog-actions"><button class="minor-action" id="keepGoing">🌱 我想繼續建造</button><button class="primary" id="yesFinish">👑 我決定完成了！</button></div>`);
  $('keepGoing').onclick = closeDialog;
  $('yesFinish').onclick = () => { state.finalized = true; state.finalDate = new Date().toISOString(); persist(); render(); closeDialog(); fireworks('final'); };
}
function resultDialog() {
  dialog(`<div class="dialog-art">🎉👑</div><div class="success-tag">✦ 獨一無二的勇氣王國 ✦</div>
 <h2>${esc(name())}</h2><p>${esc(state.name)}，這是你用努力和勇氣建成的世界！</p>
 <div class="stat-row"><div class="stat-card"><b>${V.total}</b>完成題目</div><div class="stat-card"><b>${lampsOn()}</b>勇敢改正</div><div class="stat-card"><b>${V.extra.length}</b>額外挑戰</div></div>
 <button id="downloadPNG" class="primary">📸 下載紀念圖</button>
 <button id="backupResult" class="minor-action">💾 下載建造紀錄</button>
 <div class="dialog-actions"><button id="admire" class="quiet">🏰 欣賞王國</button><button id="reopen" class="quiet">🌱 重新開放建造</button></div>`);
  $('downloadPNG').onclick = exportPNG; $('backupResult').onclick = backup;
  $('admire').onclick = () => { closeDialog(); fit(); };
  $('reopen').onclick = () => {
    dialog(`<div class="dialog-art">🌱</div><h2>重新開放建造？</h2><p>所有積木、燈和小紙條都會保留，完成狀態會變回建造中。</p>
 <button class="primary" id="reopenYes">確認繼續建造</button><button class="quiet" id="backResult">返回成果展示</button>`);
    $('reopenYes').onclick = () => { state.finalized = false; state.finalDate = null; persist(); render(); closeDialog(); say('歡迎繼續建造你的王國！'); };
    $('backResult').onclick = resultDialog;
  };
}
function newDialog(restart = false) {
  dialog(`<div class="dialog-art">🏰</div><h2>${restart ? '建立新的勇氣城堡？' : '歡迎來到勇氣城堡！'}</h2>
 <p>${restart ? '新城堡會取代這個瀏覽器目前的進度，建議先下載備份。' : '完成一題，砌一塊積木；勇敢改正，城堡就多一盞燈。'}</p>
 <div class="setup-grid"><div><label for="kidName">小朋友名字</label><input id="kidName" class="name-input" maxlength="30" placeholder="例如：朗朗" value="${esc(state.name === '小小建築師' ? '' : state.name)}"></div>
 <div><label for="goalInput">原定目標（題）</label><input id="goalInput" class="number-input" type="number" inputmode="numeric" min="1" max="500" value="${state.target}"></div></div>
 <label for="kingdomInput">城堡名字（可留空）</label><input id="kingdomInput" class="text-input" maxlength="40" placeholder="例如：彩虹城堡">
 <div class="presets">${[20, 50, 100, 200].map((n) => `<button data-n="${n}" class="preset ${n === state.target ? 'active' : ''}">${n}</button>`).join('')}</div>
 <div id="error" class="warn"></div>
 <button class="primary" id="start">🏰 開始建造</button>
 ${restart ? '<button id="backupNow" class="minor-action">💾 先下載現有進度</button><button id="cancel" class="quiet">取消，返回城堡</button>' : ''}`);
  document.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => { $('goalInput').value = b.dataset.n; document.querySelectorAll('[data-n]').forEach((x) => x.classList.toggle('active', x === b)); });
  $('start').onclick = () => {
    const n = Number($('goalInput').value), kid = $('kidName').value.trim(), title = $('kingdomInput').value.trim();
    if (!Number.isInteger(n) || n < 1 || n > 500) { $('error').textContent = '請輸入 1 至 500 的整數'; return; }
    if (!kid) { $('error').textContent = '請輸入小朋友的名字'; return; }
    stopFireworks(); stopReplay(false);
    state = E.fresh(); state.target = n; state.seed = E.randomSeed(); state.name = E.clean(kid, 30) || '小小建築師'; state.kingdom = E.clean(title, 40);
    extras.seenV3 = true; extras.patrols = 0; persistExtras();
    rebuild(); selected = null; persist(); home(); render(); closeDialog(); say('藍圖已經畫好，「＋」就是第一塊積木的位置！', { gold: true });
  };
  if (restart) { $('cancel').onclick = closeDialog; $('backupNow').onclick = backup; }
}
function whatsNewDialog() {
  dialog(`<div class="dialog-art">🏰✨</div><div class="success-tag">勇氣城堡 V3</div><h2>${esc(state.name)}，城堡升級了！</h2>
 <p>你的 ${V.total} 塊積木和 ${lampsOn()} 次改正全部保留。</p>
 <ul class="news">
 <li>🗺️ <b>城堡藍圖</b>：虛線預告完整城堡，「＋」是下一塊積木。</li>
 <li>💡 <b>勇氣燈串</b>：每改正 ${E.LAMPS} 次，就有一串燈掛到城堡上。</li>
 <li>🌙 <b>夜景</b>：亮著的積木變成窗，窗後住著小住客。</li>
 <li>📒 <b>勇氣日記</b>：不用每次都寫；想記下學到甚麼時，按「寫日記」或點亮著的積木就可以。</li>
 <li>🛡️ <b>提燈小騎士</b>：點牠一下，牠會去巡邏亮著的窗。</li>
 <li>🎬 <b>建造回放</b>：由第一塊積木開始重看整座城堡。</li>
 </ul>
 <button class="primary" id="go">🏰 去看看我的城堡</button>
 <button class="quiet" id="oldVer">想用回舊版？設定裏可以打開 V2.3</button>`);
  extras.seenV3 = true; persistExtras();
  $('go').onclick = () => { closeDialog(); if (state.finalized) fit(); };
  $('oldVer').onclick = settingsDialog;
}
function resumeDialog() {
  dialog(`<div class="dialog-art">🏰</div><h2>${esc(state.name)}，歡迎回來！</h2>
 <p>你已完成 <b>${V.total}</b> 題，亮起 <b>${lampsOn()}</b> 盞勇氣燈。${state.finalized ? '<br>👑 王國已正式完成。' : ''}</p>
 <button class="primary" id="resume">${state.finalized ? '👑 欣賞我的王國' : '🏰 繼續建造'}</button>
 <button class="quiet" id="newWorld">開始一座新城堡</button>`);
  $('resume').onclick = () => { closeDialog(); if (state.finalized) { fit(); resultDialog(); } };
  $('newWorld').onclick = () => newDialog(true);
}
const fileSafe = (s) => String(s).replace(/[\\/:*?"<>|]/g, '_').slice(0, 50) || '勇氣城堡';
function download(blob, filename) {
  const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 45000);
}
function backup() { download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json;charset=utf-8' }), `${fileSafe(name())}_建造紀錄.json`); }
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
async function exportPNG() {
  const button = $('downloadPNG') || $('posterBtn'), label = button?.textContent;
  if (button) { button.disabled = true; button.textContent = '⏳ 正在製作紀念圖…'; }
  try {
    const night = extras.night, poster = document.createElement('canvas'); poster.width = 2560; poster.height = 1440;
    const ctx = poster.getContext('2d'); if (!ctx) throw Error('Canvas unavailable');
    ctx.fillStyle = night ? '#262b52' : '#fff5e7'; ctx.fillRect(0, 0, 2560, 1440);
    ctx.strokeStyle = night ? '#4b5290' : '#e7cddb'; ctx.lineWidth = 12; ctx.strokeRect(42, 42, 2476, 1356);
    ctx.fillStyle = night ? '#f3ecff' : '#755b7b'; ctx.textAlign = 'center'; ctx.font = 'bold 87px sans-serif'; ctx.fillText(name().slice(0, 24), 1280, 142);
    ctx.fillStyle = night ? '#b6acd8' : '#a084a5'; ctx.font = '32px sans-serif'; ctx.fillText('COURAGE CASTLE V3 · 一題一積木，改正亮一盞燈', 1280, 202);
    const b = E.edges(state, V), c = castleBox(), l = Math.min(b.min - 60, c.x), r = Math.max(b.max + 60, c.x + c.w), t = Math.min(b.top - 40, c.y);
    const raw = `<svg xmlns="http://www.w3.org/2000/svg" width="2324" height="880" viewBox="${l} ${t} ${r - l} ${Math.max(b.bottom, 640) - t}" preserveAspectRatio="xMidYMid meet">${scene({ night, export: true })}</svg>`;
    const url = URL.createObjectURL(new Blob([raw], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = new Image();
      await new Promise((ok, fail) => { image.onload = ok; image.onerror = fail; image.src = url; });
      ctx.fillStyle = night ? '#1d2350' : '#fff0dd'; ctx.fillRect(118, 237, 2324, 880); ctx.drawImage(image, 118, 237, 2324, 880);
    } finally { URL.revokeObjectURL(url); }
    const g = E.garland(lampsOn());
    [['完成題目', V.total], ['原定目標', state.target], ['勇敢改正', lampsOn()], ['勇氣燈串', g.done]].forEach(([lab, val], i) => {
      const x = 440 + i * 560;
      ctx.fillStyle = night ? '#343a68' : '#fff'; roundRect(ctx, x - 170, 1135, 340, 146, 24); ctx.fill();
      ctx.fillStyle = night ? '#fff' : '#8a6c8d'; ctx.font = 'bold 62px sans-serif'; ctx.fillText(String(val), x, 1206);
      ctx.fillStyle = night ? '#cfc5ea' : '#b198a2'; ctx.font = 'bold 28px sans-serif'; ctx.fillText(lab, x, 1257);
    });
    const date = new Date(state.finalDate || Date.now()).toLocaleDateString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit' });
    ctx.fillStyle = night ? '#d9d0f2' : '#987b92'; ctx.font = '29px sans-serif'; ctx.fillText('你用努力砌成城堡，也用勇氣點亮每一扇窗。', 1280, 1350);
    ctx.font = '23px sans-serif'; ctx.fillText(`建造者：${state.name}　·　${date}`, 1280, 1387);
    const png = await new Promise((res) => poster.toBlob(res, 'image/png')); if (!png) throw Error('PNG failed');
    download(png, `${fileSafe(name())}_${V.total}題_${date.replaceAll('/', '-')}.png`);
    say('紀念圖已準備好！', { gold: true });
  } catch (e) { say('紀念圖製作未成功，請再試一次或下載建造紀錄。'); }
  finally { if (button?.isConnected) { button.disabled = false; button.textContent = label; } }
}
function settingsDialog() {
  dialog(`<div class="dialog-art">⚙️</div><h2>城堡設定</h2><p>${esc(name())}<br>已完成 ${V.total} 題，亮起 ${lampsOn()} 盞燈。</p>
 <label for="sName">小朋友名字</label><input id="sName" class="name-input" maxlength="30" value="${esc(state.name)}">
 <label for="sKingdom">城堡名字（可留空）</label><input id="sKingdom" class="text-input" maxlength="40" value="${esc(state.kingdom)}" placeholder="${esc(state.name)}的勇氣城堡">
 <button id="saveNames" class="primary">✓ 儲存並返回</button>
 <button id="posterBtn" class="minor-action">📸 下載紀念圖</button>
 <button id="backupNow" class="minor-action">💾 下載建造紀錄</button>
 <button id="importNow" class="minor-action">📂 匯入建造紀錄</button>
 <input type="file" id="importFile" accept=".json,application/json" hidden>
 ${state.finalized ? '<button id="resultNow" class="minor-action">👑 欣賞完成作品</button>' : ''}
 <button id="oldVersion" class="minor-action">🕰️ 打開舊版 V2.3</button>
 <button id="newWorld" class="quiet">開始一座新城堡</button>`);
  $('saveNames').onclick = () => {
    state.name = E.clean($('sName').value, 30) || state.name; state.kingdom = E.clean($('sKingdom').value, 40);
    persist(); render(); closeDialog();
  };
  $('posterBtn').onclick = exportPNG; $('backupNow').onclick = backup;
  $('oldVersion').onclick = () => { location.href = 'v2.3.html'; };
  $('newWorld').onclick = () => newDialog(true);
  if ($('resultNow')) $('resultNow').onclick = resultDialog;
  $('importNow').onclick = () => $('importFile').click();
  $('importFile').onchange = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 2500000) throw Error('Too big');
      const parsed = E.readData(JSON.parse(await file.text())); if (!parsed) throw Error('Not V2');
      if (!confirm('匯入會取代此瀏覽器目前的城堡進度，確定繼續？')) return;
      stopReplay(false); state = parsed; rebuild(); selected = null; persist(); home(); render(); closeDialog(); say('建造紀錄已成功恢復！', { gold: true });
    } catch (err) { say('這個檔案不是有效的勇氣城堡紀錄。'); }
  };
}
function toggleNight() {
  extras.night = !extras.night; persistExtras(); hideBubble(); render();
  say(extras.night ? (lampsOn() ? `🌙 ${lampsOn()} 扇窗亮著燈，點一下窗就能看看誰住在裏面。` : '🌙 天黑了。勇敢改正一次，城堡就會亮起第一扇窗。') : '☀️ 早晨好！今天也一塊一塊砌吧。');
}

/* ---------- 畫面操作 ---------- */
function navigation() {
  $('zoomIn').onclick = () => { cam.zoom = E.clamp(cam.zoom * 1.25, 0.07, 4); applyCamera(); hideBubble(); };
  $('zoomOut').onclick = () => { cam.zoom = E.clamp(cam.zoom / 1.25, 0.07, 4); applyCamera(); hideBubble(); };
  $('fitAll').onclick = () => { fit(); hideBubble(); };
  $('goHome').onclick = () => { home(); hideBubble(); };
  const stage = $('stage');
  const pts = new Map();
  let pinch = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button,.bubble')) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: cam.zoom }; drag = null; moved = true; return;
    }
    drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; moved = false;
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size === 2) {
      const [a, b] = [...pts.values()]; cam.zoom = E.clamp(pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.d), 0.07, 4); applyCamera(); return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) > 8) { moved = true; hideBubble(); try { stage.setPointerCapture(e.pointerId); } catch (err) {} }
    if (moved) { const v = cameraView(), r = stage.getBoundingClientRect(); cam.x = drag.cx - dx * v.width / r.width; cam.y = drag.cy - dy * v.height / r.height; applyCamera(); }
  });
  const end = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) drag = null; };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  stage.addEventListener('wheel', (e) => { if (e.target.closest('button,.bubble')) return; e.preventDefault(); hideBubble(); cam.zoom = E.clamp(cam.zoom * (e.deltaY > 0 ? 0.91 : 1.1), 0.07, 4); applyCamera(); }, { passive: false });
  // 用 click 而非 pointerup，避免手機補發的點擊誤按剛開的氣泡按鈕。
  svg.addEventListener('click', (e) => {
    if (moved || busy || replaying) return;
    if (e.target.closest('#knight')) { patrol(); return; }
    const node = e.target.closest('[data-oid]');
    if (!node) { if (selected) { selected = null; render(); idleSay(); } hideBubble(); return; }
    const id = node.dataset.oid;
    if (V.lit.has(id)) { showBubble(id); return; }
    hideBubble();
    if (state.finalized) return;
    selected = selected === id ? null : id; render();
    if (selected) say('已選好這塊積木！按「勇敢改正」，它就會亮起來。', { gold: true }); else idleSay();
  });
}
$('add').onclick = () => action('add');
$('shine').onclick = () => action('shine');
$('undo').onclick = undo;
$('finish').onclick = finishDialog;
$('replayCelebration').onclick = () => fireworks('replay');
$('garlandBtn').onclick = garlandDialog;
$('diaryBtn').onclick = () => diaryDialog(E.diary(state, V).some((d) => d.note) ? 'notes' : 'all');
$('replayBtn').onclick = playReplay;
$('nightBtn').onclick = toggleNight;
$('settings').onclick = () => { if (!busy) { stopReplay(false); settingsDialog(); } };
$('sound').onclick = () => { state.sound = !state.sound; persist(); render(); if (state.sound) music('add'); };
$('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch (e) { say('這個瀏覽器未能進入全螢幕。'); } };
$('overlay').addEventListener('click', (e) => { if (e.target === $('overlay') && !$('start')) closeDialog(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('overlay').classList.contains('hidden') && !$('start')) closeDialog(); });
let lastW = 0;
addEventListener('resize', () => { const w = innerWidth; if (Math.abs(w - lastW) > 40) { lastW = w; home(); } else applyCamera(); hideBubble(); });
navigation();
const found = load();
if (!found) { state = E.fresh(); state.seed = E.randomSeed(); rebuild(); }
lastW = innerWidth;
home(); render(); idleSay();
if (!found) newDialog();
else if (!extras.seenV3) whatsNewDialog();
else resumeDialog();
window.courageCastle = { snapshot: () => JSON.parse(JSON.stringify({ state, extras, total: V.total, lit: V.lit.size, built: V.built.length, extra: V.extra.length })) };
})();
