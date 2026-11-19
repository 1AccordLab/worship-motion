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
