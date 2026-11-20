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

const TABS = ['ai', 'self', 'adv'];
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
  $('#styleDesc').textContent = isCustomNow() ? `${withPeriod(m.description || 'AI 做的新風格')}想改它的長相：「請 AI 改」勾選「連同新風格的程式」。` : m.description;
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
  $('#sceneName').textContent = `目前風格：${m.name}` + (isCustomNow() ? '（AI 做的新風格）' : '（內建）') +
    (m.canvas ? '・自由畫層' + (canvasHost ? '' : '（停用）') : '') + (m.shader ? '・特效層' + (r.shader ? (r.shader.half ? '（半解析度）' : '') : '（停用）') : '') + (m.textures.length ? `・質感 ${m.textures.length} 層` : '');
  $('#withCodeRow').hidden = !isCustomNow();
  $('#songNote').hidden = !P.note; $('#songNote').textContent = P.note ? '這首歌的說明：' + P.note : '';
  renderSaveState();
}
function renderSecTabs() {
  const box = $('#secTabs'); box.innerHTML = '';
  const lab = document.createElement('span'); lab.className = 'lab'; lab.textContent = '段落'; box.appendChild(lab);
  P.sections.forEach((s, i) => {
    const b = document.createElement('button'); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(i === cur)); b.textContent = s.name;
    b.onclick = () => pickSec(i); box.appendChild(b);
  });
  const add = document.createElement('button'); add.textContent = '＋'; add.title = '新增段落'; add.setAttribute('aria-label', '新增段落');
  add.onclick = () => { addSection(); showTab('self'); $('#sName').focus(); $('#sName').select(); };
  box.appendChild(add);
}
function pickSec(i) { cur = i; clipIdx = 0; t = 0; setStep(2); return refresh(); }
function renderSections() {
  const box = $('#secList'); box.innerHTML = ''; const m = meta();
  P.sections.forEach((s, i) => {
    const d = document.createElement('div'); d.className = 'sec'; d.setAttribute('aria-current', i === cur ? 'true' : 'false'); d.tabIndex = 0;
    const n = document.createElement('span'); n.className = 'n'; n.textContent = `${i + 1}. ${s.name}`;
    const k = slidesOf(s).length;
    const mm = document.createElement('span'); mm.className = 'm'; mm.textContent = `${m.backgrounds[s.background].label}・${s.subtitle === 'none' ? '無字幕' : `${m.subtitles[s.subtitle].label} ${k} 支`}`;
    d.append(secGrip(s, i), n, mm, btn('刪除', `刪除「${s.name}」`, () => remove(i)));
    d.onclick = e => { if (e.target.tagName !== 'BUTTON') pickSec(i); };
    d.onkeydown = e => { if (e.key === 'Enter' && e.target === d) pickSec(i); };
    box.appendChild(d);
  });
}
function btn(txt, aria, fn) { const b = document.createElement('button'); b.className = 'small'; b.textContent = txt; b.setAttribute('aria-label', aria); b.onclick = e => { e.stopPropagation(); fn(); }; return b; }
function moveSecTo(from, to) {
  if (from === to || to < 0 || to >= P.sections.length) return false;
  const [s] = P.sections.splice(from, 1); P.sections.splice(to, 0, s);
  if (cur === from) cur = to; else if (from < cur && to >= cur) cur--; else if (from > cur && to <= cur) cur++;
  save(`段落「${s.name}」移到第 ${to + 1} 段`); refresh(); return true;
}
function secGrip(s, i) {
  const g = document.createElement('button'); g.type = 'button'; g.className = 'grip'; g.textContent = '⠿';
  g.title = '按住拖曳調整順序'; g.setAttribute('aria-label', `調整「${s.name}」的順序：按住拖曳，或按 ↑ ↓`);
  g.onclick = e => e.stopPropagation();
  g.onpointerdown = e => dragSec(e, i);
  g.onkeydown = e => {
    const d = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0; if (!d) return;
    e.preventDefault(); if (moveSecTo(i, i + d)) $('#secList').children[i + d].querySelector('.grip').focus({ preventScroll: true });
  };
  return g;
}
// 注意：被拖的列在 DOM 裡搬動會失去 pointer capture，所以在 window 上聽 pointermove／pointerup。
function dragSec(e, from) {
  if (e.button > 0) return; e.preventDefault();
  const list = $('#secList'), row = list.children[from], mid = el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
  row.classList.add('lift'); document.body.classList.add('dragging');
  const onMove = ev => {
    for (;;) {
      const prev = row.previousElementSibling, next = row.nextElementSibling;
      if (next && ev.clientY > mid(next)) list.insertBefore(next, row);
      else if (prev && ev.clientY < mid(prev)) list.insertBefore(row, prev);
      else break;
    }
  };
  const onEnd = ev => {
    removeEventListener('pointermove', onMove); removeEventListener('pointerup', onEnd); removeEventListener('pointercancel', onEnd);
    document.body.classList.remove('dragging');
    const to = [...list.children].indexOf(row);
    if (ev.type === 'pointercancel' || !moveSecTo(from, to)) renderSections();
  };
  addEventListener('pointermove', onMove); addEventListener('pointerup', onEnd); addEventListener('pointercancel', onEnd);
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
    b.onclick = () => { clipIdx = i; t = 0; playing = true; $('#play').textContent = '暫停'; setStep(2); renderClips(); rebuild(); };
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
  $('#exAllD').textContent = SONGS.length > 1 ? `${SONGS.length} 首（全部分頁），依分頁順序、每首一個資料夾` : '只有這一首（多開幾個分頁就能一次匯出）';
}
const i0name = s => clipIdx === 0 ? '背景' : `字幕 ${clipIdx}`;
function refresh() { renderSongTabs(); renderGlobal(); renderSecTabs(); renderSections(); renderSection(); renderClips(); return rebuild(); }
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
  if (!text.trim()) { say('#lyrAllMsg', '先把整首歌詞貼到上面的框裡。', true); $('#lyrAll').focus(); return false; }
  say('#lyrAllMsg', '');
  renderLyrPlan(); const d = $('#lyrDlg');
  try { d.showModal(); } catch (e) { d.setAttribute('open', ''); }
  return true;
}
function closeLyr() { const d = $('#lyrDlg'); if (d.open) d.close(); else d.removeAttribute('open'); }
function renderSongName() { const b = document.querySelector(`#songTabs .stab[data-i="${ACT}"] .sname`); if (b && P) b.textContent = P.title; }
function renderSongTabs() {
  const box = $('#songTabs'); box.innerHTML = '';
  SONGS.forEach((s, i) => {
    const on = i === ACT, d = document.createElement('div'); d.className = 'stab'; d.dataset.i = i; d.draggable = !exporting;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sname'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(on));
    b.textContent = songTitle(i); b.title = on ? '目前這首（點兩下改名；可以拖曳排序）' : '切到這首（可以拖曳排序）'; b.disabled = exporting;
    b.onclick = () => { if (!on) switchSong(i); }; b.ondblclick = () => renameSong(i);
    d.append(b);
    if (on) { const mb = document.createElement('button'); mb.type = 'button'; mb.className = 'smenu'; mb.textContent = '⋯'; mb.setAttribute('aria-label', '這一首的選項（改名、排序、還原到初始狀態、只存這一首、關閉）'); mb.setAttribute('aria-haspopup', 'menu'); mb.disabled = exporting; mb.onclick = e => { e.stopPropagation(); openSongMenu(mb); }; d.append(mb); }
    if (SONGS.length > 1) { const x = document.createElement('button'); x.type = 'button'; x.className = 'sclose'; x.textContent = '×'; x.setAttribute('aria-label', `關閉「${songTitle(i)}」`); x.disabled = exporting; x.onclick = e => { e.stopPropagation(); closeSong(i); }; d.append(x); }
    d.ondragstart = e => { e.dataTransfer.setData('text/plain', String(i)); d.classList.add('drag'); };
    d.ondragend = () => d.classList.remove('drag');
    d.ondragover = e => { e.preventDefault(); d.classList.add('over'); };
    d.ondragleave = () => d.classList.remove('over');
    d.ondrop = e => { e.preventDefault(); d.classList.remove('over'); const from = +e.dataTransfer.getData('text/plain'); if (isFinite(from)) moveSongTo(from, i); };
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
