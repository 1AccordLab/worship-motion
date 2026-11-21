// 注意：游標在文字框裡時讓瀏覽器自己的文字還原優先；離開文字框才是編輯器的還原
const anyDialogOpen = () => [...document.querySelectorAll('dialog')].some(d => d.open);
const isTextField = el => !!el && (el.tagName === 'TEXTAREA' || el.isContentEditable || (el.tagName === 'INPUT' && /^(text|number|search|url|email|tel|password)$/i.test(el.type)));
function bindUI() {
  TABS.forEach((k, i) => {
    $('#tab-' + k).onclick = () => showTab(k);
    $('#tab-' + k).onkeydown = e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { e.preventDefault(); showTab(TABS[(i + d + TABS.length) % TABS.length], true); } };
  });
  document.querySelectorAll('#steps>button').forEach(b => b.onclick = () => {
    const n = +b.dataset.step;
    if (n === 1) { showTab('ai'); $('#askCard').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); $('#askText').focus({ preventScroll: true }); }
    if (n === 2) { showTab('self'); $('.frame').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    if (n === 3) { $('#exportCard').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); $('#exOne').focus({ preventScroll: true }); setStep(3); }
  });
  $('#exportCard').addEventListener('focusin', () => setStep(3));
  $('#exportCard').addEventListener('click', () => setStep(3));
  $('#sDur').onchange = () => { sec().clipSeconds = Math.max(2, Math.min(60, Number($('#sDur').value) || 6)); secRefresh('每支長度'); };
  $('#sEnter').oninput = () => { sec().enterSpeed = Number($('#sEnter').value); $('#sEnterV').textContent = sec().enterSpeed + '×'; save(`${sec().name}：進場速度`, 'enter:' + cur); deb(rebuild); };
  $('#sName').oninput = () => { sec().name = $('#sName').value; $('#secTitle').textContent = sec().name; save('改段落名稱', 'name:' + cur); renderSecTabs(); renderClips(); };
  $('#sLyrics').oninput = () => { sec().lyrics = $('#sLyrics').value; save(`${sec().name}：改歌詞`, 'lyr:' + cur); renderLyricHint(); deb(() => { renderClips(); rebuild(); }); };
  $('#sLyrics2').oninput = () => { sec().lyrics2 = $('#sLyrics2').value; save(`${sec().name}：改第二語言歌詞`, 'lyr2:' + cur); renderLyricHint(); deb(() => { renderClips(); rebuild(); }); };
  $('#sSwap').onchange = () => { sec().swapLang = $('#sSwap').checked; save(`${sec().name}：${sec().swapLang ? '大小對調' : '取消大小對調'}`); renderLyricHint(); rebuild(); };
  $('#s2tBtn').onclick = () => {
    const s = sec(), a = toTrad(s.lyrics || ''), b = toTrad(s.lyrics2 || ''), n = diffCount(s.lyrics || '', a) + diffCount(s.lyrics2 || '', b);
    if (!n) { say('#lyrMsg', '沒有要轉的簡體字。'); return; }
    s.lyrics = a; s.lyrics2 = b; save(`${s.name}：轉成繁體`); renderSection(); renderClips(); rebuild();
    say('#lyrMsg', `已轉成繁體（改了 ${n} 個字），請檢查少數一字多義的字（例如 发→發／髮）。`, 'ok');
  };
  $('#title').oninput = () => { P.title = $('#title').value; document.title = `${P.title}｜詩歌影片編輯器`; save('改歌名', 'title'); };
  $('#bpm').onchange = () => { const b = Number($('#bpm').value); if (b >= 40 && b <= 220) { P.bpm = b; say('#selfMsg', ''); save(`速度改成 ${b}`); refresh(); } else { $('#bpm').value = P.bpm; say('#selfMsg', '速度要在 40 到 220 之間（不知道就填 120）。', true); } };
  $('#palReset').onclick = () => { P.palette = {}; P.params = {}; save('配色與參數還原'); refresh(); };
  $('#style').onchange = () => applyStyle($('#style').value);
  $('#play').onclick = () => setPlaying(!playing);
  $('#scrub').oninput = e => { t = +e.target.value; setPlaying(false); };
  $('#lyrOpen').onclick = () => openLyricsInput();
  $('#lyrSplit').onclick = () => openLyricsDialog();
  $('#lyrInCancel').onclick = () => closeDlg($('#lyrInDlg'));
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
  $('#lyrFromAI').onclick = () => openLyricsInput();
  CHIPS.forEach(([label, fn]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
    b.onclick = () => { const a = $('#askText'), v = fn(P ? sec().name : '這一段'); a.value = a.value.trim() ? a.value.replace(/\s*$/, '\n') + v : v; a.focus(); a.setSelectionRange(a.value.length, a.value.length); };
    $('#chips').appendChild(b);
  });
  $('#copyAI').onclick = () => copyText(aiText(), '已複製 ✔ 貼到 AI 對話送出。AI 回覆後，整則貼到下面②。', '#copyMsg');
  $('#copyOpen').onclick = () => copyText(openingText(false), '已複製開場白 ✔ 貼到任何 AI 的新對話送出，照它的選擇題回答。', '#openMsg');
  $('#copyOpenShort').onclick = () => copyText(openingText(true), '已複製短開場白 ✔ 貼到已裝 skill 的 AI 對話送出。', '#openMsg');
  $('#pasteText').oninput = () => renderDetect();
  $('#pasteApply').onclick = () => applyPasteUI($('#pasteText').value);
  $('#pasteClear').onclick = () => { $('#pasteText').value = ''; renderDetect(); cfgStatus(''); $('#pasteText').focus(); };
  $('#sceneCopy').onclick = () => copyText(`這是我目前的詩歌影片風格程式（風格「${meta().name}」）。請照「worship-motion-backgrounds」skill 的場景 API 修改，回覆一段完整的 js 程式碼區塊（可以再附一段設定 json）。\n我想改：（例如「色塊太滿，想多留白」；不知道怎麼說就留空，請你用選擇題問我）\n\n\`\`\`js\n${sceneCode}\n\`\`\``, '已複製 ✔ 貼到 AI 對話，在「我想改」後面寫需求。AI 回覆後，到「請 AI 改」②整則貼回來。', '#sceneStatus');
  $('#scenePaste').onclick = () => { showTab('ai'); $('#pasteCard').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); $('#pasteText').focus({ preventScroll: true }); };
  $('#exportCfg').onclick = () => { const name = `${fileSafe(P.title)}_設定.json`; download(new Blob([exportText()], { type: 'application/json' }), name); say('#fileMsg', `已下載「${name}」。`, 'ok'); };
  $('#importCfg').onclick = () => { if (exporting) { say('#fileMsg', '正在匯出，等匯出完再打開設定檔。', true); return; } $('#importFile').click(); };
  $('#importFile').onchange = async () => {
    const f = $('#importFile').files[0]; if (!f) return;
    try { await importText(await f.text()); } catch (e) { say('#fileMsg', '讀不到這個檔案：' + e.message, true); }
    $('#importFile').value = '';
  };
  $('#smRename').onclick = () => renameSong(ACT);
  $('#smLeft').onclick = () => { closeSongMenu(); moveSong(ACT, -1); };
  $('#smRight').onclick = () => { closeSongMenu(); moveSong(ACT, 1); };
  $('#smSaveOne').onclick = () => { closeSongMenu(); saveHTML('one'); };
  $('#smClose').onclick = () => closeSong(ACT);
  $('#smReset').onclick = () => resetSong();
  $('#histReset').onclick = () => resetSong();
  document.addEventListener('click', e => { if (!e.target.closest('#songMenu')) closeSongMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSongMenu(); });
  $('#saveHTML').onclick = () => saveHTML();
  $('#newSong').onclick = () => newSong();
  $('#undoBtn').onclick = () => undo();
  $('#redoBtn').onclick = () => redo();
  $('#closedBtn').onclick = e => { e.stopPropagation(); const m = $('#closedMenu'), rc = $('#closedBtn').getBoundingClientRect(); m.hidden = !m.hidden; m.style.left = Math.max(8, Math.min(innerWidth - 300, rc.left)) + 'px'; m.style.top = (rc.bottom + 4) + 'px'; if (!m.hidden && m.firstChild) m.firstChild.focus(); };
  document.addEventListener('click', e => { if (!e.target.closest('#closedMenu') && e.target.id !== 'closedBtn') $('#closedMenu').hidden = true; });
  $('#histGo').onclick = () => histSel >= 0 && goHist(histSel);
  $('#tab-adv').addEventListener('click', () => renderHistory());
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase(); if (k !== 'z' && k !== 'y') return;
    if (isTextField(e.target) || anyDialogOpen()) return;
    e.preventDefault(); (k === 'y' || e.shiftKey) ? redo() : undo();
  });
  document.addEventListener('keydown', previewKeys);
  bindStage();
  $('#editToggle').onclick = () => { setEditMode(!editOn); $('#editToggle').blur(); };
  syncScroll($('#sLyrics'), $('#sLyrics2'));
  bindFileDrop();

  initTips(); showTab('ai'); renderDetect();
  $('#cancel').onclick = () => { cancel = true; };
  $('#exOne').onclick = () => runExport('one');
  $('#exSec').onclick = () => runExport('sec');
  $('#exSong').onclick = () => runExport('song');
  $('#exAll').onclick = () => runExport('all');
}

// 注意：一般按鈕上的空白鍵是瀏覽器的「按下按鈕」，下拉、滑桿上的方向鍵是它們自己的操作，都要讓給瀏覽器；
// 注意：分頁按鈕點過就已經選好，空白鍵留給播放。右邊的分頁自己處理 ← →（會 preventDefault）。
function previewKeys(e) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || exporting || anyDialogOpen()) return;
  const el = e.target, tag = el && el.tagName, own = isTextField(el) || /^(SELECT|INPUT)$/.test(tag);
  const pressable = /^(BUTTON|A)$/.test(tag) && el.getAttribute('role') !== 'tab';
  if (e.key === ' ' && !own && !pressable) { e.preventDefault(); setPlaying(!playing); }
  else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !own) { e.preventDefault(); stepClip(e.key === 'ArrowRight' ? 1 : -1); }
}
// 注意：兩個框行數不同時，短的那個捲不到同樣位置會回送 scroll，所以剛被同步的那一邊要略過一次。
function syncScroll(a, b) {
  let quiet = null;
  const follow = (src, dst) => src.addEventListener('scroll', () => { if (quiet === src) { quiet = null; return; } if (dst.scrollTop !== src.scrollTop) { quiet = dst; dst.scrollTop = src.scrollTop; } });
  follow(a, b); follow(b, a);
}
const OPENABLE = /\.(json|js|txt|html?)$/i;
function bindFileDrop() {
  const hasFiles = e => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  const off = () => document.body.classList.remove('filedrop');
  addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); document.body.classList.add('filedrop'); });
  addEventListener('dragleave', e => { if (!e.relatedTarget) off(); });
  addEventListener('drop', async e => {
    if (!hasFiles(e)) return; e.preventDefault(); off();
    const f = e.dataTransfer.files[0]; if (!f) return;
    if (exporting) { say('#songMsg', `正在匯出，等匯出完再拖「${f.name}」進來。`, true); return; }
    if (!OPENABLE.test(f.name)) { say('#songMsg', `不認得「${f.name}」：可以拖進來的是設定檔（.json）或存好的單檔 HTML。`, true); return; }
    await importText(await f.text(), '#songMsg');
  });
}
