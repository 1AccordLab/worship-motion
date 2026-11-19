const prog = p => { $('#prog').style.width = (p * 100).toFixed(1) + '%'; };
const lock = on => { exporting = on; cancel = false; ['#exOne', '#exSec', '#exSong', '#exAll', '#style', '#newSong', '#saveHTML'].forEach(s => $(s).disabled = on); $('#cancel').hidden = !on; renderSongTabs(); renderUndo(); };
const errText = e => e.message === 'NO_H264' ? '這個瀏覽器不能輸出 H.264，請改用最新版 Chrome 或 Edge。' : e.message === 'CANCELLED' ? '已取消。' : '匯出失敗：' + fmtErr(e);
function clipName(si, ci) {
  const s = P.sections[si], base = `${pad2(si + 1)}_${fileSafe(s.name)}`;
  return ci === 0 ? `${base}_背景_${s.loopBeats}拍.mp4` : `${base}_字幕${pad2(ci)}_${fileSafe(slidesOf(s)[ci - 1].replace(/\n/g, ' '))}.mp4`;
}
async function encodeClip(c, frames, onP) {
  return encodeFrames(() => r, frames ?? c.frames, i => serial(() => drawAt(i / FPS, i, 'out')), onP, () => cancel);
}
async function encodeList(list, label, enc = true) {
  const files = [];
  for (let i = 0; i < list.length; i++) {
    const [si, ci] = list[i];
    if (!enc) { files.push({ name: clipName(si, ci) }); continue; }
    clip = await serial(() => makeClip(si, ci));
    const blob = await encodeClip(clip, null, p => { prog((i + p) / list.length); setStatus(`${label}：第 ${i + 1} / ${list.length} 支… ${Math.round(p * 100)}%`); });
    files.push({ name: clipName(si, ci), blob });
  }
  return files;
}
const allOf = si => [...Array(1 + slidesOf(P.sections[si]).length).keys()].map(ci => [si, ci]);
async function allSongsFiles(enc = true) {
  const back = ACT, files = [];
  try {
    for (let k = 0; k < SONGS.length; k++) {
      if (k !== ACT) await activate(k);
      const dir = `${pad2(k + 1)}_${fileSafe(P.title)}/`;
      const fs = await encodeList(P.sections.flatMap((_, si) => allOf(si)), `第 ${k + 1}／${SONGS.length} 首「${P.title}」`, enc);
      fs.forEach(f => files.push({ name: dir + f.name, blob: f.blob }));
    }
  } finally { if (ACT !== back) await activate(back); }
  return files;
}
async function runExport(kind) {
  lock(true); prog(0);
  try {
    if (kind === 'one') { const [f] = await encodeList([[cur, clipIdx]], '計算中'); download(f.blob, `${fileSafe(P.title)}_${f.name}`); setStatus('完成 ✔ ' + f.name + '\n→ 拖進簡報軟體（背景設循環、字幕播一次）。', 'ok'); }
    else {
      const files = kind === 'all' ? await allSongsFiles() : await encodeList(kind === 'sec' ? allOf(cur) : P.sections.flatMap((_, si) => allOf(si)), '計算中');
      setStatus('打包中…');
      const zip = await makeZip(files), name = kind === 'all' ? `全部歌曲_${SONGS.length}首.zip` : `${fileSafe(P.title)}_${kind === 'sec' ? fileSafe(sec().name) : '整首'}.zip`;
      download(zip, name); setStatus(`完成 ✔ ${files.length} 支影片打包成 ${name}${kind === 'all' ? '（每首一個資料夾）' : ''}\n→ 解壓縮後拖進簡報軟體（背景設循環、字幕播一次）。`, 'ok');
    }
  } catch (e) { setStatus(errText(e), e.message !== 'CANCELLED'); if (e.hang) await sceneFailed(e); }
  lock(false); rebuild();
}
