/* 油彩：整個畫面由 3D 世界裡的油畫筆觸構成；漩渦夜空、金色滿月、星芒、三層山、麥田小徑、柏樹、亮窗小村，鏡頭緩慢推移 */
const OIL = { bg: '#16213f', deep: '#1b2c63', sky: '#2f57a0', swirl: '#6f9ccf', teal: '#2c7d86', moon: '#e9b143', star: '#efd27a', far: '#5a6f9a', snow: '#c4cfe2', hill: '#2c3d63', wheat: '#b08a3a', meadow: '#3b6366', road: '#b9a479', tree: '#22392f', wall: '#8790ad', lamp: '#eca54a', text: '#efe6d2' };
const NIGHT = [.07, .09, .17], MOONLIT = [.55, .63, .8];
const hexA = h => color(h).slice(0, 3);
const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, s = u * u * (3 - 2 * u), q = v * v * (3 - 2 * v), h = (a, b) => hash(a * 157.1 + b * 311.7);
  return lerp(lerp(h(i, j), h(i + 1, j), s), lerp(h(i, j + 1), h(i + 1, j + 1), s), q); };
const fbm = (x, y) => vn(x, y) * .6 + vn(x * 2.1, y * 2.1) * .3 + vn(x * 4.3, y * 4.3) * .1;
const BASE = [0, 3.4, 14], FOCAL = 1160, PX = 18;
// 一個「依距離調大小」的尺寸：遠處的筆觸在世界裡比較大，畫面上看起來差不多大
const sizeAt = (p, k = 1) => Math.hypot(p[0] - BASE[0], p[1] - BASE[1], p[2] - BASE[2]) * PX / FOCAL * k;
let rk = 0;
const rnd = () => hash(++rk * .7311 + .123);
// 月光下的顏色：亮部偏藍、暗部沉進夜色
const lit = (h, k = .32) => [mix3(hexA(h), MOONLIT, k), mix3(hexA(h), NIGHT, .62)];
const ground = (x, z) => 1.1 * Math.sin(x * .05 + z * .03) + .7 * Math.sin(x * .11 - z * .07) + .35 * fbm(x * .08, z * .08) - .4;
const groundN = (x, z) => v3.norm([ground(x - .5, z) - ground(x + .5, z), 1, ground(x, z - .5) - ground(x, z + .5)]);
const roadX = z => 6 * Math.sin(z * .035) - z * .3;
const MOON = { az: 31, el: 18, d: 560, r: 28 };
const STARS = [[-58, 30], [-44, 44], [-31, 21], [-15, 37], [-3, 25], [10, 44], [48, 38], [56, 22], [64, 42], [-64, 17], [13, 17], [-22, 52], [40, 54], [-48, 15]];
const VORT = [[-22, 33, 15, 1], [6, 40, 11, -1], [-48, 30, 10, 1], [52, 40, 9, -1]];
const dirAt = (az, el) => { const a = az * Math.PI / 180, e = el * Math.PI / 180; return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)]; };
const skyPt = (az, el, d = 600) => v3.add(BASE, v3.mul(dirAt(az, el), d));
// 天空的氣流：往右的風加上幾個漩渦
function flow(az, el) {
  let u = 1, v = .3 * Math.sin(az * .07 + el * .12);
  for (const [cx, cy, r, s] of VORT) { const dx = az - cx, dy = el - cy, d = Math.hypot(dx, dy), k = Math.exp(-((d / r) ** 2)) * 3.2 * s; u += -dy / Math.max(d, .5) * k; v += dx / Math.max(d, .5) * k; }
  const l = Math.hypot(u, v); return [u / l, v / l];
}
function skyStroke(w, az, el, col, o = {}) {
  const at = skyPt(az, el), [u, v] = flow(az, el), a2 = skyPt(az + u * .4, el + v * .4), dir = v3.sub(a2, at), n = v3.norm(v3.sub(BASE, at));
  w.stroke(at, dir, n, sizeAt(at, o.k || 1), sizeAt(at, (o.k || 1) * .3), col, col, { lit: 1, fog: 0, jitter: .07, flow: o.flow, brush: o.brush });
}
// 夜空：底層靜止的深藍，上層順著氣流慢慢流動的鈷藍、群青、青綠與亮藍
function sky(w, P) {
  const deep = hexA(P.deep), sk = hexA(P.sky), sw = hexA(P.swirl), te = hexA(P.teal);
  for (let i = 0; i < 26000; i++) { const az = -80 + rnd() * 160, el = -2 + Math.pow(rnd(), .8) * 70; skyStroke(w, az, el, mix3(deep, sk, rnd() * .45), { k: 1.6 }); }
  for (let i = 0; i < 36000; i++) {
    const az = -80 + rnd() * 160, el = 2 + Math.pow(rnd(), .85) * 66, sw2 = VORT.reduce((m, [cx, cy, r]) => Math.max(m, Math.exp(-((az - cx) ** 2 + (el - cy) ** 2) / (r * r * 1.6))), 0);
    const calm = Math.exp(-((az / 34) ** 2) - (((el - 14) / 13) ** 2)) * .65;
    const c = rnd() < sw2 * .9 * (1 - calm) ? mix3(sw, [.85, .88, .78], rnd() * .25) : rnd() < .3 * (1 - calm) ? te : mix3(sk, deep, rnd() * .5 + calm * .3);
    skyStroke(w, az, el, c, { flow: [sizeAt(skyPt(az, el), 4), 1 / LOOP] });
  }
}
// 滿月：金色圓盤加上一圈圈筆觸畫成的光環
function moon(w, P) {
  const c = skyPt(MOON.az, MOON.el, MOON.d), n = v3.norm(v3.sub(BASE, c)), ex = v3.norm(v3.cross([0, 1, 0], n)), ey = v3.cross(n, ex), m = hexA(P.moon);
  const ring = (r0, r1, cnt, col, k = .8) => { for (let i = 0; i < cnt; i++) { const a = rnd() * TAU, r = lerp(r0, r1, rnd()), p = v3.add(c, v3.add(v3.mul(ex, Math.cos(a) * r), v3.mul(ey, Math.sin(a) * r)));
    w.stroke(v3.add(p, v3.mul(n, 1 + r * .01)), v3.add(v3.mul(ex, -Math.sin(a)), v3.mul(ey, Math.cos(a))), n, sizeAt(p, k), sizeAt(p, k * .32), col(), col(), { lit: 1, fog: 0 }); } };
  const R = MOON.r;
  ring(0, R, 2600, () => mix3(m, [.97, .86, .55], rnd() * .6));
  ring(R * 1.15, R * 1.55, 2200, () => mix3([.92, .78, .42], [.82, .84, .6], rnd()));
  ring(R * 1.75, R * 2.2, 2400, () => mix3([.5, .62, .55], [.86, .8, .5], rnd() * .6));
  ring(R * 2.45, R * 2.9, 2400, () => mix3([.38, .55, .72], [.74, .74, .52], rnd() * .5));
}
// 星：小圓心、放射狀星芒和兩圈短筆觸
function stars(w, P) {
  const st = hexA(P.star);
  for (const [az, el] of STARS) {
    const c = skyPt(az, el, 590), n = v3.norm(v3.sub(BASE, c)), ex = v3.norm(v3.cross([0, 1, 0], n)), ey = v3.cross(n, ex), R = 8 + rnd() * 4;
    const put = (a, r, tang, k, col) => { const p = v3.add(c, v3.add(v3.mul(ex, Math.cos(a) * r), v3.mul(ey, Math.sin(a) * r)));
      const d = tang ? v3.add(v3.mul(ex, -Math.sin(a)), v3.mul(ey, Math.cos(a))) : v3.add(v3.mul(ex, Math.cos(a)), v3.mul(ey, Math.sin(a)));
      w.stroke(v3.add(p, v3.mul(n, 2)), d, n, sizeAt(p, k), sizeAt(p, k * .3), col, col, { lit: 1, fog: 0 }); };
    for (let i = 0; i < 220; i++) put(rnd() * TAU, Math.sqrt(rnd()) * R, true, .25, mix3(st, [.98, .95, .8], rnd() * .7));
    for (let i = 0; i < 40; i++) put(i / 40 * TAU + rnd() * .05, R * (1.15 + rnd() * .55), false, .55 + rnd() * .35, mix3(st, [.95, .9, .7], rnd() * .5));
    for (const [rr, col] of [[R * 2.2, [.86, .8, .48]], [R * 2.8, [.52, .66, .74]]]) for (let i = 0; i < 110; i++) put(rnd() * TAU, rr * (.96 + rnd() * .08), true, .32, col);
  }
}
const ridge = (x, base, amp, sd) => base + amp * (fbm(x * .012 + sd, sd) * 1.25 - .2) + amp * .35 * Math.sin(x * .021 + sd);
// 一層山：先用實心剪影墊底，再在山面上加筆觸；最遠一層山頂有雪
function range(w, P, z, base, amp, sd, light, cnt, snow) {
  const half = -z * 1.25, [lt, dk] = lit(light), sn = hexA(P.snow);
  for (let x = -half; x <= half; x += 5) {
    const h = ridge(x, base, amp, sd), at = [x, (h - 8) / 2, z], len = (h + 8) / 2;
    w.stroke(at, [0, 1, 0], [0, 0, 1], len, 3.2, mix3(dk, NIGHT, .25), null, { brush: 'flat', keep: 1, lit: 1 });
  }
  for (let i = 0; i < cnt; i++) {
    const x = -half + rnd() * half * 2, h = ridge(x, base, amp, sd), y = h - Math.pow(rnd(), 1.4) * (h + 6), s = (ridge(x + 2, base, amp, sd) - ridge(x - 2, base, amp, sd)) / 4;
    const at = [x, y, z + 1.5 + rnd()], n = v3.norm([-s, .5, .8]), dir = [1, s + (rnd() - .5) * .8, 0], isSnow = snow && y > h - 7 - rnd() * 3 && h > base + amp * .55;
    w.stroke(at, dir, n, sizeAt(at, 1.2), sizeAt(at, .4), isSnow ? sn : lt, isSnow ? mix3(sn, NIGHT, .45) : dk);
  }
}
// 地面：先鋪實心的暗色地面，再依區域畫小徑、麥田、草地的筆觸
function land(w, P) {
  const [rl, rd] = lit(P.road), [wl, wd] = lit(P.wheat, .42), [ml, md] = lit(P.meadow);
  for (let z = 16; z > -140; z -= 5) for (let x = -40 + z * 1.3; x < 40 - z * 1.3; x += 5) {
    const at = [x, ground(x, z) - .4, z], n = groundN(x, z);
    w.stroke(at, [0, 0, -1], n, 2.9, 2.9, mix3(md, ml, .25), null, { brush: 'flat', keep: 1, lit: 1 });
  }
  for (let i = 0; i < 90000; i++) {
    const r = 3 * Math.pow(140 / 3, rnd()), a = (rnd() - .5) * 2 * 1.15, x = BASE[0] + Math.sin(a) * r, z = BASE[2] - Math.cos(a) * r, y = ground(x, z), at = [x, y + .02, z];
    const n = v3.norm(v3.lerp(groundN(x, z), v3.norm(v3.sub(BASE, at)), .55));
    const onRoad = Math.abs(x - roadX(z)) < 1.4 + r * .012, wheat = fbm(x * .035 + 3, z * .035) > .5;
    if (onRoad) w.stroke(at, [roadX(z - 1) - roadX(z), 0, -1], n, sizeAt(at, .9), sizeAt(at, .32), rl, rd);
    else if (wheat) { const sway = Math.sin(x * .3 + z * .2) * .35; w.stroke([x, y + sizeAt(at, .6), z], [sway, 1, .15], v3.norm([0, .3, 1]), sizeAt(at, 1), sizeAt(at, .28), wl, wd); }
    else {
      const th = fbm(x * .02, z * .02) * 5 + Math.sin(z * .25) * .6, band = fbm(x * .05 + 9, z * .09), L = clamp01(.15 + .7 * band + (rnd() - .5) * .35);
      const c = rnd() < .18 ? mix3(ml, hexA(P.teal), .5) : rnd() < .12 ? mix3(md, hexA(P.deep), .5) : null;
      w.stroke(at, [Math.cos(th), 0, Math.sin(th)], n, sizeAt(at, 1.1), sizeAt(at, .34), c || ml, c || md, { lit: L, jitter: .1 });
    }
  }
}
// 柏樹：火焰形的深綠，筆觸沿著樹身扭著往上
function cypress(w, P, x0, z0, H, R) {
  const tc = hexA(P.tree), tl = mix3(tc, [.28, .4, .44], .45), td = mix3(tc, NIGHT, .7), y0 = ground(x0, z0), face = v3.norm([BASE[0] - x0, 0, BASE[2] - z0]);
  const radAt = u => R * Math.pow(1 - u, .65) * (.8 + .2 * Math.sin(u * 18 + x0));
  for (let k = 0; k < 30; k++) { const u = (k + .5) / 30; w.stroke([x0, y0 + u * H, z0], [0, 1, 0], face, H / 52, radAt(u) * .85, mix3(td, NIGHT, .3), null, { brush: 'flat', keep: 1, lit: 1 }); }
  for (let i = 0; i < Math.round(H * 650); i++) {
    const u = Math.pow(rnd(), .85), rad = radAt(u), ph = (rnd() - .5) * Math.PI * 1.1;
    const n = v3.norm([Math.sin(ph) * face[2] + face[0] * Math.cos(ph), .1, Math.cos(ph) * face[2] - Math.sin(ph) * face[0]]), at = [x0 + n[0] * rad, y0 + u * H, z0 + n[2] * rad];
    const L = clamp01(.2 + .45 * Math.max(0, Math.sin(ph * 1.3 + u * 7)) + (rnd() - .5) * .5), odd = rnd() < .08 ? mix3(tl, [.45, .5, .32], .6) : null;
    w.stroke(at, [.45 * Math.sin(u * 11 + ph * 2.5), 1, 0], n, sizeAt(at, 1), sizeAt(at, .3), odd || tl, odd || td, { lit: L, jitter: .12 });
  }
}
function box(w, c, sx, sy, sz, wall, roof, cnt) {
  const [wl, wd] = lit(wall), [rl, rd] = lit(roof);
  w.stroke([c[0], c[1] + sy / 2, c[2] + sz / 2], [0, 1, 0], [0, 0, 1], sy / 2, sx / 2, mix3(wd, NIGHT, .2), null, { brush: 'flat', keep: 1, lit: 1 });
  for (let i = 0; i < cnt; i++) {
    const face = rnd(), at = face < .7 ? [c[0] + (rnd() - .5) * sx, c[1] + rnd() * sy, c[2] + sz / 2 + .05] : [c[0] + (rnd() - .5) * sx, c[1] + sy + rnd() * sy * .35 * (1 - Math.abs(rnd() - .5) * 2), c[2] + (rnd() - .5) * sz];
    w.stroke(at, face < .7 ? [rnd() - .5, 1, 0] : [1, .25, 0], face < .7 ? [0, 0, 1] : [0, 1, .3], sizeAt(at, .8), sizeAt(at, .3), face < .7 ? wl : rl, face < .7 ? wd : rd);
  }
}
// 小村：幾間房子、一座教堂尖塔，窗戶亮著暖光
function village(w, P) {
  const cx = 34, cz = -82, L = hexA(P.lamp), houses = [[-10, 5, 4, 1], [-3, 6, 4.5, 3], [5, 4.5, 3.5, -2], [12, 6.5, 5, 2], [-17, 4, 3.5, -1], [19, 5, 4, 0]];
  const wins = [];
  for (const [dx, sx, sy, dz] of houses) { const x = cx + dx, z = cz + dz, y = ground(x, z); wins.push([x - sx * .2, y + sy * .45, z + 2.1], [x + sx * .22, y + sy * .5, z + 2.1]); }
  for (const p of wins) w.lamp(p, 7, P.lamp, .8);
  for (const [dx, sx, sy, dz] of houses) { const x = cx + dx, z = cz + dz; box(w, [x, ground(x, z), z], sx, sy, 4, P.wall, '#5a4a6a', 700); }
  const chx = cx + 1, chz = cz - 6, cy0 = ground(chx, chz);
  box(w, [chx, cy0, chz], 5, 7, 6, P.wall, '#4a3f62', 900);
  const [sl, sd] = lit('#4a5a86');
  for (let i = 0; i < 1400; i++) { const u = Math.pow(rnd(), .9), at = [chx + (rnd() - .5) * 2.2 * (1 - u), cy0 + 7 + u * 17, chz + 3.1]; w.stroke(at, [0, 1, 0], [0, 0, 1], sizeAt(at, .7), sizeAt(at, .22), sl, sd); }
  for (const p of wins) for (let i = 0; i < 40; i++) { const at = [p[0] + (rnd() - .5) * .9, p[1] + (rnd() - .5) * 1.1, p[2] + .05]; w.stroke(at, [0, 1, 0], [0, 0, 1], sizeAt(at, .45), sizeAt(at, .2), mix3(L, [.98, .86, .55], rnd() * .5), null, { lit: 1, fog: .3 }); }
}
function build(w, x) {
  rk = 0; const P = x.pal;
  w.moon(v3.sub(skyPt(MOON.az, MOON.el, MOON.d), BASE), '#cfd8ec', .4);
  sky(w, P); moon(w, P); stars(w, P);
  range(w, P, -280, 22, 34, 3.1, P.far, 9000, true);
  range(w, P, -200, 12, 22, 7.7, '#45588a', 10000, false);
  range(w, P, -140, 4, 15, 1.9, P.hill, 12000, false);
  land(w, P); village(w, P);
  cypress(w, P, -12, -12, 17, 2.8); cypress(w, P, -19, -28, 11, 2); cypress(w, P, 17, -40, 8, 1.6);
}
// 鏡頭：16 秒一圈、首尾接得起來的慢推移；平靜＝左右輕移、累積＝往前推近、高潮＝升高抬頭看天空
function camera(t, x) {
  const mode = x.kind === 'bg' ? x.type : x.bg || 'calm', p = TAU * mod(t, LOOP) / LOOP, e = (1 - Math.cos(p)) / 2;
  const cam = { fov: 52, fog: '#2a3a66', fogNear: 60, fogFar: 520, lod: 7 };
  if (mode === 'build') return { ...cam, eye: [.6 * Math.sin(p), 3.4 + .9 * e, 14 - 7 * e], at: [0, 11 + 1.5 * e, -120] };
  if (mode === 'peak') return { ...cam, eye: [0, 3.4 + 6 * e, 14 - 2 * e], at: [8 * e, 12 + 26 * e, -120] };
  return { ...cam, eye: [1.8 * Math.sin(p), 3.4 + .35 * Math.sin(2 * p), 14], at: [0, 11, -120] };
}
function night(f) { f.bg = OIL.bg; }
// 字幕：淺色字、逐行慢慢淡入；字下有陰影，壓在筆觸上也清楚
function gentle(f, x) {
  x.under(f, night);
  const t = x.t, big = x.big.slice(0, 3), small = x.small.slice(0, 3), n = Math.max(1, big.length, small.length), two = small.length > 0;
  const gap = two ? 150 : 124, y0 = 520 - gap * (n - 1) / 2, TX = { px: 82, weight: 600, spacing: 8 }, SM = { px: 38, weight: 500, spacing: 3 };
  for (let i = 0; i < n; i++) {
    const a = E.io(seg(t, .3 + i * .4, 1.8 + i * .4)), y = y0 + i * gap;
    if (big[i]) f.text(big[i], 960, y, { ...TX, scale: f.fit(big[i], 1500, TX), col: OIL.text, a, shadow: true });
    if (small[i]) f.text(small[i], 960, y + 60, { ...SM, scale: f.fit(small[i], 1440, SM), col: OIL.text, a: .75 * E.io(seg(t, .7 + i * .4, 2.2 + i * .4)), shadow: true });
  }
}
function flashy(f, x) {
  x.under(f, night);
  const t = x.t, big = x.big[0] || '', sub = x.small[0] || '', cy = sub ? 500 : 540, TX = { px: 96, weight: 600, spacing: 6 }, SM = { px: 42, weight: 500, spacing: 3 };
  if (big) f.text(big, 960, cy, { ...TX, scale: f.fit(big, 1500, TX), col: OIL.text, a: E.io(seg(t, .3, 1.8)), shadow: true });
  if (sub) f.text(sub, 960, cy + 92, { ...SM, scale: f.fit(sub, 1440, SM), col: OIL.text, a: .75 * E.io(seg(t, 1, 2.5)), shadow: true });
}

defineScene({
  id: 'oil', name: '油彩',
  description: '整個畫面由油畫筆觸構成的 3D 夜景，漩渦星空、滿月、麥田與小村，鏡頭緩慢推移。適合默想、感恩、安靜敬拜的歌。',
  palette: OIL, labels: { bg: '夜色', deep: '群青', sky: '鈷藍', swirl: '漩渦亮藍', teal: '青綠', moon: '月', star: '星', far: '遠山', snow: '雪', hill: '近山', wheat: '麥田', meadow: '草地', road: '小徑', tree: '柏樹', wall: '牆', lamp: '燈火', text: '字' },
  look: { grain: .02, vignette: .18, paper: .03 },
  world: { z: .2, build, camera },
  backgrounds: {
    calm: { label: '平靜（左右輕移）', jumpBeats: 8, draw: night },
    build: { label: '累積（往前推近）', jumpBeats: 4, draw: night },
    peak: { label: '高潮（升高看星空）', jumpBeats: 4, draw: night },
  },
  subtitles: {
    gentle: { label: '收斂', split: 'block', seconds: 16, draw: gentle },
    flashy: { label: '華麗（一行）', split: 'line', seconds: 7, draw: flashy },
  },
});
