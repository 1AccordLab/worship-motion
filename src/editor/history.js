let CODES = {}, BOOKOPS = [], CLOSED = [], restoring = false, histT = null;
const snapCustoms = st => [st.c, ...(Array.isArray(st.o) ? st.o : [])].filter(Boolean);
const snapHashes = s => snapCustoms(JSON.parse(s)).map(c => c.h);
// 注意：快照是字串，會直接拿來比「和上一筆一樣嗎」「是不是打開時的樣子」，所以同樣的內容要產生同樣的字串：風格程式依 id 排序，只有一份時只寫 c
function snapOf(sg) {
  const list = byId(sg.customs || []).map(c => { const h = fnv(c.code); CODES[h] = c.code; return { id: c.id, h }; });
  return JSON.stringify(list.length > 1 ? { P: sg.P, c: list[0], o: list.slice(1) } : { P: sg.P, c: list[0] || null });
}
function histOf(sg) { if (!sg.hist || !Array.isArray(sg.hist.stack) || !sg.hist.stack.length) sg.hist = { stack: [{ label: '打開這首歌', at: Date.now(), s: snapOf(sg) }], pos: 0 }; sg.hist.pos = Math.max(0, Math.min(sg.hist.pos | 0, sg.hist.stack.length - 1)); return sg.hist; }
function commit(label, key) {
  const sg = SONGS[ACT]; if (restoring || !sg || !P) return; sg.P = P; sg.customs = CUSTOMS;
  const h = histOf(sg), s = snapOf(sg), top = h.stack[h.pos], now = Date.now();
  if (top && top.s === s) return;
  if (key && top && top.key === key && h.pos > 0 && h.pos === h.stack.length - 1 && now - top.at < HIST_MERGE_MS) { top.s = s; top.at = now; }
  else { h.stack.splice(h.pos + 1); h.stack.push({ label, key: key || null, at: now, s }); while (h.stack.length > HIST_MAX) h.stack.shift(); h.pos = h.stack.length - 1; }
  saveHist(); renderUndo();
}
function bookOp(op) { BOOKOPS.push({ ...op, at: Date.now() }); BOOKOPS = BOOKOPS.slice(-20); saveHist(); renderUndo(); }
function saveHist() { clearTimeout(histT); histT = setTimeout(writeHist, 250); }
function writeHist() {
  clearTimeout(histT);
  const all = [...SONGS, ...CLOSED.map(c => c.song)], songs = {};
  for (const sg of all) if (sg.hist) songs[sg.uid] = sg.hist;
  const memo = new Map(), hashesOf = s => { if (!memo.has(s)) memo.set(s, snapHashes(s)); return memo.get(s); };
  const pack = () => {
    const used = new Set();
    for (const h of Object.values(songs)) for (const e of h.stack) for (const k of hashesOf(e.s)) used.add(k);
    for (const sg of all) for (const c of sg.customs || []) used.add(fnv(c.code));
    for (const sg of all) if (sg.orig) for (const k of hashesOf(sg.orig)) used.add(k);
    return JSON.stringify({ v: 1, codes: Object.fromEntries([...used].filter(k => CODES[k]).map(k => [k, CODES[k]])), songs, ops: BOOKOPS,
      closed: CLOSED.map(c => ({ id: c.id, i: c.i, at: c.at, title: c.title, song: { uid: c.song.uid, P: c.song.P, customs: c.song.customs, orig: c.song.orig } })) });
  };
  let str = pack(), n = 0;
  // 注意：localStorage 配額有限，超過就從最長的那條歷史丟掉最早的紀錄
  while (str.length > HIST_BYTES_MAX && n++ < 400) {
    const big = Object.values(songs).filter(h => h.pos > 0 && h.stack.length > 2).sort((a, b) => b.stack.length - a.stack.length)[0]; if (!big) break;
    big.stack.shift(); big.pos--; str = pack();
  }
  store.set('hist', str);
}
function readHist() {
  try {
    const d = JSON.parse(store.get('hist') || 'null'); if (!d || d.v !== 1) return;
    CODES = d.codes || {}; BOOKOPS = Array.isArray(d.ops) ? d.ops : [];
    for (const sg of SONGS) if (d.songs && d.songs[sg.uid]) sg.hist = d.songs[sg.uid];
    CLOSED = (d.closed || []).map(c => ({ ...c, song: Object.assign(mkSong(c.song), { uid: c.song.uid, hist: (d.songs || {})[c.song.uid] || null }) }));
  } catch (e) { }
}
const hhmm = at => { const d = new Date(at); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
function undoInfo() {
  const sg = SONGS[ACT]; if (!sg || !P) return { undo: null, redo: null };
  const h = histOf(sg), op = BOOKOPS[BOOKOPS.length - 1], songAt = h.pos > 0 ? h.stack[h.pos].at : -1;
  const undo = op && op.at > songAt ? op.label : h.pos > 0 ? h.stack[h.pos].label : null;
  return { undo, redo: h.pos < h.stack.length - 1 ? h.stack[h.pos + 1].label : null, book: !!(op && op.at > songAt) };
}
function renderUndo() {
  const u = $('#undoBtn'), r = $('#redoBtn'), i = undoInfo();
  u.disabled = !i.undo || exporting; r.disabled = !i.redo || exporting;
  u.title = i.undo ? `還原：${i.undo}（Ctrl／⌘＋Z）` : '沒有可以還原的動作'; r.title = i.redo ? `重做：${i.redo}（Ctrl／⌘＋Shift＋Z）` : '沒有可以重做的動作';
  if (!$('#pane-adv').hidden) renderHistory();
  renderClosed();
}
async function restoreSnap(e) {
  const sg = SONGS[ACT], st = JSON.parse(e.s);
  restoring = true;
  try {
    sg.P = st.P; const named = sg.customs || []; sg.customs = customsFrom({ customs: snapCustoms(st).map(c => ({ id: c.id, code: CODES[c.h], name: (named.find(k => k.id === c.id) || {}).name })) }); sg.cur = cur; sg.clipIdx = 0;
    await activate(ACT, { noStash: true });
  } finally { restoring = false; }
}
async function undo() {
  if (exporting) return false;
  const sg = SONGS[ACT], h = histOf(sg), i = undoInfo();
  if (!i.undo) return false;
  if (i.book) { const op = BOOKOPS.pop(); saveHist(); await undoBookOp(op); return true; }
  const lab = h.stack[h.pos].label; h.pos--; await restoreSnap(h.stack[h.pos]); h.stack[h.pos].s = snapOf(sg); saveHist(); renderUndo();
  say('#songMsg', `已還原：${lab}`); return true;
}
async function redo() {
  if (exporting) return false;
  const sg = SONGS[ACT], h = histOf(sg); if (h.pos >= h.stack.length - 1) return false;
  h.pos++; await restoreSnap(h.stack[h.pos]); h.stack[h.pos].s = snapOf(sg); saveHist(); renderUndo();
  say('#songMsg', `已重做：${h.stack[h.pos].label}`); return true;
}
async function undoBookOp(op) {
  if (op.type === 'close') { await reopenSong(op.id); say('#songMsg', `已還原：${op.label}`); }
  else if (op.type === 'new') {
    const i = SONGS.findIndex(s => s.uid === op.uid);
    if (i >= 0 && SONGS.length > 1) { await closeSong(i, { quiet: true, noOp: true }); say('#songMsg', `已還原：${op.label}（這一首放在「最近關閉」）`); }
  }
  renderUndo();
}
let histSel = -1;
function renderHistory() {
  const box = $('#histList'); if (!P) return; box.innerHTML = '';
  const h = histOf(SONGS[ACT]);
  for (let k = h.stack.length - 1; k >= 0; k--) {
    const e = h.stack[k], b = document.createElement('button'); b.type = 'button'; b.className = 'hrow'; b.dataset.k = k;
    b.setAttribute('aria-pressed', String(k === histSel)); if (k === h.pos) b.setAttribute('aria-current', 'true');
    const tm = document.createElement('span'); tm.className = 'ht'; tm.textContent = hhmm(e.at);
    const lb = document.createElement('span'); lb.textContent = e.label + (k === h.pos ? '（目前）' : k > h.pos ? '（已還原，可重做）' : '');
    b.append(tm, lb); b.onclick = () => { histSel = k; renderHistory(); previewHist(k); }; box.append(b);
  }
  $('#histNote').textContent = `這首歌有 ${h.stack.length} 個紀錄點（只保留最近 ${HIST_MAX} 步）。`;
  if (histSel < 0 || histSel >= h.stack.length) { $('#histPrev').hidden = true; }
}
function previewHist(k) {
  const h = histOf(SONGS[ACT]), e = h.stack[k]; if (!e) return;
  const st = JSON.parse(e.s), box = $('#histPrev'); box.hidden = false;
  const ch = k === h.pos ? [] : changes(clone(P), st.P, meta(), meta()).lines;
  $('#histPrevT').textContent = `${hhmm(e.at)}「${e.label}」` + (k === h.pos ? '：就是現在的樣子。' : `：和現在比，${ch.length ? '不一樣的地方：\n・' + ch.slice(0, 8).join('\n・') + (ch.length > 8 ? `\n・…還有 ${ch.length - 8} 項` : '') : '設定一樣（可能是新風格的程式不同）。'}`);
  $('#histGo').disabled = k === h.pos;
}
async function goHist(k) {
  const sg = SONGS[ACT], h = histOf(sg), e = h.stack[k]; if (!e || k === h.pos) return false;
  await restoreSnap(e); commit(`回到 ${hhmm(e.at)} 的狀態（${e.label}）`); histSel = -1; renderHistory();
  say('#histMsg', `已回到 ${hhmm(e.at)} 的狀態。想反悔：按「↶ 還原」。`, 'ok'); return true;
}
function noteOrig(sg) { if (sg && !sg.orig) sg.orig = snapOf(sg); }
async function resetSong() {
  closeSongMenu();
  const sg = SONGS[ACT]; if (exporting || !sg || !P) return false;
  noteOrig(sg);
  if (sg.orig === snapOf(sg)) { say('#songMsg', '這首已經是初始狀態，不用還原。', 'ok'); return false; }
  const a = await ask({ title: `「${songTitle(ACT)}」還原到初始狀態？`, body: '回到這首歌剛打開時的樣子：風格、配色、段落、歌詞都會換回去（其他分頁不受影響）。按完覺得不對，還是可以按「↶ 還原」反悔。', buttons: [['ok', '還原到初始狀態', 'primary'], ['cancel', '取消']] });
  if (a !== 'ok') return false;
  await restoreSnap({ s: sg.orig }); commit('還原到初始狀態'); renderSongTabs();
  say('#songMsg', '已還原到初始狀態。想反悔：按「↶ 還原」。', 'ok'); return true;
}
function renderClosed() {
  const b = $('#closedBtn'); b.hidden = !CLOSED.length; b.textContent = `最近關閉（${CLOSED.length}）▾`;
  const m = $('#closedMenu'); m.innerHTML = '';
  for (const c of CLOSED) { const x = document.createElement('button'); x.type = 'button'; x.setAttribute('role', 'menuitem'); x.textContent = `${c.title}（${hhmm(c.at)} 關閉）`; x.onclick = () => { m.hidden = true; reopenSong(c.id); }; m.append(x); }
}
async function reopenSong(id) {
  const k = CLOSED.findIndex(c => c.id === id); if (k < 0) return false;
  const [c] = CLOSED.splice(k, 1); stash();
  const at = Math.min(c.i, SONGS.length); SONGS.splice(at, 0, c.song); if (at <= ACT) ACT++;
  await activate(at); saveHist(); renderUndo(); say('#songMsg', `已叫回「${c.title}」。`, 'ok'); return true;
}
