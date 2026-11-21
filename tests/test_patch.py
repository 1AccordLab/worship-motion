"""意圖指令（AI 只回改動）：python3 tests/test_patch.py（示意文字）
驗收條件：
I1 「複製給 AI」的文字帶著同工打的那句話、目前的設定、目前的風格程式，以及改動的寫法；留空時請 AI 用選擇題問。
I2 設定的改動：只改列出的欄位，其他照舊；null 是刪掉；沒有的段落名稱是新增（可以指定排在哪一段後面）；值不對或看不懂就不套用並說明；可以還原。
I3 畫面的改動（patchScene）：在內建風格上加一個元素，出現在指定的背景、疊在指定元素的上面；風格下拉不變；別首歌不受影響。
I4 改寫元素（同名）位置照舊；刪掉元素（null）。
I5 新增一種背景，並在同一則回覆用設定的改動讓某一段用它。
I6 改動寫錯（語法錯、執行錯、指到不存在的背景）會擋下、保留原本的樣子，並說明原因。
I7 「進階」分頁列出這首歌的改動，可以單獨拿掉；全部拿掉就回到風格原本的樣子；拿掉可以還原。
I8 元素清單上 AI 加的元素可以刪除，內建的元素沒有刪除鈕。
I9 存成單檔、重新載入後改動都還在。
I10 整個背景是一個函式的風格（剪紙拼貼）也能加元素；原本「完整設定」「完整新風格」的貼法照常。"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
from PIL import ImageStat

MIN = (ROOT / "examples" / "minimal.js").read_text()
PEAK = ["rays", "sun", "dot", "marks", "swatches"]
CROSS = "function cross(f, x, e) { f.add(rect(940, 300, 980, 620, RS.ink), rect(860, 400, 1060, 440, RS.ink)); }\npatchScene({ label: '加十字架', elements: { cross: { label: '十字架', colors: ['ink'], in: ['peak'], after: 'sun', draw: cross } } });"
MOON = "patchScene({ label: '太陽改月亮', elements: { dot: null, sun: { label: '月亮', colors: ['yel'], draw(f, x, e) { f.add(circle(960, 760, 300, RS.yel)); } } } });"
DAWN = "patchScene({ label: '破曉背景', backgrounds: { dawn: { label: '破曉', jumpBeats: 4, use: ['sun', 'cross'] } } });"
STAR = "patchScene({ label: '加星星', elements: { star: { label: '星星', draw(f, x, e) { f.add(circle(1500, 240, 60, '#e8d9a8')); } } } });"
def amount(a, b): return sum(ImageStat.Stat(ImageChops.difference(a, b)).sum)
def fence(kind, body): return "```" + kind + "\n" + body + "\n```"
def cfg_patch(**kw): return fence("json", json.dumps({"format": "worship-motion-patch/1", **kw}, ensure_ascii=False))

async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)
        pg, out = p.pg, OUT / "patch"
        async def els(): return {e["id"]: e for e in await p.ev("__app.elements()")}
        async def ids(): return [e["id"] for e in await p.ev("__app.elements()")]
        async def proj_now(): return await p.ev("__app.project")
        async def paste(text): ok = await p.ev("t=>__app.paste(t)", text); return ok, await p.ev("__app.status()")
        async def labels(): return [x["label"] for x in await p.ev("__app.patches()")]
        async def fresh(style="riso"):
            if await p.ev("__app.patches().length"):
                for _ in range(await p.ev("__app.patches().length")): await p.ev("__app.removePatch(0)")
            assert await p.ev("x=>__app.load(x)", proj(style)); assert await labels() == []
        async def safe(name, fn):
            try: await fn()
            except Exception as e: rec(name, False, "例外：" + str(e).split("\n")[0][:200])

        async def i1():
            await fresh(); await pg.fill("#askText", "副歌加一個十字架"); txt = await p.ev("__app.aiText()")
            body = txt.split("```json\n", 1)[1].split("\n```", 1)[0] if "```json\n" in txt else "{}"
            rec("I1 帶著那句話、目前的設定（可解析、等於專案）", "副歌加一個十字架" in txt and json.loads(body) == await proj_now(), txt[:80])
            rec("I1 帶著目前的風格程式和改動的寫法", "defineScene({" in txt and "id: 'riso'" in txt and "worship-motion-patch/1" in txt and "patchScene({" in txt and "只回改動" in txt, len(txt))
            await pg.fill("#askText", "")
            rec("I1 留空時請 AI 用選擇題問", "選擇題問我" in await p.ev("__app.aiText()"))
        await safe("I1 複製給 AI 的文字", i1)

        async def i2():
            await fresh(); before = await proj_now(); n0 = len((await p.ev("__app.history()"))["labels"])
            ok, st = await paste("好的，放慢一點並加一段橋段：\n" + cfg_patch(set={"bpm": 96, "elements": {"sun": {"scale": 1.2}}}, sections={"副歌": {"jumpBeats": 8}, "橋段": {"after": "導歌", "background": "build"}, "主歌": None})); pj = await proj_now()
            rec("I2 設定的改動套用：速度、元素、段落的欄位", ok and st.startswith("已套用") and pj["bpm"] == 96 and pj["elements"] == {"sun": {"scale": 1.2}} and pj["sections"][-1]["jumpBeats"] == 8, (st[:50], pj["bpm"], pj.get("elements")))
            rec("I2 新增的段落排在指定的那一段後面，null 的段落刪掉", [s["name"] for s in pj["sections"]] == ["導歌", "橋段", "副歌"] and pj["sections"][1]["background"] == "build", [s["name"] for s in pj["sections"]])
            keep = lambda s: {k: s[k] for k in ("lyrics", "subtitle", "background", "clipSeconds")}
            rec("I2 沒列到的東西照舊（歌名、風格、導歌的歌詞與字幕）", pj["title"] == before["title"] and pj["style"] == "riso" and keep(pj["sections"][0]) == keep(before["sections"][1]), keep(pj["sections"][0]))
            rec("I2 一筆歷史紀錄，還原回到改動前", len((await p.ev("__app.history()"))["labels"]) == n0 + 1 and await p.ev("__app.undo()") and await proj_now() == before, (await p.ev("__app.history()"))["labels"][-2:])
            for name, patch, word in [("速度超出範圍", cfg_patch(set={"bpm": 999}), "bpm"), ("刪不存在的段落", cfg_patch(sections={"尾奏": None}), "尾奏"), ("看不懂的鍵", cfg_patch(config={"bpm": 90}), "config")]:
                ok, st = await paste(patch)
                rec(f"I2 {name}：不套用並說明", ok is False and word in st and "沒有套用" in st and await proj_now() == before, st[:120])
        await safe("I2 設定的改動", i2)

        async def i3():
            await fresh(); base = await p.shot(2, 0, 1.0); n_styles = await p.ev("document.querySelectorAll('#style option').length")
            ok, st = await paste("加好了：\n" + fence("js", CROSS)); pic = await p.shot(2, 0, 1.0, out / "cross.png"); e = await els()
            rec("I3 貼上 patchScene：套用，改動的名字是「加十字架」", ok and st.startswith("已套用") and "加十字架" in st and await labels() == ["加十字架"], (st[:60], await labels()))
            rec("I3 十字架出現在高潮背景、疊在太陽上面，畫了兩個形狀，畫面改變", list(e) == ["rays", "sun", "cross", "dot", "marks", "swatches"] and e["cross"]["label"] == "十字架" and e["cross"]["drawn"] == 2 and e["cross"]["added"] is True and e["sun"]["added"] is False and amount(base, pic) > 0, [(k, v["drawn"]) for k, v in e.items()])
            await p.shot(0, 0, 1.0)
            rec("I3 沒指定的平靜背景沒有十字架", "cross" not in await ids(), await ids())
            info = await p.ev("__app.sceneInfo()")
            rec("I3 風格還是網點印刷，下拉選單沒有多一項", info["id"] == "riso" and (await proj_now())["style"] == "riso" and await p.ev("document.querySelectorAll('#style option').length") == n_styles, info)
            await p.ev("__app.newSong({quiet:true})"); assert await p.ev("x=>__app.load(x)", proj("riso")); await p.shot(2, 0, 1.0); other = await ids(); other_patches = await labels()
            await p.ev("__app.switchSong(__app.active()-1)"); await p.shot(2, 0, 1.0)
            rec("I3 另一首同風格的歌沒有十字架；切回來還在", other == PEAK and other_patches == [] and "cross" in await ids() and await labels() == ["加十字架"], (other, await ids()))
            await p.ev("__app.closeSong(__app.active()+1,{quiet:true})")
        await safe("I3 在內建風格上加元素", i3)

        async def i4():
            ok, st = await paste(fence("js", MOON)); await p.shot(2, 0, 1.0); e = await els()
            rec("I4 改寫太陽、刪掉小圓：太陽位置照舊、名稱變月亮，小圓不見", ok and list(e) == ["rays", "sun", "cross", "marks", "swatches"] and e["sun"]["label"] == "月亮" and e["sun"]["drawn"] == 1 and await labels() == ["加十字架", "太陽改月亮"], (st[:50], [(k, v["label"]) for k, v in e.items()]))
        await safe("I4 改寫與刪除元素", i4)

        async def i5():
            ok, st = await paste("新增破曉背景，副歌改用它：\n" + fence("js", DAWN) + "\n" + cfg_patch(sections={"副歌": {"background": "dawn"}})); pj = await proj_now(); await p.shot(2, 0, 1.0)
            rec("I5 同一則回覆：新增背景「破曉」，副歌改用它", ok and st.startswith("已套用") and pj["sections"][2]["background"] == "dawn" and await ids() == ["sun", "cross"] and await p.ev("[...document.querySelectorAll('#sBg button')].map(b=>b.textContent)") == ["平靜", "累積", "高潮", "破曉"], (st[:50], await ids()))
        await safe("I5 新增背景並使用", i5)

        async def i6():
            keep_code, keep_pj, keep_labels = await p.ev("__app.sceneCode()"), await proj_now(), await labels()
            for name, code, word in [("語法錯", "patchScene({ label: '壞掉', elements: { x: { draw(f, x) { f.add(rect(0, 0, 10, 10, RS.ink); } } } });", "第 1 行"),
                                     ("畫的時候出錯", "patchScene({ label: '壞掉', elements: { boom: { draw(f, x) { f.add(nothing(1)); } } } });", "nothing"),
                                     ("放進不存在的背景", "patchScene({ label: '壞掉', elements: { lost: { in: ['nowhere'], draw(f, x) { } } } });", "nowhere"),
                                     ("刪不存在的元素", "patchScene({ label: '壞掉', elements: { ghost: null } });", "ghost"),
                                     ("清單用到物件內建的名稱", "patchScene({ label: '壞掉', backgrounds: { odd: { label: '怪', use: ['constructor'] } } });", "不在 elements 裡"),
                                     ("放進物件內建的名稱", "patchScene({ label: '壞掉', elements: { lost: { in: ['constructor'], draw(f, x) { } } } });", "不是這個風格的背景或字幕"),
                                     ("under 指到物件內建的名稱", "patchScene({ label: '壞掉', subtitles: { odd: { label: '怪', use: [{ el: 'under', bg: 'constructor' }, 'lyrics'] } } });", "不在 backgrounds 裡")]:
                ok, st = await paste(fence("js", code))
                rec(f"I6 {name}：擋下並說明，風格程式、設定、改動清單都照舊", ok is False and word in st and "沒有套用" in st and await p.ev("__app.sceneCode()") == keep_code and await proj_now() == keep_pj and await labels() == keep_labels, st[:140])
            ok, st = await paste(fence("js", STAR) + "\n" + cfg_patch(set={"bpm": 999}))
            rec("I6 畫面的改動對、設定的改動錯：兩個都不套用", ok is False and await labels() == keep_labels and await proj_now() == keep_pj, (st[:80], await labels()))
        await safe("I6 寫錯的改動", i6)

        async def i7():
            await p.ev("__app.tab('adv')")
            rows = await p.ev("[...document.querySelectorAll('#patchList .patchrow .patchname')].map(x=>x.textContent)")
            rec("I7 「進階」列出這首歌的三個改動", rows == ["加十字架", "太陽改月亮", "破曉背景"] and await pg.is_visible("#patchList"), rows)
            await pg.click("#patchList .patchrow:nth-child(2) .patchdrop"); await p.wait("__app.patches().length===2"); await p.shot(0, 0, 1.0); await p.ev("__app.select(1,0)")
            rec("I7 拿掉「太陽改月亮」：其他兩個留著", await labels() == ["加十字架", "破曉背景"], await labels())
            await p.ev("__app.undo()"); back = await labels(); await p.ev("__app.redo()")
            rec("I7 拿掉可以還原、重做", back == ["加十字架", "太陽改月亮", "破曉背景"] and await labels() == ["加十字架", "破曉背景"], (back, await labels()))
            await pg.click("#patchList .patchrow:nth-child(1) .patchdrop"); await p.wait("document.querySelector('#patchMsg').textContent.includes('拿不掉')"); msg = await pg.inner_text("#patchMsg")
            rec("I7 拿掉後面還用到的改動（破曉用到十字架）：拿不掉並說明", await labels() == ["加十字架", "破曉背景"] and "拿不掉" in msg, msg[:100])
            await p.ev("__app.removePatch(1)"); pj = await proj_now(); await p.ev("__app.removePatch(0)")
            builtin = await p.ev("document.querySelector('script.wm-scene[data-id=riso]').textContent")
            rec("I7 拿掉破曉背景：用它的段落改回這個風格有的背景", pj["sections"][2]["background"] in ("calm", "build", "peak"), pj["sections"][2]["background"])
            rec("I7 全部拿掉：風格程式回到內建的原樣，清單顯示沒有改動", await labels() == [] and await p.ev("__app.sceneCode()") == builtin and await pg.is_visible("#noPatches"), len(await p.ev("__app.sceneCode()")))
        await safe("I7 改動清單", i7)

        async def i8():
            await fresh(); await paste(fence("js", CROSS)); await p.ev("__app.select(2,0)"); await p.ev("__app.tab('el')")
            has = await p.ev("[...document.querySelectorAll('#elList .elrow')].map(r=>[r.dataset.id, !!r.querySelector('.eldelete')])")
            rec("I8 只有 AI 加的十字架有「刪除」", dict(has) == {"rays": False, "sun": False, "cross": True, "dot": False, "marks": False, "swatches": False}, has)
            await pg.click("#elList .elrow[data-id=cross] .eldelete"); await p.wait("__app.patches().length===0"); await p.shot(2, 0, 1.0)
            rec("I8 按刪除：十字架不見、改動也拿掉；還原會回來", await ids() == PEAK and await p.ev("__app.undo()") and await labels() == ["加十字架"], (await ids(), await labels()))
        await safe("I8 刪除 AI 加的元素", i8)

        async def i9():
            html = await p.ev("__app.singleHTML()"); await p.ev("__app.flushHist()"); await p.reload(); await p.shot(2, 0, 1.0)
            rec("I9 存成的單檔帶著改動；重新載入後十字架還在", "patchScene({ label: '加十字架'" in html and await labels() == ["加十字架"] and "cross" in await ids(), (len(html), await labels()))
        await safe("I9 存檔與重新載入", i9)

        async def i10():
            await fresh("paper"); base = await p.shot(0, 0, 1.0)
            ok, st = await paste(fence("js", STAR)); pic = await p.shot(0, 0, 1.0, out / "paper_star.png"); e = await els()
            rec("I10 剪紙拼貼加星星：清單是 背景、星星，星星畫在背景上面", ok and list(e) == ["bg", "star"] and e["star"]["drawn"] == 1 and e["bg"]["drawn"] > 0 and amount(base, pic) > 0, (st[:60], [(k, v["drawn"]) for k, v in e.items()]))
            ok, st = await paste(fence("json", json.dumps(proj("paper", bpm=100), ensure_ascii=False)))
            rec("I10 貼完整的設定照常套用，改動留著", ok and (await proj_now())["bpm"] == 100 and await labels() == ["加星星"], (st[:40], await labels()))
            ok = await p.ev("c=>__app.pasteScene(c)", MIN)
            rec("I10 貼完整的新風格照常套用，是全新的風格（沒有改動）", ok and (await p.ev("__app.sceneInfo()"))["id"] == "bars" and await labels() == [], await labels())
        await safe("I10 整塊的背景與原本的貼法", i10)

        rec("沒有頁面錯誤", not p.log, p.log[:3])
        if b: await b.close()
asyncio.run(main()); finish()
