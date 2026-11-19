let WMODE = null;
const b64 = str => { const u = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < u.length; i += 32768) bin += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(bin); };
function realWorker(mode, src) {
  if (mode === 'data') return new Worker('data:text/javascript;base64,' + b64(src));
  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  try { return new Worker(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}
function inlineWorker(src) {
  // 注意：頁內執行沒有無窮迴圈保護，卡住只能靠重開時的試跑標記
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
// 注意：Worker 的退路是 blob → data: → 頁內執行，因為某些預覽環境不允許 Worker
async function workerMode() {
  if (WMODE) return WMODE;
  for (const m of ['blob', 'data']) {
    let w = null;
    try {
      w = realWorker(m, 'postMessage(1)');
      const ok = await new Promise(res => { const to = setTimeout(() => res(false), TIMEOUT.workerProbe); w.onmessage = () => { clearTimeout(to); res(true); }; w.onerror = e => { if (e.preventDefault) e.preventDefault(); clearTimeout(to); res(false); }; });
      w.terminate(); if (ok) return (WMODE = m);
    } catch (e) { if (w) w.terminate(); }
  }
  WMODE = 'inline';
  setTimeout(() => notice('worker', '這個環境（例如 AI 對話裡的預覽）限制比較多，風格程式改在頁面裡直接執行：可以用，但卡住時無法自動停止。要匯出或試新風格，建議下載這個檔案後用 Chrome 或 Edge 打開。'), 0);
  return WMODE;
}
const spawn = (mode, src) => mode === 'inline' ? inlineWorker(src) : realWorker(mode, src);
const LINE_FIX = () => WMODE === 'inline' ? 2 : 0;  // 注意：new Function 會多兩行開頭，錯誤行號要扣掉

function lineIn(stack, code) {
  const n = code.split('\n').length;
  for (const m of String(stack || '').matchAll(/(?:blob:|data:|wm-inline\.js)[^\s)]*?:(\d+):(\d+)/g)) { const l = +m[1] - SCENE_OFF - LINE_FIX(); if (l >= 1 && l <= n) return l; }
  return 0;
}
class SceneHost {
  constructor(code) { this.code = code; this.seq = 0; this.wait = new Map(); }
  async start() {
    const mode = await workerMode();
    return new Promise((res, rej) => {
      const w = this.w = spawn(mode, SCENE_HEAD + this.code + '\n;__wmReady();\n} catch (e) { __wmFail(e); }\n');
      const done = () => { clearTimeout(to); };
      const to = setTimeout(() => { this.kill(); rej(errAt(`風格程式 ${TIMEOUT.load / 1000} 秒內沒有載入完成（可能有無窮迴圈），已停止。`)); }, TIMEOUT.load);
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
  clip(spec) { this.fresh = true; return this.call({ op: 'clip', clip: spec }, TIMEOUT.clip, '準備影片時'); }
  frame(t, fullAtlas) { const first = this.fresh; this.fresh = false; return this.call({ op: 'frame', t, fullAtlas }, first ? TIMEOUT.firstFrame : TIMEOUT.frame, `在第 ${t.toFixed(2)} 秒`); }
  kill() { if (this.w) { this.w.terminate(); this.w = null; } for (const r of this.wait.values()) r({ ok: false, error: '場景已停止。' }); this.wait.clear(); }
}

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
    return this.call({ op: 'init', src: this.spec.src, half: this.spec.half }, TIMEOUT.canvasInit);
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
  frame(t, info) { return this.call({ op: 'frame', t, info }, TIMEOUT.canvasFrame); }
  kill() { if (this.w) { this.w.terminate(); this.w = null; } }
}
