/* 光柱：深藍到墨綠底，教堂高窗落下平塗半透明光柱，暖金重點；光柱組合每「色塊換位」淡入淡出切換 */
const NV = { bg: '#16253a', green: '#15302a', win: '#25394f', light: '#e3d6b8', gold: '#d3a253', ink: '#0f1b24' };
const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const mixc = (a, b, k) => { const x = rgb(a), y = rgb(b); return [lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k)]; };
const WIN = [130, 330, 1590, 1790];
const TILT = 79;

// 底：藍到墨綠，分 8 階平塗
function ground(f) {
  f.bg = NV.bg;
  for (let i = 1; i < 8; i++) f.add(rect(0, i * 135, W, i * 135 + 136, mixc(NV.bg, NV.green, i / 7)));
}
// 高窗：拱形窗＋中間一根窗櫺；rose＝中間一個圓窗
function windows(f, rose) {
  for (const x of WIN) { f.add(rect(x - 42, 90, x + 42, 216, NV.win), circle(x, 90, 42, NV.win), rect(x - 3, 52, x + 3, 216, NV.bg, .9), rect(x - 42, 150, x + 42, 155, NV.bg, .9)); }
  if (rose) { f.add(circle(960, 120, 64, NV.win, rose)); f.add(arc(960, 120, 34, 5, 0, TAU, NV.bg, .8 * rose)); }
}
// 一道光柱：從窗下緣斜斜落到畫面外；兩層平塗疊出「中間濃、邊緣淡」
function beam(f, x0, wid, col, a) {
  if (a <= .004) return;
  const L = 1500, r = TILT * Math.PI / 180, cx = x0 + Math.cos(r) * L / 2, cy = 216 + Math.sin(r) * L / 2;
  f.add(band(cx, cy, L, wid * 1.7, TILT, col, a * .5, { rough: 2, seed: x0 }), band(cx, cy, L, wid, TILT, col, a, { rough: 2, seed: x0 + 1 }));
}
// 光柱組合：每 every 秒換一組，前一組淡出、下一組淡入（交疊 35%）
function beams(f, x, t, sets, every, col, a) {
  const j = x.jt(t) / every, k = Math.floor(j), fr = j - k, mix = E.io(seg(fr, .65, 1));
  for (const [s, w] of [[sets[mod(k, sets.length)], 1 - mix], [sets[mod(k + 1, sets.length)], mix]])
    for (const [wi, wid, c] of s) beam(f, typeof wi === 'number' && wi < 10 ? WIN[wi] : wi, wid, c === 'g' ? NV.gold : col, a * w);
}

/* ---------- 平靜：一兩道細光 ---------- */
function calm(f, x) {
  const t = mod(x.t, LOOP);
  ground(f); windows(f, 0);
  beams(f, x, t, [[[0, 40]], [[3, 34], [1, 22]], [[1, 44]], [[2, 30], [0, 22]]], 4, NV.light, .12);
}
/* ---------- 累積：光變多、變寬 ---------- */
function build(f, x) {
  const t = mod(x.t, LOOP);
  ground(f); windows(f, .7);
  beams(f, x, t, [[[0, 60], [1, 34], [3, 40]], [[1, 70], [2, 46], [0, 26]], [[0, 50], [2, 60], [3, 30]], [[1, 56], [3, 64], [2, 24]]], 2, NV.light, .13);
}
/* ---------- 高潮：最多、最寬，暖金重點（中間圓窗也落下一道很淡的寬光） ---------- */
function peak(f, x) {
  const t = mod(x.t, LOOP);
  ground(f); windows(f, 1);
  beam(f, 960 - 40, 150, NV.gold, .07);
  beams(f, x, t, [[[0, 96], [1, 60, 'g'], [2, 70], [3, 50, 'g']], [[0, 70, 'g'], [1, 100], [2, 56, 'g'], [3, 84]], [[0, 84], [1, 70], [2, 96, 'g'], [3, 60]], [[0, 60, 'g'], [1, 90], [2, 80], [3, 96, 'g']]], 2, NV.light, .15);
}

/* ---------- 字幕共用 ---------- */
const hasMark = x => /\[.+?\]/.test(x.swap ? x.text2 : x.text);
function rowText(f, x, chars, kw, cy, t0, o) {
  const n = chars.length, gapX = 6, ws = chars.map((c, i) => f.measure(c, i === kw ? o.kwStyle : o.style).tw);
  const total = ws.reduce((a, b) => a + b, 0) + gapX * Math.max(0, n - 1), sc = Math.min(1, 1500 / Math.max(1, total));
  let cx = 960 - total * sc / 2, kx = 960;
  chars.forEach((c, i) => {
    const w = ws[i] * sc, isK = i === kw, ti = isK ? t0 + n * .08 + .35 : t0 + i * .08, a = E.io(seg(x.t, ti, ti + (isK ? 1.8 : 1.3)));
    if (isK) kx = cx + w / 2;
    if (a > .003) f.text(c, cx + w / 2, cy, { ...(isK ? o.kwStyle : o.style), scale: sc, col: isK ? o.kwCol : o.col, a });
    cx += w + gapX * sc;
  });
  return { kx, end: t0 + n * .08 + 1.3, kt: t0 + n * .08 + .35 };
}

/* ---------- 收斂字幕：平靜的光＋逐行慢慢淡入（約 1.5 秒）；雙語時每行下面一行小字 ---------- */
function gentle(f, x) {
  const t = x.t, big = x.big.slice(0, 3), small = x.small.slice(0, 3), n = Math.max(1, big.length, small.length), two = small.length > 0;
  const gap = two ? 150 : 124, y0 = 524 - gap * (n - 1) / 2;
  x.under(f, calm);
  const TX = { px: 82, weight: 600, spacing: 8 }, SM = { px: 38, weight: 500, spacing: 3 };
  for (let i = 0; i < n; i++) {
    const a = E.io(seg(t, .3 + i * .4, 1.8 + i * .4)), y = y0 + i * gap;
    if (big[i]) f.text(big[i], 960, y, { ...TX, scale: f.fit(big[i], 1500, TX), col: NV.light, a });
    if (small[i]) f.text(small[i], 960, y + 60, { ...SM, scale: f.fit(small[i], 1440, SM), col: NV.light, a: .6 * E.io(seg(t, .7 + i * .4, 2.2 + i * .4)) });
  }
  const r = E.io(seg(t, 1.2 + n * .4, 3 + n * .4)), uy = y0 + (n - 1) * gap + (two ? 116 : 80);
  if (r > .004) f.add(rect(960 - 90, uy - 2, 960 + 90, uy + 2, NV.gold, .85 * r));
}

/* ---------- 華麗字幕（克制）：逐字慢慢淡入；關鍵字加粗、暖金，一道細光柱慢慢淡入落在它上面 ---------- */
function flashy(f, x) {
  const t = x.t, sub = x.small[0] || '', cy = sub ? 500 : 540, kw = hasMark(x) ? x.kw : -1;
  x.under(f, build);
  const ST = { style: { px: 100, weight: 500 }, kwStyle: { px: 100, weight: 900 }, col: NV.light, kwCol: NV.gold };
  const row = rowText(f, { t: -99 }, x.chars, kw, cy, .3, ST);
  if (kw >= 0) { const a = .14 * E.io(seg(t, row.kt, row.kt + 2)), wd = 120;
    f.add(rect(row.kx - wd / 2, 0, row.kx + wd / 2, H, NV.gold, a * .5), rect(row.kx - wd / 4, 0, row.kx + wd / 4, H, NV.gold, a)); }
  rowText(f, x, x.chars, kw, cy, .3, ST);
  if (sub) { const SM = { px: 44, weight: 500, spacing: 3 };
    f.text(sub, 960, cy + 96, { ...SM, scale: f.fit(sub, 1440, SM), col: NV.light, a: .62 * E.io(seg(t, row.end, row.end + 1.5)) }); }
  const r = E.io(seg(t, row.end + .4, row.end + 2.2)), uy = cy + (sub ? 150 : 92);
  if (r > .004) f.add(rect(960 - 70, uy - 2, 960 + 70, uy + 2, NV.gold, .85 * r));
}

defineScene({
  id: 'nave', name: '光柱',
  palette: NV, labels: { bg: '上方深藍', green: '下方墨綠', win: '窗', light: '光', gold: '暖金' },
  look: { grain: .035, vignette: .14 },
  textures: [{ type: 'grain', on: 'bg,shapes', amount: .035 }],
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
