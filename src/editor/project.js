// 注意：名稱寬鬆比對，因為 AI 會寫成各種變體（verse1Text、verse-1-text）；大小寫、-、_、空白都不計
const keyNorm = k => String(k).toLowerCase().replace(/[\s_-]+/g, '');
const pickKey = (obj, k) => { if (k == null) return null; if (Object.prototype.hasOwnProperty.call(obj, k)) return k; const n = keyNorm(k); return Object.keys(obj).find(x => keyNorm(x) === n) || null; };
const NAME_ZH = { calm: '平靜', build: '累積', peak: '高潮', flashy: '華麗', gentle: '收斂', none: '不要' };
const nameOf = (tbl, k) => (tbl && tbl[k] && tbl[k].label) || NAME_ZH[k] || k;
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const boolOf = v => v === true || v === 'true' ? true : v === false || v === 'false' ? false : null;
/* 注意：只留和基準不同的值（整首歌的基準是元素預設，段落的基準是整首歌的調整），存檔與給 AI 的設定才不會塞滿預設值 */
function pruneElements(adj, m, base = {}) {
  const out = {};
  for (const [id, a] of Object.entries(adj || {})) {
    const def = m.elements[id], b = base[id] || {}, o = {}; if (!def || !isObj(a)) continue;
    if (typeof a.visible === 'boolean' && a.visible !== (b.visible ?? true)) o.visible = a.visible;
    if (typeof a.opacity === 'number' && a.opacity !== (b.opacity ?? 1)) o.opacity = a.opacity;
    const params = Object.fromEntries(Object.entries(a.params || {}).filter(([k, v]) => def.params[k] && v !== ((b.params || {})[k] ?? def.params[k].value)));
    const colors = Object.fromEntries(Object.entries(a.colors || {}).filter(([k, v]) => def.colors.includes(k) && v !== (b.colors || {})[k]));
    if (Object.keys(params).length) o.params = params;
    if (Object.keys(colors).length) o.colors = colors;
    if (Object.keys(o).length) out[id] = o;
  }
  return out;
}
function readElements(src, m, at, errors, warnings) {
  const out = {};
  if (!isObj(src)) { errors.push(`${at}elements 要是物件，例如 {"sun":{"visible":false}}。`); return out; }
  for (const [id, a] of Object.entries(src)) {
    const def = m.elements[id], path = `${at}elements.${id}`;
    if (!def) { warnings.push(`${at}elements 的「${id}」不是「${m.name}」的元素，已略過（可用：${Object.keys(m.elements).join('、')}）。`); continue; }
    if (!isObj(a)) { errors.push(`${path} 要是物件，例如 {"visible":false,"opacity":0.6}。`); continue; }
    const o = out[id] = {};
    if (a.visible !== undefined) { const v = boolOf(a.visible); if (v === null) errors.push(`${path}.visible 要是 true 或 false（收到 ${a.visible}）。`); else o.visible = v; }
    if (a.opacity !== undefined) { const v = typeof a.opacity === 'string' && !a.opacity.trim() ? NaN : Number(a.opacity); if (!isFinite(v)) errors.push(`${path}.opacity 要是 0 到 1 的數字（收到 ${a.opacity}）。`); else o.opacity = Math.max(0, Math.min(1, Math.round(v * 100) / 100)); }
    if (a.params !== undefined) { if (!isObj(a.params)) errors.push(`${path}.params 要是物件。`); else for (const [k, v] of Object.entries(a.params)) {
      const d = def.params[k]; if (!d) { warnings.push(`${path}.params 的「${k}」這個元素沒有，已略過。`); continue; }
      const n = Number(v); if (!isFinite(n)) { errors.push(`${path}.params.${k} 要是數字。`); continue; }
      (o.params = o.params || {})[k] = Math.max(d.min, Math.min(d.max, n)); } }
    if (a.colors !== undefined) { if (!isObj(a.colors)) errors.push(`${path}.colors 要是物件。`); else for (const [k, v] of Object.entries(a.colors)) {
      if (!def.colors.includes(k)) { warnings.push(`${path}.colors 的「${k}」不是這個元素的顏色，已略過（可用：${def.colors.join('、') || '沒有'}）。`); continue; }
      if (typeof v !== 'string' || !HEX.test(v)) { errors.push(`${path}.colors.${k} 要是 #RRGGBB 色碼（收到 ${v}）。`); continue; }
      (o.colors = o.colors || {})[k] = v.toLowerCase(); } }
  }
  return out;
}
const mergeAdj = (a = {}, b = {}) => ({ ...a, ...b, params: { ...a.params, ...b.params }, colors: { ...a.colors, ...b.colors } });
const setOrDrop = (host, adj) => { if (Object.keys(adj).length) host.elements = adj; else delete host.elements; };
function normalize(raw, m, styleId) {
  const errors = [], warnings = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { errors: ['設定不是一個 JSON 物件（要用 { } 包起來）。'], warnings };
  const p = defaultProject(styleId);
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
  if (raw.elements !== undefined) setOrDrop(p, pruneElements(readElements(raw.elements, m, '', errors, warnings), m));
  const bgs = Object.keys(m.backgrounds), subs = Object.keys(m.subtitles);
  if (!Array.isArray(raw.sections) || !raw.sections.length) errors.push('sections 要是至少有一段的陣列。');
  else raw.sections.slice(0, SECTION_MAX).forEach((s, i) => {
    const at = `第 ${i + 1} 段`;
    if (!s || typeof s !== 'object') { errors.push(`${at} 不是物件。`); return; }
    const o = defaultSection(m, `段落 ${i + 1}`);
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
    if (s.elements !== undefined) setOrDrop(o, pruneElements(readElements(s.elements, m, `${at} `, errors, warnings), m, p.elements));
    if (o.subtitle !== 'none' && !slidesOf(o, m).length) warnings.push(`${at}「${o.name}」選了動態字幕但沒有歌詞，只會有背景。`);
    p.sections.push(o);
  });
  return { project: errors.length ? null : p, errors, warnings };
}
function adapt(p, m) {
  const notes = [], bgs = Object.keys(m.backgrounds), subs = Object.keys(m.subtitles);
  p.palette = {}; p.params = {}; p.style = m.id; delete p.elements;
  for (const s of p.sections) {
    delete s.elements;
    if (!m.backgrounds[s.background]) { notes.push(`「${s.name}」的背景「${nameOf(m.backgrounds, s.background)}」這個風格沒有，改成「${nameOf(m.backgrounds, bgs[0])}」`); s.background = bgs[0]; }
    if (s.subtitle !== 'none' && !m.subtitles[s.subtitle]) { const n = subs[0] || 'none'; notes.push(`「${s.name}」的字幕「${nameOf(m.subtitles, s.subtitle)}」這個風格沒有，改成「${nameOf(m.subtitles, n)}」`); s.subtitle = n; }
  }
  return notes;
}
function chunk3(L) { const k = Math.ceil(L.length / 3), out = []; let i = 0;
  for (let j = 0; j < k; j++) { const n = Math.ceil((L.length - i) / (k - j)); out.push(L.slice(i, i + n).join('\n')); i += n; }
  return out; }
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

const JUMP_WORD = { 1: '很快', 2: '快', 4: '中', 8: '慢' };
const bgLabel = (m, k) => (m && m.backgrounds[k] || {}).label || k;
const subLabel = (m, k) => k === 'none' ? '不要' : ((m && m.subtitles[k]) || {}).label || k;
function changes(a, b, mOld, mNew) {
  if (!a) return { lines: [], otherSong: false };
  if (a.title !== b.title) return { lines: [`換成另一首歌「${b.title}」`], otherSong: true };
  const out = [];
  if (a.style !== b.style) out.push(`風格：${mOld ? mOld.name : a.style} → ${mNew.name}`);
  if (a.bpm !== b.bpm) out.push(`速度：${a.bpm} → ${b.bpm}`);
  if (a.style === b.style && JSON.stringify(a.palette || {}) !== JSON.stringify(b.palette || {})) out.push('配色');
  if (a.style === b.style && JSON.stringify(a.params || {}) !== JSON.stringify(b.params || {})) out.push('質感參數');
  if (a.style === b.style && JSON.stringify(a.elements || {}) !== JSON.stringify(b.elements || {})) out.push('畫面元素');
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
    if (a.style === b.style && JSON.stringify(o.elements || {}) !== JSON.stringify(s.elements || {})) c.push('畫面元素');
    if (c.length) out.push(`${o.name}：${c.join('、')}`);
  });
  if (a.sections.length > b.sections.length) out.push(`刪掉：${a.sections.slice(b.sections.length).map(s => s.name).join('、')}`);
  return { lines: out, otherSong: false };
}
