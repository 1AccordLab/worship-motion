// 海面：深海藍綠＋一個暖色重點。風浪 → 平靜 → 宣告（浪被平息、向前走在水面上）。
// 設計手法：色塊、波線、網點（半透明的形狀印成網點）、紙纖維。色塊位置用跳的（x.step）；背景 16 秒頭尾相接。
// 背景不放字；不用光暈、光斑、霓虹、漸層球、玻璃、3D 旋轉。中間 x 420–1500、y 260–820 只放平的色塊，留給歌詞。
const C = { bg: '#163038', deep: '#0f242a', sea: '#1d4a52', sea2: '#2a6b6f', foam: '#d8d0bb', warm: '#e0884a', sand: '#c7b38d' };

// 一條波線：base 高度、amp 振幅、len 波長、laps＝16 秒走幾圈（整數才接得起來）
function wave(f, t, base, amp, len, laps, w, col, a = 1, ph = 0, x0 = -40, x1 = W + 40) {
  const pts = [];
  for (let px = x0; px <= x1; px += 24) pts.push([px, base + amp * Math.sin(TAU * px / len + TAU * laps * t / LOOP + ph)]);
  f.poly(pts, w, col, a);
}
// 浪頭：沿著波線的小三角（像剪紙），跟著波一起走
function crests(f, t, base, amp, len, laps, col, size, a = 1, ph = 0) {
  const start = mod(len * .75 - laps * t / LOOP * len - ph / TAU * len, len) - len;   // sin＝-1 的位置＝浪頂
  for (let px = start; px < W + len; px += len) f.add(tri(px, base - amp - size * .35, size, 0, col, a));
}
// 邊上的色塊：一組位置，依時間跳
function blocks(f, x, t, every, list, col, a = 1) { const b = x.step(list, every, t); f.add(rect(b[0], b[1], b[2], b[3], col, a)); }

/* ---------- 平靜水面：水平線、幾條緩波、暖色小方塊在水平線上跳位置 ---------- */
function calm(f, x) {
  const t = mod(x.t, LOOP), b = pulse(t, 3, BAR);
  f.add(rect(0, 0, W, 250, C.deep), rect(0, 250, W, 254, C.foam, .35));
  f.add(rect(0, 860, W, H, C.sea, .55));                                         // 半透明 → 網點
  blocks(f, x, t, 2, [[80, 120, 260, 150], [1600, 90, 1840, 118], [120, 70, 420, 96], [1500, 150, 1700, 176]], C.sand, .8);
  blocks(f, x, t, 2, [[0, 330, 120, 620], [1800, 420, 1920, 760], [0, 520, 90, 820], [1820, 300, 1920, 560]], C.sea, .9);   // 邊上的水色塊，跳位置
  blocks(f, x, t, 4, [[1560, 800, 1820, 812], [100, 800, 420, 812], [1400, 800, 1760, 812], [180, 800, 520, 812]], C.sand, .6);
  const K = x.step([[300, 238], [1620, 238], [180, 238], [1460, 238]], 2, t);
  f.add(rect(K[0] - 26, K[1] - 26 - 6 * b, K[0] + 26, K[1] + 4, C.warm));
  wave(f, t, 900, 6, 640, 1, 3, C.foam, .55);
  wave(f, t, 960, 8, 520, 2, 2.5, C.sea2, .9, 1.3);
  wave(f, t, 1030, 10, 760, 1, 4, C.foam, .35, 2.4);
  wave(f, t, 180, 4, 900, 1, 2, C.sea2, .8, .7);
  for (let i = 0; i < 8; i++) f.add(rect(96 + i * 22, 1040, 108 + i * 22, 1052, i === Math.floor(t / BEAT) % 8 ? C.warm : C.sea2));   // 拍點
}

/* ---------- 風浪：大浪在上下兩邊翻、斜雨、色塊每 1 秒跳、水平線跟拍傾斜（跳的，不是轉） ---------- */
function storm(f, x) {
  const t = mod(x.t, LOOP), b = pulse(t, 5);
  const tilt = x.step([-2.5, 2, -1.5, 3, -3, 1.5, -2, 2.5], 1, t);
  f.add(band(960, 115, 2400, 250, tilt, C.deep));
  f.add(band(960, 238, 2400, 5, tilt, C.foam, .4));
  for (let i = 0; i < 9; i++) {                                                 // 斜雨：只在左右兩側
    const px = mod(i * 230 + 2300 * 3 * t / LOOP, 2300) - 190; if (px > 180 && px < 1740) continue;
    f.add(band(px, 540, 1300, 6, 72, C.foam, .22));
  }
  blocks(f, x, t, 1, [[0, 520, 140, 700], [1780, 300, 1920, 520], [0, 300, 110, 460], [1800, 600, 1920, 760]], C.sea2, .7);
  blocks(f, x, t, 1, [[1640, 40, 1740, 140], [180, 60, 280, 160], [1500, 120, 1580, 200], [60, 140, 140, 220]], C.warm);
  f.add(rect(0, 850, W, H, C.sea, .6));
  wave(f, t, 880, 34 + 8 * b, 420, 2, 5, C.foam, .8);
  crests(f, t, 880, 34, 420, 2, C.foam, 26, .85);
  wave(f, t, 950, 46, 560, 3, 4, C.sea2, 1, 1.7);
  wave(f, t, 1030, 40, 380, 4, 6, C.foam, .5, 3.1);
  wave(f, t, 90, 26, 480, 3, 3, C.sea2, .9, .4);
  wave(f, t, 150, 30, 360, 2, 3, C.foam, .45, 2.2);
}

/* ---------- 宣告：浪被平息成平的色條、暖色的路從腳下往水平線延伸（向前）、色塊跳 ---------- */
function peak(f, x) {
  const t = mod(x.t, LOOP), b = pulse(t, 5), bar = pulse(t, 3, BAR);
  f.add(rect(0, 0, W, 250, C.deep));
  f.add(circle(960, 250, 110 * (1 + .03 * bar), C.warm));                      // 半個太陽在水平線上（下半被水面蓋住）
  f.add(rect(0, 250, W, 420, C.bg), rect(0, 250, W, 254, C.foam, .5));
  for (let i = 0; i < 7; i++) {                                                 // 平靜的水面條紋，越近越粗
    const y = 860 + i * 30 + i * i * 2, a = .35 + .08 * i;
    f.add(rect(0, y, W, y + 4 + i * 1.5, i % 2 ? C.sea2 : C.foam, i % 2 ? .9 : a * .5));
  }
  const steps = 6;                                                              // 腳下的路：一階一階往前，跟拍子亮一格
  for (let i = 0; i < steps; i++) {
    const y0 = 1080 - i * 38, w = 360 - i * 52, on = Math.floor(t / BEAT) % steps === i;
    f.add(rect(960 - w / 2, y0 - 26, 960 + w / 2, y0, C.warm, on ? 1 : .55 + .05 * i));
  }
  blocks(f, x, t, 2, [[40, 40, 300, 90], [1620, 40, 1880, 90], [40, 200, 240, 240], [1680, 200, 1880, 240]], C.sand, .85);
  blocks(f, x, t, 2, [[1700, 880, 1840, 1020], [80, 880, 220, 1020], [1560, 940, 1660, 1040], [260, 940, 360, 1040]], C.sea2, .8);
  wave(f, t, 150, 3 + 2 * b, 900, 1, 2, C.foam, .45);
}

/* ---------- 收斂字幕：平靜水面＋深色水帶托住字；有第二語言時每行下面一行小字 ---------- */
function gentle(f, x) {
  const t = x.t, big = x.big.slice(0, 3), small = x.small.slice(0, 3), n = Math.max(1, big.length, small.length);
  const two = small.length > 0, gap = two ? 156 : 130, y0 = 510 - gap * (n - 1) / 2;
  calm(f, x);
  const top = y0 - 92, bot = y0 + (n - 1) * gap + (two ? 132 : 104);
  f.add(rect(0, top, W, bot, C.deep), rect(0, top - 4, W, top, C.warm), rect(0, bot, W, bot + 3, C.foam, .45));
  const TX = { px: 86, weight: 700, spacing: 10, blur: 12 }, SM = { px: 40, weight: 500, spacing: 3 };
  for (let i = 0; i < n; i++) {
    const s = seg(t, i * .1, .5 + i * .1), a = E.io(s), y = y0 + i * gap + (1 - E.out(s)) * 14;
    if (big[i]) { const sc = f.fit(big[i], 1680, TX);
      f.text(big[i], 960, y + 5, { ...TX, scale: sc, shadow: true, col: C.deep, a: .6 * a });
      f.text(big[i], 960, y, { ...TX, scale: sc, col: C.foam, a }); }
    if (small[i]) f.text(small[i], 960, y + 62, { ...SM, scale: f.fit(small[i], 1600, SM), col: C.foam, a: .62 * a });
  }
  const r = E.out(seg(t, .2, .8)), uy = bot - 26;                               // 字下一條細浪慢慢拉開
  if (r > .01) wave(f, t, uy, 4, 160, 1, 3, C.warm, .9, 0, 960 - 150 * r, 960 + 150 * r);
}

/* ---------- 華麗字幕：浪掃過 → 每個字落在一塊浮在水上的色塊，跟著浪起伏；關鍵字暖色放大 ---------- */
function flashy(f, x) {
  const t = x.t, { chars, kw } = x, n = chars.length, sub = x.small[0] || '';
  const size = Math.min(170, 1440 / Math.max(1, n)), x0 = 960 - size * (n - 1) / 2, cy = sub ? 470 : 500;
  storm(f, x);
  f.add(rect(0, cy - size * .9, W, cy + size * .9 + (sub ? 150 : 0), C.bg));
  chars.forEach((ch, i) => {
    const ti = .35 + i * .09, si = seg(t, ti, ti + .25); if (si <= 0) return;
    const isK = i === kw, bob = 10 * Math.sin(TAU * (t / 2) + i * .7) * seg(t, ti + .3, ti + .8);
    const sc = lerp(.3, 1, E.back(si)) * (isK ? 1.25 : 1), px = x0 + i * size, py = cy + bob + (1 - E.out(si)) * -90;
    f.add(rect(px - size * .44 * sc, py - size * .44 * sc, px + size * .44 * sc, py + size * .44 * sc, isK ? C.warm : C.sea2, isK ? 1 : .85));
    f.text(ch, px, py + 4, { px: 118, weight: 900, scale: sc * Math.min(1, size / 150), col: isK ? C.deep : C.foam });
  });
  wave(f, t, cy + size * .62, 6, 300, 2, 3, C.foam, .6 * seg(t, .5, .9));
  if (sub) {                                                                    // 第二語言小字：浮塊那一排下方
    const SM = { px: 54, weight: 600, spacing: 2 }, a = E.io(seg(t, .5 + n * .09, .9 + n * .09));
    f.text(sub, 960, cy + size * .62 + 70 + (1 - a) * 10, { ...SM, scale: f.fit(sub, 1400, SM), col: C.foam, a: .72 * a });
  }
  const w = seg(t, 0, .45);                                                     // 開場：一大片海水由右往左掃過，前緣是波線
  if (w < 1) {
    const ex = lerp(W + 200, -2300, E.io(w));
    f.top(rect(ex, 0, ex + 2200, H, C.sea));
    const pts = []; for (let py = 0; py <= H; py += 30) pts.push([ex + 24 * Math.sin(py / 90), py]);
    f.poly(pts, 10, C.foam, .9, { z: 2 });
  }
}

defineScene({
  id: 'waves', name: '海面',
  palette: C, labels: { bg: '海色', deep: '深海', sea: '水面', sea2: '淺水', foam: '浪花', warm: '暖色重點', sand: '沙色' },
  look: { grain: .03, vignette: .16, paper: .05 },
  textures: [
    { type: 'halftone', on: 'shapes', cell: 8, angle: 30 },     // 半透明的色塊印成網點
    { type: 'fiber', on: 'bg', amount: .12 },                    // 紙纖維
  ],
  backgrounds: {
    calm: { label: '平靜水面', jumpBeats: 4, draw: calm },
    storm: { label: '風浪', jumpBeats: 2, draw: storm },
    peak: { label: '宣告：浪平息、向前', jumpBeats: 4, draw: peak },
  },
  subtitles: {
    flashy: { label: '華麗', split: 'line', seconds: 6, draw: flashy },
    gentle: { label: '收斂', split: 'block', seconds: 16, draw: gentle },
  },
});
