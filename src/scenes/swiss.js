/* 瑞士網格：12 欄 × 6 列網格、炭灰底、朱橘與米白。120 BPM 寫法，16 秒（32 拍）頭尾相接 */
const SW = { bg: '#2b2a27', org: '#e8582b', crm: '#ece2cf', dim: '#3a3934', dim2: '#45433d', ink: '#141311' };
const CW = 160, RH = 180;
const G = (x0, y0, x1, y1, col, a = 1) => rect(x0 * CW, y0 * RH, x1 * CW, y1 * RH, col, a);

// 節拍格：一排小方塊，每拍亮下一格
function sequencer(f, t, x, y, n, size = 16, gap = 8) {
  const k = Math.floor(t / BEAT) % n, p = pulse(t, 4);
  for (let i = 0; i < n; i++) {
    const xx = x + i * (size + gap), prev = i === (k + n - 1) % n;
    f.add(rect(xx, y, xx + size, y + size, i === k ? SW.org : (prev ? SW.crm : SW.dim2), i === k ? 1 : (prev ? .25 * p + .1 : 1)));
  }
}
// 網格交點閃光：每拍隨機幾個交點亮起再暗掉
function lights(f, t, L, count, seed, { avoid = null, size = 7, cols = [SW.crm, SW.org] } = {}) {
  const nb = Math.round(L / BEAT), b = mod(Math.floor(t / BEAT), nb), life = mod(t, BEAT) / BEAT;
  for (let j = 0; j < count; j++) {
    const gx = 1 + Math.floor(hash(b * 13.1 + j * 7.7 + seed) * 11), gy = 1 + Math.floor(hash(b * 3.3 + j * 19.1 + seed) * 5);
    if (avoid && gx >= avoid[0] && gx <= avoid[2] && gy >= avoid[1] && gy <= avoid[3]) continue;
    const s = size * (1 + .6 * (1 - life));
    f.add(rect(gx * CW - s, gy * RH - s, gx * CW + s, gy * RH + s, cols[j % cols.length], Math.pow(1 - life, 1.5)));
  }
}
// 同心圓弧：角落的圓心只有四分之一圈看得到，在可見範圍內來回擺
function rings(f, t, L, cx, cy, list) {
  for (const r of list) {
    const a0 = r.center - r.sweep / 2 + r.swing * Math.sin(TAU * r.laps * t / L + (r.ph || 0));
    const sw = r.sweep * (1 + (r.breath || 0) * Math.sin(TAU * t / L * (r.bl || 1)));
    f.add(arc(cx, cy, r.r, r.w * (1 + (r.kick || 0) * pulse(t, 6)), a0, sw, r.col, r.a ?? 1));
  }
}
const scan = (f, t, period, col, a, w = 2) => { const x = W * mod(t, period) / period; f.add(rect(x - w / 2, 0, x + w / 2, H, col, a)); };

/* ---------- 平靜：每 2 秒換位，中間留給歌詞 ---------- */
function calm(f, x) {
  const tt = mod(x.t, 16);
  f.grid.alpha = .09; f.grid.flash = .05 * pulse(tt, 4, BAR);
  const A = [[9, 0, 11, 2], [10, 0, 12, 3], [10, 4, 12, 6], [11, 1, 12, 5], [9, 4, 11, 6], [10, 0, 11, 4], [11, 3, 12, 6], [9, 1, 10, 3]];
  const B = [[11, 2, 12, 3], [9, 5, 10, 6], [11, 0, 12, 1], [10, 5, 11, 6], [11, 0, 12, 1], [11, 4, 12, 5], [9, 0, 10, 1], [10, 3, 11, 4]];
  const C = [[0, 4, 2, 6], [0, 3, 1, 6], [0, 5, 3, 6], [1, 4, 2, 6], [0, 4, 3, 5], [0, 2, 1, 5], [0, 5, 2, 6], [1, 3, 2, 5]];
  const D = [2, 3, 1, 2.5, 1.5, 3, 2, 1];
  f.add(G(...x.step(C, 2, tt), SW.dim));
  rings(f, tt, 16, 0, H, [
    { r: 300, w: 3, sweep: .9, laps: 2, swing: .45, ph: 0, center: 5.5, col: SW.crm, a: .7 },
    { r: 360, w: 16, sweep: .6, laps: 3, swing: .5, ph: 2, center: 5.5, col: SW.org, kick: .5 },
    { r: 430, w: 3, sweep: 1.0, laps: 4, swing: .3, ph: 4, center: 5.5, col: SW.crm, a: .45, breath: .3 },
    { r: 500, w: 2, sweep: 1.3, laps: 1, swing: .2, ph: 1, center: 5.5, col: SW.crm, a: .3 },
  ]);
  f.add(G(...x.step(A, 2, tt), SW.org), G(...x.step(B, 2, tt), SW.crm));
  f.add(rect(CW, 5 * RH - 3, CW + x.step(D, 2, tt) * CW, 5 * RH + 3, SW.crm));
  scan(f, tt, BAR, SW.crm, .14);
  lights(f, tt, 16, 4, 1, { avoid: [3, 2, 9, 4] });
  sequencer(f, tt, CW, 5.5 * RH - 8, 8);
}

/* ---------- 累積：共用元素＋每 1 秒跳一格 ---------- */
function buildLayers(f, t, { avoid = null } = {}) {
  f.grid.alpha = .1; f.grid.flash = .07 * pulse(t, 5);
  rings(f, t, 16, 0, 0, [
    { r: 260, w: 4, sweep: 1.0, laps: 4, swing: .45, ph: 0, center: .785, col: SW.crm, a: .75 },
    { r: 330, w: 20, sweep: .6, laps: 8, swing: .5, ph: 1.5, center: .785, col: SW.org, kick: .6 },
    { r: 410, w: 3, sweep: 1.1, laps: 6, swing: .35, ph: 3, center: .785, col: SW.crm, a: .5, breath: .4, bl: 2 },
    { r: 480, w: 10, sweep: .45, laps: 8, swing: .55, ph: 4.5, center: .785, col: SW.dim2 },
    { r: 560, w: 2, sweep: 1.2, laps: 4, swing: .25, ph: 2, center: .785, col: SW.crm, a: .35 },
  ]);
  lights(f, t, 16, 8, 7, { avoid });
  f.add(rect(CW, 5.5 * RH + 18, CW + 384 * mod(t, BAR) / BAR, 5.5 * RH + 22, SW.org));   // 每小節一條進度條
  sequencer(f, t, CW, 5.5 * RH - 8, 16);
}
function build(f, x) {
  const tt = mod(x.t, 16);
  const A = [[0, 0, 2, 2], [0, 0, 1, 6], [10, 0, 12, 2], [11, 0, 12, 6], [10, 4, 12, 6], [0, 4, 2, 6], [0, 0, 3, 1], [9, 5, 12, 6]];
  const B = [[11, 5, 12, 6], [2, 0, 3, 1], [0, 5, 1, 6], [9, 0, 10, 1], [2, 5, 3, 6], [11, 0, 12, 1], [4, 5, 5, 6], [0, 2, 1, 3]];
  const D = [[9, 4, 12, 6], [3, 5, 6, 6], [0, 0, 2, 3], [8, 0, 11, 1], [0, 3, 1, 6], [6, 5, 9, 6], [10, 2, 12, 4], [1, 0, 4, 1]];
  f.add(G(...x.step(D, 1, tt), SW.dim));
  buildLayers(f, tt, { avoid: [3, 2, 9, 4] });
  f.add(G(...x.step(A, 1, tt), SW.org), rect(9 * CW - 5, 0, 9 * CW + 5, H, SW.org), G(...x.step(B, 1, tt), SW.crm));
  scan(f, tt, BEAT * 2, SW.crm, .18);
}

/* ---------- 高潮：斜帶劃開，速度線、圓弧、跑馬燈 ---------- */
function peak(f, x) {
  const tt = mod(x.t, 16), beat = pulse(tt, 5), ANG = -24, rad = ANG * Math.PI / 180;
  const dir = [Math.cos(rad), Math.sin(rad)], nrm = [-Math.sin(rad), Math.cos(rad)];
  const B = (off, wid, col, a = 1, s0 = -1600, s1 = 1600) => {
    const al = (s0 + s1) / 2; return band(1010 + nrm[0] * off + dir[0] * al, 880 + nrm[1] * off + dir[1] * al, Math.max(0, s1 - s0), wid, ANG, col, a);
  };
  f.grid.alpha = .09; f.grid.flash = .06 * beat;
  const drift = 34 * Math.sin(tt / 16 * TAU);
  f.add(B(-600 + drift * .5, 240, SW.dim));
  rings(f, tt, 16, W, 0, [
    { r: 300, w: 3, sweep: 1.0, laps: 4, swing: .45, ph: 0, center: 2.356, col: SW.crm, a: .6 },
    { r: 380, w: 18, sweep: .7, laps: 8, swing: .5, ph: 2, center: 2.356, col: SW.org, kick: .6 },
    { r: 460, w: 3, sweep: 1.0, laps: 6, swing: .35, ph: 4, center: 2.356, col: SW.crm, a: .4, breath: .4 },
    { r: 540, w: 30, sweep: .5, laps: 4, swing: .5, ph: 1, center: 2.356, col: SW.dim2 },
  ]);
  const SP = 70, travel = mod(tt / 16 * SP * 16, SP);      // 速度線一直往外推
  for (let i = 0; i < 9; i++) {
    const off = 200 + i * SP + travel;
    f.add(B(off + drift, i % 3 === 0 ? 6 : 3, i % 4 === 1 ? SW.org : SW.crm, .65 * (1 - (off - 200) / (9 * SP))));
  }
  f.add(B(drift, 132 + 30 * beat, SW.org), B(158 + drift + 10 * beat, 12, SW.crm, .92));
  const p = mod(tt, 4), grow = E.out5(seg(p, 0, .45)), shrink = E.io(seg(p, 2.2, 2.7));   // 每 4 秒一條細線劃過
  if (grow > 0 && shrink < 1) f.add(B(-140 + drift, 5, SW.crm, .8, -1600 + 3200 * shrink, -1600 + 3200 * grow));
  lights(f, tt, 16, 6, 3, { avoid: [2, 2, 10, 4] });
  sequencer(f, tt, CW, RH * .5 + 56, 16, 12, 6);
}

/* ---------- 華麗字幕：雙層掃屏、關鍵字巨大落下帶殘影、直欄逐字跳出 ---------- */
function flashy(f, x) {
  const t = x.t, { chars, kw } = x, n = chars.length, kwCh = chars[kw], sub = x.small[0] || '';
  const span = sub ? 520 : 640, cy = sub ? 470 : 540;      // 有第二語言：直欄往上收，下面留一行小字
  const step = n > 1 ? Math.min(sub ? 100 : 112, span / (n - 1)) : 0, y0 = cy - step * (n - 1) / 2;
  const BIG = { px: 1150, weight: 900 };
  buildLayers(f, t, { avoid: [6, 0, 11, 6] });
  f.grid.flash += .16 * (1 - seg(t, 0, .6));
  const s = seg(t, .1, .55), sc = lerp(1.5, 1, E.out5(s)) * (1 + (t > .6 ? .025 * pulse(t, 6) : 0));
  const kx = lerp(300, 470, E.out5(s)) + 16 * Math.sin(Math.max(0, t - .6) * .9);
  if (t > .6) {
    const side = Math.floor(t / BEAT) % 2 ? 1 : -1, p = pulse(t, 4);
    f.text(kwCh, kx + side * 46 * (1 + p), 650, { ...BIG, col: SW.dim2, a: .9 });
    f.text(kwCh, kx - side * 22 * p, 650 - 14 * p, { ...BIG, col: SW.crm, a: .22 * p });
  }
  f.text(kwCh, kx, 650, { ...BIG, scale: sc, col: SW.org, a: E.out(seg(t, .1, .25)) });
  const rl = E.out5(seg(t, .3, .7));
  if (rl > 0) f.add(rect(1118, 180, 1122, 180 + (sub ? 560 : 720) * rl, SW.crm));
  chars.forEach((ch, i) => {
    const ti = .4 + i * .08, si = seg(t, ti, ti + .22); if (si <= 0) return;
    const isK = i === kw, xx = isK ? lerp(1250, 1460, E.out5(seg(t, ti + .15, ti + .5))) : 1250;
    const kick = t > 1.2 ? .1 * pulse(t, 7, BEAT, i * BEAT / n) : 0;
    f.text(ch, xx, y0 + i * step + (1 - E.out(si)) * 46, { px: 98, weight: 900, scale: lerp(.3, 1, E.back(si)) * (1 + kick), col: isK ? SW.org : SW.crm });
  });
  if (sub) {                                                // 第二語言小字：直欄下方、靠右對齊，不碰左邊的大字
    const SM = { px: 44, weight: 500, spacing: 2 }, a = E.io(seg(t, .5 + n * .08, .9 + n * .08)), sc = f.fit(sub, 700, SM);
    f.add(rect(1800 - 120 * a, 776, 1800, 780, SW.org, a));
    f.text(sub, 1800, 820 + (1 - a) * 10, { ...SM, scale: sc, align: 'right', col: SW.crm, a: .7 * a });
  }
  const w = seg(t, 0, .42), w2 = seg(t, .08, .5);
  if (w < 1) { const x0 = lerp(W, -1300, E.io(w)); f.top(rect(x0, 0, x0 + 1100, H, SW.org)); }
  if (w2 < 1) { const x1 = lerp(W + 200, -400, E.io(w2)); f.top(rect(x1, 0, x1 + 60, H, SW.crm)); }
}

/* ---------- 收斂字幕：高潮背景＋深色橫條托住字，切下一句只有字在換 ---------- */
function gentle(f, x) {
  if (x.small.length) return gentle2(f, x);
  const t = x.t, lines = x.big.slice(0, 3), n = lines.length, gap = 132, y0 = 515 - gap * (n - 1) / 2;
  peak(f, x);
  const top = y0 - 92, bot = y0 + (n - 1) * gap + 104;
  f.add(rect(0, top, W, bot, SW.bg, .94), rect(0, top - 3, W, top, SW.crm, .5), rect(0, bot, W, bot + 3, SW.crm, .5));
  const TX = { px: 86, weight: 700, spacing: 10, blur: 12 };
  lines.forEach((l, i) => {
    const s = seg(t, i * .1, .5 + i * .1), a = E.io(s), y = y0 + i * gap + (1 - E.out(s)) * 14;
    f.text(l, 960, y + 5, { ...TX, shadow: true, col: SW.ink, a: .6 * a });
    f.text(l, 960, y, { ...TX, col: SW.crm, a });
  });
  const r = E.out(seg(t, .2, .8)), uw = 300 * r * (1 + .06 * pulse(t, 3)), uy = y0 + (n - 1) * gap + 72;
  if (uw > 1) f.add(rect(960 - uw / 2, uy - 2.5, 960 + uw / 2, uy + 2.5, SW.org));
}

/* ---------- 收斂字幕（雙語）：每一行大字下面一行小字（約 0.46 倍、同色較淡） ---------- */
function gentle2(f, x) {
  const t = x.t, big = x.big.slice(0, 3), small = x.small.slice(0, 3), n = Math.max(big.length, small.length), gap = 158, y0 = 510 - gap * (n - 1) / 2;
  peak(f, x);
  const top = y0 - 92, bot = y0 + (n - 1) * gap + 136;
  f.add(rect(0, top, W, bot, SW.bg, .94), rect(0, top - 3, W, top, SW.crm, .5), rect(0, bot, W, bot + 3, SW.crm, .5));
  const TX = { px: 86, weight: 700, spacing: 10, blur: 12 }, SM = { px: 40, weight: 500, spacing: 3 };
  for (let i = 0; i < n; i++) {
    const s = seg(t, i * .1, .5 + i * .1), a = E.io(s), y = y0 + i * gap + (1 - E.out(s)) * 14;
    if (big[i]) { const sc = f.fit(big[i], 1680, TX);
      f.text(big[i], 960, y + 5, { ...TX, scale: sc, shadow: true, col: SW.ink, a: .6 * a });
      f.text(big[i], 960, y, { ...TX, scale: sc, col: SW.crm, a }); }
    if (small[i]) f.text(small[i], 960, y + 64, { ...SM, scale: f.fit(small[i], 1600, SM), col: SW.crm, a: .62 * a });
  }
  const r = E.out(seg(t, .2, .8)), uw = 300 * r * (1 + .06 * pulse(t, 3)), uy = y0 + (n - 1) * gap + 112;
  if (uw > 1) f.add(rect(960 - uw / 2, uy - 2.5, 960 + uw / 2, uy + 2.5, SW.org));
}

defineScene({
  id: 'swiss', name: '瑞士網格',
  palette: SW, labels: { bg: '底色', org: '主色', crm: '亮色', dim: '暗色塊' },
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
