let selEls = [], stageDrag = null, editOn = false, hoverEl = null, hoverWant = null, hoverBusy = false;
const SNAP_CSS_PX = 6, DRAG_START_CSS_PX = 4, ROTATE_STEP = 15, BOX_MIN_CSS_PX = 48, ROTATE_HANDLE_ROOM_CSS_PX = 34;
const boxCenter = box => [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
const inBox = (box, p) => p.x >= box[0] && p.x <= box[2] && p.y >= box[1] && p.y <= box[3];
const joinBoxes = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
const isSelected = id => selEls.includes(id);
const selectable = e => !!e && !e.fixed && !e.locked && e.visible;
function placementOf(e) {
  const home = clipTerritory[e.id], c = home ? boxCenter(home) : [W / 2, H / 2], anchor = [c[0] + e.dx, c[1] + e.dy];
  const hw = home ? (home[2] - home[0]) / 2 * e.scale : 0, hh = home ? (home[3] - home[1]) / 2 * e.scale : 0;
  return { e, anchor, box: e.box || (home ? [anchor[0] - hw, anchor[1] - hh, anchor[0] + hw, anchor[1] + hh] : null) };
}
function selectionNow() {
  if (!selEls.length) return null;
  const all = elementsNow(), parts = selEls.map(id => all.find(e => e.id === id)).filter(selectable).map(placementOf).filter(p => p.box);
  if (!parts.length) return null;
  const one = parts.length === 1 ? parts[0] : null;
  return { id: one ? one.e.id : null, ids: parts.map(p => p.e.id), label: one ? `元素「${one.e.label}」` : ` ${parts.length} 個元素`, box: parts.map(p => p.box).reduce(joinBoxes), anchor: one ? one.anchor : null,
    dx: one ? one.e.dx : 0, dy: one ? one.e.dy : 0, scale: one ? one.e.scale : 1, rotate: one ? one.e.rotate : 0, parts: parts.map(p => ({ id: p.e.id, dx: p.e.dx, dy: p.e.dy })) };
}
function setSelection(ids) {
  const all = elementsNow(); selEls = [...new Set(ids)].filter(id => selectable(all.find(e => e.id === id)));
  syncElementRows(); renderStage();
}
function selectElement(id) {
  if (!id) { setSelection([]); return true; }
  if (!selectable(elementsNow().find(e => e.id === id))) return false;
  if (!editOn) setEditMode(true);
  setSelection([id]); return true;
}
function setEditMode(on) {
  editOn = !!on; if (stageDrag) finishDrag(stageDrag, false);
  if (!editOn) selEls = [];
  setHover(null);
  $('#editToggle').setAttribute('aria-pressed', String(editOn)); $('#stageOvl').classList.toggle('on', editOn);
  if (editOn) showTab('el');
  syncElementRows(); renderStage();
}
const pc = (v, full) => (v / full * 100).toFixed(3) + '%';
function placeBox(el, box) { el.style.left = pc(box[0], W); el.style.top = pc(box[1], H); el.style.width = pc(box[2] - box[0], W); el.style.height = pc(box[3] - box[1], H); }
function showGuides(gx, gy) {
  const v = $('#snapV'), h = $('#snapH');
  v.hidden = gx === null; if (gx !== null) v.style.left = pc(gx, W);
  h.hidden = gy === null; if (gy !== null) h.style.top = pc(gy, H);
}
function shownBox(box) {
  const min = BOX_MIN_CSS_PX * W / Math.max(1, $('#view').clientWidth);
  const span = (a, b, full) => { const lo = Math.max(0, Math.min(full, a)), hi = Math.max(0, Math.min(full, b)); if (hi - lo >= min) return [lo, hi]; const from = Math.max(0, Math.min(full - min, (lo + hi - min) / 2)); return [from, from + min]; };
  const [x0, x1] = span(box[0], box[2], W), [y0, y1] = span(box[1], box[3], H);
  return [x0, y0, x1, y1];
}
function setHover(id) {
  hoverEl = id || null;
  const box = $('#hoverBox'), e = hoverEl && editOn && !stageDrag ? elementsNow().find(x => x.id === hoverEl) : null;
  box.hidden = !(e && e.box); if (box.hidden) return;
  placeBox(box, shownBox(e.box)); $('#hoverName').textContent = e.label;
}
// 注意：選取框與把手只畫在畫面範圍內（元素可以超出畫面，把手要抓得到、不能蓋住預覽外面的控制列），而且至少留一塊抓得到的中間；旋轉把手上方沒空間就放下方，都沒有才放框內
function renderStage() {
  const box = $('#selBox'); if (!box) return;
  const s = exporting || !editOn ? null : selectionNow(), pivot = $('#selPivot');
  box.hidden = !s; pivot.hidden = !(s && s.anchor);
  if (!stageDrag) showGuides(null, null);
  if (!s) return;
  const shown = shownBox(s.box), css = $('#view').clientHeight / H, above = shown[1] * css >= ROTATE_HANDLE_ROOM_CSS_PX, below = (H - shown[3]) * css >= ROTATE_HANDLE_ROOM_CSS_PX;
  placeBox(box, shown);
  box.classList.toggle('multi', s.ids.length > 1); box.classList.toggle('rotbelow', !above && below); box.classList.toggle('rotinside', !above && !below);
  if (s.anchor) { pivot.style.left = pc(Math.max(0, Math.min(W, s.anchor[0])), W); pivot.style.top = pc(Math.max(0, Math.min(H, s.anchor[1])), H); }
  box.setAttribute('aria-label', `選取中：${s.label.trim()}`);
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
function movePatches(drag) {
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
  return st.parts.map(p => [p.id, { dx: p.dx + mx, dy: p.dy + my }]);
}
function scalePatches(drag) {
  const A = drag.start.anchor, r0 = Math.hypot(drag.p0.x - A[0], drag.p0.y - A[1]), r1 = Math.hypot(drag.last.x - A[0], drag.last.y - A[1]);
  return r0 < 1 ? [] : [[drag.start.id, { scale: drag.start.scale * r1 / r0 }]];
}
function rotatePatches(drag) {
  const A = drag.start.anchor, a0 = Math.atan2(drag.p0.y - A[1], drag.p0.x - A[0]), a1 = Math.atan2(drag.last.y - A[1], drag.last.x - A[0]);
  const deg = drag.start.rotate + (a1 - a0) * 180 / Math.PI;
  return [[drag.start.id, { rotate: drag.shift ? Math.round(deg / ROTATE_STEP) * ROTATE_STEP : deg }]];
}
const DRAG_PATCHES = { move: movePatches, scale: scalePatches, rotate: rotatePatches }, DRAG_WORD = { move: '移動', scale: '縮放', rotate: '旋轉' };
const dragRect = drag => [Math.min(drag.p0.x, drag.last.x), Math.min(drag.p0.y, drag.last.y), Math.max(drag.p0.x, drag.last.x), Math.max(drag.p0.y, drag.last.y)];
function armTransform(drag) {
  const s = selectionNow(); if (!s || (drag.mode !== 'move' && !s.id)) return false;
  drag.scope = elScope; drag.start = { ...s, before: clone(scopeHost(elScope).elements || {}), beforeSection: clone(sec().elements || {}) }; drag.armed = true;
  return true;
}
function applyDrag(drag) {
  if (!drag.armed || drag.over) return;
  if (!drag.moved && Math.hypot(drag.last.x - drag.p0.x, drag.last.y - drag.p0.y) < DRAG_START_CSS_PX * drag.last.unit) return;
  drag.moved = true;
  if (drag.mode === 'marquee') { const m = $('#marquee'); m.hidden = false; placeBox(m, dragRect(drag)); return; }
  const patches = DRAG_PATCHES[drag.mode](drag); if (!patches.length) return;
  for (const [id, patch] of patches) writeElement(id, patch, drag.scope);
  syncElementRows(); pushElements();
}
function clickSelect(drag) {
  if (drag.mode === 'move') { if (drag.hit && selEls.length > 1) setSelection([drag.hit]); return; }
  if (drag.hit) setSelection(drag.add ? (isSelected(drag.hit) ? selEls.filter(id => id !== drag.hit) : [...selEls, drag.hit]) : [drag.hit]);
  else if (!drag.add) setSelection([]);
}
function finishDrag(drag, keep) {
  if (drag.over) return; drag.over = true;
  removeEventListener('pointermove', drag.onMove); removeEventListener('pointerup', drag.onUp); removeEventListener('pointercancel', drag.onCancel);
  if (stageDrag === drag) stageDrag = null;
  document.body.classList.remove('stagedrag'); showGuides(null, null); $('#marquee').hidden = true;
  if (!drag.armed) return;
  if (!drag.moved) { if (keep) clickSelect(drag); return; }
  if (drag.mode === 'marquee') {
    if (keep) serial(async () => { const ids = (await scene.touching(clip.map(t), dragRect(drag))).els; setSelection(drag.add ? [...selEls, ...ids] : ids); }).catch(() => { });
    return;
  }
  if (keep) save(scopePrefix(drag.scope) + DRAG_WORD[drag.mode] + drag.start.label);
  else { setOrDrop(scopeHost(drag.scope), drag.start.before); setOrDrop(sec(), drag.scope === 'section' ? drag.start.before : drag.start.beforeSection); pushElements(); }
  syncElementRows();
}
// 注意：點到哪個元素要問 Worker（形狀在那邊），是非同步的；這段時間的游標移動先記在 drag.last，問到結果才決定是移動還是範圍選取
function onStageDown(ev) {
  if (!editOn || ev.button > 0 || exporting || !clip || !scene || stageDrag) return;
  ev.preventDefault();
  if (document.activeElement && document.activeElement.closest('#elList')) document.activeElement.blur();
  const handle = ev.target.closest('.h'), p0 = stagePoint(ev);
  const drag = stageDrag = { mode: handle ? (handle.classList.contains('rot') ? 'rotate' : 'scale') : 'move', p0, last: p0, shift: ev.shiftKey, add: ev.shiftKey, free: ev.ctrlKey || ev.metaKey, hit: null };
  drag.onMove = e => { drag.last = stagePoint(e); drag.shift = e.shiftKey; drag.free = e.ctrlKey || e.metaKey; applyDrag(drag); };
  drag.onUp = () => { if (drag.armed) finishDrag(drag, true); else drag.released = true; };
  drag.onCancel = () => { if (drag.armed) finishDrag(drag, false); else { drag.released = true; drag.cancelled = true; } };
  addEventListener('pointermove', drag.onMove); addEventListener('pointerup', drag.onUp); addEventListener('pointercancel', drag.onCancel);
  document.body.classList.add('stagedrag'); setHover(null);
  if (handle) { if (!armTransform(drag)) finishDrag(drag, false); return; }
  serial(async () => {
    const hit = drag.hit = (await scene.hit(clip.map(t), p0.x, p0.y)).el, sel = selectionNow();
    const onSelection = !drag.add && (hit ? isSelected(hit) : !!(sel && inBox(shownBox(sel.box), p0)));
    if (onSelection) { if (!armTransform(drag)) { finishDrag(drag, false); return; } }
    else { drag.mode = 'marquee'; drag.armed = true; }
    if (drag.released) finishDrag(drag, !drag.cancelled); else applyDrag(drag);
  }).catch(() => finishDrag(drag, false));
}
function runHover() {
  hoverBusy = true; const want = hoverWant;
  serial(async () => { setHover(want && editOn && clip && scene && !stageDrag && !exporting ? (await scene.hit(clip.map(t), want.x, want.y)).el : null); })
    .catch(() => setHover(null)).then(() => { hoverBusy = false; if (hoverWant !== want) runHover(); });
}
function onStageHover(ev) { if (!editOn || stageDrag || ev.buttons) return; hoverWant = stagePoint(ev); if (!hoverBusy) runHover(); }
function bindStage() {
  const ovl = $('#stageOvl');
  ovl.addEventListener('pointerdown', onStageDown); ovl.addEventListener('pointermove', onStageHover);
  ovl.addEventListener('pointerleave', () => { hoverWant = null; if (!hoverBusy) setHover(null); });
  document.addEventListener('keydown', e => { if (e.key !== 'Escape' || anyDialogOpen()) return; if (stageDrag) { if (stageDrag.armed) finishDrag(stageDrag, false); else { stageDrag.released = true; stageDrag.cancelled = true; } } else if (selEls.length) setSelection([]); });
}
