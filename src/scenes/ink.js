/* 墨染：暖色宣紙、墨、一個柔和暖色（赭）。墨在紙上慢慢暈開、淡去、再暈開，像呼吸。
   不滑動：只有淡入淡出與範圍變化。120 BPM 寫法，16 秒（32 拍）頭尾相接。中間 x 420–1500、y 260–820 留給歌詞。 */
const INK = { bg: '#e0d4bc', ink: '#2f2c28', wash: '#6f695e', warm: '#bd7a50', seal: '#9e4f2e', shade: '#cdbfa3' };

// 呼吸：ph 0→1 一輪；慢慢淡入、淡去。0 和 1 都是 0，頭尾接得起來
const breath = ph => { const s = Math.sin(Math.PI * mod(ph, 1)); return s * s; };
// 一團墨：主圓＋兩個小瓣（往畫面外側長），g＝暈開的範圍；seed 讓每團的毛邊不同。疊印（multiply）像墨在紙上疊
function blot(f, cx, cy, r, col, a, seed, g = 1) {
  if (a <= .004 || r * g < 2) return;
  const R = r * g, d = Math.atan2(cy - 540, cx - 960);
  f.add(circle(cx, cy, R * .82, col, a, { blend: 'multiply', seed }));
  for (let i = 0; i < 6; i++) {                                                      // 幾個大小不一的瓣，偏向畫面外側長
    const an = d + (hash(seed * 7 + i) - .5) * 3.4, off = R * (.35 + .4 * hash(seed * 3 + i)), rr = R * (.28 + .34 * hash(seed * 5 + i));
    f.add(circle(cx + off * Math.cos(an), cy + off * Math.sin(an), rr, col, a * (.45 + .4 * hash(seed + i * 11)), { blend: 'multiply', seed: seed * 10 + i }));
  }
}
// 會呼吸的墨點：laps＝16 秒呼吸幾次（整數），ph＝錯開；範圍從 g0 慢慢暈到 1
function spot(f, t, s) {
  const p = mod(t * (s.laps || 1) / LOOP + (s.ph || 0), 1);
  blot(f, s.x, s.y, s.r, s.col, s.a * breath(p), s.seed || 1, lerp(s.g0 ?? .7, 1, E.out(p)));
}
// 印章：位置每「換位間隔」換一次，但不是跳：在每一格裡淡入、停住、淡去
function seal(f, x, t, list, every, size, a = .8) {
  const j = x.jt(t) / every, k = Math.floor(j), fr = j - k, v = list[mod(k, list.length)];
  const al = a * E.io(seg(fr, 0, .35)) * (1 - E.io(seg(fr, .7, 1)));
  if (al > .004) f.add(rect(v[0] - size / 2, v[1] - size / 2, v[0] + size / 2, v[1] + size / 2, INK.seal, al, { blend: 'multiply', rough: 3, seed: k % 7 + 1 }));
}
// 飛白：一筆由幾條細線組成，整筆淡入淡出（不往前畫）
function brush(f, x0, y, len, a, seed) {
  if (a <= .004) return;
  for (let i = 0; i < 7; i++) {
    const yy = y + (i - 3) * 5, l0 = x0 + hash(seed + i) * 40, l1 = x0 + len * (.7 + .3 * hash(seed * 3 + i));
    f.line(l0, yy, l1, yy + (hash(seed + i * 7) - .5) * 6, 3 + 2 * hash(i + seed), INK.ink, a * (.35 + .5 * hash(seed + i * 3)), { blend: 'multiply', rough: 2, seed: seed + i });
  }
}
// 遠山：幾個大圓沉在畫面下緣，只露出上緣（像淡墨的山）
function hills(f, t, list, col, a, ph = 0) {
  list.forEach(([cx, top, r], i) => {
    const p = mod(t / LOOP + ph + i * .13, 1), al = a * (.55 + .45 * breath(p));
    f.add(circle(cx, top + r, r, col, al, { blend: 'multiply', seed: 11 + i }));
  });
}

/* ---------- 平靜：留白多；角落兩三團墨輪流暈開、淡去 ---------- */
const CALM = [
  { x: 150, y: 960, r: 190, col: INK.wash, a: .3, ph: 0, seed: 1 },
  { x: 250, y: 1030, r: 120, col: INK.ink, a: .5, ph: .5, seed: 2 },
  { x: 1780, y: 120, r: 150, col: INK.wash, a: .26, ph: .25, seed: 3 },
  { x: 1700, y: 70, r: 80, col: INK.ink, a: .42, ph: .75, seed: 4 },
  { x: 1620, y: 990, r: 60, col: INK.warm, a: .45, ph: .4, seed: 5 },
];
const SEALS = [[1790, 930], [130, 150], [1790, 380], [130, 720]];
function calm(f, x) {
  const t = mod(x.t, LOOP);
  f.add(circle(-40, -60, 300, INK.shade, .45, { seed: 21 }), circle(1980, 1140, 320, INK.shade, .4, { seed: 22 }));   // 紙上淡淡的水漬
  CALM.forEach(s => spot(f, t, s));
  seal(f, x, t, SEALS, 2, 44, .75);
}

/* ---------- 累積：墨量與層次增加：遠山、更多墨團、一筆飛白 ---------- */
const BUILD = [
  { x: 1840, y: 560, r: 150, col: INK.wash, a: .28, ph: .1, seed: 6 },
  { x: 90, y: 330, r: 130, col: INK.wash, a: .3, ph: .6, seed: 7 },
  { x: 60, y: 260, r: 70, col: INK.ink, a: .45, ph: .35, seed: 8 },
  { x: 1560, y: 120, r: 70, col: INK.warm, a: .4, ph: .85, seed: 9, laps: 2 },
];
function build(f, x) {
  const t = mod(x.t, LOOP);
  calm(f, x);
  hills(f, t, [[260, 900, 380], [720, 945, 420], [1240, 935, 440], [1700, 905, 380]], INK.wash, .2);
  hills(f, t, [[480, 975, 360], [1460, 980, 380]], INK.ink, .16, .5);
  BUILD.forEach(s => spot(f, t, s));
  brush(f, 1560, 230, 300, .55 * breath(t / LOOP + .3), 3);
  brush(f, 120, 860, 260, .5 * breath(t / LOOP + .8), 9);
}

/* ---------- 高潮：大面積溫暖墨色（上緣、下緣、兩側），歌詞區保持乾淨 ---------- */
function peak(f, x) {
  const t = mod(x.t, LOOP);
  [[180, -230, 430], [700, -300, 470], [1240, -290, 470], [1760, -220, 430]].forEach(([cx, cy, r], i) =>
    blot(f, cx, cy, r, INK.warm, .5 + .2 * breath(t / LOOP + i * .27), 40 + i, lerp(.88, 1, breath(t / LOOP + i * .27))));
  hills(f, t, [[150, 870, 330], [560, 930, 520], [1080, 905, 380], [1420, 940, 560], [1820, 875, 320]], INK.warm, .4);
  hills(f, t, [[330, 975, 300], [1560, 985, 330], [960, 1010, 260]], INK.ink, .2, .5);
  [{ x: -60, y: 540, r: 270, col: INK.ink, a: .42, ph: 0, seed: 12 }, { x: 1980, y: 520, r: 270, col: INK.ink, a: .42, ph: .5, seed: 13 },
   { x: 70, y: 220, r: 110, col: INK.warm, a: .5, ph: .25, seed: 14 }, { x: 1850, y: 860, r: 110, col: INK.warm, a: .5, ph: .75, seed: 15 }].forEach(s => spot(f, t, s));
  seal(f, x, t, SEALS, 2, 52, .85);
  brush(f, 1500, 210, 330, .6 * breath(t / LOOP + .2), 5);
}

/* ---------- 字幕共用：一行字（逐字慢慢淡入；關鍵字加粗、暖色、最後才出來） ---------- */
function rowText(f, x, chars, kw, cy, t0, o) {
  const n = chars.length, gapX = o.spacing ?? 6;
  const ws = chars.map((c, i) => f.measure(c, i === kw ? o.kwStyle : o.style).tw);
  const total = ws.reduce((a, b) => a + b, 0) + gapX * Math.max(0, n - 1), sc = Math.min(1, 1500 / Math.max(1, total));
  let cx = 960 - total * sc / 2; const pos = [];
  chars.forEach((c, i) => {
    const w = ws[i] * sc, isK = i === kw, ti = isK ? t0 + n * .08 + .35 : t0 + i * .08, a = E.io(seg(x.t, ti, ti + (isK ? 1.8 : 1.3)));
    pos.push([cx + w / 2, w]);
    if (a > .003) f.text(c, cx + w / 2, cy, { ...(isK ? o.kwStyle : o.style), scale: sc, col: isK ? o.kwCol : o.col, a });
    cx += w + gapX * sc;
  });
  return { pos, sc, end: t0 + n * .08 + 1.3 };
}
const hasMark = x => /\[.+?\]/.test(x.swap ? x.text2 : x.text);

/* ---------- 收斂字幕：平靜的紙＋逐行慢慢淡入（約 1.5 秒），無彈跳無放大；有第二語言時每行下面一行小字 ---------- */
function gentle(f, x) {
  const t = x.t, big = x.big.slice(0, 3), small = x.small.slice(0, 3), n = Math.max(1, big.length, small.length), two = small.length > 0;
  const gap = two ? 150 : 124, y0 = 524 - gap * (n - 1) / 2;
  x.under(f, calm);
  const TX = { px: 82, weight: 600, spacing: 8 }, SM = { px: 38, weight: 500, spacing: 3 };
  for (let i = 0; i < n; i++) {
    const a = E.io(seg(t, .3 + i * .4, 1.8 + i * .4)), y = y0 + i * gap;
    if (big[i]) f.text(big[i], 960, y, { ...TX, scale: f.fit(big[i], 1500, TX), col: INK.ink, a });
    if (small[i]) f.text(small[i], 960, y + 60, { ...SM, scale: f.fit(small[i], 1440, SM), col: INK.ink, a: .6 * E.io(seg(t, .7 + i * .4, 2.2 + i * .4)) });
  }
  const r = E.io(seg(t, 1.2 + n * .4, 3 + n * .4)), uy = y0 + (n - 1) * gap + (two ? 116 : 80);
  brushMark(f, 960, uy, 200, .7 * r);
}
function brushMark(f, cx, y, len, a) {
  if (a <= .004) return;
  f.add(band(cx, y, len, 9, -1.5, INK.warm, a, { blend: 'multiply', rough: 3, seed: 51 }), band(cx + 18, y + 7, len * .7, 4, -1, INK.warm, a * .6, { blend: 'multiply', rough: 2, seed: 52 }));
}

/* ---------- 華麗字幕（克制）：逐字慢慢淡入，關鍵字用字重與暖色加強，背後一團暖墨慢慢暈開 ---------- */
function flashy(f, x) {
  const t = x.t, sub = x.small[0] || '', cy = sub ? 500 : 540, kw = hasMark(x) ? x.kw : -1;
  x.under(f, build);
  const ST = { style: { px: 100, weight: 500 }, kwStyle: { px: 100, weight: 900 }, col: INK.ink, kwCol: INK.seal, spacing: 6 };
  const kt = .3 + x.chars.length * .08 + .35;
  if (kw >= 0 && x.chars.length) {                                   // 先算位置（不畫字），把暖墨放在字下面
    let total = 0; const ws = x.chars.map((c, i) => f.measure(c, i === kw ? ST.kwStyle : ST.style).tw);
    total = ws.reduce((a, b) => a + b, 0) + 6 * (ws.length - 1); const sc = Math.min(1, 1500 / Math.max(1, total));
    const kx = 960 - total * sc / 2 + (ws.slice(0, kw).reduce((a, b) => a + b, 0) + 6 * kw + ws[kw] / 2) * sc, g = E.out(seg(t, kt, kt + 3));
    blot(f, kx, cy + 6, 74 * sc, INK.warm, .2 * E.io(seg(t, kt, kt + 1.6)), 61, lerp(.5, 1, g));
  }
  const row = rowText(f, x, x.chars, kw, cy, .3, ST);
  if (sub) {
    const SM = { px: 44, weight: 500, spacing: 3 };
    f.text(sub, 960, cy + 96, { ...SM, scale: f.fit(sub, 1440, SM), col: INK.ink, a: .62 * E.io(seg(t, row.end, row.end + 1.5)) });
  }
  brushMark(f, 960, cy + (sub ? 150 : 92), 160, .7 * E.io(seg(t, row.end + .4, row.end + 2.2)));
}

defineScene({
  id: 'ink', name: '墨染',
  palette: INK, labels: { bg: '紙色', ink: '墨色', wash: '淡墨', warm: '暖色', seal: '印泥', shade: '紙影' },
  look: { grain: .02, vignette: .1, paper: .06 },
  textures: [
    { type: 'bleed', on: 'shapes,lines', amount: 24 },     // 墨水暈開的邊
    { type: 'fiber', on: 'bg,shapes', amount: .07 },       // 宣紙纖維
  ],
  backgrounds: {
    calm: { label: '平靜', jumpBeats: 8, draw: calm },
    build: { label: '累積', jumpBeats: 4, draw: build },
    peak: { label: '高潮', jumpBeats: 4, draw: peak },
  },
  subtitles: {
    flashy: { label: '華麗（克制）', split: 'line', seconds: 7, draw: flashy },
    gentle: { label: '收斂', split: 'block', seconds: 16, draw: gentle },
  },
});
