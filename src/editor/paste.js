const endless = text => String(text).replace(/。+$/, '');
const pausedCopy = (e, id) => e.retry ? { id, hash: e.retry } : null;
const retryStyle = (e, id, label = '仍要試跑') => e.retry ? { label, fn: async () => { unSuspect(e.retry); notices.delete('scene'); renderNotices(); await applyStyle(id); } } : null;
// 注意：這首歌在某個內建風格上自己那一份（加了改動的）被暫停使用時，換到那個風格先用內建的樣子，不能讓那個風格整個選不到
// 注意：id 和目前設定的風格相同＝把同一個風格自己那一份載回來，不是換風格：配色與元素調整要留著
async function applyStyle(id) {
  const from = meta().name, reload = id === P.style; let paused = null;
  try {
    try { await useStyle(id); }
    catch (e) { const plain = e.retry && BUILTIN.find(b => b.id === id); if (!plain) throw e; await commitScene(await prepareScene(plain.code, false)); paused = e; }
    let notes = [];
    if (reload) reconcileProject(); else notes = adapt(P, meta());
    save(reload ? `載回「${meta().name}」自己的改動` : `換風格：${from} → ${meta().name}`); renderStyle(); await refresh(); say('#selfMsg', notes.length ? '換風格：' + notes.join('；') : '');
    if (paused) notice('scene', `這首歌在「${meta().name}」上的改動載入失敗：${endless(fmtErr(paused))}。先用內建的樣子。`, retryStyle(paused, id), pausedCopy(paused, id));
    return true;
  }
  catch (e) {
    const text = '換不了風格：' + fmtErr(e);
    renderStyle(); say('#selfMsg', text, true); notice('scene', text, retryStyle(e, id), pausedCopy(e, id)); return false;
  }
}
function videoCount() { let subs = 0; for (const x of P.sections) subs += slidesOf(x).length; return { n: P.sections.length + subs, subs }; }
function summaryLine() { const c = videoCount(); return `風格「${meta().name}」・${P.sections.length} 段・會產生 ${c.n} 支影片（背景 ${P.sections.length}、字幕 ${c.subs}）`; }
function doneText(prefix, ch, warnings = []) {
  return `已套用 ✔ ${prefix}${summaryLine()}` +
    (ch.length ? '\n改了：\n・' + ch.slice(0, 10).join('\n・') + (ch.length > 10 ? `\n・…還有 ${ch.length - 10} 項` : '') : prefix ? '' : '\n（內容和原本一樣）') +
    (warnings.length ? '\n注意：\n・' + warnings.join('\n・') : '') + '\n下一步：在左邊點段落、點影片看預覽。';
}
const noStyle = want => `style「${want}」不存在。可用：${[...new Set([...BUILTIN.map(b => b.id), ...CUSTOMS.map(c => c.id)])].join('、')}（AI 做的新風格要連同 \`\`\`js 框一起貼上）。`;
async function applyRaw(raw, source, where = '#cfgStatus', pre = null) {
  const out = (s, k) => say(where, s, k);
  const before = pre ? pre.before : (P ? clone(P) : null), mOld = pre ? pre.mOld : (scene ? meta() : null), prefix = pre ? pre.prefix : '', same = !!(pre && pre.same);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { out(`${source}沒有套用：設定要用 { } 包起來。`, true); return false; }
  if (raw.style != null && typeof raw.style !== 'string') { out(`${source}沒有套用，請修正後再試：\n・${STYLE_NOT_TEXT}`, true); return false; }
  const want = raw.style != null ? String(raw.style).toLowerCase() : meta().id;
  let prep = null, m = meta();
  if (want !== m.id) {
    const src = sourceFor(want);
    if (!src) { out(`${source}沒有套用，請修正後再試：\n・${noStyle(want)}`, true); return false; }
    try { prep = await prepareScene(src.code, src.custom); m = prep.meta; } catch (e) { out(`${source}沒有套用：風格「${want}」載入失敗：${fmtErr(e)}`, true); return false; }
  }
  const n = normalize(raw, m, m.id);
  if (!n.project) { if (prep) prep.host.kill(); out(`${source}沒有套用，請修正後再試：\n・` + n.errors.join('\n・'), true); return false; }
  if (prep) await commitScene(prep);
  const chg = changes(before, n.project, mOld, m, same);
  P = n.project; cur = 0; clipIdx = 0; t = 0;
  save(chg.otherSong ? chg.lines[0] : source === 'AI 的設定' ? '套用 AI 的回覆' : source === 'AI 的改動' ? '套用 AI 的改動' : '載入' + source);
  renderStyle(); await refresh();
  out(doneText(prefix, changes(before, P, mOld, meta(), same).lines, n.warnings), 'ok');
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
function reconcileProject() {
  const m = meta(), q = clone(P), bgs = Object.keys(m.backgrounds), subs = Object.keys(m.subtitles);
  for (const s of q.sections) { if (!m.backgrounds[s.background]) s.background = bgs[0]; if (s.subtitle !== 'none' && !m.subtitles[s.subtitle]) s.subtitle = subs[0] || 'none'; }
  const n = normalize(q, m, m.id);
  if (n.project) P = n.project; else adapt(P, m);
  cur = Math.min(cur, P.sections.length - 1);
}
async function loadPatched(base, list) {
  if (!list.length) { const plain = BUILTIN.find(b => b.code === base); if (plain) { dropCustom(plain.id); await useStyle(plain.id); return; } }
  await commitScene(await prepareScene(joinPatches(base, list), true));
}
const patchSegs = () => { const list = meta().patches; return patchParts(sceneCode).patches.map((_, i) => { const calls = list.filter(x => x.seg === i); return { calls, label: calls.map(x => x.label).join('＋') || `改動 ${i + 1}` }; }); };
function patchSyntaxError(code) { try { new Function(code); return ''; } catch (e) { return e.message; } }
// 注意：改動是接在風格程式後面、包在一對大括號裡執行的。大括號不成對的改動會把外層接歪，錯誤訊息會指到編輯器自己的程式，所以先單獨檢查語法
async function applyScenePatches(codes) {
  const { base, patches } = patchParts(sceneCode), before = joinPatches(base, patches).split('\n').length + 1, fresh = codes.map(withoutPatchMarks);
  const broken = fresh.map(patchSyntaxError).find(Boolean), syntax = () => errAt(`改動的程式有語法錯誤（大括號可能不成對）：${broken}`);
  let prep;
  try { prep = await prepareScene(joinPatches(base, [...patches, ...fresh]), true); }
  catch (e) { throw broken && !String(e.message).includes(broken) ? syntax() : errAt(e.message, e.line > before ? e.line - before : 0); }
  const idle = fresh.some((_, i) => !prep.meta.patches.some(x => x.seg === patches.length + i));
  if (broken || idle) { prep.host.kill(); throw broken ? syntax() : errAt('這段程式沒有真的呼叫 patchScene。改動要寫成 patchScene({ … })，直接寫在最外層。'); }
  await commitScene(prep); reconcileProject();
}
async function dropPatch(i) {
  const { base, patches } = patchParts(sceneCode);
  await loadPatched(base, patches.filter((_, k) => k !== i)); reconcileProject();
}
async function removePatch(i) {
  const segs = patchSegs(); if (!(i >= 0 && i < segs.length)) return false;
  const label = segs[i].label;
  try { await dropPatch(i); }
  catch (e) { say('#patchMsg', `拿不掉「${label}」：後面的改動用到它。${fmtErr(e)}`, true); return false; }
  save(`拿掉改動「${label}」`); renderStyle(); await refresh();
  say('#patchMsg', `「${label}」這個改動移走了。按「↶ 還原」可以放回來。`, 'ok'); return true;
}
// 注意：元素是某一段改動單獨加的，就整段拿掉；後面的改動用到它而拿不掉時，改成再加一筆「刪除」的改動
async function deleteElement(id) {
  const m = meta(), d = ownProp(m.elements, id); if (!d || !d.added) return false;
  const src = m.patches[d.patch], alone = !!src && src.only && src.seg >= 0 && m.patches.filter(x => x.seg === src.seg).length === 1;
  say('#elMsg', '');
  let dropped = false;
  if (alone) { try { await dropPatch(src.seg); dropped = true; } catch (e) { dropped = false; } }
  if (!dropped) {
    try { await applyScenePatches([`patchScene({ label: ${JSON.stringify('刪除「' + d.label + '」')}, elements: { ${JSON.stringify(id)}: null } });`]); }
    catch (e) { say('#elMsg', `刪不掉「${d.label}」：${e.message}`, true); return false; }
  }
  save(`刪除元素「${d.label}」`); renderStyle(); await refresh();
  say('#elMsg', `「${d.label}」刪掉了。按「↶ 還原」可以放回來。`, 'ok'); return true;
}
async function pasteAny(text, where = '#cfgStatus') {
  const p = splitPaste(text), before = P ? clone(P) : null, mOld = scene ? meta() : null;
  if (!p.code && !p.json && !p.patches.length && !p.patchJson) { say(where, '沒有套用：' + (p.jsonErr && !/^找不到/.test(p.jsonErr) ? p.jsonErr : '找不到設定、新風格或改動。請在 AI 回覆下方按「複製」，整則貼進來。'), true); return false; }
  let prefix = '';
  if (p.code) {
    if (!(await pasteScene(withoutPatchMarks(p.code)))) { say(where, '新風格沒有套用（保留原本的風格）：\n' + lastSceneErr, true); return false; }
    prefix = `新風格「${meta().name}」\n`;
  }
  const kept = { code: sceneCode, customs: CUSTOMS, P: clone(P) };
  const cfg = p.patchJson ? p.patchJson.set : p.json, target = isObj(cfg) && typeof cfg.style === 'string' ? cfg.style.toLowerCase() : meta().id, switching = p.patches.length > 0 && target !== meta().id;
  const early = switching && p.patchJson ? patchedConfig(P, p.patchJson) : null;
  if (early && early.errors.length) { say(where, '改動沒有套用，請修正後再試：\n・' + early.errors.join('\n・'), true); return false; }
  if (p.patches.length) {
    let n0 = meta().patches.length;
    try {
      if (switching) {
        if (!sourceFor(target)) throw errAt(noStyle(target));
        try { await useStyle(target); } catch (e) { throw errAt(`風格「${target}」載入失敗：${fmtErr(e)}`); }
        n0 = meta().patches.length;
      }
      await applyScenePatches(p.patches);
    }
    catch (e) {
      const switched = sceneCode !== kept.code; await undoPatches(kept, switched);
      say(where, (p.code ? '新風格已經套用，但改動沒有套用：\n' : '改動沒有套用（保留原本的樣子）：\n') + (switched ? `這則回覆同時要換成風格「${target}」，畫面的改動是接在新風格後面執行的。建議請 AI 分兩次：先只換風格，貼上後再按一次「複製給 AI」，再請它加東西。\n` : '') + fmtErr(e), true); return false;
    }
    prefix += `改動：${meta().patches.slice(n0).map(x => '「' + x.label + '」').join('、')}\n`;
  }
  let raw = p.json;
  if (p.patchJson) {
    const pc = early || patchedConfig(P, p.patchJson);
    if (pc.errors.length) { await undoPatches(kept, p.patches.length); say(where, '改動沒有套用，請修正後再試：\n・' + pc.errors.join('\n・'), true); return false; }
    raw = pc.raw; if (!p.patches.length) prefix += '改動\n';
  }
  if (raw) {
    const ok = await applyRaw(raw, p.patchJson ? 'AI 的改動' : 'AI 的設定', where, { before, mOld, prefix, same: !!p.patchJson });
    if (!ok) await undoPatches(kept, p.patches.length);
    return ok;
  }
  if (p.patches.length) { save('套用 AI 的改動'); renderStyle(); await refresh(); }
  say(where, doneText(prefix, changes(before, P, mOld, meta()).lines), 'ok'); return true;
}
async function undoPatches(kept, n) {
  if (!n) return;
  const parts = patchParts(kept.code);
  await loadPatched(parts.base, parts.patches);
  setCustoms(kept.customs);
  P = kept.P; renderStyle(); await refresh();
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
// 注意：改動的寫法只有一份，在 SKILL.md 的「只改一部分」那一節；複製給 AI 時整節附上，沒裝 skill 的 AI 也看得懂
const PATCH_HEADING = '## 四、只改一部分：改動';
function patchGuide() { const from = SKILL.indexOf(PATCH_HEADING); if (from < 0) return ''; const rest = SKILL.slice(from), end = rest.indexOf('\n---'); return (end < 0 ? rest : rest.slice(0, end)).trim(); }
function aiText() {
  const want = $('#askText').value.trim(), fence = '```';
  return [`我在用「詩歌影片編輯器」做教會敬拜詩歌的動態背景與字幕影片。請照最下面「只改一部分：改動」的寫法，只給我「改動」，我會整則貼回編輯器。`,
    `我想改：${want || '（我還說不清楚，請你用選擇題問我）'}`, '',
    `【目前的設定】（格式 ${FORMAT}）`, fence + 'json', exportText(), fence, '',
    `【目前的風格程式】（風格「${meta().name}」）`, fence + 'js', readableScene(sceneCode), fence, '', patchGuide()].join('\n');
}
function openingText(short) {
  const name = P && !isFresh() && P.title !== '新的詩歌' ? `「${P.title}」` : '';
  const tail = `\n\n我的歌：${name}（歌名、感覺、歌詞；不知道怎麼說就先不寫，請你用選擇題問我）`;
  if (short) return '請用「worship-motion-backgrounds」skill 幫我做教會敬拜詩歌的動態背景和字幕影片。先用選擇題問我，再給我可以貼進「詩歌影片編輯器」的設定。' + tail;
  return '我要用「詩歌影片編輯器」做教會敬拜詩歌的動態背景和字幕影片。下面是完整的做法說明（給 AI 看的規格），請照著做：先用選擇題問我，再給我可以貼回編輯器的設定（放在 ```json 框）。\n\n=====（做法說明開始）=====\n' + SKILL.trim() + '\n=====（做法說明結束）=====' + tail;
}
function detect(text) {
  const s = String(text || '');
  if (!s.trim()) return { empty: true, cfg: false, scene: false, patch: false, err: '', noFence: false, title: '' };
  const p = splitPaste(s), cfg = !!p.json && typeof p.json === 'object' && !Array.isArray(p.json), patch = p.patches.length > 0 || !!p.patchJson;
  return { empty: false, cfg, scene: !!p.code, patch, err: cfg || p.code || patch ? '' : (p.jsonErr || ''), noFence: !/```/.test(s) && /\bdefineScene\s*\(/.test(s), title: cfg && typeof p.json.title === 'string' ? p.json.title.trim() : '' };
}
function renderDetect() {
  const d = detect($('#pasteText').value), box = $('#detect'); box.innerHTML = '';
  $('#pasteApply').disabled = !(d.cfg || d.scene || d.patch);
  const line = (cls, txt) => { const s = document.createElement('span'); s.className = cls; s.textContent = txt; box.append(s); return s; };
  if (d.empty) { line('dim', '貼上後，這裡會先告訴你找到什麼，再按「套用」。'); return d; }
  const tag = (ok, label) => { const s = document.createElement('span'); s.className = 'found' + (ok ? ' yes' : ''); s.textContent = label + (ok ? ' ✔' : ' —'); return s; };
  box.append('找到：', tag(d.cfg, '設定'), tag(d.scene, '新風格'), tag(d.patch, '改動'));
  if (d.title && P && d.title !== P.title) line('dim', `（另一首歌：「${d.title}」）`);
  if (d.noFence) line('warnline', '沒有看到 ``` 框。請用 AI 回覆下方的「複製」按鈕整則複製，不要只選取一段。');
  if (!d.cfg && !d.scene && !d.patch) {
    const fmt = d.err && !/^找不到/.test(d.err);
    line('badline', fmt ? d.err : '沒找到設定、新風格或改動。請在 AI 回覆下方按「複製」，整則貼上。');
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
  const b = $('#pasteApply'); b.disabled = true; cfgStatus(p.code || p.patches.length ? '套用中…要先試跑每種背景和字幕，約需幾秒。' : '套用中…');
  let ok = false;
  try { ok = await pasteAny(text); } finally { b.disabled = false; }
  if (!ok && created) { const msg = $('#cfgStatus').textContent; await discardSong(created, back); cfgStatus(msg, true); }
  if (ok) { $('#pasteText').value = ''; renderDetect(); setStep(2); if (g === 'new') say('#cfgStatus', `開了新分頁「${P.title}」。\n` + $('#cfgStatus').textContent, 'ok'); }
  return ok;
}
