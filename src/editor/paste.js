async function applyStyle(id) {
  const from = meta().name;
  try { await useStyle(id); const notes = adapt(P, meta()); save(`換風格：${from} → ${meta().name}`); renderStyle(); await refresh(); say('#selfMsg', notes.length ? '換風格：' + notes.join('；') : ''); return true; }
  catch (e) { renderStyle(); say('#selfMsg', '換不了風格：' + fmtErr(e), true); return false; }
}
function videoCount() { let subs = 0; for (const x of P.sections) subs += slidesOf(x).length; return { n: P.sections.length + subs, subs }; }
function summaryLine() { const c = videoCount(); return `風格「${meta().name}」・${P.sections.length} 段・會產生 ${c.n} 支影片（背景 ${P.sections.length}、字幕 ${c.subs}）`; }
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
function aiText() {
  const want = $('#askText').value.trim();
  let s = `這是我目前的詩歌影片設定（格式 ${FORMAT}）。請照「worship-motion-backgrounds」skill 接著修改，回覆時給我一個完整的 json 程式碼區塊。\n我想改：${want || '（我還說不清楚，請你用選擇題問我）'}\n\n\`\`\`json\n${exportText()}\n\`\`\``;
  if (isCustomNow() && $('#withCode').checked) s += `\n\n這是目前的新風格程式（風格「${meta().name}」）。如果要改畫面長相，請修改它，回覆一段完整的 js 程式碼區塊：\n\n\`\`\`js\n${sceneCode}\n\`\`\``;
  return s;
}
function openingText(short) {
  const name = P && !isFresh() && P.title !== '新的詩歌' ? `「${P.title}」` : '';
  const tail = `\n\n我的歌：${name}（歌名、感覺、歌詞；不知道怎麼說就先不寫，請你用選擇題問我）`;
  if (short) return '請用「worship-motion-backgrounds」skill 幫我做教會敬拜詩歌的動態背景和字幕影片。先用選擇題問我，再給我可以貼進「詩歌影片編輯器」的設定。' + tail;
  return '我要用「詩歌影片編輯器」做教會敬拜詩歌的動態背景和字幕影片。下面是完整的做法說明（給 AI 看的規格），請照著做：先用選擇題問我，再給我可以貼回編輯器的設定（放在 ```json 框）。\n\n=====（做法說明開始）=====\n' + SKILL.trim() + '\n=====（做法說明結束）=====' + tail;
}
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
  const created = g === 'new' ? SONGS[ACT].uid : null;
  const b = $('#pasteApply'); b.disabled = true; cfgStatus(p.code ? '套用中…新風格要先試跑每種背景和字幕，約需幾秒。' : '套用中…');
  let ok = false;
  try { ok = await pasteAny(text); } finally { b.disabled = false; }
  if (!ok && created) { const msg = $('#cfgStatus').textContent; await discardSong(created, back); cfgStatus(msg, true); }
  if (ok) { $('#pasteText').value = ''; renderDetect(); setStep(2); if (g === 'new') say('#cfgStatus', `開了新分頁「${P.title}」。\n` + $('#cfgStatus').textContent, 'ok'); }
  return ok;
}
