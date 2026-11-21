'use strict';
/* 注意：場景程式在 Worker 裡跑，卡住（無窮迴圈）時主頁面直接 terminate 這個 Worker */
const W = 1920, H = 1080, BEAT = .5, BAR = 2, LOOP = 16, TAU = Math.PI * 2;
const AW = 4096, AH = 2048;
const ITEM_FLOATS = 24;  // 注意：和 gpu.js 的 ITEM_FLOATS 一致
const FONT_CJK = '"PingFang TC","Noto Sans CJK TC","Noto Sans TC","Microsoft JhengHei","Heiti TC",sans-serif';
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
const S = (kind, cx, cy, hx, hy, ang, a0, sweep, col, a, o) => Object.assign({ kind, cx, cy, hx, hy, ang, a0, sweep, col: color(col, a) }, o);
const rect = (x0, y0, x1, y1, col, a = 1, o) => S(0, (x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, 0, col, a, o);
const band = (cx, cy, len, wid, deg, col, a = 1, o) => S(0, cx, cy, len / 2, wid / 2, deg * Math.PI / 180, 0, 0, col, a, o);
const arc = (cx, cy, r, thick, a0, sweep, col, a = 1, o) => S(1, cx, cy, r, thick / 2, 0, mod(a0, TAU), sweep, col, a, o);
const circle = (cx, cy, r, col, a = 1, o) => S(2, cx, cy, r, 0, 0, 0, 0, col, a, o);
const wedge = (cx, cy, r, a0, sweep, col, a = 1, o) => S(3, cx, cy, r, 0, 0, mod(a0, TAU), sweep, col, a, o);
const tri = (cx, cy, size, ang, col, a = 1, o) => S(4, cx, cy, size, 0, ang, 0, 0, col, a, o);

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
  take(all) {
    let y0 = this.d0, y1 = Math.min(AH, this.d1);
    if (all) { y0 = 0; y1 = Math.max(this.y + this.rowH + 2, 2); }
    if (y1 <= y0) return null;
    const hh = y1 - y0, out = { y: y0, h: hh, a: new Uint8Array(AW * hh), b: new Uint8Array(AW * hh) };
    for (const [ctx, arr] of [[this.ca, out.a], [this.cb, out.b]]) {
      // 注意：用 getImageData 取 alpha，copyExternalImageToTexture 在無頭模式會失敗
      const src = ctx.getImageData(0, y0, AW, hh).data;
      for (let i = 0, j = 3; i < arr.length; i++, j += 4) arr[i] = src[j];
    }
    this.d0 = 1e9; this.d1 = -1; return out;
  }
}
let atlas = null;

const WORLD_FLOATS = 20;  // 注意：和 gpu.js 的 WORLD_FLOATS 一致
const WORLD_MAX = 400000, BRUSH = { oil: 0, flat: 1 };
const isVec3 = a => Array.isArray(a) && a.length === 3 && a.every(v => typeof v === 'number' && isFinite(v));
const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]), norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)],
};
class World {
  constructor() { this.buf = new Float32Array(WORLD_FLOATS * 65536); this.n = 0; this.sun = [0, 1, 0]; this.sunCol = [1, 1, 1]; this.ambient = .25; this.lamps = []; }
  moon(dir, col = '#e8e4d8', ambient = .25) { this.sun = v3.norm(dir); this.sunCol = color(col).slice(0, 3); this.ambient = ambient; return this; }
  lamp(at, radius, col = '#e0a050', amount = .85) { this.lamps.push({ at, r: radius, col: color(col).slice(0, 3), k: amount }); return this; }
  lit(normal, at) {
    const n = v3.norm(normal); let l = this.ambient + (1 - this.ambient) * Math.max(0, v3.dot(n, this.sun)), warm = 0;
    for (const L of this.lamps) { const d = v3.len(v3.sub(at, L.at)); if (d < L.r) warm = Math.max(warm, L.k * (1 - d / L.r) ** 2); }
    return { light: clamp01(l), warm };
  }
  paint(light, dark, lit, jitter = .06, seed = 0) {
    const a = color(light), b = color(dark), k = clamp01(lit.light), j = (hash(seed * 7.13 + 1.7) - .5) * 2 * jitter, h = (hash(seed * 3.31 + 9.1) - .5) * jitter;
    const s = this.sunCol, tint = i => lerp(1, s[i] / Math.max(.2, (s[0] + s[1] + s[2]) / 3), k * .5);
    let c = [0, 1, 2].map(i => lerp(b[i], a[i] * tint(i), k) * (1 + j));
    c[0] += h; c[2] -= h;
    if (lit.warm > 0) { const L = this.lamps.reduce((m, x) => x.k > m.k ? x : m, this.lamps[0]); c = c.map((v, i) => lerp(v, L.col[i] * Math.max(.75, k + .3), lit.warm)); }
    return c.map(clamp01);
  }
  stroke(at, dir, normal, len, wid, light, dark, o = {}) {
    if (this.n >= WORLD_MAX) throw new Error(`world 的筆觸超過 ${WORLD_MAX} 筆；請減少數量或加大筆觸`);
    if (![at, dir, normal].every(isVec3)) throw new Error('w.stroke 的位置、方向、朝向都要是 [x, y, z] 三個數字');
    if (!(len > 0 && wid > 0 && isFinite(len) && isFinite(wid))) throw new Error('w.stroke 的半長、半寬要是大於 0 的數字');
    dark = dark ?? light;
    if (this.n * WORLD_FLOATS >= this.buf.length) { const nb = new Float32Array(this.buf.length * 2); nb.set(this.buf); this.buf = nb; }
    const d = v3.norm(dir), side = v3.norm(v3.cross(normal, d)), seed = o.seed ?? hash(this.n * .618 + at[0] * 1.3 + at[2] * .7) * 1000;
    const lt = o.lit === undefined ? this.lit(normal, at) : typeof o.lit === 'number' ? { light: o.lit, warm: 0 } : o.lit;
    const c = this.paint(light, dark, lt, o.jitter ?? .06, seed);
    const flow = o.flow || [0, 0], p = this.n * WORLD_FLOATS, B = this.buf;
    B[p] = at[0]; B[p + 1] = at[1]; B[p + 2] = at[2]; B[p + 3] = len;
    B[p + 4] = d[0]; B[p + 5] = d[1]; B[p + 6] = d[2]; B[p + 7] = wid;
    B[p + 8] = side[0]; B[p + 9] = side[1]; B[p + 10] = side[2]; B[p + 11] = seed;
    B[p + 12] = c[0]; B[p + 13] = c[1]; B[p + 14] = c[2]; B[p + 15] = BRUSH[o.brush ?? 'oil'] ?? 0;
    B[p + 16] = flow[0]; B[p + 17] = flow[1]; B[p + 18] = o.fog ?? 1; B[p + 19] = o.keep ?? 0;
    this.n++; return this;
  }
  /* 注意：洗牌後任何前綴都是均勻抽樣，GPU 少畫幾筆（預覽降密度、遠處變稀）時才不會整塊消失；keep 的筆觸（剪影墊底）固定排在最前面 */
  pack() {
    const n = this.n, F = WORLD_FLOATS, src = this.buf, keep = [], rest = [];
    for (let i = 0; i < n; i++) (src[i * F + 19] > 0 ? keep : rest).push(i);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(hash(i * 1.618 + .5) * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    const out = new Float32Array(Math.max(1, n) * F); let k = 0;
    for (const i of keep.concat(rest)) out.set(src.subarray(i * F, i * F + F), (k++) * F);
    return { buf: out, n, keep: keep.length };
  }
}
let WORLD = null;
function worldFor(x) {
  const wd = SCENE.d.world; if (!wd) return null;
  const key = SCENE.id + '|' + JSON.stringify(x.pal) + '|' + JSON.stringify(x.params);
  if (WORLD && WORLD.key === key) return WORLD;
  const w = new World(); wd.build(w, x);
  const pk = w.pack();
  WORLD = { key, ...pk, sun: w.sun, sent: false };
  return WORLD;
}
const CAM_DEFAULT = { eye: [0, 2, 10], at: [0, 2, 0], fov: 45, fog: null, fogNear: 30, fogFar: 300, near: .5, far: 2000, minPx: 1.5, maxPx: 48, lod: 6 };
function cameraAt(t, x) {
  const wd = SCENE.d.world, c = { ...CAM_DEFAULT, ...(wd.camera ? wd.camera(t, x) || {} : {}) };
  for (const k of ['eye', 'at']) if (!isVec3(c[k])) throw new Error(`world.camera 回傳的 ${k} 要是 [x, y, z] 三個數字`);
  if (v3.len(v3.sub(c.at, c.eye)) < 1e-3) throw new Error('world.camera 的 eye 和 at 不能是同一點');
  if (!(c.fov >= 5 && c.fov <= 150)) throw new Error('world.camera 的 fov 要在 5 到 150 度之間');
  const lim = (v, a, b) => Math.min(b, Math.max(a, +v || a));
  c.minPx = lim(c.minPx, .5, 8); c.maxPx = lim(c.maxPx, 4, 160); c.lod = lim(c.lod, 2, 40);
  const fog = c.fog ? color(c.fog) : color(SCENE.palette.bg);
  const sun = WORLD ? WORLD.sun : [0, 1, 0];
  return [...c.eye, c.fov, ...c.at, c.near, fog[0], fog[1], fog[2], c.fogNear, c.fogFar, c.far, c.fog ? 1 : 0, ...sun, c.minPx, c.maxPx, c.lod];
}

/* 注意：照呼叫順序疊；z 小的在下（形狀與線 0、字 1、top 2） */
class Frame {
  constructor(pal) { this.bg = pal.bg || '#2b2a27'; this.grid = { alpha: 0, flash: 0, col: '#ece2cf', w: 160, h: 180, line: 1.5 }; this.items = []; this.el = null; }
  _push(t, z, o) { this.items.push({ t, z, i: this.items.length, o, el: this.el }); }
  add(...ss) { for (const s of ss.flat(9)) if (s) this._push(0, s.z ?? 0, s); return this; }
  top(...ss) { for (const s of ss.flat(9)) if (s) this._push(0, s.z ?? 2, s); return this; }
  measure(str, o = {}) { return atlas.get(String(str), o); }
  fit(str, maxW, o = {}) { str = String(str || ''); if (!str) return 1; return Math.min(1, maxW / Math.max(1, atlas.get(str, o).tw)); }
  text(str, x, y, o = {}) {
    str = String(str); if (!str || (o.a ?? 1) <= .001) return this;
    const e = atlas.get(str, o), sc = o.scale ?? 1;
    if (o.align === 'left') x += (e.w / 2 - e.pad) * sc; else if (o.align === 'right') x -= (e.w / 2 - e.pad) * sc;
    this._push(1, o.z ?? 1, { x, y, w: e.w * sc, h: e.h * sc, e, col: color(o.col ?? '#efe6d2', o.a ?? 1), rot: o.rot || 0, shadow: o.shadow ? 1 : 0, blend: o.blend, tex: o.tex });
    return this;
  }
  line(x0, y0, x1, y1, w = 2, col = '#efe6d2', a = 1, o = {}) {
    if (a <= .002) return this;
    this._push(2, o.z ?? 0, { x0, y0, x1, y1, hw: w / 2, col: color(col, a), blend: o.blend, tex: o.tex, rough: o.rough, seed: o.seed });
    return this;
  }
  poly(pts, w, col, a = 1, o = {}) { for (let i = 1; i < pts.length; i++) this.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w, col, a, o); return this; }
}

let SCENE = null;
/* 注意：TEX_TYPES、TEX_ON 要和 gpu.js setScene 的 T、ON 一致（check_repo 比對） */
const TEX_TYPES = { fiber: 1, grain: 2, halftone: 3, misreg: 4, bleed: 5, rough: 6, wobble: 7 };
const TEX_ON = { shapes: 1, text: 2, lines: 4, bg: 8 };
const DESC_MAX = 80;
const RESERVED = new Set(['constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty', 'none']);
const IMPLICIT_ELEMENTS = { bg: '背景', text: '字幕' };
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
  const NAME = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/;
  const paramDefs = (o, where) => {
    const out = {};
    for (const [k, v] of Object.entries(o || {})) {
      const p = typeof v === 'number' ? { value: v } : v;
      if (!p || typeof p.value !== 'number') bad(`${where}.${k} 要是數字或 { value, min, max, label }`);
      out[k] = { value: p.value, min: p.min ?? Math.min(0, p.value), max: p.max ?? Math.max(1, p.value * 2), step: p.step ?? 0, label: p.label || k };
    }
    return out;
  };
  const elements = {};
  for (const [k, v] of Object.entries(d.elements || {})) {
    if (!NAME.test(k) || RESERVED.has(k)) bad(`elements 的名稱「${k}」要用英文字母開頭，只能有英文、數字、- 或 _（例如 sun、stripes）`);
    if (IMPLICIT_ELEMENTS[k]) bad(`elements 的名稱「${k}」是保留的（bg 代表整個背景、text 代表字幕），請換一個名稱`);
    if (!v || typeof v.draw !== 'function') bad(`elements.${k} 缺少 draw(f, x, e) 函式`);
    const colors = v.colors || [];
    if (!Array.isArray(colors)) bad(`elements.${k}.colors 要是 palette 鍵的陣列，例如 ["main"]`);
    for (const c of colors) if (!d.palette[c]) bad(`elements.${k}.colors 的「${c}」不在 palette 裡`);
    elements[k] = { label: typeof v.label === 'string' && v.label.trim() ? v.label.trim().slice(0, 20) : k, draw: v.draw, fixed: !!v.fixed, colors: [...colors], params: paramDefs(v.params, `elements.${k}.params`) };
  }
  const useList = (list, where) => {
    if (!Array.isArray(list) || !list.length) bad(`${where}.use 要是至少有一個元素的陣列，例如 ["sun", { el: "rays", count: 12 }]`);
    return list.map(u => {
      const id = typeof u === 'string' ? u : u && u.el;
      if (typeof id !== 'string' || !elements[id]) bad(`${where}.use 的「${id}」不在 elements 裡（可用：${Object.keys(elements).join('、') || '還沒有定義任何元素'}）`);
      const { el, ...args } = typeof u === 'string' ? {} : u;
      return { id, args };
    });
  };
  const kinds = (o, what) => {
    if (!o || typeof o !== 'object' || !Object.keys(o).length) { if (what === 'backgrounds') bad('backgrounds 至少要有一種'); return {}; }
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      if (!NAME.test(k) || RESERVED.has(k)) bad(`${what} 的名稱「${k}」要用英文字母開頭，只能有英文、數字、- 或 _（例如 calm、peak、verse1Text）`);
      const composed = what === 'backgrounds' && v && v.use !== undefined;
      if (!composed && (!v || typeof v.draw !== 'function')) bad(`${what}.${k} 缺少 draw(f, x) 函式` + (what === 'backgrounds' ? '（或 use 元素清單）' : ''));
      if (what === 'subtitles' && v.split && !['line', 'block'].includes(v.split)) bad(`subtitles.${k}.split 只能是 "line" 或 "block"`);
      out[k] = composed ? { ...v, use: useList(v.use, `backgrounds.${k}`) } : v;
    }
    return out;
  };
  const backgrounds = kinds(d.backgrounds, 'backgrounds'), subtitles = kinds(d.subtitles, 'subtitles');
  const textures = d.textures || [];
  if (!Array.isArray(textures) || textures.length > 8) bad('textures 要是陣列，最多 8 個');
  textures.forEach((t, i) => {
    if (!TEX_TYPES[t.type]) bad(`textures[${i}].type「${t.type}」不存在，可用：${Object.keys(TEX_TYPES).join('、')}`);
    for (const o of String(t.on || 'shapes').split(/[ ,+]+/)) if (!TEX_ON[o]) bad(`textures[${i}].on「${o}」只能是 shapes、text、lines、bg（可用逗號合併）`);
  });
  const params = paramDefs(d.params, 'params');
  if (d.canvas && typeof d.canvas.draw !== 'function') bad('canvas 要有 draw(ctx, t, info) 函式');
  if (d.shader && typeof d.shader.code !== 'string') bad('shader 要有 code（WGSL 文字）');
  if (d.world !== undefined) {
    if (!d.world || typeof d.world.build !== 'function') bad('world 要有 build(w, x) 函式');
    if (d.world.camera !== undefined && typeof d.world.camera !== 'function') bad('world.camera 要是 camera(t, x) 函式');
  }
  if (d.description !== undefined && (typeof d.description !== 'string' || d.description.length > DESC_MAX)) bad(`description 要是一句話的字串（${DESC_MAX} 字以內）`);
  SCENE = { d, id, backgrounds, subtitles, elements, textures, params, palette: d.palette, defaults: { ...d.palette } };
}
const usesOf = b => b.use ? [...new Set(b.use.map(u => u.id))] : ['bg'];
const implicitInUse = () => ({ ...(Object.values(SCENE.backgrounds).some(b => !b.use) ? { bg: IMPLICIT_ELEMENTS.bg } : {}), ...(Object.keys(SCENE.subtitles).length ? { text: IMPLICIT_ELEMENTS.text } : {}) });
const adjOf = id => (CLIP.els && CLIP.els[id]) || {};
const isHidden = id => adjOf(id).visible === false;
/* 注意：場景從同一個 palette 物件讀色，元素自己的顏色只能在它畫的期間原地換上、畫完換回 */
function asElement(f, id, fn, alwaysRun) {
  if (!alwaysRun && isHidden(id)) return;
  const pal = SCENE.palette, own = adjOf(id).colors || {}, was = {}, outer = f.el;
  for (const k of Object.keys(own)) { was[k] = pal[k]; pal[k] = own[k]; }
  f.el = id;
  try { return fn(); } finally { f.el = outer; Object.assign(pal, was); }
}
function drawBackground(f, x, name, o) {
  const b = SCENE.backgrounds[name];
  if (!b.use) return asElement(f, 'bg', () => b.draw(f, x, o));
  for (const u of b.use) asElement(f, u.id, () => SCENE.elements[u.id].draw(f, x, { id: u.id, p: CLIP.elParams[u.id], args: u.args, sub: o && o.sub }));
}

const isFixed = id => id === 'bg' || !!(SCENE.elements[id] && SCENE.elements[id].fixed);
function itemBox(it) {
  const o = it.o;
  if (it.t === 0) {
    if (o.kind === 0) { const c = Math.abs(Math.cos(o.ang)), s = Math.abs(Math.sin(o.ang)), ex = o.hx * c + o.hy * s, ey = o.hx * s + o.hy * c; return [o.cx - ex, o.cy - ey, o.cx + ex, o.cy + ey]; }
    const r = o.kind === 1 ? o.hx + o.hy : o.hx; return [o.cx - r, o.cy - r, o.cx + r, o.cy + r];
  }
  if (it.t === 1) { const c = Math.abs(Math.cos(o.rot)), s = Math.abs(Math.sin(o.rot)), ex = (o.w * c + o.h * s) / 2, ey = (o.w * s + o.h * c) / 2; return [o.x - ex, o.y - ey, o.x + ex, o.y + ey]; }
  return [Math.min(o.x0, o.x1) - o.hw, Math.min(o.y0, o.y1) - o.hw, Math.max(o.x0, o.x1) + o.hw, Math.max(o.y0, o.y1) + o.hw];
}
const grow = (box, a) => box ? [Math.min(box[0], a[0]), Math.min(box[1], a[1]), Math.max(box[2], a[2]), Math.max(box[3], a[3])] : a;
const HIT_PAD = 4, HIT_MIN_ALPHA = .02;
function itemContains(it, px, py) {
  const o = it.o, inSweep = (ux, uy) => o.sweep >= TAU || mod(Math.atan2(uy, ux) - o.a0, TAU) <= o.sweep;
  const inRect = (ux, uy, ang, hx, hy) => { const c = Math.cos(ang), s = Math.sin(ang); return Math.abs(c * ux + s * uy) <= hx + HIT_PAD && Math.abs(-s * ux + c * uy) <= hy + HIT_PAD; };
  if (it.t === 0) {
    const ux = px - o.cx, uy = py - o.cy, len = Math.hypot(ux, uy);
    if (o.kind === 0) return inRect(ux, uy, o.ang, o.hx, o.hy);
    if (o.kind === 1) return o.sweep >= TAU ? len <= o.hx + o.hy + HIT_PAD : Math.abs(len - o.hx) <= o.hy + HIT_PAD && inSweep(ux, uy);
    return len <= o.hx + HIT_PAD && (o.kind !== 3 || inSweep(ux, uy));
  }
  if (it.t === 1) return inRect(px - o.x, py - o.y, o.rot, o.w / 2, o.h / 2);
  const vx = o.x1 - o.x0, vy = o.y1 - o.y0, k = clamp01(((px - o.x0) * vx + (py - o.y0) * vy) / Math.max(1e-4, vx * vx + vy * vy));
  return Math.hypot(px - o.x0 - vx * k, py - o.y0 - vy * k) <= o.hw + HIT_PAD;
}
/* 注意：活動範圍＝元素在整段影片裡畫過的地方（沒有位移、縮放、旋轉時），裁到畫面內；縮放與旋轉以它的中心為軸 */
/* 注意：背景的元素一律用背景影片的循環來取樣，字幕影片裡同一個元素的軸心才會和背景影片一樣；字幕只看最後一格（播完停住的樣子） */
const TERRITORY_SAMPLES = 32;
let TERRITORY = null;
function territory() {
  const x = CLIP.x, bgName = x.kind === 'bg' ? x.type : x.bg;
  const key = JSON.stringify([SCENE.id, x.kind, x.type, bgName, CLIP.jump, CLIP.span, x.dur, x.text, x.text2, x.swap, CLIP.elParams, Object.keys(CLIP.els).filter(isHidden)]);
  if (TERRITORY && TERRITORY.key === key) return TERRITORY.boxes;
  const boxes = {}, keepT = x.t, at = tt => { x.t = tt; x.beat = tt / BEAT; return new Frame(SCENE.palette); };
  const collect = (f, only) => { for (const it of f.items) if (!only || it.el === only) boxes[it.el] = grow(boxes[it.el], itemBox(it)); };
  try {
    if (bgName && SCENE.backgrounds[bgName].use) for (let i = 0; i < TERRITORY_SAMPLES; i++) { const f = at((i + .5) * CLIP.span / TERRITORY_SAMPLES); drawBackground(f, x, bgName); collect(f); }
    if (x.kind === 'sub') { const f = at(x.dur); asElement(f, 'text', () => CLIP.def.draw(f, x), true); collect(f, 'text'); }
  } finally { x.t = keepT; x.beat = keepT / BEAT; }
  for (const [k, box] of Object.entries(boxes)) {
    const inView = [Math.max(0, box[0]), Math.max(0, box[1]), Math.min(W, box[2]), Math.min(H, box[3])];
    if (inView[2] > inView[0] && inView[3] > inView[1]) boxes[k] = inView; else delete boxes[k];
  }
  TERRITORY = { key, boxes };
  return boxes;
}
function transformOf(id) {
  if (isFixed(id)) return null;
  const a = adjOf(id), dx = a.dx || 0, dy = a.dy || 0, k = typeof a.scale === 'number' ? a.scale : 1, deg = a.rotate || 0;
  if (!dx && !dy && k === 1 && !deg) return null;
  const box = k !== 1 || deg ? territory()[id] : null;
  return { dx, dy, k, cos: Math.cos(deg * Math.PI / 180), sin: Math.sin(deg * Math.PI / 180), th: deg * Math.PI / 180, ax: box ? (box[0] + box[2]) / 2 : W / 2, ay: box ? (box[1] + box[3]) / 2 : H / 2 };
}
function placed(it, tr) {
  const o = it.o, k = tr.k;
  const move = (px, py) => { const ux = (px - tr.ax) * k, uy = (py - tr.ay) * k; return [tr.ax + tr.cos * ux - tr.sin * uy + tr.dx, tr.ay + tr.sin * ux + tr.cos * uy + tr.dy]; };
  if (it.t === 0) { const [cx, cy] = move(o.cx, o.cy); return { ...o, cx, cy, hx: o.hx * k, hy: o.hy * k, ang: o.ang + tr.th, a0: mod(o.a0 + tr.th, TAU) }; }
  if (it.t === 1) { const [px, py] = move(o.x, o.y); return { ...o, x: px, y: py, w: o.w * k, h: o.h * k, rot: o.rot + tr.th }; }
  const [x0, y0] = move(o.x0, o.y0), [x1, y1] = move(o.x1, o.y1);
  return { ...o, x0, y0, x1, y1, hw: o.hw * k };
}
function placedItems(t) {
  const x = CLIP.x; x.t = t; x.beat = t / BEAT;
  const f = new Frame(SCENE.palette), trs = {};
  if (x.kind === 'bg') drawBackground(f, x, x.type); else asElement(f, 'text', () => CLIP.def.draw(f, x), true);
  const items = f.items.filter(it => !isHidden(it.el)).sort((a, b) => a.z - b.z || a.i - b.i).map(it => {
    if (!(it.el in trs)) trs[it.el] = transformOf(it.el);
    return trs[it.el] ? { ...it, o: placed(it, trs[it.el]) } : it; });
  return { f, items };
}
function hitAt(t, px, py) {
  const { items } = placedItems(t);
  for (let i = items.length - 1; i >= 0; i--) { const it = items[i]; if (!isFixed(it.el) && it.o.col[3] >= HIT_MIN_ALPHA && itemContains(it, px, py)) return it.el; }
  return null;
}

let CLIP = null, SENT_ALL = false;
function setElements(els) {
  const elParams = {};
  for (const [k, e] of Object.entries(SCENE.elements)) { elParams[k] = {}; for (const [pk, p] of Object.entries(e.params)) { const v = els[k] && els[k].params && els[k].params[pk]; elParams[k][pk] = typeof v === 'number' ? v : p.value; } }
  CLIP.els = els; CLIP.elParams = elParams;
}
function parseLine(line) {
  const m = line.match(/^(.*?)\[(.+?)\](.*)$/);
  if (m) { const chars = [...(m[1] + m[2] + m[3])]; return { chars, kw: [...m[1]].length }; }
  const chars = [...line]; return { chars, kw: chars.length > 1 ? 1 : 0 };
}
function setClip(c) {
  const sc = SCENE, def = c.kind === 'bg' ? sc.backgrounds[c.type] : sc.subtitles[c.type];
  if (!def) throw new Error('這個風格沒有「' + c.type + '」這種' + (c.kind === 'bg' ? '背景' : '字幕'));
  Object.assign(sc.palette, sc.defaults, c.pal || {});  // 注意：原地改寫，因為場景用同一個 palette 物件讀色
  const params = {}; for (const [k, p] of Object.entries(sc.params)) params[k] = c.params && typeof c.params[k] === 'number' ? c.params[k] : p.value;
  /* 注意：big／small 是依 swap 對調好的兩組行；大字沒有內容時，小字補上當大字 */
  const rows = v => String(v || '').split('\n').map(s => s.trim()).filter(Boolean), strip = s => s.replace(/[\[\]]/g, '');
  const text = c.text || '', text2 = c.text2 || '', raw1 = rows(text), raw2 = rows(text2);
  const lines = raw1.map(strip), lines2 = raw2.map(strip), swap = !!c.swap && lines2.length > 0;
  let big = swap ? lines2 : lines, small = swap ? lines : lines2, bigRaw = swap ? raw2 : raw1;
  if (!big.length && small.length) { big = small; small = []; bigRaw = swap ? raw1 : raw2; }
  const pk = lines2.length ? parseLine(bigRaw[0] || '') : parseLine(text.split('\n')[0].trim());
  const jump = c.jump || 1, jt = tt => tt * jump;
  CLIP = { def, els: {}, elParams: {}, jump, span: c.span > 0 ? c.span : LOOP, x: { t: 0, beat: 0, dur: c.dur || 0, text, lines, text2, lines2, big, small, swap, chars: pk.chars, kw: pk.kw, pal: sc.palette, params, W, H, kind: c.kind, type: c.type,
    jt, step: (list, every, tt) => list[Math.floor(mod(jt(tt ?? CLIP.x.t), 1e9) / every) % list.length],
    bg: c.kind === 'sub' && c.bg && sc.backgrounds[c.bg] ? c.bg : null,
    under: (f, dflt, o) => { const oo = { sub: def.split || 'line', ...(o || {}) };
      if (CLIP.x.bg) return drawBackground(f, CLIP.x, CLIP.x.bg, oo);
      if (typeof dflt === 'function') return asElement(f, 'bg', () => dflt(f, CLIP.x, oo));
      return drawBackground(f, CLIP.x, typeof dflt === 'string' && sc.backgrounds[dflt] ? dflt : Object.keys(sc.backgrounds)[0], oo); } } };
  setElements(c.els || {});
  atlas.reset(); SENT_ALL = false;
}
const BLEND = { multiply: 1 };
const texMask = t => t === false ? 0 : 255;
/* 注意：圓弧、扇形只畫到實際佔的框，GPU 少算很多 */
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
  const { f, items } = placedItems(t), x = CLIP.x, drawn = {}, boxes = {};
  const n = items.length, buf = new Float32Array(Math.max(1, n) * ITEM_FLOATS), runs = [];
  const cz = SCENE.d.canvas ? (SCENE.d.canvas.z ?? .5) : null, sz = SCENE.d.shader ? (SCENE.d.shader.z ?? .5) : null;
  const marks = []; if (cz !== null) marks.push([cz, 3]); if (sz !== null) marks.push([sz, 4]); if (SCENE.d.world) marks.push([SCENE.d.world.z ?? .5, 5]); marks.sort((a, b) => a[0] - b[0]);
  let mi = 0;
  for (let i = 0; i < n; i++) {
    const it = items[i], o = it.o, p = i * ITEM_FLOATS, c = o.col;
    while (mi < marks.length && marks[mi][0] <= it.z) runs.push([marks[mi++][1], 0, i, 0]);
    const op = adjOf(it.el).opacity;
    buf[p + 4] = c[0]; buf[p + 5] = c[1]; buf[p + 6] = c[2]; buf[p + 7] = typeof op === 'number' && op !== 1 ? c[3] * op : c[3]; buf[p + 16] = texMask(o.tex);
    drawn[it.el] = (drawn[it.el] || 0) + 1; boxes[it.el] = grow(boxes[it.el], itemBox(it));
    if (it.t === 0) {
      buf[p] = o.cx; buf[p + 1] = o.cy; buf[p + 2] = o.hx; buf[p + 3] = o.hy;
      buf[p + 8] = o.ang; buf[p + 9] = o.kind; buf[p + 10] = o.a0; buf[p + 11] = o.sweep;
      buf[p + 12] = o.rough || 0; buf[p + 13] = o.seed || 0; buf[p + 14] = o.shadow || 0; buf[p + 15] = o.fiber || 0;
      if ((o.kind === 1 || o.kind === 3) && o.sweep < TAU) bbox(o, buf, p + 20);
    } else if (it.t === 1) {
      const e = o.e; buf[p] = o.x; buf[p + 1] = o.y; buf[p + 2] = o.w; buf[p + 3] = o.h;
      buf[p + 8] = e.u0; buf[p + 9] = e.v0; buf[p + 10] = e.u1; buf[p + 11] = e.v1;
      buf[p + 12] = o.rot; buf[p + 13] = o.shadow;
    } else {
      buf[p] = o.x0; buf[p + 1] = o.y0; buf[p + 2] = o.x1; buf[p + 3] = o.y1;
      buf[p + 8] = o.hw;
      buf[p + 12] = o.rough || 0; buf[p + 13] = o.seed || 0;
    }
    const k = it.t, bl = BLEND[o.blend] ?? 0, last = runs[runs.length - 1];
    if (last && last[0] === k && last[1] === bl && last[2] + last[3] === i) last[3]++; else runs.push([k, bl, i, 1]);
  }
  while (mi < marks.length) runs.push([marks[mi++][1], 0, n, 0]);
  const g = f.grid, gc = color(g.col), bg = color(f.bg);
  const out = { buf, n, runs, bg, drawn, boxes, grid: [g.w, g.h, g.alpha + g.flash, g.line, gc[0], gc[1], gc[2]] };
  if (SCENE.d.world) {
    const wo = worldFor(x); out.world = { key: wo.key, n: wo.n, keep: wo.keep, cam: cameraAt(t, x) };
  }
  return out;
}

self.onmessage = ev => {
  const m = ev.data;
  try {
    if (m.op === 'els') { setElements(m.els || {}); postMessage({ id: m.id, ok: true }); return; }
    if (m.op === 'boxes') { const fr = frame(m.t); postMessage({ id: m.id, ok: true, boxes: fr.boxes, drawn: fr.drawn }); return; }
    if (m.op === 'territory') { postMessage({ id: m.id, ok: true, boxes: territory() }); return; }
    if (m.op === 'hit') { postMessage({ id: m.id, ok: true, el: hitAt(m.t, m.x, m.y) }); return; }
    if (m.op === 'clip') { setClip(m.clip); if (SCENE.d.world) worldFor(CLIP.x); postMessage({ id: m.id, ok: true }); return; }
    if (m.op === 'frame') {
      const r = frame(m.t), at = atlas.take(!SENT_ALL || m.fullAtlas); SENT_ALL = true;
      const tr = [r.buf.buffer]; if (at) tr.push(at.a.buffer, at.b.buffer);
      let wbuf = null; if (r.world && (!WORLD.sent || m.fullWorld)) { wbuf = WORLD.buf.slice(0, WORLD.n * WORLD_FLOATS); WORLD.sent = true; tr.push(wbuf.buffer); }
      postMessage({ id: m.id, ok: true, frame: r, atlas: at, world: wbuf }, tr); return;
    }
  } catch (e) { postMessage({ id: m.id, ok: false, error: String(e && e.message || e), stack: String(e && e.stack || '') }); }
};
function __wmFail(e) { postMessage({ fail: true, error: String(e && e.message || e), stack: String(e && e.stack || '') }); }
function __wmReady() {
  if (!SCENE) throw new Error('新風格程式沒有呼叫 defineScene({...})');
  atlas = new Atlas();
  const d = SCENE.d, list = (o, f) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(k, v)]));
  postMessage({ ready: true, meta: {
    id: SCENE.id, name: d.name.trim().slice(0, 30), description: (d.description || '').trim(), palette: SCENE.defaults, labels: d.labels || null, params: SCENE.params,
    look: d.look || {}, textures: SCENE.textures,
    backgrounds: list(SCENE.backgrounds, (k, v) => ({ label: v.label || k, jumpBeats: [1, 2, 4, 8].includes(v.jumpBeats) ? v.jumpBeats : 4, uses: usesOf(v) })),
    subtitles: list(SCENE.subtitles, (k, v) => ({ label: v.label || k, split: v.split || 'line', seconds: Math.max(2, Math.min(60, v.seconds || (v.split === 'block' ? 16 : 6))) })),
    elements: { ...list(implicitInUse(), (k, label) => ({ label, fixed: isFixed(k), colors: [], params: {} })), ...list(SCENE.elements, (k, e) => ({ label: e.label, fixed: e.fixed, colors: e.colors, params: e.params })) },
    canvas: d.canvas ? { src: String(d.canvas.draw), z: d.canvas.z ?? .5, half: !!d.canvas.half } : null,
    shader: d.shader ? { code: d.shader.code, z: d.shader.z ?? .5 } : null,
    world: d.world ? { z: d.world.z ?? .5 } : null,
  } });
}
