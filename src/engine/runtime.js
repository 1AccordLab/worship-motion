'use strict';
/* 場景執行環境：在 Worker 裡跑場景程式。場景卡住（無窮迴圈）時主頁面會直接終止這個 Worker，頁面不會當掉。 */
const W = 1920, H = 1080, FPS = 30, BEAT = .5, BAR = 2, LOOP = 16, TAU = Math.PI * 2;
const AW = 4096, AH = 2048;
const FONT_CJK = '"PingFang TC","Noto Sans CJK TC","Noto Sans TC","Microsoft JhengHei","Heiti TC",sans-serif';
const FONT_LATIN = '"Helvetica Neue",Helvetica,Arial,"Noto Sans",sans-serif';
const clamp01 = x => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const mod = (a, n) => ((a % n) + n) % n;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const pulse = (t, k = 5, period = BEAT, off = 0) => Math.exp(-mod(t - off, period) / period * k);
const E = {
  lin: t => t,
  io: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  out: t => 1 - Math.pow(1 - t, 3),
  out5: t => 1 - Math.pow(1 - t, 5),
  back: t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const HEXC = new Map();
function color(c, a = 1) {
  if (Array.isArray(c)) return [c[0], c[1], c[2], (c[3] ?? 1) * a];
  let v = HEXC.get(c);
  if (!v) {
    if (typeof c !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(c)) throw new Error('顏色要寫成 "#RRGGBB"（收到 ' + c + '）');
    const n = parseInt(c.slice(1), 16); v = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; HEXC.set(c, v);
  }
  return [v[0], v[1], v[2], a];
}
/* ---------- 形狀：最後一個參數 o 可放 { z, blend, tex, rough, seed, shadow, fiber } ---------- */
const S = (kind, cx, cy, hx, hy, ang, a0, sweep, col, a, o) => Object.assign({ kind, cx, cy, hx, hy, ang, a0, sweep, col: color(col, a) }, o);
const rect = (x0, y0, x1, y1, col, a = 1, o) => S(0, (x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, 0, col, a, o);
const band = (cx, cy, len, wid, deg, col, a = 1, o) => S(0, cx, cy, len / 2, wid / 2, deg * Math.PI / 180, 0, 0, col, a, o);
const arc = (cx, cy, r, thick, a0, sweep, col, a = 1, o) => S(1, cx, cy, r, thick / 2, 0, mod(a0, TAU), sweep, col, a, o);
const circle = (cx, cy, r, col, a = 1, o) => S(2, cx, cy, r, 0, 0, 0, 0, col, a, o);
const wedge = (cx, cy, r, a0, sweep, col, a = 1, o) => S(3, cx, cy, r, 0, 0, mod(a0, TAU), sweep, col, a, o);
const tri = (cx, cy, size, ang, col, a = 1, o) => S(4, cx, cy, size, 0, ang, 0, 0, col, a, o);

/* ---------- 文字圖集：用到才畫，只上傳有變的列 ---------- */
class Atlas {
  constructor() {
    this.a = new OffscreenCanvas(AW, AH); this.b = new OffscreenCanvas(AW, AH);
    this.ca = this.a.getContext('2d', { willReadFrequently: true }); this.cb = this.b.getContext('2d', { willReadFrequently: true });
    this.reset();
  }
  reset() { this.ca.clearRect(0, 0, AW, AH); this.cb.clearRect(0, 0, AW, AH); this.x = 2; this.y = 2; this.rowH = 0; this.map = new Map(); this.d0 = 1e9; this.d1 = -1; }
  get(text, { px = 96, weight = 700, font = FONT_CJK, spacing = 0, blur = 0, stroke = 0 } = {}) {
    const key = px + '|' + weight + '|' + font + '|' + spacing + '|' + blur + '|' + stroke + '|' + text;
    let e = this.map.get(key); if (e) return e;
    const f = `${weight} ${px}px ${font}`;
    this.ca.font = f; this.ca.letterSpacing = spacing + 'px';
    const m = this.ca.measureText(text), pad = Math.ceil(blur * 2.5 + 6 + stroke);
    const w = Math.ceil(m.width) + pad * 2, h = Math.ceil(px * 1.36) + pad * 2;
    if (this.x + w > AW) { this.x = 2; this.y += this.rowH + 2; this.rowH = 0; }
    if (this.y + h > AH || w > AW) throw new Error('文字太多或太大，文字圖集放不下：' + text.slice(0, 12));
    const cx = this.x + w / 2, cy = this.y + h / 2;
    for (const [ctx, bl] of [[this.ca, 0], [this.cb, blur]]) {
      ctx.save(); ctx.font = f; ctx.letterSpacing = spacing + 'px';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      ctx.filter = bl ? `blur(${bl}px)` : 'none';
      if (stroke) { ctx.lineWidth = stroke; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff'; ctx.strokeText(text, cx + spacing / 2, cy); }
      else ctx.fillText(text, cx + spacing / 2, cy);
      ctx.restore();
    }
    e = { u0: this.x / AW, v0: this.y / AH, u1: (this.x + w) / AW, v1: (this.y + h) / AH, w, h, pad, tw: m.width };
    this.d0 = Math.min(this.d0, this.y); this.d1 = Math.max(this.d1, this.y + h);
    this.x += w + 2; this.rowH = Math.max(this.rowH, h);
    this.map.set(key, e); return e;
  }
  take(all) {    // 回傳要上傳的列（只取 alpha）
    let y0 = this.d0, y1 = Math.min(AH, this.d1);
    if (all) { y0 = 0; y1 = Math.max(this.y + this.rowH + 2, 2); }
    if (y1 <= y0) return null;
    const hh = y1 - y0, out = { y: y0, h: hh, a: new Uint8Array(AW * hh), b: new Uint8Array(AW * hh) };
    for (const [ctx, arr] of [[this.ca, out.a], [this.cb, out.b]]) {
      const src = ctx.getImageData(0, y0, AW, hh).data;
      for (let i = 0, j = 3; i < arr.length; i++, j += 4) arr[i] = src[j];
    }
    this.d0 = 1e9; this.d1 = -1; return out;
  }
}
let atlas = null;

/* ---------- 一格畫面：照呼叫順序疊；z 小的在下（形狀與線 0、字 1、top 2） ---------- */
class Frame {
  constructor(pal) { this.bg = pal.bg || '#2b2a27'; this.grid = { alpha: 0, flash: 0, col: '#ece2cf', w: 160, h: 180, line: 1.5 }; this.items = []; }
  _push(t, z, o) { this.items.push({ t, z, i: this.items.length, o }); }
  add(...ss) { for (const s of ss.flat(9)) if (s) this._push(0, s.z ?? 0, s); return this; }
  top(...ss) { for (const s of ss.flat(9)) if (s) this._push(0, s.z ?? 2, s); return this; }
  measure(str, o = {}) { return atlas.get(String(str), o); }
  fit(str, maxW, o = {}) { str = String(str || ''); if (!str) return 1; return Math.min(1, maxW / Math.max(1, atlas.get(str, o).tw)); }
  text(str, x, y, o = {}) {
    str = String(str); if (!str || (o.a ?? 1) <= .001) return this;
    const e = atlas.get(str, o), sc = o.scale ?? 1;
    if (o.align === 'left') x += (e.w / 2 - e.pad) * sc; else if (o.align === 'right') x -= (e.w / 2 - e.pad) * sc;
    this._push(1, o.z ?? 1, { x, y, w: e.w * sc, h: e.h * sc, e, col: color(o.col ?? '#efe6d2', o.a ?? 1), rot: o.rot || 0, shadow: o.shadow ? 1 : 0, clip: o.clip, blend: o.blend, tex: o.tex });
    return this;
  }
  line(x0, y0, x1, y1, w = 2, col = '#efe6d2', a = 1, o = {}) {
    if (a <= .002) return this;
    this._push(2, o.z ?? 0, { x0, y0, x1, y1, hw: w / 2, col: color(col, a), soft: o.soft, blend: o.blend, tex: o.tex, rough: o.rough, seed: o.seed });
    return this;
  }
  poly(pts, w, col, a = 1, o = {}) { for (let i = 1; i < pts.length; i++) this.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w, col, a, o); return this; }
}

/* ---------- defineScene：場景程式唯一要呼叫的函式 ---------- */
let SCENE = null;
const TEX_TYPES = { fiber: 1, grain: 2, halftone: 3, misreg: 4, bleed: 5, rough: 6, wobble: 7 };
const TEX_ON = { shapes: 1, text: 2, lines: 4, bg: 8 };
const RESERVED = new Set(['constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty', 'none']);
function defineScene(d) {
  const bad = m => { throw new Error('defineScene：' + m); };
  if (SCENE) bad('一份新風格程式只能呼叫一次 defineScene');
  if (!d || typeof d !== 'object') bad('要傳入一個物件');
  if (typeof d.name !== 'string' || !d.name.trim()) bad('缺少 name（風格名稱）');
  let id = d.id ?? 'custom';
  if (typeof id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{1,40}$/.test(id)) bad('id 要用英文字母開頭，只能有英文、數字、- 或 _（2–41 字），例如 "inkwash"');
  id = id.toLowerCase();
  if (!d.palette || typeof d.palette !== 'object') bad('缺少 palette（配色物件）');
  for (const [k, v] of Object.entries(d.palette)) if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) bad(`palette.${k} 要是 "#RRGGBB"`);
  if (!d.palette.bg) bad('palette 一定要有 bg（底色）');
  const kinds = (o, what) => {
    if (!o || typeof o !== 'object' || !Object.keys(o).length) { if (what === 'backgrounds') bad('backgrounds 至少要有一種'); return {}; }
    for (const [k, v] of Object.entries(o)) {
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(k) || RESERVED.has(k)) bad(`${what} 的名稱「${k}」要用英文字母開頭，只能有英文、數字、- 或 _（例如 calm、peak、verse1Text）`);
      if (!v || typeof v.draw !== 'function') bad(`${what}.${k} 缺少 draw(f, x) 函式`);
      if (what === 'subtitles' && v.split && !['line', 'block'].includes(v.split)) bad(`subtitles.${k}.split 只能是 "line" 或 "block"`);
    }
    return o;
  };
  const backgrounds = kinds(d.backgrounds, 'backgrounds'), subtitles = kinds(d.subtitles, 'subtitles');
  const textures = d.textures || [];
  if (!Array.isArray(textures) || textures.length > 8) bad('textures 要是陣列，最多 8 個');
  textures.forEach((t, i) => {
    if (!TEX_TYPES[t.type]) bad(`textures[${i}].type「${t.type}」不存在，可用：${Object.keys(TEX_TYPES).join('、')}`);
    for (const o of String(t.on || 'shapes').split(/[ ,+]+/)) if (!TEX_ON[o]) bad(`textures[${i}].on「${o}」只能是 shapes、text、lines、bg（可用逗號合併）`);
  });
  const params = {};
  for (const [k, v] of Object.entries(d.params || {})) {
    const p = typeof v === 'number' ? { value: v } : v;
    if (!p || typeof p.value !== 'number') bad(`params.${k} 要是數字或 { value, min, max, label }`);
    params[k] = { value: p.value, min: p.min ?? Math.min(0, p.value), max: p.max ?? Math.max(1, p.value * 2), step: p.step ?? 0, label: p.label || k };
  }
  if (d.canvas && typeof d.canvas.draw !== 'function') bad('canvas 要有 draw(ctx, t, info) 函式');
  if (d.shader && typeof (d.shader.code ?? d.shader) !== 'string') bad('shader 要有 code（WGSL 文字）');
  SCENE = { d, id, backgrounds, subtitles, textures, params, palette: d.palette, defaults: { ...d.palette } };
}

/* ---------- 一支影片（clip）與逐格 ---------- */
let CLIP = null, SENT_ALL = false;
function parseLine(line) {
  const m = line.match(/^(.*?)\[(.+?)\](.*)$/);
  if (m) { const chars = [...(m[1] + m[2] + m[3])]; return { chars, kw: [...m[1]].length }; }
  const chars = [...line]; return { chars, kw: chars.length > 1 ? 1 : 0 };
}
function setClip(c) {
  const sc = SCENE, def = c.kind === 'bg' ? sc.backgrounds[c.type] : sc.subtitles[c.type];
  if (!def) throw new Error('這個風格沒有「' + c.type + '」這種' + (c.kind === 'bg' ? '背景' : '字幕'));
  Object.assign(sc.palette, sc.defaults, c.pal || {});
  const params = {}; for (const [k, p] of Object.entries(sc.params)) params[k] = c.params && typeof c.params[k] === 'number' ? c.params[k] : p.value;
  /* 第二語言：text2 和 text 逐行配對；swap＝第二語言當大字。big／small 是對調好的兩組行（大字沒有內容時，小字補上當大字） */
  const rows = v => String(v || '').split('\n').map(s => s.trim()).filter(Boolean), strip = s => s.replace(/[\[\]]/g, '');
  const text = c.text || '', text2 = c.text2 || '', raw1 = rows(text), raw2 = rows(text2);
  const lines = raw1.map(strip), lines2 = raw2.map(strip), swap = !!c.swap && lines2.length > 0;
  let big = swap ? lines2 : lines, small = swap ? lines : lines2, bigRaw = swap ? raw2 : raw1;
  if (!big.length && small.length) { big = small; small = []; bigRaw = swap ? raw1 : raw2; }
  const pk = lines2.length ? parseLine(bigRaw[0] || '') : parseLine(text.split('\n')[0].trim());
  const jump = c.jump || 1, jt = tt => tt * jump;
  CLIP = { def, x: { t: 0, beat: 0, dur: c.dur || 0, text, lines, text2, lines2, big, small, swap, chars: pk.chars, kw: pk.kw, pal: sc.palette, params, W, H, kind: c.kind, type: c.type,
    jt, step: (list, every, tt) => list[Math.floor(mod(jt(tt ?? CLIP.x.t), 1e9) / every) % list.length],
    /* 字幕底下的背景＝段落選的背景（x.bg）。under(f, 預設, 選項)：段落沒指定背景時用「預設」那個畫法 */
    bg: c.kind === 'sub' && c.bg && sc.backgrounds[c.bg] ? c.bg : null,
    under: (f, dflt, o) => { const b = CLIP.x.bg && sc.backgrounds[CLIP.x.bg], fn = b ? b.draw : dflt || Object.values(sc.backgrounds)[0].draw;
      return fn(f, CLIP.x, { sub: def.split || 'line', ...(o || {}) }); } } };
  atlas.reset(); SENT_ALL = false;
}
const KIND = { 0: 0, 1: 1, 2: 2 }, BLEND = { multiply: 1, max: 2 };
function texMask(t) { if (t === false) return 0; if (Array.isArray(t)) return t.reduce((m, i) => m | (1 << i), 0); return 255; }
/* 圓弧、扇形只畫到它實際佔的框，GPU 少算很多 */
function bbox(o, buf, at) {
  const R = o.kind === 1 ? o.hx + o.hy : o.hx, r0 = o.kind === 1 ? Math.max(0, o.hx - o.hy) : 0;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const pt = (a, r) => { const x = o.cx + Math.cos(a) * r, y = o.cy + Math.sin(a) * r; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  const a0 = o.a0, a1 = o.a0 + o.sweep;
  for (const a of [a0, a1]) { pt(a, R); pt(a, r0); }
  for (let k = Math.ceil(a0 / (Math.PI / 2)); k * Math.PI / 2 <= a1; k++) pt(k * Math.PI / 2, R);
  buf[at] = x0; buf[at + 1] = y0; buf[at + 2] = x1; buf[at + 3] = y1;
}
function frame(t) {
  const x = CLIP.x; x.t = t; x.beat = t / BEAT;
  const f = new Frame(SCENE.palette);
  CLIP.def.draw(f, x);
  const items = f.items.sort((a, b) => a.z - b.z || a.i - b.i);
  const n = items.length, buf = new Float32Array(Math.max(1, n) * 24), runs = [];
  const cz = SCENE.d.canvas ? (SCENE.d.canvas.z ?? .5) : null, sz = SCENE.d.shader ? (SCENE.d.shader.z ?? .5) : null;
  const marks = []; if (cz !== null) marks.push([cz, 3]); if (sz !== null) marks.push([sz, 4]); marks.sort((a, b) => a[0] - b[0]);
  let mi = 0;
  for (let i = 0; i < n; i++) {
    const it = items[i], o = it.o, p = i * 24, c = o.col;
    while (mi < marks.length && marks[mi][0] <= it.z) runs.push([marks[mi++][1], 0, i, 0]);
    buf[p + 4] = c[0]; buf[p + 5] = c[1]; buf[p + 6] = c[2]; buf[p + 7] = c[3]; buf[p + 16] = texMask(o.tex);
    if (it.t === 0) {
      buf[p] = o.cx; buf[p + 1] = o.cy; buf[p + 2] = o.hx; buf[p + 3] = o.hy;
      buf[p + 8] = o.ang; buf[p + 9] = o.kind; buf[p + 10] = o.a0; buf[p + 11] = o.sweep;
      buf[p + 12] = o.rough || 0; buf[p + 13] = o.seed || 0; buf[p + 14] = o.shadow || 0; buf[p + 15] = o.fiber || 0;
      if ((o.kind === 1 || o.kind === 3) && o.sweep < TAU) bbox(o, buf, p + 20);
    } else if (it.t === 1) {
      const e = o.e; buf[p] = o.x; buf[p + 1] = o.y; buf[p + 2] = o.w; buf[p + 3] = o.h;
      buf[p + 8] = e.u0; buf[p + 9] = e.v0; buf[p + 10] = e.u1; buf[p + 11] = e.v1;
      buf[p + 12] = o.rot; buf[p + 13] = o.shadow; if (o.clip) { buf[p + 14] = o.clip[0]; buf[p + 15] = o.clip[1]; }
    } else {
      buf[p] = o.x0; buf[p + 1] = o.y0; buf[p + 2] = o.x1; buf[p + 3] = o.y1;
      buf[p + 8] = o.hw; if (o.soft) { buf[p + 9] = o.soft[0]; buf[p + 10] = o.soft[1]; }
      buf[p + 12] = o.rough || 0; buf[p + 13] = o.seed || 0;
    }
    const k = it.t, bl = BLEND[o.blend] ?? (k === 2 && o.blend === undefined ? 0 : 0), last = runs[runs.length - 1];
    if (last && last[0] === k && last[1] === bl && last[2] + last[3] === i) last[3]++; else runs.push([k, bl, i, 1]);
  }
  while (mi < marks.length) runs.push([marks[mi++][1], 0, n, 0]);
  const g = f.grid, gc = color(g.col), bg = color(f.bg);
  return { buf, n, runs, bg, grid: [g.w, g.h, g.alpha + g.flash, g.line, gc[0], gc[1], gc[2]] };
}

/* ---------- 和主頁面溝通 ---------- */
self.onmessage = ev => {
  const m = ev.data;
  try {
    if (m.op === 'clip') { setClip(m.clip); postMessage({ id: m.id, ok: true }); return; }
    if (m.op === 'frame') {
      const r = frame(m.t), at = atlas.take(!SENT_ALL || m.fullAtlas); SENT_ALL = true;
      const tr = [r.buf.buffer]; if (at) tr.push(at.a.buffer, at.b.buffer);
      postMessage({ id: m.id, ok: true, frame: r, atlas: at }, tr); return;
    }
  } catch (e) { postMessage({ id: m.id, ok: false, error: String(e && e.message || e), stack: String(e && e.stack || '') }); }
};
function __wmFail(e) { postMessage({ fail: true, error: String(e && e.message || e), stack: String(e && e.stack || '') }); }
function __wmReady() {
  if (!SCENE) throw new Error('新風格程式沒有呼叫 defineScene({...})');
  atlas = new Atlas();
  const d = SCENE.d, list = (o, f) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(k, v)]));
  postMessage({ ready: true, meta: {
    id: SCENE.id, name: d.name.trim().slice(0, 30), palette: SCENE.defaults, labels: d.labels || null, params: SCENE.params,
    look: d.look || {}, textures: SCENE.textures,
    backgrounds: list(SCENE.backgrounds, (k, v) => ({ label: v.label || k, jumpBeats: [1, 2, 4, 8].includes(v.jumpBeats) ? v.jumpBeats : 4 })),
    subtitles: list(SCENE.subtitles, (k, v) => ({ label: v.label || k, split: v.split || 'line', seconds: Math.max(2, Math.min(60, v.seconds || (v.split === 'block' ? 16 : 6))) })),
    canvas: d.canvas ? { src: String(d.canvas.draw), z: d.canvas.z ?? .5, half: !!d.canvas.half } : null,
    shader: d.shader ? { code: String(d.shader.code ?? d.shader), z: d.shader.z ?? .5 } : null,
  } });
}
