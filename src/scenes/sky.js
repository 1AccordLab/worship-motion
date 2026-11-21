/* 天空：藍灰底，切紙雲三層緩慢橫移，高潮雲往兩側退開、落下暖金光束；中間歌詞區保持乾淨；背景與字幕由一個個元素疊起來 */
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
const FARC = [[150, 90, 70, 1], [700, 60, 60, 2], [1250, 110, 80, 3], [1700, 70, 60, 4]];
const MIDC = [[300, 170, 95, 5], [1100, 140, 85, 6], [1800, 190, 100, 7]];
const LOWC = [[200, 860, 90, 8], [900, 880, 70, 9], [1500, 850, 95, 10]];

// 天色漸層：分 8 階平塗；warm＝高潮時上方換成暖金
function skyBands(f, x, e) {
  const warm = e.args.warm;
  f.bg = SK.bg;
  for (let i = 0; i < 8; i++) f.add(rect(0, i * 135, W, i * 135 + 136, warm ? mixc(SK.warm, SK.blue, i / 6) : mixc(SK.bg, SK.blue, i / 9)));
}
// 一層飄動的雲：layers 每一層＝雲的清單、循環長度、16 秒飄幾圈、顏色、濃度
function clouds(f, x, e) {
  const t = mod(x.t, LOOP);
  for (const [list, P, k, col, a] of e.args.layers) drift(f, t, list, P, k, SK[col], a);
}
// 山稜：畫面下緣三座深色的圓弧山
function hills(f) {
  f.add(circle(300, 1520, 620, SK.hill, 1, P0), circle(1080, 1640, 720, SK.hill, 1, P0), circle(1720, 1500, 560, SK.hill, 1, P0));
}
// 兩側雲堆：左右兩堆近雲只慢慢起伏；grow＝脹大多少、push＝往外退多少（高潮時雲開）
function banks(f, x, e) {
  const t = mod(x.t, LOOP), { grow, push } = e.args, b = Math.sin(TAU * t / LOOP), c = Math.sin(TAU * t / LOOP + 2);
  [[60 - push, 560, 150], [170 - push, 380, 120], [-40 - push, 760, 170]].forEach(([cx, cy, s], i) => cloud(f, cx, cy + 10 * (i % 2 ? b : c), s * (1 + grow * (.06 + .04 * b)), SK.near, 1, 20 + i));
  [[1860 + push, 520, 150], [1750 + push, 340, 110], [1960 + push, 740, 170]].forEach(([cx, cy, s], i) => cloud(f, cx, cy + 10 * (i % 2 ? c : b), s * (1 + grow * (.06 + .04 * c)), SK.near, 1, 30 + i));
}
// 光束：從上方雲開的地方落下七道平塗的長條（硬邊、半透明），慢慢淡入淡出
function rays(f, x) {
  const t = mod(x.t, LOOP), n = 7, a = .13;
  for (let i = 0; i < n; i++) {
    const ang = 90 + (i - (n - 1) / 2) * 9, al = a * (.6 + .4 * Math.pow(Math.sin(Math.PI * mod(t / LOOP + i * .17, 1)), 2));
    const r = ang * Math.PI / 180, L = 1500, cx = 960 + Math.cos(r) * L / 2, cy = 40 + Math.sin(r) * L / 2;
    f.add(band(cx, cy, L, 70 + 30 * (i % 3), ang, SK.light, al, { tex: false }));
  }
}

// 華麗字幕的排法：一行字置中，逐字慢慢淡入；有標 [關鍵字] 時它加粗、暖金、最後才出來
const hasMark = x => /\[.+?\]/.test(x.swap ? x.text2 : x.text);
const ST = { px: 100, weight: 500 }, KS = { px: 100, weight: 900 };
function rowLayout(f, x) {
  const chars = x.chars, n = chars.length, sub = x.small[0] || '', cy = sub ? 500 : 540, kw = hasMark(x) ? x.kw : -1;
  const ws = chars.map((c, i) => f.measure(c, i === kw ? KS : ST).tw), total = ws.reduce((a, b) => a + b, 0) + 6 * Math.max(0, n - 1), sc = Math.min(1, 1500 / Math.max(1, total));
  return { chars, n, sub, cy, kw, ws, total, sc, end: .3 + n * .08 + 1.3 };
}
// 歌詞（華麗）：一行字逐字慢慢淡入
function chars(f, x) {
  const L = rowLayout(f, x); let cx = 960 - L.total * L.sc / 2;
  L.chars.forEach((c, i) => {
    const w = L.ws[i] * L.sc, isK = i === L.kw, ti = isK ? .3 + L.n * .08 + .35 : .3 + i * .08, a = E.io(seg(x.t, ti, ti + (isK ? 1.8 : 1.3)));
    if (a > .003) f.text(c, cx + w / 2, L.cy, { ...(isK ? KS : ST), scale: L.sc, col: isK ? SK.warm : SK.light, a });
    cx += w + 6 * L.sc;
  });
}
// 第二語言：歌詞下面一行小字，等歌詞出完才淡入
function subline(f, x) {
  const L = rowLayout(f, x), SM = { px: 44, weight: 500, spacing: 3 };
  if (L.sub) f.text(L.sub, 960, L.cy + 96, { ...SM, scale: f.fit(L.sub, 1440, SM), col: SK.light, a: .62 * E.io(seg(x.t, L.end, L.end + 1.5)) });
}
// 金線（華麗）：歌詞下面一條暖金短線，最後才淡入
function goldline(f, x) {
  const L = rowLayout(f, x), r = E.io(seg(x.t, L.end + .4, L.end + 2.2)), uy = L.cy + (L.sub ? 150 : 92);
  if (r > .004) f.add(rect(960 - 70, uy - 2, 960 + 70, uy + 2, SK.warm, .9 * r));
}
// 收斂字幕的排法：最多三行置中；有第二語言時每行下面多一行小字
function blockLayout(x) {
  const big = x.big.slice(0, 3), small = x.small.slice(0, 3), n = Math.max(1, big.length, small.length), two = small.length > 0, gap = two ? 150 : 124;
  return { big, small, n, two, gap, y0: 520 - gap * (n - 1) / 2 };
}
// 歌詞（收斂）：淺色字逐行慢慢淡入（約 1.5 秒）；第二語言是每行下面的小字
function lyrics(f, x) {
  const t = x.t, L = blockLayout(x), TX = { px: 82, weight: 600, spacing: 8 }, SM = { px: 38, weight: 500, spacing: 3 };
  for (let i = 0; i < L.n; i++) {
    const a = E.io(seg(t, .3 + i * .4, 1.8 + i * .4)), y = L.y0 + i * L.gap;
    if (L.big[i]) f.text(L.big[i], 960, y, { ...TX, scale: f.fit(L.big[i], 1500, TX), col: SK.light, a });
    if (L.small[i]) f.text(L.small[i], 960, y + 60, { ...SM, scale: f.fit(L.small[i], 1440, SM), col: SK.light, a: .62 * E.io(seg(t, .7 + i * .4, 2.2 + i * .4)) });
  }
}
// 金線（收斂）：歌詞下面一條暖金短線，最後才淡入
function underline(f, x) {
  const L = blockLayout(x), r = E.io(seg(x.t, 1.2 + L.n * .4, 3 + L.n * .4)), uy = L.y0 + (L.n - 1) * L.gap + (L.two ? 116 : 80);
  if (r > .004) f.add(rect(960 - 90, uy - 2, 960 + 90, uy + 2, SK.warm, .9 * r));
}

defineScene({
  id: 'sky', name: '天空',
  description: '切紙雲層慢慢飄，高潮時雲開、平塗光束落下。適合敬拜、宣告、高舉的歌。',
  palette: SK, labels: { bg: '天色', blue: '藍', warm: '暖金', far: '遠雲', mid: '中雲', near: '近雲', hill: '山稜', light: '光' },
  look: { grain: .025, vignette: .14, paper: .06 },
  textures: [{ type: 'fiber', on: 'shapes,bg', amount: .08 }],
  elements: {
    sky: { label: '天色漸層', fixed: true, colors: ['bg', 'blue', 'warm'], draw: skyBands },
    rays: { label: '光束', colors: ['light'], draw: rays },
    high: { label: '高處的雲', colors: ['far', 'mid'], draw: clouds },
    hills: { label: '山稜', colors: ['hill'], draw: hills },
    low: { label: '低處的雲', colors: ['far', 'mid'], draw: clouds },
    banks: { label: '兩側雲堆', colors: ['near'], draw: banks },
    chars: { label: '歌詞', colors: ['light', 'warm'], draw: chars },
    subline: { label: '第二語言', colors: ['light'], draw: subline },
    goldline: { label: '金線', colors: ['warm'], draw: goldline },
    lyrics: { label: '歌詞', colors: ['light'], draw: lyrics },
    underline: { label: '金線', colors: ['warm'], draw: underline },
  },
  backgrounds: {
    calm: { label: '平靜（雲很慢）', jumpBeats: 8, use: [{ el: 'sky', warm: 0 }, { el: 'high', layers: [[FARC, 1920, 1, 'far', 1], [MIDC, 2100, 1, 'mid', 1]] }, 'hills', { el: 'low', layers: [[LOWC, 1920, 1, 'far', .9]] }, { el: 'banks', grow: 0, push: 60 }] },
    build: { label: '累積（雲層翻湧）', jumpBeats: 4, use: [{ el: 'sky', warm: 0 }, { el: 'high', layers: [[FARC, 1920, 1, 'far', 1], [FARC.map(([a, b, c, d]) => [a + 400, b + 70, c * .8, d + 40]), 1920, 2, 'far', .9], [MIDC, 2100, 2, 'mid', 1]] },
      'hills', { el: 'low', layers: [[LOWC, 1920, 2, 'mid', .9]] }, { el: 'banks', grow: 1, push: 0 }] },
    peak: { label: '高潮（雲開、光束落下）', jumpBeats: 4, use: [{ el: 'sky', warm: 1 }, 'rays', { el: 'high', layers: [[FARC.map(([a, b, c, d]) => [a, b - 40, c, d]), 1920, 1, 'mid', 1]] }, 'hills', { el: 'low', layers: [[LOWC, 1920, 1, 'mid', .8]] }, { el: 'banks', grow: .6, push: 140 }] },
  },
  subtitles: {
    flashy: { label: '華麗（克制）', split: 'line', seconds: 7, use: [{ el: 'under', bg: 'build' }, 'chars', 'subline', 'goldline'] },
    gentle: { label: '收斂', split: 'block', seconds: 16, use: [{ el: 'under', bg: 'calm' }, 'lyrics', 'underline'] },
  },
});
