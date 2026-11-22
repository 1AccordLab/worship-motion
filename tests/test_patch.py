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
I10 整個背景是一個函式的風格（examples/minimal.js 的「色帶」）也能加元素；原本「完整設定」「完整新風格」的貼法照常。
I11 AI 加的元素被後面的改動用到時，按「刪除」照樣刪得掉；真的刪不掉時，在「畫面元素」分頁當場說明原因。改寫內建元素不算 AI 加的，沒有「刪除」。
I12 一個 js 區塊呼叫好幾次 patchScene：清單上是同一列，「拿掉」是整列一起拿掉，不會拿到別列。
I13 「複製給 AI」的風格程式裡沒有編輯器內部的標記；AI 的回覆裡出現那種標記也照常套用，之後的改動貼得進來、前面的拿得掉。
I14 設定的改動裡有 __proto__ 這類鍵：不套用並說明，不影響其他物件與別首歌。
I15 指到不存在的東西都擋下：after／before 指到不存在的元素或段落、區塊裡沒有真的呼叫 patchScene、空的 patchScene、大括號不成對；註解裡提到 defineScene 的區塊仍然當成改動。
I16 設定的改動換風格（set.style）：原本的配色與元素調整清掉，和從下拉選單換風格一樣；同一個改動裡給的調整留著。
I17 AI 把整份風格程式連同新的 patchScene 一起貼回來（成了新風格）之後：AI 加的元素照樣刪得掉，清單上多的是那一筆刪除；還原後「刪掉了」的訊息跟著消失。
I18 同一則回覆又換風格（設定的改動的 set.style）又改畫面（patchScene）：先換風格，畫面的改動套在新風格上，是一筆歷史紀錄；改動在新風格上跑不起來、或設定的改動有錯，就整個不套用，風格、設定、這首歌存著的 AI 新風格都照舊。
I19 給 AI 的說明要它分兩次：先只回換風格，同工貼上後再複製一次，才加東西；換風格又改畫面的回覆跑不起來時，訊息也這樣建議。
I20 訊息：「改了：」依段落名稱比對（在前面插一段不會說別段改名）；設定的改動改歌名是「歌名：舊 → 新」，把歌名、速度、風格設成 null 會擋下並說明；style 不是文字會擋下。
I21 段落開頭少了記號的資料（暫存、歷史紀錄）：讀進來後改動的名稱都在，還原到之前的紀錄也在；存過檔的仍顯示已存成檔案。"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
from PIL import ImageStat

MIN = (ROOT / "examples" / "minimal.js").read_text()
PARTS = (ROOT / "examples" / "elements.js").read_text()
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
            assert await p.ev("x=>__app.load(x)", proj(style))
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
            assert await p.ev("c=>__app.pasteScene(c)", MIN); base = await p.shot(0, 0, 1.0)
            ok, st = await paste(fence("js", STAR)); pic = await p.shot(0, 0, 1.0, out / "bars_star.png"); e = await els()
            rec("I10 整個背景是一個函式的風格（色帶）加星星：清單是 背景、星星，星星畫在背景上面", ok and list(e) == ["bg", "star"] and e["star"]["drawn"] == 1 and e["bg"]["drawn"] > 0 and amount(base, pic) > 0, (st[:60], [(k, v["drawn"]) for k, v in e.items()]))
            pj = await proj_now(); pj["bpm"] = 100
            ok, st = await paste(fence("json", json.dumps(pj, ensure_ascii=False)))
            rec("I10 貼完整的設定照常套用，改動留著", ok and (await proj_now())["bpm"] == 100 and await labels() == ["加星星"], (st[:40], await labels()))
            ok = await p.ev("c=>__app.pasteScene(c)", PARTS)
            rec("I10 貼完整的新風格照常套用，是全新的風格（沒有改動）", ok and (await p.ev("__app.sceneInfo()"))["id"] == "parts" and await labels() == [], await labels())
        await safe("I10 整塊的背景與原本的貼法", i10)

        async def clean():
            for style in ("bauhaus", "riso"):
                assert await p.ev("x=>__app.load(x)", proj(style))
                for i in reversed(range(await p.ev("__app.patches().length"))): await p.ev(f"__app.removePatch({i})")
            assert await p.ev("x=>__app.load(x)", proj("riso")); assert await labels() == []
        async def rows(): return await p.ev("[...document.querySelectorAll('#patchList .patchrow .patchname')].map(x=>x.textContent)")

        async def i11():
            await clean(); await paste(fence("js", CROSS)); ok, st = await paste(fence("js", DAWN) + "\n" + cfg_patch(sections={"副歌": {"background": "dawn"}}))
            await p.ev("__app.select(2,0)"); await p.ev("__app.tab('el')"); n0 = len((await p.ev("__app.history()"))["labels"])
            await pg.click("#elList .elrow[data-id=cross] .eldelete"); await p.wait("__app.patches().length===3"); await p.shot(2, 0, 1.0)
            rec("I11 十字架被破曉背景用到：按「刪除」照樣刪掉，多一筆歷史紀錄", ok and await ids() == ["sun"] and len((await p.ev("__app.history()"))["labels"]) == n0 + 1, (await ids(), await labels()))
            await p.ev("__app.undo()"); await p.shot(2, 0, 1.0)
            rec("I11 還原後十字架回來", await ids() == ["sun", "cross"], await ids())
            await clean(); ok, st = await paste(fence("js", "patchScene({ label: '只有星星的背景', elements: { star: { label: '星星', draw(f, x, e) { f.add(circle(1500, 240, 60, RS.yel)); } } }, backgrounds: { solo: { label: '獨角', use: ['star'] } } });") + "\n" + cfg_patch(sections={"副歌": {"background": "solo"}}))
            await p.ev("__app.select(2,0)"); await p.ev("__app.tab('el')"); keep = await labels()
            await pg.click("#elList .elrow[data-id=star] .eldelete"); await p.wait("document.querySelector('#elMsg').textContent.trim().length>0"); msg = await pg.inner_text("#elMsg")
            rec("I11 刪了會讓背景一個元素都不剩：刪不掉，在「畫面元素」分頁當場說明", ok and "刪不掉" in msg and await pg.is_visible("#elMsg") and await labels() == keep, (st[:40], msg[:120]))
            await clean(); await paste(fence("js", MOON)); await p.ev("__app.select(2,0)"); e = await els()
            rec("I11 改寫內建的太陽：它不算 AI 加的，沒有「刪除」", e["sun"]["label"] == "月亮" and e["sun"]["added"] is False, (e["sun"]["label"], e["sun"]["added"]))
        await safe("I11 刪除被用到的元素", i11)

        def star(name, label, cx): return f"patchScene({{ label: '{label}', elements: {{ {name}: {{ label: '星星', in: ['peak'], draw(f, x, e) {{ f.add(circle({cx}, 240, 60, RS.yel)); }} }} }} }});"
        async def i12():
            await clean(); ok, st = await paste(fence("js", star("t1", "左邊加星星", 300) + "\n" + star("t2", "中間加星星", 900))); await paste(fence("js", star("t3", "右邊加星星", 1500)))
            await p.ev("__app.tab('adv')"); r = await rows()
            rec("I12 一個區塊呼叫兩次：清單上是同一列，名字是兩個合起來", ok and len(r) == 2 and "左邊加星星" in r[0] and "中間加星星" in r[0] and r[1] == "右邊加星星", r)
            await pg.click("#patchList .patchrow:nth-child(2) .patchdrop"); await p.wait("document.querySelector('#patchMsg').textContent.includes('右邊加星星')||__app.patches().length<3", 30000); await p.wait("__app.patches().length===2", 30000); msg = await pg.inner_text("#patchMsg"); await p.shot(2, 0, 1.0)
            rec("I12 按第 2 列的「拿掉」：消失的是右邊的星星，訊息說的也是它", [i for i in await ids() if i.startswith("t")] == ["t1", "t2"] and "右邊加星星" in msg, (await ids(), msg[:60]))
            await pg.click("#patchList .patchrow:nth-child(1) .patchdrop"); await p.wait("__app.patches().length===0"); await p.shot(2, 0, 1.0)
            rec("I12 拿掉第 1 列：那個區塊的兩次改動一起拿掉", not [i for i in await ids() if i.startswith("t")] and await rows() == [], (await ids(), await rows()))
            await paste(fence("js", star("t1", "左邊加星星", 300) + "\n" + star("t2", "中間加星星", 900))); await paste(fence("js", star("t3", "右邊加星星", 1500)))
            await p.ev("__app.deleteElement('t1')"); await p.shot(2, 0, 1.0)
            rec("I12 刪除同一個區塊加的兩顆星星的其中一顆：只有它不見", [i for i in await ids() if i.startswith("t")] == ["t2", "t3"], await ids())
        await safe("I12 一個區塊好幾次 patchScene", i12)

        async def i13():
            await clean(); await paste(fence("js", CROSS)); txt = await p.ev("__app.aiText()")
            rec("I13 有改動時複製給 AI：帶著十字架的程式，沒有編輯器內部的標記", "function cross(" in txt and "@wm-" not in txt and "__wm" not in txt, [l for l in txt.split("\n") if "@wm" in l or "__wm" in l][:3])
            ok, st = await paste(fence("js", "/*@wm-patch*/{\n" + STAR + "\n}/*@wm-end*/"))
            ok2, st2 = await paste(fence("js", star("t9", "再加一顆", 300)))
            rec("I13 AI 的回覆帶著那種標記：照常套用，之後的改動也貼得進來", ok and ok2 and await labels() == ["加十字架", "加星星", "再加一顆"], (st[:50], st2[:80]))
            await p.ev("__app.tab('adv')"); r = await rows(); done = await p.ev("__app.removePatch(0)"); await p.shot(2, 0, 1.0)
            rec("I13 清單是三列，第一筆（加十字架）拿得掉", r == ["加十字架", "加星星", "再加一顆"] and done and await labels() == ["加星星", "再加一顆"] and "cross" not in await ids(), (r, done, await labels()))
        await safe("I13 標記", i13)

        async def i14():
            await clean(); await p.ev("__app.select(2,0)"); before = await proj_now()
            ok, st = await paste(fence("json", '{"format":"worship-motion-patch/1","set":{"__proto__":{"elements":{"sun":{"visible":false}}}}}'))
            leaked = await p.ev("({}).elements !== undefined"); await p.shot(2, 0, 1.0)
            rec("I14 設定的改動裡有 __proto__：不套用並說明，其他物件沒被改到，太陽照常畫", ok is False and "__proto__" in st and leaked is False and (await els())["sun"]["drawn"] > 0 and await proj_now() == before, (st[:100], leaked))
            ok, st = await paste(fence("json", '{"format":"worship-motion-patch/1","sections":{"副歌":{"constructor":{"prototype":{"x":1}}}}}'))
            rec("I14 段落的改動裡有 constructor：不套用並說明", ok is False and "constructor" in st and await p.ev("({}).x === undefined"), st[:100])
        await safe("I14 危險的鍵", i14)

        async def i15():
            await clean(); keep_code = await p.ev("__app.sceneCode()")
            for name, text, word in [
                ("after 指到不存在的元素", fence("js", "patchScene({ label: '壞掉', elements: { q: { in: ['peak'], after: 'nothing', draw(f) { } } } });"), "nothing"),
                ("新段落的 after 指到不存在的段落", cfg_patch(sections={"橋段": {"after": "沒有這一段", "background": "build", "subtitle": "none"}}), "沒有這一段"),
                ("區塊裡沒有真的呼叫 patchScene", fence("js", "if (false) patchScene({ label: '壞掉', elements: { q: { draw(f) { } } } });"), "patchScene"),
                ("空的 patchScene", fence("js", "patchScene({});"), "空"),
                ("大括號不成對", fence("js", "}\npatchScene({ label: '壞掉', elements: { q: { draw(f) { } } } });\n{"), "語法")]:
                ok, st = await paste(text)
                rec(f"I15 {name}：擋下並說明，風格程式與改動清單照舊", ok is False and word in st and "沒有套用" in st and "catch" not in st and await p.ev("__app.sceneCode()") == keep_code and await labels() == [], st[:140])
            d = await p.ev("t=>__app.detect(t)", fence("js", "// 這個改動接在 defineScene( 的後面\n" + STAR))
            rec("I15 註解裡提到 defineScene 的區塊：認成改動", d["patch"] is True and d["scene"] is False, d)
        await safe("I15 其他擋下的情況", i15)

        async def i16():
            await clean(); ok, st = await paste(cfg_patch(set={"palette": {"pink": "#c0392b"}, "elements": {"sun": {"dx": -300, "scale": .6}, "rays": {"opacity": .4}}}, sections={"副歌": {"elements": {"ring": {"visible": False}}}})); was = await proj_now()
            ok2, st2 = await paste(cfg_patch(set={"style": "bauhaus"})); pj = await proj_now()
            rec("I16 設定的改動換成包浩斯幾何：配色與元素的調整清掉（整首歌與每一段）", ok and ok2 and was["elements"]["sun"]["dx"] == -300 and pj["style"] == "bauhaus" and not pj.get("elements") and not any(s.get("elements") for s in pj["sections"]) and not pj.get("palette"), (st2[:60], pj.get("elements"), [s.get("elements") for s in pj["sections"]], pj.get("palette")))
            await p.ev("__app.undo()")
            rec("I16 還原後回到網點印刷，調整都回來", await proj_now() == was, (await proj_now()).get("elements"))
            ok, st = await paste(cfg_patch(set={"style": "paper", "elements": {"sun": {"scale": 1.1}}})); pj = await proj_now()
            rec("I16 換風格的同一個改動裡給的調整留著，原本的不帶過去", ok and pj["style"] == "paper" and pj.get("elements") == {"sun": {"scale": 1.1}}, (st[:60], pj.get("elements")))
            await clean(); await paste(cfg_patch(set={"elements": {"sun": {"dx": -300}}}, sections={"副歌": {"elements": {"ring": {"visible": False}}}}))
            ok, st = await paste(cfg_patch(set={"style": "bauhaus", "elements": {"sun": None}}, sections={"副歌": {"elements": {"ring": None}}})); pj = await proj_now()
            rec("I16 換風格的同一個改動裡用 null 寫「拿掉原本的調整」：照樣套用", ok and pj["style"] == "bauhaus" and not pj.get("elements") and not any(s.get("elements") for s in pj["sections"]), (st[:120], pj.get("elements")))
        await safe("I16 設定的改動換風格", i16)

        CROSS2 = "patchScene({ label: '加十字架', elements: { cross: { label: '十字架', in: ['peak'], after: 'sun', draw(f, x, e) { f.add(rect(940, 300, 980, 620, '#e8d9a8'), rect(860, 400, 1060, 440, '#e8d9a8')); } } } });"
        async def i18():
            await clean(); was = await proj_now(); code0 = await p.ev("__app.sceneCode()"); last0 = (await p.ev("__app.history()"))["labels"][-1]
            ok, st = await paste("換成包浩斯並加十字架：\n" + fence("js", CROSS2) + "\n" + cfg_patch(set={"style": "bauhaus"})); pj = await proj_now(); await p.ev("__app.select(2,0)"); await p.shot(2, 0, 1.0); e = await els()
            rec("I18 換成包浩斯幾何並加十字架：風格換了，十字架畫在新風格的高潮背景上", ok and pj["style"] == "bauhaus" and (await p.ev("__app.sceneInfo()"))["id"] == "bauhaus" and "brokenRing" in e and e.get("cross", {}).get("drawn", 0) > 0 and await labels() == ["加十字架"], (st[:60], sorted(e)[:6], await labels()))
            rec("I18 是一筆歷史紀錄；還原回到網點印刷、沒有改動，重做又回來", (await p.ev("__app.history()"))["labels"][-2:] == [last0, "套用 AI 的改動"] and await p.ev("__app.undo()") and await proj_now() == was and await labels() == [] and await p.ev("__app.sceneCode()") == code0 and await p.ev("__app.redo()") and (await proj_now())["style"] == "bauhaus" and await labels() == ["加十字架"], ((await p.ev("__app.history()"))["labels"][-2:], await labels()))
            await clean(); was = await proj_now()
            ok, st = await paste(fence("js", CROSS) + "\n" + cfg_patch(set={"style": "bauhaus"}))
            rec("I18 改動用到原本風格的變數、在新風格上跑不起來：整個不套用並說明，風格與設定照舊", ok is False and "沒有套用" in st and await proj_now() == was and (await p.ev("__app.sceneInfo()"))["id"] == "riso" and await p.ev("__app.sceneCode()") == code0 and await labels() == [], st[:140])
            ok, st = await paste(fence("js", CROSS2) + "\n" + cfg_patch(set={"style": "bauhaus", "bpm": 999}))
            rec("I18 畫面的改動沒問題、設定的改動有錯：整個不套用，風格與設定照舊", ok is False and "bpm" in st and await proj_now() == was and (await p.ev("__app.sceneInfo()"))["id"] == "riso" and await p.ev("__app.sceneCode()") == code0 and await labels() == [], st[:140])
            ok, st = await paste(fence("js", CROSS2) + "\n" + cfg_patch(set={"style": "nothing"}))
            rec("I18 要換的風格不存在：整個不套用並說明", ok is False and "nothing" in st and await proj_now() == was and await p.ev("__app.sceneCode()") == code0 and await labels() == [], st[:140])
            assert await p.ev("c=>__app.pasteScene(c)", MIN); await p.ev("__app.tab('self')"); await pg.select_option("#style", "riso"); await p.wait("__app.project.style==='riso'"); kept = [x for x in await p.ev("__app.songs()") if x["active"]][0]["customs"]
            ok, st = await paste(fence("js", CROSS2) + "\n" + cfg_patch(set={"style": "bauhaus", "bpm": 999})); now = [x for x in await p.ev("__app.songs()") if x["active"]][0]["customs"]
            rec("I18 這首歌存著 AI 的新風格時，沒套用成功的改動不會把它弄丟", ok is False and "bars" in kept and now == kept and (await p.ev("__app.sceneInfo()"))["id"] == "riso" and await p.ev("[...document.querySelectorAll('#style option')].some(o=>o.value==='bars')"), (kept, now, st[:80]))
            await paste(cfg_patch(sections={"副歌": {"background": "peak"}})); was = await proj_now(); code0 = await p.ev("__app.sceneCode()")
            only, st0 = await paste(cfg_patch(set={"style": "bars"})); both, st = await paste(fence("js", "patchScene({ label: '加星星', elements: { star: { label: '星星', draw(f, x, e) { f.add(circle(1500, 240, 60, '#e8d9a8')); } } } });") + "\n" + cfg_patch(set={"style": "bars"}))
            rec("I18 新風格沒有歌用到的背景：有沒有畫面的改動都一樣擋下並說明，風格與設定照舊", only is False and both is False and "peak" in st0 and "peak" in st and await proj_now() == was and await p.ev("__app.sceneCode()") == code0, (st0[:80], st[:80]))
            await clean(); await paste(cfg_patch(set={"elements": {"sun": {"dx": -300}}}, sections={"副歌": {"elements": {"ring": {"visible": False}}}}))
            ok, st = await paste(fence("js", CROSS2) + "\n" + cfg_patch(set={"style": "bauhaus", "elements": {"sun": None}}, sections={"副歌": {"elements": {"ring": None}}})); pj = await proj_now()
            rec("I18 換風格又改畫面的回覆裡用 null 拿掉原本的調整：照樣套用，調整不帶過去", ok and pj["style"] == "bauhaus" and not pj.get("elements") and not any(x.get("elements") for x in pj["sections"]) and await labels() == ["加十字架"], (st[:120], pj.get("elements")))
        await safe("I18 同一則回覆換風格又改畫面", i18)

        async def i19():
            await clean(); txt = await p.ev("__app.aiText()")
            rec("I19 複製給 AI 的說明：換風格又要加東西時分兩次回", "先只回換風格" in txt and "再按一次「複製給 AI」" in txt, [l for l in txt.split("\n") if "換風格" in l][:3])
            ok, st = await paste(fence("js", CROSS) + "\n" + cfg_patch(set={"style": "bauhaus"}))
            rec("I19 換風格又改畫面的回覆跑不起來：訊息建議分兩次", ok is False and "分兩次" in st and "複製給 AI" in st, st[:200])
        await safe("I19 分兩次", i19)

        async def i20():
            await clean(); ok, st = await paste(cfg_patch(sections={"前奏": {"before": "主歌", "background": "calm", "subtitle": "none"}}))
            rec("I20 在最前面插一段：訊息只說新增「前奏」，沒有說別段改名", ok and "新增一段「前奏」" in st and "名稱改成" not in st and "新增一段「副歌」" not in st, st[:200])
            ok, st = await paste(cfg_patch(sections={"導歌": None, "副歌": {"jumpBeats": 8}}))
            rec("I20 刪掉中間一段並改後面那段：訊息說刪掉導歌、副歌的色塊換位", ok and "刪掉：導歌" in st and "副歌：色塊換位" in st and "名稱改成" not in st, st[:200])
            await clean(); was = await proj_now()
            for key, patch in [("title", cfg_patch(set={"title": None})), ("bpm", cfg_patch(set={"bpm": None})), ("style", cfg_patch(set={"style": None})), ("style", cfg_patch(set={"style": ["bauhaus"]})), ("style", fence("json", json.dumps({**proj("riso"), "style": ["bauhaus"]}, ensure_ascii=False)))]:
                ok, st = await paste(patch)
                rec(f"I20 {key} 設成 {'null' if 'null' in patch else '陣列'}：擋下並說明，設定照舊", ok is False and key in st and "沒有套用" in st and await proj_now() == was, st[:120])
            ok, st = await paste(cfg_patch(set={"title": "新歌名示意"}))
            rec("I20 設定的改動改歌名：訊息是「歌名：測試 → 新歌名示意」，紀錄是套用 AI 的改動", ok and "歌名：測試 → 新歌名示意" in st and "另一首歌" not in st and (await p.ev("__app.history()"))["labels"][-1] == "套用 AI 的改動", (st[:120], (await p.ev("__app.history()"))["labels"][-1]))
        await safe("I20 訊息", i20)

        async def i21():
            await clean(); await paste(fence("js", CROSS)); await paste(fence("js", STAR)); await p.ev("__app.markSaved()"); await p.ev("__app.flushHist()")
            await p.ev("""(()=>{const kb=Object.keys(localStorage).find(x=>x.endsWith(':book')),kh=kb.replace(':book',':hist'),ks=kb.replace(':book',':saved'),bare=s=>s.split('{ __wmPatch();').join('{');
              const d=JSON.parse(bare(localStorage.getItem(kb)));for(const s of d.songs){const c=(s.customs||[]).find(x=>x.id===s.P.style)||s.custom;delete s.customs;s.custom=c?{id:c.id,code:c.code}:null;}
              const h=JSON.parse(bare(localStorage.getItem(kh)));h.codes=Object.fromEntries(Object.values(h.codes).map(c=>[fnv(c),c]));
              const old=t=>{const st=JSON.parse(t),c=[st.c,...(st.o||[])].find(x=>x&&x.id===st.P.style);delete st.o;st.c=c?{id:c.id,h:fnv(bare(CODES[c.h]))}:null;return JSON.stringify(st);};
              for(const g of Object.values(h.songs))for(const e of g.stack)e.s=old(e.s);
              localStorage.setItem(kb,JSON.stringify(d));localStorage.setItem(kh,JSON.stringify(h));
              localStorage.setItem(ks,fnv(JSON.stringify(d.songs.map(s=>[s.P,s.custom?s.custom.code:'']))));})()""")
            await p.reload(); await p.ev("__app.tab('adv')"); r = await rows(); saved = (await p.ev("__app.saveState()"))["saved"]
            rec("I21 少了記號的資料讀進來：清單是兩列、名稱都在，仍顯示已存成檔案", r == ["加十字架", "加星星"] and saved is True, (r, (await p.ev("__app.saveState()"))["text"]))
            await p.ev("__app.undo()"); await p.ev("__app.select(2,0)"); await p.ev("__app.tab('adv')"); r = await rows()
            rec("I21 還原到之前的紀錄：改動的名稱還在", r == ["加十字架"] and "cross" in await ids(), (r, await labels()))
        await safe("I21 少了記號的資料", i21)

        async def i17():
            await clean(); await paste(fence("js", CROSS)); txt = await p.ev("__app.aiText()"); code = txt.split("```js\n", 1)[1].split("\n```", 1)[0]
            ok, st = await paste(fence("js", code + "\n" + star("t2", "加星星", 1500))); await p.ev("__app.select(2,0)"); await p.ev("__app.tab('el')"); had = await ids(); last0 = (await p.ev("__app.history()"))["labels"][-1]
            done = await p.ev("__app.deleteElement('t2')"); msg = await pg.inner_text("#elMsg"); await p.shot(2, 0, 1.0)
            rec("I17 整份貼回後按星星的「刪除」：真的刪掉，多一筆歷史紀錄", ok and "cross" in had and "t2" in had and done and "t2" not in await ids() and "cross" in await ids() and "刪掉了" in msg and last0 != "刪除元素「星星」" and (await p.ev("__app.history()"))["labels"][-2:] == [last0, "刪除元素「星星」"], (st[:40], had, await ids(), msg[:40], (await p.ev("__app.history()"))["labels"][-2:]))
            await p.ev("__app.tab('adv')")
            rec("I17 「這首歌的改動」多的是那一筆刪除", await rows() == ["刪除「星星」"], await rows())
            await p.ev("__app.undo()"); await p.shot(2, 0, 1.0)
            rec("I17 還原後星星回來，「刪掉了」的訊息跟著消失", "t2" in await ids() and (await pg.inner_text("#elMsg")).strip() == "", await pg.inner_text("#elMsg"))
        await safe("I17 整份貼回後的刪除", i17)

        rec("沒有頁面錯誤", not p.log, p.log[:3])
        if b: await b.close()
asyncio.run(main()); finish()
