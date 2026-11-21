// 元素範例：暖灰底上一條跟拍子跳位置的色帶、一顆跟拍輕跳的圓，各是一個可以單獨調整的元素
const C = { bg: '#2a2925', main: '#d9643a', soft: '#e6dcc8' };

// 色帶：每 2 秒（4 拍）跳一個位置，粗細可調
function bar(f, x, e) {
  const y = x.step([200, 760, 420, 880], 2);
  f.add(rect(0, y, W, y + 40 * e.p.thick, C.main));
}
// 圓：跟拍輕跳，半徑由各個背景指定
function dot(f, x, e) {
  f.add(circle(1640, 300, e.args.r * (1 + .06 * pulse(x.t)), C.soft, .9));
}
// 收斂字幕：段落選的背景＋深色橫條＋逐行淡入
function gentle(f, x) {
  x.under(f, 'calm');
  f.add(rect(0, 400, W, 680, C.bg, .92));
  x.lines.forEach((l, i) => f.text(l, 960, 480 + i * 120, { px: 84, col: C.soft, a: seg(x.t, i * .1, .5 + i * .1) }));
}

defineScene({
  id: 'parts', name: '色帶與圓',
  description: '暖灰底上一條色帶和一顆圓，跟著拍子動。',
  palette: C, labels: { bg: '底色', main: '主色', soft: '亮色' },
  elements: {
    bar: { label: '色帶', colors: ['main'], params: { thick: { value: 1, min: .5, max: 4, label: '粗細' } }, draw: bar },
    dot: { label: '圓', colors: ['soft'], draw: dot },
  },
  backgrounds: {
    calm: { label: '平靜', jumpBeats: 4, use: ['bar', { el: 'dot', r: 90 }] },
    peak: { label: '高潮', jumpBeats: 2, use: ['bar', { el: 'dot', r: 160 }] },
  },
  subtitles: { gentle: { label: '收斂', split: 'block', seconds: 16, draw: gentle } },
});
