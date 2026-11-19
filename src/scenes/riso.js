/* 網點印刷（Risograph）：米色紙、螢光粉／藍／黃／青油墨，疊印、網點、套色錯位 */
const RS = { bg: '#d6cab0', pink: '#e2536e', blue: '#3b5ca8', yel: '#e9b23c', teal: '#2c8a86', ink: '#2f2b35', paper: '#e2d6bd' };
const ink = s => Object.assign(s, { blend: 'multiply' });
const flat = { tex: false };

// 套準記號：印刷品角落的十字圓圈
function marks(f, mx, my, s = 26) {
  f.add(arc(mx, my, s * .55, 2.5, 0, 7, RS.ink, .75, flat), rect(mx - s, my - 1.2, mx + s, my + 1.2, RS.ink, .75, flat), rect(mx - 1.2, my - s, mx + 1.2, my + s, RS.ink, .75, flat));
}
// 色票條：四色、濃度不同（半透明＝網點），每拍滿版一格
function swatches(f, t, sx, sy) {
  const cols = [RS.pink, RS.blue, RS.yel, RS.teal], k = Math.floor(t / BEAT) % 8;
  for (let i = 0; i < 8; i++) f.add(ink(rect(sx + i * 34, sy, sx + i * 34 + 26, sy + 26, cols[i % 4], i === k ? 1 : .3 + .08 * (i % 4))));
}
// 網點漸層：同一個墨色，濃度一格一格變
function ramp(f, rx, ry, w, h, n, col, vertical = false) {
  for (let i = 0; i < n; i++) {
    const a = .12 + .88 * i / (n - 1);
    f.add(ink(vertical ? rect(rx, ry + i * h / n, rx + w, ry + (i + 1) * h / n, col, a) : rect(rx + i * w / n, ry, rx + (i + 1) * w / n, ry + h, col, a)));
  }
}

// 平靜：兩個大圓疊印在角落，每 2 秒跳位置
function calm(f, x) {
  const tt = mod(x.t, 16), b = pulse(tt, 3, BAR);
  const A = x.step([[230, 900], [1700, 180], [260, 160], [1680, 880], [150, 560], [1760, 540], [420, 980], [1500, 110]], 2, tt);
  const B = x.step([[460, 980], [1500, 300], [430, 330], [1480, 1000], [330, 760], [1580, 360], [640, 1060], [1320, 240]], 2, tt);
  f.add(ink(circle(A[0], A[1], 330 * (1 + .03 * b), RS.blue, .5)));
  f.add(ink(circle(B[0], B[1], 230, RS.pink)));
  const Y = x.step([[1240, 70, 1860, 120], [60, 960, 700, 1010], [1300, 980, 1880, 1030], [80, 60, 760, 110]], 4, tt);
  f.add(ink(rect(...Y, RS.yel)));
  f.add(ink(arc(W - A[0], H - A[1], 120, 14, 0, 7, RS.teal)));
  ramp(f, 1620, 860, 220, 34, 6, RS.teal);
  marks(f, 90, 90); marks(f, 1830, 990);
  swatches(f, tt, 96, 1000);
}
// 累積：斜向網點條紋往右推、色塊每 1 秒跳
function build(f, x) {
  const tt = mod(x.t, 16), b = pulse(tt, 5);
  const off = mod(tt * 60, 120);
  for (let i = -2; i < 18; i++) {
    const cx = i * 120 + off;
    if (cx > 420 && cx < 1500) continue;
    f.add(ink(band(cx, 540, 1400, 46, 70, i % 3 ? RS.teal : RS.pink, .38)));
  }
  const A = x.step([[180, 180], [1740, 900], [1700, 170], [200, 880], [140, 540], [1780, 560], [400, 120], [1520, 980]], 1, tt);
  f.add(ink(circle(A[0], A[1], 210 * (1 + .06 * b), RS.blue)));
  const T = x.step([[1650, 300, 0], [260, 760, Math.PI], [1500, 900, .5], [320, 260, -.4]], 1, tt);
  f.add(ink(tri(T[0], T[1], 150, T[2], RS.yel)));
  ramp(f, 60, 380, 40, 320, 6, RS.pink, true); ramp(f, 1820, 380, 40, 320, 6, RS.blue, true);
  f.add(ink(rect(96, 1050, 96 + 520 * mod(tt, BAR) / BAR, 1060, RS.ink)));
  marks(f, 90, 90); marks(f, 1830, 90); marks(f, 1830, 990);
  swatches(f, tt, 1520, 1000);
}
// 高潮：底部大太陽、放射網點光芒慢慢轉、青色圓疊印
function peak(f, x) {
  const tt = mod(x.t, 16), b = pulse(tt, 5), SX = 960, SY = 1180, N = 16, rot = (TAU / N) * tt / 16;
  for (let i = 0; i < N; i++) {
    const a = Math.PI + (i + .5) * Math.PI / N + rot;
    if (Math.sin(a) > -.05) continue;
    const deg = a * 180 / Math.PI, up = mod(deg, 360); if (up > 252 && up < 288) continue;
    f.add(ink(band(SX + Math.cos(a) * 900, SY + Math.sin(a) * 900, 1100, 70, deg, i % 2 ? RS.blue : RS.pink, .42)));
  }
  f.add(ink(circle(SX, SY, 420 * (1 + .02 * b), RS.yel)));
  f.add(ink(circle(SX + 160, SY - 60, 300, RS.pink, .55)));
  f.add(ink(arc(SX, SY, 480, 10, Math.PI + .2, Math.PI - .4, RS.teal)));
  const K = x.step([[230, 200], [1690, 200], [300, 260], [1620, 240]], 2, tt);
  f.add(ink(circle(K[0], K[1], 110, RS.teal)));
  marks(f, 90, 90); marks(f, 1830, 90);
  swatches(f, tt, 96, 60);
}
// 華麗字幕：每個字像蓋印章，一格一格印上去；關鍵字粉紅大字、網點陰影
function flashy(f, x) {
  const t = x.t, { chars, kw } = x, n = chars.length, size = Math.min(190, 1500 / n), x0 = 960 - size * (n - 1) / 2;
  const cols = [RS.blue, RS.teal, RS.yel];
  x.under(f, build);
  chars.forEach((ch, i) => {
    const ti = .15 + i * .1, si = seg(t, ti, ti + .18); if (si <= 0) return;
    const isK = i === kw, bounce = t > ti + .6 ? pulse(t, 7, BEAT, i * BEAT / n) : 0;
    const sc = lerp(1.35, 1, E.out(si)) * (isK ? 1.3 : 1) * (1 + .05 * bounce), px = x0 + i * size, py = 520 - 8 * bounce;
    f.add(ink(band(px + 10, py + 12, size * .92 * sc, size * .92 * sc, (hash(i * 3.1) - .5) * 14, isK ? RS.pink : cols[i % 3], isK ? .9 : .5)));
    f.text(ch, px, py, { px: 132, weight: 900, scale: sc, col: RS.ink, blend: 'multiply' });
  });
  const sub = x.small[0];
  if (sub) {
    const SM = { px: 60, weight: 700, spacing: 2 }, a = E.io(seg(t, .3 + n * .1, .7 + n * .1));
    f.add(ink(rect(960 - 70 * a, 676, 960 + 70 * a, 684, RS.teal, a)));
    f.text(sub, 960, 736 + (1 - a) * 10, { ...SM, scale: f.fit(sub, 1300, SM), col: RS.ink, a: .72 * a, blend: 'multiply' });
  }
  const w = seg(t, 0, .4);
  if (w < 1) f.top(ink(band(lerp(W + 800, -800, E.io(w)), 540, 1100, 1500, 8, RS.pink, .6)));
}
// 收斂字幕：紙色橫條托住字，切下一句只有字在換
function gentle(f, x) {
  if (x.small.length) return gentle2(f, x);
  const t = x.t, lines = x.big.slice(0, 3), n = lines.length, gap = 130, y0 = 500 - gap * (n - 1) / 2;
  const top = y0 - 90, bot = y0 + (n - 1) * gap + 100, TX = { px: 84, weight: 900, spacing: 8 };
  x.under(f, peak);
  f.add(rect(0, top, W, bot, RS.paper, 1, flat), ink(rect(0, top - 8, W, top, RS.blue)), ink(rect(0, bot, W, bot + 8, RS.pink)));
  lines.forEach((l, i) => {
    const s = seg(t, i * .1, .5 + i * .1), a = E.io(s), y = y0 + i * gap + (1 - E.out(s)) * 12;
    f.text(l, 964, y + 5, { ...TX, col: RS.pink, a: .55 * a, blend: 'multiply' });
    f.text(l, 960, y, { ...TX, col: RS.ink, a, blend: 'multiply' });
  });
}

// 收斂字幕（雙語）：紙色橫條加高，每行大字下面一行小字
function gentle2(f, x) {
  const t = x.t, big = x.big.slice(0, 3), small = x.small.slice(0, 3), n = Math.max(big.length, small.length), gap = 154, y0 = 500 - gap * (n - 1) / 2;
  const top = y0 - 90, bot = y0 + (n - 1) * gap + 128, TX = { px: 84, weight: 900, spacing: 8 }, SM = { px: 40, weight: 700, spacing: 3 };
  x.under(f, peak);
  f.add(rect(0, top, W, bot, RS.paper, 1, flat), ink(rect(0, top - 8, W, top, RS.blue)), ink(rect(0, bot, W, bot + 8, RS.pink)));
  for (let i = 0; i < n; i++) {
    const s = seg(t, i * .1, .5 + i * .1), a = E.io(s), y = y0 + i * gap + (1 - E.out(s)) * 12;
    if (big[i]) { const sc = f.fit(big[i], 1680, TX);
      f.text(big[i], 964, y + 5, { ...TX, scale: sc, col: RS.pink, a: .55 * a, blend: 'multiply' });
      f.text(big[i], 960, y, { ...TX, scale: sc, col: RS.ink, a, blend: 'multiply' }); }
    if (small[i]) f.text(small[i], 960, y + 62, { ...SM, scale: f.fit(small[i], 1600, SM), col: RS.ink, a: .62 * a, blend: 'multiply' });
  }
}

defineScene({
  id: 'riso', name: '網點印刷',
  description: '復古印刷、顏色稍微錯位，像獨立樂團海報。',
  palette: RS, labels: { bg: '紙色', pink: '粉紅墨', blue: '藍墨', yel: '黃墨', teal: '青墨', ink: '字墨' },
  look: { grain: .03, vignette: .12, paper: .07, cap: .9 },
  textures: [
    { type: 'halftone', on: 'shapes', cell: 9, angle: 22 },
    { type: 'misreg', on: 'shapes,text', amount: 4, every: 8 },
    { type: 'rough', on: 'shapes', amount: 2.5, voids: .1 },
    { type: 'fiber', on: 'bg', amount: .16 },
  ],
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
