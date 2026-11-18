// 自訂 WGSL 示範：把背景印成「雙色網點」——兩版墨各轉不同角度、套色錯位、疊印相乘。字在 z=1，不受影響
const C = { bg: '#dacfb7', pink: '#d9506a', blue: '#3a5aa5', g1: '#5a5a5a', g2: '#9a9a9a', ink: '#2c2a30' };

function calm(f, x) {
  const p = x.step([[420, 640], [1500, 420], [600, 300], [1380, 760]], 2);
  f.add(circle(p[0], p[1], 360, C.g1), circle(p[0] + 260, p[1] - 120, 220, C.g2));
  for (let i = 0; i < 6; i++) f.add(rect(0, 120 + i * 150, W, 150 + i * 150, C.g2, .15 + .1 * i));
}
function gentle(f, x) {
  calm(f, x);
  x.lines.forEach((l, i) => f.text(l, 960, 480 + i * 120, { px: 88, weight: 900, col: C.ink, a: seg(x.t, i * .1, .5 + i * .1) }));
}
defineScene({
  id: 'duotone', name: '雙色網點',
  palette: C, labels: { bg: '紙色', pink: '第一版墨', blue: '第二版墨' },
  params: { cell: { value: 11, min: 6, max: 24, label: '網點大小' } },
  backgrounds: { calm: { label: '平靜', jumpBeats: 4, draw: calm } },
  subtitles: { gentle: { label: '收斂', split: 'block', seconds: 16, draw: gentle } },
  shader: { z: .5, code: `
fn dots(px: vec2f, ang: f32, cell: f32, tone: f32) -> f32 {
  let r = mat2x2f(cos(ang), -sin(ang), sin(ang), cos(ang)) * px / cell;
  let d = length(fract(r) - 0.5);
  return 1.0 - smoothstep(-0.04, 0.04, d - sqrt(clamp(tone, 0.0, 1.0)) * 0.62);
}
fn shade(uv: vec2f, t: f32, beat: f32, base: vec4f) -> vec4f {
  let px = uv * RES;
  let l = dot(base.rgb, vec3f(0.299, 0.587, 0.114));
  let jog = vec2f(3.0, -2.0) * (1.0 + floor(beat / 8.0) % 2.0);   // 每 8 拍套色重新錯位
  let a = dots(px, 0.26, param(0), (0.8 - l) * 1.7);          // 第一版：比紙暗的地方才有墨
  let b = dots(px + jog, 1.31, param(0), (0.55 - l) * 2.2);   // 第二版：只印最暗的地方
  var c = pal(0);
  c = mix(c, c * pal(1), a * 0.9);
  c = mix(c, c * pal(2), b * 0.85);
  return vec4f(c, 1.0);
}
` },
});
