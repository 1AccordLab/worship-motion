/* 剪紙拼貼：暖棕底、番茄紅、芥黃、奶油、粉；手撕邊、紙影、紙纖維。會換位置的東西用跳的；背景與字幕由一張張紙疊起來 */
const PC = { bg: '#3b2a22', red: '#d9472c', yel: '#e2a63b', crm: '#efe1c4', pnk: '#e9a08a', brn: '#5a3d2e', deep: '#2f211b', strip: '#47322a' };
// 紙：rough 手撕邊、shadow 紙影、fiber 纖維（引擎內建的形狀屬性）
const paper = (s, seed = 0, { rough = 7, shadow = 1, fiber = .1 } = {}) => Object.assign(s, { rough, seed: seed * 3.17 + 1, shadow, fiber });
const strip = (cx, cy, w, h, deg, col, a = 1) => band(cx, cy, w, h, deg, col, a);
const slot = (x, t, period) => Math.floor(mod(x.jt(t), LOOP) / period);
const EDGE = [[60, 380, 60, 1040], [1540, 1860, 60, 1040], [380, 1540, 50, 220]];

// 角落紙張：左上、右下各一張大紙，慢慢左右晃
function sheets(f, x) {
  const d = 6 * Math.sin(TAU * x.t / LOOP);
  f.add(paper(band(120 + d, 60, 700, 260, -8, PC.brn), 90, { rough: 12 }));
  f.add(paper(band(1830 - d, 1000, 620, 240, -14, PC.deep), 91, { rough: 12, shadow: .6 }));
}
// 紙條：一黃一粉兩條紙條，每 2 秒換一個角度
function strips(f, x) {
  const k = slot(x, x.t, 2);
  f.add(paper(strip(300, 170, 520, 30, -10 + hash(k * 2.1) * 20, PC.yel), 70 + k, { rough: 5 }));
  f.add(paper(strip(1640, 880, 460, 26, 10 + hash(k * 5.3) * 20, PC.pnk), 80 + k, { rough: 5 }));
}
// 圓點弧：日出外圍一圈小圓點，慢慢轉
function dots(f, x) {
  const n = 24, rot = TAU / n * (x.t / LOOP);
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / n) * TAU + rot;
    if (Math.sin(a) > .05) continue;
    f.add(paper(circle(960 + 800 * Math.cos(a), 1280 + 800 * Math.sin(a), 13, i % 2 ? PC.crm : PC.yel), 200 + i, { rough: 3, shadow: .6 }));
  }
}
// 日出紙層：從下方一圈圈往上的紙圓，慢慢呼吸（radii＝每層半徑、cols＝每層顏色、kick＝跟拍脹大多少）
function sunrise(f, x, e) {
  const t = x.t, { cy, radii, cols, kick = 0 } = e.args;
  radii.forEach((r, i) => {
    const rr = r + 10 * Math.sin(TAU * t / LOOP + i * .9) + kick * pulse(t, 5, BEAT * 2) * (radii.length - i);
    f.add(paper(circle(960, cy, rr, PC[cols[i % cols.length]]), 50 + i, { rough: 10 }));
  });
}
// 小紙片：邊緣的圓點貼紙、小紙條、小方塊，跳到新位置後只輕輕呼吸（count＝幾片、every＝幾秒跳一次）
function confetti(f, x, e) {
  const t = x.t, { every, seed, scale = 1 } = e.args, count = e.sub === 'line' && e.args.countLine ? e.args.countLine : e.args.count;
  const k = slot(x, t, every), cols = [PC.red, PC.yel, PC.crm, PC.pnk, PC.brn];
  for (let i = 0; i < count; i++) {
    const h = j => hash(k * 31.7 + i * 13.3 + seed * 7.1 + j * 3.9), zone = EDGE[i % 3];
    const px = lerp(zone[0], zone[1], h(1)), py = lerp(zone[2], zone[3], h(2)) + 4 * Math.sin(TAU * t / 4 + i);
    const col = cols[Math.floor(h(3) * cols.length)], kind = Math.floor(h(4) * 3);
    const sz = (18 + h(5) * 34) * scale * (1 + .06 * pulse(t, 6, BEAT * 2, i * .25));
    const s = kind === 0 ? circle(px, py, sz, col) : kind === 1 ? strip(px, py, sz * 5, sz * .55, h(6) * 180, col) : band(px, py, sz * 1.6, sz * 1.6, h(6) * 90, col);
    f.add(paper(s, i + k * 10 + seed, { rough: 5 }));
  }
}
// 紙條光芒：從底部太陽放射的四色紙條，慢慢轉、跟拍輕輕伸縮
function rays(f, x) {
  const t = x.t, RAYS = 40, RW = TAU / RAYS, cols = [PC.red, PC.yel, PC.crm, PC.pnk], rot = RW * 4 * (t / LOOP);
  for (let i = 0; i < RAYS; i++) {
    const a0 = i * RW + rot, mid = mod(a0 + RW * .3, TAU);
    if (mid < Math.PI * .95 || mid > Math.PI * 2.05) continue;
    const kick = 1 + .02 * pulse(t, 5, BEAT * 2, (i % 4) * BEAT * .5);
    f.add(paper(wedge(960, 1150, 1500 * kick, a0, RW * .62, cols[i % 4], .92), 300 + i, { rough: 9, shadow: .7 }));
  }
}
// 太陽：底部的黃色紙圓，裡面一個米白紙圓，跟拍脹大
function sun(f, x) {
  const b = pulse(x.t, 5, BEAT * 2);
  f.add(paper(circle(960, 1150, 330 + 10 * b, PC.yel), 400, { rough: 10 }));
  f.add(paper(circle(960, 1150, 255 + 6 * b, PC.crm), 401, { rough: 10 }));
}
// 深色紙條：橫過畫面中間的深色寬紙條，給歌詞當底
function belt(f) {
  f.add(paper(band(960, 540, 1500, 330, -1.2, PC.strip), 500, { rough: 12, shadow: 1, fiber: .08 }));
}

// 華麗字幕的排法：每個字一張貼紙排成一列，啪地貼上後跟拍輕跳，關鍵字大一點、紅色
function stickerCells(x) {
  const t = x.t, { chars, kw } = x, n = chars.length, size = n > 7 ? 150 : 176, gap = 26, x0 = 960 - (n * size + (n - 1) * gap) / 2 + size / 2, cy = 470;
  const tagCols = [PC.crm, PC.pnk, PC.yel, PC.crm, PC.pnk, PC.crm, PC.yel], cells = [];
  chars.forEach((ch, i) => {
    const ti = .38 + i * .12, si = seg(t, ti, ti + .24); if (si <= 0) return;
    const isK = i === kw, rot0 = (hash(i * 9.1 + n) - .5) * 16 * Math.PI / 180;
    const bounce = t > ti + .5 ? pulse(t, 7, BEAT, i * BEAT / n) : 0;
    const sc = lerp(1.7, 1, E.back(si)) * (1 + .07 * bounce) * (isK ? 1.22 : 1);
    const rot = rot0 + (1 - E.out(si)) * .35 * (i % 2 ? 1 : -1);
    const tag = isK ? PC.red : tagCols[i % tagCols.length];
    cells.push({ ch, i, size, sc, rot, tag, ink: tag === PC.red ? PC.crm : tag === PC.crm ? PC.red : PC.bg, px: x0 + i * (size + gap), py: cy + (isK ? -14 : 0) - 10 * bounce });
  });
  return { n, size, cy, cells };
}
// 貼紙：每個字底下一張歪歪的色紙
function stickers(f, x) {
  for (const c of stickerCells(x).cells) f.add(paper(band(c.px, c.py, c.size * c.sc, c.size * 1.1 * c.sc, c.rot * 180 / Math.PI, c.tag), 600 + c.i, { rough: 6, shadow: 1.2 }));
}
// 歌詞（華麗）：貼紙上的字，跟著貼紙一起歪、一起跳
function chars(f, x) {
  for (const c of stickerCells(x).cells) f.text(c.ch, c.px, c.py + 6 * c.sc, { px: 128, weight: 900, scale: c.sc * (c.size / 176), rot: c.rot, col: c.ink });
}
// 第二語言：一張深色小紙條，上面一行小字
function subline(f, x) {
  const sub = x.small[0]; if (!sub) return;
  const { n, size, cy } = stickerCells(x), SM = { px: 58, weight: 600, spacing: 2 }, a = E.io(seg(x.t, .5 + n * .12, .9 + n * .12)), sc = f.fit(sub, 1400, SM), tw = f.measure(sub, SM).tw * sc;
  const sy = cy + size * .62 + 92;
  f.add(paper(band(960, sy, (tw + 90) * (.6 + .4 * a), 86, -1, PC.deep, a), 650, { rough: 6, shadow: .8 }));
  f.text(sub, 960, sy + 2, { ...SM, scale: sc, col: PC.crm, a: .8 * a });
}
// 開場掃屏：一張紅色大紙和一條黃色紙條先後從右掃到左
function wipe(f, x) {
  const w = seg(x.t, 0, .42), w2 = seg(x.t, .06, .5);
  if (w < 1) f.top(paper(band(lerp(W + 700, -800, E.io(w)), 540, 1300, 1500, -6, PC.red), 700, { rough: 16, shadow: 1 }));
  if (w2 < 1) f.top(paper(band(lerp(W + 400, -500, E.io(w2)), 540, 110, 1500, -6, PC.yel), 701, { rough: 10, shadow: 1 }));
}
// 收斂字幕的排法：最多三行置中；有第二語言時每行下面多一行小字
function blockLayout(x) {
  const two = x.small.length > 0, big = x.big.slice(0, 3), small = two ? x.small.slice(0, 3) : [], n = two ? Math.max(big.length, small.length) : big.length;
  const gap = two ? (n > 2 ? 146 : 156) : (n > 2 ? 104 : 124), y0 = (two ? 512 : 532) - gap * (n - 1) / 2;
  return { two, big, small, n, gap, y0, top: y0 - 80, bot: y0 + (n - 1) * gap + 128, under: y0 + (n - 1) * gap + (two ? 104 : 70) };
}
// 加高的紙條：雙語行數多、中間的深色紙條不夠高時，再墊一張更高的
function tallBelt(f, x) {
  const { two, top, bot } = blockLayout(x);
  if (two && bot - top > 320) f.add(paper(band(960, (top + bot) / 2, 1540, bot - top + 24, -1.2, PC.strip), 501, { rough: 12, shadow: 1, fiber: .08 }));
}
// 歌詞（收斂）：逐行淡入的字，後面一層深色字影；第二語言是每行下面的小字
function lyrics(f, x) {
  const t = x.t, L = blockLayout(x), TX = { px: 84, weight: 700, spacing: 10, blur: 10 }, SM = { px: 38, weight: 500, spacing: 3 };
  for (let i = 0; i < L.n; i++) {
    const s = seg(t, i * .1, .5 + i * .1), a = E.io(s), y = L.y0 + i * L.gap + (1 - E.out(s)) * 14, l = L.big[i];
    if (l && !L.two) { f.text(l, 960, y + 4, { ...TX, shadow: true, col: PC.deep, a: .55 * a }); f.text(l, 960, y, { ...TX, col: PC.crm, a }); }
    if (l && L.two) { const sc = f.fit(l, 1400, TX);
      f.text(l, 960, y + 4, { ...TX, scale: sc, shadow: true, col: PC.deep, a: .55 * a });
      f.text(l, 960, y, { ...TX, scale: sc, col: PC.crm, a }); }
    if (L.small[i]) f.text(L.small[i], 960, y + 60, { ...SM, scale: f.fit(L.small[i], 1380, SM), col: PC.crm, a: .6 * a });
  }
}
// 底線：歌詞下面一小條黃色紙條，慢慢長出來
function underline(f, x) {
  const r = E.out(seg(x.t, .2, .8));
  if (r > .01) f.add(paper(band(960, blockLayout(x).under, 240 * r, 12, -1.5, PC.yel), 800, { rough: 4, shadow: .6 }));
}

defineScene({
  id: 'paper', name: '剪紙拼貼',
  description: '溫暖手作、紙片有影子，像手作卡片。',
  palette: PC, labels: { bg: '底色', red: '紅', yel: '黃', crm: '米白', pnk: '粉' },
  elements: {
    sheets: { label: '角落紙張', draw: sheets },
    strips: { label: '紙條', colors: ['yel', 'pnk'], draw: strips },
    dots: { label: '圓點弧', colors: ['crm', 'yel'], draw: dots },
    sunrise: { label: '日出紙層', colors: ['red', 'yel', 'crm', 'pnk'], draw: sunrise },
    confetti: { label: '小紙片', colors: ['red', 'yel', 'crm', 'pnk'], draw: confetti },
    rays: { label: '紙條光芒', colors: ['red', 'yel', 'crm', 'pnk'], draw: rays },
    sun: { label: '太陽', colors: ['yel', 'crm'], draw: sun },
    belt: { label: '深色紙條', draw: belt },
    stickers: { label: '貼紙', colors: ['red', 'yel', 'crm', 'pnk'], draw: stickers },
    chars: { label: '歌詞', colors: ['crm', 'red', 'bg'], draw: chars },
    subline: { label: '第二語言', colors: ['crm'], draw: subline },
    wipe: { label: '開場掃屏', fixed: true, colors: ['red', 'yel'], draw: wipe },
    tallBelt: { label: '加高的紙條', draw: tallBelt },
    lyrics: { label: '歌詞', colors: ['crm'], draw: lyrics },
    underline: { label: '底線', colors: ['yel'], draw: underline },
  },
  backgrounds: {
    calm: { label: '平靜', jumpBeats: 4, use: ['sheets', 'strips', { el: 'sunrise', cy: 1370, radii: [630, 540, 455, 375], cols: ['brn', 'red', 'yel', 'crm'] }, { el: 'confetti', count: 12, every: 2, seed: 1 }] },
    build: { label: '累積', jumpBeats: 2, use: ['sheets', 'dots', { el: 'sunrise', cy: 1280, radii: [720, 630, 545, 465, 390], cols: ['brn', 'pnk', 'red', 'yel', 'crm'], kick: 5 }, { el: 'confetti', count: 14, countLine: 10, every: 1, seed: 2 }] },
    peak: { label: '高潮', jumpBeats: 4, use: ['rays', 'sun', { el: 'confetti', count: 10, every: 1, seed: 3, scale: .9 }, 'belt'] },
  },
  subtitles: {
    flashy: { label: '華麗', split: 'line', seconds: 6, use: [{ el: 'under', bg: 'build' }, 'stickers', 'chars', 'subline', 'wipe'] },
    gentle: { label: '收斂', split: 'block', seconds: 16, use: [{ el: 'under', bg: 'peak' }, 'tallBelt', 'lyrics', 'underline'] },
  },
});
