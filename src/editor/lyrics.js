const S2T_SRC = window.WM_SRC ? WM_SRC.s2t : $('#wm-s2t').textContent;
let S2T = null;
function s2tTable() {
  if (S2T) return S2T;
  const [cl = '', pl = ''] = S2T_SRC.trim().split('\n'), ch = new Map(), ph = new Map(); let maxLen = 1;
  const cs = [...cl]; for (let i = 0; i + 1 < cs.length; i += 2) ch.set(cs[i], cs[i + 1]);
  for (const e of pl.split(',')) { const c = [...e]; if (c.length < 4 || c.length % 2) continue; const h = c.length / 2, k = c.slice(0, h).join(''); ph.set(k, c.slice(h).join('')); maxLen = Math.max(maxLen, h); }
  return (S2T = { ch, ph, maxLen });
}
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
const KIND_ZH = { verse: '主歌', pre: '導歌', chorus: '副歌', bridge: '橋段', intro: '前奏', interlude: '間奏', outro: '結尾', tag: '尾句' };
const KIND_BG = { verse: 'calm', pre: 'build', chorus: 'peak', bridge: 'build', intro: 'calm', interlude: 'calm', outro: 'calm', tag: 'peak' };
const ZH_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const EN_KIND = [['verse', 'verse'], ['chorus', 'chorus'], ['refrain', 'chorus'], ['bridge', 'bridge'], ['intro', 'intro'], ['prelude', 'intro'], ['outro', 'outro'], ['ending', 'outro'], ['coda', 'outro'], ['interlude', 'interlude'], ['instrumental', 'interlude'], ['tag', 'tag']];
const ZH_KIND = [['預副歌', 'pre'], ['预副歌', 'pre'], ['導歌', 'pre'], ['导歌', 'pre'], ['主歌', 'verse'], ['副歌', 'chorus'], ['橋段', 'bridge'], ['桥段', 'bridge'], ['前奏', 'intro'], ['間奏', 'interlude'], ['间奏', 'interlude'], ['結尾', 'outro'], ['结尾', 'outro'], ['尾奏', 'outro'], ['尾聲', 'outro']];
const halfWidth = s => String(s).replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ');
function osa(a, b) {
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
  if (!heads) {
    list = []; let acc = [];
    for (const l of (blocks[0] ? blocks[0].lines : [])) { if (l) acc.push(l); else if (acc.length) { list.push({ kind: null, n: null, head: '', lines: acc }); acc = []; } }
    if (acc.length) list.push({ kind: null, n: null, head: '', lines: acc });
  }
  let alt = 0, cjk = 0, lat = 0;
  for (const b of list) { const ty = b.lines.filter(Boolean).map(l => isCJK(l) ? 'c' : isLatin(l) ? 'l' : 'o');
    ty.forEach((x, i) => { if (x === 'c') cjk++; if (x === 'l') lat++; if (i && x !== 'o' && ty[i - 1] !== 'o' && x !== ty[i - 1]) alt++; }); }
  const bilingual = cjk >= 2 && lat >= 2 && alt >= .6 * (cjk + lat - list.length) && Math.min(cjk, lat) >= .6 * Math.max(cjk, lat);
  return { blocks: list, removed, mode: heads ? 'headers' : 'blocks', bilingual };
}
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
function planSplit(text, { trad = false, lang = 'both', target = 'lyrics' } = {}, proj = P, m = meta()) {
  const rd = readSong(text, { trad }), secs = proj.sections, plan = [], used = new Map(), occ = {}, skipped = [], long = [];
  const bilingual = rd.bilingual, isBlock = s => !!(m.subtitles[s.subtitle] && m.subtitles[s.subtitle].split === 'block');
  const toPairs = lines => lines.map(l => {
    if (!l) return null;
    if (!bilingual) return target === 'lyrics2' ? { a: '', b: l } : { a: l, b: '' };
    if (lang === 'zh') return isLatin(l) ? undefined : { a: l, b: '' };
    if (lang === 'en') return isLatin(l) ? { a: l, b: '' } : undefined;
    return (lang === 'bothEn') === isLatin(l) ? { a: l } : { b: l };
  }).filter(x => x !== undefined);
  const mergeBoth = ps => {
    if (!bilingual || (lang !== 'both' && lang !== 'bothEn')) return ps;
    const out = []; let last = null;
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
  const ins = new Map();
  for (const e of pl.plan) {
    const set = s => { if (to2) s.lyrics2 = e.lyrics2; else { s.lyrics = e.lyrics; if (both) s.lyrics2 = e.lyrics2; } };
    if (!e.isNew) { e.targets.forEach(i => set(secs[i])); continue; }
    const t = e.from ? secs.find(s => s.name === e.from) : null, bg = KIND_BG[e.kind] && bgs.includes(KIND_BG[e.kind]) ? KIND_BG[e.kind] : bgs[0];
    const ns = t ? { ...clone(t), name: e.name, lyrics: '', lyrics2: '' } : { ...defaultSection(m, e.name, bg), subtitle: common, clipSeconds: common !== 'none' && m.subtitles[common] ? m.subtitles[common].seconds : 6 };
    set(ns);
    if (!ins.has(e.after)) ins.set(e.after, []); ins.get(e.after).push(ns);
  }
  const out = [...(ins.get(-1) || [])];
  secs.forEach((s, i) => { out.push(s, ...(ins.get(i) || [])); });
  P.sections = out.slice(0, SECTION_MAX);
}
