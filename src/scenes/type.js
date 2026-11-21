/* 大字排版：深酒紅底、亮橘、奶油；色條色塊骨架＋同色系出血大字當背景紋理（不放字規則的例外）；背景由一個個元素疊起來 */
const TY = { bg: '#3a1520', tone: '#4b1c29', tone2: '#5a2433', org: '#ff7a33', crm: '#f2e3cf', ink: '#1f0a10', panel: '#2c0f17' };
const slot = (x, t, L, step) => Math.floor(mod(x.jt(t), L) / step);
const disc = (cx, cy, R, col, a = 1) => arc(cx, cy, R / 2, R, 0, 7, col, a);

// 背景紋理大字：同色系、出血裁切，放在色塊底下（z = -1）
const GIANT = ['光', '火', '愛'];
function giant(f, list, col = TY.tone, a = 1) { for (const [ch, gx, gy, sc] of list) f.text(ch, gx, gy, { px: 640, weight: 900, scale: sc, col, a, z: -1 }); }
// 大字用滑的換位置（色塊仍然用跳的）
function giantSlide(f, x, t, L, step, ease, chars, scales, states) {
  const n = states.length, k = slot(x, t, L, step), p = E.io(clamp01((mod(x.jt(t), L) - k * step) / ease));
  const c = states[k % n], pr = states[(k - 1 + n) % n];
  giant(f, chars.map((ch, i) => [ch, lerp(pr[i][0], c[i][0], p), lerp(pr[i][1], c[i][1], p), scales[i]]));
}
const VERSE_GS = [[[1500, 620], [-900, 380], [1000, -1200]], [[2800, 620], [360, 380], [1000, -1200]],
                  [[2800, 300], [-900, 380], [1000, -80]], [[1560, 820], [-900, 700], [1000, -1200]],
                  [[2800, 820], [300, 760], [1000, -1200]], [[1480, 300], [-900, 760], [1000, -1200]],
                  [[2800, 300], [420, 300], [1000, -1200]], [[2800, 300], [-900, 300], [1000, -80]]];
const PRE_GS = [[[1650, 880], [1000, 250], [-900, 640]], [[2800, 880], [1100, 280], [300, 640]],
                [[1600, 600], [1100, -1200], [260, 820]], [[1700, 300], [1100, -1200], [-900, 820]],
                [[2800, 300], [900, 300], [340, 500]], [[1650, 800], [1000, 240], [-900, 500]],
                [[2800, 800], [1000, -1200], [300, 700]], [[1600, 500], [950, 260], [260, 640]]];
const SUB_GS = [[[380, 640]], [[300, 760]], [[420, 600]], [[260, 820]]];
// 段落剪影：一排長短不一的色條，像把一段文字塗掉
function para(f, px, py, n, lineH, gap, seed, k, minW, maxW, col, a = 1, right = false) {
  for (let i = 0; i < n; i++) {
    let w = minW + hash(k * 7.3 + i * 1.7 + seed) * (maxW - minW); if (i === n - 1) w *= .45;
    const yy = py + i * (lineH + gap);
    f.add(right ? rect(px - w, yy, px, yy + lineH, col, a) : rect(px, yy, px + w, yy + lineH, col, a));
  }
}
// 刪節號：一排方點，每拍亮下一顆
function ellipsis(f, t, px, py, n, size, gap, col) {
  const k = Math.floor(t / BEAT) % n, p = pulse(t, 4);
  for (let i = 0; i < n; i++) { const xx = px + i * (size + gap), on = i === k; f.add(rect(xx, py, xx + size, py + size, on ? col : TY.tone2, on ? .6 + .4 * p : 1)); }
}

const slotTime = {
  calm: x => { const tt = mod(x.t, 16); return { t: tt, k: slot(x, tt, 16, 2), b: pulse(tt, 4) }; },
  build: (x, e) => { const line = e.sub === 'line', t = line ? x.t : mod(x.t, 16); return { t, k: slot(x, t, 16, 1), b: pulse(t, 5), bar: pulse(t, 3, BAR), line }; },
  peak: (x, e) => { const tt = mod(x.t, 16); return { t: tt, k: slot(x, tt, 16, 2), b: pulse(tt, 5), bar: pulse(tt, 3, BAR), line: e.sub === 'line' }; },
};
const variants = table => (f, x, e) => table[e.args.v](f, x, e, slotTime[e.args.v](x, e));
const CALM_PANEL = [[-40, 0, 420, 1080], [-40, 620, 560, 1080], [-40, 0, 300, 1080], [-40, 0, 520, 380],
                    [-40, 0, 360, 1080], [-40, 700, 500, 1080], [-40, 0, 440, 260], [-40, 0, 260, 1080]];
const BUILD_PANEL = [[-40, 0, 380, 1080], [-40, 640, 700, 1080], [1440, 0, 1960, 420], [-40, 0, 560, 300],
                     [1500, 700, 1960, 1080], [-40, 0, 260, 1080], [1320, 0, 1960, 240], [-40, 760, 520, 1080]];
const CALM_DISC = [[1700, 190, 230], [210, 880, 170], [1740, 900, 260], [190, 180, 130], [1700, 880, 150], [1760, 200, 300], [230, 900, 210], [1680, 860, 190]];
const BUILD_DISC = [[1720, 180], [180, 900], [1720, 920], [200, 200], [1640, 560], [260, 560], [1760, 360], [180, 720]];
const FLASHY_DISC = [[230, 640], [1780, 200], [200, 780], [1700, 360]];
const PEAK_DISC = [[1660, 230, 260], [1760, 520, 140], [1540, 160, 180], [1720, 300, 320], [1600, 210, 220], [1780, 420, 160], [1560, 260, 280], [1700, 190, 200]];
const buildDisc = c => c.line ? FLASHY_DISC : BUILD_DISC;

// 背景大字：同色系、出血裁切的大字紋理；平靜與累積滑著換位置，高潮橫向捲動
const giantEl = variants({
  calm: (f, x, e, c) => giantSlide(f, x, c.t, 16, 2, 1.7, GIANT, [1.7, 1.6, 1.75].map(v => v * e.p.size), VERSE_GS),
  build: (f, x, e, c) => c.line ? giantSlide(f, x, c.t, 16, 1, .7, ['光'], [1.8 * e.p.size], SUB_GS) : giantSlide(f, x, c.t, 16, 1, .7, GIANT, [1.6, 1.9, 1.7].map(v => v * e.p.size), PRE_GS),
  peak: (f, x, e, c) => { const GAP = 980, gt = c.t / 16 * GAP * 3, goff = mod(gt, GAP), gsh = Math.floor(gt / GAP);
    for (let i = -1; i < 3; i++) giant(f, [[GIANT[mod(i + gsh, 3)], 480 + i * GAP - goff, 560, 1.75 * e.p.size]]); },
});
// 整面閃色：整個畫面蓋一層大字色，每小節亮一下
const washEl = variants({
  build: (f, x, e, c) => f.add(rect(0, 0, W, H, TY.tone, .35 * c.bar)),
  peak: (f, x, e, c) => f.add(rect(0, 0, W, H, TY.tone, .3 * c.bar)),
});
// 側邊色塊：貼著畫面邊緣的暗色塊，跟著換位跳位置
const panelEl = variants({
  calm: (f, x, e, c) => f.add(rect(...CALM_PANEL[c.k], TY.tone2, .55)),
  build: (f, x, e, c) => f.add(rect(...BUILD_PANEL[c.k % 8], TY.tone), rect(...BUILD_PANEL[(c.k + 3) % 8], TY.tone2, .8)),
});
// 段落剪影：一排長短不一的色條，像把一段文字塗掉；平靜多一個閃爍的游標，高潮整排往上捲
const paraEl = variants({
  calm: (f, x, e, c) => {
    para(f, 1180, 150, 5, 22, 20, 1, c.k, 300, 620, TY.tone2);
    const lastW = (300 + hash(c.k * 7.3 + 4 * 1.7 + 1) * 320) * .45;
    if (mod(c.t, 1) < .5) f.add(rect(1180 + lastW + 14, 150 + 4 * 42 - 8, 1180 + lastW + 30, 150 + 4 * 42 + 30, TY.org));
  },
  build: (f, x, e, c) => { if (c.line) return; para(f, 140, 140, 6, 20, 18, 3, c.k, 260, 560, TY.tone2); para(f, 1800, 760, 6, 20, 18, 9, c.k, 260, 560, TY.tone2, 1, true); },
  peak: (f, x, e, c) => {
    const P = 48, travel = c.t * (P * 40 / 16), off = mod(travel, P), shift = Math.floor(travel / P);
    for (let r = 0; r < 25; r++) {
      const id = mod(r + shift, 40), y = r * P - off;
      let w = 200 + hash(id * 3.7) * 300; if (hash(id * 9.1) < .18) w *= .4;
      f.add(rect(120, y, 120 + w, y + 24, TY.tone2));
    }
  },
});
// 直條：一條跟拍子變粗的重點色直條
function ibeamEl(f, x, e) {
  const c = slotTime.build(x, e); if (c.line) return;
  const w = 36 + 10 * c.b; f.add(rect(1500 - w / 2, 0, 1500 + w / 2, H, TY.org));
}
// 大圓點：重點色的實心圓，跟著換位跳位置、跟拍子輕跳
const discEl = variants({
  calm: (f, x, e, c) => { const [dx, dy, dr] = CALM_DISC[c.k]; f.add(disc(dx, dy, dr * (1 + .05 * c.b), TY.org)); },
  build: (f, x, e, c) => { const D = buildDisc(c), [dx, dy] = D[c.k % D.length]; f.add(disc(dx, dy, 150 * (1 + .08 * c.b), TY.org)); },
  peak: (f, x, e, c) => { const [dx, dy, dr] = PEAK_DISC[c.k]; f.add(disc(dx, dy, dr * (1 + .08 * c.b), TY.org)); },
});
// 小圓點：字色的小實心圓
const dotEl = variants({
  build: (f, x, e, c) => { const D = buildDisc(c), [ex, ey] = D[(c.k + 5) % D.length]; f.add(disc(ex, ey, 46, TY.crm)); },
  peak: (f, x, e, c) => f.add(disc(980, 960, 70 * (1 + .1 * pulse(c.t, 5, BEAT, BEAT / 2)), TY.crm)),
});
// 橫線：字色的細橫線；平靜是一長一短，高潮是右上三條
const rulesEl = variants({
  calm: (f, x, e, c) => { const len = 420 + 120 * Math.sin(TAU * c.t / 4); f.add(rect(140, 950, 140 + len, 964, TY.crm, .9), rect(140, 108, 1780, 110, TY.crm, .25)); },
  peak: (f, x, e, c) => { for (let i = 0; i < 3; i++) { const w = 280 + hash(c.k * 5.1 + i * 2.3) * 520, y = 96 + i * 46; f.add(rect(1820 - w, y, 1820, y + (i === 0 ? 22 : 10), TY.crm, i === 0 ? .9 : .5)); } },
});
// 刪節號：一排方點，每拍亮下一顆（at＝位置、顆數、大小、間距、亮的顏色）
function ellipsisEl(f, x, e) {
  const [px, py, n, size, gap, col] = e.args.at;
  ellipsis(f, slotTime[e.args.v](x, e).t, px, py, n, size, gap, TY[col]);
}
// 進度條：底部一條細線，每小節從頭長一次
const progressEl = variants({
  build: (f, x, e, c) => f.add(rect(380, 1004, 380 + 520 * mod(c.t, BAR) / BAR, 1016, TY.crm, .9)),
  peak: (f, x, e, c) => f.add(rect(120, 1004, 120 + 260 * mod(c.t, BAR) / BAR, 1016, TY.org)),
});
// 角落色塊：左上角的重點色塊跟拍子變高，下面一條字色短線
function cornerEl(f, x, e) {
  const c = slotTime.peak(x, e), LW = [380, 330, 400, 350, 370, 320, 400, 360], LH = [210, 170, 240, 190, 220, 160, 250, 200], lh = LH[c.k] + 22 * c.b;
  f.add(rect(-40, -40, LW[c.k], lh, TY.org), rect(60, lh + 22, 60 + 140 + 160 * hash(c.k * 2.7), lh + 34, TY.crm));
}
// 圓環：左邊的字色圓環，跟著換位跳位置、在反拍輕跳
function ringEl(f, x, e) {
  const c = slotTime.peak(x, e), LD = [[220, 560, 110], [250, 740, 80], [200, 450, 140], [240, 860, 95], [210, 640, 125], [260, 500, 75], [200, 780, 130], [235, 600, 100]], [lx, ly, lr] = LD[c.k];
  f.add(arc(lx, ly, lr * (1 + .08 * pulse(c.t, 5, BEAT, BEAT / 2)), 16, 0, 7, TY.crm, .9));
}
// 大色塊：右下角的重點色大塊跟拍子起伏，上面一條字色短線；字幕底下會讓出放大字的位置
function blockEl(f, x, e) {
  const c = slotTime.peak(x, e), by = (c.line ? 930 : 760) - 26 * c.b;
  f.add(rect(1080, by, W, H, TY.org), rect(1080, by - 40, 1080 + 300 + 200 * hash(c.k * 1.3), by - 28, TY.crm));
}
// 華麗字幕：整句逐字快閃 → 關鍵字放大塞滿、殘影外框 → 其他字彈出
function flashy(f, x) {
  const t = x.t, { chars, kw } = x, n = chars.length, kwCh = chars[kw], before = chars.slice(0, kw), after = chars.slice(kw + 1);
  const KX = 1080, KY = 560, BIG = { px: 700, weight: 900 };
  x.under(f, 'build');
  const FL = .08, flashEnd = n * FL;
  if (t < flashEnd) {
    const i = Math.min(n - 1, Math.floor(t / FL)), odd = i % 2;
    f.add(rect(0, 0, W, H, odd ? TY.org : TY.bg));
    f.text(chars[i], 960, 540, { px: 520, weight: 900, col: odd ? TY.bg : TY.org, scale: 1.4 * (1 + .15 * (1 - mod(t, FL) / FL)) });
    return;
  }
  const tt = t - flashEnd, s = seg(tt, 0, .35), sc = lerp(1.7, 1, E.out5(s)), b = tt > .6 ? pulse(t, 4) : 0;
  if (tt > .3) {
    const side = Math.floor(t / BEAT) % 2 ? 1 : -1;
    f.text(kwCh, KX - 36 - 20 * b * side, KY - 28 - 10 * b, { ...BIG, stroke: 5, col: TY.org, a: .75 });
    f.text(kwCh, KX - 72 + 14 * b * side, KY - 56 - 6 * b, { ...BIG, stroke: 5, col: TY.org, a: .4 });
  }
  f.text(kwCh, KX, KY, { ...BIG, scale: sc * (1 + .02 * b), col: TY.org });
  const pop = (ch, px, py, i) => {
    const si = seg(tt, .12 + i * .05, .34 + i * .05); if (si <= 0) return;
    const kick = tt > 1 ? .08 * pulse(t, 7, BEAT, i * BEAT / n) : 0;
    f.text(ch, px, py + (1 - E.out(si)) * 40, { px: 128, weight: 900, scale: lerp(.2, 1, E.back(si)) * (1 + kick), col: TY.crm });
  };
  before.forEach((ch, i) => pop(ch, 150 + i * 142, 250, i));
  after.forEach((ch, i) => pop(ch, 1800 - (after.length - 1 - i) * 142, 910, before.length + i));
  const u = E.out5(seg(tt, .2, .6));
  if (u > 0) f.add(rect(80, 336, 80 + 760 * u, 350, TY.crm));
  const sub = x.small[0];
  if (sub) {
    const SM = { px: 56, weight: 600, spacing: 2 }, a = E.io(seg(tt, .35, .75));
    f.text(sub, 86, 404 + (1 - a) * 10, { ...SM, scale: f.fit(sub, 560, SM), align: 'left', col: TY.crm, a: .7 * a });
  }
}
// 收斂字幕：深色底從第一格就在，切下一句只有字在換
function gentle(f, x) {
  if (x.small.length) return gentle2(f, x);
  const t = x.t, lines = x.big.slice(0, 3), n = lines.length, gap = 136, y0 = 515 - gap * (n - 1) / 2;
  const top = y0 - 100, bot = y0 + (n - 1) * gap + 112, TX = { px: 90, weight: 900, spacing: 16, blur: 12 };
  x.under(f, 'peak');
  f.add(rect(0, top, W, bot, TY.panel, .95), rect(0, top - 10, W, top, TY.org), rect(0, bot, W, bot + 4, TY.crm, .6));
  lines.forEach((l, i) => {
    const s = seg(t, i * .1, .5 + i * .1), a = E.io(s), y = y0 + i * gap + (1 - E.out(s)) * 14;
    f.text(l, 960, y + 5, { ...TX, shadow: true, col: TY.ink, a: .6 * a });
    f.text(l, 960, y, { ...TX, col: TY.crm, a });
  });
  const r = E.out(seg(t, .2, .8)), uw = 140 * r * (1 + .06 * pulse(t, 3)), uy = y0 + (n - 1) * gap + 76;
  if (uw > 1) f.add(rect(960 - uw / 2, uy - 4, 960 + uw / 2, uy + 4, TY.org));
}

// 收斂字幕（雙語）：深色底加高，每行大字下面一行小字
function gentle2(f, x) {
  const t = x.t, big = x.big.slice(0, 3), small = x.small.slice(0, 3), n = Math.max(big.length, small.length), gap = 160, y0 = 505 - gap * (n - 1) / 2;
  const top = y0 - 96, bot = y0 + (n - 1) * gap + 136, TX = { px: 90, weight: 900, spacing: 16, blur: 12 }, SM = { px: 42, weight: 600, spacing: 4 };
  x.under(f, 'peak');
  f.add(rect(0, top, W, bot, TY.panel, .95), rect(0, top - 10, W, top, TY.org), rect(0, bot, W, bot + 4, TY.crm, .6));
  for (let i = 0; i < n; i++) {
    const s = seg(t, i * .1, .5 + i * .1), a = E.io(s), y = y0 + i * gap + (1 - E.out(s)) * 14;
    if (big[i]) { const sc = f.fit(big[i], 1680, TX);
      f.text(big[i], 960, y + 5, { ...TX, scale: sc, shadow: true, col: TY.ink, a: .6 * a });
      f.text(big[i], 960, y, { ...TX, scale: sc, col: TY.crm, a }); }
    if (small[i]) f.text(small[i], 960, y + 66, { ...SM, scale: f.fit(small[i], 1600, SM), col: TY.crm, a: .6 * a });
  }
  const r = E.out(seg(t, .2, .8)), uw = 140 * r * (1 + .06 * pulse(t, 3)), uy = y0 + (n - 1) * gap + 110;
  if (uw > 1) f.add(rect(960 - uw / 2, uy - 4, 960 + uw / 2, uy + 4, TY.org));
}

const inBackground = (v, list) => list.map(u => typeof u === 'string' ? { el: u, v } : { ...u, v });
defineScene({
  id: 'type', name: '大字排版',
  description: '大字當背景紋理，像口號海報。',
  palette: TY, labels: { bg: '底色', tone: '大字色', org: '重點色', crm: '字色' },
  elements: {
    giant: { label: '背景大字', colors: ['tone'], params: { size: { value: 1, min: .5, max: 1.5, label: '大小' } }, draw: giantEl },
    wash: { label: '整面閃色', colors: ['tone'], draw: washEl },
    panel: { label: '側邊色塊', draw: panelEl },
    para: { label: '段落剪影', draw: paraEl },
    ibeam: { label: '直條', colors: ['org'], draw: ibeamEl },
    disc: { label: '大圓點', colors: ['org'], draw: discEl },
    dot: { label: '小圓點', colors: ['crm'], draw: dotEl },
    rules: { label: '橫線', colors: ['crm'], draw: rulesEl },
    ellipsis: { label: '刪節號', draw: ellipsisEl },
    progress: { label: '進度條', colors: ['crm', 'org'], draw: progressEl },
    corner: { label: '角落色塊', colors: ['org', 'crm'], draw: cornerEl },
    ring: { label: '圓環', colors: ['crm'], draw: ringEl },
    block: { label: '大色塊', colors: ['org', 'crm'], draw: blockEl },
  },
  backgrounds: {
    calm: { label: '平靜', jumpBeats: 4, use: inBackground('calm', ['giant', 'panel', 'para', 'disc', 'rules', { el: 'ellipsis', at: [1700, 1000, 4, 14, 12, 'crm'] }]) },
    build: { label: '累積', jumpBeats: 2, use: inBackground('build', ['giant', 'wash', 'panel', 'para', 'ibeam', 'disc', 'dot', { el: 'ellipsis', at: [140, 1000, 8, 16, 10, 'org'] }, 'progress']) },
    peak: { label: '高潮', jumpBeats: 4, use: inBackground('peak', ['giant', 'wash', 'para', 'corner', 'ring', 'progress', 'disc', 'rules', 'block', 'dot', { el: 'ellipsis', at: [1180, 1000, 8, 16, 10, 'bg'] }]) },
  },
  subtitles: {
    flashy: { label: '華麗', split: 'line', seconds: 6, draw: flashy },
    gentle: { label: '收斂', split: 'block', seconds: 16, draw: gentle },
  },
});
