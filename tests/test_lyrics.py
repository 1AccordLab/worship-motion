"""歌詞相關的無頭測試：python3 tests/test_lyrics.py
雙語字幕（有／無／大小對調）、後三種內建風格（防護試跑、16 秒循環）、雙語抽格、整首貼上（標題、拼錯、無標題、中英交錯、版權行）、
簡轉繁、打開四首歌的設定檔且設定正確。全部用示意文字。"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
def bi(style, swap=False, l2="Sample line one\nSample line two"):
    p = proj(style); p["sections"][2]["lyrics2"] = l2; p["sections"][2]["swapLang"] = swap
    p["sections"][1]["lyrics2"] = "Sample line one"; p["sections"][1]["swapLang"] = swap; return p
WHOLE = """[Verse 1]
這是第一行示意文字
這是第二行示意文字

Pre-chorus:
這是第三行示意文字

【副歌】
這是第四行示意文字
這是第五行示意文字

<chrous>
這是第四行示意文字
這是第五行示意文字

Bridge
這是第六行示意文字

詞：示意作者　曲：示意作者
© 2020 Sample Music
CCLI 1234567"""
BILING = """[Verse 1]
這是第一行示意文字
Sample line one
這是第二行示意文字
Sample line two

[Chorus]
這是第三行示意文字
Sample line three"""
NOHEAD = "這是第一行示意文字\n這是第二行示意文字\n\n這是第三行示意文字\n\n這是第四行示意文字"
HEADERS = {"[Verse]": ("verse", None), "[Verse 1]": ("verse", 1), "<verse 1>": ("verse", 1), "Verse 1:": ("verse", 1), "【主歌】": ("verse", None),
           "主歌一": ("verse", 1), "[Chorus]": ("chorus", None), "CHORUS 2": ("chorus", 2), "[Ｃｈｏｒｕｓ]": ("chorus", None), "[chrous]": ("chorus", None),
           "Pre-chorus": ("pre", None), "Prechorus:": ("pre", None), "導歌": ("pre", None), "Bridge": ("bridge", None), "橋段": ("bridge", None),
           "Outro": ("outro", None), "Ending": ("outro", None), "結尾": ("outro", None), "Intro": ("intro", None), "[Tag]": ("tag", None)}
NOT_HEAD = ["這是第一行示意文字", "Sample line one", "I", "Verse of the day is long here"]

async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)
        for st in STYLES:
            await p.ev("x=>__app.load(x)", proj(st)); a = await p.shot(2, 1, 4.0)
            await p.ev("x=>__app.load(x)", bi(st)); bb = await p.shot(2, 1, 4.0, OUT / "lyrics" / f"{st}_gentle_bi.png")
            await p.ev("x=>__app.load(x)", bi(st, True)); c = await p.shot(2, 1, 4.0, OUT / "lyrics" / f"{st}_gentle_swap.png")
            f2 = await p.shot(1, 1, 4.0)
            rec(f"{st}：雙語會多一行小字、大小對調畫面不同、flashy 雙語可畫", diff(a, bb) > 2000 and diff(bb, c) > 2000 and f2.getbbox(), f"{diff(a, bb)} / {diff(bb, c)}")
        pj = await p.ev("__app.project")
        rec("設定保留 lyrics2、swapLang", pj["sections"][2]["lyrics2"].startswith("Sample") and pj["sections"][2]["swapLang"] is True)
        bad = await p.ev("x=>__app.load(x)", {**proj("swiss"), "sections": [{"name": "A", "background": "calm", "lyrics2": 3}]})
        rec("lyrics2 不是文字 → 擋下並說明", not bad and "lyrics2" in await p.ev("__app.status()"))
        p2 = bi("swiss"); p2["sections"][2]["lyrics2"] = "Sample line one\nSample line two\n\nSample line three"
        await p.ev("x=>__app.load(x)", p2); await p.ev("__app.select(2,0)")
        rec("第二語言行數不同不報錯：多出來的照樣做成一支", "2 支" in await p.pg.inner_text("#clipCount") or "共 3 支" in await p.pg.inner_text("#clipCount"), await p.pg.inner_text("#clipCount"))

        await p.ev("__app.clearSuspects()")
        for st in STYLES[5:]:
            code = await p.ev(f"[...document.querySelectorAll('script.wm-scene')].find(s=>s.dataset.id==='{st}').textContent")
            ok = await p.ev("c=>__app.pasteScene(c)", code.replace(f"id: '{st}'", f"id: '{st}x'"))
            info = await p.ev("__app.sceneInfo()")
            rec(f"內建「{st}」通過新風格試跑（防護）", ok and info["id"] == st + "x" and (not code.count("shader:") or info["shader"]), (await p.ev("__app.sceneStatus()"))[:80] + f"｜{info}")
            if info.get("shader"): rec(f"「{st}」shader 測速", True, f"估計一格 {info['est']:.0f} ms（SwiftShader）、{'半解析度' if info['half'] else '全解析度'}")
            await p.ev("x=>__app.load(x)", proj(st + "x"))
            a0 = await p.shot(0, 0, 0.0); a1 = await p.shot(0, 0, 16.0); an = await p.shot(0, 0, 1 / 30)
            rec(f"「{st}」背景 16 秒頭尾接得起來（和相鄰一格的差差不多）", diff(a0, a1) <= 1.5 * diff(a0, an) + 20000, f"0↔16 秒 {diff(a0, a1)}、0↔1 格 {diff(a0, an)}")

        got = {h: await p.ev("h=>__app.headerOf(h)", h) for h in HEADERS}
        okh = all(got[h] and got[h]["kind"] == k and (n is None or got[h]["n"] == n) for h, (k, n) in HEADERS.items())
        rec("段落標題：方括號、角括號、冒號、全形、中文、拼錯（chrous）都認得", okh, {h: got[h] for h in HEADERS if not (got[h] and got[h]["kind"] == HEADERS[h][0])})
        nh = [await p.ev("h=>__app.headerOf(h)", h) for h in NOT_HEAD]
        rec("一般歌詞行不會被當成標題", not any(nh), nh)
        await p.ev("x=>__app.load(x)", {"format": "worship-motion/1", "title": "貼上", "style": "swiss", "sections": [
            {"name": "主歌一", "background": "calm", "subtitle": "gentle"}, {"name": "導歌", "background": "build", "subtitle": "flashy", "clipSeconds": 8}, {"name": "副歌", "background": "peak", "subtitle": "gentle"}]})
        pl = await p.ev("t=>__app.planSplit(t)", WHOLE)
        names = [(e["name"], e["isNew"]) for e in pl["plan"]]
        rec("有標題：對上同名段落、重複的副歌略過、對不上的（橋段）新增", names == [("主歌一", False), ("導歌", False), ("副歌", False), ("橋段一", True)] or names == [("主歌一", False), ("導歌", False), ("副歌", False), ("橋段", True)], names)
        rec("版權行（詞、曲、©、CCLI）被拿掉", len(pl["removed"]) == 3 and not any("示意作者" in (e["lyrics"] or "") for e in pl["plan"]), pl["removed"])
        pj = await p.ev("t=>__app.applySplitText(t)", WHOLE)
        sec = {s["name"]: s for s in pj["sections"]}
        rec("套用後：歌詞放進各段、新增段落放在後面、設定沿用同類（新段落有字幕）", sec["主歌一"]["lyrics"].startswith("這是第一行") and "第三行" in sec["導歌"]["lyrics"] and any(n.startswith("橋段") for n in sec) and pj["sections"][-1]["subtitle"] != "none", [s["name"] for s in pj["sections"]])
        await p.ev("x=>__app.load(x)", {"format": "worship-motion/1", "title": "無標題", "style": "swiss", "sections": [{"name": "A", "background": "calm", "subtitle": "gentle"}, {"name": "B", "background": "peak", "subtitle": "gentle"}]})
        pl = await p.ev("t=>__app.planSplit(t)", NOHEAD)
        rec("沒有標題：依空行分段、依序填，多的新增", pl["mode"] == "blocks" and [e["isNew"] for e in pl["plan"]] == [False, False, True], [(e["name"], e["isNew"]) for e in pl["plan"]])
        await p.ev("x=>__app.load(x)", {"format": "worship-motion/1", "title": "雙語", "style": "swiss", "sections": [{"name": "主歌一（中）", "background": "calm", "subtitle": "gentle"}, {"name": "主歌一（英）", "background": "calm", "subtitle": "gentle", "swapLang": True}, {"name": "副歌", "background": "peak", "subtitle": "gentle"}]})
        r = {}
        for lang in ["zh", "en", "both", "bothEn"]: r[lang] = await p.ev("([t,l])=>__app.planSplit(t,{lang:l})", [BILING, lang])
        rec("偵測到中英交錯", r["both"]["bilingual"])
        e0 = {k: (v["plan"][0]["lyrics"], v["plan"][0]["lyrics2"]) for k, v in r.items()}
        rec("只留中文／只留英文", "Sample" not in e0["zh"][0] and not e0["zh"][1] and e0["en"][0].startswith("Sample") and "這是" not in e0["en"][0], e0)
        rec("中文主要＋英文第二語言／英文主要＋中文第二語言", e0["both"][0].startswith("這是") and e0["both"][1].startswith("Sample") and e0["bothEn"][0].startswith("Sample") and e0["bothEn"][1].startswith("這是"), e0)
        rec("「主歌一（中）」「主歌一（英）」都對上 [Verse 1]", r["both"]["plan"][0]["targets"] == [0, 1], r["both"]["plan"][0]["targets"])
        await p.ev("__app.tab('self')"); await p.pg.click("#lyrOpen"); await p.pg.fill("#lyrAll", BILING); await p.pg.click("#lyrSplit")
        d = await p.ev("__app.lyricsDialog()")
        rec("「分到各段」→ 頁內對話框預覽、有中英三種以上選項", d["open"] and await p.pg.is_visible("#lyrLangRow") and await p.pg.locator("input[name=lyrLang]").count() == 4, d["text"][:100])
        await p.pg.click("#lyrApply"); pj = await p.ev("__app.project")
        rec("套用：中文進歌詞、英文進第二語言", pj["sections"][0]["lyrics"].startswith("這是") and pj["sections"][0]["lyrics2"].startswith("Sample") and pj["sections"][1]["lyrics2"].startswith("Sample"))
        rec("「請 AI 改」貼上框旁有「貼上整首歌詞」入口", await p.pg.locator("#lyrFromAI").count() == 1)

        tt = await p.ev("__app.toTrad('头发 简体中文 后来 干净 里面 这里')")
        rec("簡轉繁：詞組優先（头发→頭髮、干净→乾淨）、台灣字形（里→裡）", tt == "頭髮 簡體中文 後來 乾淨 裡面 這裡", tt)
        await p.ev("__app.select(0,0)"); await p.pg.fill("#sLyrics", "这是第一行示意文字"); await p.pg.fill("#sLyrics2", "Sample line one")
        await p.pg.click("#s2tBtn"); msg = await p.pg.inner_text("#lyrMsg")
        rec("「轉成繁體」按鈕：作用在該段兩個框、提示檢查一字多義", (await p.ev("__app.project"))["sections"][0]["lyrics"] == "這是第一行示意文字" and "一字多義" in msg, msg)
        await p.ev("__app.tab('self')"); await p.pg.click("#lyrOpen"); await p.pg.fill("#lyrAll", "[Verse 1]\n这是第一行示意文字"); await p.pg.click("#lyrSplit"); await p.pg.check("#lyrTrad")
        rec("整首貼上對話框也有「轉成繁體」勾選框", await p.pg.is_visible("#lyrDlg #lyrTrad") and await p.pg.is_checked("#lyrTrad"))
        await p.pg.click("#lyrApply"); rec("整首貼上勾轉繁體 → 歌詞是繁體", (await p.ev("__app.project"))["sections"][0]["lyrics"].startswith("這是"))
        s2t = (ROOT / "src" / "engine" / "s2t.txt").stat().st_size
        rec("簡轉繁對照表 ≤ 40 KB", s2t <= 40 * 1024, f"{s2t/1024:.1f} KB")

        WAVES = (ROOT / "examples" / "waves.js").read_text()
        def sec(name, bg, sub="gentle", **kw): return {"name": name, "background": bg, "subtitle": sub, "lyrics": "", "lyrics2": "", **kw}
        def song(title, style, bpm, secs): return {"format": "worship-motion/1", "title": title, "style": style, "bpm": bpm, "sections": secs}
        zhen = []
        for base, bg in [("主歌一", "calm"), ("副歌", "peak"), ("主歌二", "calm"), ("橋段", "build")]: zhen += [sec(f"{base}（中）", bg), sec(f"{base}（英）", bg, swapLang=True)]
        four = [song("示意歌一", "type", 120, [sec("主歌", "calm"), sec("導歌", "build", "flashy"), sec("副歌", "peak"), sec("橋段", "build")]),
                song("示意歌二", "waves", 104, [sec("主歌", "storm"), sec("副歌", "peak", "flashy")]),
                song("示意歌三", "nave", 72, [sec(n, bg, jumpBeats=8) for n, bg in [("主歌一", "calm"), ("副歌一", "build"), ("主歌二", "calm"), ("副歌二", "peak")]]),
                song("示意歌四", "sky", 72, zhen)]
        keys = ["name", "background", "subtitle", "lyrics", "lyrics2", "swapLang", "jumpBeats"]
        for sg in four:
            text = ("```js\n" + WAVES + "\n```\n" if sg["style"] == "waves" else "") + "```json\n" + json.dumps(sg, ensure_ascii=False) + "\n```"
            ok = await p.ev("t=>__app.importText(t)", text); pj = await p.ev("__app.project"); clips = await p.pg.inner_text("#clips")
            same = len(pj["sections"]) == len(sg["sections"]) and all(pj["sections"][i].get(k) == v for i, x in enumerate(sg["sections"]) for k, v in x.items())
            rec(f"打開「{sg['title']}」設定檔：設定正確、沒有歌詞、看得到「貼上整首歌詞」提示", ok and pj["title"] == sg["title"] and pj["style"] == sg["style"] and pj["bpm"] == sg["bpm"] and same and "貼上整首歌詞（自己調 → 貼上整首歌詞）" in clips,
                f"{pj['title']} {pj['style']} {pj['bpm']} {[s['name'] for s in pj['sections']]}")
        sgs = (await p.ev("__app.songs()"))[-4:]
        rec("四首各成一個分頁、風格正確", [(s["title"], s["style"] if not s["custom"] else s["custom"]) for s in sgs] == [(x["title"], x["style"]) for x in four], [(s["title"], s["style"], s["custom"]) for s in sgs])
        rec("沒有頁面錯誤", not [l for l in p.log if "pageerror" in l], p.log[:3])
        await b.close()
asyncio.run(main()); finish()
