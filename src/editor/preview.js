// 注意：32 拍 × 60 秒 × 30fps；BPM 微調成整數格，背景才接得起來
const FRAME_BPM = 32 * 60 * FPS;
const frames32 = () => Math.max(1, Math.round(FRAME_BPM / P.bpm));
const effBpm = () => FRAME_BPM / frames32();
const K = () => effBpm() / BASE_BPM;
// 注意：進場速度只影響前 2 秒
const ENTER_SECONDS = 2;
function warp(tt, s) { if (s === 1) return tt; return tt < ENTER_SECONDS / s ? s * tt : ENTER_SECONDS + (tt - ENTER_SECONDS / s); }

let queue = Promise.resolve();
const serial = fn => { const p = queue.then(fn, fn); queue = p.catch(() => { }); return p; };
function canvasInfo(st) { return { beat: st / BEAT, W, H, pal: resolvedPal(), params: paramsNow(), kind: clip.kind, type: clip.type, text: clip.text || '', text2: clip.text2 || '', swap: !!clip.swap, dur: clip.dur || 0 }; }
const paramsNow = () => Object.fromEntries(Object.entries(meta().params).map(([k, d]) => [k, (P && P.params && P.params[k]) ?? d.value]));
async function drawAt(tt, idx, target) {
  const c = clip; if (!c) throw new Error('沒有可預覽的影片');
  const st = c.map(tt), fa = needAtlas; needAtlas = false;
  let cv = null;
  const [fr] = await Promise.all([scene.frame(st, fa), canvasHost ? canvasHost.frame(st, canvasInfo(st)).then(x => { cv = x; }, e => canvasFail(e)) : null]);
  if (fr.atlas) r.uploadAtlas(fr.atlas);
  if (cv && canvasHost) r.uploadCanvas(new Uint8Array(cv.px), cv.w, cv.h);
  r.render(fr.frame, idx, target, st, st / BEAT);
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
// 注意：有自訂 shader 時，送出後超過「2 秒或平常一格的 4 倍」還沒做完就當成卡住
let watching = false, frameMs = 0;
function watchdog() {
  if (watching) return; watching = true;
  const rr = r, t0 = performance.now(), lim = Math.max(TIMEOUT.stuck, 4 * frameMs + 4 * (shaderInfo && shaderInfo.est || 0));
  Promise.race([rr.device.queue.onSubmittedWorkDone().then(() => true, () => true), new Promise(res => setTimeout(() => res(false), lim))]).then(ok => {
    watching = false;
    if (ok) { const dt = performance.now() - t0; frameMs = frameMs ? frameMs * .7 + dt * .3 : dt; return; }
    if (rr === r && rr.shader) recoverGPU('自訂 shader 一格算超過 ' + (lim / 1000).toFixed(1) + ' 秒，顯示卡像是卡住了。', true);
  });
}

async function newRenderer() {
  const nr = new Renderer(); await nr.init(NOPREVIEW ? null : $('#view'));
  nr.device.lost.then(info => { if (nr.intentional || nr !== r) return; recoverGPU('顯示卡連線中斷（' + (info.message || info.reason) + '）。', true); });
  return nr;
}
function sceneToRenderer(rr) {
  const m = meta(), pal = resolvedPal();
  rr.setScene({ look: m.look, textures: m.textures, pal, palOrder: Object.keys(m.palette), params: Object.values(paramsNow()) });
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

let baseline = null;
async function measureBaseline() {
  if (baseline && baseline.r === r) return baseline.full;
  const { pipeline } = await r.compileShader('fn shade(uv: vec2f, t: f32, beat: f32, base: vec4f) -> vec4f { return base; }');
  await r.timeShader(pipeline, 8, 8, 1, TIMEOUT.shaderBaseline);
  const a = await r.timeShader(pipeline, 120, 68, 2, TIMEOUT.shaderBaseline), b = await r.timeShader(pipeline, 480, 270, 2, TIMEOUT.shaderBaseline);
  const full = Math.max(0.05, b + (b - a) / (480 * 270 - 120 * 68) * (W * H - 480 * 270));
  baseline = { r, full }; return full;
}
async function probeShader(pipeline) {
  await r.timeShader(pipeline, 8, 8, 1, TIMEOUT.shaderProbe);
  const pts = [];
  for (const [w, h] of [[32, 18], [120, 68], [480, 270]]) {
    const ms = await r.timeShader(pipeline, w, h, 2, TIMEOUT.shaderProbe); pts.push([w * h, ms]);
    if (ms * (480 * 270) / (w * h) > SHADER_TOO_SLOW_MS && w < 480) { const nx = w === 32 ? 120 * 68 : 480 * 270; if (ms * nx / (w * h) > SHADER_TOO_SLOW_MS) break; }
  }
  const A = W * H, [a1, m1] = pts[pts.length - 1];
  let est = m1 * A / a1;
  if (pts.length > 1) { const [a0, m0] = pts[pts.length - 2]; const slope = Math.max((m1 - m0) / (a1 - a0), m1 / a1 * .25); est = m1 + slope * (A - a1); }
  const base = await measureBaseline(), budget = Math.max(SHADER_BUDGET_MIN_MS, base * SHADER_BUDGET_PER_BASELINE);
  if (est <= budget) return { mode: 'full', est, budget };
  if (est / 4 <= budget && est / 4 < SHADER_HALF_MAX_MS) return { mode: 'half', est: est / 4, budget };
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

const TEST_TEXT = { line: '這是第[一]行示意文字', block: '這是第一行示意文字\n這是第二行示意文字' }, TEST_TEXT2 = { line: 'Sample line one', block: 'Sample line one\nSample line two' };
async function prepareScene(code, custom, trial = custom) {
  const hash = fnv(code);
  if (custom && suspect(hash)) throw Object.assign(errAt('這段新風格程式上次讓頁面卡住或當掉，已暫停使用。'), { retry: hash });
  if (trial) markProbe('scene', hash, '新風格');
  const host = new SceneHost(code);
  try {
    const m = await host.start();
    if (trial) {
      for (const [k, d] of Object.entries(m.backgrounds)) {
        await host.clip({ kind: 'bg', type: k, jump: 1, pal: {}, params: {} });
        for (const tt of [0, 7.3, 15.9]) await host.frame(tt);
      }
      for (const [k, d] of Object.entries(m.subtitles)) {
        await host.clip({ kind: 'sub', type: k, text: TEST_TEXT[d.split], dur: d.seconds, jump: 1, pal: {}, params: {} });
        for (const tt of [0.1, 1.2, d.seconds - .1]) await host.frame(tt);
        await host.clip({ kind: 'sub', type: k, text: TEST_TEXT[d.split], text2: TEST_TEXT2[d.split], dur: d.seconds, jump: 1, pal: {}, params: {} });
        await host.frame(1.2);
      }
    }
    let line0 = 0, shader = null;
    if (m.shader) { const i = code.indexOf(m.shader.code); line0 = i < 0 ? 0 : code.slice(0, i).split('\n').length - 1; shader = { code: m.shader.code, hash: fnv(m.shader.code), line0 }; }
    if (trial && m.canvas) {
      const ch = new CanvasHost(m.canvas, code); await ch.start();
      try { await ch.frame(1.2, { beat: 2.4, W, H, pal: m.palette, params: {}, kind: 'bg', type: Object.keys(m.backgrounds)[0], text: '', dur: 0 }); } finally { ch.kill(); }
    }
    if (trial && shader && !suspect(shader.hash)) {
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
  await scene.clip({ kind: out.kind, type: out.type, bg: s.background, text: out.text, text2: out.text2, swap: out.swap, dur: out.dur, jump, pal: P.palette, params: paramsNow() });
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

let debT; const deb = fn => { clearTimeout(debT); debT = setTimeout(fn, 300); };
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

