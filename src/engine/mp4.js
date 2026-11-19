const MP4 = (() => {
  const u8 = (...v) => new Uint8Array(v), u16 = v => u8(v >> 8 & 255, v & 255), u32 = v => u8(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
  const str = s => new Uint8Array([...s].map(c => c.charCodeAt(0))), zeros = n => new Uint8Array(n);
  function box(type, ...parts) {
    let len = 8; for (const p of parts) len += p.length;
    const b = new Uint8Array(len); new DataView(b.buffer).setUint32(0, len); b.set(str(type), 4);
    let o = 8; for (const p of parts) { b.set(p, o); o += p.length; } return b;
  }
  const full = (type, v, f, ...parts) => box(type, u8(v, f >> 16 & 255, f >> 8 & 255, f & 255), ...parts);
  const MATRIX = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000];
  function build({ width, height, fps, samples, avcC }) {
    const n = samples.length, ts = fps * 1000, delta = 1000, dur = n * delta;
    // 注意：有 B-frame 時顯示時間早於解碼時間，用 ctts 補差、elst 位移 shift 讓時間戳從 0 開始
    let cto = samples.map((s, i) => Math.round(s.ts / 1e6 * ts) - i * delta);
    const shift = -Math.min(0, ...cto); cto = cto.map(c => c + shift);
    const needCtts = cto.some(c => c !== 0);
    const ftyp = box('ftyp', str('isom'), u32(512), str('isomiso2avc1mp41'));
    let size = 0; for (const s of samples) size += s.data.length;
    const mdatHead = new Uint8Array(8); new DataView(mdatHead.buffer).setUint32(0, size + 8); mdatHead.set(str('mdat'), 4);
    const offset = ftyp.length + 8;
    const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(ts), u32(dur), u32(0x00010000), u16(0x0100), zeros(10), ...MATRIX.map(u32), zeros(24), u32(2));
    const tkhd = full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(dur), zeros(8), u16(0), u16(0), u16(0), u16(0), ...MATRIX.map(u32), u32(width * 65536), u32(height * 65536));
    const mdhd = full('mdhd', 0, 0, u32(0), u32(0), u32(ts), u32(dur), u16(0x55c4), u16(0));  // 注意：0x55c4 = 語言 und
    const hdlr = full('hdlr', 0, 0, u32(0), str('vide'), zeros(12), str('VideoHandler'), u8(0));
    const dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
    const colr = box('colr', str('nclx'), u16(1), u16(1), u16(1), u8(0));  // 注意：BT.709；最後的 0 = limited range
    const avc1 = box('avc1', zeros(6), u16(1), zeros(16), u16(width), u16(height), u32(0x00480000), u32(0x00480000), u32(0), u16(1), zeros(32), u16(0x18), u16(0xffff), box('avcC', avcC), colr);
    const keys = []; samples.forEach((s, i) => { if (s.key) keys.push(i + 1); });
    const stbl = box('stbl', full('stsd', 0, 0, u32(1), avc1), full('stts', 0, 0, u32(1), u32(n), u32(delta)),
      ...(needCtts ? [full('ctts', 0, 0, u32(n), ...cto.flatMap(c => [u32(1), u32(c)]))] : []),
      full('stss', 0, 0, u32(keys.length), ...keys.map(u32)), full('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1)),
      full('stsz', 0, 0, u32(0), u32(n), ...samples.map(s => u32(s.data.length))), full('stco', 0, 0, u32(1), u32(offset)));
    const edts = needCtts ? [box('edts', full('elst', 0, 0, u32(1), u32(dur), u32(shift), u32(0x00010000)))] : [];
    const trak = box('trak', tkhd, ...edts, box('mdia', mdhd, hdlr, box('minf', full('vmhd', 0, 1, zeros(8)), dinf, stbl)));
    return new Blob([ftyp, mdatHead, ...samples.map(s => s.data), box('moov', mvhd, trak)], { type: 'video/mp4' });
  }
  return { build };
})();
async function pickCodec() {
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028']) {
    const cfg = { codec, width: W, height: H, bitrate: 12_000_000, framerate: FPS, avc: { format: 'avc' } };
    try { const s = await VideoEncoder.isConfigSupported(cfg); if (s.supported) return cfg; } catch (e) { }
  }
  throw new Error('NO_H264');
}
async function encodeFrames(r, frames, renderOut, onProgress, isCancelled) {
  if (typeof VideoEncoder === 'undefined') throw new Error('NO_H264');
  const cfg = await pickCodec(), samples = []; let avcC = null, err = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => {
      const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
      samples.push({ data, key: chunk.type === 'key', ts: chunk.timestamp });
      const desc = meta && meta.decoderConfig && meta.decoderConfig.description;
      if (desc && !avcC) avcC = new Uint8Array(desc instanceof ArrayBuffer ? desc : desc.buffer.slice(desc.byteOffset, desc.byteOffset + desc.byteLength));
    },
    error: e => { err = e; },
  });
  enc.configure(cfg);
  try {
    for (let i = 0; i < frames; i++) {
      if (err) throw err;
      if (isCancelled && isCancelled()) throw new Error('CANCELLED');
      await renderOut(i);
      const vf = await r().readFrame(Math.round(i * 1e6 / FPS));
      enc.encode(vf, { keyFrame: i % (FPS * 2) === 0 }); vf.close();
      while (enc.encodeQueueSize > 4) await new Promise(res => setTimeout(res, 2));
      if (onProgress && (i % 5 === 0 || i === frames - 1)) onProgress((i + 1) / frames);
    }
    await enc.flush();
  } finally { if (enc.state !== 'closed') enc.close(); }
  if (err) throw err;
  if (!avcC) throw new Error('NO_H264');
  return MP4.build({ width: W, height: H, fps: FPS, samples, avcC });
}
