/* 麥田（平面設計版）：地平線很低，草／麥占畫面下方約 1/3，上方大片天空留白給歌詞。
   筆觸感的草葉與麥穗（短線、手繪抖動、網點、紙紋），風的軌跡用細線。遠／中／近三層以不同速度橫向循環平移（視差），
   16 秒剛好走完一個循環，頭尾相接（自然場景慢慢流動，不用跳位）。 */
const FD = { bg: '#aab3b0', haze: '#c9c6b4', far: '#7f8c66', green: '#66784a', gold: '#c39a52', warm: '#d6a06a', ink: '#2f3326' };
const HZ = 800;
const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const mixc = (a, b, k) => { const x = rgb(a), y = rgb(b); k = clamp01(k); return [lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k)]; };

// 風：一波一波往右傳（laps＝16 秒幾波，整數才接得起來）
const wind = (x, t, laps, len = 900) => .5 + .5 * Math.sin(TAU * (x / len - laps * t / LOOP));
// 一層麥：sp＝間距、n×sp＝循環長度、每 16 秒往左移 n×sp（剛好一圈）；amp＝風吹的傾斜；gold＝金色比例；ears＝畫麥穗
function layer(f, t, L, o) {
  const P = L.n * L.sp, off = mod(t / LOOP * P, P);
  for (let x = -L.sp - off, i = 0; x < W + L.sp; x += L.sp, i++) {
    const id = mod(i, L.n), r = hash(id * 7.3 + L.seed), h = L.h * (.75 + .35 * r), wv = wind(x, t, o.laps);
    const lean = (o.amp * (.25 + .75 * wv) + 2) * h / 40, bx = x + (r - .5) * L.sp * .6, by = L.y + (hash(id + L.seed * 3) - .5) * L.jit;
    const col = mixc(L.col, FD.gold, o.gold + o.wave * wv * .5);
    f.line(bx, by, bx + lean, by - h, L.w, col, 1);
    if (L.ears) {
      const ex = bx + lean * 1.02, ey = by - h, ang = Math.atan2(-h, lean) * 180 / Math.PI;
      f.add(band(ex + lean * .06, ey - L.ears * .45, L.ears, L.w * 2.6, ang, mixc(FD.gold, FD.warm, o.gold * .6 + o.wave * wv * .4)));
      f.line(ex, ey - L.ears * .8, ex + lean * .12 + L.sp * .1, ey - L.ears * 1.35, 1.5, FD.gold, .8);
    }
  }
}
const FAR = { y: HZ + 22, sp: 16, n: 20, h: 26, w: 2.5, jit: 10, col: FD.far, seed: 1 };
const MID = { y: HZ + 120, sp: 24, n: 20, h: 70, w: 3.5, jit: 24, col: FD.green, seed: 2, ears: 20 };
const MID2 = { y: HZ + 190, sp: 30, n: 24, h: 110, w: 4, jit: 26, col: FD.green, seed: 4, ears: 26 };
const NEAR = { y: H + 30, sp: 40, n: 24, h: 210, w: 6, jit: 30, col: FD.green, seed: 3, ears: 40 };

function sky(f, warm) {
  f.bg = FD.bg;
  for (let i = 0; i < 5; i++) f.add(rect(0, 360 + i * 90, W, 450 + i * 90, mixc(FD.bg, warm > 0 ? FD.warm : FD.haze, (i + 1) / 5 * (.5 + .5 * warm)), .55 + .1 * i));   // 半透明的天色帶 → 網點
}
function ground(f, gold) { f.add(rect(0, HZ, W, H, mixc(FD.far, FD.gold, gold * .8)), rect(0, HZ, W, HZ + 4, FD.haze, .7)); }
// 風的軌跡：細細的波線，慢慢淡入淡出（跟著風往右傳）
function trails(f, t, list) {
  for (const [y, x0, len, ph] of list) {
    const a = Math.pow(Math.sin(Math.PI * mod(t / LOOP + ph, 1)), 2) * .55; if (a < .01) continue;
    const pts = []; for (let x = x0; x <= x0 + len; x += 20) pts.push([x, y + 10 * Math.sin(TAU * (x / 380 - 2 * t / LOOP))]);
    f.poly(pts, 2, FD.ink, a);
  }
}

function calm(f, x) {
  const t = mod(x.t, LOOP), o = { laps: 1, amp: 6, gold: .15, wave: 0 };
  sky(f, 0); ground(f, .1);
  trails(f, t, [[170, 120, 300, 0], [210, 1460, 340, .5], [760, 1500, 300, .25]]);
  layer(f, t, FAR, o); layer(f, t, MID, o); layer(f, t, NEAR, o);
}
function build(f, x) {
  const t = mod(x.t, LOOP), o = { laps: 2, amp: 22, gold: .3, wave: .6 };
  sky(f, .3); ground(f, .3);
  trails(f, t, [[150, 100, 360, 0], [200, 1420, 380, .4], [230, 300, 260, .7], [760, 140, 320, .2], [770, 1480, 320, .6]]);
  layer(f, t, FAR, o); layer(f, t, MID, o); layer(f, t, MID2, o); layer(f, t, NEAR, o);
}
function peak(f, x) {
  const t = mod(x.t, LOOP), o = { laps: 2, amp: 26, gold: .85, wave: .5 };
  sky(f, 1); f.add(circle(1640, HZ, 120, FD.warm), circle(1640, HZ, 120, FD.gold, .5, { tex: false }));
  ground(f, .9);
  trails(f, t, [[150, 100, 360, 0], [200, 1420, 380, .4], [240, 260, 300, .7], [760, 140, 320, .2], [770, 1480, 320, .6]]);
  layer(f, t, FAR, o); layer(f, t, MID, o); layer(f, t, MID2, o); layer(f, t, NEAR, o);
}

/* ---------- 字幕：深色字在天空上，逐行慢慢淡入（約 1.5 秒），無彈跳無放大；雙語時每行下面一行小字 ---------- */
const hasMark = x => /\[.+?\]/.test(x.swap ? x.text2 : x.text);
function gentle(f, x) {
  calm(f, x);
  const t = x.t, big = x.big.slice(0, 3), small = x.small.slice(0, 3), n = Math.max(1, big.length, small.length), two = small.length > 0;
  const gap = two ? 140 : 116, y0 = 440 - gap * (n - 1) / 2, TX = { px: 82, weight: 600, spacing: 8 }, SM = { px: 38, weight: 500, spacing: 3 };
  for (let i = 0; i < n; i++) {
    const a = E.io(seg(t, .3 + i * .4, 1.8 + i * .4)), y = y0 + i * gap;
    if (big[i]) f.text(big[i], 960, y, { ...TX, scale: f.fit(big[i], 1500, TX), col: FD.ink, a });
    if (small[i]) f.text(small[i], 960, y + 58, { ...SM, scale: f.fit(small[i], 1440, SM), col: FD.ink, a: .62 * E.io(seg(t, .7 + i * .4, 2.2 + i * .4)) });
  }
  const r = E.io(seg(t, 1.2 + n * .4, 3 + n * .4)), uy = y0 + (n - 1) * gap + (two ? 108 : 76);
  if (r > .004) f.line(960 - 90, uy, 960 + 90, uy, 4, FD.gold, r);
}
function flashy(f, x) {
  build(f, x);
  const t = x.t, sub = x.small[0] || '', cy = sub ? 410 : 440, kw = hasMark(x) ? x.kw : -1, chars = x.chars, n = chars.length;
  const ST = { px: 100, weight: 500 }, KS = { px: 100, weight: 900 };
  const ws = chars.map((c, i) => f.measure(c, i === kw ? KS : ST).tw), total = ws.reduce((a, b) => a + b, 0) + 6 * Math.max(0, n - 1), sc = Math.min(1, 1500 / Math.max(1, total));
  let cx = 960 - total * sc / 2;
  chars.forEach((c, i) => {
    const w = ws[i] * sc, isK = i === kw, ti = isK ? .3 + n * .08 + .35 : .3 + i * .08, a = E.io(seg(t, ti, ti + (isK ? 1.8 : 1.3)));
    if (a > .003) f.text(c, cx + w / 2, cy, { ...(isK ? KS : ST), scale: sc, col: isK ? '#8a5a1e' : FD.ink, a });
    cx += w + 6 * sc;
  });
  const end = .3 + n * .08 + 1.3;
  if (sub) { const SM = { px: 44, weight: 500, spacing: 3 }; f.text(sub, 960, cy + 94, { ...SM, scale: f.fit(sub, 1440, SM), col: FD.ink, a: .62 * E.io(seg(t, end, end + 1.5)) }); }
  const r = E.io(seg(t, end + .4, end + 2.2)), uy = cy + (sub ? 148 : 90);
  if (r > .004) f.line(960 - 70, uy, 960 + 70, uy, 4, FD.gold, r);
}

defineScene({
  id: 'field', name: '麥田',
  palette: FD, labels: { bg: '天空', haze: '天邊', far: '遠草', green: '草綠', gold: '麥金', warm: '暖色', ink: '字色' },
  look: { grain: .025, vignette: .12, paper: .06 },
  textures: [
    { type: 'wobble', on: 'lines', amount: 2, scale: .02, fps: 8 },   // 手繪抖動
    { type: 'halftone', on: 'shapes', cell: 7, angle: 20 },           // 半透明的天色帶印成網點
    { type: 'fiber', on: 'bg', amount: .1 },                           // 紙紋
  ],
  backgrounds: {
    calm: { label: '平靜（微風）', jumpBeats: 8, draw: calm },
    build: { label: '累積（麥浪）', jumpBeats: 4, draw: build },
    peak: { label: '高潮（金色麥浪）', jumpBeats: 4, draw: peak },
  },
  subtitles: {
    flashy: { label: '華麗（克制）', split: 'line', seconds: 7, draw: flashy },
    gentle: { label: '收斂', split: 'block', seconds: 16, draw: gentle },
  },
});
