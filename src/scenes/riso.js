/* 網點印刷（Risograph）：米色紙、螢光粉／藍／黃／青油墨，疊印、網點、套色錯位；背景由一個個元素疊起來 */
const RS = { bg: '#d6cab0', pink: '#e2536e', blue: '#3b5ca8', yel: '#e9b23c', teal: '#2c8a86', ink: '#2f2b35', paper: '#e2d6bd' };
const ink = s => Object.assign(s, { blend: 'multiply' });
const flat = { tex: false };

const CALM_A = [[230, 900], [1700, 180], [260, 160], [1680, 880], [150, 560], [1760, 540], [420, 980], [1500, 110]];
const CALM_B = [[460, 980], [1500, 300], [430, 330], [1480, 1000], [330, 760], [1580, 360], [640, 1060], [1320, 240]];
const BUILD_A = [[180, 180], [1740, 900], [1700, 170], [200, 880], [140, 540], [1780, 560], [400, 120], [1520, 980]];

// 大圓：疊印在角落的大圓，跟著換位跳位置（pair＝藍、粉紅兩個；否則一個藍圓）
function discs(f, x, e) {
  const tt = mod(x.t, 16), size = e.p.size;
  if (e.args.pair) {
    const b = pulse(tt, 3, BAR), A = x.step(CALM_A, 2, tt), B = x.step(CALM_B, 2, tt);
    f.add(ink(circle(A[0], A[1], 330 * (1 + .03 * b) * size, RS.blue, .5)));
    f.add(ink(circle(B[0], B[1], 230 * size, RS.pink)));
  } else {
    const b = pulse(tt, 5), A = x.step(BUILD_A, 1, tt);
    f.add(ink(circle(A[0], A[1], 210 * (1 + .06 * b) * size, RS.blue)));
  }
}
// 橫條：黃色長條，每 4 秒換一個邊
function bar(f, x) {
  const Y = x.step([[1240, 70, 1860, 120], [60, 960, 700, 1010], [1300, 980, 1880, 1030], [80, 60, 760, 110]], 4, mod(x.t, 16));
  f.add(ink(rect(...Y, RS.yel)));
}
// 圓環：青色圓環，待在藍色大圓的對角
function ring(f, x) {
  const A = x.step(CALM_A, 2, mod(x.t, 16));
  f.add(ink(arc(W - A[0], H - A[1], 120, 14, 0, 7, RS.teal)));
}
// 網點漸層：同一個墨色，濃度一格一格變（list 每一項＝位置、寬高、格數、墨色、是否直排）
function ramp(f, x, e) {
  for (const [rx, ry, w, h, n, col, vertical] of e.args.list)
    for (let i = 0; i < n; i++) {
      const a = .12 + .88 * i / (n - 1);
      f.add(ink(vertical ? rect(rx, ry + i * h / n, rx + w, ry + (i + 1) * h / n, RS[col], a) : rect(rx + i * w / n, ry, rx + (i + 1) * w / n, ry + h, RS[col], a)));
    }
}
// 套準記號：印刷品角落的十字圓圈（at＝每個記號的位置）
function marks(f, x, e) {
  const s = 26;
  for (const [mx, my] of e.args.at)
    f.add(arc(mx, my, s * .55, 2.5, 0, 7, RS.ink, .75, flat), rect(mx - s, my - 1.2, mx + s, my + 1.2, RS.ink, .75, flat), rect(mx - 1.2, my - s, mx + 1.2, my + s, RS.ink, .75, flat));
}
// 色票條：四色、濃度不同（半透明＝網點），每拍滿版一格
function swatches(f, x, e) {
  const [sx, sy] = e.args.at, cols = [RS.pink, RS.blue, RS.yel, RS.teal], k = Math.floor(mod(x.t, 16) / BEAT) % 8;
  for (let i = 0; i < 8; i++) f.add(ink(rect(sx + i * 34, sy, sx + i * 34 + 26, sy + 26, cols[i % 4], i === k ? 1 : .3 + .08 * (i % 4))));
}
// 斜條紋：斜向網點條紋往右推，中間留給歌詞
function stripes(f, x) {
  const off = mod(mod(x.t, 16) * 60, 120);
  for (let i = -2; i < 18; i++) {
    const cx = i * 120 + off;
    if (cx > 420 && cx < 1500) continue;
    f.add(ink(band(cx, 540, 1400, 46, 70, i % 3 ? RS.teal : RS.pink, .38)));
  }
}
// 三角形：黃色三角形，每 1 秒跳位置、換角度
function tri3(f, x) {
  const T = x.step([[1650, 300, 0], [260, 760, Math.PI], [1500, 900, .5], [320, 260, -.4]], 1, mod(x.t, 16));
  f.add(ink(tri(T[0], T[1], 150, T[2], RS.yel)));
}
// 進度條：底部一條細線，每小節從頭長一次
function progress(f, x) {
  f.add(ink(rect(96, 1050, 96 + 520 * mod(mod(x.t, 16), BAR) / BAR, 1060, RS.ink)));
}
// 光芒：從底部太陽放射的網點光芒，慢慢轉
function rays(f, x) {
  const tt = mod(x.t, 16), SX = 960, SY = 1180, N = 16, rot = (TAU / N) * tt / 16;
  for (let i = 0; i < N; i++) {
    const a = Math.PI + (i + .5) * Math.PI / N + rot;
    if (Math.sin(a) > -.05) continue;
    const deg = a * 180 / Math.PI, up = mod(deg, 360); if (up > 252 && up < 288) continue;
    f.add(ink(band(SX + Math.cos(a) * 900, SY + Math.sin(a) * 900, 1100, 70, deg, i % 2 ? RS.blue : RS.pink, .42)));
  }
}
// 太陽：底部的黃色大圓、疊印的粉紅圓、青色弧線
function sun(f, x, e) {
  const b = pulse(mod(x.t, 16), 5), SX = 960, SY = 1180, size = e.p.size;
  f.add(ink(circle(SX, SY, 420 * (1 + .02 * b) * size, RS.yel)));
  f.add(ink(circle(SX + 160 * size, SY - 60 * size, 300 * size, RS.pink, .55)));
  f.add(ink(arc(SX, SY, 480 * size, 10, Math.PI + .2, Math.PI - .4, RS.teal)));
}
// 小圓：上方的青色圓，每 2 秒跳位置
function dot(f, x) {
  const K = x.step([[230, 200], [1690, 200], [300, 260], [1620, 240]], 2, mod(x.t, 16));
  f.add(ink(circle(K[0], K[1], 110, RS.teal)));
}
// 華麗字幕的排法：每個字一格、依序蓋上去，關鍵字放大
function stampCells(x) {
  const t = x.t, { chars, kw } = x, n = chars.length, size = Math.min(190, 1500 / n), x0 = 960 - size * (n - 1) / 2, cells = [];
  chars.forEach((ch, i) => {
    const ti = .15 + i * .1, si = seg(t, ti, ti + .18); if (si <= 0) return;
    const isK = i === kw, bounce = t > ti + .6 ? pulse(t, 7, BEAT, i * BEAT / n) : 0;
    cells.push({ ch, i, isK, size, sc: lerp(1.35, 1, E.out(si)) * (isK ? 1.3 : 1) * (1 + .05 * bounce), px: x0 + i * size, py: 520 - 8 * bounce });
  });
  return cells;
}
// 印章色塊：每個字後面一塊歪歪的色塊，關鍵字是粉紅
function stamps(f, x) {
  const cols = [RS.blue, RS.teal, RS.yel];
  for (const c of stampCells(x)) f.add(ink(band(c.px + 10, c.py + 12, c.size * .92 * c.sc, c.size * .92 * c.sc, (hash(c.i * 3.1) - .5) * 14, c.isK ? RS.pink : cols[c.i % 3], c.isK ? .9 : .5)));
}
// 歌詞（華麗）：每個字像蓋印章，一格一格印上去
function chars(f, x) {
  for (const c of stampCells(x)) f.text(c.ch, c.px, c.py, { px: 132, weight: 900, scale: c.sc, col: RS.ink, blend: 'multiply' });
}
// 第二語言：一小條青色橫線，下面一行小字
function subline(f, x) {
  const sub = x.small[0]; if (!sub) return;
  const n = x.chars.length, SM = { px: 60, weight: 700, spacing: 2 }, a = E.io(seg(x.t, .3 + n * .1, .7 + n * .1));
  f.add(ink(rect(960 - 70 * a, 676, 960 + 70 * a, 684, RS.teal, a)));
  f.text(sub, 960, 736 + (1 - a) * 10, { ...SM, scale: f.fit(sub, 1300, SM), col: RS.ink, a: .72 * a, blend: 'multiply' });
}
// 開場掃屏：一道粉紅色斜帶從右掃到左
function wipe(f, x) {
  const w = seg(x.t, 0, .4);
  if (w < 1) f.top(ink(band(lerp(W + 800, -800, E.io(w)), 540, 1100, 1500, 8, RS.pink, .6)));
}
// 收斂字幕的排法：最多三行置中；有第二語言時每行下面多一行小字，底條跟著加高
function blockLayout(x) {
  const two = x.small.length > 0, big = x.big.slice(0, 3), small = two ? x.small.slice(0, 3) : [], n = two ? Math.max(big.length, small.length) : big.length;
  const gap = two ? 154 : 130, y0 = 500 - gap * (n - 1) / 2;
  return { two, big, small, n, gap, y0, top: y0 - 90, bot: y0 + (n - 1) * gap + (two ? 128 : 100) };
}
// 紙色底條：托住歌詞的紙色橫條，上緣藍線、下緣粉紅線
function plate(f, x) {
  const { top, bot } = blockLayout(x);
  f.add(rect(0, top, W, bot, RS.paper, 1, flat), ink(rect(0, top - 8, W, top, RS.blue)), ink(rect(0, bot, W, bot + 8, RS.pink)));
}
// 歌詞（收斂）：逐行淡入的粗字，後面一層粉紅色的錯位影；第二語言是每行下面的小字
function lyrics(f, x) {
  const t = x.t, L = blockLayout(x), TX = { px: 84, weight: 900, spacing: 8 }, SM = { px: 40, weight: 700, spacing: 3 };
  for (let i = 0; i < L.n; i++) {
    const s = seg(t, i * .1, .5 + i * .1), a = E.io(s), y = L.y0 + i * L.gap + (1 - E.out(s)) * 12, l = L.big[i];
    if (l && !L.two) { f.text(l, 964, y + 5, { ...TX, col: RS.pink, a: .55 * a, blend: 'multiply' }); f.text(l, 960, y, { ...TX, col: RS.ink, a, blend: 'multiply' }); }
    if (l && L.two) { const sc = f.fit(l, 1680, TX);
      f.text(l, 964, y + 5, { ...TX, scale: sc, col: RS.pink, a: .55 * a, blend: 'multiply' });
      f.text(l, 960, y, { ...TX, scale: sc, col: RS.ink, a, blend: 'multiply' }); }
    if (L.small[i]) f.text(L.small[i], 960, y + 62, { ...SM, scale: f.fit(L.small[i], 1600, SM), col: RS.ink, a: .62 * a, blend: 'multiply' });
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
  elements: {
    discs: { label: '大圓', colors: ['blue', 'pink'], params: { size: { value: 1, min: .5, max: 1.5, label: '大小' } }, draw: discs },
    bar: { label: '橫條', colors: ['yel'], draw: bar },
    ring: { label: '圓環', colors: ['teal'], draw: ring },
    ramp: { label: '網點漸層', colors: ['teal', 'pink', 'blue'], draw: ramp },
    marks: { label: '套準記號', colors: ['ink'], draw: marks },
    swatches: { label: '色票條', colors: ['pink', 'blue', 'yel', 'teal'], draw: swatches },
    stripes: { label: '斜條紋', colors: ['teal', 'pink'], draw: stripes },
    tri: { label: '三角形', colors: ['yel'], draw: tri3 },
    progress: { label: '進度條', colors: ['ink'], draw: progress },
    rays: { label: '光芒', colors: ['blue', 'pink'], draw: rays },
    sun: { label: '太陽', colors: ['yel', 'pink', 'teal'], params: { size: { value: 1, min: .5, max: 1.5, label: '大小' } }, draw: sun },
    dot: { label: '小圓', colors: ['teal'], draw: dot },
    stamps: { label: '印章色塊', colors: ['pink', 'blue', 'teal', 'yel'], draw: stamps },
    chars: { label: '歌詞', colors: ['ink'], draw: chars },
    subline: { label: '第二語言', colors: ['teal', 'ink'], draw: subline },
    wipe: { label: '開場掃屏', fixed: true, colors: ['pink'], draw: wipe },
    plate: { label: '紙色底條', colors: ['blue', 'pink'], draw: plate },
    lyrics: { label: '歌詞', colors: ['pink', 'ink'], draw: lyrics },
  },
  backgrounds: {
    calm: { label: '平靜', jumpBeats: 4, use: [{ el: 'discs', pair: true }, 'bar', 'ring', { el: 'ramp', list: [[1620, 860, 220, 34, 6, 'teal']] }, { el: 'marks', at: [[90, 90], [1830, 990]] }, { el: 'swatches', at: [96, 1000] }] },
    build: { label: '累積', jumpBeats: 2, use: ['stripes', 'discs', 'tri', { el: 'ramp', list: [[60, 380, 40, 320, 6, 'pink', true], [1820, 380, 40, 320, 6, 'blue', true]] }, 'progress', { el: 'marks', at: [[90, 90], [1830, 90], [1830, 990]] }, { el: 'swatches', at: [1520, 1000] }] },
    peak: { label: '高潮', jumpBeats: 4, use: ['rays', 'sun', 'dot', { el: 'marks', at: [[90, 90], [1830, 90]] }, { el: 'swatches', at: [96, 60] }] },
  },
  subtitles: {
    flashy: { label: '華麗', split: 'line', seconds: 6, use: [{ el: 'under', bg: 'build' }, 'stamps', 'chars', 'subline', 'wipe'] },
    gentle: { label: '收斂', split: 'block', seconds: 16, use: [{ el: 'under', bg: 'peak' }, 'plate', 'lyrics'] },
  },
});
