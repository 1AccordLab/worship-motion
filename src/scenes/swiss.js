/* 瑞士網格：12 欄 × 6 列網格、炭灰底、朱橘與米白。120 BPM 寫法，16 秒（32 拍）頭尾相接；背景與字幕由一個個元素疊起來 */
const SW = { bg: '#2b2a27', org: '#e8582b', crm: '#ece2cf', dim: '#3a3934', dim2: '#45433d', ink: '#141311' };
const CW = 160, RH = 180;
const G = (x0, y0, x1, y1, col, a = 1) => rect(x0 * CW, y0 * RH, x1 * CW, y1 * RH, col, a);
// 累積背景墊在逐句字幕底下時只留圓弧、閃光、進度條、節拍格，時間直接用字幕的時間
const underLine = e => !!e.args.thin && e.sub === 'line';
const timeOf = (x, e) => underLine(e) ? x.t : mod(x.t, 16);

// 網格：底下的 12 × 6 網格線，跟著拍子微微閃；逐句字幕開場時多閃一下
function grid(f, x, e) {
  const t = timeOf(x, e), { alpha, flash, sharp, every } = e.args;
  f.grid.alpha = alpha; f.grid.flash = flash * pulse(t, sharp, every);
  if (e.sub === 'line') f.grid.flash += .16 * (1 - seg(x.t, 0, .6));
}
// 暗色塊：最底層的暗色方塊，跟著換位跳格
function block(f, x, e) {
  if (!underLine(e)) f.add(G(...x.step(e.args.list, e.args.every, mod(x.t, 16)), SW.dim));
}
// 圓弧：角落的同心圓弧，圓心在畫面角落，只看得到四分之一圈，在可見範圍內來回擺
function rings(f, x, e) {
  const t = timeOf(x, e), [cx, cy] = e.args.at;
  for (const r of e.args.list) {
    const a0 = r.center - r.sweep / 2 + r.swing * Math.sin(TAU * r.laps * t / 16 + (r.ph || 0));
    const sw = r.sweep * (1 + (r.breath || 0) * Math.sin(TAU * t / 16 * (r.bl || 1)));
    f.add(arc(cx, cy, r.r, r.w * (1 + (r.kick || 0) * pulse(t, 6)), a0, sw, SW[r.col], r.a ?? 1));
  }
}
// 色塊：朱橘與米白的方塊，跟著換位跳格（post＝中間多一根朱橘直柱）
function blocks(f, x, e) {
  if (underLine(e)) return;
  const tt = mod(x.t, 16), { a, b, every, post } = e.args;
  f.add(G(...x.step(a, every, tt), SW.org));
  if (post) f.add(rect(9 * CW - 5, 0, 9 * CW + 5, H, SW.org));
  f.add(G(...x.step(b, every, tt), SW.crm));
}
// 橫線：左下一條米白橫線，每 2 秒換一個長度
function rule(f, x) {
  f.add(rect(CW, 5 * RH - 3, CW + x.step([2, 3, 1, 2.5, 1.5, 3, 2, 1], 2, mod(x.t, 16)) * CW, 5 * RH + 3, SW.crm));
}
// 掃描線：一條細直線從左掃到右
function scan(f, x, e) {
  if (underLine(e)) return;
  const sx = W * mod(mod(x.t, 16), e.args.every) / e.args.every;
  f.add(rect(sx - 1, 0, sx + 1, H, SW.crm, e.args.a));
}
// 交點閃光：每拍隨機幾個網格交點亮起再暗掉（avoid＝留給歌詞的格子範圍）
function lights(f, x, e) {
  const t = timeOf(x, e), { count, seed } = e.args, avoid = underLine(e) ? e.args.avoidLine : e.args.avoid, cols = [SW.crm, SW.org];
  const b = mod(Math.floor(t / BEAT), Math.round(16 / BEAT)), life = mod(t, BEAT) / BEAT;
  for (let j = 0; j < count; j++) {
    const gx = 1 + Math.floor(hash(b * 13.1 + j * 7.7 + seed) * 11), gy = 1 + Math.floor(hash(b * 3.3 + j * 19.1 + seed) * 5);
    if (gx >= avoid[0] && gx <= avoid[2] && gy >= avoid[1] && gy <= avoid[3]) continue;
    const s = 7 * (1 + .6 * (1 - life));
    f.add(rect(gx * CW - s, gy * RH - s, gx * CW + s, gy * RH + s, cols[j % cols.length], Math.pow(1 - life, 1.5)));
  }
}
// 進度條：左下一條朱橘細線，每小節從頭長一次
function progress(f, x, e) {
  f.add(rect(CW, 5.5 * RH + 18, CW + 384 * mod(timeOf(x, e), BAR) / BAR, 5.5 * RH + 22, SW.org));
}
// 節拍格：一排小方塊，每拍亮下一格
function sequencer(f, x, e) {
  const t = timeOf(x, e), { at, n, size = 16, gap = 8 } = e.args, k = Math.floor(t / BEAT) % n, p = pulse(t, 4);
  for (let i = 0; i < n; i++) {
    const xx = at[0] + i * (size + gap), prev = i === (k + n - 1) % n;
    f.add(rect(xx, at[1], xx + size, at[1] + size, i === k ? SW.org : (prev ? SW.crm : SW.dim2), i === k ? 1 : (prev ? .25 * p + .1 : 1)));
  }
}
// 高潮的斜向構圖：所有斜帶都沿著同一個角度，整組慢慢左右漂
const ANG = -24, RAD = ANG * Math.PI / 180, DIR = [Math.cos(RAD), Math.sin(RAD)], NRM = [-Math.sin(RAD), Math.cos(RAD)];
const slant = (off, wid, col, a = 1, s0 = -1600, s1 = 1600) => {
  const al = (s0 + s1) / 2; return band(1010 + NRM[0] * off + DIR[0] * al, 880 + NRM[1] * off + DIR[1] * al, Math.max(0, s1 - s0), wid, ANG, col, a);
};
const driftOf = x => 34 * Math.sin(mod(x.t, 16) / 16 * TAU);
// 暗色斜帶：最底層的寬斜帶
function darkband(f, x) {
  f.add(slant(-600 + driftOf(x) * .5, 240, SW.dim));
}
// 速度線：九條細斜線一直往外推，越遠越淡
function speed(f, x) {
  const tt = mod(x.t, 16), drift = driftOf(x), SP = 70, travel = mod(tt / 16 * SP * 16, SP);
  for (let i = 0; i < 9; i++) {
    const off = 200 + i * SP + travel;
    f.add(slant(off + drift, i % 3 === 0 ? 6 : 3, i % 4 === 1 ? SW.org : SW.crm, .65 * (1 - (off - 200) / (9 * SP))));
  }
}
// 斜帶：朱橘粗斜帶跟拍變寬，旁邊一條米白細帶
function slash(f, x) {
  const beat = pulse(mod(x.t, 16), 5), drift = driftOf(x);
  f.add(slant(drift, 132 + 30 * beat, SW.org), slant(158 + drift + 10 * beat, 12, SW.crm, .92));
}
// 劃線：每 4 秒一條米白細線沿著斜帶劃過去再收掉
function streak(f, x) {
  const p = mod(mod(x.t, 16), 4), grow = E.out5(seg(p, 0, .45)), shrink = E.io(seg(p, 2.2, 2.7));
  if (grow > 0 && shrink < 1) f.add(slant(-140 + driftOf(x), 5, SW.crm, .8, -1600 + 3200 * shrink, -1600 + 3200 * grow));
}

// 華麗字幕的排法：關鍵字放大在左，其他字排成右邊一直欄；有第二語言時直欄短一點
function columnLayout(x) {
  const n = x.chars.length, sub = x.small[0] || '', span = sub ? 520 : 640, cy = sub ? 470 : 540;
  const step = n > 1 ? Math.min(sub ? 100 : 112, span / (n - 1)) : 0;
  return { n, sub, step, y0: cy - step * (n - 1) / 2 };
}
// 關鍵字：巨大的關鍵字從左邊落下，後面跟拍晃動的殘影
function keyword(f, x) {
  const t = x.t, kwCh = x.chars[x.kw], BIG = { px: 1150, weight: 900 };
  const s = seg(t, .1, .55), sc = lerp(1.5, 1, E.out5(s)) * (1 + (t > .6 ? .025 * pulse(t, 6) : 0));
  const kx = lerp(300, 470, E.out5(s)) + 16 * Math.sin(Math.max(0, t - .6) * .9);
  if (t > .6) {
    const side = Math.floor(t / BEAT) % 2 ? 1 : -1, p = pulse(t, 4);
    f.text(kwCh, kx + side * 46 * (1 + p), 650, { ...BIG, col: SW.dim2, a: .9 });
    f.text(kwCh, kx - side * 22 * p, 650 - 14 * p, { ...BIG, col: SW.crm, a: .22 * p });
  }
  f.text(kwCh, kx, 650, { ...BIG, scale: sc, col: SW.org, a: E.out(seg(t, .1, .25)) });
}
// 直線：直欄左邊一條米白細線，由上往下長出來
function rail(f, x) {
  const rl = E.out5(seg(x.t, .3, .7));
  if (rl > 0) f.add(rect(1118, 180, 1122, 180 + (columnLayout(x).sub ? 560 : 720) * rl, SW.crm));
}
// 歌詞（華麗）：直欄逐字跳出，關鍵字往右移一格、朱橘色
function chars(f, x) {
  const t = x.t, L = columnLayout(x);
  x.chars.forEach((ch, i) => {
    const ti = .4 + i * .08, si = seg(t, ti, ti + .22); if (si <= 0) return;
    const isK = i === x.kw, xx = isK ? lerp(1250, 1460, E.out5(seg(t, ti + .15, ti + .5))) : 1250;
    const kick = t > 1.2 ? .1 * pulse(t, 7, BEAT, i * BEAT / L.n) : 0;
    f.text(ch, xx, L.y0 + i * L.step + (1 - E.out(si)) * 46, { px: 98, weight: 900, scale: lerp(.3, 1, E.back(si)) * (1 + kick), col: isK ? SW.org : SW.crm });
  });
}
// 第二語言：右下一小條朱橘橫線，下面一行靠右的小字
function subline(f, x) {
  const { n, sub } = columnLayout(x); if (!sub) return;
  const SM = { px: 44, weight: 500, spacing: 2 }, a = E.io(seg(x.t, .5 + n * .08, .9 + n * .08)), sc = f.fit(sub, 700, SM);
  f.add(rect(1800 - 120 * a, 776, 1800, 780, SW.org, a));
  f.text(sub, 1800, 820 + (1 - a) * 10, { ...SM, scale: sc, align: 'right', col: SW.crm, a: .7 * a });
}
// 開場掃屏：朱橘寬帶和米白細帶先後從右掃到左
function wipe(f, x) {
  const w = seg(x.t, 0, .42), w2 = seg(x.t, .08, .5);
  if (w < 1) { const x0 = lerp(W, -1300, E.io(w)); f.top(rect(x0, 0, x0 + 1100, H, SW.org)); }
  if (w2 < 1) { const x1 = lerp(W + 200, -400, E.io(w2)); f.top(rect(x1, 0, x1 + 60, H, SW.crm)); }
}
// 收斂字幕的排法：最多三行置中；有第二語言時每行下面多一行小字，底條跟著加高
function blockLayout(x) {
  const two = x.small.length > 0, big = x.big.slice(0, 3), small = two ? x.small.slice(0, 3) : [], n = two ? Math.max(big.length, small.length) : big.length;
  const gap = two ? 158 : 132, y0 = (two ? 510 : 515) - gap * (n - 1) / 2;
  return { two, big, small, n, gap, y0, top: y0 - 92, bot: y0 + (n - 1) * gap + (two ? 136 : 104), under: y0 + (n - 1) * gap + (two ? 112 : 72) };
}
// 深色底條：托住歌詞的深色橫條，上下各一條米白細線
function plate(f, x) {
  const { top, bot } = blockLayout(x);
  f.add(rect(0, top, W, bot, SW.bg, .94), rect(0, top - 3, W, top, SW.crm, .5), rect(0, bot, W, bot + 3, SW.crm, .5));
}
// 歌詞（收斂）：逐行淡入的字，後面一層深色字影；第二語言是每行下面的小字
function lyrics(f, x) {
  const t = x.t, L = blockLayout(x), TX = { px: 86, weight: 700, spacing: 10, blur: 12 }, SM = { px: 40, weight: 500, spacing: 3 };
  for (let i = 0; i < L.n; i++) {
    const s = seg(t, i * .1, .5 + i * .1), a = E.io(s), y = L.y0 + i * L.gap + (1 - E.out(s)) * 14, l = L.big[i];
    if (l && !L.two) { f.text(l, 960, y + 5, { ...TX, shadow: true, col: SW.ink, a: .6 * a }); f.text(l, 960, y, { ...TX, col: SW.crm, a }); }
    if (l && L.two) { const sc = f.fit(l, 1680, TX);
      f.text(l, 960, y + 5, { ...TX, scale: sc, shadow: true, col: SW.ink, a: .6 * a });
      f.text(l, 960, y, { ...TX, scale: sc, col: SW.crm, a }); }
    if (L.small[i]) f.text(L.small[i], 960, y + 64, { ...SM, scale: f.fit(L.small[i], 1600, SM), col: SW.crm, a: .62 * a });
  }
}
// 底線：歌詞下面一條朱橘短線，跟拍微微伸縮
function underline(f, x) {
  const r = E.out(seg(x.t, .2, .8)), uw = 300 * r * (1 + .06 * pulse(x.t, 3)), uy = blockLayout(x).under;
  if (uw > 1) f.add(rect(960 - uw / 2, uy - 2.5, 960 + uw / 2, uy + 2.5, SW.org));
}

const RINGS_CALM = [
  { r: 300, w: 3, sweep: .9, laps: 2, swing: .45, ph: 0, center: 5.5, col: 'crm', a: .7 },
  { r: 360, w: 16, sweep: .6, laps: 3, swing: .5, ph: 2, center: 5.5, col: 'org', kick: .5 },
  { r: 430, w: 3, sweep: 1.0, laps: 4, swing: .3, ph: 4, center: 5.5, col: 'crm', a: .45, breath: .3 },
  { r: 500, w: 2, sweep: 1.3, laps: 1, swing: .2, ph: 1, center: 5.5, col: 'crm', a: .3 },
];
const RINGS_BUILD = [
  { r: 260, w: 4, sweep: 1.0, laps: 4, swing: .45, ph: 0, center: .785, col: 'crm', a: .75 },
  { r: 330, w: 20, sweep: .6, laps: 8, swing: .5, ph: 1.5, center: .785, col: 'org', kick: .6 },
  { r: 410, w: 3, sweep: 1.1, laps: 6, swing: .35, ph: 3, center: .785, col: 'crm', a: .5, breath: .4, bl: 2 },
  { r: 480, w: 10, sweep: .45, laps: 8, swing: .55, ph: 4.5, center: .785, col: 'dim2' },
  { r: 560, w: 2, sweep: 1.2, laps: 4, swing: .25, ph: 2, center: .785, col: 'crm', a: .35 },
];
const RINGS_PEAK = [
  { r: 300, w: 3, sweep: 1.0, laps: 4, swing: .45, ph: 0, center: 2.356, col: 'crm', a: .6 },
  { r: 380, w: 18, sweep: .7, laps: 8, swing: .5, ph: 2, center: 2.356, col: 'org', kick: .6 },
  { r: 460, w: 3, sweep: 1.0, laps: 6, swing: .35, ph: 4, center: 2.356, col: 'crm', a: .4, breath: .4 },
  { r: 540, w: 30, sweep: .5, laps: 4, swing: .5, ph: 1, center: 2.356, col: 'dim2' },
];
const CALM_ORG = [[9, 0, 11, 2], [10, 0, 12, 3], [10, 4, 12, 6], [11, 1, 12, 5], [9, 4, 11, 6], [10, 0, 11, 4], [11, 3, 12, 6], [9, 1, 10, 3]];
const CALM_CRM = [[11, 2, 12, 3], [9, 5, 10, 6], [11, 0, 12, 1], [10, 5, 11, 6], [11, 0, 12, 1], [11, 4, 12, 5], [9, 0, 10, 1], [10, 3, 11, 4]];
const CALM_DIM = [[0, 4, 2, 6], [0, 3, 1, 6], [0, 5, 3, 6], [1, 4, 2, 6], [0, 4, 3, 5], [0, 2, 1, 5], [0, 5, 2, 6], [1, 3, 2, 5]];
const BUILD_ORG = [[0, 0, 2, 2], [0, 0, 1, 6], [10, 0, 12, 2], [11, 0, 12, 6], [10, 4, 12, 6], [0, 4, 2, 6], [0, 0, 3, 1], [9, 5, 12, 6]];
const BUILD_CRM = [[11, 5, 12, 6], [2, 0, 3, 1], [0, 5, 1, 6], [9, 0, 10, 1], [2, 5, 3, 6], [11, 0, 12, 1], [4, 5, 5, 6], [0, 2, 1, 3]];
const BUILD_DIM = [[9, 4, 12, 6], [3, 5, 6, 6], [0, 0, 2, 3], [8, 0, 11, 1], [0, 3, 1, 6], [6, 5, 9, 6], [10, 2, 12, 4], [1, 0, 4, 1]];

defineScene({
  id: 'swiss', name: '瑞士網格',
  description: '俐落色塊、跟著節拍跳格，像設計展海報。',
  palette: SW, labels: { bg: '底色', org: '主色', crm: '亮色', dim: '暗色塊' },
  elements: {
    grid: { label: '網格', fixed: true, draw: grid },
    block: { label: '暗色塊', colors: ['dim'], draw: block },
    darkband: { label: '暗色斜帶', colors: ['dim'], draw: darkband },
    rings: { label: '圓弧', colors: ['crm', 'org'], draw: rings },
    blocks: { label: '色塊', colors: ['org', 'crm'], draw: blocks },
    rule: { label: '橫線', colors: ['crm'], draw: rule },
    scan: { label: '掃描線', colors: ['crm'], draw: scan },
    lights: { label: '交點閃光', colors: ['crm', 'org'], draw: lights },
    progress: { label: '進度條', colors: ['org'], draw: progress },
    sequencer: { label: '節拍格', colors: ['org', 'crm'], draw: sequencer },
    speed: { label: '速度線', colors: ['org', 'crm'], draw: speed },
    slash: { label: '斜帶', colors: ['org', 'crm'], draw: slash },
    streak: { label: '劃線', colors: ['crm'], draw: streak },
    keyword: { label: '關鍵字', colors: ['org', 'crm'], draw: keyword },
    rail: { label: '直線', colors: ['crm'], draw: rail },
    chars: { label: '歌詞', colors: ['org', 'crm'], draw: chars },
    subline: { label: '第二語言', colors: ['org', 'crm'], draw: subline },
    wipe: { label: '開場掃屏', fixed: true, colors: ['org', 'crm'], draw: wipe },
    plate: { label: '深色底條', colors: ['bg', 'crm'], draw: plate },
    lyrics: { label: '歌詞', colors: ['crm'], draw: lyrics },
    underline: { label: '底線', colors: ['org'], draw: underline },
  },
  backgrounds: {
    calm: { label: '平靜', jumpBeats: 4, use: [{ el: 'grid', alpha: .09, flash: .05, sharp: 4, every: BAR }, { el: 'block', list: CALM_DIM, every: 2 }, { el: 'rings', at: [0, H], list: RINGS_CALM },
      { el: 'blocks', a: CALM_ORG, b: CALM_CRM, every: 2 }, 'rule', { el: 'scan', every: BAR, a: .14 }, { el: 'lights', count: 4, seed: 1, avoid: [3, 2, 9, 4] }, { el: 'sequencer', at: [CW, 5.5 * RH - 8], n: 8 }] },
    build: { label: '累積', jumpBeats: 2, use: [{ el: 'grid', alpha: .1, flash: .07, sharp: 5, thin: true }, { el: 'block', list: BUILD_DIM, every: 1, thin: true }, { el: 'rings', at: [0, 0], list: RINGS_BUILD, thin: true },
      { el: 'lights', count: 8, seed: 7, avoid: [3, 2, 9, 4], avoidLine: [6, 0, 11, 6], thin: true }, { el: 'progress', thin: true }, { el: 'sequencer', at: [CW, 5.5 * RH - 8], n: 16, thin: true },
      { el: 'blocks', a: BUILD_ORG, b: BUILD_CRM, every: 1, post: true, thin: true }, { el: 'scan', every: BEAT * 2, a: .18, thin: true }] },
    peak: { label: '高潮', jumpBeats: 4, use: [{ el: 'grid', alpha: .09, flash: .06, sharp: 5 }, 'darkband', { el: 'rings', at: [W, 0], list: RINGS_PEAK }, 'speed', 'slash', 'streak',
      { el: 'lights', count: 6, seed: 3, avoid: [2, 2, 10, 4] }, { el: 'sequencer', at: [CW, RH * .5 + 56], n: 16, size: 12, gap: 6 }] },
  },
  subtitles: {
    flashy: { label: '華麗', split: 'line', seconds: 6, use: [{ el: 'under', bg: 'build' }, 'keyword', 'rail', 'chars', 'subline', 'wipe'] },
    gentle: { label: '收斂', split: 'block', seconds: 16, use: [{ el: 'under', bg: 'peak' }, 'plate', 'lyrics', 'underline'] },
  },
});
