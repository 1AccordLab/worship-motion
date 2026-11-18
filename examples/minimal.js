// 最小場景：暖灰底、一條色帶跟拍子跳位置、右上一顆圓跟拍輕跳
const C = { bg: '#2a2925', main: '#d9643a', soft: '#e6dcc8' };

function calm(f, x) {
  const y = x.step([200, 760, 420, 880], 2);              // 每 2 秒（4 拍）跳一個位置
  f.add(rect(0, y, W, y + 40, C.main));
  f.add(circle(1640, 300, 90 * (1 + .06 * pulse(x.t)), C.soft, .9));
}
function gentle(f, x) {                                    // 字幕：背景＋深色橫條＋逐行淡入
  x.under(f, calm);
  f.add(rect(0, 400, W, 680, C.bg, .92));
  x.lines.forEach((l, i) => f.text(l, 960, 480 + i * 120, { px: 84, col: C.soft, a: seg(x.t, i * .1, .5 + i * .1) }));
}

defineScene({
  id: 'bars', name: '色帶',
  palette: C, labels: { bg: '底色', main: '主色', soft: '亮色' },
  backgrounds: { calm: { label: '平靜', jumpBeats: 4, draw: calm } },
  subtitles: { gentle: { label: '收斂', split: 'block', seconds: 16, draw: gentle } },
});
