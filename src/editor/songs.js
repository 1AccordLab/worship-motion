let uidN = 0;
const newUid = () => 's' + Date.now().toString(36) + (uidN++).toString(36) + Math.random().toString(36).slice(2, 6);
const asCustom = c => c && c.code ? { id: String(c.id || 'custom').toLowerCase(), code: withPatchCalls(c.code), ...(typeof c.name === 'string' && c.name ? { name: c.name } : {}) } : null;
function customsFrom(x) {
  const out = [];
  for (const c of [...(Array.isArray(x.customs) ? x.customs : []), x.custom].map(asCustom)) if (c && !out.some(o => o.id === c.id)) out.push(c);
  return byId(out);
}
const mkSong = x => ({ uid: x.uid || newUid(), hist: x.hist || null, P: x.P || null, customs: customsFrom(x), fresh: x.fresh || null, orig: x.orig || null, cur: 0, clipIdx: 0 });
const songFromFile = e => mkSong({ P: e.project, customs: e.scenes, custom: e.scene });
function stash() { const s = SONGS[ACT]; if (s && P && !SWITCHING) { s.P = P; s.cur = cur; s.clipIdx = clipIdx; s.customs = CUSTOMS; } }
function persist() { stash(); store.set('book', JSON.stringify({ v: 1, active: ACT, songs: SONGS.map(s => ({ uid: s.uid, P: s.P, customs: s.customs, fresh: s.fresh, orig: s.orig })) })); }
function save(label = '調整設定', key = null) { persist(); commit(label, key); renderSaveState(); renderSongName(); }
const snapWith = shape => { stash(); return fnv(JSON.stringify(SONGS.map(s => [s.P, s.customs.map(c => shape(c.code)).join('\n')]))); };
const snap = () => snapWith(code => code);
const isSaved = () => !!P && store.get('saved') === snap();
const isFresh = () => !!P && !!SONGS[ACT] && SONGS[ACT].fresh === fnv(JSON.stringify(P));
function renderSaveState() {
  if (!P) return; const s = isSaved(), n = SONGS.length;
  $('#saveState').classList.toggle('saved', s);
  $('#saveText').textContent = n > 1 ? (s ? `整本 ${n} 首已存成檔案` : `整本 ${n} 首：這台電腦已暫存，還沒存成檔案`) : (s ? '已存成檔案' : '這台電腦已暫存，還沒存成檔案');
}
function markSaved() { store.set('saved', snap()); renderSaveState(); }
function markFresh() { if (SONGS[ACT]) SONGS[ACT].fresh = fnv(JSON.stringify(P)); persist(); renderSaveState(); }
function songsFromFile(text) {
  const head = text.slice(0, 2000);
  if (/<!doctype html|<html/i.test(head)) {
    const doc = new DOMParser().parseFromString(text, 'text/html'), pj = doc.querySelector('#wm-project');
    if (!pj) throw new Error('這個 HTML 不是「詩歌影片編輯器」存的檔案。');
    const raw = JSON.parse(pj.textContent || 'null');
    if (!raw || !Array.isArray(raw.songs)) throw new Error('這個檔案裡沒有歌曲設定（可能是空白的編輯器）。');
    return raw.songs.map(songFromFile);
  }
  const p = splitPaste(text);
  if (p.json && Array.isArray(p.json.songs)) return p.json.songs.map(songFromFile);
  if (!p.json) throw new Error(p.jsonErr || '找不到設定。');
  const id = p.code ? (/\bid\s*:\s*['"]([A-Za-z][A-Za-z0-9_-]{1,40})['"]/.exec(p.code) || [])[1] : null;
  return [mkSong({ P: p.json, custom: p.code ? { id: id || 'custom', code: p.code } : null })];
}
async function importText(text, where = '#fileMsg') {
  let list;
  try { list = songsFromFile(String(text || '')); } catch (e) { say(where, '打不開：' + e.message, true); return false; }
  stash();
  const fresh = isFresh() && SONGS.length >= 1, at = fresh ? ACT : ACT + 1;
  SONGS.splice(at, fresh ? 1 : 0, ...list);
  await activate(at, { noStash: true });
  say(where, `已打開 ${list.length} 首，放在${list.length > 1 ? '新的分頁' : fresh ? '目前分頁' : '新分頁'}：${list.map(s => '「' + ((s.P && s.P.title) || '未命名') + '」').join('、')}。`, 'ok');
  return true;
}
function moveSongTo(from, to) {
  if (exporting || from === to || from < 0 || to < 0 || from >= SONGS.length || to >= SONGS.length) return false;
  stash(); const act = SONGS[ACT], [m] = SONGS.splice(from, 1); SONGS.splice(to, 0, m); ACT = SONGS.indexOf(act);
  persist(); renderSongTabs(); renderSaveState(); return true;
}
const moveSong = (i, d) => moveSongTo(i, i + d);
async function switchSong(i) {
  if (exporting || i === ACT || i < 0 || i >= SONGS.length) return false;
  closeSongMenu(); await activate(i);
  ['#cfgStatus', '#copyMsg', '#secMsg', '#lyrMsg', '#selfMsg'].forEach(s => say(s, ''));
  return true;
}
// 注意：一次只切一個分頁；連點兩個分頁時排隊，不會互相寫錯歌
let actQ = Promise.resolve();
function activate(i, o) { const run = () => activate0(i, o); const pr = actQ.then(run, run); actQ = pr.catch(() => { }); return pr; }
async function activate0(i, { first = false, noStash = false } = {}) {
  if (!first && !noStash) stash();
  SWITCHING = true;
  try { await activateInner(i, first); } finally { SWITCHING = false; }
  noteOrig(SONGS[ACT]); persist(); histOf(SONGS[ACT]); histSel = -1; renderUndo();
  if (!first) { renderStyle(); await refresh(); }
}
async function activateInner(i, first) {
  ACT = Math.max(0, Math.min(i, SONGS.length - 1)); const sg = SONGS[ACT]; CUSTOMS = sg.customs || [];
  const raw = sg.P && typeof sg.P === 'object' ? sg.P : clone(SAMPLE);
  const want = raw.style ? String(raw.style).toLowerCase() : BUILTIN[0].id, src = sourceFor(want);
  if (!(scene && src && scene.code === src.code)) {
    let ok = false;
    if (src) {
      try { await useStyle(want); ok = true; }
      catch (e) { notice('scene', `「${raw.title || ''}」的風格「${want}」載入失敗：${fmtErr(e)}。先用內建「${BUILTIN[0].name}」。`, e.retry ? { label: '仍要試跑', fn: async () => { unSuspect(e.retry); notices.delete('scene'); await applyStyle(want); } } : null); }
    } else notice('scene', `「${raw.title || ''}」用的風格「${want}」找不到（新風格的程式沒有一起存），先用內建「${BUILTIN[0].name}」。`);
    if (!ok && !(scene && scene.code === BUILTIN[0].code)) await commitScene(await prepareScene(BUILTIN[0].code, false));
  } else if (src.custom && !(customOf(want) && customOf(want).code === src.code)) putCustom({ id: want, code: src.code, name: meta().name });
  let n = normalize(raw, meta(), meta().id);
  if (!n.project) { const q = clone(raw); adapt(q, meta()); n = normalize(q, meta(), meta().id); }
  P = n.project || (() => { const q = clone(SAMPLE); adapt(q, meta()); return normalize(q, meta(), meta().id).project; })();
  sg.P = P; cur = Math.min(sg.cur || 0, P.sections.length - 1); clipIdx = sg.clipIdx || 0; t = 0; undoDel = null;
}
async function renameSong(i = ACT) {
  closeSongMenu();
  const a = await ask({ title: '改歌名', body: '分頁、存檔的檔名都會用這個名字。', input: songTitle(i), buttons: [['ok', '好', 'primary'], ['cancel', '取消']] });
  const v = $('#dlgIn').value.trim().slice(0, 80);
  if (a !== 'ok' || !v) return false;
  if (i === ACT) { P.title = v; save(`改歌名「${v}」`); } else { SONGS[i].P.title = v; persist(); } renderSongTabs(); renderGlobal(); return true;
}
async function closeSong(i = ACT, { quiet = false, noOp = false } = {}) {
  closeSongMenu();
  if (exporting || SONGS.length <= 1) return false;
  const name = songTitle(i);
  if (!quiet) {
    const a = await ask({ title: `關閉「${name}」？`, body: '這首會從分頁拿掉。關閉後可以按「↶ 還原」，或從分頁列尾端的「最近關閉」叫回來（保留最近 5 首）。', buttons: [['close', '關閉這一首', 'primary'], ['cancel', '取消']] });
    if (a !== 'close') return false;
  }
  stash();
  const [rm] = SONGS.splice(i, 1), id = 'c' + rm.uid + Date.now().toString(36);
  CLOSED.unshift({ id, i, at: Date.now(), title: (rm.P && rm.P.title) || '未命名', song: rm }); CLOSED = CLOSED.slice(0, CLOSED_MAX);
  if (!noOp) bookOp({ type: 'close', id, label: `關閉「${name}」` });
  if (i === ACT) await activate(Math.min(i, SONGS.length - 1), { noStash: true });
  else { if (i < ACT) ACT--; persist(); renderSongTabs(); renderSaveState(); }
  saveHist(); renderUndo();
  if (!quiet) {
    say('#songMsg', `已關閉「${name}」。`);
    const u = document.createElement('button'); u.className = 'small'; u.id = 'undoClose'; u.type = 'button'; u.textContent = '復原'; u.onclick = () => undoClose(); $('#songMsg').append(' ', u);
  }
  return true;
}
async function undoClose() {
  if (!CLOSED.length) return false;
  const id = CLOSED[0].id, k = BOOKOPS.findIndex(o => o.type === 'close' && o.id === id); if (k >= 0) BOOKOPS.splice(k, 1);
  return reopenSong(id);
}
async function newSong({ quiet = false, track = true } = {}) {
  if (exporting) return false;
  stash();
  const id = BUILTIN.some(b => b.id === meta().id) ? meta().id : BUILTIN[0].id;
  SONGS.splice(ACT + 1, 0, mkSong({ P: { ...defaultProject(id), sections: [{ name: '主歌', background: 'calm' }, { name: '副歌', background: 'peak' }] } }));
  await activate(ACT + 1); markFresh();
  if (track) bookOp({ type: 'new', uid: SONGS[ACT].uid, label: '做新的一首' });
  if (quiet) return true;
  $('#askText').value = ''; $('#pasteText').value = ''; renderDetect();
  ['#cfgStatus', '#copyMsg', '#secMsg', '#status', '#saveMsg', '#songMsg'].forEach(s => say(s, ''));
  showTab('ai');
  say('#openMsg', '新的一首（新分頁）：按「複製開場白」貼給 AI，告訴它歌名、感覺和歌詞。AI 給你設定後，整則貼到上面②。', 'ok');
  $('#openCard').scrollIntoView({ block: 'nearest' }); $('#copyOpen').focus({ preventScroll: true });
  return true;
}
async function discardSong(uid, backTo) {
  SONGS.splice(SONGS.findIndex(s => s.uid === uid), 1);
  BOOKOPS = BOOKOPS.filter(o => o.uid !== uid);
  await activate(Math.min(backTo, SONGS.length - 1), { noStash: true });
}
function readBook() {
  try { const b = JSON.parse(store.get('book') || 'null'); if (b && Array.isArray(b.songs) && b.songs.length) return { songs: b.songs.map(mkSong), active: b.active, from: 'store' }; } catch (e) { }
  try { const raw = JSON.parse(PJ.textContent || 'null'); if (raw && Array.isArray(raw.songs) && raw.songs.length) return { songs: raw.songs.map(songFromFile), active: raw.active, from: 'file' }; } catch (e) { }
  return { songs: [mkSong({ P: clone(SAMPLE) })], active: 0, from: 'sample' };
}
