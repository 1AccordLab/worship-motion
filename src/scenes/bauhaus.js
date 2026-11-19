/* 包浩斯幾何：墨藍底，圓、半圓、三角、方形、粗線條；換位置一律用跳的 */
const BH = { bg: '#1c2433', red: '#d4472f', yel: '#e2b33d', blu: '#3657a8', crm: '#ebdfc7', dim: '#243049', ink: '#121826' };
const PI = Math.PI;
const sq = (cx, cy, s, deg, col, a = 1) => band(cx, cy, s, s, deg, col, a);
const ringFull = (cx, cy, r, th, col, a = 1) => arc(cx, cy, r, th, 0, 7, col, a);
const disc = (cx, cy, r, col, a = 1) => arc(cx, cy, r / 2, r, 0, 7, col, a);
const sector = (cx, cy, r, start, sweep, col, a = 1) => arc(cx, cy, r / 2, r, start, sweep, col, a);
const stateAt = (x, t, step) => Math.floor(mod(x.jt(t), LOOP) / step);

// 邊緣的幾何形：每個元素有四個姿勢，依狀態跳換；中間（x 420–1500、y 260–820）留給歌詞
const EDGE = [
  [s => sector(0, 300, 240 * s, -PI / 2, PI, BH.yel), s => sector(1920, 780, 240 * s, PI / 2, PI, BH.yel),
   s => sector(300, 0, 240 * s, 0, PI, BH.yel), s => sector(1620, 1080, 240 * s, PI, PI, BH.yel)],
  [s => sector(1920, 1080, 300, PI, PI / 2, BH.blu), s => sector(0, 0, 300, 0, PI / 2, BH.blu),
   s => sector(1920, 0, 300, PI / 2, PI / 2, BH.blu), s => sector(0, 1080, 300, 1.5 * PI, PI / 2, BH.blu)],
  [() => tri(1700, 200, 90, 0, BH.red), () => tri(230, 860, 90, PI, BH.red), () => tri(1790, 640, 90, PI / 2, BH.red), () => tri(150, 190, 90, -PI / 6, BH.red)],
  [() => rect(1800, 300, 1836, 1080, BH.blu), () => rect(0, 1000, 520, 1036, BH.blu), () => rect(84, 0, 120, 700, BH.blu), () => rect(1400, 40, 1920, 76, BH.blu)],
  [() => ringFull(1650, 420, 70, 12, BH.crm), () => ringFull(260, 640, 70, 12, BH.crm), () => ringFull(1500, 930, 70, 12, BH.crm), () => ringFull(430, 140, 70, 12, BH.crm)],
  [() => disc(1580, 140, 30, BH.red), () => disc(120, 960, 30, BH.red), () => disc(1840, 980, 30, BH.red), () => disc(560, 950, 30, BH.red)],
  [() => band(270, 940, 320, 12, -35, BH.crm), () => band(1690, 170, 320, 12, 35, BH.crm), () => band(1650, 960, 320, 12, -35, BH.crm), () => band(250, 110, 320, 12, 35, BH.crm)],
  [() => sq(1480, 990, 72, 45, BH.yel), () => sq(330, 330, 72, 45, BH.yel), () => sq(1830, 360, 72, 45, BH.yel), () => sq(560, 1010, 72, 45, BH.yel)],
];
const EDGE_PRE = [
  [() => tri(330, 980, 70, PI / 3, BH.blu), () => tri(1600, 300, 70, 0, BH.blu), () => tri(1300, 1000, 70, PI, BH.blu), () => tri(180, 420, 70, PI / 2, BH.blu)],
  [() => disc(1880, 160, 46, BH.yel), () => disc(40, 640, 46, BH.yel), () => disc(1460, 1040, 46, BH.yel), () => disc(700, 60, 46, BH.yel)],
  [() => [rect(1560, 700, 1720, 712, BH.crm), rect(1560, 730, 1720, 742, BH.crm), rect(1560, 760, 1720, 772, BH.crm)],
   () => [rect(170, 250, 330, 262, BH.crm), rect(170, 280, 330, 292, BH.crm), rect(170, 310, 330, 322, BH.crm)],
   () => [rect(1100, 900, 1260, 912, BH.crm), rect(1100, 930, 1260, 942, BH.crm), rect(1100, 960, 1260, 972, BH.crm)],
   () => [rect(1200, 120, 1360, 132, BH.crm), rect(1200, 150, 1360, 162, BH.crm), rect(1200, 180, 1360, 192, BH.crm)]],
  [() => sector(1920, 540, 150, PI / 2, PI, BH.red), () => sector(0, 820, 150, -PI / 2, PI, BH.red), () => sector(860, 1080, 150, PI, PI, BH.red), () => sector(1060, 0, 150, 0, PI, BH.red)],
];
const ORD = [0, 1, 2, 3, 1, 3, 0, 2, 3, 0, 2, 1, 2, 0, 3, 1];
function edgeShapes(f, list, k, s = 1, skip = null) {
  list.forEach((poses, e) => {
    const idx = ORD[(k + e * 3) % ORD.length] % poses.length;
    if (!(skip && skip(e, idx))) f.add(poses[idx](s));
  });
}
function beatDots(f, t, px, py, n, gap = 34) { const k = Math.floor(t / BEAT) % n; for (let i = 0; i < n; i++) f.add(disc(px + i * gap, py, 9, i === k ? BH.red : BH.dim)); }

// 平靜：每 2 秒跳一次構圖
function calm(f, x) {
  const tt = mod(x.t, LOOP);
  edgeShapes(f, EDGE, stateAt(x, tt, BAR), 1 + .04 * pulse(tt, 3, BAR));
  f.add(arc(1700, 760, 120, 6, TAU * tt / LOOP, PI * 1.5, BH.crm, .5));
  beatDots(f, tt, 820, 1020, 8);
}
// 累積：每 1 秒跳一次，元素更多
function buildLayer(f, x, t, { skip = null } = {}) {
  const k = stateAt(x, t, BAR / 2);
  edgeShapes(f, EDGE, k, 1 + .05 * pulse(t, 4), skip);
  edgeShapes(f, EDGE_PRE, k + 5, 1, skip ? (e, i) => skip(e + 100, i) : null);
  const a = TAU * 2 * mod(t, LOOP) / LOOP;
  f.add(disc(1700, 160, 110, BH.blu), sector(1700, 160, 110, a, PI, BH.red), ringFull(1700, 160, 128, 4, BH.crm, .6));
  beatDots(f, t, 760, 1020, 16, 26);
}
const FLASHY_SKIP = (e, i) => (e === 6 && (i === 2 || i === 0)) || e === 102 && i === 2;
const build = (f, x, o) => o && o.sub === 'line' ? buildLayer(f, x, x.t, { skip: FLASHY_SKIP }) : buildLayer(f, x, mod(x.t, LOOP));
// 高潮：太陽、斷開的圓環、放射粗條
function peak(f, x) {
  const SX = 960, SY = 1130, tt = mod(x.t, LOOP), beat = pulse(tt, 5), k = stateAt(x, tt, BAR);
  const NR = 18, rot = (TAU / NR) * tt / LOOP, cols = [BH.red, BH.blu, BH.crm];
  for (let i = 0; i < NR; i++) {
    const ang = i * TAU / NR + rot, deg = ang * 180 / PI, up = mod(deg, 360);
    if (up > 250 && up < 290) continue;
    f.add(band(SX + Math.cos(ang) * 885, SY + Math.sin(ang) * 885, 830, i % 2 ? 22 : 40, deg, cols[i % 3], .9));
  }
  edgeShapes(f, EDGE, k + 2, 1, e => e === 0 || e === 1);
  const gapA = -PI / 3;
  f.add(arc(SX, SY, 410, 18, gapA + .28, TAU - .56, BH.crm));
  const out = 1 + Math.floor(mod(tt, BAR) / BEAT);
  for (let j = 0; j < 2; j++) {
    const rr = 410 + out * 34 + j * 40, aa = gapA + (j ? .1 : -.08);
    f.add(band(SX + Math.cos(aa) * rr, SY + Math.sin(aa) * rr, 46, 18, aa * 180 / PI + 90, BH.crm, 1 - out * .18));
  }
  f.add(disc(SX, SY, 330 * (1 + .025 * beat), BH.yel), ringFull(SX, SY, 360, 4, BH.yel, .6));
  beatDots(f, tt, 120, 70, 8);
}
// 華麗字幕：形狀撞進來，每個字落在一個形狀上，每小節重組
function flashy(f, x) {
  const t = x.t, { chars, kw } = x, n = chars.length, sl = Math.min(200, 1500 / n), x0 = 960 - sl * (n - 1) / 2;
  const DY = [-34, 26, -12, 36, -28, 14, -20, 30], KINDS = ['c', 's', 't'], COLS = [BH.red, BH.blu, BH.yel];
  x.under(f, build);
  const bar = Math.floor(Math.max(0, t - .8) / BAR);
  chars.forEach((ch, i) => {
    const ti = .1 + i * .07, si = seg(t, ti, ti + .32); if (si <= 0) return;
    const isK = i === kw, kind = isK ? 'c' : KINDS[(i + bar) % 3], col = isK ? BH.red : COLS[(i * 2 + bar + 1) % 3];
    const p = E.back(si), px = lerp(960 + (i % 2 ? 1 : -1) * 1300, x0 + i * sl, E.out5(si)), py = 540 + DY[i % 8] * (bar % 2 ? -1 : 1);
    const kick = t > .9 ? .06 * pulse(t, 6, BEAT, (i % 4) * BEAT / 4) : 0, S = (isK ? 1.35 : 1) * 86 * lerp(.6, 1, p) * (1 + kick);
    if (kind === 'c') f.add(disc(px, py, S, col));
    else if (kind === 's') f.add(sq(px, py, S * 1.6, (bar * 15 + i * 10) % 90, col));
    else f.add(tri(px, py + 14, S * 1.75, (bar % 2 ? PI : 0), col));
    f.text(ch, px, py + (kind === 't' ? (bar % 2 ? -10 : 22) : 0), { px: 112, weight: 900, scale: (isK ? 1.25 : 1) * lerp(.4, 1, p) * (1 + kick), col: col === BH.yel ? BH.ink : BH.crm });
  });
  const sub = x.small[0];
  if (sub) {
    const SM = { px: 50, weight: 600, spacing: 2 }, a = E.io(seg(t, .3 + n * .07, .7 + n * .07));
    f.add(rect(960 - 60 * a, 662, 960 + 60 * a, 668, BH.yel, a));
    f.text(sub, 960, 718 + (1 - a) * 10, { ...SM, scale: f.fit(sub, 1300, SM), col: BH.crm, a: .75 * a });
  }
  const w = seg(t, 0, .45);
  if (w < 1) f.top(disc(lerp(-700, 2600, E.io(w)), 540, 760, BH.yel), tri(lerp(2600, -700, E.io(seg(t, .05, .5))), 520, 620, PI, BH.red));
}
// 收斂字幕：深色橫條從第一格就在
function gentle(f, x) {
  if (x.small.length) return gentle2(f, x);
  const t = x.t, lines = x.big.slice(0, 3), n = lines.length, gap = 132, y0 = 470 - gap * (n - 1) / 2;
  x.under(f, peak);
  const top = y0 - 92, bot = y0 + (n - 1) * gap + 104, TX = { px: 86, weight: 700, spacing: 10, blur: 12 };
  f.add(rect(0, top, W, bot, BH.bg, .94), rect(0, top - 6, W, top, BH.yel), rect(0, bot, W, bot + 6, BH.yel));
  lines.forEach((l, i) => {
    const s = seg(t, i * .1, .5 + i * .1), a = E.io(s), y = y0 + i * gap + (1 - E.out(s)) * 14;
    f.text(l, 960, y + 5, { ...TX, shadow: true, col: BH.ink, a: .6 * a });
    f.text(l, 960, y, { ...TX, col: BH.crm, a });
  });
  const r = E.out(seg(t, .2, .8)), uy = y0 + (n - 1) * gap + 72;
  if (r > 0) f.add(disc(960 - 120 * r, uy, 14, BH.red), rect(960 - 100 * r, uy - 3, 960 + 100 * r, uy + 3, BH.red), tri(960 + 120 * r, uy, 14, PI / 2, BH.blu));
}

// 收斂字幕（雙語）：橫條加高，每行大字下面一行小字
function gentle2(f, x) {
  const t = x.t, big = x.big.slice(0, 3), small = x.small.slice(0, 3), n = Math.max(big.length, small.length), gap = 156, y0 = 480 - gap * (n - 1) / 2;
  x.under(f, peak);
  const top = y0 - 92, bot = y0 + (n - 1) * gap + 132, TX = { px: 86, weight: 700, spacing: 10, blur: 12 }, SM = { px: 40, weight: 500, spacing: 3 };
  f.add(rect(0, top, W, bot, BH.bg, .94), rect(0, top - 6, W, top, BH.yel), rect(0, bot, W, bot + 6, BH.yel));
  for (let i = 0; i < n; i++) {
    const s = seg(t, i * .1, .5 + i * .1), a = E.io(s), y = y0 + i * gap + (1 - E.out(s)) * 14;
    if (big[i]) { const sc = f.fit(big[i], 1680, TX);
      f.text(big[i], 960, y + 5, { ...TX, scale: sc, shadow: true, col: BH.ink, a: .6 * a });
      f.text(big[i], 960, y, { ...TX, scale: sc, col: BH.crm, a }); }
    if (small[i]) f.text(small[i], 960, y + 62, { ...SM, scale: f.fit(small[i], 1600, SM), col: BH.crm, a: .62 * a });
  }
  const r = E.out(seg(t, .2, .8)), uy = y0 + (n - 1) * gap + 104;
  if (r > 0) f.add(disc(960 - 120 * r, uy, 14, BH.red), rect(960 - 100 * r, uy - 3, 960 + 100 * r, uy + 3, BH.red), tri(960 + 120 * r, uy, 14, PI / 2, BH.blu));
}

defineScene({
  id: 'bauhaus', name: '包浩斯幾何',
  description: '圓、三角、原色，活潑像兒童繪本。',
  palette: BH, labels: { bg: '底色', red: '紅', yel: '黃', blu: '藍', crm: '米白' },
  look: { paper: .09 },
  backgrounds: {
    calm: { label: '平靜', jumpBeats: 4, draw: calm },
    build: { label: '累積', jumpBeats: 2, draw: build },
    peak: { label: '高潮', jumpBeats: 4, draw: peak },
  },
  subtitles: {
    flashy: { label: '華麗', split: 'line', seconds: 6, draw: flashy },
    gentle: { label: '收斂', split: 'block', seconds: 16, draw: gentle },
  },
});
