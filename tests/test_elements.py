"""畫面元素（階段 1：元素化與清單）：python3 tests/test_elements.py（示意文字）
驗收條件：
AC1  風格由元素組成：網點印刷（riso）的平靜背景列出 大圓、橫條、圓環、網點漸層、套準記號、色票條；大字排版（type）的累積背景列出 9 個元素。
AC2  每個元素可以單獨隱藏：只有那個元素消失，其他元素畫的東西一樣多。
AC3  每個元素可以單獨調透明度：畫面介於「全顯示」和「隱藏」之間。
AC4  元素有自己的參數（大圓的大小），超出範圍會夾回範圍內。
AC5  元素可以單獨換色：只影響那個元素，用同一個顏色的其他東西照舊。
AC6  調整可以只套用在一個段落；其他段落照舊。
AC7  字幕影片的元素清單＝段落背景的元素＋字幕；字幕也能隱藏。
AC8  整個背景是一個畫圖函式的風格（剪紙拼貼）照常能用，列出 背景、字幕 兩個元素，同樣能隱藏、調透明度。
AC9  設定 JSON 的 elements 欄位：貼上會套用；不認得的元素略過並提醒；值不對就不套用並說明哪一欄。
AC10 換風格會清掉元素調整；還原（undo）回到調整前；匯出的設定、存成的單檔都帶著調整，重新載入後一樣。
AC11 「畫面元素」分頁有元素清單：上面的列是畫在上面的元素；勾選與滑桿會改設定。
AC12 AI 可以用 elements＋use 寫風格（examples/elements.js）；use 指到不存在的元素、元素取了保留的名稱，都會擋下並說明。
AC13 隱藏元素後仍能匯出 MP4；給 AI 的文字帶著目前的元素調整。
另外用 python3 tests/test_golden.py --ref <實作前的 commit> 確認：沒有任何調整時，畫面和拆元素前一格不差。"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
from PIL import ImageStat

PARTS = (ROOT / "examples" / "elements.js").read_text()
CALM = ["discs", "bar", "ring", "ramp", "marks", "swatches"]
CALM_LABELS = ["大圓", "橫條", "圓環", "網點漸層", "套準記號", "色票條"]
PEAK = ["rays", "sun", "dot", "marks", "swatches"]
TYPE_BUILD = ["giant", "wash", "panel", "para", "ibeam", "disc", "dot", "ellipsis", "progress"]
def amount(a, b): return sum(ImageStat.Stat(ImageChops.difference(a, b)).sum)
def fence(kind, body): return "```" + kind + "\n" + body + "\n```"

async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)
        out = OUT / "elements"
        async def els(): return {e["id"]: e for e in await p.ev("__app.elements()")}
        async def ids(): return [e["id"] for e in await p.ev("__app.elements()")]
        async def set_el(i, patch, scope="song"): await p.ev("a=>__app.setElement(a[0],a[1],a[2])", [i, patch, scope])
        async def proj_now(): return await p.ev("__app.project")
        async def fresh(style="riso"):
            assert await p.ev("x=>__app.load(x)", proj(style))
        async def safe(name, fn):
            try: await fn()
            except Exception as e: rec(name, False, "例外：" + str(e).split("\n")[0][:200])

        async def ac1():
            await fresh("riso")
            await p.shot(0, 0, 1.0, out / "riso_base.png"); e = await els()
            rec("AC1 網點印刷的平靜背景列出 6 個元素（由下到上）", list(e) == CALM and [e[k]["label"] for k in CALM] == CALM_LABELS, [(k, v["label"]) for k, v in e.items()])
            rec("AC1 每個元素預設顯示、透明度 1、這一格有畫東西", all(v["visible"] is True and v["opacity"] == 1 and v["drawn"] > 0 for v in e.values()), {k: (v["visible"], v["opacity"], v["drawn"]) for k, v in e.items()})
            await p.shot(2, 0, 1.0, out / "riso_peak.png")
            rec("AC1 網點印刷的高潮背景列出自己的 5 個元素", await ids() == PEAK, await ids())
            await fresh("type"); await p.shot(1, 0, 1.0, out / "type_build.png")
            rec("AC1 大字排版的累積背景列出 9 個元素", await ids() == TYPE_BUILD, await ids())
        await safe("AC1 風格由元素組成", ac1)

        async def ac2_3():
            await fresh("riso")
            base = await p.shot(0, 0, 1.0); e0 = await els()
            await set_el("discs", {"visible": False})
            hid = await p.shot(0, 0, 1.0, out / "riso_discs_hidden.png"); e1 = await els(); pj = await proj_now()
            rec("AC2 隱藏大圓：設定記下 visible false、畫面改變", pj["elements"]["discs"]["visible"] is False and amount(base, hid) > 0, amount(base, hid))
            rec("AC2 隱藏大圓：大圓沒畫，其他元素畫的數量照舊", e1["discs"]["drawn"] == 0 and all(e1[k]["drawn"] == e0[k]["drawn"] for k in CALM[1:]), {k: v["drawn"] for k, v in e1.items()})
            await set_el("discs", {"visible": True, "opacity": 0.5})
            half = await p.shot(0, 0, 1.0, out / "riso_discs_half.png"); e2 = await els(); pj = await proj_now()
            rec("AC3 大圓透明度 0.5：設定記下 0.5、畫的數量照舊", pj["elements"]["discs"]["opacity"] == 0.5 and e2["discs"]["drawn"] == e0["discs"]["drawn"], (pj["elements"], e2["discs"]["drawn"]))
            rec("AC3 大圓透明度 0.5：和原圖的差距大於 0、小於「隱藏」", 0 < amount(base, half) < amount(base, hid), (amount(base, half), amount(base, hid)))
        await safe("AC2 AC3 隱藏與透明度", ac2_3)

        async def ac4():
            await fresh("riso"); base = await p.shot(0, 0, 1.0); e = await els()
            w = e["discs"]["params"]["size"]
            rec("AC4 大圓有「大小」參數，預設 1", w["label"] == "大小" and w["value"] == 1 and w["min"] < 1 < w["max"], w)
            await set_el("discs", {"params": {"size": w["max"]}})
            big = await p.shot(0, 0, 1.0, out / "riso_discs_big.png"); pj = await proj_now()
            rec("AC4 大小調到最大：設定記下、畫面改變", pj["elements"]["discs"]["params"]["size"] == w["max"] and amount(base, big) > 0, amount(base, big))
            await set_el("discs", {"params": {"size": 99}}); pj = await proj_now()
            rec("AC4 大小超出範圍會夾回最大值", pj["elements"]["discs"]["params"]["size"] == w["max"], pj["elements"])
        await safe("AC4 元素參數", ac4)

        async def ac5():
            await fresh("riso"); base = await p.shot(0, 0, 1.0); e = await els()
            rec("AC5 大圓列出自己用的顏色（藍墨、粉紅墨）", sorted(e["discs"]["colors"]) == ["blue", "pink"], e["discs"]["colors"])
            await set_el("discs", {"colors": {"blue": "#2f7a4a"}})
            green = await p.shot(0, 0, 1.0, out / "riso_discs_color.png"); pj = await proj_now()
            rec("AC5 大圓換色：設定記下、畫面改變、整首歌的配色沒動", pj["elements"]["discs"]["colors"]["blue"] == "#2f7a4a" and amount(base, green) > 0 and "blue" not in pj.get("palette", {}), (pj["elements"], pj.get("palette")))
            await fresh("riso"); await set_el("rays", {"colors": {"blue": "#2f7a4a"}}); await set_el("rays", {"visible": False}); a = await p.shot(2, 1, 4.0, out / "riso_sub_color_hidden.png")
            await fresh("riso"); await set_el("rays", {"visible": False}); c = await p.shot(2, 1, 4.0)
            rec("AC5 光芒的換色只影響光芒：把光芒藏起來後，字幕畫面和沒換色時一格不差", diff(a, c, 1) == 0, diff(a, c, 1))
        await safe("AC5 元素換色", ac5)

        async def ac6():
            await fresh("riso"); base1 = await p.shot(1, 0, 1.0)
            await p.ev("__app.select(0,0)"); await set_el("discs", {"visible": False}, "section"); pj = await proj_now()
            rec("AC6 只套用在這一段：調整記在段落上，整首歌的 elements 沒有大圓", pj["sections"][0]["elements"]["discs"]["visible"] is False and "discs" not in (pj.get("elements") or {}), (pj.get("elements"), pj["sections"][0].get("elements")))
            await p.shot(0, 0, 1.0); e0 = await els()
            now1 = await p.shot(1, 0, 1.0); e1 = await els()
            rec("AC6 這一段的大圓藏起來，下一段照舊（畫面一格不差）", e0["discs"]["visible"] is False and e1["discs"]["visible"] is True and diff(base1, now1, 1) == 0, (e0["discs"]["visible"], e1["discs"]["visible"], diff(base1, now1, 1)))
            await fresh("riso"); await p.ev("__app.select(0,0)")
            await set_el("discs", {"visible": False}, "section"); await p.ev("__app.select(1,0)"); await set_el("discs", {"visible": False}, "song")
            assert await p.ev("x=>__app.load(x)", await proj_now()); await p.ev("__app.select(1,0)")
            await set_el("discs", {"visible": True}, "song"); await p.shot(0, 0, 1.0); e0 = await els(); await p.shot(1, 0, 1.0); e1 = await els(); pj = await proj_now()
            rec("AC6 第 1 段自己隱藏、在別段把整首歌也設成隱藏、重新載入後再把整首歌改回來：第 1 段仍照自己的設定", e0["discs"]["visible"] is False and e1["discs"]["visible"] is True and (pj["sections"][0].get("elements") or {}).get("discs", {}).get("visible") is False, (e0["discs"]["visible"], e1["discs"]["visible"], pj["sections"][0].get("elements")))
        await safe("AC6 段落覆寫", ac6)

        async def ac7():
            await fresh("riso"); base = await p.shot(2, 1, 4.0); e = await els()
            rec("AC7 字幕影片的元素＝背景的元素＋字幕", list(e) == PEAK + ["text"] and e["text"]["label"] == "字幕" and e["text"]["drawn"] > 0, [(k, v["label"], v["drawn"]) for k, v in e.items()])
            await set_el("text", {"visible": False}); hid = await p.shot(2, 1, 4.0, out / "riso_text_hidden.png"); e1 = await els()
            rec("AC7 隱藏字幕：字幕沒畫、背景的元素照舊、畫面改變", e1["text"]["drawn"] == 0 and all(e1[k]["drawn"] == e[k]["drawn"] for k in PEAK) and amount(base, hid) > 0, {k: v["drawn"] for k, v in e1.items()})
        await safe("AC7 字幕影片的元素", ac7)

        async def ac8():
            await fresh("paper"); base = await p.shot(0, 0, 1.0); e = await els()
            rec("AC8 剪紙拼貼的背景列出一個元素「背景」", list(e) == ["bg"] and e["bg"]["label"] == "背景" and e["bg"]["drawn"] > 0, [(k, v["label"]) for k, v in e.items()])
            await set_el("bg", {"opacity": 0.5}); half = await p.shot(0, 0, 1.0, out / "paper_bg_half.png")
            await set_el("bg", {"visible": False}); hid = await p.shot(0, 0, 1.0, out / "paper_bg_hidden.png"); e1 = await els()
            rec("AC8 「背景」能調透明度、能隱藏", 0 < amount(base, half) < amount(base, hid) and e1["bg"]["drawn"] == 0, (amount(base, half), amount(base, hid), e1["bg"]["drawn"]))
            await fresh("paper"); await p.shot(2, 1, 4.0)
            rec("AC8 剪紙拼貼的字幕影片列出 背景、字幕", await ids() == ["bg", "text"], await ids())
        await safe("AC8 整個背景一個函式的風格", ac8)

        async def ac9():
            await fresh("riso")
            cfg = proj("riso", elements={"discs": {"opacity": 0.4, "params": {"size": 1.2}}, "nope": {"visible": False}})
            cfg["sections"][1]["elements"] = {"marks": {"visible": False}}
            ok = await p.ev("t=>__app.paste(t)", "設定：\n" + fence("json", json.dumps(cfg, ensure_ascii=False))); st = await p.ev("__app.status()"); pj = await proj_now()
            rec("AC9 貼上帶 elements 的設定：套用", ok and st.startswith("已套用") and pj["elements"]["discs"] == {"opacity": 0.4, "params": {"size": 1.2}} and pj["sections"][1]["elements"]["marks"]["visible"] is False, (st[:60], pj.get("elements"), pj["sections"][1].get("elements")))
            rec("AC9 不認得的元素略過並提醒", "nope" not in pj["elements"] and "nope" in st and "略過" in st, st[-160:])
            bad = proj("riso", elements={"discs": {"opacity": "很淡"}})
            ok = await p.ev("t=>__app.paste(t)", fence("json", json.dumps(bad, ensure_ascii=False))); st = await p.ev("__app.status()")
            rec("AC9 透明度不是數字：不套用，說明是 elements.discs.opacity", ok is False and "elements.discs.opacity" in st and "沒有套用" in st, st[:160])
            bad = proj("riso", elements={"discs": {"colors": {"blue": "藍色"}}})
            ok = await p.ev("t=>__app.paste(t)", fence("json", json.dumps(bad, ensure_ascii=False))); st = await p.ev("__app.status()")
            rec("AC9 顏色不是色碼：不套用，說明是 elements.discs.colors.blue", ok is False and "elements.discs.colors.blue" in st, st[:160])
            odd = proj("riso", elements={"toString": {"visible": False}, "constructor": {"params": {"a": 1}}})
            ok = await p.ev("t=>__app.paste(t)", fence("json", json.dumps(odd, ensure_ascii=False))); st = await p.ev("__app.status()"); pj = await proj_now()
            rec("AC9 元素名稱剛好是物件內建名稱（toString、constructor）：當成不認得的元素略過並提醒", ok and st.startswith("已套用") and not pj.get("elements") and "toString" in st and "constructor" in st and "略過" in st, (ok, st[:80], pj.get("elements")))
        await safe("AC9 設定 JSON 的 elements", ac9)

        async def ac10():
            await fresh("riso"); await p.ev("__app.select(0,0)")
            await set_el("discs", {"visible": False}); h = await p.ev("__app.history()")
            rec("AC10 歷史紀錄記下這次調整（提到元素名稱）", "大圓" in h["labels"][h["pos"]], h["labels"][-2:])
            await p.ev("__app.undo()"); pj = await proj_now()
            rec("AC10 還原：回到調整前", not (pj.get("elements") or {}).get("discs"), pj.get("elements"))
            await p.ev("__app.redo()"); await set_el("marks", {"opacity": 0.3}, "section"); pj = await proj_now()
            html = await p.ev("__app.singleHTML()")
            rec("AC10 存成的單檔帶著元素調整", '"elements"' in html and '"discs"' in html, len(html))
            await fresh("swiss"); assert await p.ev("x=>__app.load(x)", pj); back = await proj_now()
            rec("AC10 匯出的設定重新載入後，元素調整一樣", back.get("elements") == pj.get("elements") and back["sections"][0].get("elements") == pj["sections"][0].get("elements") and pj["elements"]["discs"]["visible"] is False, (back.get("elements"), back["sections"][0].get("elements")))
            await p.ev("__app.tab('self')"); await p.pg.select_option("#style", "swiss"); await p.wait("__app.project.style==='swiss'"); pj = await proj_now()
            rec("AC10 換風格會清掉元素調整（整首歌與各段落）", not pj.get("elements") and not any(s.get("elements") for s in pj["sections"]), (pj.get("elements"), [s.get("elements") for s in pj["sections"]]))
        await safe("AC10 換風格、還原、存檔", ac10)

        async def ac11():
            await fresh("riso"); await p.ev("__app.select(0,0)"); await p.ev("__app.tab('el')")
            rows = await p.ev("[...document.querySelectorAll('#elList .elrow')].map(r=>[r.dataset.id, r.querySelector('.elname').textContent])")
            rec("AC11 「畫面元素」分頁的元素清單：上面的列是畫在上面的元素", rows == [list(x) for x in zip(CALM[::-1], CALM_LABELS[::-1])] and await p.pg.is_visible("#elList"), rows)
            await p.pg.click("#elList .elrow[data-id=discs] .elvis"); await p.wait("(__app.project.elements||{}).discs&&__app.project.elements.discs.visible===false")
            rec("AC11 取消勾選「顯示」：設定記下 visible false", True)
            await p.pg.click("#elList .elrow[data-id=discs] .elvis"); await p.pg.fill("#elList .elrow[data-id=marks] .elop", "40")
            await p.wait("(__app.project.elements||{}).marks&&__app.project.elements.marks.opacity===0.4"); pj = await proj_now()
            rec("AC11 拉透明度滑桿到 40：設定記下 0.4；重新勾選後 visible 回到預設", pj["elements"]["marks"]["opacity"] == 0.4 and pj["elements"].get("discs", {}).get("visible", True) is True, pj["elements"])
            await p.pg.click("#elScope button:nth-child(2)"); await p.pg.click("#elList .elrow[data-id=ring] .elvis")
            await p.wait("(__app.project.sections[0].elements||{}).ring&&__app.project.sections[0].elements.ring.visible===false"); pj = await proj_now()
            rec("AC11 選「只有這一段」再取消勾選：調整記在段落上", "ring" not in pj["elements"], (pj["elements"], pj["sections"][0]["elements"]))
        await safe("AC11 元素清單介面", ac11)

        async def ac12():
            await fresh("riso")
            ok = await p.ev("c=>__app.pasteScene(c)", PARTS); st = await p.ev("__app.sceneStatus()"); await p.shot(0, 0, 1.0, out / "parts_base.png"); e = await els()
            rec("AC12 用 elements＋use 寫的風格可以貼上，列出 色帶、圓", ok and list(e) == ["bar", "dot"] and [v["label"] for v in e.values()] == ["色帶", "圓"] and e["bar"]["params"]["thick"]["label"] == "粗細", (st[:80], [(k, v["label"]) for k, v in e.items()]))
            base = await p.shot(0, 0, 1.0); await set_el("dot", {"visible": False}); hid = await p.shot(0, 0, 1.0, out / "parts_dot_hidden.png"); e1 = await els()
            rec("AC12 貼上的風格：隱藏圓，色帶照舊", e1["dot"]["drawn"] == 0 and e1["bar"]["drawn"] == e["bar"]["drawn"] and amount(base, hid) > 0, {k: v["drawn"] for k, v in e1.items()})
            ok = await p.ev("c=>__app.pasteScene(c)", PARTS.replace("id: 'parts'", "id: 'parts2'").replace("use: ['bar', { el: 'dot', r: 90 }]", "use: ['bar', 'ghost']")); st = await p.ev("__app.sceneStatus()")
            rec("AC12 use 指到不存在的元素：擋下並說出名稱", ok is False and "ghost" in st, st[:160])
            ok = await p.ev("c=>__app.pasteScene(c)", PARTS.replace("id: 'parts'", "id: 'parts3'").replace("bar: { label: '色帶'", "text: { label: '色帶'").replace("['bar',", "['text',")); st = await p.ev("__app.sceneStatus()")
            rec("AC12 元素取了保留的名稱 text：擋下並說明", ok is False and "text" in st and "elements" in st, st[:160])
        await safe("AC12 AI 用元素寫風格", ac12)

        async def ac13():
            await fresh("riso"); await p.ev("__app.select(0,0)"); await set_el("discs", {"visible": False})
            ex = await p.ev("__app.exportTest(0.4)")
            rec("AC13 隱藏元素後匯出 MP4", ex["ftyp"] == "ftyp" and ex["size"] > 1000, ex)
            ai = await p.ev("__app.aiText()")
            rec("AC13 給 AI 的文字帶著元素調整", '"elements"' in ai and '"discs"' in ai, len(ai))
            sk = await p.ev("__app.skill()")
            rec("AC13 給 AI 的說明寫了 elements 與 use", "`elements`" in sk and "`use`" in sk and "defineScene" in sk, len(sk))
        await safe("AC13 匯出與給 AI 的文字", ac13)

        rec("沒有頁面錯誤", not p.log, p.log[:3])
        if b: await b.close()
asyncio.run(main()); finish()
