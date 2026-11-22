const FORMAT = 'worship-motion/1', PATCH_FORMAT = 'worship-motion-patch/1';
// 注意：一首歌的風格程式＝原本的風格＋一段一段的改動；每段改動包在自己的大括號裡，才不會和別段的變數撞名
// 注意：每段開頭的 __wmPatch() 讓場景執行環境知道「接下來的 patchScene 屬於第幾段」；一段裡可能呼叫好幾次，清單與「拿掉」都以段為單位
const PATCH_OPEN = '\n/*@wm-patch*/{ __wmPatch();\n', PATCH_CLOSE = '\n}/*@wm-end*/\n';
const PATCH_SPLIT = /\n\/\*@wm-patch\*\/\{(?: __wmPatch\(\);)?\n/, PATCH_MARKS = /\/\*@wm-(?:patch|end)\*\/|\b__wmPatch\(\);?/g;
const patchParts = code => { const [base, ...rest] = String(code).split(PATCH_SPLIT); return { base, patches: rest.map(x => x.split(PATCH_CLOSE)[0]) }; };
const joinPatches = (base, list) => base + list.map(c => PATCH_OPEN + c + PATCH_CLOSE).join('');
// 注意：標記是編輯器自己切段用的。AI 看到會照抄，貼回來的程式裡有標記會把段切錯，所以給 AI 的程式不帶標記、貼進來的程式先去掉標記
const withPatchCalls = code => { const { base, patches } = patchParts(code); return joinPatches(base, patches); };
const withoutPatchMarks = code => String(code).replace(PATCH_MARKS, '');
const readableScene = code => { const { base, patches } = patchParts(code); return base + patches.map(c => '\n{\n' + c + '\n}\n').join(''); };
const withoutComments = code => String(code).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const $ = s => document.querySelector(s);
const clone = o => JSON.parse(JSON.stringify(o));
const HEX = /^#[0-9a-fA-F]{6}$/, JUMPS = [1, 2, 4, 8], LOOPS = [32, 64, 128];
const SECTION_MAX = 40, HIST_MAX = 50, HIST_BYTES_MAX = 2500000, HIST_MERGE_MS = 4000, CLOSED_MAX = 5, SUSPECT_MAX = 30;
const BEAT = .5, BASE_BPM = 120;
const GRAB_FRAME_INDEX = 999;
const SHADER_TOO_SLOW_MS = 700, SHADER_HALF_MAX_MS = 1500, SHADER_BUDGET_MIN_MS = 25, SHADER_BUDGET_PER_BASELINE = 30;
const TIMEOUT = { workerProbe: 3000, load: 3000, clip: 3000, world: 15000, firstFrame: 5000, frame: 1000, canvasInit: 2000, canvasFrame: 1000, shaderBaseline: 3000, shaderProbe: 2000, stuck: 2000 };
const NOPREVIEW = new URLSearchParams(location.search).has('nopreview');
const RUNTIME = window.WM_SRC ? WM_SRC.runtime : $('#wm-runtime').textContent;
const APP_SRC = window.WM_SRC ? WM_SRC.app : $('#wm-app').textContent;
const SKILL = window.WM_SRC ? WM_SRC.skill : $('#wm-skill').textContent;
const SCENE_HEAD = RUNTIME + '\ntry {\n', SCENE_OFF = SCENE_HEAD.split('\n').length - 1;
const BUILTIN = (() => { const out = [], seen = new Set();
  for (const b of [...(window.WM_SRC ? WM_SRC.scenes : []), ...[...document.querySelectorAll('script.wm-scene')].map(s => ({ id: s.dataset.id, name: s.dataset.name || s.dataset.id, code: s.textContent }))])
    if (b.id && !seen.has(b.id)) { seen.add(b.id); out.push(b); }
  return out; })();

// 注意：正式版（/）和開發版（/dev/）在同一個網域，暫存鍵要分開
const CHANNEL = /^https?:$/.test(location.protocol) && location.pathname.split('/').includes('dev') ? 'dev' : 'main';
const PJ = $('#wm-project'), DOC = PJ.dataset.doc || CHANNEL;
const scopedStore = prefix => ({
  get: k => { try { return localStorage.getItem(prefix + k); } catch (e) { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(prefix + k) : localStorage.setItem(prefix + k, v); } catch (e) { } },
});
const store = scopedStore(`wm:${DOC}:`), shared = scopedStore(`wm:${CHANNEL}:`);

const defaultProject = style => ({ format: FORMAT, title: '新的詩歌', style, bpm: 120, palette: {}, params: {}, sections: [] });
const defaultSection = (m, name, background = Object.keys(m.backgrounds)[0]) =>
  ({ name, background, jumpBeats: m.backgrounds[background].jumpBeats, loopBeats: 32, subtitle: 'none', clipSeconds: 6, enterSpeed: 1, lyrics: '', lyrics2: '', swapLang: false });
const SAMPLE = {
  ...defaultProject(BUILTIN[0].id), title: '範例詩歌',
  sections: [
    { name: '主歌', background: 'calm', jumpBeats: 4, loopBeats: 32, subtitle: 'none', lyrics: '' },
    { name: '導歌', background: 'build', jumpBeats: 2, loopBeats: 32, subtitle: 'flashy', clipSeconds: 6, enterSpeed: 1, lyrics: '這是第[一]行示意文字\n這是第[二]行示意文字\n這是第[三]行示意文字\n這是第[四]行示意文字' },
    { name: '副歌', background: 'peak', jumpBeats: 4, loopBeats: 32, subtitle: 'gentle', clipSeconds: 16, enterSpeed: 1, lyrics: '這是第一行示意文字\n這是第二行示意文字\n\n這是第三行示意文字\n第四行' },
  ],
};
const fmtErr = e => (e && e.line > 0 ? `第 ${e.line} 行：` : '') + (e && e.message || e);
const errAt = (msg, line) => Object.assign(new Error(msg), { line: line || 0 });

let P = null, cur = 0, clipIdx = 0, r = null, clip = null, scene = null, canvasHost = null, CUSTOM = null, sceneCode = '';
let SONGS = [], ACT = 0;
const VERIFIED = new Set();
let playing = true, t = 0, last = performance.now(), frameNo = 0, exporting = false, cancel = false, needAtlas = false, recovering = false;
let shaderInfo = null;
const notices = new Map();
const meta = () => scene.meta;
const sec = () => P.sections[cur];
const palKeys = m => Object.keys(m.labels || m.palette).filter(k => m.palette[k]);
const resolvedPal = () => ({ ...meta().palette, ...(P ? P.palette : {}) });
let SWITCHING = false;  // 注意：切分頁途中（P 還是上一首）不要寫回
const SPLIT_DESC = { line: '一行做成一支，用 [ ] 框住的字會放大', block: '空一行分成一支，好跟唱；一組超過 3 行會自動平均切開' };
const SPLIT_SHORT = { line: '一行一支', block: '一段一支' };
let lastCopied = '', curStep = 1, curTab = 'ai', undoDel = null, lastSceneErr = '';
const fileSafe = s => String(s).replace(/[\\/:*?"<>|\s\[\]]+/g, '').slice(0, 40) || '未命名';
const withPeriod = s => /[。！？.!?]$/.test(s) ? s : s + '。';
const pad2 = n => String(n).padStart(2, '0');
const songTitle = i => ((i === ACT ? P : SONGS[i] && SONGS[i].P) || {}).title || '未命名';
