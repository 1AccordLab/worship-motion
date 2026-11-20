"""3D 筆觸層的無頭測試：python3 tests/test_world.py
內建「油彩」的筆觸數與剪影墊底、同一格可重現、鏡頭移動時相鄰兩格變化小（不閃爍、不跳出）、匯出一律畫滿、
預覽跟不上時自動少畫（走預覽格的程式路徑）、defineScene 的 world 檢查與筆觸上限、自訂風格也能用 world。SwiftShader 很慢，只拍少數幾格。"""
import asyncio, sys, pathlib, time
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
from PIL import Image, ImageChops, ImageStat
OUT = OUT / "world"; OUT.mkdir(parents=True, exist_ok=True)
OILP = {"format": "worship-motion/1", "title": "油彩示意", "style": "oil", "bpm": 120, "sections": [
    {"name": "主歌", "background": "calm", "subtitle": "none"},
    {"name": "導歌", "background": "build", "subtitle": "flashy", "clipSeconds": 6, "lyrics": "這是第一行示意文字"},
    {"name": "副歌", "background": "peak", "subtitle": "gentle", "lyrics": "這是第一行示意文字\n這是第二行示意文字"}]}
MINI = """// 示意：地上一片筆觸，鏡頭慢慢往後退
const MP = { bg: '#22304a', a: '#7f9bc4', b: '#2b3a5c' };
function build(w, x) { w.moon([0, 1, -1]); for (let i = 0; i < N; i++) { const at = [(hash(i) - .5) * 40, 0, -hash(i + .5) * 60]; w.stroke(at, [1, 0, 0], [0, 1, 0], .5, .15, MP.a, MP.b); } }
function camera(t) { return { eye: [0, 3, 6 + t], at: [0, 0, -30] }; }
function calm(f) { f.bg = MP.bg; }
defineScene({ id: 'miniworld', name: '筆觸地面', palette: MP, world: { build, camera }, backgrounds: { calm: { draw: calm } } });"""
def mean_diff(a, b, s=8):
    a, b = (x.convert("RGB").resize((x.width // s, x.height // s), Image.BOX) for x in (a, b))
    return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3
LIT = """// 示意：三片同顏料（用 [r, g, b] 陣列）的筆觸，左朝光、中背光、右在燈火旁
const LP = { bg: '#22304a', a: '#8090b0', b: '#202838' };
function build(w) {
  w.moon([0, 0, 1], 'MOONC', .15); w.lamp([6, 0, 0], 3.5, '#e0a050', .9);
  for (const [cx, nz] of [[-6, 1], [0, -1], [6, 1]]) for (let i = 0; i < 500; i++) w.stroke([cx + (hash(i + cx) - .5) * 2, (hash(i * 1.3 + cx) - .5) * 2, 0], [1, .2, 0], [0, 0, nz], .3, .1, [.5, .56, .69], [.13, .16, .22], { jitter: 0 });
}
function camera() { return { eye: [0, 0, 12], at: [0, 0, 0], fov: 60 }; }
function calm(f) { f.bg = LP.bg; }
defineScene({ id: 'litw', name: '受光示意', palette: LP, world: { build, camera }, backgrounds: { calm: { draw: calm } } });"""
def patch(im, cx, cy=540, r=40):
    return [round(v) for v in ImageStat.Stat(im.convert("RGB").crop((cx - r, cy - r, cx + r, cy + r))).mean]
def jumps(a, b, box):
    d = ImageChops.difference(a.convert("RGB"), b.convert("RGB")).crop(box).convert("L")
    return sum(d.histogram()[60:]) / (d.width * d.height)
FROZEN = "function camera(t, x) { return { fov: 52, fog: '#2a3a66', fogNear: 60, fogFar: 520, lod: 7, eye: [0, 3.4, 14], at: [0, 11, -120] }; }\nfunction cameraMoving(t, x) {"

async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)
        rec("內建風格有「油彩」", "oil" in await p.ev("__app.builtins()"))
        await p.ev("x=>__app.load(x)", OILP)
        a = await p.shot(0, 0, 2.0, OUT / "calm_2.0.png"); wi = await p.ev("__app.worldInfo()")
        rec("油彩：10 萬～40 萬筆筆觸，另有實心剪影墊底", wi and 100000 <= wi["n"] <= 400000 and wi["keep"] > 100, wi and {k: wi[k] for k in ("n", "keep", "drawn", "density")})
        a2 = await p.shot(0, 0, 2.0)
        rec("同一格畫兩次完全一樣（筆觸位置固定、可重現）", ImageChops.difference(a.convert("RGB"), a2.convert("RGB")).getbbox() is None)
        f0, f1, f30 = await p.shot(1, 0, 4.0, OUT / "build_4.0.png"), await p.shot(1, 0, 4.0 + 1 / 30, OUT / "build_4.033.png"), await p.shot(1, 0, 5.0)
        d1, d30 = mean_diff(f0, f1), mean_diff(f0, f30)
        rec("鏡頭往前推時，相鄰兩格的變化遠小於隔 1 秒（縮小 8 倍比，筆觸跟著鏡頭平順移動）", d1 < d30 * .3, f"相鄰一格 {d1:.2f}／隔 1 秒 {d30:.2f}（0–255）")
        code = await p.ev("[...document.querySelectorAll('script.wm-scene')].find(s=>s.dataset.id==='oil').textContent")
        frozen = code.replace("function camera(t, x) {", FROZEN).replace("id: 'oil'", "id: 'oilstill'")
        await p.ev("c=>__app.pasteScene(c)", frozen)
        await p.ev("x=>__app.load(x)", {**OILP, "style": "oilstill"})
        s0, s1 = await p.shot(0, 0, 4.0), await p.shot(0, 0, 4.0 + 1 / 30)
        ground = ImageChops.difference(s0.convert("RGB"), s1.convert("RGB")).crop((0, 560, 1920, 1080)).getbbox()
        sky = jumps(s0, s1, (0, 0, 1920, 440))
        rec("鏡頭不動時：地面、山、樹完全不變（遠近筆觸不互搶前後）", ground is None, ground)
        rec("鏡頭不動時：天空筆觸只沿氣流平順移動，沒有整筆跳出或消失", sky < .002, f"變化超過 60 的像素 {sky * 100:.3f}%")
        await p.ev("__app.exportTest(0.1)"); wi = (await p.ev("__app.worldInfo()"))["out"]
        rec("匯出：筆觸一律畫滿（密度 100%）", wi["density"] == 1 and wi["drawn"] == wi["n"], {k: wi[k] for k in ("drawn", "n", "density")})

        bad = await p.ev("c=>__app.pasteScene(c)", "defineScene({ id: 'w0', name: '缺 build', palette: { bg: '#223344' }, world: {}, backgrounds: { calm: { draw(f) {} } } });")
        rec("world 沒有 build → 擋下並說明", not bad and "world 要有 build" in await p.ev("__app.sceneStatus()"), (await p.ev("__app.sceneStatus()"))[:80])
        big = MINI.replace("N", "400001").replace("miniworld", "toomany")
        bad = await p.ev("c=>__app.pasteScene(c)", big)
        rec("筆觸超過上限 → 擋下並用中文說明", not bad and "筆觸超過" in await p.ev("__app.sceneStatus()"), (await p.ev("__app.sceneStatus()"))[:80])
        ok = await p.ev("c=>__app.pasteScene(c)", MINI.replace("N", "3000"))
        await p.ev("x=>__app.load(x)", {"format": "worship-motion/1", "title": "自訂", "style": "miniworld", "bpm": 120, "sections": [{"name": "s", "background": "calm", "subtitle": "none"}]})
        im = await p.shot(0, 0, 1.0, OUT / "custom.png"); wi = await p.ev("__app.worldInfo()")
        rec("自訂風格用 world：通過試跑、畫得出筆觸", ok and wi and wi["n"] == 3000 and ImageStat.Stat(im.convert("L")).stddev[0] > 4, wi)
        skill = (ROOT / "skill" / "SKILL.md").read_text()
        ex = skill[skill.index("**D. `world`**"):]; ex = ex[ex.index("```js") + 5:ex.index("```", ex.index("```js") + 5)]
        doc = "defineScene({ id: 'docworld', name: '說明範例', palette: { bg: '#1c2a3a', grass: '#5d8a64', night: '#1f2a3c', lamp: '#e0a050' },\n" + ex + "\n  backgrounds: { calm: { draw(f) {} } } });"
        ok = await p.ev("c=>__app.pasteScene(c)", doc)
        await p.ev("x=>__app.load(x)", {"format": "worship-motion/1", "title": "範例", "style": "docworld", "bpm": 120, "sections": [{"name": "s", "background": "calm", "subtitle": "none"}]})
        im = await p.shot(0, 0, 3.0, OUT / "skill_example.png"); wi = await p.ev("__app.worldInfo()")
        rec("SKILL.md「D. world」的範例程式可以直接用", ok and wi and wi["key"].startswith("docworld") and ImageStat.Stat(im.convert("L")).stddev[0] > 4, (await p.ev("__app.sceneStatus()"))[:80])
        for i, (mc, sid) in enumerate([("#c8d4ff", "lit1"), ("#ffd0a0", "lit2")]):
            await p.ev("c=>__app.pasteScene(c)", LIT.replace("MOONC", mc).replace("litw", sid))
            await p.ev("x=>__app.load(x)", {"format": "worship-motion/1", "title": "受光", "style": sid, "bpm": 120, "sections": [{"name": "s", "background": "calm", "subtitle": "none"}]})
            shots = (shots if i else []) + [await p.shot(0, 0, 1.0, OUT / f"lit_{sid}.png")]
        sun, shade, lamp = (patch(shots[0], x) for x in (492, 960, 1428))
        rec("亮部／暗部依受光選色：朝光的那片比背光的亮", sum(sun) > sum(shade) * 1.3, (sun, shade))
        rec("燈火附近偏暖（紅多藍少），遠處偏月光藍", lamp[0] - lamp[2] > sun[0] - sun[2] + 20, (lamp, sun))
        sun2 = patch(shots[1], 492)
        rec("月光的光色會影響受光的筆觸", (sun2[0] - sun2[2]) - (sun[0] - sun[2]) > 8, (sun, sun2))
        rec("沒有頁面錯誤", not p.log, p.log[:3])
        await b.close()

        b, ctx, p = await open_page(pw)
        await p.ev("c=>__app.pasteScene(c)", MINI.replace("N", "30000"))
        await p.ev("x=>__app.load(x)", {"format": "worship-motion/1", "title": "自訂", "style": "miniworld", "bpm": 120, "sections": [{"name": "s", "background": "calm", "subtitle": "none"}]})
        await p.ev("__app.select(0,0)"); await p.ev("__app.previewFrames(6)"); wi = await p.ev("__app.worldInfo()")
        low = wi["density"] < .95 and wi["drawn"] < wi["n"]
        await p.ev("__app.exportTest(0.05)"); wx = (await p.ev("__app.worldInfo()"))["out"]
        rec("預覽跟不上時自動少畫筆觸；匯出時回到 100%", low and wx["density"] == 1 and wx["drawn"] == wx["n"], f"預覽一格 {wi['frameMs']} ms → 密度 {wi['density']:.2f}（{wi['drawn']}／{wi['n']}）；匯出 {wx['density']}")
        await b.close()
if __name__ == "__main__": asyncio.run(main()); finish()
