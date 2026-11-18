'use strict';
/* ================= 編輯器：設定、場景 Worker、防護、匯出、存成單檔 ================= */
const FORMAT = 'worship-motion/1';
const $ = s => document.querySelector(s);
document.body.prepend($('#wm-ui').content.cloneNode(true));
const clone = o => JSON.parse(JSON.stringify(o));
const HEX = /^#[0-9a-fA-F]{6}$/, JUMPS = [1, 2, 4, 8], LOOPS = [32, 64, 128];
const NOPREVIEW = new URLSearchParams(location.search).has('nopreview');
const RUNTIME = window.WM_SRC ? WM_SRC.runtime : $('#wm-runtime').textContent;
const APP_SRC = window.WM_SRC ? WM_SRC.app : $('#wm-app').textContent;
const SCENE_HEAD = RUNTIME + '\ntry {\n', SCENE_OFF = SCENE_HEAD.split('\n').length - 1;
/* 內建風格：編輯器裡是 <script class="wm-scene">；存成的單檔放在壓縮包裡（WM_SRC.scenes） */
const BUILTIN = (() => { const out = [], seen = new Set();
  for (const b of [...((window.WM_SRC && WM_SRC.scenes) || []), ...[...document.querySelectorAll('script.wm-scene')].map(s => ({ id: s.dataset.id, name: s.dataset.name || s.dataset.id, code: s.textContent }))])
    if (b && b.id && !seen.has(b.id)) { seen.add(b.id); out.push(b); }
  return out; })();
const PJ = $('#wm-project'), DOC = PJ.dataset.doc || 'main', KEY = `wm:${DOC}:`;
const store = { get: k => { try { return localStorage.getItem(KEY + k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(KEY + k) : localStorage.setItem(KEY + k, v); } catch (e) { } } };
const SAMPLE = {
  format: FORMAT, title: '範例詩歌', style: BUILTIN[0] ? BUILTIN[0].id : 'swiss', bpm: 120, palette: {},
  sections: [
    { name: '主歌', background: 'calm', jumpBeats: 4, loopBeats: 32, subtitle: 'none', lyrics: '' },
    { name: '導歌', background: 'build', jumpBeats: 2, loopBeats: 32, subtitle: 'flashy', clipSeconds: 6, enterSpeed: 1, lyrics: '這是第[一]行示意文字\n這是第[二]行示意文字\n這是第[三]行示意文字\n這是第[四]行示意文字' },
    { name: '副歌', background: 'peak', jumpBeats: 4, loopBeats: 32, subtitle: 'gentle', clipSeconds: 16, enterSpeed: 1, lyrics: '這是第一行示意文字\n這是第二行示意文字\n\n這是第三行示意文字\n第四行' },
  ],
};
const fmtErr = e => (e && e.line > 0 ? `第 ${e.line} 行：` : '') + (e && e.message || e);
const errAt = (msg, line) => Object.assign(new Error(msg), { line: line || 0 });

/* ================= 當機自救：試跑標記 ================= */
const PROBE = 'wm:probe', SUSPECT = 'wm:suspect';
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { } };
let suspects = []; try { suspects = JSON.parse(lsGet(SUSPECT) || '[]'); } catch (e) { }
const lastProbe = (() => { try { return JSON.parse(lsGet(PROBE)); } catch (e) { return null; } })();
if (lastProbe) { if (!suspects.includes(lastProbe.hash)) suspects.push(lastProbe.hash); lsSet(SUSPECT, JSON.stringify(suspects.slice(-30))); lsSet(PROBE, null); }
const markProbe = (kind, hash, name) => lsSet(PROBE, JSON.stringify({ kind, hash, name }));
const clearProbe = () => lsSet(PROBE, null);
const suspect = h => suspects.includes(h);
const addSuspect = h => { if (!suspect(h)) { suspects.push(h); lsSet(SUSPECT, JSON.stringify(suspects.slice(-30))); } };
const unSuspect = h => { suspects = suspects.filter(x => x !== h); lsSet(SUSPECT, JSON.stringify(suspects)); };

/* ================= 背景執行緒：blob → data: → 頁內（某些預覽環境不允許 Worker） ================= */
let WMODE = null;
const b64 = str => { const u = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < u.length; i += 32768) bin += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(bin); };
function realWorker(mode, src) {
  if (mode === 'data') return new Worker('data:text/javascript;base64,' + b64(src));
  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  try { return new Worker(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}
function inlineWorker(src) {
  // 頁內執行：同樣的訊息介面，但沒有無窮迴圈保護（卡住只能靠重開時的試跑標記）
  const w = { onmessage: null, onerror: null, dead: false };
  const scope = { onmessage: null };
  scope.self = scope;
  scope.postMessage = d => { if (!w.dead) setTimeout(() => { if (!w.dead && w.onmessage) w.onmessage({ data: d }); }, 0); };
  const fail = e => { if (!w.dead && w.onerror) w.onerror({ message: String(e && e.message || e), lineno: 0, error: e, preventDefault() { } }); };
  w.postMessage = d => { const c = structuredClone(d); setTimeout(() => { if (w.dead || !scope.onmessage) return; try { scope.onmessage({ data: c }); } catch (e) { fail(e); } }, 0); };
  w.terminate = () => { w.dead = true; };
  setTimeout(() => { if (w.dead) return; let fn; try { fn = new Function('self', 'postMessage', src + '\n//# sourceURL=wm-inline.js'); } catch (e) { fail(e); return; } try { fn.call(scope, scope, scope.postMessage); } catch (e) { fail(e); } }, 0);
  return w;
}
async function workerMode() {
  if (WMODE) return WMODE;
  for (const m of ['blob', 'data']) {
    let w = null;
    try {
      w = realWorker(m, 'postMessage(1)');
      const ok = await new Promise(res => { const to = setTimeout(() => res(false), 3000); w.onmessage = () => { clearTimeout(to); res(true); }; w.onerror = e => { if (e.preventDefault) e.preventDefault(); clearTimeout(to); res(false); }; });
      w.terminate(); if (ok) return (WMODE = m);
    } catch (e) { if (w) w.terminate(); }
  }
  WMODE = 'inline';
  setTimeout(() => notice('worker', '這個環境（例如 AI 對話裡的預覽）限制比較多，風格程式改在頁面裡直接執行：可以用，但卡住時無法自動停止。要匯出或試新風格，建議下載這個檔案後用 Chrome 或 Edge 打開。'), 0);
  return WMODE;
}
const spawn = (mode, src) => mode === 'inline' ? inlineWorker(src) : realWorker(mode, src);
const LINE_FIX = () => WMODE === 'inline' ? 2 : 0;   // new Function 會多兩行開頭

/* ================= 場景 Worker ================= */
function lineIn(stack, code) {
  const n = code.split('\n').length;
  for (const m of String(stack || '').matchAll(/(?:blob:|data:|wm-inline\.js)[^\s)]*?:(\d+):(\d+)/g)) { const l = +m[1] - SCENE_OFF - LINE_FIX(); if (l >= 1 && l <= n) return l; }
  return 0;
}
class SceneHost {
  constructor(code) { this.code = code; this.seq = 0; this.wait = new Map(); }
  async start(timeout = 3000) {
    const mode = await workerMode();
    return new Promise((res, rej) => {
      const w = this.w = spawn(mode, SCENE_HEAD + this.code + '\n;__wmReady();\n} catch (e) { __wmFail(e); }\n');
      const done = () => { clearTimeout(to); };
      const to = setTimeout(() => { this.kill(); rej(errAt('風格程式 3 秒內沒有載入完成（可能有無窮迴圈），已停止。')); }, timeout);
      w.onerror = e => { e.preventDefault(); done(); this.kill(); const l = e.lineno - SCENE_OFF - LINE_FIX(); rej(errAt(String(e.message).replace(/^Uncaught /, ''), l >= 1 ? l : 0)); };
      w.onmessage = e => {
        const m = e.data; done();
        if (m.fail) { this.kill(); rej(errAt(m.error, lineIn(m.stack, this.code))); return; }
        this.meta = m.meta; w.onmessage = ev => { const r = this.wait.get(ev.data.id); if (r) { this.wait.delete(ev.data.id); r(ev.data); } };
        res(m.meta);
      };
    });
  }
  call(msg, timeout, what) {
    if (!this.w) return Promise.reject(errAt('場景已停止。'));
    return new Promise((res, rej) => {
      const id = ++this.seq;
      const to = setTimeout(() => { this.wait.delete(id); this.kill(); rej(Object.assign(errAt(`風格程式${what}超過 ${timeout / 1000} 秒沒有回應（可能有無窮迴圈），已停止。`), { hang: true })); }, timeout);
      this.wait.set(id, m => { clearTimeout(to); m.ok ? res(m) : rej(errAt(m.error, lineIn(m.stack, this.code))); });
      this.w.postMessage({ ...msg, id });
    });
  }
  clip(spec) { this.fresh = true; return this.call({ op: 'clip', clip: spec }, 3000, '準備影片時'); }
  frame(t, fullAtlas) { const first = this.fresh; this.fresh = false; return this.call({ op: 'frame', t, fullAtlas }, first ? 5000 : 1000, `在第 ${t.toFixed(2)} 秒`); }
  kill() { if (this.w) { this.w.terminate(); this.w = null; } for (const r of this.wait.values()) r({ ok: false, error: '場景已停止。' }); this.wait.clear(); }
}

/* ================= Canvas2D 圖層 Worker ================= */
const CANVAS_WORKER = `'use strict';
const clamp01 = x => Math.max(0, Math.min(1, x)), lerp = (a, b, t) => a + (b - a) * t, seg = (t, a, b) => clamp01((t - a) / (b - a));
const mod = (a, n) => ((a % n) + n) % n, hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const pulse = (t, k = 5, period = .5, off = 0) => Math.exp(-mod(t - off, period) / period * k), TAU = Math.PI * 2;
let draw = null, cv = null, ctx = null, half = false;
self.onmessage = e => {
  const m = e.data;
  try {
    if (m.op === 'init') {
      let src = m.src.trim(); if (!/^(function\\b|async\\b|\\(|[A-Za-z_$][\\w$]*\\s*=>)/.test(src)) src = 'function ' + src;
      draw = new Function('hash', 'lerp', 'seg', 'mod', 'pulse', 'clamp01', 'TAU', 'return (' + src + ')')(hash, lerp, seg, mod, pulse, clamp01, TAU); half = m.half;
      cv = new OffscreenCanvas(half ? 960 : 1920, half ? 540 : 1080); ctx = cv.getContext('2d', { willReadFrequently: true });
      postMessage({ id: m.id, ok: true }); return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.save(); if (half) ctx.scale(.5, .5);
    draw(ctx, m.t, m.info); ctx.restore();
    const d = ctx.getImageData(0, 0, cv.width, cv.height);
    postMessage({ id: m.id, ok: true, px: d.data.buffer, w: cv.width, h: cv.height }, [d.data.buffer]);
  } catch (err) { postMessage({ id: m.id, ok: false, error: String(err && err.message || err), stack: String(err && err.stack || '') }); }
};`;
class CanvasHost {
  constructor(spec, code) {
    this.spec = spec; this.seq = 0; this.wait = new Map();
    const i = code.indexOf(spec.src); this.off = i < 0 ? 0 : code.slice(0, i).split('\n').length - 1;
  }
  line(stack) { const m = /<anonymous>:(\d+):\d+/.exec(String(stack || '')); return m ? Math.max(1, this.off + +m[1] - 2) : 0; }
  async start() {
    this.w = spawn(await workerMode(), CANVAS_WORKER);
    this.w.onmessage = ev => { const r = this.wait.get(ev.data.id); if (r) { this.wait.delete(ev.data.id); r(ev.data); } };
    return this.call({ op: 'init', src: this.spec.src, half: this.spec.half }, 2000);
  }
  call(msg, timeout) {
    if (!this.w) return Promise.reject(errAt('Canvas 圖層已停用。'));
    return new Promise((res, rej) => {
      const id = ++this.seq;
      const to = setTimeout(() => { this.wait.delete(id); this.kill(); rej(Object.assign(errAt(`Canvas 圖層一格畫超過 ${timeout / 1000} 秒（可能有無窮迴圈），已停用這一層。`), { hang: true })); }, timeout);
      this.wait.set(id, m => { clearTimeout(to); m.ok ? res(m) : rej(errAt('Canvas 圖層：' + m.error, this.line(m.stack))); });
      this.w.postMessage({ ...msg, id });
    });
  }
  frame(t, info) { return this.call({ op: 'frame', t, info }, 1000); }
  kill() { if (this.w) { this.w.terminate(); this.w = null; } }
}

/* ================= 狀態 ================= */
let P = null, cur = 0, clipIdx = 0, r = null, clip = null, scene = null, canvasHost = null, CUSTOM = null, sceneCode = '';
/* 歌曲分頁：每首歌有自己的設定和自己的新風格程式（custom）。P／CUSTOM 永遠是目前分頁那首 */
let SONGS = [], ACT = 0;
const VERIFIED = new Set();   // 這次打開已經試跑通過的新風格程式（切分頁不用再試跑）
const mkSong = x => ({ uid: x.uid || newUid(), hist: x.hist || null, P: x.P || x.project || null, custom: (x.custom || x.scene) && (x.custom || x.scene).code ? { id: String((x.custom || x.scene).id || 'custom').toLowerCase(), code: (x.custom || x.scene).code } : null, fresh: x.fresh || null, orig: x.orig || null, cur: 0, clipIdx: 0 });
let playing = true, t = 0, last = performance.now(), frameNo = 0, exporting = false, cancel = false, needAtlas = false, recovering = false;
let shaderInfo = null;   // { code, hash, line0, mode, est, off: '原因' }
const notices = new Map();
const meta = () => scene.meta;
const sec = () => P.sections[cur];
const palKeys = m => Object.keys(m.labels || m.palette).filter(k => m.palette[k]);
const resolvedPal = () => ({ ...meta().palette, ...(P ? P.palette : {}) });
let SWITCHING = false;   // 切分頁途中（P 還是上一首）不要寫回
function stash() { const s = SONGS[ACT]; if (s && P && !SWITCHING) { s.P = P; s.cur = cur; s.clipIdx = clipIdx; s.custom = CUSTOM; } }
function persist() { stash(); store.set('book', JSON.stringify({ v: 1, active: ACT, songs: SONGS.map(s => ({ uid: s.uid, P: s.P, custom: s.custom, fresh: s.fresh, orig: s.orig })) })); }
/* save(動作名稱, 合併鍵)：存到這台電腦，並在這首歌的歷史記一步（同一個合併鍵、4 秒內的連續改動併成一步） */
function save(label = '調整設定', key = null) { persist(); commit(label, key); renderSaveState(); renderSongName(); }

/* ================= 還原／重做、歷史紀錄：每首歌一條，最多 50 步，存在這台電腦（重新整理還在；存成單檔 HTML 不帶） ================= */
const HMAX = 50;
let CODES = {}, BOOKOPS = [], CLOSED = [], restoring = false, histT = null, uidN = 0;
function newUid() { return 's' + Date.now().toString(36) + (uidN++).toString(36) + Math.random().toString(36).slice(2, 6); }
function snapOf(sg) { const c = sg.custom; if (c && c.code) CODES[fnv(c.code)] = c.code; return JSON.stringify({ P: sg.P, c: c && c.code ? { id: c.id, h: fnv(c.code) } : null }); }
function histOf(sg) { if (!sg.hist || !Array.isArray(sg.hist.stack) || !sg.hist.stack.length) sg.hist = { stack: [{ label: '打開這首歌', at: Date.now(), s: snapOf(sg) }], pos: 0 }; sg.hist.pos = Math.max(0, Math.min(sg.hist.pos | 0, sg.hist.stack.length - 1)); return sg.hist; }
function commit(label, key) {
  const sg = SONGS[ACT]; if (restoring || !sg || !P) return; sg.P = P; sg.custom = CUSTOM;
  const h = histOf(sg), s = snapOf(sg), top = h.stack[h.pos], now = Date.now();
  if (top && top.s === s) return;
  if (key && top && top.key === key && h.pos > 0 && h.pos === h.stack.length - 1 && now - top.at < 4000) { top.s = s; top.at = now; }
  else { h.stack.splice(h.pos + 1); h.stack.push({ label, key: key || null, at: now, s }); while (h.stack.length > HMAX) h.stack.shift(); h.pos = h.stack.length - 1; }
  saveHist(); renderUndo();
}
function bookOp(op) { BOOKOPS.push({ ...op, at: Date.now() }); BOOKOPS = BOOKOPS.slice(-20); saveHist(); renderUndo(); }
function saveHist() { clearTimeout(histT); histT = setTimeout(writeHist, 250); }
function writeHist() {
  clearTimeout(histT);
  const all = [...SONGS, ...CLOSED.map(c => c.song)], songs = {};
  for (const sg of all) if (sg.hist) songs[sg.uid] = sg.hist;
  const pack = () => {
    const used = new Set();
    for (const h of Object.values(songs)) for (const e of h.stack) { const m = /"h":"([0-9a-f]{8})"\}\}$/.exec(e.s); if (m) used.add(m[1]); }
    for (const sg of all) if (sg.custom && sg.custom.code) used.add(fnv(sg.custom.code));
    for (const sg of all) { const m = sg.orig && /"h":"([0-9a-f]{8})"\}\}$/.exec(sg.orig); if (m) used.add(m[1]); }
    return JSON.stringify({ v: 1, codes: Object.fromEntries([...used].filter(k => CODES[k]).map(k => [k, CODES[k]])), songs, ops: BOOKOPS,
      closed: CLOSED.map(c => ({ id: c.id, i: c.i, at: c.at, title: c.title, song: { uid: c.song.uid, P: c.song.P, custom: c.song.custom, orig: c.song.orig } })) });
  };
  let str = pack(), n = 0;
  while (str.length > 2500000 && n++ < 400) {   // 太大：從最長的那條丟最舊的
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
  const u = $('#undoBtn'), r = $('#redoBtn'); if (!u) return; const i = undoInfo();
  u.disabled = !i.undo || exporting; r.disabled = !i.redo || exporting;
  u.title = i.undo ? `還原：${i.undo}（Ctrl／⌘＋Z）` : '沒有可以還原的動作'; r.title = i.redo ? `重做：${i.redo}（Ctrl／⌘＋Shift＋Z）` : '沒有可以重做的動作';
  if (!$('#pane-adv').hidden) renderHistory();
  renderClosed();
}
/* 回到歷史裡的某一個狀態（換風格、新風格程式都會跟著換） */
async function restoreSnap(e) {
  const sg = SONGS[ACT], st = JSON.parse(e.s);
  restoring = true;
  try {
    sg.P = st.P; sg.custom = st.c && CODES[st.c.h] ? { id: st.c.id, code: CODES[st.c.h] } : null; sg.cur = cur; sg.clipIdx = 0;
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
/* 歷史紀錄面板（進階） */
let histSel = -1;
function renderHistory() {
  const box = $('#histList'); if (!box || !P) return; box.innerHTML = '';
  const h = histOf(SONGS[ACT]);
  for (let k = h.stack.length - 1; k >= 0; k--) {
    const e = h.stack[k], b = document.createElement('button'); b.type = 'button'; b.className = 'hrow'; b.dataset.k = k;
    b.setAttribute('aria-pressed', String(k === histSel)); if (k === h.pos) b.setAttribute('aria-current', 'true');
    const tm = document.createElement('span'); tm.className = 'ht'; tm.textContent = hhmm(e.at);
    const lb = document.createElement('span'); lb.textContent = e.label + (k === h.pos ? '（目前）' : k > h.pos ? '（已還原，可重做）' : '');
    b.append(tm, lb); b.onclick = () => { histSel = k; renderHistory(); previewHist(k); }; box.append(b);
  }
  $('#histNote').textContent = `這首歌有 ${h.stack.length} 個紀錄點（只保留最近 ${HMAX} 步）。`;
  if (histSel < 0 || histSel >= h.stack.length) { $('#histPrev').hidden = true; }
}
function previewHist(k) {
  const h = histOf(SONGS[ACT]), e = h.stack[k]; if (!e) return;
  const st = JSON.parse(e.s), box = $('#histPrev'); box.hidden = false;
  const ch = k === h.pos ? [] : changes(clone(P), st.P, meta(), meta());
  $('#histPrevT').textContent = `${hhmm(e.at)}「${e.label}」` + (k === h.pos ? '：就是現在的樣子。' : `：和現在比，${ch.length ? '不一樣的地方：\n・' + ch.slice(0, 8).join('\n・') + (ch.length > 8 ? `\n・…還有 ${ch.length - 8} 項` : '') : '設定一樣（可能是新風格的程式不同）。'}`);
  $('#histGo').disabled = k === h.pos;
}
async function goHist(k) {
  const sg = SONGS[ACT], h = histOf(sg), e = h.stack[k]; if (!e || k === h.pos) return false;
  await restoreSnap(e); commit(`回到 ${hhmm(e.at)} 的狀態（${e.label}）`); histSel = -1; renderHistory();
  say('#histMsg', `已回到 ${hhmm(e.at)} 的狀態。想反悔：按「↶ 還原」。`, 'ok'); return true;
}
/* 初始狀態：這首歌第一次放進這本時的樣子（打開檔案、新增、打開設定檔）。舊資料沒有記：用歷史的第一筆「打開這首歌」 */
function noteOrig(sg) {
  if (!sg || sg.orig) return;
  const h = sg.hist, e = h && h.stack && h.stack[0] && h.stack[0].label === '打開這首歌' ? h.stack[0] : null;
  sg.orig = e ? e.s : snapOf(sg);
}
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
/* 最近關閉的分頁（最多 5 個） */
function renderClosed() {
  const b = $('#closedBtn'); if (!b) return; b.hidden = !CLOSED.length; b.textContent = `最近關閉（${CLOSED.length}）▾`;
  const m = $('#closedMenu'); m.innerHTML = '';
  for (const c of CLOSED) { const x = document.createElement('button'); x.type = 'button'; x.setAttribute('role', 'menuitem'); x.textContent = `${c.title}（${hhmm(c.at)} 關閉）`; x.onclick = () => { m.hidden = true; reopenSong(c.id); }; m.append(x); }
}
async function reopenSong(id) {
  const k = CLOSED.findIndex(c => c.id === id); if (k < 0) return false;
  const [c] = CLOSED.splice(k, 1); stash();
  const at = Math.min(c.i, SONGS.length); SONGS.splice(at, 0, c.song); if (at <= ACT) ACT++;
  await activate(at); saveHist(); renderUndo(); say('#songMsg', `已叫回「${c.title}」。`, 'ok'); return true;
}

/* ================= 設定格式 ================= */
/* 名稱寬鬆比對：大小寫、-、_、空白都不計（AI 常寫成 verse1Text、verse1text、verse-1-text） */
const keyNorm = k => String(k).toLowerCase().replace(/[\s_-]+/g, '');
const pickKey = (obj, k) => { if (k == null) return null; if (Object.prototype.hasOwnProperty.call(obj, k)) return k; const n = keyNorm(k); return Object.keys(obj).find(x => keyNorm(x) === n) || null; };
const NAME_ZH = { calm: '平靜', build: '累積', peak: '高潮', flashy: '華麗', gentle: '收斂', none: '不要' };
const nameOf = (tbl, k) => (tbl && tbl[k] && tbl[k].label) || NAME_ZH[k] || k;
function normalize(raw, m, styleId) {
  const errors = [], warnings = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { errors: ['設定不是一個 JSON 物件（要用 { } 包起來）。'], warnings };
  const p = { format: FORMAT, title: '新的詩歌', style: styleId, bpm: 120, palette: {}, params: {}, sections: [] };
  if (raw.format && raw.format !== FORMAT) warnings.push(`format 是「${raw.format}」，這個編輯器讀的是「${FORMAT}」，已照目前格式讀取。`);
  if (typeof raw.title === 'string' && raw.title.trim()) p.title = raw.title.trim().slice(0, 80);
  if (typeof raw.note === 'string' && raw.note.trim()) p.note = raw.note.trim().slice(0, 400);
  if (raw.bpm !== undefined) { const b = Number(raw.bpm); if (!isFinite(b) || b < 40 || b > 220) errors.push(`bpm 要是 40 到 220 的數字（收到 ${raw.bpm}）。`); else p.bpm = Math.round(b * 100) / 100; }
  if (raw.palette !== undefined) {
    if (!raw.palette || typeof raw.palette !== 'object' || Array.isArray(raw.palette)) errors.push('palette 要是物件，例如 {"bg":"#2b2a27"}。');
    else { const keys = palKeys(m);
      for (const [k, v] of Object.entries(raw.palette)) {
        if (!keys.includes(k)) { warnings.push(`palette 的「${k}」不是「${m.name}」的顏色，已略過（可用：${keys.join('、')}）。`); continue; }
        if (typeof v !== 'string' || !HEX.test(v)) { errors.push(`palette.${k} 要是 #RRGGBB 色碼（收到 ${v}）。`); continue; }
        p.palette[k] = v.toLowerCase();
      } }
  }
  if (raw.params && typeof raw.params === 'object') for (const [k, v] of Object.entries(raw.params)) {
    const d = m.params[k]; if (!d) { warnings.push(`params 的「${k}」這個風格沒有，已略過。`); continue; }
    const n = Number(v); if (!isFinite(n)) { errors.push(`params.${k} 要是數字。`); continue; }
    p.params[k] = Math.max(d.min, Math.min(d.max, n));
  }
  const bgs = Object.keys(m.backgrounds), subs = Object.keys(m.subtitles);
  if (!Array.isArray(raw.sections) || !raw.sections.length) errors.push('sections 要是至少有一段的陣列。');
  else raw.sections.slice(0, 40).forEach((s, i) => {
    const at = `第 ${i + 1} 段`;
    if (!s || typeof s !== 'object') { errors.push(`${at} 不是物件。`); return; }
    const o = { name: `段落 ${i + 1}`, background: bgs[0], jumpBeats: 4, loopBeats: 32, subtitle: 'none', clipSeconds: 6, enterSpeed: 1, lyrics: '', lyrics2: '', swapLang: false };
    if (typeof s.name === 'string' && s.name.trim()) o.name = s.name.trim().slice(0, 30);
    if (s.background !== undefined) { const bk = pickKey(m.backgrounds, s.background); if (bk) o.background = bk; else errors.push(`${at}的背景「${nameOf(m.backgrounds, s.background)}」（background: ${s.background}）這個風格沒有，可用：${bgs.map(k => `${nameOf(m.backgrounds, k)}（${k}）`).join('、')}。`); }
    o.jumpBeats = m.backgrounds[o.background].jumpBeats;
    if (s.jumpBeats !== undefined) { if (JUMPS.includes(Number(s.jumpBeats))) o.jumpBeats = Number(s.jumpBeats); else errors.push(`${at} jumpBeats 只能是 ${JUMPS.join('、')}（收到 ${s.jumpBeats}）。`); }
    if (s.loopBeats !== undefined) { if (LOOPS.includes(Number(s.loopBeats))) o.loopBeats = Number(s.loopBeats); else errors.push(`${at} loopBeats 只能是 ${LOOPS.join('、')}（收到 ${s.loopBeats}）。`); }
    if (s.subtitle !== undefined) { const sk = keyNorm(s.subtitle) === 'none' ? 'none' : pickKey(m.subtitles, s.subtitle); if (sk) o.subtitle = sk; else errors.push(`${at}的字幕「${nameOf(m.subtitles, s.subtitle)}」（subtitle: ${s.subtitle}）這個風格沒有，可用：不要（none）${subs.map(k => `、${nameOf(m.subtitles, k)}（${k}）`).join('')}。`); }
    if (o.subtitle !== 'none') o.clipSeconds = m.subtitles[o.subtitle].seconds;
    if (s.clipSeconds !== undefined) { const v = Number(s.clipSeconds); if (isFinite(v) && v >= 2 && v <= 60) o.clipSeconds = v; else errors.push(`${at} clipSeconds 要是 2 到 60（收到 ${s.clipSeconds}）。`); }
    if (s.enterSpeed !== undefined) { const v = Number(s.enterSpeed); if (isFinite(v) && v >= 0.5 && v <= 2) o.enterSpeed = Math.round(v * 10) / 10; else errors.push(`${at} enterSpeed 要是 0.5 到 2（收到 ${s.enterSpeed}）。`); }
    if (s.lyrics !== undefined) { if (typeof s.lyrics === 'string') o.lyrics = s.lyrics.replace(/\r/g, ''); else errors.push(`${at} lyrics 要是文字（換行用 \\n）。`); }
    if (s.lyrics2 !== undefined && s.lyrics2 !== null) { if (typeof s.lyrics2 === 'string') o.lyrics2 = s.lyrics2.replace(/\r/g, ''); else errors.push(`${at} lyrics2 要是文字（換行用 \\n）。`); }
    if (s.swapLang !== undefined) o.swapLang = s.swapLang === true || s.swapLang === 'true' || s.swapLang === 1;
    if (o.subtitle !== 'none' && !slidesOf(o, m).length) warnings.push(`${at}「${o.name}」選了動態字幕但沒有歌詞，只會有背景。`);
    p.sections.push(o);
  });
  return { project: errors.length ? null : p, errors, warnings };
}
/* 換風格：段落裡新風格沒有的背景／字幕，換成新風格的第一種 */
function adapt(p, m) {
  const notes = [], bgs = Object.keys(m.backgrounds), subs = Object.keys(m.subtitles);
  p.palette = {}; p.params = {}; p.style = m.id;
  for (const s of p.sections) {
    if (!m.backgrounds[s.background]) { notes.push(`「${s.name}」的背景「${nameOf(m.backgrounds, s.background)}」這個風格沒有，改成「${nameOf(m.backgrounds, bgs[0])}」`); s.background = bgs[0]; }
    if (s.subtitle !== 'none' && !m.subtitles[s.subtitle]) { const n = subs[0] || 'none'; notes.push(`「${s.name}」的字幕「${nameOf(m.subtitles, s.subtitle)}」這個風格沒有，改成「${nameOf(m.subtitles, n)}」`); s.subtitle = n; }
  }
  return notes;
}
/* 一支最多 3 行：超過就平均切成幾支（8 行 → 3、3、2），不丟行 */
function chunk3(L) { const k = Math.ceil(L.length / 3), out = []; let i = 0;
  for (let j = 0; j < k; j++) { const n = Math.ceil((L.length - i) / (k - j)); out.push(L.slice(i, i + n).join('\n')); i += n; }
  return out; }
/* 字幕切法：歌詞和第二語言歌詞用同樣的切法，第 n 支配第 n 支（行數不同時，多出來的照樣做成一支） */
function pairsOf(s, m = meta()) {
  const d = m.subtitles[s.subtitle];
  if (!d) return [];
  const cut = v => { v = String(v || '').replace(/\r/g, '');
    if (d.split === 'block') return v.split(/\n\s*\n/).flatMap(x => chunk3(x.split('\n').map(y => y.trim()).filter(Boolean))).filter(Boolean);
    return v.split('\n').map(x => x.trim()).filter(Boolean); };
  const A = cut(s.lyrics), B = cut(s.lyrics2), n = Math.max(A.length, B.length);
  return Array.from({ length: n }, (_, i) => ({ a: A[i] || '', b: B[i] || '' }));
}
const slidesOf = (s, m = meta()) => pairsOf(s, m).map(x => x.a || x.b);
/* 貼上的文字：找出場景程式（有 defineScene）和設定 JSON */
function splitPaste(text) {
  const t = String(text || ''), out = { code: null, json: null, jsonErr: null };
  const blocks = [...t.matchAll(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/g)].map(m => m[1]);
  const tryJSON = s => { const q = s.replace(/[“”＂]/g, '"').replace(/[‘’]/g, "'"); const a = q.indexOf('{'), b = q.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('找不到 { } 包起來的設定。');
    try { return JSON.parse(q.slice(a, b + 1)); } catch (e) { throw new Error('設定的格式有錯：' + e.message + '（常見原因：少了逗號、多了逗號、用了全形引號）'); } };
  const list = blocks.length ? blocks : [t];
  for (const b of list) {
    if (/\bdefineScene\s*\(/.test(b)) { out.code = out.code || b; continue; }
    if (out.json) continue;
    try { out.json = tryJSON(b); } catch (e) { out.jsonErr = e.message; }
  }
  return out;
}

/* ================= 歌詞工具：簡轉繁、整首貼上自動分段（只在這個瀏覽器裡處理，不送到任何地方） ================= */
const S2T_SRC = window.WM_SRC ? (WM_SRC.s2t || '') : (($('#wm-s2t') || {}).textContent || '');
let S2T = null;
function s2tTable() {
  if (S2T) return S2T;
  const [cl = '', pl = ''] = S2T_SRC.trim().split('\n'), ch = new Map(), ph = new Map(); let maxLen = 1;
  const cs = [...cl]; for (let i = 0; i + 1 < cs.length; i += 2) ch.set(cs[i], cs[i + 1]);
  for (const e of pl.split(',')) { const c = [...e]; if (c.length < 4 || c.length % 2) continue; const h = c.length / 2, k = c.slice(0, h).join(''); ph.set(k, c.slice(h).join('')); maxLen = Math.max(maxLen, h); }
  return (S2T = { ch, ph, maxLen });
}
/* 先套詞組（最長的先），再套單字 */
function toTrad(text) {
  const { ch, ph, maxLen } = s2tTable(), c = [...String(text || '')], out = [];
  for (let i = 0; i < c.length;) {
    let hit = false;
    for (let L = Math.min(maxLen, c.length - i); L >= 2; L--) { const v = ph.get(c.slice(i, i + L).join('')); if (v) { out.push(v); i += L; hit = true; break; } }
    if (!hit) { out.push(ch.get(c[i]) || c[i]); i++; }
  }
  return out.join('');
}
const diffCount = (a, b) => { const x = [...a], y = [...b]; let n = 0; for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) n++; return n; };

/* 段落標題：[Verse 1]、<chrous>、Pre-chorus:、【主歌】、主歌一、橋段…（不分大小寫、全半形；常見拼錯也認） */
const KIND_ZH = { verse: '主歌', pre: '導歌', chorus: '副歌', bridge: '橋段', intro: '前奏', interlude: '間奏', outro: '結尾', tag: '尾句' };
const KIND_BG = { verse: 'calm', pre: 'build', chorus: 'peak', bridge: 'build', intro: 'calm', interlude: 'calm', outro: 'calm', tag: 'peak' };
const ZH_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const EN_KIND = [['verse', 'verse'], ['chorus', 'chorus'], ['refrain', 'chorus'], ['bridge', 'bridge'], ['intro', 'intro'], ['prelude', 'intro'], ['outro', 'outro'], ['ending', 'outro'], ['coda', 'outro'], ['interlude', 'interlude'], ['instrumental', 'interlude'], ['tag', 'tag']];
const ZH_KIND = [['預副歌', 'pre'], ['预副歌', 'pre'], ['導歌', 'pre'], ['导歌', 'pre'], ['主歌', 'verse'], ['副歌', 'chorus'], ['橋段', 'bridge'], ['桥段', 'bridge'], ['前奏', 'intro'], ['間奏', 'interlude'], ['间奏', 'interlude'], ['結尾', 'outro'], ['结尾', 'outro'], ['尾奏', 'outro'], ['尾聲', 'outro']];
const halfWidth = s => String(s).replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ');
function osa(a, b) {   // 編輯距離（相鄰字母對調算 1）
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const c = a[i - 1] === b[j - 1] ? 0 : 1; d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
function enKind(w, loose) {
  for (const [k, v] of EN_KIND) if (w === k) return v;
  if (w.length < 5 && !loose) return null;
  let best = null, bd = 9;
  for (const [k, v] of EN_KIND) { const dd = osa(w, k); if (dd < bd) { bd = dd; best = v; } }
  return bd <= (w.length >= 6 ? 2 : 1) ? best : null;
}
function headerOf(line) {
  const raw = halfWidth(line).trim(); if (!raw || raw.length > 32) return null;
  const marked = /^[\[<【(「『]/.test(raw) || /[:：]$/.test(raw);
  let s = raw.replace(/^[\[<【(（「『\s]+/, '').replace(/[\]>】)）」』\s:：.\-–—]+$/, '').replace(/\s*[x×]\s*\d+$/i, '').replace(/[（(][^）)]*[）)]$/, '').trim().toLowerCase();
  if (!s) return null;
  const num = v => v == null || v === '' ? null : /^\d+$/.test(v) ? +v : ZH_NUM.indexOf(v) > 0 ? ZH_NUM.indexOf(v) : null;
  for (const [w, k] of ZH_KIND) { const m = new RegExp('^' + w + '\\s*(\\d+|[一二三四五六七八九十])?$').exec(s); if (m) return { kind: k, n: num(m[1]) }; }
  let m = /^(v|c|b|pc)\s*(\d+)?$/.exec(s);
  if (m && marked) return { kind: { v: 'verse', c: 'chorus', b: 'bridge', pc: 'pre' }[m[1]], n: num(m[2]) };
  m = /^(pre[\s-]*)?([a-z]+)\s*(\d+)?$/.exec(s); if (!m) return null;
  if (m[1]) { const k = enKind(m[2], true); if (k === 'chorus') return { kind: 'pre', n: num(m[3]) }; }
  const k = enKind((m[1] || '').replace(/[\s-]/g, '') + m[2], marked);
  return k ? { kind: k, n: num(m[3]) } : null;
}
const secKey = name => { const h = headerOf(String(name).replace(/[（(][^）)]*[）)]\s*$/, '').trim()); return h ? h.kind + (h.n || 1) : null; };
const kindName = (k, n) => KIND_ZH[k] + (k === 'verse' ? ZH_NUM[n] || n : n > 1 ? ZH_NUM[n] || n : '');
const COPYRIGHT = /^(作?詞|作?曲|词|词曲|詞曲|詞\s*[\/／&＆]\s*曲|词\s*[\/／&＆]\s*曲)\s*[:：\s／/]|^(©|ⓒ|\(c\)|copyright\b|ccli\b)/i;
const isCJK = l => /[㐀-鿿豈-﫿]/.test(l), isLatin = l => /[A-Za-z]/.test(l) && !isCJK(l);
const longLine = l => isCJK(l) ? [...l.replace(/\s/g, '')].length > 18 : l.length > 42;

/* 讀整首：回傳 { blocks: [{ kind, n, head, lines }], removed, mode, bilingual } */
function readSong(text, { trad = false } = {}) {
  let src = String(text || '').replace(/\r/g, '');
  if (trad) src = toTrad(src);
  const removed = [], blocks = []; let cur = null, heads = 0;
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (line && COPYRIGHT.test(halfWidth(line))) { removed.push(line); continue; }
    const h = line ? headerOf(line) : null;
    if (h) { heads++; cur = { kind: h.kind, n: h.n, head: line, lines: [] }; blocks.push(cur); continue; }
    if (!cur) { cur = { kind: null, n: null, head: '', lines: [] }; blocks.push(cur); }
    cur.lines.push(line);
  }
  const trim = a => { while (a.length && !a[0]) a.shift(); while (a.length && !a[a.length - 1]) a.pop(); return a; };
  let list = blocks.map(b => ({ ...b, lines: trim(b.lines) })).filter(b => b.lines.length);
  if (!heads) {   // 沒有標題：空行分段
    list = []; let acc = [];
    for (const l of (blocks[0] ? blocks[0].lines : [])) { if (l) acc.push(l); else if (acc.length) { list.push({ kind: null, n: null, head: '', lines: acc }); acc = []; } }
    if (acc.length) list.push({ kind: null, n: null, head: '', lines: acc });
  }
  // 中英交錯：一行中文、下一行英文（或反過來）
  let alt = 0, cjk = 0, lat = 0;
  for (const b of list) { const ty = b.lines.filter(Boolean).map(l => isCJK(l) ? 'c' : isLatin(l) ? 'l' : 'o');
    ty.forEach((x, i) => { if (x === 'c') cjk++; if (x === 'l') lat++; if (i && x !== 'o' && ty[i - 1] !== 'o' && x !== ty[i - 1]) alt++; }); }
  const bilingual = cjk >= 2 && lat >= 2 && alt >= .6 * (cjk + lat - list.length) && Math.min(cjk, lat) >= .6 * Math.max(cjk, lat);
  return { blocks: list, removed, mode: heads ? 'headers' : 'blocks', bilingual };
}
/* 一段的行 → 歌詞文字；gentle（空一行分一支、每支最多 3 行）時，超過 3 行的一組每 2 行分一支（不改字） */
function packLines(pairs, block) {
  const groups = []; let g = [];
  for (const p of pairs) { if (!p) { if (g.length) groups.push(g); g = []; } else g.push(p); }
  if (g.length) groups.push(g);
  const out = [];
  for (const gr of groups) {
    if (!block || gr.length <= 3) { out.push(gr); continue; }
    for (let i = 0; i < gr.length; i += 2) { if (gr.length - i === 3) { out.push(gr.slice(i)); break; } out.push(gr.slice(i, i + 2)); }
  }
  const join = k => out.map(gr => gr.map(p => p[k]).filter(Boolean).join('\n')).filter(Boolean).join(block ? '\n\n' : '\n');
  return { a: join('a'), b: join('b'), slides: out.length };
}
/* 分配到各段：回傳計畫（預覽用），applySplit 才真的改 */
function planSplit(text, { trad = false, lang = 'both', target = 'lyrics' } = {}, proj = P, m = meta()) {
  const rd = readSong(text, { trad }), secs = proj.sections, plan = [], used = new Map(), occ = {}, skipped = [], long = [];
  const bilingual = rd.bilingual, isBlock = s => !!(m.subtitles[s.subtitle] && m.subtitles[s.subtitle].split === 'block');
  const toPairs = lines => lines.map(l => {
    if (!l) return null;
    if (!bilingual) return target === 'lyrics2' ? { a: '', b: l } : { a: l, b: '' };
    if (lang === 'zh') return isLatin(l) ? undefined : { a: l, b: '' };
    if (lang === 'en') return isLatin(l) ? { a: l, b: '' } : undefined;
    return (lang === 'bothEn') === isLatin(l) ? { a: l } : { b: l };   // both：中文大、英文小；bothEn：英文大、中文小
  }).filter(x => x !== undefined);
  const mergeBoth = ps => {   // both：中文行配下一個英文行
    if (!bilingual || (lang !== 'both' && lang !== 'bothEn')) return ps;
    const out = []; let last = null;   // 先出現的那一行（不管中文或英文）配下一行另一種語言
    for (const p of ps) {
      if (!p) { out.push(null); last = null; continue; }
      const k = p.a !== undefined ? 'a' : 'b';
      if (last && !last[k]) { last[k] = p[k]; last = null; }
      else { last = { a: '', b: '', [k]: p[k] }; out.push(last); }
    }
    return out;
  };
  const tmplFor = kind => secs.find(s => secKey(s.name) && secKey(s.name).replace(/\d+$/, '') === kind);
  let after = -1, extra = 0;
  rd.blocks.forEach((b, bi) => {
    const pairs = mergeBoth(toPairs(b.lines));
    if (!pairs.some(Boolean)) return;
    let targets = [], name = '', isNew = false, from = null, kind = b.kind, key = null;
    if (rd.mode === 'blocks') {
      if (bi < secs.length) targets = [bi]; else { isNew = true; extra++; name = `段落 ${secs.length + extra}`; from = secs[secs.length - 1]; }
    } else if (!kind) { skipped.push({ why: '開頭沒有段落標題，略過', lines: b.lines.filter(Boolean).length }); return; }
    else {
      occ[kind] = (occ[kind] || 0) + 1;
      let n = b.n || occ[kind]; key = kind + n;
      const sig = JSON.stringify(pairs);
      if (used.has(key)) { if (used.get(key) === sig) { skipped.push({ why: `「${b.head}」和前面一樣（重複），略過`, lines: b.lines.length }); return; } while (used.has(kind + n)) n++; key = kind + n; }
      targets = secs.map((s, i) => secKey(s.name) === key ? i : -1).filter(i => i >= 0);
      if (!targets.length && [...used.entries()].some(([k, v]) => k.replace(/\d+$/, '') === kind && v === sig)) { skipped.push({ why: `「${b.head}」和前面一樣（重複），略過`, lines: b.lines.length }); return; }
      used.set(key, sig);
      if (!targets.length) { isNew = true; name = kindName(kind, n); from = tmplFor(kind) || null; }
    }
    const blockOf = targets.length ? isBlock(secs[targets[0]]) : from ? isBlock(from) : true;
    const pk = packLines(pairs, blockOf);
    for (const p of pairs) if (p) for (const l of [p.a, p.b]) if (l && longLine(l)) long.push(l);
    plan.push({ head: b.head, kind, key, targets, name: targets.length ? targets.map(i => secs[i].name).join('、') : name, isNew, from: from ? from.name : null, after, lyrics: pk.a, lyrics2: pk.b, slides: pk.slides, lines: pairs.filter(Boolean).length, replaces: targets.some(i => ((target === 'lyrics2' && !bilingual ? secs[i].lyrics2 : secs[i].lyrics) || '').trim()) });
    after = targets.length ? Math.max(...targets) : after;
  });
  return { plan, removed: rd.removed, skipped, long, mode: rd.mode, bilingual, lang, target };
}
function applySplit(pl, m = meta()) {
  const secs = P.sections, bgs = Object.keys(m.backgrounds);
  const both = pl.bilingual && (pl.lang === 'both' || pl.lang === 'bothEn'), to2 = !pl.bilingual && pl.target === 'lyrics2';
  const common = (() => { const c = {}; for (const s of secs) if (s.subtitle !== 'none') c[s.subtitle] = (c[s.subtitle] || 0) + 1; return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || 'none'; })();
  const ins = new Map();   // 新段落：放在「前一個對上的段落」後面（-1＝最前面）
  for (const e of pl.plan) {
    const set = s => { if (to2) s.lyrics2 = e.lyrics2; else { s.lyrics = e.lyrics; if (both) s.lyrics2 = e.lyrics2; } };
    if (!e.isNew) { e.targets.forEach(i => set(secs[i])); continue; }
    const t = e.from ? secs.find(s => s.name === e.from) : null, bg = KIND_BG[e.kind] && bgs.includes(KIND_BG[e.kind]) ? KIND_BG[e.kind] : bgs[0];
    const ns = t ? { ...clone(t), name: e.name, lyrics: '', lyrics2: '' } : { name: e.name, background: bg, jumpBeats: m.backgrounds[bg].jumpBeats, loopBeats: 32, subtitle: common, clipSeconds: common !== 'none' && m.subtitles[common] ? m.subtitles[common].seconds : 6, enterSpeed: 1, lyrics: '', lyrics2: '', swapLang: false };
    set(ns);
    if (!ins.has(e.after)) ins.set(e.after, []); ins.get(e.after).push(ns);
  }
  const out = [...(ins.get(-1) || [])];
  secs.forEach((s, i) => { out.push(s, ...(ins.get(i) || [])); });
  P.sections = out.slice(0, 40);
}
/* ================= 時間：BPM、進場速度 ================= */
const frames32 = () => Math.max(1, Math.round(57600 / P.bpm));
const effBpm = () => 57600 / frames32();
const K = () => effBpm() / 120;
function warp(tt, s) { const Ti = 2; if (s === 1) return tt; return tt < Ti / s ? s * tt : Ti + (tt - Ti / s); }

/* ================= 繪製（全部排隊，一次一格） ================= */
let queue = Promise.resolve();
const serial = fn => { const p = queue.then(fn, fn); queue = p.catch(() => { }); return p; };
function canvasInfo(st) { return { beat: st / .5, W: 1920, H: 1080, pal: resolvedPal(), params: paramsNow(), kind: clip.kind, type: clip.type, text: clip.text || '', text2: clip.text2 || '', swap: !!clip.swap, dur: clip.dur || 0 }; }
const paramsNow = () => Object.fromEntries(Object.entries(meta().params).map(([k, d]) => [k, (P && P.params && P.params[k]) ?? d.value]));
async function drawAt(tt, idx, target) {
  const c = clip; if (!c) throw new Error('沒有可預覽的影片');
  const st = c.map(tt), fa = needAtlas; needAtlas = false;
  let cv = null;
  const [fr] = await Promise.all([scene.frame(st, fa), canvasHost ? canvasHost.frame(st, canvasInfo(st)).then(x => { cv = x; }, e => canvasFail(e)) : null]);
  if (fr.atlas) r.uploadAtlas(fr.atlas);
  if (cv && canvasHost) r.uploadCanvas(new Uint8Array(cv.px), cv.w, cv.h);
  r.render(fr.frame, idx, target, st, st / .5);
  watchdog();
}
function canvasFail(e) {
  if (canvasHost) canvasHost.kill(); canvasHost = null; if (r) r.canvasOn = false;
  notice('canvas', 'Canvas 自由畫層已停用：' + fmtErr(e), { label: '重新啟用', fn: () => startCanvas(true) });
}
async function startCanvas(manual) {
  notices.delete('canvas'); renderNotices();
  const m = meta(); if (!m.canvas) return;
  const ch = new CanvasHost(m.canvas, sceneCode);
  try { await ch.start(); canvasHost = ch; if (manual) rebuild(); } catch (e) { ch.kill(); canvasFail(e); }
}
/* 卡住偵測：記錄平常一格要多久；有自訂 shader 時，送出後超過「2 秒或平常的 4 倍」還沒做完 → 當成卡住 */
let watching = false, frameMs = 0;
function watchdog() {
  if (watching) return; watching = true;
  const rr = r, t0 = performance.now(), lim = Math.max(2000, 4 * frameMs + 4 * (shaderInfo && shaderInfo.est || 0));
  Promise.race([rr.device.queue.onSubmittedWorkDone().then(() => true, () => true), new Promise(res => setTimeout(() => res(false), lim))]).then(ok => {
    watching = false;
    if (ok) { const dt = performance.now() - t0; frameMs = frameMs ? frameMs * .7 + dt * .3 : dt; return; }
    if (rr === r && rr.shader) recoverGPU('自訂 shader 一格算超過 ' + (lim / 1000).toFixed(1) + ' 秒，顯示卡像是卡住了。', true);
  });
}

/* ================= GPU：建立、遺失後重建 ================= */
async function newRenderer() {
  const nr = new Renderer(); await nr.init(NOPREVIEW ? null : $('#view'));
  nr.device.lost.then(info => { if (nr.intentional || nr !== r) return; recoverGPU('顯示卡連線中斷（' + (info.message || info.reason) + '）。', true); });
  return nr;
}
function sceneToRenderer(rr) {
  const m = meta(), pal = resolvedPal();
  rr.setScene({ look: m.look, textures: m.textures, pal, palKeys: Object.keys(m.palette), params: Object.values(paramsNow()) });
}
let recoverLog = [];
async function recoverGPU(reason, blameShader) {
  if (recovering) return;
  recoverLog = recoverLog.filter(x => performance.now() - x < 60000); recoverLog.push(performance.now());
  if (recoverLog.length > 3) { showErr('顯示卡一分鐘內重置超過 3 次，已停止自動重建。請存檔後重新整理頁面（Chrome 可能暫時封鎖這一頁的 GPU，關掉分頁再開）。'); clip = null; return; }
  recovering = true;
  const old = r;
  try { old.intentional = true; old.device.destroy(); } catch (e) { }
  if (blameShader && shaderInfo && !shaderInfo.off) { addSuspect(shaderInfo.hash); shaderOff(reason + ' 已停用自訂 shader（場景其他部分照常）。'); }
  else notice('gpu', reason + ' 已自動重建顯示卡資源。');
  try { r = await newRenderer(); sceneToRenderer(r); needAtlas = true; if (r.shader === null && shaderInfo && !shaderInfo.off) await enableShader(true); }
  catch (e) { showErr('顯示卡無法重建：' + e.message + '。請重新整理頁面（Chrome 在多次重置後可能暫時封鎖這一頁的 GPU）。'); }
  recovering = false; rebuild();
}
function shaderOff(why) {
  if (r) r.shader = null;
  if (shaderInfo) shaderInfo.off = why;
  notice('shader', why, { label: '重新試跑 shader', fn: async () => { unSuspect(shaderInfo.hash); shaderInfo.off = null; notices.delete('shader'); renderNotices(); await enableShader(false); rebuild(); } });
}

/* ================= 自訂 WGSL：靜態檢查 → 編譯 → 試跑測速 ================= */
let baseline = null;
async function measureBaseline() {
  if (baseline && baseline.r === r) return baseline.full;
  const { pipeline } = await r.compileShader('fn shade(uv: vec2f, t: f32, beat: f32, base: vec4f) -> vec4f { return base; }');
  await r.timeShader(pipeline, 8, 8, 1, 3000);
  const a = await r.timeShader(pipeline, 120, 68, 2, 3000), b = await r.timeShader(pipeline, 480, 270, 2, 3000);
  const full = Math.max(0.05, b + (b - a) / (480 * 270 - 120 * 68) * (1920 * 1080 - 480 * 270));
  baseline = { r, full }; return full;
}
/* 回傳 { mode: 'full'|'half', est } 或丟出錯誤 */
async function probeShader(pipeline) {
  await r.timeShader(pipeline, 8, 8, 1, 2000);
  const pts = [];
  for (const [w, h] of [[32, 18], [120, 68], [480, 270]]) {
    const ms = await r.timeShader(pipeline, w, h, 2, 2000); pts.push([w * h, ms]);
    if (ms * (480 * 270) / (w * h) > 700 && w < 480) { const nx = w === 32 ? 120 * 68 : 480 * 270; if (ms * nx / (w * h) > 700) break; }
  }
  const A = 1920 * 1080, [a1, m1] = pts[pts.length - 1];
  let est = m1 * A / a1;
  if (pts.length > 1) { const [a0, m0] = pts[pts.length - 2]; const slope = Math.max((m1 - m0) / (a1 - a0), m1 / a1 * .25); est = m1 + slope * (A - a1); }
  const base = await measureBaseline(), budget = Math.max(25, base * 30);
  if (est <= budget) return { mode: 'full', est, budget };
  if (est / 4 <= budget && est / 4 < 1500) return { mode: 'half', est: est / 4, budget };
  throw errAt(`自訂 shader 太重：估計一格要 ${Math.round(est)} ms，半解析度也要 ${Math.round(est / 4)} ms（這台電腦的上限約 ${Math.round(budget)} ms）。請減少迴圈次數或雜訊呼叫。`);
}
async function checkShader(code, line0) {
  const map = l => l > 0 ? line0 + l : 0;
  const st = shaderStaticCheck(code);
  if (st.length) throw errAt('shader 沒通過檢查：' + st[0].msg + (st.length > 1 ? `（還有 ${st.length - 1} 個問題）` : ''), map(st[0].line));
  const { pipeline, errs } = await r.compileShader(code);
  if (errs.length) throw errAt('shader 編譯錯誤：' + errs[0].msg, map(errs[0].line));
  return pipeline;
}
async function enableShader(quiet) {
  const si = shaderInfo; if (!si) return;
  if (suspect(si.hash)) { shaderOff('這段自訂 shader 上次試跑時頁面當掉或被關閉，預設停用。'); return; }
  markProbe('shader', si.hash, meta().name);
  try {
    const pipeline = await checkShader(si.code, si.line0);
    const pr = await probeShader(pipeline);
    si.mode = pr.mode; si.est = pr.est; clearProbe();
    r.shader = { pipeline, half: pr.mode === 'half' };
    if (pr.mode === 'half') notice('shader', `自訂 shader 比較重（估計 ${Math.round(pr.est * 4)} ms／格），已自動改用半解析度計算。`);
    else if (!quiet) notices.delete('shader');
  } catch (e) {
    clearProbe();
    if (e.message === 'HANG') { addSuspect(si.hash); await recoverGPU('自訂 shader 試跑時卡住超過 2 秒。', true); return; }
    shaderOff('自訂 shader 已停用：' + fmtErr(e));
  }
  renderNotices();
}

/* ================= 換場景：先完整檢查，通過才換 ================= */
const TEST_TEXT = { line: '這是第[一]行示意文字', block: '這是第一行示意文字\n這是第二行示意文字' }, TEST_TEXT2 = { line: 'Sample line one', block: 'Sample line one\nSample line two' };
async function prepareScene(code, custom, trial = custom) {
  const hash = fnv(code);
  if (custom && suspect(hash)) throw Object.assign(errAt('這段新風格程式上次讓頁面卡住或當掉，已暫停使用。'), { retry: hash });
  if (trial) markProbe('scene', hash, '新風格');
  const host = new SceneHost(code);
  try {
    const m = await host.start();
    if (trial) {   // 每種背景、字幕各試幾格
      for (const [k, d] of Object.entries(m.backgrounds)) {
        await host.clip({ kind: 'bg', type: k, jump: 1, pal: {}, params: {} });
        for (const tt of [0, 7.3, 15.9]) await host.frame(tt);
      }
      for (const [k, d] of Object.entries(m.subtitles)) {
        await host.clip({ kind: 'sub', type: k, text: TEST_TEXT[d.split], dur: d.seconds, jump: 1, pal: {}, params: {} });
        for (const tt of [0.1, 1.2, d.seconds - .1]) await host.frame(tt);
        await host.clip({ kind: 'sub', type: k, text: TEST_TEXT[d.split], text2: TEST_TEXT2[d.split], dur: d.seconds, jump: 1, pal: {}, params: {} });   // 雙語也試一格
        await host.frame(1.2);
      }
    }
    let line0 = 0, shader = null;
    if (m.shader) { const i = code.indexOf(m.shader.code); line0 = i < 0 ? 0 : code.slice(0, i).split('\n').length - 1; shader = { code: m.shader.code, hash: fnv(m.shader.code), line0 }; }
    if (trial && m.canvas) {
      const ch = new CanvasHost(m.canvas, code); await ch.start();
      try { await ch.frame(1.2, { beat: 2.4, W: 1920, H: 1080, pal: m.palette, params: {}, kind: 'bg', type: Object.keys(m.backgrounds)[0], text: '', dur: 0 }); } finally { ch.kill(); }
    }
    if (trial && shader && !suspect(shader.hash)) {   // 自訂場景的 shader：檢查、編譯、試跑，任何一步失敗就整段不套用（可疑的 shader 先停用，場景照常）
      markProbe('shader', shader.hash, m.name);
      try { const pl = await checkShader(shader.code, line0); const pr = await probeShader(pl); Object.assign(shader, pr, { pipeline: pl }); }
      catch (e) { if (e.message === 'HANG') { addSuspect(shader.hash); clearProbe(); await recoverGPU('自訂 shader 試跑時卡住超過 2 秒。', false); throw errAt('自訂 shader 試跑時卡住，已拒絕這個新風格。'); } throw e; }
    }
    if (trial) { clearProbe(); VERIFIED.add(hash); }
    return { host, meta: m, code, custom, shader };
  } catch (e) { host.kill(); if (trial) clearProbe(); throw e; }
}
async function commitScene(prep) {
  if (scene && scene !== prep.host) scene.kill();
  if (canvasHost) { canvasHost.kill(); canvasHost = null; }
  scene = prep.host; sceneCode = prep.code; r.shader = null; r.canvasOn = false; clip = null;
  ['shader', 'canvas', 'scene'].forEach(k => notices.delete(k));
  shaderInfo = prep.meta.shader ? prep.shader : null;
  if (prep.custom) { CUSTOM = { id: prep.meta.id, code: prep.code }; if (SONGS[ACT]) SONGS[ACT].custom = CUSTOM; }
  sceneToRenderer(r);
  if (shaderInfo) {
    if (shaderInfo.pipeline) { r.shader = { pipeline: shaderInfo.pipeline, half: shaderInfo.mode === 'half' };
      if (shaderInfo.mode === 'half') notice('shader', `自訂 shader 比較重（估計 ${Math.round(shaderInfo.est * 4)} ms／格），已自動改用半解析度計算。`); }
    else await enableShader(true);
  }
  if (prep.meta.canvas) await startCanvas(false);
  renderNotices();
}
/* 找風格程式：這首歌的新風格 → 內建 → 其他分頁的新風格 */
const sourceFor = id => {
  if (CUSTOM && CUSTOM.id === id) return { code: CUSTOM.code, custom: true };
  const b = BUILTIN.find(b => b.id === id); if (b) return { code: b.code, custom: false };
  const o = SONGS.find(s => s.custom && s.custom.id === id); return o ? { code: o.custom.code, custom: true } : null;
};
async function useStyle(id) {
  const src = sourceFor(id); if (!src) throw errAt(`沒有「${id}」這個風格。`);
  const same = !!(scene && scene.code === src.code);
  const prep = await prepareScene(src.code, src.custom, src.custom && !same && !VERIFIED.has(fnv(src.code)));
  await commitScene(prep);
}
/* 執行中場景出錯／卡住：自訂場景退回內建場景 */
async function sceneFailed(e) {
  const m = meta();
  if (!e.hang) { pvStatus('預覽錯誤（風格程式）：' + fmtErr(e), true); clip = null; return; }
  const isCustom = CUSTOM && CUSTOM.id === m.id && sceneCode === CUSTOM.code;
  if (isCustom) addSuspect(fnv(sceneCode));
  const fb = BUILTIN.find(b => b.id !== m.id) || BUILTIN[0];
  try {
    await commitScene(await prepareScene(fb.code, false));
    const notes = adapt(P, meta()); save('風格出錯，退回內建風格');
    notice('scene', `「${m.name}」${e.message} ${isCustom ? '已停用這個新風格，' : ''}退回內建「${meta().name}」。` + (notes.length ? '（' + notes.join('；') + '）' : ''),
      isCustom ? { label: '再試一次新風格', fn: async () => { unSuspect(fnv(CUSTOM.code)); await applyStyle(CUSTOM.id); } } : null);
    renderStyle(); refresh();
  } catch (x) { showErr('場景無法恢復：' + fmtErr(x)); }
}

/* ================= 組影片 ================= */
async function makeClip(si, ci) {
  const s = P.sections[si], k = K(), m = meta(), bg = m.backgrounds[s.background];
  const jump = bg.jumpBeats / s.jumpBeats;
  let out;
  if (ci === 0) {
    const frames = frames32() * s.loopBeats / 32;
    out = { kind: 'bg', type: s.background, loop: true, frames, duration: frames / FPS, map: tt => tt * k };
  } else {
    const pr = pairsOf(s)[ci - 1], frames = Math.round(s.clipSeconds * FPS);
    out = { kind: 'sub', type: s.subtitle, loop: false, frames, duration: frames / FPS, map: tt => k * warp(tt, s.enterSpeed), text: pr.a, text2: pr.b, swap: !!s.swapLang, dur: k * warp(s.clipSeconds, s.enterSpeed) };
  }
  out.jump = jump;
  await scene.clip({ kind: out.kind, type: out.type, text: out.text, text2: out.text2, swap: out.swap, dur: out.dur, jump, pal: P.palette, params: paramsNow() });
  sceneToRenderer(r);
  return out;
}
let rebuildN = 0;
function rebuild() {
  if (!scene || exporting) return;
  const my = ++rebuildN;
  return serial(async () => {
    if (my !== rebuildN) return;
    const n = 1 + slidesOf(sec()).length; if (clipIdx >= n) clipIdx = 0;
    try { clip = await makeClip(cur, clipIdx); $('#scrub').max = clip.duration; t = Math.min(t, clip.duration); pvStatus(''); }
    catch (e) { clip = null; if (e.hang) await sceneFailed(e); else pvStatus('預覽失敗：' + fmtErr(e), true); }
  });
}

/* ================= 介面：共用小工具 ================= */
const SKILL = window.WM_SRC ? (WM_SRC.skill || '') : (($('#wm-skill') || {}).textContent || '');
const STYLE_DESC = { swiss: '俐落色塊、跟著節拍跳格，像設計展海報。', paper: '溫暖手作、紙片有影子，像手作卡片。', type: '大字當背景紋理，像口號海報。', bauhaus: '圓、三角、原色，活潑像兒童繪本。', riso: '復古印刷、顏色稍微錯位，像獨立樂團海報。',
  ink: '暖色宣紙上，墨慢慢暈開、淡去、再暈開，像呼吸。適合敬拜、安靜的歌。', nave: '深藍到墨綠的底，高窗落下幾道平塗光柱，慢慢淡入淡出。適合敬拜、安靜的歌。',
  field: '低地平線的麥田，筆觸草葉隨風擺、三層慢慢流動，高潮翻成金色麥浪。適合感恩、數算恩典這類溫暖的歌。', sky: '切紙雲層慢慢飄，高潮時雲開、平塗光束落下。適合敬拜、宣告、高舉的歌。',
  field_photo: '像實拍的麥田：低機位、風吹過一波波麥浪，高潮是夕陽金色。適合感恩、溫暖的歌（較吃顯示卡）。', sky_photo: '像實拍的天空：有體積的雲慢慢飄、生成、消散，高潮雲開、陽光從雲隙灑下。適合敬拜、高舉的歌（較吃顯示卡）。' };
const JUMP_WORD = { 1: '很快', 2: '快', 4: '中', 8: '慢' };
const SPLIT_DESC = { line: '一行做成一支，用 [ ] 框住的字會放大', block: '空一行分成一支，好跟唱；一組超過 3 行會自動平均切開' };
const SPLIT_SHORT = { line: '一行一支', block: '一段一支' };
let lastCopied = '', curStep = 1, curTab = 'ai', undoDel = null, lastSceneErr = '';
const fixText = err => `我把你的回覆貼進「詩歌影片編輯器」，出現這個錯誤：\n\n${err}\n\n請修正後再給我一次完整的內容（設定放在 \`\`\`json 框、新風格放在 \`\`\`js 框）。`;
/* 訊息一律寫在觸發它的地方附近；kind：true＝錯誤（附「複製錯誤訊息給 AI」）、'ok'＝完成、其他＝一般 */
function say(sel, text, kind) {
  const el = $(sel); if (!el) return;
  const bad = kind === true || kind === 'err';
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

/* 頁內對話框（不用 confirm）：回傳按下的按鈕代號；Esc＝'cancel' */
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

/* 存檔狀態：這台電腦的暫存 vs 已存成檔案 */
/* 存檔狀態：看「整本」（全部分頁）；fresh＝這一首是剛開的空白新歌，還沒動過 */
const snap = () => { stash(); return fnv(JSON.stringify(SONGS.map(s => [s.P, s.custom ? s.custom.code : '']))); };
const isSaved = () => !!P && store.get('saved') === snap();
const isFresh = () => !!P && !!SONGS[ACT] && SONGS[ACT].fresh === fnv(JSON.stringify(P));
function renderSaveState() {
  if (!P) return; const s = isSaved(), n = SONGS.length;
  $('#saveState').classList.toggle('saved', s);
  $('#saveText').textContent = n > 1 ? (s ? `整本 ${n} 首已存成檔案` : `整本 ${n} 首：這台電腦已暫存，還沒存成檔案`) : (s ? '已存成檔案' : '這台電腦已暫存，還沒存成檔案');
}
function markSaved() { store.set('saved', snap()); renderSaveState(); }
function markFresh() { if (SONGS[ACT]) SONGS[ACT].fresh = fnv(JSON.stringify(P)); persist(); renderSaveState(); }

/* 分頁、步驟 */
const TABS = ['ai', 'self', 'adv'];
function showTab(name, focus) {
  curTab = name;
  for (const k of TABS) { const tb = $('#tab-' + k), on = k === name; tb.setAttribute('aria-selected', String(on)); tb.tabIndex = on ? 0 : -1; $('#pane-' + k).hidden = !on; }
  if (focus) $('#tab-' + name).focus();
  setStep(name === 'ai' ? 1 : 2);
}
function setStep(n) { curStep = n; document.querySelectorAll('#steps>button').forEach(b => +b.dataset.step === n ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')); }
TABS.forEach((k, i) => {
  $('#tab-' + k).onclick = () => showTab(k);
  $('#tab-' + k).onkeydown = e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { e.preventDefault(); showTab(TABS[(i + d + 3) % 3], true); } };
});
document.querySelectorAll('#steps>button').forEach(b => b.onclick = () => {
  const n = +b.dataset.step;
  if (n === 1) { showTab('ai'); $('#askCard').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); $('#askText').focus({ preventScroll: true }); }
  if (n === 2) { showTab('self'); $('.frame').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  if (n === 3) { $('#exportCard').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); $('#exOne').focus({ preventScroll: true }); setStep(3); }
});
$('#exportCard').addEventListener('focusin', () => setStep(3));
$('#exportCard').addEventListener('click', () => setStep(3));

/* 「?」說明：滑過或點開都可以 */
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

/* 分段按鈕 */
function fillSeg(box, opts, val, pick) {
  box.innerHTML = '';
  for (const o of opts) {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(String(o.v) === String(val)));
    const a = document.createElement('span'); a.textContent = o.label; b.append(a);
    if (o.sub) { const s = document.createElement('small'); s.textContent = o.sub; b.append(s); }
    b.onclick = () => pick(o.v); box.appendChild(b);
  }
}

/* ================= 介面：繪製 ================= */
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
  $('#styleDesc').textContent = STYLE_DESC[m.id] || (isCustomNow() ? 'AI 做的新風格。想改它的長相：「請 AI 改」勾選「連同新風格的程式」。' : '');
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
    d.append(n, mm, btn('↑', `把「${s.name}」往上移`, () => move(i, -1)), btn('↓', `把「${s.name}」往下移`, () => move(i, 1)), btn('刪除', `刪除「${s.name}」`, () => remove(i)));
    d.onclick = e => { if (e.target.tagName !== 'BUTTON') pickSec(i); };
    d.onkeydown = e => { if (e.key === 'Enter' && e.target === d) pickSec(i); };
    box.appendChild(d);
  });
}
function btn(txt, aria, fn) { const b = document.createElement('button'); b.className = 'small'; b.textContent = txt; b.setAttribute('aria-label', aria); b.onclick = e => { e.stopPropagation(); fn(); }; return b; }
function move(i, d) { const j = i + d; if (j < 0 || j >= P.sections.length) return; [P.sections[i], P.sections[j]] = [P.sections[j], P.sections[i]]; if (cur === i) cur = j; else if (cur === j) cur = i; save(`段落「${P.sections[j].name}」${d < 0 ? '往上移' : '往下移'}`); refresh(); }
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
  const m = meta(), k = Object.keys(m.backgrounds)[0];
  P.sections.push({ name: `段落 ${P.sections.length + 1}`, background: k, jumpBeats: m.backgrounds[k].jumpBeats, loopBeats: 32, subtitle: 'none', clipSeconds: 6, enterSpeed: 1, lyrics: '', lyrics2: '', swapLang: false });
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

/* ================= 介面：自己調 ================= */
$('#sDur').onchange = () => { sec().clipSeconds = Math.max(2, Math.min(60, Number($('#sDur').value) || 6)); secRefresh('每支長度'); };
$('#sEnter').oninput = () => { sec().enterSpeed = Number($('#sEnter').value); $('#sEnterV').textContent = sec().enterSpeed + '×'; save(`${sec().name}：進場速度`, 'enter:' + cur); deb(rebuild); };
$('#sName').oninput = () => { sec().name = $('#sName').value; $('#secTitle').textContent = sec().name; save('改段落名稱', 'name:' + cur); renderSecTabs(); renderSections(); renderClips(); };
$('#sLyrics').oninput = () => { sec().lyrics = $('#sLyrics').value; save(`${sec().name}：改歌詞`, 'lyr:' + cur); renderLyricHint(); deb(() => { renderClips(); renderSections(); rebuild(); }); };
$('#sLyrics2').oninput = () => { sec().lyrics2 = $('#sLyrics2').value; save(`${sec().name}：改第二語言歌詞`, 'lyr2:' + cur); renderLyricHint(); deb(() => { renderClips(); renderSections(); rebuild(); }); };
$('#sSwap').onchange = () => { sec().swapLang = $('#sSwap').checked; save(`${sec().name}：${sec().swapLang ? '大小對調' : '取消大小對調'}`); renderLyricHint(); rebuild(); };
/* 轉成繁體：作用在這一段的兩個歌詞框 */
$('#s2tBtn').onclick = () => {
  const s = sec(), a = toTrad(s.lyrics || ''), b = toTrad(s.lyrics2 || ''), n = diffCount(s.lyrics || '', a) + diffCount(s.lyrics2 || '', b);
  if (!n) { say('#lyrMsg', '沒有要轉的簡體字。'); return; }
  s.lyrics = a; s.lyrics2 = b; save(`${s.name}：轉成繁體`); renderSection(); renderClips(); renderSections(); rebuild();
  say('#lyrMsg', `已轉成繁體（改了 ${n} 個字），請檢查少數一字多義的字（例如 发→發／髮）。`, 'ok');
};
$('#title').oninput = () => { P.title = $('#title').value; document.title = `${P.title}｜詩歌影片編輯器`; save('改歌名', 'title'); };
$('#bpm').onchange = () => { const b = Number($('#bpm').value); if (b >= 40 && b <= 220) { P.bpm = b; say('#selfMsg', ''); save(`速度改成 ${b}`); refresh(); } else { $('#bpm').value = P.bpm; say('#selfMsg', '速度要在 40 到 220 之間（不知道就填 120）。', true); } };
$('#palReset').onclick = () => { P.palette = {}; P.params = {}; save('配色與參數還原'); refresh(); };
async function applyStyle(id) {
  const from = meta().name;
  try { await useStyle(id); const notes = adapt(P, meta()); save(`換風格：${from} → ${meta().name}`); renderStyle(); await refresh(); say('#selfMsg', notes.length ? '換風格：' + notes.join('；') : ''); return true; }
  catch (e) { renderStyle(); say('#selfMsg', '換不了風格：' + fmtErr(e), true); return false; }
}
$('#style').onchange = () => applyStyle($('#style').value);
$('#secAdd').onclick = () => { addSection(); $('#sName').focus(); $('#sName').select(); };
let debT; const deb = fn => { clearTimeout(debT); debT = setTimeout(fn, 300); };
$('#play').onclick = () => { playing = !playing; $('#play').textContent = playing ? '暫停' : '播放'; $('#play').setAttribute('aria-label', playing ? '暫停' : '播放'); };
$('#scrub').oninput = e => { t = +e.target.value; playing = false; $('#play').textContent = '播放'; };
let inflight = false;
function tick(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (!exporting && clip) {
    if (playing) { t += dt; if (t >= clip.duration) t = clip.loop ? t - clip.duration : 0; }
    if (!NOPREVIEW && !inflight && !recovering) {
      inflight = true;
      serial(() => drawAt(t, frameNo++, 'canvas')).catch(async e => { if (e.hang) await sceneFailed(e); else { pvStatus('預覽錯誤：' + fmtErr(e), true); clip = null; } }).finally(() => { inflight = false; });
    }
    $('#scrub').value = t; $('#time').textContent = t.toFixed(1) + ' / ' + clip.duration.toFixed(1) + ' 秒';
  }
  requestAnimationFrame(tick);
}

/* ================= 貼上整首歌詞：大文字框 →「分到各段」→ 頁內對話框預覽 → 套用 ================= */
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
$('#lyrSplit').onclick = () => openLyricsDialog();
$('#lyrDlg').addEventListener('change', e => { if (e.target.name === 'lyrLang' || e.target.name === 'lyrTarget' || e.target.id === 'lyrTrad') renderLyrPlan(); });
$('#lyrCancel').onclick = () => closeLyr();
$('#lyrDlg').oncancel = e => { e.preventDefault(); closeLyr(); };
$('#lyrApply').onclick = async () => {
  if (!lyrPlan || !lyrPlan.plan.length) return;
  lyrUndo = clone(P); const n = lyrPlan.plan.length, added = lyrPlan.plan.filter(e => e.isNew).length, trad = lyrOpts().trad;
  applySplit(lyrPlan); closeLyr(); save('貼上整首歌詞'); clipIdx = 0; await refresh();
  say('#lyrAllMsg', `已分到 ${n} 段${added ? `（新增 ${added} 段）` : ''}。${trad ? '已轉成繁體，請檢查少數一字多義的字（例如 发→發／髮）。' : ''}點上面的段落看預覽。`, 'ok');
  const u = document.createElement('button'); u.className = 'small'; u.type = 'button'; u.textContent = '復原'; u.onclick = async () => { if (!lyrUndo) return; lyrUndo = null; await undo(); say('#lyrAllMsg', '已復原成貼上前的歌詞。'); };
  $('#lyrAllMsg').append(' ', u);
};
$('#lyrFromAI').onclick = () => { showTab('self'); $('#lyrCard').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); $('#lyrAll').focus({ preventScroll: true }); };

/* ================= 設定、新風格、AI ================= */
const bgLabel = (m, k) => (m && m.backgrounds[k] || {}).label || k;
const subLabel = (m, k) => k === 'none' ? '不要' : ((m && m.subtitles[k]) || {}).label || k;
function videoCount() { let subs = 0; for (const x of P.sections) subs += slidesOf(x).length; return { n: P.sections.length + subs, subs }; }
function summaryLine() { const c = videoCount(); return `風格「${meta().name}」・${P.sections.length} 段・會產生 ${c.n} 支影片（背景 ${P.sections.length}、字幕 ${c.subs}）`; }
/* 套用前後比對，列出改了哪些（給人看的說法） */
function changes(a, b, mOld, mNew) {
  if (!a) return [];
  if (a.title !== b.title) return [`換成另一首歌「${b.title}」`];
  const out = [];
  if (a.style !== b.style) out.push(`風格：${mOld ? mOld.name : a.style} → ${mNew.name}`);
  if (a.bpm !== b.bpm) out.push(`速度：${a.bpm} → ${b.bpm}`);
  if (a.style === b.style && JSON.stringify(a.palette || {}) !== JSON.stringify(b.palette || {})) out.push('配色');
  if (a.style === b.style && JSON.stringify(a.params || {}) !== JSON.stringify(b.params || {})) out.push('質感參數');
  b.sections.forEach((s, i) => {
    const o = a.sections[i]; if (!o) { out.push(`新增一段「${s.name}」`); return; }
    const c = [];
    if (o.name !== s.name) c.push(`名稱改成「${s.name}」`);
    if (o.background !== s.background) c.push(`背景 ${bgLabel(mOld, o.background)} → ${bgLabel(mNew, s.background)}`);
    if (o.jumpBeats !== s.jumpBeats) c.push(`色塊換位 ${JUMP_WORD[o.jumpBeats]} → ${JUMP_WORD[s.jumpBeats]}`);
    if (o.loopBeats !== s.loopBeats) c.push(`循環長度 ${o.loopBeats} → ${s.loopBeats} 拍`);
    if (o.subtitle !== s.subtitle) c.push(`字幕 ${subLabel(mOld, o.subtitle)} → ${subLabel(mNew, s.subtitle)}`);
    if (s.subtitle !== 'none' && o.clipSeconds !== s.clipSeconds) c.push(`每支 ${o.clipSeconds} → ${s.clipSeconds} 秒`);
    if (s.subtitle !== 'none' && o.enterSpeed !== s.enterSpeed) c.push(`進場速度 ${o.enterSpeed}× → ${s.enterSpeed}×`);
    if (o.lyrics !== s.lyrics) c.push('歌詞');
    if ((o.lyrics2 || '') !== (s.lyrics2 || '')) c.push('第二語言歌詞');
    if (!!o.swapLang !== !!s.swapLang) c.push(s.swapLang ? '大小對調（第二語言大）' : '取消大小對調');
    if (c.length) out.push(`${o.name}：${c.join('、')}`);
  });
  if (a.sections.length > b.sections.length) out.push(`刪掉：${a.sections.slice(b.sections.length).map(s => s.name).join('、')}`);
  return out;
}
function doneText(prefix, ch, warnings = []) {
  return `已套用 ✔ ${prefix}${summaryLine()}` +
    (ch.length ? '\n改了：\n・' + ch.slice(0, 10).join('\n・') + (ch.length > 10 ? `\n・…還有 ${ch.length - 10} 項` : '') : prefix ? '' : '\n（內容和原本一樣）') +
    (warnings.length ? '\n注意：\n・' + warnings.join('\n・') : '') + '\n下一步：在左邊點段落、點影片看預覽。';
}
async function applyRaw(raw, source, where = '#cfgStatus', pre = null) {
  const out = (s, k) => say(where, s, k);
  const before = pre ? pre.before : (P ? clone(P) : null), mOld = pre ? pre.mOld : (scene ? meta() : null), prefix = pre ? pre.prefix : '';
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { out(`${source}沒有套用：設定要用 { } 包起來。`, true); return false; }
  const want = raw.style != null ? String(raw.style).toLowerCase() : meta().id;
  let prep = null, m = meta();
  if (want !== m.id) {
    const src = sourceFor(want);
    if (!src) { out(`${source}沒有套用，請修正後再試：\n・style「${want}」不存在。可用：${[...BUILTIN.map(b => b.id), ...(CUSTOM ? [CUSTOM.id] : [])].join('、')}（AI 做的新風格要連同 \`\`\`js 框一起貼上）。`, true); return false; }
    try { prep = await prepareScene(src.code, src.custom); m = prep.meta; } catch (e) { out(`${source}沒有套用：風格「${want}」載入失敗：${fmtErr(e)}`, true); return false; }
  }
  const n = normalize(raw, m, m.id);
  if (!n.project) { if (prep) prep.host.kill(); out(`${source}沒有套用，請修正後再試：\n・` + n.errors.join('\n・'), true); return false; }
  if (prep) await commitScene(prep);
  const chg = changes(before, n.project, mOld, m);
  P = n.project; cur = 0; clipIdx = 0; t = 0;
  save(chg.length && /^換成另一首歌/.test(chg[0]) ? chg[0] : source === 'AI 的設定' ? '套用 AI 的回覆' : '載入' + source);
  renderStyle(); await refresh();
  out(doneText(prefix, changes(before, P, mOld, meta()), n.warnings), 'ok');
  return true;
}
/* 貼上新風格：檢查通過才換；失敗保留原本的風格 */
async function pasteScene(code) {
  sceneStatus('檢查新風格中…（每種背景與字幕試跑幾格）');
  try {
    const prep = await prepareScene(code, true);
    await commitScene(prep);
    const notes = adapt(P, meta()); save(`套用新風格「${meta().name}」`);
    renderStyle(); await refresh();
    const m = meta();
    sceneStatus(`已套用新風格「${m.name}」：背景 ${Object.values(m.backgrounds).map(x => x.label).join('、')}；字幕 ${Object.values(m.subtitles).map(x => x.label).join('、') || '無'}。` + (notes.length ? '\n' + notes.join('；') : ''), 'ok');
    return true;
  } catch (e) {
    lastSceneErr = fmtErr(e);
    sceneStatus('沒有套用（保留原本的風格）：\n' + lastSceneErr, true);
    if (e.retry) notice('scene', '這段新風格上次讓頁面卡住。確定要再試一次嗎？', { label: '仍要試跑', fn: () => { unSuspect(e.retry); notices.delete('scene'); renderNotices(); pasteScene(code); } });
    return false;
  }
}
/* 同一個解析器：```json → 設定、有 defineScene 的 ```js → 新風格 */
async function pasteAny(text, where = '#cfgStatus') {
  const p = splitPaste(text), before = P ? clone(P) : null, mOld = scene ? meta() : null;
  if (!p.code && !p.json) { say(where, '沒有套用：' + (p.jsonErr && !/^找不到/.test(p.jsonErr) ? p.jsonErr : '找不到設定或新風格。請在 AI 回覆下方按「複製」，整則貼進來。'), true); return false; }
  let prefix = '';
  if (p.code) {
    if (!(await pasteScene(p.code))) { say(where, '新風格沒有套用（保留原本的風格）：\n' + lastSceneErr, true); return false; }
    prefix = `新風格「${meta().name}」\n`;
  }
  if (p.json) return applyRaw(p.json, 'AI 的設定', where, { before, mOld, prefix });
  say(where, doneText(prefix, changes(before, P, mOld, meta())), 'ok'); return true;
}
function exportText() { return JSON.stringify(P, null, 2); }

/* 請 AI 改：①想改什麼 */
const CHIPS = [
  ['太躁，想穩一點', s => `「${s}」的背景太躁，想穩一點。`],
  ['不夠嗨', s => `「${s}」不夠嗨，想更有力一點。`],
  ['太花，想留白', s => `「${s}」畫面太花，想多一點留白。`],
  ['換顏色', () => '想換顏色：（例如教會主色墨綠、暖一點、聖誕節配色）'],
  ['字幕進場太急', s => `「${s}」的字幕進場太急，想慢一點。`],
  ['換個風格', () => '想換個風格，請給我幾個選項。'],
  ['加字幕', s => `「${s}」想加動態字幕，歌詞如下：\n`],
  ['加一段', () => '想加一段：（例如副歌 2、橋段、間奏）'],
];
CHIPS.forEach(([label, fn]) => {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
  b.onclick = () => { const a = $('#askText'), v = fn(P ? sec().name : '這一段'); a.value = a.value.trim() ? a.value.replace(/\s*$/, '\n') + v : v; a.focus(); a.setSelectionRange(a.value.length, a.value.length); };
  $('#chips').appendChild(b);
});
function aiText() {
  const want = $('#askText').value.trim();
  let s = `這是我目前的詩歌影片設定（格式 ${FORMAT}）。請照「worship-motion-backgrounds」skill 接著修改，回覆時給我一個完整的 json 程式碼區塊。\n我想改：${want || '（我還說不清楚，請你用選擇題問我）'}\n\n\`\`\`json\n${exportText()}\n\`\`\``;
  if (isCustomNow() && $('#withCode').checked) s += `\n\n這是目前的新風格程式（風格「${meta().name}」）。如果要改畫面長相，請修改它，回覆一段完整的 js 程式碼區塊：\n\n\`\`\`js\n${sceneCode}\n\`\`\``;
  return s;
}
$('#copyAI').onclick = () => copyText(aiText(), '已複製 ✔ 貼到 AI 對話送出。AI 回覆後，整則貼到下面②。', '#copyMsg');
/* ③開場白：短的給已裝 skill 的 AI；長的＝一句說明＋整份 SKILL.md，任何 AI 都能用 */
function openingText(short) {
  const name = P && !isFresh() && P.title !== '新的詩歌' ? `「${P.title}」` : '';
  const tail = `\n\n我的歌：${name}（歌名、感覺、歌詞；不知道怎麼說就先不寫，請你用選擇題問我）`;
  if (short) return '請用「worship-motion-backgrounds」skill 幫我做教會敬拜詩歌的動態背景和字幕影片。先用選擇題問我，再給我可以貼進「詩歌影片編輯器」的設定。' + tail;
  return '我要用「詩歌影片編輯器」做教會敬拜詩歌的動態背景和字幕影片。下面是完整的做法說明（給 AI 看的規格），請照著做：先用選擇題問我，再給我可以貼回編輯器的設定（放在 ```json 框）。\n\n=====（做法說明開始）=====\n' + SKILL.trim() + '\n=====（做法說明結束）=====' + tail;
}
$('#copyOpen').onclick = () => copyText(openingText(false), '已複製開場白 ✔ 貼到任何 AI 的新對話送出，照它的選擇題回答。', '#openMsg');
$('#copyOpenShort').onclick = () => copyText(openingText(true), '已複製短開場白 ✔ 貼到已裝 skill 的 AI 對話送出。', '#openMsg');

/* 請 AI 改：②貼回來（即時偵測） */
function detect(text) {
  const s = String(text || '');
  if (!s.trim()) return { empty: true, cfg: false, scene: false, err: '', noFence: false, title: '' };
  const p = splitPaste(s), cfg = !!p.json && typeof p.json === 'object' && !Array.isArray(p.json);
  return { empty: false, cfg, scene: !!p.code, err: cfg || p.code ? '' : (p.jsonErr || ''), noFence: !/```/.test(s) && /\bdefineScene\s*\(/.test(s), title: cfg && typeof p.json.title === 'string' ? p.json.title.trim() : '' };
}
function renderDetect() {
  const d = detect($('#pasteText').value), box = $('#detect'); box.innerHTML = '';
  $('#pasteApply').disabled = !(d.cfg || d.scene);
  const line = (cls, txt) => { const s = document.createElement('span'); s.className = cls; s.textContent = txt; box.append(s); return s; };
  if (d.empty) { line('dim', '貼上後，這裡會先告訴你找到什麼，再按「套用」。'); return d; }
  const tag = (ok, label) => { const s = document.createElement('span'); s.className = 'found' + (ok ? ' yes' : ''); s.textContent = label + (ok ? ' ✔' : ' —'); return s; };
  box.append('找到：', tag(d.cfg, '設定'), tag(d.scene, '新風格'));
  if (d.title && P && d.title !== P.title) line('dim', `（另一首歌：「${d.title}」）`);
  if (d.noFence) line('warnline', '沒有看到 ``` 框。請用 AI 回覆下方的「複製」按鈕整則複製，不要只選取一段。');
  if (!d.cfg && !d.scene) {
    const fmt = d.err && !/^找不到/.test(d.err);
    line('badline', fmt ? d.err : '沒找到設定或新風格。請在 AI 回覆下方按「複製」，整則貼上。');
    if (fmt) { const b = document.createElement('button'); b.className = 'small'; b.type = 'button'; b.textContent = '複製錯誤訊息給 AI'; b.onclick = async () => { await copyText(fixText(d.err)); b.textContent = '已複製 ✔ 貼回 AI 對話'; }; box.append(b); }
  }
  return d;
}
/* 貼上的是另一首歌（title 不同）→ 問：開新分頁（推薦）／取代目前這首／取消。目前這首是剛開的空白新歌就直接放 */
async function guardSwitch(raw) {
  const nt = raw && typeof raw.title === 'string' ? raw.title.trim().slice(0, 80) : '';
  if (!nt || !P || nt === P.title || isFresh()) return 'same';
  const a = await ask({ title: `這是另一首歌「${nt}」`, body: `目前分頁是「${P.title}」。要把「${nt}」放在新的分頁，還是取代目前這首？`,
    buttons: [['new', '開新分頁放這首（推薦）', 'primary'], ['replace', '取代目前這首'], ['cancel', '取消']] });
  return a === 'new' || a === 'replace' ? a : false;
}
async function applyPasteUI(text) {
  const p = splitPaste(text); let g = 'same';
  if (p.json) { g = await guardSwitch(p.json); if (!g) { cfgStatus('沒有套用（已取消）。'); return false; } }
  const back = ACT;
  if (g === 'new') await newSong({ quiet: true });
  const b = $('#pasteApply'); b.disabled = true; cfgStatus(p.code ? '套用中…新風格要先試跑每種背景和字幕，約需幾秒。' : '套用中…');
  let ok = false;
  try { ok = await pasteAny(text); } finally { b.disabled = false; }
  if (!ok && g === 'new') { const msg = $('#cfgStatus').textContent; BOOKOPS.pop(); SONGS.splice(ACT, 1); await activate(Math.min(back, SONGS.length - 1), { noStash: true }); cfgStatus(msg, true); }
  if (ok) { $('#pasteText').value = ''; renderDetect(); setStep(2); if (g === 'new') say('#cfgStatus', `開了新分頁「${P.title}」。\n` + $('#cfgStatus').textContent, 'ok'); }
  return ok;
}
$('#pasteText').oninput = () => renderDetect();
$('#pasteApply').onclick = () => applyPasteUI($('#pasteText').value);
$('#pasteClear').onclick = () => { $('#pasteText').value = ''; renderDetect(); cfgStatus(''); $('#pasteText').focus(); };

/* 進階：新風格、設定檔 */
$('#sceneCopy').onclick = () => copyText(`這是我目前的詩歌影片風格程式（風格「${meta().name}」）。請照「worship-motion-backgrounds」skill 的場景 API 修改，回覆一段完整的 js 程式碼區塊（可以再附一段設定 json）。\n我想改：（例如「色塊太滿，想多留白」；不知道怎麼說就留空，請你用選擇題問我）\n\n\`\`\`js\n${sceneCode}\n\`\`\``, '已複製 ✔ 貼到 AI 對話，在「我想改」後面寫需求。AI 回覆後，到「請 AI 改」②整則貼回來。', '#sceneStatus');
$('#scenePaste').onclick = () => { showTab('ai'); $('#pasteCard').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); $('#pasteText').focus({ preventScroll: true }); };
$('#exportCfg').onclick = () => { const name = `${fileSafe(P.title)}_設定.json`; download(new Blob([exportText()], { type: 'application/json' }), name); say('#fileMsg', `已下載「${name}」。`, 'ok'); };
$('#importCfg').onclick = () => $('#importFile').click();
/* 打開檔案：設定 JSON、舊的單首 HTML、整本 HTML 都可以；每首歌成為一個分頁 */
function songsFromFile(text) {
  const head = text.slice(0, 2000);
  if (/<!doctype html|<html/i.test(head)) {
    const doc = new DOMParser().parseFromString(text, 'text/html'), pj = doc.querySelector('#wm-project');
    if (!pj) throw new Error('這個 HTML 不是「詩歌影片編輯器」存的檔案。');
    const raw = JSON.parse(pj.textContent || 'null'); if (!raw) throw new Error('這個檔案裡沒有歌曲設定（可能是空白的編輯器）。');
    if (Array.isArray(raw.songs)) return raw.songs.map(mkSong);
    const tag = [...doc.querySelectorAll('script.wm-scene')].find(s => String(raw.style || '').toLowerCase() === String(s.dataset.id).toLowerCase() && !BUILTIN.some(b => b.id === s.dataset.id));
    return [mkSong({ P: raw, custom: tag ? { id: tag.dataset.id, code: tag.textContent.trim() } : null })];
  }
  const p = splitPaste(text);
  if (p.json && Array.isArray(p.json.songs)) return p.json.songs.map(mkSong);
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
$('#importFile').onchange = async () => {
  const f = $('#importFile').files[0]; if (!f) return;
  try { await importText(await f.text()); } catch (e) { say('#fileMsg', '讀不到這個檔案：' + e.message, true); }
  $('#importFile').value = '';
};

/* 頂端：歌曲分頁、存檔 */
const fileSafe = s => String(s).replace(/[\\/:*?"<>|\s\[\]]+/g, '').slice(0, 40) || '未命名';
const pad2 = n => String(n).padStart(2, '0');
const songTitle = i => ((i === ACT ? P : SONGS[i] && SONGS[i].P) || {}).title || '未命名';
function renderSongName() { const b = document.querySelector(`#songTabs .stab[data-i="${ACT}"] .sname`); if (b && P) b.textContent = P.title; }
function renderSongTabs() {
  const box = $('#songTabs'); if (!box) return; box.innerHTML = '';
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
  const a = box.querySelector('.stab[aria-current],.sname[aria-selected=true]'); if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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
/* 切到第 i 首：載入它的風格（同一份程式就不用重來）、設定、目前段落 */
/* 一次只切一個分頁（連點兩個分頁時排隊，不會互相寫錯歌） */
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
  ACT = Math.max(0, Math.min(i, SONGS.length - 1)); const sg = SONGS[ACT]; CUSTOM = sg.custom || null;
  const raw = sg.P && typeof sg.P === 'object' ? sg.P : clone(SAMPLE);
  const want = raw.style ? String(raw.style).toLowerCase() : BUILTIN[0].id, src = sourceFor(want);
  if (!(scene && src && scene.code === src.code)) {
    let ok = false;
    if (src) {
      try { await useStyle(want); ok = true; }
      catch (e) { notice('scene', `「${raw.title || ''}」的風格「${want}」載入失敗：${fmtErr(e)}。先用內建「${BUILTIN[0].name}」。`, e.retry ? { label: '仍要試跑', fn: async () => { unSuspect(e.retry); notices.delete('scene'); await applyStyle(want); } } : null); }
    } else notice('scene', `「${raw.title || ''}」用的風格「${want}」找不到（新風格的程式沒有一起存），先用內建「${BUILTIN[0].name}」。`);
    if (!ok && !(scene && scene.code === BUILTIN[0].code)) await useStyle(BUILTIN[0].id);
  } else if (src.custom && !(CUSTOM && CUSTOM.code === src.code)) { CUSTOM = { id: want, code: src.code }; sg.custom = CUSTOM; }
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
  CLOSED.unshift({ id, i, at: Date.now(), title: (rm.P && rm.P.title) || '未命名', song: rm }); CLOSED = CLOSED.slice(0, 5);
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
/* 分頁選單（目前這首的「⋯」） */
function openSongMenu(btn) {
  const m = $('#songMenu'), rc = btn.getBoundingClientRect();
  m.hidden = false; m.style.left = Math.max(8, Math.min(innerWidth - 240, rc.left)) + 'px'; m.style.top = (rc.bottom + 4) + 'px';
  $('#smLeft').disabled = ACT === 0; $('#smRight').disabled = ACT >= SONGS.length - 1; $('#smClose').disabled = SONGS.length <= 1;
  m.querySelector('button').focus();
}
function closeSongMenu() { const m = $('#songMenu'); if (m) m.hidden = true; }
$('#smRename').onclick = () => renameSong(ACT);
$('#smLeft').onclick = () => { closeSongMenu(); moveSong(ACT, -1); };
$('#smRight').onclick = () => { closeSongMenu(); moveSong(ACT, 1); };
$('#smSaveOne').onclick = () => { closeSongMenu(); saveHTML('one'); };
$('#smClose').onclick = () => closeSong(ACT);
$('#smReset').onclick = () => resetSong();
if ($('#histReset')) $('#histReset').onclick = () => resetSong();
document.addEventListener('click', e => { if (!e.target.closest('#songMenu')) closeSongMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSongMenu(); });

/* 存成單檔 HTML：引擎＋編輯器＋內建風格＋做法說明（gzip 壓縮）＋整本的歌（每首的設定、新風格程式），打開還是多分頁，可以再存 */
const BOOT = `(async()=>{const b=Uint8Array.from(atob(document.getElementById('wm-z').textContent.trim()),c=>c.charCodeAt(0));` +
  `const s=JSON.parse(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text());window.WM_SRC=s;(0,eval)(s.app+'\\n//# sourceURL=wm-app.js');})()` +
  `.catch(e=>{document.body.textContent='無法啟動，請用最新版 Chrome 或 Edge 打開：'+e.message;});`;
function bookJSON(which = 'book') {
  stash();
  const list = which === 'one' ? [SONGS[ACT]] : SONGS;
  return { format: 'worship-motion-book/1', active: which === 'one' ? 0 : ACT, songs: list.map(s => ({ project: s.P, scene: s.custom ? { id: s.custom.id, code: s.custom.code } : null })) };
}
async function singleHTML(which = 'book') {
  const attr = s => String(s).replace(/[&"<>]/g, c => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[c]);
  const zb = new Uint8Array(await new Response(new Blob([JSON.stringify({ runtime: RUNTIME, app: APP_SRC, skill: SKILL, scenes: BUILTIN, s2t: S2T_SRC })]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let bin = ''; for (let i = 0; i < zb.length; i += 32768) bin += String.fromCharCode.apply(null, zb.subarray(i, i + 32768));
  const doc = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), book = bookJSON(which);
  const title = book.songs.length > 1 ? `${book.songs.length} 首詩歌` : book.songs[0].project.title;
  return `<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${attr(title)}｜詩歌影片編輯器</title>\n<style id="wm-css">${$('#wm-css').textContent}</style>\n</head>\n<body>\n<template id="wm-ui">${$('#wm-ui').innerHTML}</template>\n` +
    `<!-- 這本的歌：每首的設定（project）和 AI 做的新風格程式（scene，可以給 AI 看、改） -->\n<script type="application/json" id="wm-project" data-doc="${doc}">${JSON.stringify(book, null, 1).replace(/</g, '\\u003c')}</script>\n` +
    `<!-- 引擎、編輯器、內建風格、做法說明、簡轉繁對照表（gzip＋base64，瀏覽器內建解壓，不連網） -->\n<script type="text/plain" id="wm-z">${btoa(bin)}</script>\n<script>${BOOT}</script>\n</body>\n</html>\n`;
}
async function saveHTML(which = 'book') {
  const one = which === 'one' || SONGS.length === 1;
  const h = await singleHTML(which), name = one ? `${fileSafe(P.title)}_詩歌影片.html` : `${fileSafe(songTitle(0))}等${SONGS.length}首_詩歌影片.html`, kb = Math.round(new Blob([h]).size / 1024);
  download(new Blob([h], { type: 'text/html' }), name);
  if (which !== 'one' || SONGS.length === 1) markSaved();
  say('#saveMsg', which === 'one' && SONGS.length > 1 ? `已下載「${name}」（只有「${P.title}」，${kb} KB）。整本還要另外按「存成單檔 HTML」。` : `已下載「${name}」（${one ? '' : `整本 ${SONGS.length} 首，`}${kb} KB）。下次打開這個檔案就能接著改。`);
  return name;
}
$('#saveHTML').onclick = () => saveHTML();
/* 做新的一首：開新分頁（不再覆蓋目前這首） */
async function newSong({ quiet = false } = {}) {
  if (exporting) return false;
  stash();
  const id = BUILTIN.some(b => b.id === meta().id) ? meta().id : BUILTIN[0].id;
  SONGS.splice(ACT + 1, 0, mkSong({ P: { format: FORMAT, title: '新的詩歌', style: id, bpm: 120, sections: [{ name: '主歌', background: 'calm' }, { name: '副歌', background: 'peak' }] } }));
  await activate(ACT + 1); markFresh(); bookOp({ type: 'new', uid: SONGS[ACT].uid, label: '做新的一首' });
  if (quiet) return true;
  $('#askText').value = ''; $('#pasteText').value = ''; renderDetect();
  ['#cfgStatus', '#copyMsg', '#secMsg', '#status', '#saveMsg', '#songMsg'].forEach(s => say(s, ''));
  showTab('ai');
  say('#openMsg', '新的一首（新分頁）：按「複製開場白」貼給 AI，告訴它歌名、感覺和歌詞。AI 給你設定後，整則貼到上面②。', 'ok');
  $('#openCard').scrollIntoView({ block: 'nearest' }); $('#copyOpen').focus({ preventScroll: true });
  return true;
}
$('#newSong').onclick = () => newSong();
$('#undoBtn').onclick = () => undo();
$('#redoBtn').onclick = () => redo();
$('#closedBtn').onclick = e => { e.stopPropagation(); const m = $('#closedMenu'), rc = $('#closedBtn').getBoundingClientRect(); m.hidden = !m.hidden; m.style.left = Math.max(8, Math.min(innerWidth - 300, rc.left)) + 'px'; m.style.top = (rc.bottom + 4) + 'px'; if (!m.hidden && m.firstChild) m.firstChild.focus(); };
document.addEventListener('click', e => { if (!e.target.closest('#closedMenu') && e.target.id !== 'closedBtn') $('#closedMenu').hidden = true; });
$('#histGo').onclick = () => histSel >= 0 && goHist(histSel);
$('#tab-adv').addEventListener('click', () => renderHistory());
/* 快捷鍵：游標在文字框裡打字時，讓瀏覽器自己的文字還原優先；離開文字框才是編輯器的還原 */
const isTextField = el => !!el && (el.tagName === 'TEXTAREA' || el.isContentEditable || (el.tagName === 'INPUT' && /^(text|number|search|url|email|tel|password)$/i.test(el.type)));
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const k = e.key.toLowerCase(); if (k !== 'z' && k !== 'y') return;
  if (isTextField(e.target) || $('#dlg').open || $('#lyrDlg').open) return;
  e.preventDefault(); (k === 'y' || e.shiftKey) ? redo() : undo();
});

/* 第一次打開：三步驟說明卡 */
const INTRO = 'wm:intro';
$('#intro').hidden = lsGet(INTRO) === 'off';
$('#introClose').onclick = () => { lsSet(INTRO, 'off'); $('#intro').hidden = true; };
initTips(); showTab('ai'); renderDetect();

/* ================= 匯出 ================= */
const prog = p => { $('#prog').style.width = (p * 100).toFixed(1) + '%'; };
const lock = on => { exporting = on; cancel = false; ['#exOne', '#exSec', '#exSong', '#exAll', '#style', '#newSong', '#saveHTML'].forEach(s => $(s).disabled = on); $('#cancel').hidden = !on; renderSongTabs(); renderUndo(); };
$('#cancel').onclick = () => { cancel = true; };
const errText = e => e.message === 'NO_H264' ? '這個瀏覽器不能輸出 H.264，請改用最新版 Chrome 或 Edge。' : e.message === 'CANCELLED' ? '已取消。' : '匯出失敗：' + fmtErr(e);
function clipName(si, ci) {
  const s = P.sections[si], base = `${pad2(si + 1)}_${fileSafe(s.name)}`;
  return ci === 0 ? `${base}_背景_${s.loopBeats}拍.mp4` : `${base}_字幕${pad2(ci)}_${fileSafe(slidesOf(s)[ci - 1].replace(/\n/g, ' '))}.mp4`;
}
async function encodeClip(c, frames, onP) {
  return encodeFrames(() => r, frames ?? c.frames, i => serial(() => drawAt(i / FPS, i, 'out')), onP, () => cancel);
}
async function encodeList(list, label, enc = true) {
  const files = [];
  for (let i = 0; i < list.length; i++) {
    const [si, ci] = list[i];
    if (!enc) { files.push({ name: clipName(si, ci) }); continue; }
    clip = await serial(() => makeClip(si, ci));
    const blob = await encodeClip(clip, null, p => { prog((i + p) / list.length); setStatus(`${label}：第 ${i + 1} / ${list.length} 支… ${Math.round(p * 100)}%`); });
    files.push({ name: clipName(si, ci), blob });
  }
  return files;
}
const allOf = si => [...Array(1 + slidesOf(P.sections[si]).length).keys()].map(ci => [si, ci]);
/* 全部歌曲：依分頁順序，每首一個資料夾（enc=false 只列檔名，測試用） */
async function allSongsFiles(enc = true) {
  const back = ACT, files = [];
  try {
    for (let k = 0; k < SONGS.length; k++) {
      if (k !== ACT) await activate(k);
      const dir = `${pad2(k + 1)}_${fileSafe(P.title)}/`;
      const fs = await encodeList(P.sections.flatMap((_, si) => allOf(si)), `第 ${k + 1}／${SONGS.length} 首「${P.title}」`, enc);
      fs.forEach(f => files.push({ name: dir + f.name, blob: f.blob }));
    }
  } finally { if (ACT !== back) await activate(back); }
  return files;
}
async function runExport(kind) {
  lock(true); prog(0);
  try {
    if (kind === 'one') { const [f] = await encodeList([[cur, clipIdx]], '計算中'); download(f.blob, `${fileSafe(P.title)}_${f.name}`); setStatus('完成 ✔ ' + f.name + '\n→ 拖進簡報軟體（背景設循環、字幕播一次）。', 'ok'); }
    else {
      const files = kind === 'all' ? await allSongsFiles() : await encodeList(kind === 'sec' ? allOf(cur) : P.sections.flatMap((_, si) => allOf(si)), '計算中');
      setStatus('打包中…');
      const zip = await makeZip(files), name = kind === 'all' ? `全部歌曲_${SONGS.length}首.zip` : `${fileSafe(P.title)}_${kind === 'sec' ? fileSafe(sec().name) : '整首'}.zip`;
      download(zip, name); setStatus(`完成 ✔ ${files.length} 支影片打包成 ${name}${kind === 'all' ? '（每首一個資料夾）' : ''}\n→ 解壓縮後拖進簡報軟體（背景設循環、字幕播一次）。`, 'ok');
    }
  } catch (e) { setStatus(errText(e), e.message !== 'CANCELLED'); if (e.hang) await sceneFailed(e); }
  lock(false); rebuild();
}
$('#exOne').onclick = () => runExport('one');
$('#exSec').onclick = () => runExport('sec');
$('#exSong').onclick = () => runExport('song');
$('#exAll').onclick = () => runExport('all');

/* ================= 啟動 ================= */
/* 讀哪一本：這台電腦的暫存（整本）→ 舊版暫存（單首＋一段新風格）→ 檔案裡存的 → 範例 */
function readBook() {
  try { const b = JSON.parse(store.get('book') || 'null'); if (b && Array.isArray(b.songs) && b.songs.length) return { book: b, from: 'store' }; } catch (e) { }
  try {
    const raw = JSON.parse(store.get('project') || (DOC === 'main' ? localStorage.getItem('worship-motion-project') : null) || 'null');
    if (raw) { const code = store.get('scene'), m = code && /\bid\s*:\s*['"]([A-Za-z][A-Za-z0-9_-]{1,40})['"]/.exec(code);
      return { book: { songs: [{ P: raw, custom: code ? { id: m ? m[1] : 'custom', code } : null }] }, from: 'store' }; }
  } catch (e) { }
  try {
    const raw = JSON.parse(PJ.textContent || 'null');
    if (raw && Array.isArray(raw.songs) && raw.songs.length) return { book: raw, from: 'file' };
    if (raw && typeof raw === 'object') return { book: { songs: [{ P: raw }] }, from: 'file' };
  } catch (e) { }
  return { book: { songs: [{ P: clone(SAMPLE) }] }, from: 'sample' };
}
(async () => {
  try { r = await newRenderer(); }
  catch (e) { $('#main').hidden = true; showErr(e.message === 'NO_WEBGPU' ? '這個瀏覽器沒有開啟 WebGPU。請用最新版 Chrome 或 Edge 打開這個檔案。' : '初始化失敗：' + e.message); return; }
  const { book, from } = readBook();
  SONGS = book.songs.map(mkSong); ACT = Math.max(0, Math.min(SONGS.length - 1, book.active | 0));
  if (from === 'store') readHist();
  if (lastProbe) notice('probe', `上次在試跑「${lastProbe.name || lastProbe.kind}」的${lastProbe.kind === 'shader' ? '自訂 shader' : '新風格程式'}時，頁面當掉或被關閉。這段程式已暫停使用，其他內容照常。`);
  await activate(ACT, { first: true });
  if (from === 'file' && !store.get('saved')) markSaved();
  if (from === 'sample') markFresh();
  renderStyle(); await refresh(); renderDetect();
  requestAnimationFrame(tick);
  async function grab(tt) {
    exporting = true;
    try {
      try { await serial(() => drawAt(tt, 999, 'out')); }
      catch (e) { if (!e.hang) throw e; exporting = false; await sceneFailed(e); await rebuild(); exporting = true; await serial(() => drawAt(tt, 999, 'out')); }
      const vf = await r.readFrame(0);
      const c = new OffscreenCanvas(W, H); c.getContext('2d').drawImage(vf, 0, 0); vf.close();
      return new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
    } finally { exporting = false; }
  }
  window.__app = {
    ready: true, grab, get project() { return clone(P); },
    load: raw => applyRaw(raw, '測試'), paste: text => pasteAny(text), pasteScene,
    select: (si, ci) => { cur = si; clipIdx = ci; t = 0; return refresh(); }, status: () => $('#cfgStatus').textContent,
    sceneStatus: () => $('#sceneStatus').textContent, notices: () => [...notices.values()].map(n => n.text),
    sceneInfo: () => ({ id: meta().id, name: meta().name, shader: !!r.shader, half: !!(r.shader && r.shader.half), canvas: !!canvasHost, est: shaderInfo && shaderInfo.est }),
    clipInfo: () => clip && { kind: clip.kind, frames: clip.frames, duration: clip.duration, jump: clip.jump },
    bench: async n => { const t0 = performance.now(); for (let i = 0; i < n; i++) { await serial(() => drawAt(1 + i * .37, i, 'out')); await r.device.queue.onSubmittedWorkDone(); } return (performance.now() - t0) / n; },
    workerMode: () => WMODE, builtins: () => BUILTIN.map(b => b.id),
    singleHTML, hash: fnv, clearSuspects: () => { suspects = []; lsSet(SUSPECT, null); }, shaderHash: () => shaderInfo && shaderInfo.hash, simulateLoss: () => recoverGPU('（測試）模擬顯示卡遺失。', true),
    exportTest: async sec => { exporting = true; try { const b = await encodeClip(clip, Math.round(sec * FPS)); const h = new Uint8Array(await b.slice(0, 12).arrayBuffer()); return { size: b.size, ftyp: String.fromCharCode(...h.slice(4, 8)) }; } finally { exporting = false; } },
    // 新介面（測試用）
    tab: k => showTab(k), currentTab: () => curTab, step: () => curStep,
    detect, applyPaste: text => applyPasteUI(text), aiText, opening: short => openingText(!!short), lastCopied: () => lastCopied, skill: () => SKILL,
    saveState: () => ({ saved: isSaved(), fresh: isFresh(), text: $('#saveText').textContent }), markSaved, saveHTML, newSong,
    removeSection: i => remove(i), undoRemove, addSection,
    dialog: () => ({ open: $('#dlg').open, title: $('#dlgT').textContent, body: $('#dlgB').textContent, buttons: [...document.querySelectorAll('#dlgBtns button')].map(b => b.dataset.v) }),
    answer: v => { const b = document.querySelector(`#dlgBtns button[data-v="${v}"]`); if (b) b.click(); return !!b; },
    dialogInput: v => { $('#dlgIn').value = v; },
    // 歌曲分頁
    songs: () => { stash(); return SONGS.map((s, i) => ({ title: (s.P || {}).title, style: (s.P || {}).style, custom: s.custom ? s.custom.id : null, active: i === ACT })); },
    active: () => ACT, switchSong, closeSong, undoClose, undo, redo, undoInfo, reopenSong, closed: () => CLOSED.map(c => ({ id: c.id, title: c.title })),
    history: () => { const h = histOf(SONGS[ACT]); return { pos: h.pos, labels: h.stack.map(e => e.label) }; }, goHist, flushHist: () => writeHist(), moveSong, moveSongTo, renameSong, importText, bookJSON, allSongsPlan: async () => (await allSongsFiles(false)).map(f => f.name),
    // 歌詞工具
    headerOf, readSong: (t, o) => readSong(t, o || {}), isFresh, histPanel: () => $('#histCard').innerText,
    resetSong, undo, slides: () => slidesOf(sec()),
    toTrad, planSplit: (text, o) => planSplit(text, o || {}), applySplitText: (text, o) => { applySplit(planSplit(text, o || {})); save('貼上整首歌詞'); return refresh().then(() => clone(P)); },
    openLyrics: () => openLyricsDialog(), lyricsDialog: () => ({ open: $('#lyrDlg').open, text: $('#lyrBody').innerText }),
  };
})();
