/* 包浩斯幾何：墨藍底，圓、半圓、三角、方形、粗線條；換位置一律用跳的；背景與字幕由一個個幾何形疊起來 */
const BH = { bg: '#1c2433', red: '#d4472f', yel: '#e2b33d', blu: '#3657a8', crm: '#ebdfc7', dim: '#243049', ink: '#121826' };
const PI = Math.PI;
const sq = (cx, cy, s, deg, col, a = 1) => band(cx, cy, s, s, deg, col, a);
const ringFull = (cx, cy, r, th, col, a = 1) => arc(cx, cy, r, th, 0, 7, col, a);
const disc = (cx, cy, r, col, a = 1) => arc(cx, cy, r / 2, r, 0, 7, col, a);
const sector = (cx, cy, r, start, sweep, col, a = 1) => arc(cx, cy, r / 2, r, start, sweep, col, a);
const stateAt = (x, t, step) => Math.floor(mod(x.jt(t), LOOP) / step);

// 邊緣的幾何形：每個形狀有四個姿勢，依狀態跳換；中間（x 420–1500、y 260–820）留給歌詞
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
const loopT = (x, e) => e.args.thin && e.sub === 'line' ? x.t : mod(x.t, LOOP);
// 邊緣的一個幾何形：i＝EDGE 裡第幾個、every＝幾秒跳一次姿勢、lead＝姿勢往後錯開幾格、kick＝跟拍脹大
function edgeShape(f, x, e) {
  const t = loopT(x, e), { i, every, lead = 0, kick } = e.args, k = stateAt(x, t, every) + lead, poses = EDGE[i];
  const idx = ORD[(k + i * 3) % ORD.length] % poses.length;
  if (e.args.thin && e.sub === 'line' && i === 6 && (idx === 2 || idx === 0)) return;
  f.add(poses[idx](kick ? 1 + kick[0] * pulse(t, kick[1], kick[2]) : 1));
}
// 累積才出現的幾何形：i＝EDGE_PRE 裡第幾個，每 1 秒跳一次姿勢
function extraShape(f, x, e) {
  const t = loopT(x, e), i = e.args.i, poses = EDGE_PRE[i], idx = ORD[(stateAt(x, t, BAR / 2) + 5 + i * 3) % ORD.length] % poses.length;
  if (e.sub === 'line' && i === 2 && idx === 2) return;
  f.add(poses[idx](1));
}
// 轉動的弧線：右下一段米白細弧，16 秒轉一圈
function orbit(f, x) {
  const tt = mod(x.t, LOOP);
  f.add(arc(1700, 760, 120, 6, TAU * tt / LOOP, PI * 1.5, BH.crm, .5));
}
// 節拍點：一排小圓點，每拍亮下一顆
function beats(f, x, e) {
  const t = loopT(x, e), { at, n, gap = 34 } = e.args, k = Math.floor(t / BEAT) % n;
  for (let i = 0; i < n; i++) f.add(disc(at[0] + i * gap, at[1], 9, i === k ? BH.red : BH.dim));
}
// 轉盤：右上的藍色圓盤，紅色半圓在上面轉，外面一圈米白細環
function dial(f, x, e) {
  const a = TAU * 2 * mod(loopT(x, e), LOOP) / LOOP;
  f.add(disc(1700, 160, 110, BH.blu), sector(1700, 160, 110, a, PI, BH.red), ringFull(1700, 160, 128, 4, BH.crm, .6));
}
const SUN = [960, 1130];
// 放射粗條：從底部太陽放射的紅、藍、米白粗條，慢慢轉
function rays(f, x) {
  const tt = mod(x.t, LOOP), NR = 18, rot = (TAU / NR) * tt / LOOP, cols = [BH.red, BH.blu, BH.crm];
  for (let i = 0; i < NR; i++) {
    const ang = i * TAU / NR + rot, deg = ang * 180 / PI, up = mod(deg, 360);
    if (up > 250 && up < 290) continue;
    f.add(band(SUN[0] + Math.cos(ang) * 885, SUN[1] + Math.sin(ang) * 885, 830, i % 2 ? 22 : 40, deg, cols[i % 3], .9));
  }
}
// 斷開的圓環：繞著太陽的米白圓環留一個缺口，缺口外兩小段每拍往外跳一格
function brokenRing(f, x) {
  const tt = mod(x.t, LOOP), gapA = -PI / 3, out = 1 + Math.floor(mod(tt, BAR) / BEAT);
  f.add(arc(SUN[0], SUN[1], 410, 18, gapA + .28, TAU - .56, BH.crm));
  for (let j = 0; j < 2; j++) {
    const rr = 410 + out * 34 + j * 40, aa = gapA + (j ? .1 : -.08);
    f.add(band(SUN[0] + Math.cos(aa) * rr, SUN[1] + Math.sin(aa) * rr, 46, 18, aa * 180 / PI + 90, BH.crm, 1 - out * .18));
  }
}
// 太陽：底部的黃色大圓跟拍脹大，外面一圈細環
function sun(f, x) {
  const beat = pulse(mod(x.t, LOOP), 5);
  f.add(disc(SUN[0], SUN[1], 330 * (1 + .025 * beat), BH.yel), ringFull(SUN[0], SUN[1], 360, 4, BH.yel, .6));
}

// 華麗字幕的排法：每個字落在一個形狀上（圓、方、三角輪流），從兩側撞進來，每小節重組一次
function shapeCells(x) {
  const t = x.t, { chars, kw } = x, n = chars.length, sl = Math.min(200, 1500 / n), x0 = 960 - sl * (n - 1) / 2;
  const DY = [-34, 26, -12, 36, -28, 14, -20, 30], KINDS = ['c', 's', 't'], COLS = [BH.red, BH.blu, BH.yel], cells = [];
  const bar = Math.floor(Math.max(0, t - .8) / BAR);
  chars.forEach((ch, i) => {
    const ti = .1 + i * .07, si = seg(t, ti, ti + .32); if (si <= 0) return;
    const isK = i === kw, kind = isK ? 'c' : KINDS[(i + bar) % 3], col = isK ? BH.red : COLS[(i * 2 + bar + 1) % 3];
    const p = E.back(si), px = lerp(960 + (i % 2 ? 1 : -1) * 1300, x0 + i * sl, E.out5(si)), py = 540 + DY[i % 8] * (bar % 2 ? -1 : 1);
    const kick = t > .9 ? .06 * pulse(t, 6, BEAT, (i % 4) * BEAT / 4) : 0;
    cells.push({ ch, i, isK, kind, col, p, px, py, kick, bar, S: (isK ? 1.35 : 1) * 86 * lerp(.6, 1, p) * (1 + kick) });
  });
  return cells;
}
// 字底下的形狀：每個字一個圓、方塊或三角形
function charShapes(f, x) {
  for (const c of shapeCells(x)) {
    if (c.kind === 'c') f.add(disc(c.px, c.py, c.S, c.col));
    else if (c.kind === 's') f.add(sq(c.px, c.py, c.S * 1.6, (c.bar * 15 + c.i * 10) % 90, c.col));
    else f.add(tri(c.px, c.py + 14, c.S * 1.75, (c.bar % 2 ? PI : 0), c.col));
  }
}
// 歌詞（華麗）：形狀上的字，黃色形狀上用深色字
function chars(f, x) {
  for (const c of shapeCells(x)) f.text(c.ch, c.px, c.py + (c.kind === 't' ? (c.bar % 2 ? -10 : 22) : 0), { px: 112, weight: 900, scale: (c.isK ? 1.25 : 1) * lerp(.4, 1, c.p) * (1 + c.kick), col: c.col === BH.yel ? BH.ink : BH.crm });
}
// 第二語言：一小條黃色橫線，下面一行小字
function subline(f, x) {
  const sub = x.small[0]; if (!sub) return;
  const n = x.chars.length, SM = { px: 50, weight: 600, spacing: 2 }, a = E.io(seg(x.t, .3 + n * .07, .7 + n * .07));
  f.add(rect(960 - 60 * a, 662, 960 + 60 * a, 668, BH.yel, a));
  f.text(sub, 960, 718 + (1 - a) * 10, { ...SM, scale: f.fit(sub, 1300, SM), col: BH.crm, a: .75 * a });
}
// 開場掃屏：黃色大圓由左往右、紅色大三角由右往左交錯掃過
function wipe(f, x) {
  const w = seg(x.t, 0, .45);
  if (w < 1) f.top(disc(lerp(-700, 2600, E.io(w)), 540, 760, BH.yel), tri(lerp(2600, -700, E.io(seg(x.t, .05, .5))), 520, 620, PI, BH.red));
}
// 收斂字幕的排法：最多三行置中；有第二語言時每行下面多一行小字，底條跟著加高
function blockLayout(x) {
  const two = x.small.length > 0, big = x.big.slice(0, 3), small = two ? x.small.slice(0, 3) : [], n = two ? Math.max(big.length, small.length) : big.length;
  const gap = two ? 156 : 132, y0 = (two ? 480 : 470) - gap * (n - 1) / 2;
  return { two, big, small, n, gap, y0, top: y0 - 92, bot: y0 + (n - 1) * gap + (two ? 132 : 104), under: y0 + (n - 1) * gap + (two ? 104 : 72) };
}
// 深色底條：托住歌詞的深色橫條，上下各一條黃線
function plate(f, x) {
  const { top, bot } = blockLayout(x);
  f.add(rect(0, top, W, bot, BH.bg, .94), rect(0, top - 6, W, top, BH.yel), rect(0, bot, W, bot + 6, BH.yel));
}
// 歌詞（收斂）：逐行淡入的字，後面一層深色字影；第二語言是每行下面的小字
function lyrics(f, x) {
  const t = x.t, L = blockLayout(x), TX = { px: 86, weight: 700, spacing: 10, blur: 12 }, SM = { px: 40, weight: 500, spacing: 3 };
  for (let i = 0; i < L.n; i++) {
    const s = seg(t, i * .1, .5 + i * .1), a = E.io(s), y = L.y0 + i * L.gap + (1 - E.out(s)) * 14, l = L.big[i];
    if (l && !L.two) { f.text(l, 960, y + 5, { ...TX, shadow: true, col: BH.ink, a: .6 * a }); f.text(l, 960, y, { ...TX, col: BH.crm, a }); }
    if (l && L.two) { const sc = f.fit(l, 1680, TX);
      f.text(l, 960, y + 5, { ...TX, scale: sc, shadow: true, col: BH.ink, a: .6 * a });
      f.text(l, 960, y, { ...TX, scale: sc, col: BH.crm, a }); }
    if (L.small[i]) f.text(L.small[i], 960, y + 62, { ...SM, scale: f.fit(L.small[i], 1600, SM), col: BH.crm, a: .62 * a });
  }
}
// 小裝飾：歌詞下面的紅圓點、紅短線、藍三角，從中間往兩邊展開
function ornament(f, x) {
  const r = E.out(seg(x.t, .2, .8)), uy = blockLayout(x).under;
  if (r > 0) f.add(disc(960 - 120 * r, uy, 14, BH.red), rect(960 - 100 * r, uy - 3, 960 + 100 * r, uy + 3, BH.red), tri(960 + 120 * r, uy, 14, PI / 2, BH.blu));
}

const EDGE_IDS = ['half', 'quarter', 'tri', 'bar', 'ring', 'dot', 'slash', 'square'], EXTRA_IDS = ['tri2', 'disc', 'lines', 'half2'];
const edgeUse = (every, o, skip = []) => EDGE_IDS.map((el, i) => ({ el, i, every, ...o })).filter(u => !skip.includes(u.el));
defineScene({
  id: 'bauhaus', name: '包浩斯幾何',
  description: '圓、三角、原色，活潑像兒童繪本。',
  palette: BH, labels: { bg: '底色', red: '紅', yel: '黃', blu: '藍', crm: '米白' },
  look: { paper: .09 },
  elements: {
    half: { label: '黃半圓', colors: ['yel'], draw: edgeShape },
    quarter: { label: '藍扇形', colors: ['blu'], draw: edgeShape },
    tri: { label: '紅三角', colors: ['red'], draw: edgeShape },
    bar: { label: '藍長條', colors: ['blu'], draw: edgeShape },
    ring: { label: '米白圓環', colors: ['crm'], draw: edgeShape },
    dot: { label: '紅圓點', colors: ['red'], draw: edgeShape },
    slash: { label: '米白斜線', colors: ['crm'], draw: edgeShape },
    square: { label: '黃方塊', colors: ['yel'], draw: edgeShape },
    tri2: { label: '藍三角', colors: ['blu'], draw: extraShape },
    disc: { label: '黃圓', colors: ['yel'], draw: extraShape },
    lines: { label: '三橫線', colors: ['crm'], draw: extraShape },
    half2: { label: '紅半圓', colors: ['red'], draw: extraShape },
    orbit: { label: '轉動的弧線', colors: ['crm'], draw: orbit },
    dial: { label: '轉盤', colors: ['blu', 'red', 'crm'], draw: dial },
    beats: { label: '節拍點', colors: ['red'], draw: beats },
    rays: { label: '放射粗條', colors: ['red', 'blu', 'crm'], draw: rays },
    brokenRing: { label: '斷開的圓環', colors: ['crm'], draw: brokenRing },
    sun: { label: '太陽', colors: ['yel'], draw: sun },
    charShapes: { label: '字底下的形狀', colors: ['red', 'blu', 'yel'], draw: charShapes },
    chars: { label: '歌詞', colors: ['crm'], draw: chars },
    subline: { label: '第二語言', colors: ['yel', 'crm'], draw: subline },
    wipe: { label: '開場掃屏', fixed: true, colors: ['yel', 'red'], draw: wipe },
    plate: { label: '深色底條', colors: ['bg', 'yel'], draw: plate },
    lyrics: { label: '歌詞', colors: ['crm'], draw: lyrics },
    ornament: { label: '小裝飾', colors: ['red', 'blu'], draw: ornament },
  },
  backgrounds: {
    calm: { label: '平靜', jumpBeats: 4, use: [...edgeUse(BAR, { kick: [.04, 3, BAR] }), 'orbit', { el: 'beats', at: [820, 1020], n: 8 }] },
    build: { label: '累積', jumpBeats: 2, use: [...edgeUse(BAR / 2, { kick: [.05, 4], thin: true }), ...EXTRA_IDS.map((el, i) => ({ el, i, thin: true })), { el: 'dial', thin: true }, { el: 'beats', at: [760, 1020], n: 16, gap: 26, thin: true }] },
    peak: { label: '高潮', jumpBeats: 4, use: ['rays', ...edgeUse(BAR, { lead: 2 }, ['half', 'quarter']), 'brokenRing', 'sun', { el: 'beats', at: [120, 70], n: 8 }] },
  },
  subtitles: {
    flashy: { label: '華麗', split: 'line', seconds: 6, use: [{ el: 'under', bg: 'build' }, 'charShapes', 'chars', 'subline', 'wipe'] },
    gentle: { label: '收斂', split: 'block', seconds: 16, use: [{ el: 'under', bg: 'peak' }, 'plate', 'lyrics', 'ornament'] },
  },
});
