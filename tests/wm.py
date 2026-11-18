"""無頭測試共用：開編輯器、抽格。"""
import asyncio, pathlib, base64, io, time
from playwright.async_api import async_playwright
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parent.parent
EDITOR = ROOT / "dist" / "simple" / "詩歌影片編輯器.html"
FLAGS = ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-vulkan=swiftshader", "--use-webgpu-adapter=swiftshader", "--disable-vulkan-surface"]
GRAB = "(t)=>__app.grab(t).then(a=>{let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode.apply(null,a.subarray(i,i+32768));return btoa(s)})"
def proj(style, **over):
    p = {"format": "worship-motion/1", "title": "測試", "style": style, "bpm": 120, "sections": [
        {"name": "主歌", "background": "calm", "subtitle": "none"},
        {"name": "導歌", "background": "build", "subtitle": "flashy", "clipSeconds": 6, "lyrics": "這是第[一]行示意文字"},
        {"name": "副歌", "background": "peak", "subtitle": "gentle", "lyrics": "這是第一行示意文字\n這是第二行示意文字"}]}
    p.update(over); return p
class Page:
    def __init__(self, pg, log): self.pg, self.log = pg, log
    async def ev(self, js, arg=None): return await self.pg.evaluate(js, arg) if arg is not None else await self.pg.evaluate(js)
    async def grab(self, t, path=None):
        data = base64.b64decode(await self.pg.evaluate(GRAB, t))
        if path: pathlib.Path(path).parent.mkdir(parents=True, exist_ok=True); pathlib.Path(path).write_bytes(data)
        return Image.open(io.BytesIO(data)).convert("RGB")
    async def shot(self, si, ci, t, path=None):
        await self.ev(f"__app.select({si},{ci})"); return await self.grab(t, path)
async def open_page(pw, url=None, ctx=None, query="?nopreview"):
    b = None
    if ctx is None:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True, args=FLAGS)
        ctx = await b.new_context(accept_downloads=True)
    pg = await ctx.new_page(); log = []
    pg.on("pageerror", lambda e: log.append("pageerror: " + str(e)))
    pg.on("console", lambda m: m.type in ("error",) and log.append("console: " + m.text[:200]))
    await pg.goto((url or EDITOR.as_uri()) + query)
    await pg.wait_for_function("window.__app&&__app.ready", timeout=120000)
    return b, ctx, Page(pg, log)
