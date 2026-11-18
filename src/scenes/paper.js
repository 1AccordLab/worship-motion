/* 剪紙拼貼：暖棕底、番茄紅、芥黃、奶油、粉；手撕邊、紙影、紙纖維。會換位置的東西用跳的 */
const PC = { bg: '#3b2a22', red: '#d9472c', yel: '#e2a63b', crm: '#efe1c4', pnk: '#e9a08a', brn: '#5a3d2e', deep: '#2f211b', strip: '#47322a' };
// 紙：rough 手撕邊、shadow 紙影、fiber 纖維（引擎內建的形狀屬性）
const paper = (s, seed = 0, { rough = 7, shadow = 1, fiber = .1 } = {}) => Object.assign(s, { rough, seed: seed * 3.17 + 1, shadow, fiber });
const strip = (cx, cy, w, h, deg, col, a = 1) => band(cx, cy, w, h, deg, col, a);
const slot = (x, t, period) => Math.floor(mod(x.jt(t), LOOP) / period);

/* 邊緣的小紙片：圓點貼紙、小紙條、小方塊，跳到新位置後只輕輕呼吸 */
const EDGE = [[60, 380, 60, 1040], [1540, 1860, 60, 1040], [380, 1540, 50, 220]];
function confetti(f, x, t, count, period, seed, { scale = 1 } = {}) {
  const k = slot(x, t, period), cols = [PC.red, PC.yel, PC.crm, PC.pnk, PC.brn];
  for (let i = 0; i < count; i++) {
    const h = j => hash(k * 31.7 + i * 13.3 + seed * 7.1 + j * 3.9), zone = EDGE[i % 3];
    const px = lerp(zone[0], zone[1], h(1)), py = lerp(zone[2], zone[3], h(2)) + 4 * Math.sin(TAU * t / 4 + i);
    const col = cols[Math.floor(h(3) * cols.length)], kind = Math.floor(h(4) * 3);
    const sz = (18 + h(5) * 34) * scale * (1 + .06 * pulse(t, 6, BEAT * 2, i * .25));
    const s = kind === 0 ? circle(px, py, sz, col) : kind === 1 ? strip(px, py, sz * 5, sz * .55, h(6) * 180, col) : band(px, py, sz * 1.6, sz * 1.6, h(6) * 90, col);
    f.add(paper(s, i + k * 10 + seed, { rough: 5 }));
  }
}
/* 日出紙層：從下方一圈圈往上，慢慢呼吸 */
function sunrise(f, t, cx, cy, radii, cols, { kick = 0 } = {}) {
  radii.forEach((r, i) => {
    const rr = r + 10 * Math.sin(TAU * t / LOOP + i * .9) + kick * pulse(t, 5, BEAT * 2) * (radii.length - i);
    f.add(paper(circle(cx, cy, rr, cols[i % cols.length]), 50 + i, { rough: 10 }));
  });
}
function cornerSheets(f, t) {
  const d = 6 * Math.sin(TAU * t / LOOP);
  f.add(paper(band(120 + d, 60, 700, 260, -8, PC.brn), 90, { rough: 12 }));
  f.add(paper(band(1830 - d, 1000, 620, 240, -14, PC.deep), 91, { rough: 12, shadow: .6 }));
}

/* ---------- 平靜：紙層日出、邊緣紙片每 2 秒跳一次 ---------- */
function calm(f, x) {
  const t = x.t, k = slot(x, t, 2);
  cornerSheets(f, t);
  f.add(paper(strip(300, 170, 520, 30, -10 + hash(k * 2.1) * 20, PC.yel), 70 + k, { rough: 5 }));
  f.add(paper(strip(1640, 880, 460, 26, 10 + hash(k * 5.3) * 20, PC.pnk), 80 + k, { rough: 5 }));
  sunrise(f, t, 960, 1370, [630, 540, 455, 375], [PC.brn, PC.red, PC.yel, PC.crm]);
  confetti(f, x, t, 12, 2, 1);
}
/* ---------- 累積：更高的日出、更多紙片、每 1 秒跳一次 ---------- */
function buildLayers(f, x, t, { conf = 14 } = {}) {
  cornerSheets(f, t);
  const dots = 24, rot = TAU / dots * (t / LOOP);
  for (let i = 0; i < dots; i++) {
    const a = Math.PI + (i / dots) * TAU + rot;
    if (Math.sin(a) > .05) continue;
    f.add(paper(circle(960 + 800 * Math.cos(a), 1280 + 800 * Math.sin(a), 13, i % 2 ? PC.crm : PC.yel), 200 + i, { rough: 3, shadow: .6 }));
  }
  sunrise(f, t, 960, 1280, [720, 630, 545, 465, 390], [PC.brn, PC.pnk, PC.red, PC.yel, PC.crm], { kick: 5 });
  confetti(f, x, t, conf, 1, 2);
}
const build = (f, x, o) => buildLayers(f, x, x.t, o && o.sub === 'line' ? { conf: 10 } : undefined);   // 華麗字幕底下：紙屑少一點
/* ---------- 高潮：放射紙條光芒、太陽、中間一條深色紙條 ---------- */
function peak(f, x) {
  const t = x.t, RAYS = 40, RW = TAU / RAYS, cols = [PC.red, PC.yel, PC.crm, PC.pnk], rot = RW * 4 * (t / LOOP);
  for (let i = 0; i < RAYS; i++) {
    const a0 = i * RW + rot, mid = mod(a0 + RW * .3, TAU);
    if (mid < Math.PI * .95 || mid > Math.PI * 2.05) continue;
    const kick = 1 + .02 * pulse(t, 5, BEAT * 2, (i % 4) * BEAT * .5);
    f.add(paper(wedge(960, 1150, 1500 * kick, a0, RW * .62, cols[i % 4], .92), 300 + i, { rough: 9, shadow: .7 }));
  }
  const b = pulse(t, 5, BEAT * 2);
  f.add(paper(circle(960, 1150, 330 + 10 * b, PC.yel), 400, { rough: 10 }));
  f.add(paper(circle(960, 1150, 255 + 6 * b, PC.crm), 401, { rough: 10 }));
  confetti(f, x, t, 10, 1, 3, { scale: .9 });
  f.add(paper(band(960, 540, 1500, 330, -1.2, PC.strip), 500, { rough: 12, shadow: 1, fiber: .08 }));
}
/* ---------- 華麗字幕：紙片掃屏 → 每個字像貼紙啪地貼上 → 跟拍輕跳 ---------- */
function flashy(f, x) {
  const t = x.t, { chars, kw } = x, n = chars.length;
  const size = n > 7 ? 150 : 176, gap = 26, x0 = 960 - (n * size + (n - 1) * gap) / 2 + size / 2, cy = 470;
  const tagCols = [PC.crm, PC.pnk, PC.yel, PC.crm, PC.pnk, PC.crm, PC.yel];
  x.under(f, build);
  chars.forEach((ch, i) => {
    const ti = .38 + i * .12, si = seg(t, ti, ti + .24); if (si <= 0) return;
    const isK = i === kw, rot0 = (hash(i * 9.1 + n) - .5) * 16 * Math.PI / 180;
    const bounce = t > ti + .5 ? pulse(t, 7, BEAT, i * BEAT / n) : 0;
    const sc = lerp(1.7, 1, E.back(si)) * (1 + .07 * bounce) * (isK ? 1.22 : 1);
    const rot = rot0 + (1 - E.out(si)) * .35 * (i % 2 ? 1 : -1);
    const px = x0 + i * (size + gap), py = cy + (isK ? -14 : 0) - 10 * bounce;
    const tag = isK ? PC.red : tagCols[i % tagCols.length], ink = tag === PC.red ? PC.crm : tag === PC.crm ? PC.red : PC.bg;
    f.add(paper(band(px, py, size * sc, size * 1.1 * sc, rot * 180 / Math.PI, tag), 600 + i, { rough: 6, shadow: 1.2 }));
    f.text(ch, px, py + 6 * sc, { px: 128, weight: 900, scale: sc * (size / 176), rot, col: ink });
  });
  const sub = x.small[0];
  if (sub) {                                               // 第二語言小字：貼紙下方一條深色紙條托住
    const SM = { px: 58, weight: 600, spacing: 2 }, a = E.io(seg(t, .5 + n * .12, .9 + n * .12)), sc = f.fit(sub, 1400, SM), tw = f.measure(sub, SM).tw * sc;
    const sy = cy + size * .62 + 92;
    f.add(paper(band(960, sy, (tw + 90) * (.6 + .4 * a), 86, -1, PC.deep, a), 650, { rough: 6, shadow: .8 }));
    f.text(sub, 960, sy + 2, { ...SM, scale: sc, col: PC.crm, a: .8 * a });
  }
  const w = seg(t, 0, .42), w2 = seg(t, .06, .5);
  if (w < 1) f.top(paper(band(lerp(W + 700, -800, E.io(w)), 540, 1300, 1500, -6, PC.red), 700, { rough: 16, shadow: 1 }));
  if (w2 < 1) f.top(paper(band(lerp(W + 400, -500, E.io(w2)), 540, 110, 1500, -6, PC.yel), 701, { rough: 10, shadow: 1 }));
}
/* ---------- 收斂字幕：深色紙條一直在，切下一句只有字在換 ---------- */
function gentle(f, x) {
  if (x.small.length) return gentle2(f, x);
  const t = x.t, lines = x.big.slice(0, 3), n = lines.length, gap = n > 2 ? 104 : 124, y0 = 532 - gap * (n - 1) / 2;
  x.under(f, peak);
  const TX = { px: 84, weight: 700, spacing: 10, blur: 10 };
  lines.forEach((l, i) => {
    const s = seg(t, i * .1, .5 + i * .1), a = E.io(s), y = y0 + i * gap + (1 - E.out(s)) * 14;
    f.text(l, 960, y + 4, { ...TX, shadow: true, col: PC.deep, a: .55 * a });
    f.text(l, 960, y, { ...TX, col: PC.crm, a });
  });
  const r = E.out(seg(t, .2, .8)), uy = y0 + (n - 1) * gap + 70;
  if (r > .01) f.add(paper(band(960, uy, 240 * r, 12, -1.5, PC.yel), 800, { rough: 4, shadow: .6 }));
}

/* ---------- 收斂字幕（雙語）：紙條加高，每行大字下面一行小字 ---------- */
function gentle2(f, x) {
  const t = x.t, big = x.big.slice(0, 3), small = x.small.slice(0, 3), n = Math.max(big.length, small.length), gap = n > 2 ? 146 : 156, y0 = 512 - gap * (n - 1) / 2;
  x.under(f, peak);
  const top = y0 - 80, bot = y0 + (n - 1) * gap + 128;
  if (bot - top > 320) f.add(paper(band(960, (top + bot) / 2, 1540, bot - top + 24, -1.2, PC.strip), 501, { rough: 12, shadow: 1, fiber: .08 }));
  const TX = { px: 84, weight: 700, spacing: 10, blur: 10 }, SM = { px: 38, weight: 500, spacing: 3 };
  for (let i = 0; i < n; i++) {
    const s = seg(t, i * .1, .5 + i * .1), a = E.io(s), y = y0 + i * gap + (1 - E.out(s)) * 14;
    if (big[i]) { const sc = f.fit(big[i], 1400, TX);
      f.text(big[i], 960, y + 4, { ...TX, scale: sc, shadow: true, col: PC.deep, a: .55 * a });
      f.text(big[i], 960, y, { ...TX, scale: sc, col: PC.crm, a }); }
    if (small[i]) f.text(small[i], 960, y + 60, { ...SM, scale: f.fit(small[i], 1380, SM), col: PC.crm, a: .6 * a });
  }
  const r = E.out(seg(t, .2, .8)), uy = y0 + (n - 1) * gap + 104;
  if (r > .01) f.add(paper(band(960, uy, 240 * r, 12, -1.5, PC.yel), 800, { rough: 4, shadow: .6 }));
}

defineScene({
  id: 'paper', name: '剪紙拼貼',
  palette: PC, labels: { bg: '底色', red: '紅', yel: '黃', crm: '米白', pnk: '粉' },
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
