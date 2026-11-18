'use strict';
/* 引擎：WebGPU 繪製、質感庫、Canvas 圖層、自訂 WGSL（含防護）、H.264 MP4 匯出、ZIP。不依賴任何外部檔案。 */
const W = 1920, H = 1080, FPS = 30, AW = 4096, AH = 2048;
const hexToRgb = h => { const n = parseInt(String(h).slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

const WGSL_NOISE = `
fn hash(p: vec2f) -> f32 { var p3 = fract(vec3f(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p); let w = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2f(1.0, 0.0)), w.x), mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), w.x), w.y);
}`;
const WGSL_U = `
struct U { res: vec2f, time: f32, frame: f32, grid: vec4f, bg: vec4f, gridCol: vec4f, post: vec4f, post2: vec4f, tex: array<vec4f, 16> };
@group(0) @binding(0) var<uniform> u: U;`;

const WGSL_MAIN = WGSL_U + `
struct It { a: vec4f, c: vec4f, p: vec4f, q: vec4f, e: vec4f, b: vec4f };
@group(0) @binding(1) var<storage, read> its: array<It>;
@group(0) @binding(2) var texA: texture_2d<f32>;
@group(0) @binding(3) var texB: texture_2d<f32>;
@group(0) @binding(4) var smp: sampler;
${WGSL_NOISE}
fn ndc(p: vec2f) -> vec4f { return vec4f(p.x / u.res.x * 2.0 - 1.0, 1.0 - p.y / u.res.y * 2.0, 0.0, 1.0); }
/* ---- 質感庫：slot = [種類, 作用圖層, 參數1, 參數2] [參數3, 參數4] ---- */
fn slotOn(i: u32, mask: u32, cls: u32) -> u32 {
  let s = u.tex[i * 2u];
  if ((mask & (1u << i)) == 0u || (u32(s.y) & cls) == 0u) { return 0u; }
  return u32(s.x);
}
fn texShift(px: vec2f, ink: vec3f, mask: u32, cls: u32) -> vec2f {
  var o = vec2f(0.0);
  for (var i = 0u; i < u32(u.post2.w); i++) {
    let ty = slotOn(i, mask, cls); if (ty == 0u) { continue; }
    let s = u.tex[i * 2u]; let r = u.tex[i * 2u + 1u];
    if (ty == 4u) {
      let k = select(0.0, floor(u.post2.y / max(s.w, 0.001)), s.w > 0.0);
      let h = hash(ink.rg * 97.3 + vec2f(ink.b * 41.7 + k * 3.1, k * 7.9 + 0.37));
      o += vec2f(cos(h * 6.2831853), sin(h * 6.2831853)) * s.z;
    } else if (ty == 7u) {
      let q = px * s.w + floor(u.time * r.x) * 13.7;
      o += (vec2f(vnoise(q), vnoise(q + 37.1)) - 0.5) * 2.0 * s.z;
    } else if (ty == 6u && cls == 2u) {
      let q = px * 0.45;
      o += (vec2f(vnoise(q), vnoise(q + 11.3)) - 0.5) * s.z;
    }
  }
  return px + o;
}
fn texEdge(px: vec2f, sd0: f32, mask: u32, cls: u32, seed: f32) -> vec2f {
  var sd = sd0; var soft = 1.0;
  for (var i = 0u; i < u32(u.post2.w); i++) {
    let ty = slotOn(i, mask, cls); if (ty == 0u) { continue; }
    let s = u.tex[i * 2u];
    if (ty == 6u) { sd += ((vnoise(px * 0.3 + seed) - 0.5) + (vnoise(px * 1.1 + seed * 1.3) - 0.5) * 0.5) * s.z; }
    else if (ty == 5u) { sd += (vnoise(px * 0.025 + seed) * 0.65 + vnoise(px * 0.09 + seed) * 0.35 - 0.5) * s.z; soft += s.z * 0.35; }
  }
  return vec2f(sd, soft);
}
fn texInk(px: vec2f, col: vec3f, cov: f32, a: f32, sd: f32, mask: u32, cls: u32, seed: f32) -> vec4f {
  var c = col; var al = cov * a;
  for (var i = 0u; i < u32(u.post2.w); i++) {
    let ty = slotOn(i, mask, cls); if (ty == 0u) { continue; }
    let s = u.tex[i * 2u]; let r = u.tex[i * 2u + 1u];
    if (ty == 1u) { let f = vnoise(px * vec2f(0.03, 0.28) + seed) * 0.6 + vnoise(px * 0.09 + seed) * 0.4; c *= 1.0 + (f - 0.5) * s.z; }
    else if (ty == 2u) { let g = px + vec2f(u.frame * 17.13, u.frame * 5.71); c += vec3f((hash(g) + hash(g + vec2f(31.7, 11.3)) - 1.0) * s.z); }
    else if (ty == 3u) {
      let an = s.w * 0.0174533; let cs = cos(an); let sn = sin(an);
      let q = vec2f(cs * px.x + sn * px.y, -sn * px.x + cs * px.y) / s.z;
      let d = length(fract(q) - 0.5) * s.z;
      let dens = clamp(a * r.x, 0.0, 1.0);
      al = cov * select(clamp(sqrt(dens) * s.z * 0.7072 - d + 0.5, 0.0, 1.0), 1.0, dens >= 0.999);
    }
    else if (ty == 6u && s.w > 0.0) { let n = vnoise(px * 0.5 + seed * 3.0) * 0.7 + hash(floor(px * 0.5) + seed) * 0.3; al *= smoothstep(s.w - 0.06, s.w + 0.06, n); }
    else if (ty == 5u) { c *= 1.0 - 0.22 * clamp(1.0 + sd / (2.0 + s.z), 0.0, 1.0) * min(s.z / 8.0, 1.0); }
  }
  return vec4f(c, al);
}
/* ---- 形狀：0 旋轉矩形、1 圓弧、2 圓、3 扇形、4 三角形；q = 手撕邊、亂數、紙影、纖維 ---- */
fn sdShape(px: vec2f, s: It) -> f32 {
  let k = s.p.y; let d = px - s.a.xy; var sd = 0.0;
  if (k > 3.5) {
    let ca = cos(s.p.x); let sa = sin(s.p.x);
    var q = vec2f(ca * d.x + sa * d.y, -sa * d.x + ca * d.y); q.y = -q.y;
    let kk = sqrt(3.0); let r = s.a.z * 0.866;
    var t = vec2f(abs(q.x) - r, q.y + r / kk);
    if (t.x + kk * t.y > 0.0) { t = vec2f(t.x - kk * t.y, -kk * t.x - t.y) / 2.0; }
    t.x -= clamp(t.x, -2.0 * r, 0.0);
    sd = -length(t) * sign(t.y);
  } else if (k > 2.5) {
    let len = length(d);
    var rel = atan2(d.y, d.x) - s.p.z; rel = rel - floor(rel / 6.2831853) * 6.2831853;
    sd = max(len - s.a.z, -min(rel, s.p.w - rel) * max(len, 1.0));
  } else if (k > 1.5) {
    sd = length(d) - s.a.z;
  } else if (k > 0.5) {
    let len = length(d);
    sd = abs(len - s.a.z) - s.a.w;
    if (s.p.w < 6.283) {
      var rel = atan2(d.y, d.x) - s.p.z; rel = rel - floor(rel / 6.2831853) * 6.2831853;
      sd = max(sd, -min(rel, s.p.w - rel) * len);
    }
  } else {
    let ca = cos(s.p.x); let sa = sin(s.p.x);
    let q = vec2f(ca * d.x + sa * d.y, -sa * d.x + ca * d.y);
    let e = abs(q) - s.a.zw;
    sd = length(max(e, vec2f(0.0))) + min(max(e.x, e.y), 0.0);
  }
  if (s.q.x > 0.0) { let n = vnoise(px * 0.045 + s.q.y) * 0.6 + vnoise(px * 0.21 + s.q.y * 1.7) * 0.4; sd += (n - 0.5) * s.q.x; }
  return sd;
}
struct SO { @builtin(position) pos: vec4f, @location(0) @interpolate(flat) id: u32 };
const QUAD = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0));
@vertex fn vs_full(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[i], 0.0, 1.0);
}
@fragment fn fs_bg(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let px = fc.xy; var col = u.bg.rgb;
  let gx = px.x % u.grid.x; let gy = px.y % u.grid.y;
  let dx = min(gx, u.grid.x - gx); let dy = min(gy, u.grid.y - gy); let lw = u.grid.w * 0.5;
  let gl = max(clamp(lw + 0.5 - dx, 0.0, 1.0), clamp(lw + 0.5 - dy, 0.0, 1.0));
  col = mix(col, u.gridCol.rgb, gl * u.grid.z);
  let ink = texInk(px, col, 1.0, 1.0, -9.0, 255u, 8u, 0.0);
  return vec4f(ink.rgb, 1.0);
}
@vertex fn vs_shape(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> SO {
  var cs = QUAD; let s = its[ii]; let c = cs[vi]; let k = s.p.y;
  let pad = 2.0 + s.q.x * 0.6 + u.post2.z + select(0.0, 30.0, s.q.z > 0.0);
  var p: vec2f;
  if (k < 0.5) { let h = s.a.zw + pad; let ca = cos(s.p.x); let sa = sin(s.p.x); let l = c * h; p = s.a.xy + vec2f(ca * l.x - sa * l.y, sa * l.x + ca * l.y); }
  else if (s.b.z > s.b.x) { p = mix(s.b.xy - pad, s.b.zw + pad, c * 0.5 + 0.5); }
  else { p = s.a.xy + c * (select(s.a.z, s.a.z + s.a.w, k > 0.5 && k < 1.5) + pad); }
  var o: SO; o.pos = ndc(p); o.id = ii; return o;
}
@fragment fn fs_shape(i: SO) -> @location(0) vec4f {
  let s = its[i.id]; let mask = u32(s.e.x);
  let px = texShift(i.pos.xy, s.c.rgb, mask, 1u);
  let ed = texEdge(px, sdShape(px, s), mask, 1u, s.q.y);
  let cov = clamp(0.5 - ed.x / ed.y, 0.0, 1.0);
  var sh = 0.0;
  if (s.q.z > 0.0) { sh = clamp(0.5 - sdShape(px - vec2f(5.0, 9.0), s) / 12.0, 0.0, 1.0) * s.q.z * 0.42 * s.c.a; }
  var col = s.c.rgb;
  if (s.q.w > 0.0) { let f = vnoise(px * vec2f(0.03, 0.28) + s.q.y) * 0.6 + vnoise(px * 0.09 + s.q.y) * 0.4; col *= 1.0 + (f - 0.5) * s.q.w; }
  let ink = texInk(px, col, cov, s.c.a, ed.x, mask, 1u, s.q.y);
  return vec4f(ink.rgb * ink.a, 1.0 - (1.0 - sh) * (1.0 - ink.a));
}
@vertex fn vs_glyph(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> SO {
  var cs = QUAD; let g = its[ii]; let c = cs[vi];
  let l = c * (g.a.zw * 0.5 + u.post2.z); let cr = cos(g.q.x); let sr = sin(g.q.x);
  var o: SO; o.pos = ndc(g.a.xy + vec2f(cr * l.x - sr * l.y, sr * l.x + cr * l.y)); o.id = ii; return o;
}
@fragment fn fs_glyph(i: SO) -> @location(0) vec4f {
  let g = its[i.id]; let mask = u32(g.e.x);
  let px = texShift(i.pos.xy, g.c.rgb, mask, 2u);
  let d = px - g.a.xy; let cr = cos(g.q.x); let sr = sin(g.q.x);
  let l = vec2f(cr * d.x + sr * d.y, -sr * d.x + cr * d.y) / g.a.zw + 0.5;
  let inb = select(0.0, 1.0, all(l >= vec2f(0.0)) && all(l <= vec2f(1.0)));
  let uv = mix(g.p.xy, g.p.zw, clamp(l, vec2f(0.0), vec2f(1.0)));
  let a = textureSampleLevel(texA, smp, uv, 0.0).r; let b = textureSampleLevel(texB, smp, uv, 0.0).r;
  var cov = select(a, b, g.q.y > 0.5) * inb;
  if (g.q.w > 0.0) { cov *= clamp((g.q.z - i.pos.x) / g.q.w, 0.0, 1.0); }
  let ink = texInk(px, g.c.rgb, cov, g.c.a, 0.5 - cov, mask, 2u, 0.0);
  return vec4f(ink.rgb * ink.a, ink.a);
}
@vertex fn vs_seg(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> SO {
  var cs = QUAD; let s = its[ii]; let c = cs[vi] * vec2f(0.5, 1.0) + vec2f(0.5, 0.0);
  let pad = s.p.x + max(s.p.y * 2.6, 0.0) + 1.5 + s.q.x * 0.6 + u.post2.z;
  let a = s.a.xy; let b = s.a.zw; let d = b - a; let len = length(d);
  let dir = select(vec2f(1.0, 0.0), d / max(len, 1e-4), len > 1e-4); let nrm = vec2f(-dir.y, dir.x);
  var o: SO; o.pos = ndc(a - dir * pad + dir * (len + 2.0 * pad) * c.x + nrm * pad * c.y); o.id = ii; return o;
}
@fragment fn fs_seg(i: SO) -> @location(0) vec4f {
  let s = its[i.id]; let mask = u32(s.e.x);
  let px = texShift(i.pos.xy, s.c.rgb, mask, 4u);
  let a = s.a.xy; let ba = s.a.zw - a;
  let h = clamp(dot(px - a, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  let d = length(px - a - ba * h);
  var sd = d - s.p.x;
  if (s.q.x > 0.0) { sd += (vnoise(px * 0.21 + s.q.y) - 0.5) * s.q.x; }
  let ed = texEdge(px, sd, mask, 4u, s.q.y);
  let core = clamp(0.5 - ed.x / ed.y, 0.0, 1.0);
  var glow = 0.0;
  if (s.p.y > 0.0) { let q = max(d - s.p.x, 0.0) / s.p.y; glow = s.p.z * exp(-q * q); }
  let ink = texInk(px, s.c.rgb, max(core, glow), s.c.a, ed.x, mask, 4u, s.q.y);
  return vec4f(ink.rgb * ink.a, ink.a);
}
`;
const WGSL_LAYER = WGSL_U + `
@group(0) @binding(1) var lay: texture_2d<f32>;
@group(0) @binding(2) var lay2: texture_2d<f32>;
@group(0) @binding(3) var smp: sampler;
${WGSL_NOISE}
@vertex fn vs_full(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[i], 0.0, 1.0);
}
/* Canvas 圖層：getImageData 是未預乘的 RGBA */
@fragment fn fs_canvas(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let c = textureSampleLevel(lay, smp, fc.xy / vec2f(${W}.0, ${H}.0), 0.0); return vec4f(c.rgb * c.a, c.a);
}
/* 半解析度的自訂 shader：只把「差值」放大回去，原本清楚的地方保持清楚 */
@fragment fn fs_half(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let uv = fc.xy / vec2f(${W}.0, ${H}.0);
  let base = textureLoad(lay, vec2i(fc.xy), 0);
  return vec4f(base.rgb + textureSampleLevel(lay2, smp, uv, 0.0).rgb - textureSampleLevel(lay, smp, uv, 0.0).rgb, 1.0);
}
@fragment fn fs_post(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  var c = textureLoad(lay, vec2i(fc.xy), 0).rgb;
  let uv = fc.xy / u.res;
  let paper = vnoise(fc.xy * vec2f(0.035, 0.32)) * 0.55 + vnoise(fc.xy * 0.11) * 0.45;
  c *= 1.0 + (paper - 0.5) * u.post2.x;
  let d = length((uv - 0.5) * vec2f(1.05, 1.0));
  c *= 1.0 - u.post.y * pow(clamp(d * 1.5 - 0.3, 0.0, 1.0), 1.6);
  let seed = fc.xy + vec2f(u.frame * 17.13, u.frame * 5.71);
  let g = hash(seed) + hash(seed + vec2f(31.7, 11.3)) - 1.0;
  c += vec3f(g * u.post.x * (0.45 + 0.55 * (1.0 - c)));
  c = vec3f(u.post.z) + c * (1.0 - u.post.z);
  c = min(c, vec3f(u.post.w));
  return vec4f(c, 1.0);
}`;
const WGSL_YUV = `
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> outb: array<u32>;
const W: u32 = ${W}u; const H: u32 = ${H}u;
fn yv(c: vec3f) -> u32 { return u32(round(16.0 + 219.0 * dot(c, vec3f(0.2126, 0.7152, 0.0722)))); }
@compute @workgroup_size(8, 8) fn cs_y(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= W / 4u || id.y >= H) { return; }
  var v = 0u;
  for (var k = 0u; k < 4u; k++) { let c = clamp(textureLoad(src, vec2u(id.x * 4u + k, id.y), 0).rgb, vec3f(0.0), vec3f(1.0)); v |= (yv(c) & 255u) << (8u * k); }
  outb[id.y * (W / 4u) + id.x] = v;
}
@compute @workgroup_size(8, 8) fn cs_uv(@builtin(global_invocation_id) id: vec3u) {
  let CW = W / 2u; let CH = H / 2u;
  if (id.x >= CW / 4u || id.y >= CH) { return; }
  var u = 0u; var v = 0u;
  for (var k = 0u; k < 4u; k++) {
    let x = (id.x * 4u + k) * 2u; let y = id.y * 2u;
    var c = textureLoad(src, vec2u(x, y), 0).rgb + textureLoad(src, vec2u(x + 1u, y), 0).rgb + textureLoad(src, vec2u(x, y + 1u), 0).rgb + textureLoad(src, vec2u(x + 1u, y + 1u), 0).rgb;
    c = clamp(c * 0.25, vec3f(0.0), vec3f(1.0));
    u |= (u32(round(128.0 + 224.0 * dot(c, vec3f(-0.1146, -0.3854, 0.5)))) & 255u) << (8u * k);
    v |= (u32(round(128.0 + 224.0 * dot(c, vec3f(0.5, -0.4542, -0.0458)))) & 255u) << (8u * k);
  }
  let row = CW / 4u;
  outb[(W * H) / 4u + id.y * row + id.x] = u;
  outb[(W * H + CW * CH) / 4u + id.y * row + id.x] = v;
}`;

/* ================= 自訂 WGSL：包裝、靜態檢查、編譯 ================= */
const SH_PRE = `struct CU { res: vec2f, time: f32, beat: f32, pal: array<vec4f, 8>, prm: array<vec4f, 2> };
@group(0) @binding(0) var<uniform> cu: CU;
@group(0) @binding(1) var wm_src: texture_2d<f32>;
@group(0) @binding(2) var wm_smp: sampler;
const RES = vec2f(${W}.0, ${H}.0);
fn scene(uv: vec2f) -> vec4f { return textureSampleLevel(wm_src, wm_smp, uv, 0.0); }
fn pal(i: i32) -> vec3f { return cu.pal[clamp(i, 0, 7)].rgb; }
fn param(i: i32) -> f32 { let k = clamp(i, 0, 7); return cu.prm[k / 4][k % 4]; }
fn hash(p: vec2f) -> f32 { var p3 = fract(vec3f(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
fn noise(p: vec2f) -> f32 { let i = floor(p); let f = fract(p); let w = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2f(1.0, 0.0)), w.x), mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), w.x), w.y); }
`;
const SH_POST = `
@vertex fn wm_vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[i], 0.0, 1.0);
}
@fragment fn wm_fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let uv = fc.xy / cu.res;
  let o = shade(uv, cu.time, cu.beat, scene(uv));
  return vec4f(clamp(o.rgb, vec3f(0.0), vec3f(1.0)), 1.0);
}`;
const SH_PRE_LINES = SH_PRE.split('\n').length - 1;
const SH_MAX_LEN = 6000, SH_MAX_ITER = 64, SH_MAX_NEST = 4096;
/* 靜態檢查：回傳錯誤陣列（含使用者程式的行號） */
function shaderStaticCheck(code) {
  const errs = [], src = String(code || '');
  const lineAt = i => src.slice(0, i).split('\n').length;
  const err = (i, m) => errs.push({ line: i < 0 ? 0 : lineAt(i), msg: m });
  if (src.length > SH_MAX_LEN) err(-1, `程式太長（${src.length} 字，上限 ${SH_MAX_LEN}）。`);
  // 註解換成空白（保留換行，行號不變）
  const s = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length));
  if (!/\bfn\s+shade\s*\(/.test(s)) err(-1, '找不到 fn shade(uv: vec2f, t: f32, beat: f32, base: vec4f) -> vec4f。');
  const ban = [[/\bloop\b/g, '不能用 loop（可能跑不完）。請改用 for，上限 64 次。'], [/\bwhile\b/g, '不能用 while。請改用 for，上限 64 次。'],
    [/@/g, '不能寫 @ 屬性（綁定、進入點由引擎處理）。'], [/\bvar\s*</g, '不能宣告 var<…> 全域資源（storage、workgroup、uniform 都不行）。'],
    [/\btextureStore\b|\batomic\w*\b|\bptr\s*</g, '不能寫入資源或用指標。'], [/\b(enable|requires|diagnostic)\b/g, '不能用 enable／requires／diagnostic 指令。'],
    [/\bwm_\w+/g, 'wm_ 開頭的名稱保留給引擎。']];
  for (const [re, m] of ban) { const x = re.exec(s); if (x) err(x.index, m); }
  // for：只允許 for (var i = 常數; i < 常數; i++)，次數 ≤ 64；迴圈變數不能在別處被改
  const FOR = /\bfor\s*\(\s*var\s+([A-Za-z_]\w*)\s*(?::\s*(?:i32|u32)\s*)?=\s*(\d+)[iu]?\s*;\s*\1\s*(<=?)\s*(\d+)[iu]?\s*;\s*(?:\1\s*\+\+|\+\+\s*\1|\1\s*\+=\s*1[iu]?)\s*\)\s*\{/g;
  const loops = []; let m;
  const anyFor = /\bfor\s*\(/g;
  while ((m = anyFor.exec(s))) {
    FOR.lastIndex = m.index; const f = FOR.exec(s);
    if (!f || f.index !== m.index) { err(m.index, 'for 的寫法只能是 for (var i = 0; i < 常數; i++) { … }。'); continue; }
    const n = Number(f[4]) - Number(f[2]) + (f[3] === '<=' ? 1 : 0);
    if (n > SH_MAX_ITER) err(m.index, `for 迴圈 ${n} 次，超過上限 ${SH_MAX_ITER}。`);
    // 找迴圈本體的範圍
    let depth = 1, j = FOR.lastIndex; while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
    loops.push({ start: m.index, end: j, n: Math.max(0, n), v: f[1], head: [m.index, FOR.lastIndex] });
  }
  let rest = s; for (const l of loops) rest = rest.slice(0, l.head[0]) + ' '.repeat(l.head[1] - l.head[0]) + rest.slice(l.head[1]);
  for (const l of loops) {
    const re = new RegExp('\\b' + l.v + '\\s*(\\+\\+|--|[-+*/%&|^]?=(?!=))', 'g'); const x = re.exec(rest);
    if (x) err(x.index, `迴圈變數 ${l.v} 不能在迴圈裡被改（也不要在別處重複用這個名稱）。`);
    let prod = l.n; for (const o of loops) if (o !== l && o.start < l.start && o.end >= l.end) prod *= o.n;
    if (prod > SH_MAX_NEST) err(l.start, `巢狀迴圈總次數 ${prod}，超過上限 ${SH_MAX_NEST}（每個像素都要跑這麼多次）。`);
  }
  return errs;
}
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); };

/* ================= 渲染器 ================= */
class Renderer {
  async init(canvas) {
    if (!navigator.gpu) throw new Error('NO_WEBGPU');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('NO_WEBGPU');
    const d = this.device = await adapter.requestDevice();
    this.intentional = false;
    d.addEventListener('uncapturederror', e => console.warn('GPU error:', e.error.message));
    this.canvas = canvas; this.format = 'rgba8unorm';
    if (canvas) { canvas.width = W; canvas.height = H; this.ctx = canvas.getContext('webgpu'); this.format = navigator.gpu.getPreferredCanvasFormat(); this.ctx.configure({ device: d, format: this.format, alphaMode: 'opaque' }); }
    const B = GPUBufferUsage, T = GPUTextureUsage, SS = GPUShaderStage;
    this.ubuf = d.createBuffer({ size: 352, usage: B.UNIFORM | B.COPY_DST });
    this.cubuf = d.createBuffer({ size: 192, usage: B.UNIFORM | B.COPY_DST });
    this.itemCap = 0; this.ensureItems(4096);
    const r8 = () => d.createTexture({ size: [AW, AH], format: 'r8unorm', usage: T.TEXTURE_BINDING | T.COPY_DST });
    this.texA = r8(); this.texB = r8();
    const scn = (w = W, h = H) => d.createTexture({ size: [w, h], format: 'rgba16float', usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING });
    this.scn = [scn(), scn()]; this.half = scn(W / 2, H / 2);
    this.outTex = d.createTexture({ size: [W, H], format: 'rgba8unorm', usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING });
    this.smp = d.createSampler({ magFilter: 'linear', minFilter: 'linear' });
    this.canvasTex = null;
    // YUV（BT.709 limited）
    const YUV = W * H * 3 / 2;
    this.yuvBuf = d.createBuffer({ size: YUV, usage: B.STORAGE | B.COPY_SRC });
    this.readBuf = d.createBuffer({ size: YUV, usage: B.COPY_DST | B.MAP_READ });
    const cmod = d.createShaderModule({ code: WGSL_YUV });
    this.pY = d.createComputePipeline({ layout: 'auto', compute: { module: cmod, entryPoint: 'cs_y' } });
    this.pUV = d.createComputePipeline({ layout: 'auto', compute: { module: cmod, entryPoint: 'cs_uv' } });
    this.yuvBind = [this.pY, this.pUV].map(p => d.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [
      { binding: 0, resource: this.outTex.createView() }, { binding: 1, resource: { buffer: this.yuvBuf } }] }));
    // 主要圖層
    const mod = d.createShaderModule({ code: WGSL_MAIN });
    this.ibgl = d.createBindGroupLayout({ entries: [
      { binding: 0, visibility: SS.VERTEX | SS.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: SS.VERTEX | SS.FRAGMENT, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: SS.FRAGMENT, texture: {} }, { binding: 3, visibility: SS.FRAGMENT, texture: {} },
      { binding: 4, visibility: SS.FRAGMENT, sampler: {} }] });
    const pl = d.createPipelineLayout({ bindGroupLayouts: [this.ibgl] });
    const BL = [
      { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } },
      { color: { srcFactor: 'dst', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } },
      { color: { operation: 'max', srcFactor: 'one', dstFactor: 'one' }, alpha: { operation: 'max', srcFactor: 'one', dstFactor: 'one' } }];
    const mk = (vs, fs, blend) => d.createRenderPipeline({ layout: pl, vertex: { module: mod, entryPoint: vs },
      fragment: { module: mod, entryPoint: fs, targets: [blend ? { format: 'rgba16float', blend } : { format: 'rgba16float' }] }, primitive: { topology: 'triangle-list' } });
    this.pBg = mk('vs_full', 'fs_bg', null);
    this.pItem = [['vs_shape', 'fs_shape'], ['vs_glyph', 'fs_glyph'], ['vs_seg', 'fs_seg']].map(([v, f]) => BL.map(b => mk(v, f, b)));
    // 圖層合成、後製
    const lmod = d.createShaderModule({ code: WGSL_LAYER });
    this.lbgl = d.createBindGroupLayout({ entries: [
      { binding: 0, visibility: SS.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: SS.FRAGMENT, texture: {} }, { binding: 2, visibility: SS.FRAGMENT, texture: {} },
      { binding: 3, visibility: SS.FRAGMENT, sampler: {} }] });
    const lpl = d.createPipelineLayout({ bindGroupLayouts: [this.lbgl] });
    const lmk = (fs, format, blend) => d.createRenderPipeline({ layout: lpl, vertex: { module: lmod, entryPoint: 'vs_full' },
      fragment: { module: lmod, entryPoint: fs, targets: [blend ? { format, blend } : { format }] }, primitive: { topology: 'triangle-list' } });
    this.pCanvas = lmk('fs_canvas', 'rgba16float', BL[0]);
    this.pHalf = lmk('fs_half', 'rgba16float', null);
    this.pPostOut = lmk('fs_post', 'rgba8unorm', null);
    this.pPostView = canvas ? lmk('fs_post', this.format, null) : null;
    this.postBind = this.scn.map(t => this.lbind(t, t));
    this.halfBind = this.scn.map(t => this.lbind(t, this.half));
    // 自訂 shader 的綁定
    this.cbgl = d.createBindGroupLayout({ entries: [
      { binding: 0, visibility: SS.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: SS.FRAGMENT, texture: {} }, { binding: 2, visibility: SS.FRAGMENT, sampler: {} }] });
    this.cpl = d.createPipelineLayout({ bindGroupLayouts: [this.cbgl] });
    this.cBind = this.scn.map(t => d.createBindGroup({ layout: this.cbgl, entries: [
      { binding: 0, resource: { buffer: this.cubuf } }, { binding: 1, resource: t.createView() }, { binding: 2, resource: this.smp }] }));
    this.look = { grain: .035, vignette: .22, lift: .025, cap: .93, paper: .05 };
    this.tex = new Float32Array(64); this.texPad = 0; this.texN = 0; this.pal8 = new Float32Array(32); this.prm8 = new Float32Array(8);
    this.shader = null;   // { pipeline, half, code, hash }
  }
  lbind(a, b) {
    return this.device.createBindGroup({ layout: this.lbgl, entries: [
      { binding: 0, resource: { buffer: this.ubuf } }, { binding: 1, resource: a.createView() }, { binding: 2, resource: b.createView() }, { binding: 3, resource: this.smp }] });
  }
  ensureItems(n) {
    if (n <= this.itemCap) return;
    this.itemCap = Math.max(n, this.itemCap * 2);
    if (this.itemBuf) this.itemBuf.destroy();
    this.itemBuf = this.device.createBuffer({ size: this.itemCap * 96, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.ibind = null;
  }
  itemBind() {
    return this.ibind || (this.ibind = this.device.createBindGroup({ layout: this.ibgl, entries: [
      { binding: 0, resource: { buffer: this.ubuf } }, { binding: 1, resource: { buffer: this.itemBuf } },
      { binding: 2, resource: this.texA.createView() }, { binding: 3, resource: this.texB.createView() }, { binding: 4, resource: this.smp }] }));
  }
  /* 場景的後製、質感庫、配色與參數（給自訂 shader） */
  setScene({ look = {}, textures = [], pal = {}, palKeys = [], params = [] }) {
    const L = this.look = { grain: .035, vignette: .22, lift: .025, cap: .93, paper: .05 };
    for (const k of Object.keys(L)) if (typeof look[k] === 'number') L[k] = look[k];
    L.lift = Math.max(.015, L.lift); L.cap = Math.min(.95, L.cap);       // 固定：不要純黑純白
    const T = { fiber: 1, grain: 2, halftone: 3, misreg: 4, bleed: 5, rough: 6, wobble: 7 }, ON = { shapes: 1, text: 2, lines: 4, bg: 8 };
    const t = this.tex = new Float32Array(64); let pad = 0;
    textures.slice(0, 8).forEach((x, i) => {
      const on = String(x.on || 'shapes').split(/[ ,+]+/).reduce((m, o) => m | (ON[o] || 0), 0), o = i * 8, v = (k, d) => typeof x[k] === 'number' ? x[k] : d;
      t[o] = T[x.type] || 0; t[o + 1] = on;
      if (x.type === 'fiber') t[o + 2] = v('amount', .12);
      else if (x.type === 'grain') t[o + 2] = v('amount', .04);
      else if (x.type === 'halftone') { t[o + 2] = Math.max(3, v('cell', 8)); t[o + 3] = v('angle', 15); t[o + 4] = v('tone', 1); }
      else if (x.type === 'misreg') { t[o + 2] = Math.min(24, v('amount', 4)); t[o + 3] = v('every', 0); pad += t[o + 2]; }
      else if (x.type === 'bleed') { t[o + 2] = Math.min(30, v('amount', 6)); pad += t[o + 2]; }
      else if (x.type === 'rough') { t[o + 2] = Math.min(20, v('amount', 3)); t[o + 3] = v('voids', .15); pad += t[o + 2]; }
      else if (x.type === 'wobble') { t[o + 2] = Math.min(20, v('amount', 3)); t[o + 3] = v('scale', .012); t[o + 4] = v('fps', 8); pad += t[o + 2] * 2; }
    });
    this.texPad = pad; this.texN = Math.min(8, textures.length);
    this.pal8 = new Float32Array(32); palKeys.slice(0, 8).forEach((k, i) => this.pal8.set([...hexToRgb(pal[k] || '#808080'), 1], i * 4));
    this.prm8 = new Float32Array(8); params.slice(0, 8).forEach((v, i) => { this.prm8[i] = v; });
  }
  uploadAtlas(at) {
    if (!at || !at.h) return;
    for (const [arr, tex] of [[at.a, this.texA], [at.b, this.texB]]) this.device.queue.writeTexture({ texture: tex, origin: [0, at.y] }, arr, { bytesPerRow: AW }, [AW, at.h]);
  }
  uploadCanvas(px, w, h) {
    if (!this.canvasTex || this.canvasTex.width !== w) {
      if (this.canvasTex) this.canvasTex.destroy();
      this.canvasTex = this.device.createTexture({ size: [w, h], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
      this.canvasBind = this.lbind(this.canvasTex, this.canvasTex);
    }
    this.device.queue.writeTexture({ texture: this.canvasTex }, px, { bytesPerRow: w * 4 }, [w, h]);
    this.canvasOn = true;
  }
  /* 畫一格。fr = 場景 Worker 給的 { buf, n, runs, bg, grid }；target：'out'（匯出／抽格）或 'canvas'（預覽） */
  render(fr, idx, target, time, beat) {
    const d = this.device, L = this.look, q = d.queue;
    const U = new Float32Array(88);
    U.set([W, H, time, idx, fr.grid[0], fr.grid[1], fr.grid[2], fr.grid[3], fr.bg[0], fr.bg[1], fr.bg[2], 1, fr.grid[4], fr.grid[5], fr.grid[6], 1,
      L.grain, L.vignette, L.lift, L.cap, L.paper, beat, this.texPad, this.texN]);
    U.set(this.tex, 24);
    q.writeBuffer(this.ubuf, 0, U);
    if (fr.n) { this.ensureItems(fr.n); q.writeBuffer(this.itemBuf, 0, fr.buf, 0, fr.n * 24); }
    const enc = d.createCommandEncoder(); let cur = 0;
    const begin = (load) => enc.beginRenderPass({ colorAttachments: [{ view: this.scn[cur].createView(), loadOp: load ? 'load' : 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
    let p = begin(false); p.setBindGroup(0, this.itemBind()); p.setPipeline(this.pBg); p.draw(3);
    for (const [k, bl, first, count] of fr.runs) {
      if (k <= 2) { if (count) { p.setPipeline(this.pItem[k][bl]); p.draw(6, count, 0, first); } }
      else if (k === 3) { if (this.canvasOn) { p.setPipeline(this.pCanvas); p.setBindGroup(0, this.canvasBind); p.draw(3); p.setBindGroup(0, this.itemBind()); } }
      else if (k === 4 && this.shader) {
        p.end();
        const sh = this.shader, nxt = 1 - cur;
        q.writeBuffer(this.cubuf, 0, new Float32Array([sh.half ? W / 2 : W, sh.half ? H / 2 : H, time, beat]));
        q.writeBuffer(this.cubuf, 16, this.pal8); q.writeBuffer(this.cubuf, 144, this.prm8);
        const c = enc.beginRenderPass({ colorAttachments: [{ view: (sh.half ? this.half : this.scn[nxt]).createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
        c.setPipeline(sh.pipeline); c.setBindGroup(0, this.cBind[cur]); c.draw(3); c.end();
        if (sh.half) {
          const h = enc.beginRenderPass({ colorAttachments: [{ view: this.scn[nxt].createView(), loadOp: 'clear', storeOp: 'store' }] });
          h.setPipeline(this.pHalf); h.setBindGroup(0, this.halfBind[cur]); h.draw(3); h.end();
        }
        cur = nxt; p = begin(true); p.setBindGroup(0, this.itemBind());
      }
    }
    p.end();
    const toOut = target === 'out' || !this.ctx;
    const view = toOut ? this.outTex.createView() : this.ctx.getCurrentTexture().createView();
    const pp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] });
    pp.setPipeline(toOut ? this.pPostOut : this.pPostView); pp.setBindGroup(0, this.postBind[cur]); pp.draw(3); pp.end();
    if (target === 'out') {
      const cp = enc.beginComputePass();
      cp.setPipeline(this.pY); cp.setBindGroup(0, this.yuvBind[0]); cp.dispatchWorkgroups(W / 4 / 8, Math.ceil(H / 8));
      cp.setPipeline(this.pUV); cp.setBindGroup(0, this.yuvBind[1]); cp.dispatchWorkgroups(W / 8 / 8, Math.ceil(H / 2 / 8));
      cp.end();
      enc.copyBufferToBuffer(this.yuvBuf, 0, this.readBuf, 0, W * H * 3 / 2);
    }
    q.submit([enc.finish()]);
  }
  async readFrame(timestamp) {
    await this.readBuf.mapAsync(GPUMapMode.READ);
    const data = new Uint8Array(this.readBuf.getMappedRange()).slice();
    this.readBuf.unmap();
    return new VideoFrame(data, { format: 'I420', codedWidth: W, codedHeight: H, timestamp, duration: Math.round(1e6 / FPS),
      colorSpace: { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false } });
  }
  /* ---- 自訂 shader：編譯（行號）→ 建 pipeline ---- */
  async compileShader(user) {
    const d = this.device, code = SH_PRE + user + SH_POST;
    d.pushErrorScope('validation');
    const module = d.createShaderModule({ code });
    const info = await module.getCompilationInfo();
    const errs = info.messages.filter(m => m.type === 'error').map(m => ({ line: m.lineNum - SH_PRE_LINES, msg: m.message }));
    let pipeline = null;
    if (!errs.length) {
      try {
        pipeline = await d.createRenderPipelineAsync({ layout: this.cpl, vertex: { module, entryPoint: 'wm_vs' },
          fragment: { module, entryPoint: 'wm_fs', targets: [{ format: 'rgba16float' }] }, primitive: { topology: 'triangle-list' } });
      } catch (e) { errs.push({ line: 0, msg: e.message }); }
    }
    const ve = await d.popErrorScope();
    if (ve && !errs.length) errs.push({ line: 0, msg: ve.message });
    return { pipeline, errs };
  }
  /* ---- 試跑測速：極小解析度開始，用 onSubmittedWorkDone 量時間，逾時視為卡住 ---- */
  async timeShader(pipeline, w, h, reps, timeout) {
    const d = this.device;
    const tex = d.createTexture({ size: [w, h], format: 'rgba16float', usage: GPUTextureUsage.RENDER_ATTACHMENT });
    d.queue.writeBuffer(this.cubuf, 0, new Float32Array([w, h, 1.25, 2.5]));
    d.queue.writeBuffer(this.cubuf, 16, this.pal8); d.queue.writeBuffer(this.cubuf, 144, this.prm8);
    const t0 = performance.now(), enc = d.createCommandEncoder();
    for (let i = 0; i < reps; i++) {
      const p = enc.beginRenderPass({ colorAttachments: [{ view: tex.createView(), loadOp: 'clear', storeOp: 'store' }] });
      p.setPipeline(pipeline); p.setBindGroup(0, this.cBind[0]); p.draw(3); p.end();
    }
    d.queue.submit([enc.finish()]);
    const ok = await Promise.race([d.queue.onSubmittedWorkDone().then(() => true), new Promise(r => setTimeout(() => r(false), timeout))]);
    tex.destroy();
    if (!ok) throw new Error('HANG');
    return (performance.now() - t0) / reps;
  }
}

/* ================= MP4（H.264）封裝 ================= */
const MP4 = (() => {
  const u8 = (...v) => new Uint8Array(v), u16 = v => u8(v >> 8 & 255, v & 255), u32 = v => u8(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
  const str = s => new Uint8Array([...s].map(c => c.charCodeAt(0))), zeros = n => new Uint8Array(n);
  function box(type, ...parts) {
    let len = 8; for (const p of parts) len += p.length;
    const b = new Uint8Array(len); new DataView(b.buffer).setUint32(0, len); b.set(str(type), 4);
    let o = 8; for (const p of parts) { b.set(p, o); o += p.length; } return b;
  }
  const full = (type, v, f, ...parts) => box(type, u8(v, f >> 16 & 255, f >> 8 & 255, f & 255), ...parts);
  const MATRIX = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000];
  function build({ width, height, fps, samples, avcC }) {
    const n = samples.length, ts = fps * 1000, delta = 1000, dur = n * delta;
    let cto = samples.map((s, i) => Math.round(s.ts / 1e6 * ts) - i * delta);
    const shift = -Math.min(0, ...cto); cto = cto.map(c => c + shift);
    const needCtts = cto.some(c => c !== 0);
    const ftyp = box('ftyp', str('isom'), u32(512), str('isomiso2avc1mp41'));
    let size = 0; for (const s of samples) size += s.data.length;
    const mdatHead = new Uint8Array(8); new DataView(mdatHead.buffer).setUint32(0, size + 8); mdatHead.set(str('mdat'), 4);
    const offset = ftyp.length + 8;
    const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(ts), u32(dur), u32(0x00010000), u16(0x0100), zeros(10), ...MATRIX.map(u32), zeros(24), u32(2));
    const tkhd = full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(dur), zeros(8), u16(0), u16(0), u16(0), u16(0), ...MATRIX.map(u32), u32(width * 65536), u32(height * 65536));
    const mdhd = full('mdhd', 0, 0, u32(0), u32(0), u32(ts), u32(dur), u16(0x55c4), u16(0));
    const hdlr = full('hdlr', 0, 0, u32(0), str('vide'), zeros(12), str('VideoHandler'), u8(0));
    const dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
    const colr = box('colr', str('nclx'), u16(1), u16(1), u16(1), u8(0));
    const avc1 = box('avc1', zeros(6), u16(1), zeros(16), u16(width), u16(height), u32(0x00480000), u32(0x00480000), u32(0), u16(1), zeros(32), u16(0x18), u16(0xffff), box('avcC', avcC), colr);
    const keys = []; samples.forEach((s, i) => { if (s.key) keys.push(i + 1); });
    const stbl = box('stbl', full('stsd', 0, 0, u32(1), avc1), full('stts', 0, 0, u32(1), u32(n), u32(delta)),
      ...(needCtts ? [full('ctts', 0, 0, u32(n), ...cto.flatMap(c => [u32(1), u32(c)]))] : []),
      full('stss', 0, 0, u32(keys.length), ...keys.map(u32)), full('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1)),
      full('stsz', 0, 0, u32(0), u32(n), ...samples.map(s => u32(s.data.length))), full('stco', 0, 0, u32(1), u32(offset)));
    const edts = needCtts ? [box('edts', full('elst', 0, 0, u32(1), u32(dur), u32(shift), u32(0x00010000)))] : [];
    const trak = box('trak', tkhd, ...edts, box('mdia', mdhd, hdlr, box('minf', full('vmhd', 0, 1, zeros(8)), dinf, stbl)));
    return new Blob([ftyp, mdatHead, ...samples.map(s => s.data), box('moov', mvhd, trak)], { type: 'video/mp4' });
  }
  return { build };
})();
async function pickCodec() {
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028']) {
    const cfg = { codec, width: W, height: H, bitrate: 12_000_000, framerate: FPS, avc: { format: 'avc' } };
    try { const s = await VideoEncoder.isConfigSupported(cfg); if (s.supported) return cfg; } catch (e) { }
  }
  throw new Error('NO_H264');
}
/* 逐格算出來並編成 MP4；renderOut(i) 要把第 i 格畫到 'out' */
async function encodeFrames(r, frames, renderOut, onProgress, isCancelled) {
  if (typeof VideoEncoder === 'undefined') throw new Error('NO_H264');
  const cfg = await pickCodec(), samples = []; let avcC = null, err = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => {
      const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
      samples.push({ data, key: chunk.type === 'key', ts: chunk.timestamp });
      const desc = meta && meta.decoderConfig && meta.decoderConfig.description;
      if (desc && !avcC) avcC = new Uint8Array(desc instanceof ArrayBuffer ? desc : desc.buffer.slice(desc.byteOffset, desc.byteOffset + desc.byteLength));
    },
    error: e => { err = e; },
  });
  enc.configure(cfg);
  try {
    for (let i = 0; i < frames; i++) {
      if (err) throw err;
      if (isCancelled && isCancelled()) throw new Error('CANCELLED');
      await renderOut(i);
      const vf = await r().readFrame(Math.round(i * 1e6 / FPS));
      enc.encode(vf, { keyFrame: i % (FPS * 2) === 0 }); vf.close();
      while (enc.encodeQueueSize > 4) await new Promise(res => setTimeout(res, 2));
      if (onProgress && (i % 5 === 0 || i === frames - 1)) onProgress((i + 1) / frames);
    }
    await enc.flush();
  } finally { if (enc.state !== 'closed') enc.close(); }
  if (err) throw err;
  if (!avcC) throw new Error('NO_H264');
  return MP4.build({ width: W, height: H, fps: FPS, samples, avcC });
}
/* ================= ZIP（不壓縮） ================= */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
async function makeZip(files) {
  const parts = [], central = []; let offset = 0;
  for (const f of files) {
    const data = new Uint8Array(await f.blob.arrayBuffer()), name = new TextEncoder().encode(f.name), crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(12, 0x21, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  let cd = 0; for (const c of central) cd += c.length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cd, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
// 在 claude.ai 的 artifact 裡，下載要透過平台的 downloads（會先請使用者確認）；本機打開則用一般下載。
let __dlCap = null;
try { if (typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function') __dlCap = window.claude.use('downloads').catch(() => null); } catch (e) { __dlCap = null; }
async function download(blob, name) {
  const cap = __dlCap ? await __dlCap : null;
  if (cap) {
    try { await cap.save({ filename: name, data: blob }); return; }
    catch (e) { if (e && (e.code === 'declined' || e.code === 'rate_limited' || e.code === 'bad_request')) return; }
  }
  __plainDownload(blob, name);
}
function __plainDownload(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 120000);
}
