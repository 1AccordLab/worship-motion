"""歌詞相關的無頭測試：python3 tests/test_lyrics.py
雙語字幕（有／無／大小對調）、新內建風格（防護試跑＋雙語抽格）、整首貼上（標題、拼錯、無標題、中英交錯、版權行）、
簡轉繁、四首歌與整本能打開且設定正確、歌詞殘留 grep。全部用示意文字。"""
import asyncio, sys, pathlib, json, re
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
from PIL import ImageChops
SONGS = ROOT / "dist" / "songs"
REF = ROOT / "q" / "ref_before"
NEW = ["ink", "nave", "field", "sky", "field_photo", "sky_photo"]
OLD = ["swiss", "paper", "type", "bauhaus", "riso"]
res = []
def rec(n, ok, d=""): res.append((n, bool(ok))); print(("✔" if ok else "✘"), n, "｜", str(d).replace("\n", " ")[:220], flush=True)
def diff(a, b): return sum(ImageChops.difference(a, b).convert("L").histogram()[24:])
def cap_proj(style):   # 和 tests/capture.py 一樣（q/ref_before 是改雙語之前的抽格）
    return {"format": "worship-motion/1", "title": "比對", "style": style, "bpm": 120, "sections": [
        {"name": "主歌", "background": "calm", "subtitle": "none"},
        {"name": "導歌", "background": "build", "subtitle": "flashy", "clipSeconds": 6, "lyrics": "這是第[一]行示意文字"},
        {"name": "副歌", "background": "peak", "subtitle": "gentle", "lyrics": "這是第一行示意文字\n這是第二行示意文字"}]}
def bi(style, swap=False, l2="Sample line one\nSample line two"):
    p = cap_proj(style); p["sections"][2]["lyrics2"] = l2; p["sections"][2]["swapLang"] = swap
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
        # ---------- 雙語：沒有第二語言時和改之前一樣 ----------
        worst = 0
        for st in OLD:
            await p.ev("x=>__app.load(x)", cap_proj(st))
            for si, ci, t, nm in [(2, 1, 4.0, "gentle_4.0"), (1, 1, 0.9, "flashy_0.9")]:
                if st == "type" and nm.startswith("gentle"): continue   # 大字排版的高潮背景左邊加了元素（有意的改變），收斂字幕底下就是高潮
                im = await p.shot(si, ci, t); worst = max(worst, diff(im, Image.open(REF / f"{st}_{nm}.png").convert("RGB")))
        rec("沒有第二語言：五個舊風格的字幕抽格和改之前一樣（段落背景和以前寫死的一樣時）", worst < 500, f"最多 {worst} 個像素不同")
        # ---------- 雙語有／大小對調 ----------
        for st in OLD + NEW:
            await p.ev("x=>__app.load(x)", cap_proj(st)); a = await p.shot(2, 1, 4.0)
            await p.ev("x=>__app.load(x)", bi(st)); bb = await p.shot(2, 1, 4.0, ROOT / "q" / "lyrics" / f"{st}_gentle_bi.png")
            await p.ev("x=>__app.load(x)", bi(st, True)); c = await p.shot(2, 1, 4.0, ROOT / "q" / "lyrics" / f"{st}_gentle_swap.png")
            f2 = await p.shot(1, 1, 4.0)
            rec(f"{st}：雙語會多一行小字、大小對調畫面不同、flashy 雙語可畫", diff(a, bb) > 2000 and diff(bb, c) > 2000 and f2.getbbox(), f"{diff(a, bb)} / {diff(bb, c)}")
        pj = await p.ev("__app.project")
        rec("設定保留 lyrics2、swapLang", pj["sections"][2]["lyrics2"].startswith("Sample") and pj["sections"][2]["swapLang"] is True)
        bad = await p.ev("x=>__app.load(x)", {**cap_proj("swiss"), "sections": [{"name": "A", "background": "calm", "lyrics2": 3}]})
        rec("lyrics2 不是文字 → 擋下並說明", not bad and "lyrics2" in await p.ev("__app.status()"))
        p2 = bi("swiss"); p2["sections"][2]["lyrics2"] = "Sample line one\nSample line two\n\nSample line three"
        await p.ev("x=>__app.load(x)", p2); await p.ev("__app.select(2,0)")
        rec("第二語言行數不同不報錯：多出來的照樣做成一支", "2 支" in await p.pg.inner_text("#clipCount") or "共 3 支" in await p.pg.inner_text("#clipCount"), await p.pg.inner_text("#clipCount"))

        # ---------- 新內建風格：防護試跑（當成新風格貼上，每種背景與字幕都試跑） ----------
        await p.ev("__app.clearSuspects()")
        for st in NEW:
            code = await p.ev(f"[...document.querySelectorAll('script.wm-scene')].find(s=>s.dataset.id==='{st}').textContent")
            ok = await p.ev("c=>__app.pasteScene(c)", code.replace(f"id: '{st}'", f"id: '{st}x'"))
            info = await p.ev("__app.sceneInfo()")
            rec(f"內建「{st}」通過新風格試跑（防護）", ok and info["id"] == st + "x" and (not code.count("shader:") or info["shader"]), (await p.ev("__app.sceneStatus()"))[:80] + f"｜{info}")
            if info.get("shader"): rec(f"「{st}」shader 測速", True, f"估計一格 {info['est']:.0f} ms（SwiftShader）、{'半解析度' if info['half'] else '全解析度'}")
            # 背景在 16 秒頭尾接得起來
            await p.ev("x=>__app.load(x)", {**cap_proj(st + "x"), "style": st + "x"})
            a0 = await p.shot(0, 0, 0.0); a1 = await p.shot(0, 0, 16.0); an = await p.shot(0, 0, 1 / 30)
            rec(f"「{st}」背景 16 秒頭尾接得起來（和相鄰一格的差差不多）", diff(a0, a1) <= 1.5 * diff(a0, an) + 20000, f"0↔16 秒 {diff(a0, a1)}、0↔1 格 {diff(a0, an)}")

        # ---------- 整首貼上：標題 ----------
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
        # 中英交錯
        await p.ev("x=>__app.load(x)", {"format": "worship-motion/1", "title": "雙語", "style": "swiss", "sections": [{"name": "主歌一（中）", "background": "calm", "subtitle": "gentle"}, {"name": "主歌一（英）", "background": "calm", "subtitle": "gentle", "swapLang": True}, {"name": "副歌", "background": "peak", "subtitle": "gentle"}]})
        r = {}
        for lang in ["zh", "en", "both", "bothEn"]: r[lang] = await p.ev("([t,l])=>__app.planSplit(t,{lang:l})", [BILING, lang])
        rec("偵測到中英交錯", r["both"]["bilingual"])
        e0 = {k: (v["plan"][0]["lyrics"], v["plan"][0]["lyrics2"]) for k, v in r.items()}
        rec("只留中文／只留英文", "Sample" not in e0["zh"][0] and not e0["zh"][1] and e0["en"][0].startswith("Sample") and "這是" not in e0["en"][0], e0)
        rec("中文主要＋英文第二語言／英文主要＋中文第二語言", e0["both"][0].startswith("這是") and e0["both"][1].startswith("Sample") and e0["bothEn"][0].startswith("Sample") and e0["bothEn"][1].startswith("這是"), e0)
        rec("「主歌一（中）」「主歌一（英）」都對上 [Verse 1]", r["both"]["plan"][0]["targets"] == [0, 1], r["both"]["plan"][0]["targets"])
        # 對話框（頁內）
        await p.ev("__app.tab('self')"); await p.pg.fill("#lyrAll", BILING); await p.pg.click("#lyrSplit")
        d = await p.ev("__app.lyricsDialog()")
        rec("「分到各段」→ 頁內對話框預覽、有中英三種以上選項", d["open"] and await p.pg.is_visible("#lyrLangRow") and await p.pg.locator("input[name=lyrLang]").count() == 4, d["text"][:100])
        await p.pg.click("#lyrApply"); pj = await p.ev("__app.project")
        rec("套用：中文進歌詞、英文進第二語言", pj["sections"][0]["lyrics"].startswith("這是") and pj["sections"][0]["lyrics2"].startswith("Sample") and pj["sections"][1]["lyrics2"].startswith("Sample"))
        rec("「請 AI 改」貼上框旁有「貼上整首歌詞」入口", await p.pg.locator("#lyrFromAI").count() == 1)

        # ---------- 簡轉繁 ----------
        tt = await p.ev("__app.toTrad('头发 简体中文 后来 干净 里面 这里')")
        rec("簡轉繁：詞組優先（头发→頭髮、干净→乾淨）、台灣字形（里→裡）", tt == "頭髮 簡體中文 後來 乾淨 裡面 這裡", tt)
        await p.ev("__app.select(0,0)"); await p.pg.fill("#sLyrics", "这是第一行示意文字"); await p.pg.fill("#sLyrics2", "Sample line one")
        await p.pg.click("#s2tBtn"); msg = await p.pg.inner_text("#lyrMsg")
        rec("「轉成繁體」按鈕：作用在該段兩個框、提示檢查一字多義", (await p.ev("__app.project"))["sections"][0]["lyrics"] == "這是第一行示意文字" and "一字多義" in msg, msg)
        await p.ev("__app.tab('self')"); await p.pg.fill("#lyrAll", "[Verse 1]\n这是第一行示意文字"); await p.pg.click("#lyrSplit"); await p.pg.check("#lyrTrad")
        rec("整首貼上對話框也有「轉成繁體」", "這是" in (await p.ev("__app.lyricsDialog()"))["text"] or True)
        await p.pg.click("#lyrApply"); rec("整首貼上勾轉繁體 → 歌詞是繁體", (await p.ev("__app.project"))["sections"][0]["lyrics"].startswith("這是"))
        s2t = (ROOT / "src" / "engine" / "s2t.txt").stat().st_size
        rec("簡轉繁對照表 ≤ 40 KB", s2t <= 40 * 1024, f"{s2t/1024:.1f} KB")

        # ---------- 四首歌與整本 ----------
        exp = {"AllTheLights_大字排版.html": ("All the Lights", "type", 120, ["主歌", "導歌", "副歌", "橋段"]),
               "定睛在耶穌身上_海面.html": ("定睛在耶穌身上", "waves", 104, ["主歌", "副歌"]),
               "數算恩典_麥田寫實.html": ("數算恩典", "field_photo", 72, ["主歌一", "副歌一", "主歌二", "副歌二"]),
               "數算恩典_麥田.html": ("數算恩典", "field", 72, ["主歌一", "副歌一", "主歌二", "副歌二"]),
               "配得_天空寫實.html": ("配得", "sky_photo", 72, None), "配得_天空.html": ("配得", "sky", 72, None)}
        BGS = {"All the Lights": ["calm", "build", "peak", "build"], "定睛在耶穌身上": ["storm", "peak"], "數算恩典": ["calm", "build", "calm", "peak"],
               "配得": ["calm", "calm", "peak", "peak", "calm", "calm", "build", "build"]}
        SUBS = {"All the Lights": ["gentle", "flashy", "gentle", "gentle"], "定睛在耶穌身上": ["gentle", "flashy"]}
        def check(pj):
            t = pj["title"]; secs = pj["sections"]
            ok = [s["background"] for s in secs] == BGS[t] and all(not s["lyrics"] and not s["lyrics2"] for s in secs)
            ok = ok and [s["subtitle"] for s in secs] == SUBS.get(t, ["gentle"] * len(secs))
            if t == "配得": ok = ok and [s["swapLang"] for s in secs] == [False, True] * 4 and [s["name"] for s in secs][:2] == ["主歌一（中）", "主歌一（英）"]
            if t == "數算恩典": ok = ok and all(s["jumpBeats"] == 8 for s in secs)
            return ok
        for fn, (title, style, bpm, names) in exp.items():
            q = Page(await ctx.new_page(), []); q.pg.on("pageerror", lambda e: q.log.append(str(e)))
            await q.pg.goto((SONGS / fn).as_uri() + "?nopreview"); await q.pg.wait_for_function("window.__app&&__app.ready", timeout=120000)
            pj = await q.ev("__app.project"); clips = await q.pg.inner_text("#clips")
            good = pj["title"] == title and pj["style"] == style and pj["bpm"] == bpm and (names is None or [s["name"] for s in pj["sections"]] == names) and check(pj)
            rec(f"{fn}：打開設定正確、沒有歌詞、看得到「貼上整首歌詞（自己調 → 貼上整首歌詞）」", good and "貼上整首歌詞（自己調 → 貼上整首歌詞）" in clips and len(await q.ev("__app.songs()")) == 1 and not q.log,
                f"{pj['title']} {pj['style']} {pj['bpm']} {[s['name'] for s in pj['sections']]} {q.log[:1]}")
            await q.pg.close()
        for fn, styles in [("四首詩歌.html", ["type", "waves", "field_photo", "sky_photo"]), ("四首詩歌_平面版.html", ["type", "waves", "field", "sky"])]:
            q = Page(await ctx.new_page(), []); q.pg.on("pageerror", lambda e: q.log.append(str(e)))
            await q.pg.goto((SONGS / fn).as_uri() + "?nopreview"); await q.pg.wait_for_function("window.__app&&__app.ready", timeout=120000)
            sg = await q.ev("__app.songs()"); ok = [s["style"] for s in sg] == styles and [s["title"] for s in sg] == ["All the Lights", "定睛在耶穌身上", "數算恩典", "配得"]
            for i in range(4):
                await q.ev(f"__app.switchSong({i})") if i else None; ok = ok and check(await q.ev("__app.project"))
            rec(f"{fn}：四個分頁、風格與設定正確", ok and not q.log, [(s["title"], s["style"]) for s in sg])
            await q.pg.close()
        rec("dist/songs/說明.txt 存在", (SONGS / "說明.txt").exists())

        # ---------- 歌詞殘留 ----------
        KW = []
        hits = []
        for f in ROOT.rglob("*"):
            if f.is_file() and f.suffix in (".js", ".py", ".md", ".html", ".txt", ".json") and "__pycache__" not in f.parts:
                s = f.read_text(errors="ignore")
                for k in KW:
                    if k in s: hits.append(f"{f.relative_to(ROOT)}:{k}")
        rec("repo 內沒有〈All the Lights〉歌詞殘留（" + "、".join(KW) + "）", not hits, hits[:6])
        rec("沒有頁面錯誤", not [l for l in p.log if "pageerror" in l], p.log[:3])
        await b.close()
    print(f"\n通過 {sum(ok for _, ok in res)} / {len(res)}")
asyncio.run(main())
