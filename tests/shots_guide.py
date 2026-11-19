"""教學頁（guide/）的截圖：python3 tests/shots_guide.py [輸出資料夾] → 預設 guide/img/（暫存與圖釘位置 pins.json 在 tests/out/guide/）
全部用示意文字。無頭模式預覽 canvas 不畫，把 __app.grab 的畫面疊到預覽位置再截。"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
IMG = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "guide" / "img"; IMG.mkdir(parents=True, exist_ok=True)
TMP = OUT / "guide"; TMP.mkdir(parents=True, exist_ok=True)
MIN = (ROOT / "examples" / "minimal.js").read_text()
L4 = "這是第[一]行示意文字\n這是第[二]行示意文字\n這是第[三]行示意文字"
G4 = "這是第一行示意文字\n這是第二行示意文字\n\n這是第三行示意文字\n這是第四行示意文字"
def song(title, style):
    return {"format": "worship-motion/1", "title": title, "style": style, "bpm": 120, "sections": [
        {"name": "主歌", "background": "calm", "subtitle": "none"},
        {"name": "導歌", "background": "build", "subtitle": "flashy", "clipSeconds": 6, "lyrics": L4},
        {"name": "副歌", "background": "peak", "subtitle": "gentle", "lyrics": G4}]}
def jpg(png, name, w=None):
    im = Image.open(png).convert("RGB")
    if w and im.width > w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(IMG / name, quality=86); print("→", name, im.size, flush=True)

async def main():
    async with async_playwright() as pw:
        b, ctx = await launch(pw, device_scale_factor=2)
        _, _, p = await open_page(pw, ctx=ctx); pg = p.pg
        await pg.set_viewport_size({"width": 1440, "height": 900})
        async def el(sel, name, w=900, pad=0):
            loc = pg.locator(sel).first; await loc.scroll_into_view_if_needed()
            t = TMP / (name + ".png"); await loc.screenshot(path=str(t)); jpg(t, name, w)
        async def frame(si, ci, tt):
            await p.ev(f"__app.select({si},{ci})"); png = await pg.evaluate(GRAB, tt); await p.ev(f"__app.select({si},{ci})"); return png

        await p.ev("()=>localStorage.clear()"); await p.reload()
        await pg.set_viewport_size({"width": 1440, "height": 900})
        for i, (t, st) in enumerate([("範例詩歌一", "riso"), ("範例詩歌二", "nave"), ("範例詩歌三", "sky")]):
            await p.ev("t=>__app.importText(t)", "```json\n" + json.dumps(song(t, st), ensure_ascii=False) + "\n```")
        sg = await p.ev("__app.songs()")
        await p.ev("__app.switchSong(1)") if len(sg) > 3 else None
        sg = await p.ev("__app.songs()"); idx = [s["title"] for s in sg].index("範例詩歌一"); await p.ev(f"__app.switchSong({idx})")
        await p.ev("__app.tab('ai')"); await p.ev("scrollTo(0,0)")
        if await pg.is_visible("#introClose"): await pg.click("#introClose")
        png = await frame(1, 1, 2.5); await pg.evaluate(OVERLAY, png)
        await pg.screenshot(path=str(TMP / "editor.png")); jpg(TMP / "editor.png", "editor.jpg", 1600)
        pins = {}
        for k, sel in [("tabs", "#songTabs"), ("undo", "#undoBtn"), ("save", "#saveHTML"), ("steps", "#steps"), ("sec", "#secTabs"),
                       ("view", "#view"), ("clips", "#clipCard"), ("panes", "#tab-ai"), ("ask", "#askCard"), ("paste", "#pasteCard")]:
            r = await p.ev(f"(()=>{{const r=document.querySelector('{sel}').getBoundingClientRect();return [r.left,r.top,r.width,r.height]}})()")
            pins[k] = [round(100 * r[0] / 1440, 1), round(100 * r[1] / 900, 1), round(100 * r[2] / 1440, 1), round(100 * r[3] / 900, 1)]
        (TMP / "pins.json").write_text(json.dumps(pins, ensure_ascii=False))
        await pg.evaluate("document.querySelectorAll('#ovl').forEach(x=>x.remove())")

        await el("#openCard", "open.jpg", 1000)
        await pg.click("#chips button >> nth=0"); await el("#askCard", "ask.jpg", 1000)
        def reply_of(secs):
            pj = {**song("範例詩歌一", "riso"), "style": "bars", "sections": secs}
            return "好的！我做了一個新風格「色帶」，並把副歌改穩一點：\n```js\n" + MIN + "\n```\n設定：\n```json\n" + json.dumps(pj, ensure_ascii=False, indent=2) + "\n```\n下次可以這樣說：「副歌太躁，想穩一點。」"
        async def paste(text):
            await p.ev("()=>{const s=document.querySelector('#cfgStatus');s.textContent='';s.className='status'}")
            await pg.fill("#pasteText", text); await p.ev("document.querySelector('#pasteText').scrollTop=0")
            await p.wait("document.querySelector('#detect').innerText.trim().length>0")
        async def apply():
            finished = "(()=>{const s=document.querySelector('#cfgStatus').textContent.trim();return s.length>0&&!s.startsWith('套用中')})()"
            await pg.click("#pasteApply"); await p.wait(f"__app.dialog().open||{finished}", 60000)
            if (await p.ev("__app.dialog()"))["open"]: await p.ev("__app.answer('ok')"); await p.wait(finished, 60000)
        await paste(reply_of(song("x", "riso")["sections"])); await apply(); await el("#pasteCard", "paste_error.jpg", 1000)
        good = [{"name": "主歌", "background": "calm", "subtitle": "none"}, {"name": "副歌", "background": "calm", "subtitle": "gentle", "lyrics": G4}]
        await paste(reply_of(good)); await el("#pasteCard", "paste_detect.jpg", 1000)
        await apply(); await el("#pasteCard", "paste_applied.jpg", 1000)
        await p.ev("__app.undo()")

        await p.ev("__app.tab('self')")
        await pg.fill("#lyrAll", "[Verse]\n這是第一行示意文字\nThis is sample line one\n這是第二行示意文字\nThis is sample line two\n\n[Chorus]\n這是第三行示意文字\nThis is sample line three\n\n詞曲：示意")
        await pg.click("#lyrSplit"); await p.wait("__app.lyricsDialog().open")
        await el("#lyrDlg", "lyrics.jpg", 1000)
        await pg.click("#lyrCancel")
        await p.ev("__app.select(2,0)"); await el("#secCard", "self_section.jpg", 1000)

        await p.ev("__app.tab('ai')"); png = await frame(2, 0, 3.0)
        await el("#clipCard", "clips.jpg", 1000)
        await pg.click("#exportCard h2"); await el("#exportCard", "export.jpg", 1000)

        await p.ev("__app.tab('self')"); await pg.fill("#title", "範例詩歌一（改）"); await pg.click("#secCard h2")
        await pg.click("#sBg button:nth-child(1)")
        await pg.click("#tab-adv"); await p.wait("document.querySelectorAll('#histList .hrow').length>2"); await p.ev("scrollTo(0,0)")
        await pg.click("#histList .hrow >> nth=2"); await p.wait("document.querySelector('#histPrevT').textContent.trim().length>0")
        await el("#histCard", "history.jpg", 1000)
        await p.ev("scrollTo(0,0)"); await pg.click('#songTabs .smenu', timeout=5000)
        await p.wait("getComputedStyle(document.querySelector('#songMenu')).display!=='none'")
        box = await p.ev("(()=>{const a=document.querySelector('#songTabs').getBoundingClientRect(),m=document.querySelector('#songMenu').getBoundingClientRect();return [Math.min(a.left,m.left)-8,a.top-8,Math.max(a.right,m.right)+8,m.bottom+8]})()")
        await pg.screenshot(path=str(TMP / "songmenu.png"), clip={"x": box[0], "y": max(0, box[1]), "width": min(1440, box[2]) - box[0], "height": box[3] - max(0, box[1])})
        jpg(TMP / "songmenu.png", "songmenu.jpg", 1000); await pg.keyboard.press("Escape")

        for st in STYLES:
            await p.ev("x=>__app.load(x)", song("風格圖鑑", st))
            for si, ci, tt, nm in [(2, 0, 4.0, "peak"), (1, 1, 2.6, "flashy"), (2, 1, 4.0, "gentle")]:
                t = TMP / f"{st}_{nm}.png"; await p.shot(si, ci, tt, t); jpg(t, f"{st}_{nm}.jpg", 640)
        await p.ev("x=>__app.load(x)", song("風格圖鑑", "paper"))
        for si, nm in [(0, "calm"), (1, "build"), (2, "peak")]:
            t = TMP / f"bg_{nm}.png"; await p.shot(si, 0, 4.0, t); jpg(t, f"bg_{nm}.jpg", 480)
        PAL_AFTER = {"bg": "#22372e", "red": "#b69432", "pnk": "#7fb9a5"}
        for nm, pal in [("before", {}), ("after", PAL_AFTER)]:
            await p.ev("x=>__app.load(x)", {**song("配色", "paper"), "palette": pal})
            t = TMP / f"pal_{nm}.png"; await p.shot(2, 0, 4.0, t); jpg(t, f"pal_{nm}.jpg", 640)
        print("頁面錯誤：", p.log[:3]); await b.close()
asyncio.run(main())
