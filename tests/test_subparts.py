"""字幕拆成元素：python3 tests/test_subparts.py（示意文字）
驗收條件：
P1 網點印刷、大字排版的字幕影片，元素清單＝段落背景的元素＋這種字幕自己的元素（歌詞、底條…）；背景影片的清單沒有字幕的元素。
P2 在字幕影片上點字選到「歌詞」、點底條選到底條；拖歌詞只有歌詞移動，底條與背景的元素照舊。
P3 字幕的每個元素可以單獨隱藏；開場掃屏、開場快閃是固定的（選不到）。
P4 調整對同一種字幕的每一句都生效。
P5 雙語時，小字屬於「歌詞」，跟著一起移動。
P6 字幕整個是一個函式的風格（剪紙拼貼）照常列出 背景、字幕。
P7 AI 可以用 use 寫字幕（examples/elements.js），清單裡的 under 代表段落選的背景；under 放在背景的 use、元素取名 under 都會擋下並說明。
另外用 python3 tests/test_golden.py --ref <實作前的 commit> 確認：沒有任何調整時，畫面和實作前一格不差。"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
from PIL import ImageStat

PARTS = (ROOT / "examples" / "elements.js").read_text()
PEAK = ["rays", "sun", "dot", "marks", "swatches"]
BUILD = ["stripes", "discs", "tri", "ramp", "progress", "marks", "swatches"]
TYPE_BUILD = ["giant", "wash", "panel", "para", "ibeam", "disc", "dot", "ellipsis", "progress"]
TYPE_PEAK = ["giant", "wash", "para", "corner", "ring", "progress", "disc", "rules", "block", "dot", "ellipsis"]
TWO = "這是第一行示意文字\n這是第二行示意文字\n\n這是第三行示意文字\n這是第四行示意文字"
def amount(a, b): return sum(ImageStat.Stat(ImageChops.difference(a, b)).sum)
def center(b): return ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)
def near(a, b, tol): return all(abs(x - y) <= tol for x, y in zip(a, b))

async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)
        pg, out = p.pg, OUT / "subparts"
        async def els(): return {e["id"]: e for e in await p.ev("__app.elements()")}
        async def ids(): return [e["id"] for e in await p.ev("__app.elements()")]
        async def set_el(i, patch, scope="song"): await p.ev("a=>__app.setElement(a[0],a[1],a[2])", [i, patch, scope])
        async def proj_now(): return await p.ev("__app.project")
        async def picked(): s = await p.ev("__app.selection()"); return s["ids"] if s else []
        async def at(si, ci, t, style="riso", **over):
            pj = proj(style); pj["sections"][2].update(over)
            assert await p.ev("x=>__app.load(x)", pj)
            await p.ev(f"__app.select({si},{ci})"); await p.ev(f"__app.seek({t})"); await p.ev("__app.editMode(true)")
        async def view():
            await p.ev("document.querySelector('#view').scrollIntoView({block:'center'})")
            return await p.ev("(()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
        async def cpt(x, y): R = await view(); return (R[0] + x / 1920 * R[2], R[1] + y / 1080 * R[3])
        async def unit(): R = await view(); return 1920 / R[2]
        async def click(x, y): await pg.mouse.click(*await cpt(x, y))
        async def drag(a, c): await pg.mouse.move(*await cpt(*a)); await pg.mouse.down(); await pg.mouse.move(*await cpt(*c), steps=8); await pg.mouse.up()
        async def safe(name, fn):
            try: await fn()
            except Exception as e: rec(name, False, "例外：" + str(e).split("\n")[0][:200])
            finally: await pg.mouse.up()

        async def p1():
            await at(2, 1, 4.0); e = await els()
            rec("P1 網點印刷的收斂字幕：高潮背景的元素＋紙色底條、歌詞", list(e) == PEAK + ["plate", "lyrics"] and e["plate"]["label"] == "紙色底條" and e["lyrics"]["label"] == "歌詞" and e["lyrics"]["drawn"] > 0, [(k, v["label"]) for k, v in e.items()])
            await p.ev("__app.select(2,0)"); await p.ev("__app.seek(4.0)")
            rec("P1 同一段的背景影片：清單只有背景的元素", await ids() == PEAK, await ids())
            await p.ev("__app.select(1,1)"); await p.ev("__app.seek(3.0)")
            rec("P1 網點印刷的華麗字幕：累積背景的元素＋印章色塊、歌詞、第二語言、開場掃屏", await ids() == BUILD + ["stamps", "chars", "subline", "wipe"], await ids())
            await at(1, 1, 3.0, "type")
            rec("P1 大字排版的華麗字幕：累積背景的元素＋開場快閃、關鍵字、其他的字、底線、第二語言", await ids() == TYPE_BUILD + ["flash", "keyword", "words", "underline", "subline"], await ids())
            await p.ev("__app.select(2,1)"); await p.ev("__app.seek(4.0)")
            rec("P1 大字排版的收斂字幕：高潮背景的元素＋深色底條、歌詞、重點短線", await ids() == TYPE_PEAK + ["plate", "lyrics", "accent"], await ids())
        await safe("P1 字幕的元素清單", p1)

        async def p2():
            await at(2, 1, 4.0); base = await p.grab(4.0); e0 = await els(); u = await unit()
            await click(200, 440); on_plate = await picked(); await click(960, 440); on_text = await picked()
            rec("P2 點底條選到紙色底條、點字選到歌詞", on_plate == ["plate"] and on_text == ["lyrics"], (on_plate, on_text))
            await drag((960, 440), (960, 590)); adj = (await proj_now()).get("elements") or {}; e = await els(); moved = await p.grab(4.0, out / "lyrics_moved.png")
            rec("P2 把歌詞往下拖 150：只有歌詞記下 dy", near((adj.get("lyrics", {}).get("dy", 0),), (150,), 2 * u + 1) and list(adj) == ["lyrics"], adj)
            rec("P2 歌詞的範圍往下移，底條和背景的元素照舊，畫面改變", near(center(e["lyrics"]["box"]), (center(e0["lyrics"]["box"])[0] + adj.get("lyrics", {}).get("dx", 0), center(e0["lyrics"]["box"])[1] + adj.get("lyrics", {}).get("dy", 0)), 0.5) and all(e[k]["box"] == e0[k]["box"] for k in e0 if k != "lyrics") and amount(base, moved) > 0, e["lyrics"]["box"])
        await safe("P2 只拖歌詞", p2)

        async def p3():
            await at(2, 1, 4.0); e0 = await els(); base = await p.grab(4.0)
            await set_el("plate", {"visible": False}); e = await els(); hid = await p.grab(4.0, out / "plate_hidden.png")
            rec("P3 隱藏紙色底條：底條沒畫、歌詞照舊、畫面改變", e["plate"]["drawn"] == 0 and e["lyrics"]["drawn"] == e0["lyrics"]["drawn"] and amount(base, hid) > 0, {k: v["drawn"] for k, v in e.items()})
            await p.ev("__app.select(1,1)"); await p.ev("__app.seek(3.0)"); e = await els()
            rec("P3 開場掃屏是固定的，選不到", e["wipe"]["fixed"] is True and e["chars"]["fixed"] is False and await p.ev("__app.selectElement('wipe')") is False, {k: v["fixed"] for k, v in e.items() if k in ("wipe", "chars", "stamps")})
            await at(1, 1, 3.0, "type"); e = await els()
            rec("P3 開場快閃是固定的，關鍵字可以選", e["flash"]["fixed"] is True and await p.ev("__app.selectElement('keyword')") is True, {k: v["fixed"] for k, v in e.items() if k in ("flash", "keyword")})
        await safe("P3 隱藏與固定", p3)

        async def p4():
            await at(2, 1, 4.0, lyrics=TWO); a1 = (await els())["lyrics"]["box"]; await p.ev("__app.select(2,2)"); await p.ev("__app.seek(4.0)"); a2 = (await els())["lyrics"]["box"]
            await set_el("lyrics", {"dy": 100}); await p.ev("__app.seek(4.0)"); b2 = (await els())["lyrics"]["box"]; await p.ev("__app.select(2,1)"); await p.ev("__app.seek(4.0)"); b1 = (await els())["lyrics"]["box"]
            rec("P4 兩句字幕：調一次歌詞的位置，兩句都往下 100", near(center(b1), (center(a1)[0], center(a1)[1] + 100), 0.5) and near(center(b2), (center(a2)[0], center(a2)[1] + 100), 0.5), (a1, b1, a2, b2))
        await safe("P4 每一句都生效", p4)

        async def p5():
            await at(2, 1, 4.0); one = (await els())["lyrics"]
            await at(2, 1, 4.0, lyrics2="Sample line one\nSample line two"); e0 = await els(); two = e0["lyrics"]
            await set_el("lyrics", {"dy": 80}); await p.ev("__app.seek(4.0)"); e = await els()
            rec("P5 雙語：小字算在歌詞裡（畫的東西變多），清單不變", two["drawn"] > one["drawn"] and list(e0) == PEAK + ["plate", "lyrics"], (one["drawn"], two["drawn"]))
            rec("P5 雙語：移動歌詞時大字小字一起動（整個範圍平移 80）", near(e["lyrics"]["box"], [two["box"][0], two["box"][1] + 80, two["box"][2], two["box"][3] + 80], 0.5), (two["box"], e["lyrics"]["box"]))
        await safe("P5 雙語", p5)

        async def p6():
            await at(2, 1, 4.0, "paper")
            rec("P6 剪紙拼貼的字幕影片照常列出 背景、字幕", await ids() == ["bg", "text"], await ids())
        await safe("P6 整塊的字幕", p6)

        async def p7():
            await at(0, 0, 1.0)
            ok = await p.ev("c=>__app.pasteScene(c)", PARTS); st = await p.ev("__app.sceneStatus()")
            await p.ev("__app.select(2,1)"); await p.ev("__app.seek(4.0)"); e = await els()
            rec("P7 用 use 寫字幕的風格可以貼上：字幕影片列出 色帶、圓、底條、歌詞", ok and list(e) == ["bar", "dot", "plate", "lyrics"] and e["bar"]["drawn"] > 0 and e["lyrics"]["drawn"] > 0, (st[:60], [(k, v["drawn"]) for k, v in e.items()]))
            ok = await p.ev("c=>__app.pasteScene(c)", PARTS.replace("id: 'parts'", "id: 'parts4'").replace("use: ['bar', { el: 'dot', r: 90 }]", "use: ['under', 'bar']")); st = await p.ev("__app.sceneStatus()")
            rec("P7 under 放在背景的 use：擋下並說明", ok is False and "under" in st and "subtitles" in st, st[:160])
            ok = await p.ev("c=>__app.pasteScene(c)", PARTS.replace("id: 'parts'", "id: 'parts5'").replace("plate: { label: '底條'", "under: { label: '底條'").replace("'plate', 'lyrics']", "'under', 'lyrics']")); st = await p.ev("__app.sceneStatus()")
            rec("P7 元素取名 under：擋下並說明", ok is False and "under" in st and "保留" in st, st[:160])
            sk = await p.ev("__app.skill()")
            rec("P7 給 AI 的說明寫了字幕的 use 與 under", "`'under'`" in sk and "字幕也用 `use` 組合" in sk, len(sk))
        await safe("P7 AI 用元素寫字幕", p7)

        rec("沒有頁面錯誤", not p.log, p.log[:3])
        if b: await b.close()
asyncio.run(main()); finish()
