/* 墨染：暖色宣紙、墨、一個赭色；墨慢慢暈開、淡去，停在原地；中間 x 420–1500、y 260–820 留給歌詞；背景與字幕由一個個元素疊起來 */
const INK = { bg: '#e0d4bc', ink: '#2f2c28', wash: '#6f695e', warm: '#bd7a50', seal: '#9e4f2e', shade: '#cdbfa3' };

// 呼吸：ph 0→1 一輪；慢慢淡入、淡去。0 和 1 都是 0，頭尾接得起來
const breath = ph => { const s = Math.sin(Math.PI * mod(ph, 1)); return s * s; };
// 一團墨：主圓＋兩個小瓣（往畫面外側長），g＝暈開的範圍；seed 讓每團的毛邊不同。疊印（multiply）像墨在紙上疊
function blot(f, cx, cy, r, col, a, seed, g = 1) {
  if (a <= .004 || r * g < 2) return;
  const R = r * g, d = Math.atan2(cy - 540, cx - 960);
  f.add(circle(cx, cy, R * .82, col, a, { blend: 'multiply', seed }));
  for (let i = 0; i < 6; i++) {
    const an = d + (hash(seed * 7 + i) - .5) * 3.4, off = R * (.35 + .4 * hash(seed * 3 + i)), rr = R * (.28 + .34 * hash(seed * 5 + i));
    f.add(circle(cx + off * Math.cos(an), cy + off * Math.sin(an), rr, col, a * (.45 + .4 * hash(seed + i * 11)), { blend: 'multiply', seed: seed * 10 + i }));
  }
}
// 紙影：左上、右下兩片很淡的紙色陰影
function shade(f) {
  f.add(circle(-40, -60, 300, INK.shade, .45, { seed: 21 }), circle(1980, 1140, 320, INK.shade, .4, { seed: 22 }));
}
// 墨團：角落幾團墨輪流暈開、淡去（list 每一項＝位置、半徑、墨色、濃度、ph 錯開、laps 16 秒呼吸幾次）
function blots(f, x, e) {
  const t = mod(x.t, LOOP);
  for (const s of e.args.list) {
    const p = mod(t * (s.laps || 1) / LOOP + (s.ph || 0), 1);
    blot(f, s.x, s.y, s.r, INK[s.col], s.a * breath(p), s.seed || 1, lerp(s.g0 ?? .7, 1, E.out(p)));
  }
}
// 印章：赭紅小方印，每「色塊換位」換一個角落，在每一格裡淡入、停住、淡去
function seal(f, x, e) {
  const t = mod(x.t, LOOP), { size, a } = e.args, list = [[1790, 930], [130, 150], [1790, 380], [130, 720]];
  const j = x.jt(t) / 2, k = Math.floor(j), fr = j - k, v = list[mod(k, list.length)];
  const al = a * E.io(seg(fr, 0, .35)) * (1 - E.io(seg(fr, .7, 1)));
  if (al > .004) f.add(rect(v[0] - size / 2, v[1] - size / 2, v[0] + size / 2, v[1] + size / 2, INK.seal, al, { blend: 'multiply', rough: 3, seed: k % 7 + 1 }));
}
// 遠山：幾個大圓沉在畫面下緣，只露出上緣，像淡墨的山（layers 每一層＝山的清單、墨色、濃度、ph 錯開）
function hills(f, x, e) {
  const t = mod(x.t, LOOP);
  for (const [list, col, a, ph = 0] of e.args.layers) list.forEach(([cx, top, r], i) => {
    const p = mod(t / LOOP + ph + i * .13, 1), al = a * (.55 + .45 * breath(p));
    f.add(circle(cx, top + r, r, INK[col], al, { blend: 'multiply', seed: 11 + i }));
  });
}
// 飛白：一筆由七條細線組成，整筆淡入淡出（strokes 每一筆＝起點、長度、濃度、ph 錯開、seed）
function brush(f, x, e) {
  const t = mod(x.t, LOOP);
  for (const [x0, y, len, amt, ph, seed] of e.args.strokes) {
    const a = amt * breath(t / LOOP + ph);
    if (a <= .004) continue;
    for (let i = 0; i < 7; i++) {
      const yy = y + (i - 3) * 5, l0 = x0 + hash(seed + i) * 40, l1 = x0 + len * (.7 + .3 * hash(seed * 3 + i));
      f.line(l0, yy, l1, yy + (hash(seed + i * 7) - .5) * 6, 3 + 2 * hash(i + seed), INK.ink, a * (.35 + .5 * hash(seed + i * 3)), { blend: 'multiply', rough: 2, seed: seed + i });
    }
  }
}
// 上緣暖墨：高潮時畫面上緣一排溫暖的大墨團，慢慢呼吸
function canopy(f, x) {
  const t = mod(x.t, LOOP);
  [[180, -230, 430], [700, -300, 470], [1240, -290, 470], [1760, -220, 430]].forEach(([cx, cy, r], i) =>
    blot(f, cx, cy, r, INK.warm, .5 + .2 * breath(t / LOOP + i * .27), 40 + i, lerp(.88, 1, breath(t / LOOP + i * .27))));
}

// 華麗字幕的排法：一行字置中，逐字慢慢淡入；有標 [關鍵字] 時它加粗、赭紅、最後才出來
const hasMark = x => /\[.+?\]/.test(x.swap ? x.text2 : x.text);
const ROW = { style: { px: 100, weight: 500 }, kwStyle: { px: 100, weight: 900 } };
function rowLayout(f, x) {
  const chars = x.chars, n = chars.length, sub = x.small[0] || '', cy = sub ? 500 : 540, kw = hasMark(x) ? x.kw : -1;
  const ws = chars.map((c, i) => f.measure(c, i === kw ? ROW.kwStyle : ROW.style).tw);
  const total = ws.reduce((a, b) => a + b, 0) + 6 * Math.max(0, n - 1), sc = Math.min(1, 1500 / Math.max(1, total));
  return { chars, n, sub, cy, kw, ws, total, sc, end: .3 + n * .08 + 1.3 };
}
// 暖墨：關鍵字背後一團暖墨慢慢暈開
function halo(f, x) {
  const L = rowLayout(f, x), { kw, ws, sc } = L, kt = .3 + L.n * .08 + .35;
  if (kw < 0 || !L.n) return;
  const total = ws.reduce((a, b) => a + b, 0) + 6 * (ws.length - 1), sc2 = Math.min(1, 1500 / Math.max(1, total));
  const kx = 960 - total * sc2 / 2 + (ws.slice(0, kw).reduce((a, b) => a + b, 0) + 6 * kw + ws[kw] / 2) * sc2, g = E.out(seg(x.t, kt, kt + 3));
  blot(f, kx, L.cy + 6, 74 * sc2, INK.warm, .2 * E.io(seg(x.t, kt, kt + 1.6)), 61, lerp(.5, 1, g));
}
// 歌詞（華麗）：一行字逐字慢慢淡入
function chars(f, x) {
  const L = rowLayout(f, x); let cx = 960 - L.total * L.sc / 2;
  L.chars.forEach((c, i) => {
    const w = L.ws[i] * L.sc, isK = i === L.kw, ti = isK ? .3 + L.n * .08 + .35 : .3 + i * .08, a = E.io(seg(x.t, ti, ti + (isK ? 1.8 : 1.3)));
    if (a > .003) f.text(c, cx + w / 2, L.cy, { ...(isK ? ROW.kwStyle : ROW.style), scale: L.sc, col: isK ? INK.seal : INK.ink, a });
    cx += w + 6 * L.sc;
  });
}
// 第二語言：歌詞下面一行小字，等歌詞出完才淡入
function subline(f, x) {
  const L = rowLayout(f, x), SM = { px: 44, weight: 500, spacing: 3 };
  if (L.sub) f.text(L.sub, 960, L.cy + 96, { ...SM, scale: f.fit(L.sub, 1440, SM), col: INK.ink, a: .62 * E.io(seg(x.t, L.end, L.end + 1.5)) });
}
// 一筆暖色的短筆觸（兩道疊在一起）
function brushMark(f, cx, y, len, a) {
  if (a <= .004) return;
  f.add(band(cx, y, len, 9, -1.5, INK.warm, a, { blend: 'multiply', rough: 3, seed: 51 }), band(cx + 18, y + 7, len * .7, 4, -1, INK.warm, a * .6, { blend: 'multiply', rough: 2, seed: 52 }));
}
// 筆觸（華麗）：歌詞下面一筆暖色短筆觸，最後才淡入
function mark(f, x) {
  const L = rowLayout(f, x);
  brushMark(f, 960, L.cy + (L.sub ? 150 : 92), 160, .7 * E.io(seg(x.t, L.end + .4, L.end + 2.2)));
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
    if (L.big[i]) f.text(L.big[i], 960, y, { ...TX, scale: f.fit(L.big[i], 1500, TX), col: INK.ink, a });
    if (L.small[i]) f.text(L.small[i], 960, y + 60, { ...SM, scale: f.fit(L.small[i], 1440, SM), col: INK.ink, a: .6 * E.io(seg(t, .7 + i * .4, 2.2 + i * .4)) });
  }
}
// 筆觸（收斂）：歌詞下面一筆暖色短筆觸，最後才淡入
function stroke(f, x) {
  const L = blockLayout(x), r = E.io(seg(x.t, 1.2 + L.n * .4, 3 + L.n * .4));
  brushMark(f, 960, L.y0 + (L.n - 1) * L.gap + (L.two ? 116 : 80), 200, .7 * r);
}

const CALM = [
  { x: 150, y: 960, r: 190, col: 'wash', a: .3, ph: 0, seed: 1 },
  { x: 250, y: 1030, r: 120, col: 'ink', a: .5, ph: .5, seed: 2 },
  { x: 1780, y: 120, r: 150, col: 'wash', a: .26, ph: .25, seed: 3 },
  { x: 1700, y: 70, r: 80, col: 'ink', a: .42, ph: .75, seed: 4 },
  { x: 1620, y: 990, r: 60, col: 'warm', a: .45, ph: .4, seed: 5 },
];
const BUILD = [
  { x: 1840, y: 560, r: 150, col: 'wash', a: .28, ph: .1, seed: 6 },
  { x: 90, y: 330, r: 130, col: 'wash', a: .3, ph: .6, seed: 7 },
  { x: 60, y: 260, r: 70, col: 'ink', a: .45, ph: .35, seed: 8 },
  { x: 1560, y: 120, r: 70, col: 'warm', a: .4, ph: .85, seed: 9, laps: 2 },
];
const PEAK = [
  { x: -60, y: 540, r: 270, col: 'ink', a: .42, ph: 0, seed: 12 }, { x: 1980, y: 520, r: 270, col: 'ink', a: .42, ph: .5, seed: 13 },
  { x: 70, y: 220, r: 110, col: 'warm', a: .5, ph: .25, seed: 14 }, { x: 1850, y: 860, r: 110, col: 'warm', a: .5, ph: .75, seed: 15 },
];
const CALM_USE = ['shade', { el: 'blots', list: CALM }, { el: 'seal', size: 44, a: .75 }];

defineScene({
  id: 'ink', name: '墨染',
  description: '暖色宣紙上，墨慢慢暈開、淡去、再暈開，像呼吸。適合敬拜、安靜的歌。',
  palette: INK, labels: { bg: '紙色', ink: '墨色', wash: '淡墨', warm: '暖色', seal: '印泥', shade: '紙影' },
  look: { grain: .02, vignette: .1, paper: .06 },
  textures: [
    { type: 'bleed', on: 'shapes,lines', amount: 24 },
    { type: 'fiber', on: 'bg,shapes', amount: .07 },
  ],
  elements: {
    shade: { label: '紙影', colors: ['shade'], draw: shade },
    blots: { label: '墨團', colors: ['wash', 'ink', 'warm'], draw: blots },
    seal: { label: '印章', colors: ['seal'], draw: seal },
    hills: { label: '遠山', colors: ['wash', 'ink', 'warm'], draw: hills },
    moreBlots: { label: '更多墨團', colors: ['wash', 'ink', 'warm'], draw: blots },
    brush: { label: '飛白', colors: ['ink'], draw: brush },
    canopy: { label: '上緣暖墨', colors: ['warm'], draw: canopy },
    halo: { label: '暖墨', colors: ['warm'], draw: halo },
    chars: { label: '歌詞', colors: ['ink', 'seal'], draw: chars },
    subline: { label: '第二語言', colors: ['ink'], draw: subline },
    mark: { label: '筆觸', colors: ['warm'], draw: mark },
    lyrics: { label: '歌詞', colors: ['ink'], draw: lyrics },
    stroke: { label: '筆觸', colors: ['warm'], draw: stroke },
  },
  backgrounds: {
    calm: { label: '平靜', jumpBeats: 8, use: CALM_USE },
    build: { label: '累積', jumpBeats: 4, use: [...CALM_USE, { el: 'hills', layers: [[[[260, 900, 380], [720, 945, 420], [1240, 935, 440], [1700, 905, 380]], 'wash', .2], [[[480, 975, 360], [1460, 980, 380]], 'ink', .16, .5]] },
      { el: 'moreBlots', list: BUILD }, { el: 'brush', strokes: [[1560, 230, 300, .55, .3, 3], [120, 860, 260, .5, .8, 9]] }] },
    peak: { label: '高潮', jumpBeats: 4, use: ['canopy', { el: 'hills', layers: [[[[150, 870, 330], [560, 930, 520], [1080, 905, 380], [1420, 940, 560], [1820, 875, 320]], 'warm', .4], [[[330, 975, 300], [1560, 985, 330], [960, 1010, 260]], 'ink', .2, .5]] },
      { el: 'blots', list: PEAK }, { el: 'seal', size: 52, a: .85 }, { el: 'brush', strokes: [[1500, 210, 330, .6, .2, 5]] }] },
  },
  subtitles: {
    flashy: { label: '華麗（克制）', split: 'line', seconds: 7, use: [{ el: 'under', bg: 'build' }, 'halo', 'chars', 'subline', 'mark'] },
    gentle: { label: '收斂', split: 'block', seconds: 16, use: [{ el: 'under', bg: 'calm' }, 'lyrics', 'stroke'] },
  },
});
