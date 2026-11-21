/* 光柱：深藍到墨綠底，教堂高窗落下平塗半透明光柱，暖金重點；光柱組合每「色塊換位」淡入淡出切換；背景與字幕由一個個元素疊起來 */
const NV = { bg: '#16253a', green: '#15302a', win: '#25394f', light: '#e3d6b8', gold: '#d3a253', ink: '#0f1b24' };
const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const mixc = (a, b, k) => { const x = rgb(a), y = rgb(b); return [lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k)]; };
const WIN = [130, 330, 1590, 1790];
const TILT = 79;

// 底色漸層：上方深藍到下方墨綠，分 8 階平塗
function ground(f) {
  f.bg = NV.bg;
  for (let i = 1; i < 8; i++) f.add(rect(0, i * 135, W, i * 135 + 136, mixc(NV.bg, NV.green, i / 7)));
}
// 高窗：四扇拱形窗，各有一根窗櫺；rose＝中間圓窗的濃度
function windows(f, x, e) {
  const rose = e.args.rose;
  for (const wx of WIN) { f.add(rect(wx - 42, 90, wx + 42, 216, NV.win), circle(wx, 90, 42, NV.win), rect(wx - 3, 52, wx + 3, 216, NV.bg, .9), rect(wx - 42, 150, wx + 42, 155, NV.bg, .9)); }
  if (rose) { f.add(circle(960, 120, 64, NV.win, rose)); f.add(arc(960, 120, 34, 5, 0, TAU, NV.bg, .8 * rose)); }
}
// 一道光柱：從窗下緣斜斜落到畫面外；兩層平塗疊出「中間濃、邊緣淡」
function beam(f, x0, wid, col, a) {
  if (a <= .004) return;
  const L = 1500, r = TILT * Math.PI / 180, cx = x0 + Math.cos(r) * L / 2, cy = 216 + Math.sin(r) * L / 2;
  f.add(band(cx, cy, L, wid * 1.7, TILT, col, a * .5, { rough: 2, seed: x0 }), band(cx, cy, L, wid, TILT, col, a, { rough: 2, seed: x0 + 1 }));
}
// 中間的寬光：中間圓窗落下一道很淡的暖金寬光
function glow(f) {
  beam(f, 960 - 40, 150, NV.gold, .07);
}
// 光柱：每 every 秒換一組，前一組淡出、下一組淡入（sets 每一組＝幾道光，各是 [第幾扇窗, 寬度, 'g' 代表暖金]）
function beams(f, x, e) {
  const t = mod(x.t, LOOP), { sets, every, a } = e.args;
  const j = x.jt(t) / every, k = Math.floor(j), fr = j - k, mix = E.io(seg(fr, .65, 1));
  for (const [s, w] of [[sets[mod(k, sets.length)], 1 - mix], [sets[mod(k + 1, sets.length)], mix]])
    for (const [wi, wid, c] of s) beam(f, typeof wi === 'number' && wi < 10 ? WIN[wi] : wi, wid, c === 'g' ? NV.gold : NV.light, a * w);
}

// 華麗字幕的排法：一行字置中，逐字慢慢淡入；有標 [關鍵字] 時它加粗、暖金、最後才出來
const hasMark = x => /\[.+?\]/.test(x.swap ? x.text2 : x.text);
const ROW = { style: { px: 100, weight: 500 }, kwStyle: { px: 100, weight: 900 } };
function rowLayout(f, x) {
  const chars = x.chars, n = chars.length, sub = x.small[0] || '', cy = sub ? 500 : 540, kw = hasMark(x) ? x.kw : -1;
  const ws = chars.map((c, i) => f.measure(c, i === kw ? ROW.kwStyle : ROW.style).tw);
  const total = ws.reduce((a, b) => a + b, 0) + 6 * Math.max(0, n - 1), sc = Math.min(1, 1500 / Math.max(1, total));
  let cx = 960 - total * sc / 2, kx = 960; const at = [];
  chars.forEach((c, i) => { const w = ws[i] * sc; if (i === kw) kx = cx + w / 2; at.push(cx + w / 2); cx += w + 6 * sc; });
  return { chars, n, sub, cy, kw, sc, at, kx, end: .3 + n * .08 + 1.3, kt: .3 + n * .08 + .35 };
}
// 關鍵字上的光：一道細細的暖金光柱慢慢淡入，落在關鍵字上
function shaft(f, x) {
  const L = rowLayout(f, x); if (L.kw < 0) return;
  const a = .14 * E.io(seg(x.t, L.kt, L.kt + 2)), wd = 120;
  f.add(rect(L.kx - wd / 2, 0, L.kx + wd / 2, H, NV.gold, a * .5), rect(L.kx - wd / 4, 0, L.kx + wd / 4, H, NV.gold, a));
}
// 歌詞（華麗）：一行字逐字慢慢淡入
function chars(f, x) {
  const L = rowLayout(f, x);
  L.chars.forEach((c, i) => {
    const isK = i === L.kw, ti = isK ? L.kt : .3 + i * .08, a = E.io(seg(x.t, ti, ti + (isK ? 1.8 : 1.3)));
    if (a > .003) f.text(c, L.at[i], L.cy, { ...(isK ? ROW.kwStyle : ROW.style), scale: L.sc, col: isK ? NV.gold : NV.light, a });
  });
}
// 第二語言：歌詞下面一行小字，等歌詞出完才淡入
function subline(f, x) {
  const L = rowLayout(f, x), SM = { px: 44, weight: 500, spacing: 3 };
  if (L.sub) f.text(L.sub, 960, L.cy + 96, { ...SM, scale: f.fit(L.sub, 1440, SM), col: NV.light, a: .62 * E.io(seg(x.t, L.end, L.end + 1.5)) });
}
// 金線（華麗）：歌詞下面一條暖金短線，最後才淡入
function goldline(f, x) {
  const L = rowLayout(f, x), r = E.io(seg(x.t, L.end + .4, L.end + 2.2)), uy = L.cy + (L.sub ? 150 : 92);
  if (r > .004) f.add(rect(960 - 70, uy - 2, 960 + 70, uy + 2, NV.gold, .85 * r));
}
// 收斂字幕的排法：最多三行置中；有第二語言時每行下面多一行小字
function blockLayout(x) {
  const big = x.big.slice(0, 3), small = x.small.slice(0, 3), n = Math.max(1, big.length, small.length), two = small.length > 0, gap = two ? 150 : 124;
  return { big, small, n, two, gap, y0: 524 - gap * (n - 1) / 2 };
}
// 歌詞（收斂）：逐行慢慢淡入（約 1.5 秒）；第二語言是每行下面的小字
function lyrics(f, x) {
  const t = x.t, L = blockLayout(x), TX = { px: 82, weight: 600, spacing: 8 }, SM = { px: 38, weight: 500, spacing: 3 };
  for (let i = 0; i < L.n; i++) {
    const a = E.io(seg(t, .3 + i * .4, 1.8 + i * .4)), y = L.y0 + i * L.gap;
    if (L.big[i]) f.text(L.big[i], 960, y, { ...TX, scale: f.fit(L.big[i], 1500, TX), col: NV.light, a });
    if (L.small[i]) f.text(L.small[i], 960, y + 60, { ...SM, scale: f.fit(L.small[i], 1440, SM), col: NV.light, a: .6 * E.io(seg(t, .7 + i * .4, 2.2 + i * .4)) });
  }
}
// 金線（收斂）：歌詞下面一條暖金短線，最後才淡入
function underline(f, x) {
  const L = blockLayout(x), r = E.io(seg(x.t, 1.2 + L.n * .4, 3 + L.n * .4)), uy = L.y0 + (L.n - 1) * L.gap + (L.two ? 116 : 80);
  if (r > .004) f.add(rect(960 - 90, uy - 2, 960 + 90, uy + 2, NV.gold, .85 * r));
}

defineScene({
  id: 'nave', name: '光柱',
  description: '深藍到墨綠的底，高窗落下幾道平塗光柱，慢慢淡入淡出。適合敬拜、安靜的歌。',
  palette: NV, labels: { bg: '上方深藍', green: '下方墨綠', win: '窗', light: '光', gold: '暖金' },
  look: { grain: .035, vignette: .14 },
  textures: [{ type: 'grain', on: 'bg,shapes', amount: .035 }],
  elements: {
    ground: { label: '底色漸層', fixed: true, colors: ['bg', 'green'], draw: ground },
    windows: { label: '高窗', colors: ['win', 'bg'], draw: windows },
    glow: { label: '中間的寬光', colors: ['gold'], draw: glow },
    beams: { label: '光柱', colors: ['light', 'gold'], draw: beams },
    shaft: { label: '關鍵字上的光', colors: ['gold'], draw: shaft },
    chars: { label: '歌詞', colors: ['light', 'gold'], draw: chars },
    subline: { label: '第二語言', colors: ['light'], draw: subline },
    goldline: { label: '金線', colors: ['gold'], draw: goldline },
    lyrics: { label: '歌詞', colors: ['light'], draw: lyrics },
    underline: { label: '金線', colors: ['gold'], draw: underline },
  },
  backgrounds: {
    calm: { label: '平靜', jumpBeats: 8, use: ['ground', { el: 'windows', rose: 0 }, { el: 'beams', every: 4, a: .12, sets: [[[0, 40]], [[3, 34], [1, 22]], [[1, 44]], [[2, 30], [0, 22]]] }] },
    build: { label: '累積', jumpBeats: 4, use: ['ground', { el: 'windows', rose: .7 }, { el: 'beams', every: 2, a: .13, sets: [[[0, 60], [1, 34], [3, 40]], [[1, 70], [2, 46], [0, 26]], [[0, 50], [2, 60], [3, 30]], [[1, 56], [3, 64], [2, 24]]] }] },
    peak: { label: '高潮', jumpBeats: 4, use: ['ground', { el: 'windows', rose: 1 }, 'glow', { el: 'beams', every: 2, a: .15,
      sets: [[[0, 96], [1, 60, 'g'], [2, 70], [3, 50, 'g']], [[0, 70, 'g'], [1, 100], [2, 56, 'g'], [3, 84]], [[0, 84], [1, 70], [2, 96, 'g'], [3, 60]], [[0, 60, 'g'], [1, 90], [2, 80], [3, 96, 'g']]] }] },
  },
  subtitles: {
    flashy: { label: '華麗（克制）', split: 'line', seconds: 7, use: [{ el: 'under', bg: 'build' }, 'shaft', 'chars', 'subline', 'goldline'] },
    gentle: { label: '收斂', split: 'block', seconds: 16, use: [{ el: 'under', bg: 'calm' }, 'lyrics', 'underline'] },
  },
});
