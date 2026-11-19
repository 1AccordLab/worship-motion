"""教學頁（guide/）的截圖：python3 tests/shots_guide.py → guide/img/（圖釘位置參考：q/guide/pins.json）
全部用示意文字。無頭模式預覽 canvas 不畫，把 __app.grab 的畫面疊到預覽位置再截。"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
from PIL import Image
OUT = ROOT / "guide" / "img"; OUT.mkdir(parents=True, exist_ok=True)
TMP = ROOT / "q" / "guide"; TMP.mkdir(parents=True, exist_ok=True)
MIN = (ROOT / "examples" / "minimal.js").read_text()
L4 = "這是第[一]行示意文字\n這是第[二]行示意文字\n這是第[三]行示意文字"
G4 = "這是第一行示意文字\n這是第二行示意文字\n\n這是第三行示意文字\n這是第四行示意文字"
def song(title, style):
    return {"format": "worship-motion/1", "title": title, "style": style, "bpm": 120, "sections": [
        {"name": "主歌", "background": "calm", "subtitle": "none"},
        {"name": "導歌", "background": "build", "subtitle": "flashy", "clipSeconds": 6, "lyrics": L4},
        {"name": "副歌", "background": "peak", "subtitle": "gentle", "lyrics": G4}]}
OVERLAY = """(b64)=>{document.querySelectorAll('#ovl').forEach(x=>x.remove()); const c=document.querySelector('#view'); const r=c.getBoundingClientRect();
const i=document.createElement('img'); i.id='ovl'; i.src='data:image/png;base64,'+b64;
Object.assign(i.style,{position:'absolute',left:(r.left+scrollX)+'px',top:(r.top+scrollY)+'px',width:r.width+'px',height:r.height+'px',borderRadius:'4px',zIndex:5});
document.body.appendChild(i); return new Promise(res=>i.complete?res(1):i.onload=()=>res(1));}"""
def jpg(png, name, w=None):
    im = Image.open(png).convert("RGB")
    if w and im.width > w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(OUT / name, quality=86); print("→", name, im.size, flush=True)

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True, args=FLAGS)
        ctx = await b.new_context(accept_downloads=True, device_scale_factor=2)
        _, _, p = await open_page(pw, ctx=ctx); pg = p.pg
        await pg.set_viewport_size({"width": 1440, "height": 900})
        async def el(sel, name, w=900, pad=0):
            loc = pg.locator(sel).first; await loc.scroll_into_view_if_needed(); await pg.wait_for_timeout(150)
            t = TMP / (name + ".png"); await loc.screenshot(path=str(t)); jpg(t, name, w)
        async def frame(si, ci, tt):
            await p.ev(f"__app.select({si},{ci})"); png = await pg.evaluate(GRAB, tt); await p.ev(f"__app.select({si},{ci})"); return png

        # ---------- 多首分頁的整體畫面 ----------
        await p.ev("()=>localStorage.clear()"); await pg.reload(); await pg.wait_for_function("window.__app&&__app.ready", timeout=120000)
        await pg.set_viewport_size({"width": 1440, "height": 900})
        for i, (t, st) in enumerate([("範例詩歌一", "riso"), ("範例詩歌二", "nave"), ("範例詩歌三", "sky")]):
            await p.ev("t=>__app.importText(t)", "```json\n" + json.dumps(song(t, st), ensure_ascii=False) + "\n```")
        sg = await p.ev("__app.songs()")
        await p.ev("__app.switchSong(1)") if len(sg) > 3 else None
        sg = await p.ev("__app.songs()"); idx = [s["title"] for s in sg].index("範例詩歌一"); await p.ev(f"__app.switchSong({idx})")
        await p.ev("__app.tab('ai')"); await p.ev("scrollTo(0,0)")
        if await pg.is_visible("#introClose"): await pg.click("#introClose")
        png = await frame(1, 1, 2.5); await pg.evaluate(OVERLAY, png); await pg.wait_for_timeout(200)
        await pg.screenshot(path=str(TMP / "editor.png")); jpg(TMP / "editor.png", "editor.jpg", 1600)
        pins = {}
        for k, sel in [("tabs", "#songTabs"), ("undo", "#undoBtn"), ("save", "#saveHTML"), ("steps", "#steps"), ("sec", "#secTabs"),
                       ("view", "#view"), ("clips", "#clipCard"), ("panes", "#tab-ai"), ("ask", "#askCard"), ("paste", "#pasteCard")]:
            r = await p.ev(f"(()=>{{const r=document.querySelector('{sel}').getBoundingClientRect();return [r.left,r.top,r.width,r.height]}})()")
            pins[k] = [round(100 * r[0] / 1440, 1), round(100 * r[1] / 900, 1), round(100 * r[2] / 1440, 1), round(100 * r[3] / 900, 1)]
        (TMP / "pins.json").write_text(json.dumps(pins, ensure_ascii=False))   # 教學頁「編輯器長怎樣」圖釘位置的參考
        await pg.evaluate("document.querySelectorAll('#ovl').forEach(x=>x.remove())")

        # ---------- 請 AI 改 ----------
        await el("#openCard", "open.jpg", 1000)
        await pg.click("#chips button >> nth=0"); await el("#askCard", "ask.jpg", 1000)
        def reply_of(secs):
            pj = {**song("範例詩歌一", "riso"), "style": "bars", "sections": secs}
            return "好的！我做了一個新風格「色帶」，並把副歌改穩一點：\n```js\n" + MIN + "\n```\n設定：\n```json\n" + json.dumps(pj, ensure_ascii=False, indent=2) + "\n```\n下次可以這樣說：「副歌太躁，想穩一點。」"
        async def paste(text):
            await p.ev("()=>{const s=document.querySelector('#cfgStatus');s.textContent='';s.className='status';document.querySelectorAll('#pasteCard .fixbtn, #pasteCard [data-fix]').forEach(x=>x.hidden=true)}")
            await pg.fill("#pasteText", text); await p.ev("document.querySelector('#pasteText').scrollTop=0"); await pg.wait_for_timeout(300)
        async def apply():
            await pg.click("#pasteApply"); await pg.wait_for_timeout(2500)
            if await p.ev("document.querySelector('#dlg').open"): await p.ev("__app.answer('ok')"); await pg.wait_for_timeout(2500)
        await paste(reply_of(song("x", "riso")["sections"])); await apply(); await el("#pasteCard", "paste_error.jpg", 1000)
        good = [{"name": "主歌", "background": "calm", "subtitle": "none"}, {"name": "副歌", "background": "calm", "subtitle": "gentle", "lyrics": G4}]
        await paste(reply_of(good)); await el("#pasteCard", "paste_detect.jpg", 1000)
        await apply(); await el("#pasteCard", "paste_applied.jpg", 1000)
        await p.ev("__app.undo()"); await pg.wait_for_timeout(1500)

        # ---------- 自己調：整首歌詞、這一段 ----------
        await p.ev("__app.tab('self')")
        await pg.fill("#lyrAll", "[Verse]\n這是第一行示意文字\nThis is sample line one\n這是第二行示意文字\nThis is sample line two\n\n[Chorus]\n這是第三行示意文字\nThis is sample line three\n\n詞曲：示意")
        await pg.click("#lyrSplit"); await pg.wait_for_timeout(400)
        await el("#lyrDlg", "lyrics.jpg", 1000)
        await pg.click("#lyrCancel")
        await p.ev("__app.select(2,0)"); await el("#secCard", "self_section.jpg", 1000)

        # ---------- 匯出 ----------
        await p.ev("__app.tab('ai')"); png = await frame(2, 0, 3.0)
        await el("#clipCard", "clips.jpg", 1000)
        await pg.click("#exportCard h2"); await el("#exportCard", "export.jpg", 1000)

        # ---------- 改錯了：歷史紀錄、分頁選單 ----------
        await p.ev("__app.tab('self')"); await pg.fill("#title", "範例詩歌一（改）"); await pg.click("#secCard h2")
        await pg.click("#sBg button:nth-child(1)"); await pg.wait_for_timeout(500)
        await p.ev("scrollTo(0,0)"); await pg.click("#tab-adv"); await pg.wait_for_timeout(400)
        await pg.click("#histList .hrow >> nth=2"); await pg.wait_for_timeout(300)
        await el("#histCard", "history.jpg", 1000)
        await p.ev("scrollTo(0,0)"); await pg.click('#songTabs .smenu', timeout=5000)
        await pg.wait_for_timeout(300)
        box = await p.ev("(()=>{const a=document.querySelector('#songTabs').getBoundingClientRect(),m=document.querySelector('#songMenu').getBoundingClientRect();return [Math.min(a.left,m.left)-8,a.top-8,Math.max(a.right,m.right)+8,m.bottom+8]})()")
        await pg.screenshot(path=str(TMP / "songmenu.png"), clip={"x": box[0], "y": max(0, box[1]), "width": min(1440, box[2]) - box[0], "height": box[3] - max(0, box[1])})
        jpg(TMP / "songmenu.png", "songmenu.jpg", 1000); await pg.keyboard.press("Escape")

        # ---------- 風格圖鑑：8 種 × 高潮背景、華麗、收斂 ----------
        for st in ["swiss", "paper", "type", "bauhaus", "riso", "ink", "nave", "sky"]:
            await p.ev("x=>__app.load(x)", song("風格圖鑑", st))
            for si, ci, tt, nm in [(2, 0, 4.0, "peak"), (1, 1, 2.6, "flashy"), (2, 1, 4.0, "gentle")]:
                t = TMP / f"{st}_{nm}.png"; await p.shot(si, ci, tt, t); jpg(t, f"{st}_{nm}.jpg", 640)
        await p.ev("x=>__app.load(x)", song("風格圖鑑", "paper"))
        for si, nm in [(0, "calm"), (1, "build"), (2, "peak")]:
            t = TMP / f"bg_{nm}.png"; await p.shot(si, 0, 4.0, t); jpg(t, f"bg_{nm}.jpg", 480)
        print("頁面錯誤：", p.log[:3]); await b.close()
asyncio.run(main())
