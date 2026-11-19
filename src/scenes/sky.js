/* 天空：藍灰底，切紙雲三層緩慢橫移，高潮雲往兩側退開、落下暖金光束；中間歌詞區保持乾淨 */
const SK = { bg: '#34445a', blue: '#4a6a8c', warm: '#d9ab66', far: '#56667a', mid: '#8d98a4', near: '#c9c6ba', hill: '#1f2a36', light: '#ecdcb6' };
const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const mixc = (a, b, k) => { const x = rgb(a), y = rgb(b); k = clamp01(k); return [lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k)]; };
const P0 = { rough: 6, seed: 1 };

// 一朵切紙雲：底是平的長條，上面幾個圓；先畫一層位移的紙影
function cloud(f, cx, cy, s, col, a = 1, seed = 1) {
  const parts = [[0, .25, 1.7, .5], [-1, 0, .55], [-.35, -.3, .8], [.5, -.12, .62], [1.15, .12, .42]];
  for (const [shx, shy, sa] of [[12, 14, .28], [0, 0, 1]]) {
    const c = sa < 1 ? SK.hill : col, al = a * sa, o = { ...P0, seed: seed + (sa < 1 ? 9 : 0) };
    f.add(rect(cx - 1.6 * s + shx, cy + shy, cx + 1.6 * s + shx, cy + .5 * s + shy, c, al, o));
    for (const [dx, dy, r] of parts.slice(1)) f.add(circle(cx + dx * s + shx, cy + dy * s + shy, r * s, c, al, o));
  }
}
// 一層雲：每 16 秒往右移一個循環長度 P（＝n 朵的間距和），所以頭尾接得起來
function drift(f, t, list, P, k, col, a) {
  const off = mod(t / LOOP * P * k, P);
  for (const [x, y, s, sd] of list) for (const rep of [-P, 0, P]) {
    const cx = x + off + rep; if (cx < -400 || cx > W + 400) continue;
    cloud(f, cx, y, s, col, a, sd);
  }
}
function skyBands(f, warm) {
  f.bg = SK.bg;
  for (let i = 0; i < 8; i++) f.add(rect(0, i * 135, W, i * 135 + 136, warm ? mixc(SK.warm, SK.blue, i / 6) : mixc(SK.bg, SK.blue, i / 9)));
}
function hills(f) { f.add(circle(300, 1520, 620, SK.hill, 1, P0), circle(1080, 1640, 720, SK.hill, 1, P0), circle(1720, 1500, 560, SK.hill, 1, P0)); }
// 兩側的雲堆（不橫移，只慢慢起伏）；push＝往外退（peak 雲開）
function banks(f, t, grow, push) {
  const b = Math.sin(TAU * t / LOOP), c = Math.sin(TAU * t / LOOP + 2);
  [[60 - push, 560, 150], [170 - push, 380, 120], [-40 - push, 760, 170]].forEach(([x, y, s], i) => cloud(f, x, y + 10 * (i % 2 ? b : c), s * (1 + grow * (.06 + .04 * b)), SK.near, 1, 20 + i));
  [[1860 + push, 520, 150], [1750 + push, 340, 110], [1960 + push, 740, 170]].forEach(([x, y, s], i) => cloud(f, x, y + 10 * (i % 2 ? c : b), s * (1 + grow * (.06 + .04 * c)), SK.near, 1, 30 + i));
}
// 平塗光束：從上方雲開的地方落下的長條（硬邊、半透明），慢慢淡入淡出
function rays(f, t, n, a) {
  for (let i = 0; i < n; i++) {
    const ang = 90 + (i - (n - 1) / 2) * 9, al = a * (.6 + .4 * Math.pow(Math.sin(Math.PI * mod(t / LOOP + i * .17, 1)), 2));
    const r = ang * Math.PI / 180, L = 1500, cx = 960 + Math.cos(r) * L / 2, cy = 40 + Math.sin(r) * L / 2;
    f.add(band(cx, cy, L, 70 + 30 * (i % 3), ang, SK.light, al, { tex: false }));
  }
}
const FARC = [[150, 90, 70, 1], [700, 60, 60, 2], [1250, 110, 80, 3], [1700, 70, 60, 4]];
const MIDC = [[300, 170, 95, 5], [1100, 140, 85, 6], [1800, 190, 100, 7]];
const LOWC = [[200, 860, 90, 8], [900, 880, 70, 9], [1500, 850, 95, 10]];

function calm(f, x) {
  const t = mod(x.t, LOOP);
  skyBands(f, 0);
  drift(f, t, FARC, 1920, 1, SK.far, 1); drift(f, t, MIDC, 2100, 1, SK.mid, 1);
  hills(f); drift(f, t, LOWC, 1920, 1, SK.far, .9);
  banks(f, t, 0, 60);
}
function build(f, x) {
  const t = mod(x.t, LOOP);
  skyBands(f, 0);
  drift(f, t, FARC, 1920, 1, SK.far, 1); drift(f, t, FARC.map(([a, b, c, d]) => [a + 400, b + 70, c * .8, d + 40]), 1920, 2, SK.far, .9);
  drift(f, t, MIDC, 2100, 2, SK.mid, 1);
  hills(f); drift(f, t, LOWC, 1920, 2, SK.mid, .9);
  banks(f, t, 1, 0);
}
function peak(f, x) {
  const t = mod(x.t, LOOP);
  skyBands(f, 1);
  rays(f, t, 7, .13);
  drift(f, t, FARC.map(([a, b, c, d]) => [a, b - 40, c, d]), 1920, 1, SK.mid, 1);
  hills(f); drift(f, t, LOWC, 1920, 1, SK.mid, .8);
  banks(f, t, .6, 140);
}

// 字幕：淺色字、逐行慢慢淡入（約 1.5 秒）；雙語時每行下面一行小字
const hasMark = x => /\[.+?\]/.test(x.swap ? x.text2 : x.text);
function gentle(f, x) {
  x.under(f, calm);
  const t = x.t, big = x.big.slice(0, 3), small = x.small.slice(0, 3), n = Math.max(1, big.length, small.length), two = small.length > 0;
  const gap = two ? 150 : 124, y0 = 520 - gap * (n - 1) / 2, TX = { px: 82, weight: 600, spacing: 8 }, SM = { px: 38, weight: 500, spacing: 3 };
  for (let i = 0; i < n; i++) {
    const a = E.io(seg(t, .3 + i * .4, 1.8 + i * .4)), y = y0 + i * gap;
    if (big[i]) f.text(big[i], 960, y, { ...TX, scale: f.fit(big[i], 1500, TX), col: SK.light, a });
    if (small[i]) f.text(small[i], 960, y + 60, { ...SM, scale: f.fit(small[i], 1440, SM), col: SK.light, a: .62 * E.io(seg(t, .7 + i * .4, 2.2 + i * .4)) });
  }
  const r = E.io(seg(t, 1.2 + n * .4, 3 + n * .4)), uy = y0 + (n - 1) * gap + (two ? 116 : 80);
  if (r > .004) f.add(rect(960 - 90, uy - 2, 960 + 90, uy + 2, SK.warm, .9 * r));
}
function flashy(f, x) {
  x.under(f, build);
  const t = x.t, sub = x.small[0] || '', cy = sub ? 500 : 540, kw = hasMark(x) ? x.kw : -1, chars = x.chars, n = chars.length;
  const ST = { px: 100, weight: 500 }, KS = { px: 100, weight: 900 };
  const ws = chars.map((c, i) => f.measure(c, i === kw ? KS : ST).tw), total = ws.reduce((a, b) => a + b, 0) + 6 * Math.max(0, n - 1), sc = Math.min(1, 1500 / Math.max(1, total));
  let cx = 960 - total * sc / 2;
  chars.forEach((c, i) => {
    const w = ws[i] * sc, isK = i === kw, ti = isK ? .3 + n * .08 + .35 : .3 + i * .08, a = E.io(seg(t, ti, ti + (isK ? 1.8 : 1.3)));
    if (a > .003) f.text(c, cx + w / 2, cy, { ...(isK ? KS : ST), scale: sc, col: isK ? SK.warm : SK.light, a });
    cx += w + 6 * sc;
  });
  const end = .3 + n * .08 + 1.3;
  if (sub) { const SM = { px: 44, weight: 500, spacing: 3 }; f.text(sub, 960, cy + 96, { ...SM, scale: f.fit(sub, 1440, SM), col: SK.light, a: .62 * E.io(seg(t, end, end + 1.5)) }); }
  const r = E.io(seg(t, end + .4, end + 2.2)), uy = cy + (sub ? 150 : 92);
  if (r > .004) f.add(rect(960 - 70, uy - 2, 960 + 70, uy + 2, SK.warm, .9 * r));
}

defineScene({
  id: 'sky', name: '天空',
  description: '切紙雲層慢慢飄，高潮時雲開、平塗光束落下。適合敬拜、宣告、高舉的歌。',
  palette: SK, labels: { bg: '天色', blue: '藍', warm: '暖金', far: '遠雲', mid: '中雲', near: '近雲', hill: '山稜', light: '光' },
  look: { grain: .025, vignette: .14, paper: .06 },
  textures: [{ type: 'fiber', on: 'shapes,bg', amount: .08 }],
  backgrounds: {
    calm: { label: '平靜（雲很慢）', jumpBeats: 8, draw: calm },
    build: { label: '累積（雲層翻湧）', jumpBeats: 4, draw: build },
    peak: { label: '高潮（雲開、光束落下）', jumpBeats: 4, draw: peak },
  },
  subtitles: {
    flashy: { label: '華麗（克制）', split: 'line', seconds: 7, draw: flashy },
    gentle: { label: '收斂', split: 'block', seconds: 16, draw: gentle },
  },
});
