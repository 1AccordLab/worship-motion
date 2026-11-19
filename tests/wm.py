"""無頭測試共用：開編輯器、抽格、結果收集。
環境變數：WM_CHROME 指定 Chrome 路徑；WM_FORCE_FAIL=1 讓第一項強制失敗（驗證 exit code 用）。"""
import asyncio, pathlib, base64, io, os, sys
from playwright.async_api import async_playwright
from PIL import Image, ImageChops

ROOT = pathlib.Path(__file__).resolve().parent.parent
EDITOR = ROOT / "dist" / "詩歌影片編輯器.html"
OUT = ROOT / "tests" / "out"
CHROME = os.environ.get("WM_CHROME", "/usr/bin/google-chrome")
FLAGS = ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-vulkan=swiftshader", "--use-webgpu-adapter=swiftshader", "--disable-vulkan-surface"]
STYLES = ["swiss", "paper", "type", "bauhaus", "riso", "ink", "nave", "sky"]
GRAB = "(t)=>__app.grab(t).then(a=>{let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode.apply(null,a.subarray(i,i+32768));return btoa(s)})"
OVERLAY = """(b64)=>{document.querySelectorAll('#ovl').forEach(x=>x.remove()); const c=document.querySelector('#view'); const r=c.getBoundingClientRect();
const i=document.createElement('img'); i.id='ovl'; i.src='data:image/png;base64,'+b64;
Object.assign(i.style,{position:'absolute',left:(r.left+scrollX)+'px',top:(r.top+scrollY)+'px',width:r.width+'px',height:r.height+'px',borderRadius:'4px',zIndex:5});
document.body.appendChild(i); return new Promise(res=>i.complete?res(1):i.onload=()=>res(1));}"""
LS_PROBE = "wm:main:probe"
READY = "window.__app&&__app.ready"

_results = []
def rec(name, ok, detail=""):
    ok = bool(ok)
    if os.environ.get("WM_FORCE_FAIL") and not _results: ok, detail = False, "WM_FORCE_FAIL"
    _results.append((name, ok, str(detail)))
    print("✔" if ok else "✘", name, "｜", str(detail).replace("\n", " ")[:220], flush=True)
def finish():
    bad = [r for r in _results if not r[1]]
    print(f"\n通過 {len(_results) - len(bad)} / {len(_results)}")
    for n, _, d in bad: print("  失敗：", n, "｜", d.replace("\n", " ")[:300])
    sys.exit(1 if bad or not _results else 0)

def diff(a, b, lo=24): return sum(ImageChops.difference(a, b).convert("L").histogram()[lo:])
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
    async def wait(self, cond, timeout=10000): await self.pg.wait_for_function(cond, timeout=timeout)
    async def reload(self): await self.pg.reload(); await self.wait(READY, 120000)
    async def wait_dialog(self): await self.wait("__app.dialog().open"); return await self.ev("__app.dialog()")
    async def settle_copy(self):
        d = await self.ev("__app.dialog()")
        if d["open"] and "手動複製" in d["title"]: await self.ev("__app.answer('ok')")

async def launch(pw, **ctx_args):
    b = await pw.chromium.launch(executable_path=CHROME, headless=True, args=FLAGS)
    return b, await b.new_context(accept_downloads=True, **ctx_args)
async def open_url(ctx, url, query="?nopreview"):
    log = []; pg = await ctx.new_page()
    pg.on("pageerror", lambda e: log.append("pageerror: " + str(e)))
    pg.on("console", lambda m: m.type == "error" and log.append("console: " + m.text[:200]))
    await pg.goto(url + query); await pg.wait_for_function(READY, timeout=120000)
    return Page(pg, log)
async def open_page(pw, url=None, ctx=None, query="?nopreview"):
    b = None
    if ctx is None: b, ctx = await launch(pw)
    return b, ctx, await open_url(ctx, url or EDITOR.as_uri(), query)
