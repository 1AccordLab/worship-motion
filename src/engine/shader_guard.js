/* cubuf 版面：res／time／beat 16 B + pal 8×16 B + prm 2×16 B（Renderer 的 CU_BYTES 留 192 B） */
const SH_PRE = `struct CU { res: vec2f, time: f32, beat: f32, pal: array<vec4f, 8>, prm: array<vec4f, 2> };
@group(0) @binding(0) var<uniform> cu: CU;
@group(0) @binding(1) var wm_src: texture_2d<f32>;
@group(0) @binding(2) var wm_smp: sampler;
const RES = vec2f(${W}.0, ${H}.0);
fn scene(uv: vec2f) -> vec4f { return textureSampleLevel(wm_src, wm_smp, uv, 0.0); }
fn pal(i: i32) -> vec3f { return cu.pal[clamp(i, 0, 7)].rgb; }
fn param(i: i32) -> f32 { let k = clamp(i, 0, 7); return cu.prm[k / 4][k % 4]; }
${WGSL_HASH}
${wgslNoise('noise')}
`;
const SH_POST = `
${wgslFullscreen('wm_vs')}
@fragment fn wm_fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let uv = fc.xy / cu.res;
  let o = shade(uv, cu.time, cu.beat, scene(uv));
  return vec4f(clamp(o.rgb, vec3f(0.0), vec3f(1.0)), 1.0);
}`;
const SH_PRE_LINES = SH_PRE.split('\n').length - 1;
const SH_MAX_LEN = 6000, SH_MAX_ITER = 64, SH_MAX_NEST = 4096;
function shaderStaticCheck(code) {
  const errs = [], src = String(code || '');
  const lineAt = i => src.slice(0, i).split('\n').length;
  const err = (i, m) => errs.push({ line: i < 0 ? 0 : lineAt(i), msg: m });
  if (src.length > SH_MAX_LEN) err(-1, `程式太長（${src.length} 字，上限 ${SH_MAX_LEN}）。`);
  // 註解換成空白但保留換行：回報給使用者的行號要和原始碼一致
  const s = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length));
  if (!/\bfn\s+shade\s*\(/.test(s)) err(-1, '找不到 fn shade(uv: vec2f, t: f32, beat: f32, base: vec4f) -> vec4f。');
  const ban = [[/\bloop\b/g, '不能用 loop（可能跑不完）。請改用 for，上限 64 次。'], [/\bwhile\b/g, '不能用 while。請改用 for，上限 64 次。'],
    [/@/g, '不能寫 @ 屬性（綁定、進入點由引擎處理）。'], [/\bvar\s*</g, '不能宣告 var<…> 全域資源（storage、workgroup、uniform 都不行）。'],
    [/\btextureStore\b|\batomic\w*\b|\bptr\s*</g, '不能寫入資源或用指標。'], [/\b(enable|requires|diagnostic)\b/g, '不能用 enable／requires／diagnostic 指令。'],
    [/\bwm_\w+/g, 'wm_ 開頭的名稱保留給引擎。']];
  for (const [re, m] of ban) { const x = re.exec(s); if (x) err(x.index, m); }
  // for 只允許常數邊界且次數有上限，避免 GPU 卡死；迴圈變數不能在別處被改
  const FOR = /\bfor\s*\(\s*var\s+([A-Za-z_]\w*)\s*(?::\s*(?:i32|u32)\s*)?=\s*(\d+)[iu]?\s*;\s*\1\s*(<=?)\s*(\d+)[iu]?\s*;\s*(?:\1\s*\+\+|\+\+\s*\1|\1\s*\+=\s*1[iu]?)\s*\)\s*\{/g;
  const loops = []; let m;
  const anyFor = /\bfor\s*\(/g;
  while ((m = anyFor.exec(s))) {
    FOR.lastIndex = m.index; const f = FOR.exec(s);
    if (!f || f.index !== m.index) { err(m.index, 'for 的寫法只能是 for (var i = 0; i < 常數; i++) { … }。'); continue; }
    const n = Number(f[4]) - Number(f[2]) + (f[3] === '<=' ? 1 : 0);
    if (n > SH_MAX_ITER) err(m.index, `for 迴圈 ${n} 次，超過上限 ${SH_MAX_ITER}。`);
    let depth = 1, j = FOR.lastIndex; while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
    loops.push({ start: m.index, end: j, n: Math.max(0, n), v: f[1], head: [m.index, FOR.lastIndex] });
  }
  let rest = s; for (const l of loops) rest = rest.slice(0, l.head[0]) + ' '.repeat(l.head[1] - l.head[0]) + rest.slice(l.head[1]);
  for (const l of loops) {
    const re = new RegExp('\\b' + l.v + '\\s*(\\+\\+|--|[-+*/%&|^]?=(?!=))', 'g'); const x = re.exec(rest);
    if (x) err(x.index, `迴圈變數 ${l.v} 不能在迴圈裡被改（也不要在別處重複用這個名稱）。`);
    let prod = l.n; for (const o of loops) if (o !== l && o.start < l.start && o.end >= l.end) prod *= o.n;
    if (prod > SH_MAX_NEST) err(l.start, `巢狀迴圈總次數 ${prod}，超過上限 ${SH_MAX_NEST}（每個像素都要跑這麼多次）。`);
  }
  return errs;
}
