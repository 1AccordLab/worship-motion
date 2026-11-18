/* 麥田・寫實：自訂 WGSL 程序化麥田。低機位、地平線偏低，上方大片天空留給歌詞；遠景清楚、前景麥穗大而糊（淺景深感）。
   風吹過時一波波的明暗麥浪往遠處傳（雜訊＋整數圈數的正弦，16 秒頭尾相接）；peak：夕陽的金色。
   不用鏡頭光斑、散景光點、粒子、人工光暈圈；背景不放字。較吃顯示卡。
   背景種類用左上角 6×6 像素的「記號色」告訴 shader（紅＝背景強度 0／.5／1，綠＝字幕模式）。 */
const FDP = { bg: '#8c9a9c', zen: '#7f93a0', hor: '#c9c3ad', warm: '#d9a45c', green: '#6b7a48', gold: '#b8924a' };
const MODE = { calm: 0, build: .5, peak: 1 };
const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const mixc = (a, b, k) => { const x = rgb(a), y = rgb(b); return [lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k)]; };

// 沒有 shader 時看到的底（分階天色＋一塊平的田）＋記號
function base(f, mode, text) {
  f.bg = FDP.zen;
  for (let i = 1; i < 6; i++) f.add(rect(0, i * 135, W, i * 135 + 136, mixc(FDP.zen, mode > .7 ? FDP.warm : FDP.hor, i / 6)));
  f.add(rect(0, 790, W, H, mode > .7 ? FDP.gold : FDP.green));
  f.add(rect(0, 0, 6, 6, [mode, text, 0]));
}
const bg = mode => (f, x) => base(f, mode, 0);

/* ---------- 字幕：深色字放在天空上（天空偏亮），逐行慢慢淡入，無彈跳無放大 ---------- */
const INKC = '#2f3326';
const hasMark = x => /\[.+?\]/.test(x.swap ? x.text2 : x.text);
function say(f, s, x0, y, o, col, a, soft = true) {   // soft：整行用模糊字影；逐字的用不模糊的位移字影（模糊很花時間）
  if (a <= .003 || !s) return;
  if (soft) f.text(s, x0, y + 4, { ...o, shadow: true, blur: 14, col: FDP.hor, a: .75 * a });
  else f.text(s, x0 + 2, y + 3, { ...o, col: FDP.hor, a: .55 * a });
  f.text(s, x0, y, { ...o, col, a });
}
function gentle(f, x) {
  base(f, .3, 1);
  const t = x.t, big = x.big.slice(0, 3), small = x.small.slice(0, 3), n = Math.max(1, big.length, small.length), two = small.length > 0;
  const gap = two ? 140 : 116, y0 = 430 - gap * (n - 1) / 2, TX = { px: 82, weight: 600, spacing: 8 }, SM = { px: 38, weight: 500, spacing: 3 };
  for (let i = 0; i < n; i++) {
    const a = E.io(seg(t, .3 + i * .4, 1.8 + i * .4)), y = y0 + i * gap;
    if (big[i]) say(f, big[i], 960, y, { ...TX, scale: f.fit(big[i], 1500, TX) }, INKC, a);
    if (small[i]) say(f, small[i], 960, y + 58, { ...SM, scale: f.fit(small[i], 1440, SM) }, INKC, .66 * E.io(seg(t, .7 + i * .4, 2.2 + i * .4)));
  }
  const r = E.io(seg(t, 1.2 + n * .4, 3 + n * .4)), uy = y0 + (n - 1) * gap + (two ? 108 : 76);
  if (r > .004) f.add(rect(960 - 90, uy - 2, 960 + 90, uy + 2, FDP.gold, .95 * r, { z: .8 }));
}
function flashy(f, x) {
  base(f, .6, 1);
  const t = x.t, sub = x.small[0] || '', cy = sub ? 410 : 440, kw = hasMark(x) ? x.kw : -1, chars = x.chars, n = chars.length;
  const ST = { px: 100, weight: 500 }, KS = { px: 100, weight: 900 };
  const ws = chars.map((c, i) => f.measure(c, i === kw ? KS : ST).tw), total = ws.reduce((a, b) => a + b, 0) + 6 * Math.max(0, n - 1), sc = Math.min(1, 1500 / Math.max(1, total));
  let cx = 960 - total * sc / 2;
  chars.forEach((c, i) => {
    const w = ws[i] * sc, isK = i === kw, ti = isK ? .3 + n * .08 + .35 : .3 + i * .08;
    say(f, c, cx + w / 2, cy, { ...(isK ? KS : ST), scale: sc }, isK ? '#8a5a1e' : INKC, E.io(seg(t, ti, ti + (isK ? 1.8 : 1.3))), false);
    cx += w + 6 * sc;
  });
  const end = .3 + n * .08 + 1.3;
  if (sub) { const SM = { px: 44, weight: 500, spacing: 3 }; say(f, sub, 960, cy + 94, { ...SM, scale: f.fit(sub, 1440, SM) }, INKC, .66 * E.io(seg(t, end, end + 1.5))); }
  const r = E.io(seg(t, end + .4, end + 2.2)), uy = cy + (sub ? 148 : 90);
  if (r > .004) f.add(rect(960 - 70, uy - 2, 960 + 70, uy + 2, FDP.gold, .95 * r, { z: .8 }));
}

defineScene({
  id: 'field_photo', name: '麥田・寫實',
  palette: FDP, labels: { zen: '天空', hor: '地平線', warm: '陽光', green: '麥（綠）', gold: '麥（金）' },
  look: { grain: .03, vignette: .2 },
  backgrounds: {
    calm: { label: '平靜（微風）', jumpBeats: 8, draw: bg(MODE.calm) },
    build: { label: '累積（麥浪一波波）', jumpBeats: 4, draw: bg(MODE.build) },
    peak: { label: '高潮（金色麥浪）', jumpBeats: 4, draw: bg(MODE.peak) },
  },
  subtitles: {
    flashy: { label: '華麗（克制）', split: 'line', seconds: 7, draw: flashy },
    gentle: { label: '收斂', split: 'block', seconds: 16, draw: gentle },
  },
  shader: { z: .5, code: `
fn fbm(p: vec2f) -> f32 {
  var s = 0.0; var a = 0.5; var q = p;
  for (var o = 0; o < 4; o++) { s += a * noise(q); q = q * 2.02 + vec2f(3.1, 1.7); a *= 0.5; }
  return s;
}
fn shade(uv: vec2f, t: f32, beat: f32, base: vec4f) -> vec4f {
  let mk = scene(vec2f(3.0, 3.0) / RES); let m = mk.r; let txt = mk.g;
  let zen = pal(1); let hc = pal(2); let warm = pal(3); let gr = pal(4); let go = pal(5);
  let pk = smoothstep(0.6, 1.0, m);
  let HZ = 0.735;
  let ph = fract(t / 16.0); let w0 = sin(3.14159 * ph); let w1 = cos(3.14159 * ph);
  let sun = vec2f(0.8, mix(0.25, 0.66, pk));
  let sd = length((uv - sun) * vec2f(1.78, 1.0));
  var sky = mix(zen * mix(1.0, 0.95, pk), mix(hc, warm * 1.05, pk * 0.9), pow(clamp(uv.y / HZ, 0.0, 1.0), 1.8));
  sky += warm * (0.1 + 0.28 * pk) * exp(-1.6 * sd);
  let cp = vec2f(uv.x * 3.0, uv.y * 9.0);
  let c = fbm(cp + vec2f(0.6 * ph, 0.0)) * w0 * w0 + fbm(cp + vec2f(0.6 * fract(ph + 0.5) + 9.0, 4.0)) * w1 * w1;
  sky = mix(sky, mix(hc * 1.04, warm, pk * 0.7), smoothstep(0.55, 0.8, c) * 0.35 * smoothstep(0.75, 0.15, uv.y));
  var col = sky;
  let ridge = HZ - 0.012 - 0.012 * noise(vec2f(uv.x * 9.0, 1.0));
  col = mix(col, mix(sky, gr * 0.7, 0.45), smoothstep(ridge, ridge + 0.002, uv.y));
  let P = uv * RES; let hy = HZ * RES.y;
  if (P.y > hy - 2.0) {
    var acc = 0.0; var fc = vec3f(0.0);
    for (var j = 0; j < 24; j++) {
      if (acc < 0.985) {
        let k = f32(23 - j); let q = (k + 1.0) / 24.0;
        let yb = hy + (RES.y * 1.16 - hy) * pow(q, 1.8);
        let sp = 2.5 + 70.0 * pow(q, 2.2); let hh = 6.0 + 420.0 * pow(q, 2.4);
        let gust = 0.5 + 0.5 * sin(6.2832 * (q * 2.5 + uv.x * 0.7 - t * 3.0 / 16.0));
        let amp = mix(0.25, 1.0, m);
        let ln = (yb - P.y) * (0.05 + 0.32 * amp * gust) + 6.0 * q * sin(6.2832 * t * 2.0 / 16.0 + uv.x * 5.0 + k);
        let X = (P.x + ln) / sp + k * 7.31;
        let c = floor(X); let fr = fract(X);
        let r1 = hash(vec2f(c, k)); let r2 = hash(vec2f(c, k + 50.0));
        let top = yb - hh * (0.72 + 0.28 * r1);
        if (P.y >= top && P.y <= yb) {
          let h = (P.y - top) / max(yb - top, 1.0);
          let ear = smoothstep(0.3, 0.24, h);
          let hw = mix(0.05, 0.12 * sqrt(max(sin(3.14159 * min(h / 0.28, 1.0)), 0.0)), ear);
          let sf = mix(0.03, 0.2, smoothstep(0.7, 1.0, q));
          let cv = smoothstep(hw + sf, max(hw - sf * 0.6, 0.0), abs(fr - 0.5 - 0.3 * (r2 - 0.5)));
          let br = (0.72 + 0.4 * amp * gust + 0.12 * (r2 - 0.5)) * mix(1.0, 0.85 + 0.15 * sin(h * 160.0), ear) * mix(0.75, 1.0, 1.0 - h * (1.0 - ear));
          var cc = mix(mix(gr, go, mix(0.3, 0.9, pk) + 0.15 * r1), mix(go, warm, pk * 0.5) * 1.08, ear) * br;
          cc += warm * pk * 0.25 * gust * smoothstep(0.55, 0.0, sd) * ear;
          cc = mix(cc, mix(hc, warm, pk * 0.5) * 0.95, pow(1.0 - q, 4.0) * 0.6);
          cc = mix(cc, cc * 0.85 + vec3f(0.04), smoothstep(0.8, 1.0, q) * 0.5);
          let al = cv * mix(1.0, 0.9, smoothstep(0.85, 1.0, q));
          fc += (1.0 - acc) * al * cc; acc += (1.0 - acc) * al;
        }
      }
    }
    let gd = mix(gr * 0.45, go * 0.5, pk * 0.7);
    let fieldc = fc + (1.0 - acc) * mix(gd, mix(hc, warm, pk * 0.5) * 0.8, exp(-(P.y - hy) * 0.02) * 0.5);
    col = mix(col, fieldc, smoothstep(hy - 2.0, hy + 1.0, P.y));
  }
  col = mix(col, hc * 1.05, txt * 0.3 * smoothstep(0.3, 0.0, abs(uv.y - 0.42)) * smoothstep(0.6, 0.1, abs(uv.x - 0.5)));
  return vec4f(clamp(col, vec3f(0.03), vec3f(0.94)), 1.0);
}` },
});
