// Canvas2D 自由畫層示範：鉛筆排線（每秒抖 8 次，像手繪動畫），疊在色塊上、字的下面
const C = { bg: '#25282a', red: '#c9563c', sand: '#d8c9a8', line: '#e8dfcc' };

function calm(f, x) {
  const p = x.step([[300, 760], [1600, 300], [420, 260], [1500, 820]], 2);
  f.add(circle(p[0], p[1], 240, C.red), rect(0, 940, W, 1000, C.sand, .8));
}
defineScene({
  id: 'hatch', name: '鉛筆排線',
  palette: C, labels: { bg: '底色', red: '紅', sand: '沙', line: '線' },
  backgrounds: { calm: { label: '平靜', jumpBeats: 4, draw: calm } },
  canvas: {
    z: .5, half: false,
    draw(ctx, t, info) {
      const k = Math.floor(t * 8);
      ctx.strokeStyle = info.pal.line; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      for (let i = 0; i < 60; i++) {
        const x0 = 80 + i * 13 + (hash(i + k * 7) - .5) * 5;
        ctx.globalAlpha = .35 + .3 * hash(i * 3 + k);
        ctx.beginPath(); ctx.moveTo(x0, 90 + (hash(i * 5 + k) - .5) * 16);
        ctx.quadraticCurveTo(x0 - 40, 240, x0 - 90 + (hash(i * 11 + k) - .5) * 10, 380); ctx.stroke();
      }
    },
  },
});
