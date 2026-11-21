let selEl = null, stageDrag = null;
const SNAP_CSS_PX = 6, DRAG_START_CSS_PX = 3, ROTATE_STEP = 15, BOX_MIN = 24, ROTATE_HANDLE_ROOM_CSS_PX = 34;
const boxCenter = box => [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
const inBox = (box, p) => p.x >= box[0] && p.x <= box[2] && p.y >= box[1] && p.y <= box[3];
const elementState = id => elementsNow().find(e => e.id === id) || null;
function selectionNow() {
  const e = selEl && elementState(selEl); if (!e || e.fixed || !e.visible) return null;
  const home = clipTerritory[e.id], c = home ? boxCenter(home) : [W / 2, H / 2], anchor = [c[0] + e.dx, c[1] + e.dy];
  const hw = home ? (home[2] - home[0]) / 2 * e.scale : 0, hh = home ? (home[3] - home[1]) / 2 * e.scale : 0;
  const box = e.box || (home ? [anchor[0] - hw, anchor[1] - hh, anchor[0] + hw, anchor[1] + hh] : null);
  return box && { id: e.id, label: e.label, box, anchor, dx: e.dx, dy: e.dy, scale: e.scale, rotate: e.rotate };
}
function selectElement(id) {
  const e = id ? elementState(id) : null;
  if (id && (!e || e.fixed || !e.visible)) return false;
  selEl = id || null; syncElementRows(); renderStage(); return true;
}
const pc = (v, full) => (v / full * 100).toFixed(3) + '%';
function showGuides(gx, gy) {
  const v = $('#snapV'), h = $('#snapH');
  v.hidden = gx === null; if (gx !== null) v.style.left = pc(gx, W);
  h.hidden = gy === null; if (gy !== null) h.style.top = pc(gy, H);
}
// 注意：選取框與把手只畫在畫面範圍內（元素可以超出畫面，把手要抓得到、不能蓋住預覽外面的控制列）；上方沒空間時旋轉把手改放在框內
function renderStage() {
  const box = $('#selBox'); if (!box) return;
  const s = exporting ? null : selectionNow(), pivot = $('#selPivot');
  box.hidden = !s; pivot.hidden = !s;
  if (!stageDrag) showGuides(null, null);
  if (!s) return;
  const x0 = Math.min(Math.max(0, s.box[0]), W - BOX_MIN), x1 = Math.max(Math.min(W, s.box[2]), x0 + BOX_MIN);
  const y0 = Math.min(Math.max(0, s.box[1]), H - BOX_MIN), y1 = Math.max(Math.min(H, s.box[3]), y0 + BOX_MIN);
  box.style.left = pc(x0, W); box.style.top = pc(y0, H); box.style.width = pc(x1 - x0, W); box.style.height = pc(y1 - y0, H);
  box.classList.toggle('low', y0 / H * $('#view').clientHeight < ROTATE_HANDLE_ROOM_CSS_PX);
  pivot.style.left = pc(Math.max(0, Math.min(W, s.anchor[0])), W); pivot.style.top = pc(Math.max(0, Math.min(H, s.anchor[1])), H);
  box.setAttribute('aria-label', `選取中：${s.label}`);
}
function stagePoint(ev) {
  const rc = $('#view').getBoundingClientRect();
  return { x: (ev.clientX - rc.left) / rc.width * W, y: (ev.clientY - rc.top) / rc.height * H, unit: W / rc.width };
}
function nearestSnap(edges, targets, reach) {
  let best = null;
  for (const e of edges) for (const g of targets) if (Math.abs(g - e) <= reach && (!best || Math.abs(g - e) < Math.abs(best.fix))) best = { fix: g - e, at: g };
  return best;
}
function movePatch(drag) {
  const st = drag.start, box = st.box, reach = SNAP_CSS_PX * drag.last.unit;
  let mx = drag.last.x - drag.p0.x, my = drag.last.y - drag.p0.y, gx = null, gy = null;
  if (drag.shift) { if (Math.abs(mx) >= Math.abs(my)) my = 0; else mx = 0; }
  if (!drag.free) {
    const sx = drag.shift && mx === 0 ? null : nearestSnap([box[0] + mx, (box[0] + box[2]) / 2 + mx, box[2] + mx], [0, W / 2, W], reach);
    const sy = drag.shift && my === 0 ? null : nearestSnap([box[1] + my, (box[1] + box[3]) / 2 + my, box[3] + my], [0, H / 2, H], reach);
    if (sx) { mx += sx.fix; gx = sx.at; }
    if (sy) { my += sy.fix; gy = sy.at; }
  }
  showGuides(gx, gy);
  return { dx: st.dx + mx, dy: st.dy + my };
}
function scalePatch(drag) {
  const A = drag.start.anchor, r0 = Math.hypot(drag.p0.x - A[0], drag.p0.y - A[1]), r1 = Math.hypot(drag.last.x - A[0], drag.last.y - A[1]);
  return r0 < 1 ? null : { scale: drag.start.scale * r1 / r0 };
}
function rotatePatch(drag) {
  const A = drag.start.anchor, a0 = Math.atan2(drag.p0.y - A[1], drag.p0.x - A[0]), a1 = Math.atan2(drag.last.y - A[1], drag.last.x - A[0]);
  const deg = drag.start.rotate + (a1 - a0) * 180 / Math.PI;
  return { rotate: drag.shift ? Math.round(deg / ROTATE_STEP) * ROTATE_STEP : deg };
}
const DRAG_PATCH = { move: movePatch, scale: scalePatch, rotate: rotatePatch }, DRAG_WORD = { move: '移動', scale: '縮放', rotate: '旋轉' };
function armDrag(drag, id) {
  const s = selectionNow(); if (!s || s.id !== id) return false;
  drag.id = id; drag.scope = elScope; drag.start = { ...s, before: clone(scopeHost(elScope).elements || {}) }; drag.armed = true;
  return true;
}
function applyDrag(drag) {
  if (!drag.armed || drag.over) return;
  if (!drag.moved && Math.hypot(drag.last.x - drag.p0.x, drag.last.y - drag.p0.y) < DRAG_START_CSS_PX * drag.last.unit) return;
  drag.moved = true;
  const patch = DRAG_PATCH[drag.mode](drag); if (!patch) return;
  writeElement(drag.id, patch, drag.scope); syncElementRows(); pushElements();
}
function endDrag(drag, keep) {
  if (drag.over) return; drag.over = true;
  removeEventListener('pointermove', drag.onMove); removeEventListener('pointerup', drag.onUp); removeEventListener('pointercancel', drag.onCancel);
  if (stageDrag === drag) stageDrag = null;
  document.body.classList.remove('stagedrag'); showGuides(null, null);
  if (!drag.armed || !drag.moved) return;
  if (keep) save(scopePrefix(drag.scope) + DRAG_WORD[drag.mode] + `元素「${drag.start.label}」`);
  else { setOrDrop(scopeHost(drag.scope), drag.start.before); pushElements(); }
  syncElementRows();
}
function cancelStageDrag() { if (stageDrag) { if (stageDrag.armed) endDrag(stageDrag, false); else stageDrag.released = true; } }
// 注意：點到哪個元素要問 Worker（形狀在那邊），是非同步的；這段時間的游標移動先記在 drag.last，問到結果才開始拖
function onStageDown(ev) {
  if (ev.button > 0 || exporting || !clip || !scene || stageDrag) return;
  ev.preventDefault();
  const handle = ev.target.closest('.h'), p0 = stagePoint(ev);
  const drag = stageDrag = { mode: handle ? (handle.classList.contains('rot') ? 'rotate' : 'scale') : 'move', p0, last: p0, shift: ev.shiftKey, free: ev.ctrlKey || ev.metaKey };
  drag.onMove = e => { drag.last = stagePoint(e); drag.shift = e.shiftKey; drag.free = e.ctrlKey || e.metaKey; applyDrag(drag); };
  drag.onUp = () => { if (drag.armed) endDrag(drag, true); else drag.released = true; };
  drag.onCancel = () => { if (drag.armed) endDrag(drag, false); else drag.released = true; };
  addEventListener('pointermove', drag.onMove); addEventListener('pointerup', drag.onUp); addEventListener('pointercancel', drag.onCancel);
  document.body.classList.add('stagedrag');
  if (handle) { if (!armDrag(drag, selEl)) endDrag(drag, false); return; }
  serial(async () => {
    const hit = (await scene.hit(clip.map(t), p0.x, p0.y)).el, sel = selectionNow();
    const target = hit || (sel && inBox(sel.box, p0) ? sel.id : null);
    if (!target) { selectElement(null); endDrag(drag, false); return; }
    if (target !== selEl) { selectElement(target); showTab('el'); }
    if (drag.released || !armDrag(drag, target)) { endDrag(drag, false); return; }
    applyDrag(drag);
  }).catch(() => endDrag(drag, false));
}
function bindStage() {
  $('#stageOvl').addEventListener('pointerdown', onStageDown);
  document.addEventListener('keydown', e => { if (e.key !== 'Escape' || anyDialogOpen()) return; if (stageDrag) cancelStageDrag(); else if (selEl) selectElement(null); });
}
