const fixText = err => `我把你的回覆貼進「詩歌影片編輯器」，出現這個錯誤：\n\n${err}\n\n請修正後再給我一次完整的內容（設定放在 \`\`\`json 框、新風格放在 \`\`\`js 框）。`;
function say(sel, text, kind) {
  const el = $(sel), bad = kind === true;
  el.textContent = text || ''; el.classList.add('status'); el.classList.toggle('err', bad && !!text); el.classList.toggle('ok', kind === 'ok' && !!text);
  let b = el.nextElementSibling;
  if (!b || !b.classList.contains('aifix')) { b = document.createElement('button'); b.className = 'small aifix'; b.type = 'button'; el.after(b); }
  b.textContent = '複製錯誤訊息給 AI'; b.hidden = !(bad && text);
  b.onclick = async () => { await copyText(fixText(text)); b.textContent = '已複製 ✔ 貼回 AI 對話'; };
}
const cfgStatus = (s, bad) => say('#cfgStatus', s, bad);
const sceneStatus = (s, bad) => say('#sceneStatus', s, bad);
const pvStatus = (s, bad) => say('#pvMsg', s, bad);
function setStatus(s, bad) { say('#status', s, bad); }
function showErr(msg) { $('#err').hidden = false; $('#err').textContent = msg; }

let dlgDone = null;
function ask({ title, body = '', text = null, input = null, buttons }) {
  const d = $('#dlg'); if (dlgDone) dlgDone('cancel');
  $('#dlgT').textContent = title; $('#dlgB').textContent = body;
  const ta = $('#dlgText'); ta.hidden = text == null; ta.value = text ?? '';
  const inp = $('#dlgIn'); inp.hidden = input == null; inp.value = input ?? '';
  const box = $('#dlgBtns'); box.innerHTML = '';
  return new Promise(res => {
    const done = dlgDone = v => { if (dlgDone !== done) return; dlgDone = null; if (d.open) d.close(); else d.removeAttribute('open'); res(v); };
    for (const [v, label, cls] of buttons) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.v = v; if (cls) b.className = cls; b.onclick = () => done(v); box.appendChild(b); }
    d.oncancel = e => { e.preventDefault(); done('cancel'); };
    try { d.showModal(); } catch (e) { d.setAttribute('open', ''); }
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); done(buttons[0][0]); } };
    if (input != null) { inp.focus(); inp.select(); } else if (text != null) { ta.focus(); ta.select(); } else box.querySelector('button').focus();
  });
}
async function copyText(text, okMsg, where) {
  lastCopied = text;
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; }
  catch (e) { await ask({ title: '請手動複製', body: '瀏覽器不讓自動複製。下面的文字已經全選好了，按 Ctrl+C（Mac：⌘C）複製。', text, buttons: [['ok', '複製好了', 'primary']] }); }
  if (where && okMsg) say(where, okMsg, 'ok');
  return ok;
}

const TABS = ['ai', 'self', 'el', 'adv'];
function showTab(name, focus) {
  curTab = name;
  for (const k of TABS) { const tb = $('#tab-' + k), on = k === name; tb.setAttribute('aria-selected', String(on)); tb.tabIndex = on ? 0 : -1; $('#pane-' + k).hidden = !on; }
  if (focus) $('#tab-' + name).focus();
  setStep(name === 'ai' ? 1 : 2);
}
function setStep(n) { curStep = n; document.querySelectorAll('#steps>button').forEach(b => +b.dataset.step === n ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')); }
function closeTips() { document.querySelectorAll('.q[aria-expanded=true]').forEach(q => q.setAttribute('aria-expanded', 'false')); document.querySelectorAll('.tipbox.show').forEach(b => b.classList.remove('show')); }
function initTips() {
  let n = 0;
  document.querySelectorAll('.q[data-tip]').forEach(q => {
    const box = document.createElement('span'); box.className = 'tipbox'; box.id = 'wmtip' + (++n); box.setAttribute('role', 'tooltip'); box.textContent = q.dataset.tip;
    document.body.appendChild(box);
    q.setAttribute('aria-label', '說明'); q.setAttribute('aria-describedby', box.id); q.setAttribute('aria-expanded', 'false');
    const show = () => { const rc = q.getBoundingClientRect(); box.style.left = Math.max(8, Math.min(innerWidth - 288, rc.left + rc.width / 2 - 140)) + 'px'; box.style.top = (rc.bottom + 6) + 'px'; box.classList.add('show'); };
    q.onmouseenter = show; q.onmouseleave = () => { if (q.getAttribute('aria-expanded') !== 'true') box.classList.remove('show'); };
    q.onclick = e => { e.preventDefault(); e.stopPropagation(); const open = q.getAttribute('aria-expanded') !== 'true'; closeTips(); if (open) { q.setAttribute('aria-expanded', 'true'); show(); } };
  });
  document.addEventListener('click', closeTips);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTips(); });
  addEventListener('scroll', closeTips, true);
}

function fillSeg(box, opts, val, pick) {
  box.innerHTML = '';
  for (const o of opts) {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(String(o.v) === String(val)));
    const a = document.createElement('span'); a.textContent = o.label; b.append(a);
    if (o.sub) { const s = document.createElement('small'); s.textContent = o.sub; b.append(s); }
    b.onclick = () => pick(o.v); box.appendChild(b);
  }
}

function notice(id, text, action) { notices.set(id, { text, action }); renderNotices(); }
function renderNotices() {
  const box = $('#guard'); box.innerHTML = '';
  for (const [id, n] of notices) {
    const d = document.createElement('div'); d.className = 'callout'; d.textContent = n.text;
    if (n.action) { const b = document.createElement('button'); b.className = 'small'; b.textContent = n.action.label; b.onclick = n.action.fn; d.append(' ', b); }
    const x = document.createElement('button'); x.className = 'small'; x.textContent = '知道了'; x.onclick = () => { notices.delete(id); renderNotices(); };
    d.append(' ', x); box.appendChild(d);
  }
  box.hidden = !notices.size;
}
const builtinBase = () => BUILTIN.some(b => b.code === patchParts(sceneCode).base);
function renderPatches() {
  const box = $('#patchList'), list = meta().patches; box.innerHTML = '';
  $('#noPatches').hidden = !!list.length;
  list.forEach((pt, i) => {
    const row = document.createElement('div'); row.className = 'patchrow'; row.dataset.i = i;
    const name = document.createElement('span'); name.className = 'patchname'; name.textContent = pt.label;
    const drop = document.createElement('button'); drop.type = 'button'; drop.className = 'small patchdrop'; drop.textContent = '拿掉'; drop.title = '拿掉這個改動（可以還原）'; drop.onclick = () => removePatch(i);
    row.append(name, drop); box.appendChild(row);
  });
}
const isCustomNow = () => !!(CUSTOM && scene && CUSTOM.id === meta().id && sceneCode === CUSTOM.code);
function renderStyle() {
  const sel = $('#style'); sel.innerHTML = '';
  const list = BUILTIN.map(b => [b.id, b.id === meta().id ? meta().name : b.name]);
  if (CUSTOM && !BUILTIN.some(b => b.id === CUSTOM.id)) list.push([CUSTOM.id, 'AI 新風格：' + (CUSTOM.id === meta().id ? meta().name : CUSTOM.id)]);
  for (const [k, v] of list) { const o = document.createElement('option'); o.value = k; o.textContent = v; sel.appendChild(o); }
  sel.value = meta().id;
}
function renderGlobal() {
  const m = meta();
  if (document.activeElement !== $('#title')) $('#title').value = P.title;
  document.title = `${P.title}｜詩歌影片編輯器`;
  $('#bpm').value = P.bpm;
  const eb = effBpm();
  $('#bpmNote').textContent = Math.abs(eb - P.bpm) > 0.005 ? `為了讓背景頭尾接得起來，實際用 ${eb.toFixed(2)}。` : '';
  $('#styleDesc').textContent = (isCustomNow() && !builtinBase() ? withPeriod(m.description || 'AI 做的新風格') : m.description) + (m.patches.length ? `這首歌另外套用了 ${m.patches.length} 個改動（在「進階」可以拿掉）。` : '');
  const box = $('#swatches'); box.innerHTML = '';
  for (const k of palKeys(m)) {
    const l = document.createElement('label'), i = document.createElement('input');
    i.type = 'color'; i.value = P.palette[k] || m.palette[k]; i.setAttribute('aria-label', '顏色：' + ((m.labels || {})[k] || k));
    i.oninput = () => { P.palette[k] = i.value; save('改配色：' + ((m.labels || {})[k] || k), 'pal:' + k); deb(rebuild); };
    l.append(i, (m.labels || {})[k] || k); box.appendChild(l);
  }
  const pb = $('#params'); pb.innerHTML = '';
  for (const [k, d] of Object.entries(m.params)) {
    const l = document.createElement('label'); l.className = 'field';
    const s = document.createElement('span'); s.className = 'lab'; s.textContent = d.label;
    const i = document.createElement('input'); i.type = 'range'; i.className = 'grow'; i.min = d.min; i.max = d.max; i.step = d.step || (d.max - d.min) / 100; i.value = P.params[k] ?? d.value;
    const v = document.createElement('b'); v.style.fontSize = '13px'; v.textContent = (+i.value).toFixed(2).replace(/\.?0+$/, '');
    i.oninput = () => { P.params[k] = +i.value; v.textContent = (+i.value).toFixed(2).replace(/\.?0+$/, ''); save('改質感：' + d.label, 'prm:' + k); deb(rebuild); };
    l.append(s, i, v); pb.appendChild(l);
  }
  $('#noParams').hidden = !!Object.keys(m.params).length;
  $('#sceneName').textContent = `目前風格：${m.name}` + (isCustomNow() && !builtinBase() ? '（AI 做的新風格）' : '（內建）') + (m.patches.length ? `＋${m.patches.length} 個改動` : '') +
    (m.canvas ? '・自由畫層' + (canvasHost ? '' : '（停用）') : '') + (m.shader ? '・特效層' + (r.shader ? (r.shader.half ? '（半解析度）' : '') : '（停用）') : '') + (m.textures.length ? `・質感 ${m.textures.length} 層` : '');
  renderPatches();
  $('#songNote').hidden = !P.note; $('#songNote').textContent = P.note ? '這首歌的說明：' + P.note : '';
  renderSaveState();
}
function renderSecTabs() {
  const box = $('#secTabs'), old = [...box.querySelectorAll('.sectab [role=tab]')];
  if (old.length === P.sections.length && old.every((b, i) => b.textContent === P.sections[i].name && b.dataset.i === String(i))) { markSecTab(); return; }
  box.innerHTML = '';
  const lab = document.createElement('span'); lab.className = 'lab'; lab.textContent = '段落'; box.appendChild(lab);
  P.sections.forEach((s, i) => {
    const w = document.createElement('div'); w.className = 'sectab';
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = s.name; b.dataset.i = i;
    b.title = '點一下切換；按住拖曳調整順序；點兩下改名';
    b.onclick = () => { if (!justDragged() && i !== cur) pickSec(i); };
    b.ondblclick = () => { showTab('self'); $('#sName').focus(); $('#sName').select(); };
    b.onpointerdown = e => sortable(e, w, '.sectab', moveSecTo, renderSecTabsFresh);
    b.onkeydown = e => { const d = altArrow(e); if (d && moveSecTo(i, i + d)) $('#secTabs').querySelectorAll('[role=tab]')[i + d].focus({ preventScroll: true }); };
    w.append(b); box.appendChild(w);
  });
  const add = document.createElement('button'); add.type = 'button'; add.className = 'secadd'; add.textContent = '＋'; add.title = '新增段落'; add.setAttribute('aria-label', '新增段落');
  add.onclick = () => { addSection(); showTab('self'); $('#sName').focus(); $('#sName').select(); };
  box.appendChild(add); markSecTab();
}
const renderSecTabsFresh = () => { $('#secTabs').innerHTML = ''; renderSecTabs(); };
function markSecTab() {
  const tabs = [...$('#secTabs').querySelectorAll('.sectab')];
  tabs.forEach((w, i) => { w.firstChild.setAttribute('aria-selected', String(i === cur)); const x = w.querySelector('.secx'); if (x) x.remove(); });
  const w = tabs[cur]; if (!w || P.sections.length <= 1) return;
  const x = document.createElement('button'); x.type = 'button'; x.className = 'secx'; x.textContent = '×'; x.title = '刪除這一段（可以復原）';
  x.setAttribute('aria-label', `刪除「${P.sections[cur].name}」`); x.onclick = () => remove(cur); w.append(x);
}
function pickSec(i) { cur = i; clipIdx = 0; t = 0; setStep(2); return refresh(); }
function moveSecTo(from, to) {
  if (from === to || to < 0 || to >= P.sections.length) return false;
  const [s] = P.sections.splice(from, 1); P.sections.splice(to, 0, s);
  if (cur === from) cur = to; else if (from < cur && to >= cur) cur--; else if (from > cur && to <= cur) cur++;
  save(`段落「${s.name}」移到第 ${to + 1} 段`); refresh(); return true;
}
const altArrow = e => e.altKey && !e.ctrlKey && !e.metaKey ? (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0) : 0;
let dragEndAt = -Infinity;
const justDragged = () => performance.now() - dragEndAt < 350;
// 注意：被拖的元素在 DOM 裡搬動會失去 pointer capture，所以在 window 上聽 pointermove／pointerup。
// 注意：觸控要長按才開始拖，否則會搶走分頁列的左右滑動；開始拖之後要擋掉 touchmove，不然瀏覽器會改成捲動並送 pointercancel。
function sortable(e, item, sel, onDrop, restore) {
  if (e.button > 0 || exporting) return;
  const list = item.parentElement, items = () => [...list.querySelectorAll(':scope>' + sel)], from = items().indexOf(item);
  const x0 = e.clientX, y0 = e.clientY, touch = e.pointerType === 'touch';
  let on = false, timer = 0;
  const block = ev => ev.preventDefault();
  const start = () => { on = true; item.classList.add('lift'); document.body.classList.add('dragging'); addEventListener('touchmove', block, { passive: false }); addEventListener('contextmenu', block); };
  const nearest = (x, y) => items().map(el => { const r = el.getBoundingClientRect(); return { el, r, d: Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom)) }; }).sort((a, b) => a.d - b.d)[0];
  const onMove = ev => {
    if (!on) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < (touch ? 10 : 5)) return; if (touch) return end(ev); start(); }
    const n = nearest(ev.clientX, ev.clientY); if (!n || n.el === item) return;
    if (ev.clientX > n.r.left + n.r.width / 2) n.el.after(item); else n.el.before(item);
  };
  const end = ev => {
    clearTimeout(timer); removeEventListener('pointermove', onMove); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
    if (!on) return;
    removeEventListener('touchmove', block); setTimeout(() => removeEventListener('contextmenu', block), 400);
    item.classList.remove('lift'); document.body.classList.remove('dragging'); dragEndAt = performance.now();
    const to = items().indexOf(item);
    if (ev.type === 'pointercancel' || !onDrop(from, to)) restore();
  };
  if (touch) timer = setTimeout(start, 350);
  addEventListener('pointermove', onMove); addEventListener('pointerup', end); addEventListener('pointercancel', end);
}
function remove(i) {
  if (P.sections.length <= 1) { say('#secMsg', '至少要留一段。', true); return false; }
  const [s] = P.sections.splice(i, 1); undoDel = { s, i };
  if (cur > i || cur >= P.sections.length) cur = Math.max(0, cur - 1); clipIdx = 0; save(`刪除段落「${s.name}」`); refresh();
  say('#secMsg', `已刪除「${s.name}」。`);
  const u = document.createElement('button'); u.className = 'small'; u.id = 'undoDel'; u.textContent = '復原'; u.onclick = () => undoRemove(); $('#secMsg').append(' ', u);
  return true;
}
function undoRemove() {
  if (!undoDel) return false;
  const { s, i } = undoDel; undoDel = null; const at = Math.min(i, P.sections.length);
  P.sections.splice(at, 0, s); cur = at; clipIdx = 0; save(`復原段落「${s.name}」`); refresh(); say('#secMsg', `已復原「${s.name}」。`, 'ok');
  return true;
}
function addSection() {
  P.sections.push(defaultSection(meta(), `段落 ${P.sections.length + 1}`));
  cur = P.sections.length - 1; clipIdx = 0; t = 0; save('新增段落'); return refresh();
}
const secRefresh = label => { save(`${sec().name}：${label}`); refresh(); };
function renderSection() {
  const s = sec(), m = meta();
  $('#secTitle').textContent = s.name;
  if (document.activeElement !== $('#sName')) $('#sName').value = s.name;
  fillSeg($('#sBg'), Object.entries(m.backgrounds).map(([k, v]) => ({ v: k, label: v.label })), s.background, v => { sec().background = v; secRefresh('換背景'); });
  fillSeg($('#sJump'), JUMPS.map(j => ({ v: j, label: JUMP_WORD[j], sub: `每 ${j} 拍` })), s.jumpBeats, v => { sec().jumpBeats = v; secRefresh('色塊換位'); });
  fillSeg($('#sSub'), [{ v: 'none', label: '不要', sub: '只做背景' }, ...Object.entries(m.subtitles).map(([k, v]) => ({ v: k, label: v.label, sub: SPLIT_SHORT[v.split] || '' }))], s.subtitle,
    v => { sec().subtitle = v; if (m.subtitles[v]) sec().clipSeconds = m.subtitles[v].seconds; secRefresh('動態字幕'); });
  fillSeg($('#sLoop'), LOOPS.map(l => ({ v: l, label: `約 ${Math.round(frames32() * l / 32 / FPS)} 秒`, sub: `${l} 拍` })), s.loopBeats, v => { sec().loopBeats = v; secRefresh('循環長度'); });
  const d = m.subtitles[s.subtitle];
  $('#subDesc').textContent = !d ? '不要：不做字幕影片，歌詞用簡報軟體自己打。' : `${d.label}：${SPLIT_DESC[d.split] || ''}。`;
  $('#sDur').value = s.clipSeconds; $('#sEnter').value = s.enterSpeed; $('#sEnterV').textContent = s.enterSpeed + '×';
  $('#subOpts').hidden = s.subtitle === 'none';
  if ($('#sLyrics').value !== s.lyrics) $('#sLyrics').value = s.lyrics;
  if ($('#sLyrics2').value !== (s.lyrics2 || '')) $('#sLyrics2').value = s.lyrics2 || '';
  $('#sSwap').checked = !!s.swapLang;
  renderLyricHint();
}
function renderLyricHint() {
  const s = sec(), d = meta().subtitles[s.subtitle], el = $('#lyricHint'); el.textContent = '';
  if (!d) { el.textContent = '這段不做字幕影片，歌詞只當備註。'; return; }
  const b = document.createElement('b'); b.textContent = `會做成 ${slidesOf(s).length} 支字幕影片`;
  el.append(b, `　切法：${SPLIT_DESC[d.split] || ''}`);
  if ((s.lyrics2 || '').trim()) el.append(`；第二語言用同樣的切法逐行配對，${s.swapLang ? '第二語言大、第一語言小' : '第一語言大、第二語言小'}`);
}
const clipLabel = (s, i) => i === 0 ? '背景（會循環）' : `字幕 ${i}：${slidesOf(s)[i - 1].replace(/[\[\]]/g, '').replace(/\n/g, ' / ')}（播一次停住）`;
function renderClips() {
  const box = $('#clips'); box.innerHTML = ''; const s = sec(), sl = slidesOf(s);
  if (clipIdx > sl.length) clipIdx = 0;
  const bgSec = frames32() * s.loopBeats / 32 / FPS;
  for (let i = 0; i <= sl.length; i++) {
    const b = document.createElement('button'); b.className = 'clip' + (i ? '' : ' bgc'); b.setAttribute('aria-pressed', String(i === clipIdx));
    const n = document.createElement('span'); n.className = 'n'; n.textContent = clipLabel(s, i);
    const cm = document.createElement('span'); cm.className = 'cm'; cm.textContent = i ? `${s.clipSeconds} 秒` : `${Math.round(bgSec)} 秒・接回開頭`;
    b.append(n, cm); b.title = n.textContent;
    b.onclick = () => { clipIdx = i; t = 0; setPlaying(true); setStep(2); renderClips(); rebuild(); };
    box.appendChild(b);
  }
  if (s.subtitle === 'none' || !sl.length) {
    const p = document.createElement('p'); p.className = 'hint';
    p.append(s.subtitle === 'none' ? '這段只有背景，歌詞用簡報軟體打。要做字幕影片：' : '選了動態字幕，但還沒有歌詞：');
    const go = document.createElement('button'); go.className = 'link'; go.textContent = s.subtitle === 'none' ? '自己調 → 動態字幕' : '自己調 → 貼歌詞';
    go.onclick = () => { showTab('self'); $('#secCard').scrollIntoView({ block: 'nearest' }); (s.subtitle === 'none' ? $('#sSub button') : $('#sLyrics')).focus(); };
    p.append(go);
    if (s.subtitle !== 'none' && !P.sections.some(x => (x.lyrics || '').trim())) {
      const all = document.createElement('button'); all.className = 'link'; all.textContent = '貼上整首歌詞（自己調 → 貼上整首歌詞）';
      all.onclick = () => $('#lyrFromAI').click(); p.append('；或一次', all);
    }
    box.appendChild(p);
  }
  $('#clipCount').textContent = `「${s.name}」共 ${sl.length + 1} 支・匯出這一段就是這些`;
  const total = P.sections.reduce((a, x) => a + 1 + slidesOf(x).length, 0);
  $('#exOneD').textContent = `上面預覽中的「${i0name(s)}」`;
  $('#exSecD').textContent = `「${s.name}」的背景` + (sl.length ? `＋${sl.length} 支字幕` : '（1 支）');
  $('#exSongD').textContent = `${P.sections.length} 段，共 ${total} 支；檔名照順序編號`;
  renderElements();
  $('#exAllD').textContent = SONGS.length > 1 ? `${SONGS.length} 首（全部分頁），依分頁順序、每首一個資料夾` : '只有這一首（多開幾個分頁就能一次匯出）';
}
const i0name = s => clipIdx === 0 ? '背景' : `字幕 ${clipIdx}`;
function stepClip(d) {
  const n = slidesOf(sec()).length + 1, i = clipIdx + d;
  if (i >= 0 && i < n) { clipIdx = i; t = 0; setPlaying(true); setStep(2); renderClips(); return rebuild(); }
  const j = cur + d; if (j < 0 || j >= P.sections.length) return;
  cur = j; clipIdx = d > 0 ? 0 : slidesOf(P.sections[j]).length; t = 0; setPlaying(true); setStep(2); return refresh();
}
function setPlaying(on) { playing = on; $('#play').textContent = on ? '暫停' : '播放'; $('#play').setAttribute('aria-label', on ? '暫停' : '播放'); }
function refresh() { renderSongTabs(); renderGlobal(); renderSecTabs(); renderSection(); renderClips(); return rebuild(); }
let elScope = 'song';
const pct = v => Math.round(v * 100) + '%', num = v => (+v).toFixed(2).replace(/\.?0+$/, '');
function elementsNow() {
  const m = meta(), s = sec(), adj = clipElements(s), pal = resolvedPal();
  return clipElementIds(s, clipIdx, m).map(id => { const d = m.elements[id], a = adj[id] || {};
    return { id, label: d.label, fixed: !!d.fixed, added: d.patch !== null && d.patch !== undefined, locked: !!a.locked, visible: a.visible !== false, opacity: a.opacity ?? 1, drawn: drawnByElement[id] || 0,
      dx: a.dx ?? 0, dy: a.dy ?? 0, scale: a.scale ?? 1, rotate: a.rotate ?? 0, box: frameBoxes[id] || null,
      params: Object.fromEntries(Object.entries(d.params).map(([k, p]) => [k, { ...p, value: (a.params || {})[k] ?? p.value }])),
      colors: Object.fromEntries(d.colors.map(k => [k, (a.colors || {})[k] || pal[k]])) }; });
}
function elementLabel(d, patch) {
  const name = `元素「${d.label}」`;
  if (patch.visible !== undefined) return (patch.visible ? '顯示' : '隱藏') + name;
  if (patch.locked !== undefined) return (patch.locked ? '鎖定' : '解鎖') + name;
  if (patch.opacity !== undefined) return `${name}透明度 ${pct(patch.opacity)}`;
  if (patch.dx !== undefined || patch.dy !== undefined) return '移動' + name;
  if (patch.scale !== undefined) return '縮放' + name;
  if (patch.rotate !== undefined) return '旋轉' + name;
  const k = Object.keys(patch.params || {})[0];
  return k && d.params[k] ? `${name}：${d.params[k].label}` : `${name}換色`;
}
const scopeHost = scope => scope === 'section' ? sec() : P;
const scopePrefix = scope => scope === 'section' ? sec().name + '：' : '';
function writeElement(id, patch, scope = elScope) {
  const m = meta(), d = ownProp(m.elements, id); if (!d) return null;
  const host = scopeHost(scope), next = mergeAdj((host.elements || {})[id], readElements({ [id]: patch }, m, '', [], [])[id]);
  const { [id]: before, ...others } = host.elements || {};
  setOrDrop(host, { ...others, ...pruneElements({ [id]: next }, m, scope === 'section' ? P.elements : {}) });
  followedSong = scope === 'song' && followSong(id, patch, m);
  return d;
}
// 注意：這一段自己有同一項調整時，整首歌的值在這一段看不到；在「整首歌」調的那一項要從這一段拿掉，畫面才會跟著動
let followedSong = false;
const FOLLOWED_NOTE = '（這一段改成跟著整首歌）';
function followSong(id, patch, m) {
  const own = ownProp(sec().elements || {}, id); if (!own) return false;
  const left = { ...own };
  for (const [k, v] of Object.entries(patch)) {
    if (!isObj(v)) { delete left[k]; continue; }
    left[k] = Object.fromEntries(Object.entries(own[k] || {}).filter(([sub]) => !(sub in v)));
  }
  const { [id]: was, ...others } = sec().elements;
  setOrDrop(sec(), { ...others, ...pruneElements({ [id]: left }, m, null) });
  return JSON.stringify(left) !== JSON.stringify(own);
}
function applyElement(id, patch, scope = elScope) {
  const d = writeElement(id, patch, scope); if (!d) return false;
  save(scopePrefix(scope) + elementLabel(d, patch) + (followedSong ? FOLLOWED_NOTE : ''), `el:${scope}:${id}:${JSON.stringify(Object.keys(patch).map(k => [k, Object.keys(Object(patch[k]))]))}`);
  syncElementRows(); return true;
}
function setElement(id, patch, scope) { return applyElement(id, patch, scope) && rebuild(); }
const tuneElement = (id, patch) => { applyElement(id, patch); deb(rebuild); };
function resetElement(id, scope = elScope) {
  const m = meta(), d = ownProp(m.elements, id), host = scope === 'section' ? sec() : P; if (!d || !ownProp(host.elements || {}, id)) return false;
  const { [id]: gone, ...rest } = host.elements; setOrDrop(host, gone.locked ? { ...rest, [id]: { locked: true } } : rest);
  save(`${scope === 'section' ? sec().name + '：' : ''}元素「${d.label}」還原`); renderElements(); return rebuild();
}
function syncElementRows() {
  const now = Object.fromEntries(elementsNow().map(e => [e.id, e]));
  const still = selEls.filter(id => selectable(now[id])); if (still.length !== selEls.length) { selEls = still; renderStage(); }
  const own = (elScope === 'section' ? sec() : P).elements || {}, other = elScope === 'section' ? {} : sec().elements || {};
  document.querySelectorAll('#elList .elrow').forEach(row => {
    const e = now[row.dataset.id]; if (!e) return;
    row.querySelector('.elvis').checked = e.visible; row.classList.toggle('off', !e.visible); row.classList.toggle('sel', isSelected(e.id));
    row.querySelectorAll('.elnum').forEach(i => { i.disabled = e.locked; if (document.activeElement !== i) i.value = i.dataset.k === 'scale' ? Math.round(e.scale * 100) : e[i.dataset.k]; });
    const lock = row.querySelector('.ellock'); if (lock) { lock.setAttribute('aria-pressed', String(e.locked)); lock.textContent = e.locked ? '已鎖定' : '鎖定'; }
    const op = row.querySelector('.elop'); if (document.activeElement !== op) op.value = Math.round(e.opacity * 100);
    row.querySelector('.elopv').textContent = pct(e.opacity);
    row.querySelectorAll('.elparam').forEach(i => { if (document.activeElement !== i) { i.value = e.params[i.dataset.k].value; i.nextElementSibling.textContent = num(i.value); } });
    row.querySelectorAll('.elcolor input').forEach(i => { if (document.activeElement !== i) i.value = e.colors[i.dataset.k]; });
    row.querySelector('.elreset').hidden = !own[e.id];
    row.querySelector('.elnote').textContent = other[e.id] ? '這一段有自己的設定' : '';
  });
}
function renderElements() {
  { const all = elementsNow(); selEls = selEls.filter(id => selectable(all.find(e => e.id === id))); }
  const list = elementsNow().reverse(), box = $('#elList'), open = new Set([...box.querySelectorAll('.elrow.open')].map(r => r.dataset.id)), m = meta();
  fillSeg($('#elScope'), [{ v: 'song', label: '整首歌' }, { v: 'section', label: '只有這一段' }], elScope, v => { elScope = v; renderElements(); });
  $('#elDesc').textContent = `預覽中的「${i0name(sec())}」由這 ${list.length} 個元素疊起來，上面的列畫在上面。`;
  box.innerHTML = '';
  for (const e of list) {
    const row = document.createElement('div'); row.className = 'elrow'; row.dataset.id = e.id;
    const head = document.createElement('div'); head.className = 'elhead';
    const lab = document.createElement('span'); lab.className = 'elshow';
    const vis = document.createElement('input'); vis.type = 'checkbox'; vis.className = 'elvis'; vis.title = '顯示這個元素'; vis.setAttribute('aria-label', `顯示「${e.label}」`);
    const name = document.createElement('button'); name.type = 'button'; name.className = 'elname'; name.textContent = e.label;
    name.title = e.fixed ? '鋪滿畫面的元素：可以隱藏、調透明度，不能移動' : '在預覽上選取這個元素';
    name.onclick = () => selectElement(selEls.length === 1 && isSelected(e.id) ? null : e.id);
    lab.append(vis, name);
    const op = document.createElement('input'); op.type = 'range'; op.className = 'elop'; op.min = 0; op.max = 100; op.step = 1; op.setAttribute('aria-label', `「${e.label}」的透明度`);
    const opv = document.createElement('b'); opv.className = 'elopv';
    vis.onchange = () => setElement(e.id, { visible: vis.checked });
    op.oninput = () => { opv.textContent = op.value + '%'; tuneElement(e.id, { opacity: op.value / 100 }); };
    head.append(lab, op, opv);
    const detail = document.createElement('div'); detail.className = 'eldetail';
    for (const [k, col] of Object.entries(e.colors)) {
      const l = document.createElement('label'), i = document.createElement('input'), text = (m.labels || {})[k] || k;
      i.type = 'color'; i.dataset.k = k; i.value = col; i.setAttribute('aria-label', `「${e.label}」的顏色：${text}`);
      i.oninput = () => tuneElement(e.id, { colors: { [k]: i.value } });
      l.className = 'elcolor'; l.append(i, text); detail.appendChild(l);
    }
    for (const [k, p] of Object.entries(e.params)) {
      const l = document.createElement('label'); l.className = 'field';
      const s = document.createElement('span'); s.className = 'lab'; s.textContent = p.label;
      const i = document.createElement('input'); i.type = 'range'; i.className = 'grow elparam'; i.dataset.k = k; i.min = p.min; i.max = p.max; i.step = p.step || (p.max - p.min) / 100; i.value = p.value;
      const v = document.createElement('b'); v.className = 'elopv'; const show = () => { v.textContent = num(i.value); }; show();
      i.oninput = () => { show(); tuneElement(e.id, { params: { [k]: +i.value } }); };
      l.append(s, i, v); detail.appendChild(l);
    }
    if (!e.fixed) for (const [k, text, unit, step] of [['dx', '往右', '', 1], ['dy', '往下', '', 1], ['scale', '大小', '%', 1], ['rotate', '旋轉', '°', 1]]) {
      const l = document.createElement('label'); l.className = 'elplace'; const i = document.createElement('input');
      i.type = 'number'; i.className = 'elnum'; i.dataset.k = k; i.step = step; i.setAttribute('aria-label', `「${e.label}」${text}`);
      i.oninput = () => { if (i.value !== '' && isFinite(+i.value)) tuneElement(e.id, { [k]: k === 'scale' ? i.value / 100 : +i.value }); };
      l.append(text, i, unit); detail.appendChild(l);
    }
    if (detail.childElementCount) {
      const more = document.createElement('button'); more.type = 'button'; more.className = 'small elmore'; more.textContent = '細部';
      const toggle = on => { row.classList.toggle('open', on); more.setAttribute('aria-expanded', String(on)); detail.hidden = !on; };
      more.onclick = () => toggle(!row.classList.contains('open')); toggle(open.has(e.id));
      head.append(more);
    }
    if (!e.fixed) { const lock = document.createElement('button'); lock.type = 'button'; lock.className = 'small ellock'; lock.title = '鎖定後，在預覽上點不到也拖不動這個元素'; lock.onclick = () => setElement(e.id, { locked: lock.getAttribute('aria-pressed') !== 'true' }, 'song'); head.append(lock); }
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'small elreset'; reset.textContent = '還原'; reset.title = '把這個元素還原成風格原本的樣子'; reset.onclick = () => resetElement(e.id);
    if (e.added) { const del = document.createElement('button'); del.type = 'button'; del.className = 'small eldelete'; del.textContent = '刪除'; del.title = '這個元素是 AI 加的，刪除後可以還原'; del.onclick = () => deleteElement(e.id); head.append(del); }
    const note = document.createElement('span'); note.className = 'elnote';
    head.append(reset, note); row.append(head, detail); box.appendChild(row);
  }
  syncElementRows(); renderStage();
}
let lyrPlan = null, lyrUndo = null;
function lyrOpts() {
  const v = n => (document.querySelector(`input[name="${n}"]:checked`) || {}).value;
  return { trad: $('#lyrTrad').checked, lang: v('lyrLang') || 'both', target: v('lyrTarget') || 'lyrics' };
}
function renderLyrPlan() {
  const pl = lyrPlan = planSplit($('#lyrAll').value, lyrOpts()), box = $('#lyrBody'); box.innerHTML = '';
  $('#lyrLangRow').hidden = !pl.bilingual; $('#lyrTargetRow').hidden = pl.bilingual;
  const p = (txt, cls) => { const e = document.createElement('p'); e.className = cls || 'hint'; e.textContent = txt; box.append(e); return e; };
  if (!pl.plan.length) { p('沒有找到可以放進段落的歌詞。', 'badline'); $('#lyrApply').disabled = true; return pl; }
  p(pl.mode === 'headers' ? '依段落標題分段：' : '沒有段落標題，依空行分段、照順序填進現有段落：');
  const ul = document.createElement('ul'); ul.className = 'lyrlist';
  for (const e of pl.plan) {
    const li = document.createElement('li'), b = document.createElement('b'); b.textContent = e.name;
    const tag = document.createElement('span'); tag.className = 'chip' + (e.isNew ? ' g' : ''); tag.textContent = e.isNew ? (e.from ? `新增・沿用「${e.from}」的設定` : '新增') : e.replaces ? '取代原本的歌詞' : '填進這一段';
    const m = document.createElement('span'); m.className = 'dim'; m.textContent = `${e.head ? e.head + ' → ' : ''}${e.lines} 行${e.slides > 1 ? `、${e.slides} 組` : ''}${pl.bilingual && pl.lang === 'both' ? '（中文＋英文第二語言）' : pl.bilingual && pl.lang === 'bothEn' ? '（英文＋中文第二語言）' : ''}`;
    li.append(b, ' ', tag, ' ', m); ul.append(li);
  }
  box.append(ul);
  if (pl.removed.length) p(`已拿掉 ${pl.removed.length} 行版權說明（詞、曲、©、CCLI 開頭），不會放進歌詞。`);
  for (const k of pl.skipped) p(`略過：${k.why}（${k.lines} 行）。`);
  if (pl.long.length) p(`有 ${pl.long.length} 行比較長，字幕會自動縮小；想要好讀，請套用後自己斷行（編輯器不會改你的字）。`, 'warnline');
  $('#lyrApply').disabled = false;
  return pl;
}
function openLyricsDialog() {
  const text = $('#lyrAll').value;
  if (!text.trim()) { say('#lyrInMsg', '先把整首歌詞貼到上面的框裡。', true); $('#lyrAll').focus(); return false; }
  say('#lyrInMsg', ''); closeDlg($('#lyrInDlg'));
  renderLyrPlan(); const d = $('#lyrDlg');
  try { d.showModal(); } catch (e) { d.setAttribute('open', ''); }
  return true;
}
function closeDlg(d) { if (d.open) d.close(); else d.removeAttribute('open'); }
function closeLyr() { closeDlg($('#lyrDlg')); }
function openLyricsInput() {
  const d = $('#lyrInDlg'); say('#lyrInMsg', '');
  try { d.showModal(); } catch (e) { d.setAttribute('open', ''); }
  $('#lyrAll').focus();
}
function renderSongName() { const b = document.querySelector(`#songTabs .stab[data-i="${ACT}"] .sname`); if (b && P) b.textContent = P.title; }
function renderSongTabs() {
  const box = $('#songTabs'); box.innerHTML = '';
  SONGS.forEach((s, i) => {
    const on = i === ACT, d = document.createElement('div'); d.className = 'stab'; d.dataset.i = i;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sname'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(on));
    b.textContent = songTitle(i); b.title = on ? '目前這首（點兩下改名；按住拖曳排序）' : '切到這首（按住拖曳排序）'; b.disabled = exporting;
    b.onclick = () => { if (!on && !justDragged()) switchSong(i); }; b.ondblclick = () => renameSong(i);
    b.onpointerdown = e => sortable(e, d, '.stab', moveSongTo, renderSongTabs);
    b.onkeydown = e => { const k = altArrow(e); if (k && moveSongTo(i, i + k)) $('#songTabs').querySelectorAll('.sname')[i + k].focus({ preventScroll: true }); };
    d.append(b);
    if (on) { const mb = document.createElement('button'); mb.type = 'button'; mb.className = 'smenu'; mb.textContent = '⋯'; mb.setAttribute('aria-label', '這一首的選項（改名、排序、還原到初始狀態、只存這一首、關閉）'); mb.setAttribute('aria-haspopup', 'menu'); mb.disabled = exporting; mb.onclick = e => { e.stopPropagation(); openSongMenu(mb); }; d.append(mb); }
    if (SONGS.length > 1) { const x = document.createElement('button'); x.type = 'button'; x.className = 'sclose'; x.textContent = '×'; x.setAttribute('aria-label', `關閉「${songTitle(i)}」`); x.disabled = exporting; x.onclick = e => { e.stopPropagation(); closeSong(i); }; d.append(x); }
    box.appendChild(d);
  });
  const a = box.querySelector('.sname[aria-selected=true]'); if (a) revealInRow(a.parentElement);
}
// 注意：scrollIntoView 會連整頁一起捲；每次 refresh 都會重畫分頁列，只能捲分頁列本身的 scrollLeft。
function revealInRow(el) {
  const row = el.closest('.songrow'); if (!row) return;
  const r = el.getBoundingClientRect(), c = row.getBoundingClientRect();
  if (r.left < c.left) row.scrollLeft += r.left - c.left; else if (r.right > c.right) row.scrollLeft += r.right - c.right;
}
function openSongMenu(btn) {
  const m = $('#songMenu'), rc = btn.getBoundingClientRect();
  m.hidden = false; m.style.left = Math.max(8, Math.min(innerWidth - 240, rc.left)) + 'px'; m.style.top = (rc.bottom + 4) + 'px';
  $('#smLeft').disabled = ACT === 0; $('#smRight').disabled = ACT >= SONGS.length - 1; $('#smClose').disabled = SONGS.length <= 1;
  m.querySelector('button').focus();
}
function closeSongMenu() { $('#songMenu').hidden = true; }
