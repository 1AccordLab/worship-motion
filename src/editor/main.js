async function boot() {
  try { r = await newRenderer(); }
  catch (e) { $('#main').hidden = true; showErr(e.message === 'NO_WEBGPU' ? '這個瀏覽器沒有開啟 WebGPU。請用最新版 Chrome 或 Edge 打開這個檔案。' : '初始化失敗：' + e.message); return; }
  const book = readBook();
  SONGS = book.songs; ACT = Math.max(0, Math.min(SONGS.length - 1, book.active | 0));
  if (book.from === 'store') readHist();
  if (lastProbe) notice('probe', `上次在試跑「${lastProbe.name || lastProbe.kind}」的${lastProbe.kind === 'shader' ? '自訂 shader' : '新風格程式'}時，頁面當掉或被關閉。這段程式已暫停使用，其他內容照常。`);
  await activate(ACT, { first: true });
  if (book.from === 'file' && !store.get('saved')) markSaved();
  if (book.from === 'sample') markFresh();
  renderStyle(); await refresh(); renderDetect();
  requestAnimationFrame(tick);
  window.__app = testApi();
}

async function grab(tt) {
  exporting = true;
  try {
    try { await serial(() => drawAt(tt, GRAB_FRAME_INDEX, 'out')); }
    catch (e) { if (!e.hang) throw e; exporting = false; await sceneFailed(e); await rebuild(); exporting = true; await serial(() => drawAt(tt, GRAB_FRAME_INDEX, 'out')); }
    const vf = await r.readFrame(0);
    const c = new OffscreenCanvas(W, H); c.getContext('2d').drawImage(vf, 0, 0); vf.close();
    return new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
  } finally { exporting = false; }
}
function testApi() {
  return {
    ready: true, grab, get project() { return clone(P); },
    load: raw => applyRaw(raw, '測試'), paste: text => pasteAny(text), pasteScene,
    select: (si, ci) => { cur = si; clipIdx = ci; t = 0; return refresh(); }, status: () => $('#cfgStatus').textContent,
    sceneStatus: () => $('#sceneStatus').textContent, notices: () => [...notices.values()].map(n => n.text),
    sceneInfo: () => ({ id: meta().id, name: meta().name, shader: !!r.shader, half: !!(r.shader && r.shader.half), canvas: !!canvasHost, est: shaderInfo && shaderInfo.est }),
    clipInfo: () => clip && { kind: clip.kind, frames: clip.frames, duration: clip.duration, jump: clip.jump },
    workerMode: () => WMODE, builtins: () => BUILTIN.map(b => b.id),
    singleHTML, hash: fnv, clearSuspects, shaderHash: () => shaderInfo && shaderInfo.hash, simulateLoss: () => recoverGPU('（測試）模擬顯示卡遺失。', true),
    exportTest: async sec => { exporting = true; try { const b = await encodeClip(clip, Math.round(sec * FPS)); const h = new Uint8Array(await b.slice(0, 12).arrayBuffer()); return { size: b.size, ftyp: String.fromCharCode(...h.slice(4, 8)) }; } finally { exporting = false; } },
    tab: k => showTab(k), currentTab: () => curTab, clipIdx: () => clipIdx, step: () => curStep,
    detect, applyPaste: text => applyPasteUI(text), aiText, opening: short => openingText(!!short), lastCopied: () => lastCopied, skill: () => SKILL,
    saveState: () => ({ saved: isSaved(), fresh: isFresh(), text: $('#saveText').textContent }), markSaved, saveHTML, newSong,
    removeSection: i => remove(i), undoRemove, addSection,
    dialog: () => ({ open: $('#dlg').open, title: $('#dlgT').textContent, body: $('#dlgB').textContent, buttons: [...document.querySelectorAll('#dlgBtns button')].map(b => b.dataset.v) }),
    answer: v => { const b = document.querySelector(`#dlgBtns button[data-v="${v}"]`); if (b) b.click(); return !!b; },
    dialogInput: v => { $('#dlgIn').value = v; },
    songs: () => { stash(); return SONGS.map((s, i) => ({ title: (s.P || {}).title, style: (s.P || {}).style, custom: s.custom ? s.custom.id : null, active: i === ACT })); },
    active: () => ACT, switchSong, closeSong, undoClose, undo, redo, undoInfo, reopenSong, closed: () => CLOSED.map(c => ({ id: c.id, title: c.title })),
    history: () => { const h = histOf(SONGS[ACT]); return { pos: h.pos, labels: h.stack.map(e => e.label) }; }, goHist, flushHist: () => writeHist(), moveSong, moveSongTo, renameSong, importText, bookJSON, allSongsPlan: async () => (await allSongsFiles({ encode: false })).map(f => f.name),
    headerOf, readSong: (t, o) => readSong(t, o || {}), isFresh, histPanel: () => $('#histCard').innerText,
    resetSong, slides: () => slidesOf(sec()),
    toTrad, planSplit: (text, o) => planSplit(text, o || {}), applySplitText: (text, o) => { applySplit(planSplit(text, o || {})); save('貼上整首歌詞'); return refresh().then(() => clone(P)); },
    openLyrics: () => openLyricsDialog(), lyricsDialog: () => ({ open: $('#lyrDlg').open, text: $('#lyrBody').innerText }),
  };
}

document.body.prepend($('#wm-ui').content.cloneNode(true));
loadGuard();
bindUI();
boot();
