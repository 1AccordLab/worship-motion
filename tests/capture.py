"""抽格：python3 tests/capture.py <editor.html> <輸出資料夾>
每個風格抽 calm/build/peak 背景與 flashy/gentle 字幕幾格，用來新舊比對。"""
import asyncio, pathlib, base64, sys
from playwright.async_api import async_playwright
FLAGS = ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-vulkan=swiftshader", "--use-webgpu-adapter=swiftshader", "--disable-vulkan-surface"]
JS = "(t)=>__app.grab(t).then(a=>{let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode.apply(null,a.subarray(i,i+32768));return btoa(s)})"
STYLES = ["swiss", "paper", "type", "bauhaus"]
def proj(style, **over):
    p = {"format": "worship-motion/1", "title": "比對", "style": style, "bpm": 120, "sections": [
        {"name": "主歌", "background": "calm", "subtitle": "none"},
        {"name": "導歌", "background": "build", "subtitle": "flashy", "clipSeconds": 6, "lyrics": "這是第[一]行示意文字"},
        {"name": "副歌", "background": "peak", "subtitle": "gentle", "lyrics": "這是第一行示意文字\n這是第二行示意文字"}]}
    p.update(over); return p
SHOTS = [("calm", 0, 0, 3.0), ("calm", 0, 0, 9.1), ("build", 1, 0, 1.3), ("build", 1, 0, 5.2), ("peak", 2, 0, 2.0), ("peak", 2, 0, 13.7),
         ("flashy", 1, 1, 0.25), ("flashy", 1, 1, 0.9), ("flashy", 1, 1, 2.6), ("gentle", 2, 1, 0.3), ("gentle", 2, 1, 4.0)]
async def main(html, out):
    out = pathlib.Path(out); out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True, args=FLAGS)
        pg = await b.new_page()
        pg.on("pageerror", lambda e: print("pageerror", e))
        await pg.goto(pathlib.Path(html).resolve().as_uri() + "?nopreview")
        await pg.wait_for_function("window.__app&&__app.ready", timeout=90000)
        async def shot(name, si, ci, t):
            await pg.evaluate(f"__app.select({si},{ci})")
            (out / name).write_bytes(base64.b64decode(await pg.evaluate(JS, t)))
        styles = sys.argv[3].split(",") if len(sys.argv) > 3 else STYLES
        for st in styles:
            assert await pg.evaluate("p=>__app.load(p)", proj(st)), await pg.evaluate("__app.status()")
            for kind, si, ci, t in SHOTS: await shot(f"{st}_{kind}_{t}.png", si, ci, t)
            print(st, "done", flush=True)
        p = proj("swiss"); p["sections"][0]["jumpBeats"] = 8
        await pg.evaluate("p=>__app.load(p)", p); await shot("swiss_jump8_5.0.png", 0, 0, 5.0)
        await pg.evaluate("p=>__app.load(p)", proj("swiss", bpm=96)); await shot("swiss_bpm96_4.0.png", 1, 0, 4.0)
        await pg.evaluate("p=>__app.load(p)", proj("paper", palette={"bg": "#223344", "red": "#33aa77"})); await shot("paper_pal_2.0.png", 2, 0, 2.0)
        await b.close()
asyncio.run(main(sys.argv[1], sys.argv[2]))
