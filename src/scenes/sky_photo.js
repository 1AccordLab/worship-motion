/* 天空・寫實：自訂 WGSL 程序化天空。大氣漸層（依太陽高度）、fbm＋域扭曲的體積雲（受光面、陰影面、邊緣透光），
   三層雲各自的速度飄移；雲一邊飄一邊慢慢生成、消散（兩份交替淡入淡出），16 秒頭尾相接。peak：雲開、陽光從雲隙灑下。
   不用鏡頭光斑、散景光點、粒子、人工光暈圈；背景不放字。較吃顯示卡（沒有顯示卡時自動降成半解析度或改用平面底）。
   背景種類用左上角 6×6 像素的「記號色」告訴 shader（紅＝背景強度 0／.5／1，綠＝字幕模式），shader 會把整個畫面蓋掉。 */
const SKP = { bg: '#3a4656', zen: '#2a3b52', hor: '#7d8a92', warm: '#dcae6e', cloud: '#d9d6cc', shade: '#4a5462' };
const MODE = { calm: 0, build: .5, peak: 1 };
const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const mixc = (a, b, k) => { const x = rgb(a), y = rgb(b); return [lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k)]; };

// 沒有 shader 時看到的底（分階的天色）＋記號
function base(f, mode, text) {
  f.bg = SKP.zen;
  for (let i = 1; i < 8; i++) f.add(rect(0, i * 135, W, i * 135 + 136, mixc(SKP.zen, mode > .7 ? SKP.warm : SKP.hor, i / 8)));
  f.add(rect(0, 0, 6, 6, [mode, text, 0]));
}
const bg = mode => (f, x) => base(f, mode, 0);

/* ---------- 字幕共用：淺色字＋柔和的字影（在照片上也讀得到）；逐行慢慢淡入，無彈跳無放大 ---------- */
const hasMark = x => /\[.+?\]/.test(x.swap ? x.text2 : x.text);
function say(f, s, x0, y, o, col, a, soft = true) {   // soft：整行用模糊字影；逐字的用不模糊的位移字影（模糊很花時間）
  if (a <= .003 || !s) return;
  if (soft) f.text(s, x0, y + 4, { ...o, shadow: true, blur: 14, col: SKP.zen, a: .75 * a });
  else f.text(s, x0 + 2, y + 3, { ...o, col: SKP.zen, a: .55 * a });
  f.text(s, x0, y, { ...o, col, a });
}
function gentle(f, x) {
  base(f, .35, 1);
  const t = x.t, big = x.big.slice(0, 3), small = x.small.slice(0, 3), n = Math.max(1, big.length, small.length), two = small.length > 0;
  const gap = two ? 150 : 124, y0 = 524 - gap * (n - 1) / 2, TX = { px: 82, weight: 600, spacing: 8 }, SM = { px: 38, weight: 500, spacing: 3 };
  for (let i = 0; i < n; i++) {
    const a = E.io(seg(t, .3 + i * .4, 1.8 + i * .4)), y = y0 + i * gap;
    if (big[i]) say(f, big[i], 960, y, { ...TX, scale: f.fit(big[i], 1500, TX) }, SKP.cloud, a);
    if (small[i]) say(f, small[i], 960, y + 60, { ...SM, scale: f.fit(small[i], 1440, SM) }, SKP.cloud, .66 * E.io(seg(t, .7 + i * .4, 2.2 + i * .4)));
  }
  const r = E.io(seg(t, 1.2 + n * .4, 3 + n * .4)), uy = y0 + (n - 1) * gap + (two ? 116 : 80);
  if (r > .004) f.add(rect(960 - 90, uy - 2, 960 + 90, uy + 2, SKP.warm, .9 * r, { z: .8 }));
}
function flashy(f, x) {
  base(f, .6, 1);
  const t = x.t, sub = x.small[0] || '', cy = sub ? 500 : 540, kw = hasMark(x) ? x.kw : -1, chars = x.chars, n = chars.length;
  const ST = { px: 100, weight: 500 }, KS = { px: 100, weight: 900 };
  const ws = chars.map((c, i) => f.measure(c, i === kw ? KS : ST).tw), total = ws.reduce((a, b) => a + b, 0) + 6 * Math.max(0, n - 1), sc = Math.min(1, 1500 / Math.max(1, total));
  let cx = 960 - total * sc / 2;
  chars.forEach((c, i) => {
    const w = ws[i] * sc, isK = i === kw, ti = isK ? .3 + n * .08 + .35 : .3 + i * .08;
    say(f, c, cx + w / 2, cy, { ...(isK ? KS : ST), scale: sc }, isK ? SKP.warm : SKP.cloud, E.io(seg(t, ti, ti + (isK ? 1.8 : 1.3))), false);
    cx += w + 6 * sc;
  });
  const end = .3 + n * .08 + 1.3;
  if (sub) { const SM = { px: 44, weight: 500, spacing: 3 }; say(f, sub, 960, cy + 96, { ...SM, scale: f.fit(sub, 1440, SM) }, SKP.cloud, .66 * E.io(seg(t, end, end + 1.5))); }
  const r = E.io(seg(t, end + .4, end + 2.2)), uy = cy + (sub ? 150 : 92);
  if (r > .004) f.add(rect(960 - 70, uy - 2, 960 + 70, uy + 2, SKP.warm, .9 * r, { z: .8 }));
}

defineScene({
  id: 'sky_photo', name: '天空・寫實',
  palette: SKP, labels: { zen: '天頂', hor: '地平線', warm: '陽光', cloud: '雲亮面', shade: '雲暗面' },
  look: { grain: .03, vignette: .2 },
  backgrounds: {
    calm: { label: '平靜（雲很慢、深藍灰）', jumpBeats: 8, draw: bg(MODE.calm) },
    build: { label: '累積（雲層翻湧）', jumpBeats: 4, draw: bg(MODE.build) },
    peak: { label: '高潮（雲開、陽光灑下）', jumpBeats: 4, draw: bg(MODE.peak) },
  },
  subtitles: {
    flashy: { label: '華麗（克制）', split: 'line', seconds: 7, draw: flashy },
    gentle: { label: '收斂', split: 'block', seconds: 16, draw: gentle },
  },
  shader: { z: .5, code: `
fn pn(p: vec2f, w: f32) -> f32 {
  let i = floor(p); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  let a = i.x - w * floor(i.x / w); let b = a + 1.0 - w * floor((a + 1.0) / w);
  return mix(mix(hash(vec2f(a, i.y)), hash(vec2f(b, i.y)), u.x), mix(hash(vec2f(a, i.y + 1.0)), hash(vec2f(b, i.y + 1.0)), u.x), u.y);
}
fn fbm(p: vec2f, w: f32) -> f32 {
  var s = 0.0; var a = 0.5; var q = p; var k = w;
  for (var o = 0; o < 4; o++) { s += a * pn(q, k); q = q * 2.03 + vec2f(0.0, 7.1); k = k * 2.0; a *= 0.5; }
  return s;
}
fn cloud(p: vec2f, w: f32, th: f32, sd: vec2f) -> vec2f {
  let wp = p + 0.7 * vec2f(pn(p * 0.5 + vec2f(0.0, 31.0), w), pn(p * 0.5 + vec2f(0.0, 57.0), w));
  let d = fbm(wp, w);
  let l = fbm(wp + sd, w);
  return vec2f(smoothstep(th, th + 0.16, d), clamp(0.62 + (d - l) * 4.5, 0.0, 1.0));
}
fn layer(uv: vec2f, t: f32, sc: f32, sp: f32, th: f32, sd: vec2f, sy: f32) -> vec2f {
  let ph = fract(t / 16.0); let w0 = sin(3.14159 * ph); let w1 = cos(3.14159 * ph);
  let p = vec2f(uv.x * 1.78 * sc, uv.y * sc * 1.9);
  let a = cloud(p + vec2f(sp * ph + 40.0, sy), 64.0, th, sd);
  let b = cloud(p + vec2f(sp * fract(ph + 0.5) + 80.0, sy + 9.0), 64.0, th, sd);
  let den = a.x * w0 * w0 + b.x * w1 * w1;
  return vec2f(den, (a.y * a.x * w0 * w0 + b.y * b.x * w1 * w1) / max(den, 0.001));
}
fn shade(uv: vec2f, t: f32, beat: f32, base: vec4f) -> vec4f {
  let mk = scene(vec2f(3.0, 3.0) / RES); let m = mk.r; let txt = mk.g;
  let zen = pal(1); let hor = pal(2); let warm = pal(3); let cl = pal(4); let sh = pal(5);
  let sun = vec2f(0.5, mix(0.02, -0.08, m));
  let pk = smoothstep(0.6, 1.0, m);
  var sky = mix(zen * mix(0.75, 1.15, m), mix(hor, warm, pk * 0.85), pow(clamp(uv.y, 0.0, 1.0), 1.4));
  sky += warm * pk * 0.35 * exp(-3.0 * length((uv - sun) * vec2f(1.0, 1.6)));
  let clr = smoothstep(0.26, 0.5, uv.y) * smoothstep(0.48, 0.3, abs(uv.x - 0.5)) + smoothstep(0.66, 0.86, uv.y) * 0.35;
  let open = clr + pk * 0.25 * smoothstep(0.55, 0.0, length((uv - sun) * vec2f(1.0, 1.5)));
  let sd = normalize(sun - uv) * vec2f(0.07, 0.05);
  var col = sky; var cov = 0.0;
  for (var j = 0; j < 3; j++) {
    let fi = f32(j);
    let L = layer(uv, t, 1.4 + fi * 0.9, 0.5 + fi * 0.45, mix(0.5, 0.42, m) + open * 0.42 - fi * 0.03, sd, fi * 13.0);
    let lit = mix(sh, mix(cl, warm * 1.1, pk * 0.55), L.y) * mix(0.72, 1.04, fi / 2.0) * mix(1.0, 0.82, uv.y);
    let rim = warm * pk * 0.5 * L.x * (1.0 - L.x) * 4.0 * smoothstep(0.9, 0.1, length(uv - sun));
    col = mix(col, lit + rim, L.x * mix(0.8, 0.97, fi / 2.0));
    cov = max(cov, L.x);
  }
  let rel = uv - sun; let ang = atan2(rel.x, rel.y);
  let ray = smoothstep(0.35, 0.95, pn(vec2f(ang * 15.28, 2.0 + 0.6 * sin(6.2832 * t / 16.0)), 96.0));
  col += warm * pk * 0.11 * ray * (1.0 - cov) * smoothstep(1.2, 0.2, length(rel)) * smoothstep(0.05, 0.3, length(rel));
  let rg = 0.9 + 0.05 * pn(vec2f(uv.x * 6.0, 3.0), 6.0) + 0.02 * pn(vec2f(uv.x * 23.0, 5.0), 23.0);
  col = mix(col, mix(mix(zen, sh, 0.5) * 0.62, sky * 0.7, smoothstep(0.98, rg, uv.y) * 0.5), smoothstep(rg, rg + 0.003, uv.y) * 0.95);
  col *= 1.0 - txt * 0.28 * smoothstep(0.45, 0.0, abs(uv.y - 0.5)) * smoothstep(0.75, 0.2, abs(uv.x - 0.5));
  return vec4f(clamp(col, vec3f(0.03), vec3f(0.94)), 1.0);
}` },
});
