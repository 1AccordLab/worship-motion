"""還原／重做與歷史紀錄的無頭測試：python3 tests/test_history.py
各種動作可還原與重做、連續輸入合併成一步、跨重新整理保留、歷史面板回到某狀態（之後還能還原）、
關閉分頁從「最近關閉」叫回、做新的一首可還原、快捷鍵在文字框內外的行為、按鈕說明。全部用示意文字。"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
OUT = OUT / "history"; OUT.mkdir(parents=True, exist_ok=True)
MIN = (ROOT / "examples" / "minimal.js").read_text()
async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw); pg = p.pg
        await pg.set_viewport_size({"width": 1440, "height": 900})
        pj = lambda: p.ev("__app.project")
        async def U(): await p.ev("__app.undo()")
        async def R(): await p.ev("__app.redo()")
        await p.ev("x=>__app.load(x)", proj("swiss", title="示意歌"))
        await p.ev("__app.tab('self')")
        # 連續打字合併
        await pg.click("#title")
        for ch in "示意歌改": await pg.keyboard.press("End"); await pg.keyboard.type(ch)
        h = await p.ev("__app.history()")
        rec("連續打字（改歌名）合併成一步", h["labels"][-1] == "改歌名" and h["labels"].count("改歌名") == 1, h["labels"])
        # 快捷鍵：文字框內 → 瀏覽器原生；文字框外 → 編輯器還原
        n0 = (await p.ev("__app.history()"))["pos"]
        await pg.keyboard.press("Control+z"); await pg.wait_for_timeout(300)   # 要確認「沒有發生」，只能等一小段
        rec("游標在文字框裡按 Ctrl+Z：不走編輯器還原（瀏覽器自己的文字還原）", (await p.ev("__app.history()"))["pos"] == n0)
        await pg.click("#secCard h2"); await pg.keyboard.press("Control+z"); await p.wait(f"__app.history().pos === {n0 - 1}")
        rec("離開文字框按 Ctrl+Z：編輯器還原（歌名回去）", (await pj())["title"] == "示意歌", (await pj())["title"])
        await pg.keyboard.press("Control+Shift+z"); await p.wait(f"__app.history().pos === {n0}")
        rec("Ctrl+Shift+Z 重做", (await pj())["title"].startswith("示意歌") and (await pj())["title"] != "示意歌", (await pj())["title"])
        # 各動作可還原／重做
        async def act(label, js, check):
            before = await pj(); await p.ev(js); await p.wait(f"JSON.stringify(__app.project)!=={json.dumps(json.dumps(before))}"); after = await pj()
            info = await p.ev("__app.undoInfo()"); await U(); u = await pj(); await R(); r = await pj()
            rec(f"{label}：可還原、可重做", check(before, after) and u == before and r == after, info["undo"])
        await act("換背景", "document.querySelector('#sBg button:nth-child(3)').click()", lambda a, b: a["sections"][0]["background"] != b["sections"][0]["background"])
        await act("色塊換位", "document.querySelector('#sJump button:nth-child(4)').click()", lambda a, b: a["sections"][0]["jumpBeats"] != b["sections"][0]["jumpBeats"])
        await act("新增段落", "__app.addSection()", lambda a, b: len(b["sections"]) == len(a["sections"]) + 1)
        await act("刪除段落", "__app.removeSection(1)", lambda a, b: len(b["sections"]) == len(a["sections"]) - 1)
        await act("段落排序", "document.querySelector('#secList button[aria-label^=\"把「副歌」往上移\"]').click()", lambda a, b: b["sections"][0]["name"] == "副歌")
        await act("配色", "(()=>{const i=document.querySelector('#swatches input');i.value='#225588';i.dispatchEvent(new Event('input'))})()", lambda a, b: b["palette"] != a["palette"])
        await act("換風格", "(async()=>{const s=document.querySelector('#style');s.value='paper';await s.onchange()})()", lambda a, b: b["style"] == "paper")
        await p.ev("(()=>{const t=document.querySelector('#sLyrics');t.value='这是第一行示意文字';t.dispatchEvent(new Event('input'))})()"); await p.wait("__app.project.sections[0].lyrics==='这是第一行示意文字'")
        await act("簡轉繁", "document.querySelector('#s2tBtn').click()", lambda a, b: b["sections"][0]["lyrics"] == "這是第一行示意文字")
        await act("貼上整首歌詞", "__app.applySplitText('[Verse 1]\\n這是第一行示意文字\\n\\n[Chorus]\\n這是第二行示意文字')", lambda a, b: "第二行" in json.dumps(b, ensure_ascii=False))
        await act("套用 AI 的回覆", "__app.paste('```json\\n" + json.dumps(proj("swiss", title=(await pj())["title"], bpm=90), ensure_ascii=False).replace("\\", "\\\\").replace("'", "\\'") + "\\n```')", lambda a, b: b["bpm"] == 90)
        await act("換成另一首歌", "__app.load(" + json.dumps(proj("riso", title="另一首示意歌"), ensure_ascii=False) + ")", lambda a, b: b["title"] == "另一首示意歌")
        await act("套用新風格（程式）", "__app.pasteScene(" + json.dumps(MIN) + ")", lambda a, b: b["style"] == "bars")
        lab = await p.ev("__app.undoInfo()")
        rec("還原按鈕的說明寫出動作名稱", (await pg.get_attribute("#undoBtn", "title")).startswith("還原：") and lab["undo"] in await pg.get_attribute("#undoBtn", "title"), await pg.get_attribute("#undoBtn", "title"))
        # 連續拖滑桿合併
        await p.ev("x=>__app.load(x)", proj("swiss", title="示意歌"))
        k0 = len((await p.ev("__app.history()"))["labels"])
        for v in [60, 70, 80, 90]: await pg.fill("#sEnter", "1." + str(v // 10 - 5)) if False else await p.ev(f"(()=>{{const s=document.querySelector('#sEnter');s.value={v/100+0.5};s.dispatchEvent(new Event('input'))}})()")
        h = await p.ev("__app.history()")
        rec("連續拖滑桿（進場速度）合併成一步", len(h["labels"]) == k0 + 1, h["labels"][-3:])
        # 歷史面板
        await pg.click("#tab-adv")
        rows = await pg.locator("#histList .hrow").count()
        rec("歷史紀錄面板列出時間＋動作", rows >= 10 and "只保留最近 50 步" in await pg.inner_text("#histNote"), (await pg.inner_text("#histList")).split("\n")[:4])
        target = await p.ev("__app.history().labels.indexOf('換成另一首歌「示意歌」')")
        await pg.click(f"#histList .hrow[data-k='{target}']")
        prev = await pg.inner_text("#histPrevT")
        await pg.screenshot(path=str(OUT / "歷史紀錄面板.png"))
        await pg.click("#histGo"); await p.wait("__app.history().labels.at(-1).startsWith('回到 ')")
        h2 = await p.ev("__app.history()")
        rec("點一列 → 預覽差異 →「回到這個狀態」（新增一個紀錄點）", "和現在比" in prev or "就是現在" in prev, prev[:80])
        rec("回到之後還能「還原」", h2["labels"][-1].startswith("回到 ") and (await p.ev("__app.undoInfo()"))["undo"].startswith("回到"), h2["labels"][-1])
        # 跨重新整理
        await p.ev("__app.flushHist()"); hb = await p.ev("__app.history()")
        await p.reload()
        ha = await p.ev("__app.history()")
        rec("重新整理後歷史還在（同一個位置）", ha == hb, f"{len(ha['labels'])} 步")
        await U(); rec("重新整理後仍可還原", (await p.ev("__app.history()"))["pos"] == hb["pos"] - 1)
        # 做新的一首、關閉分頁、最近關閉
        n = len(await p.ev("__app.songs()")); await p.ev("__app.newSong()")
        rec("做新的一首 → 還原會把新分頁收起來", (await p.ev("__app.undoInfo()"))["undo"] == "做新的一首")
        await U(); rec("（還原後）分頁數回到原本、新的那首放在「最近關閉」", len(await p.ev("__app.songs()")) == n and await p.ev("__app.closed()"), await p.ev("__app.closed()"))
        for t in ["示意甲", "示意乙", "示意丙", "示意丁", "示意戊", "示意己"]:
            await p.ev("__app.newSong()"); await p.ev("x=>__app.load(x)", proj("swiss", title=t))
        for i in range(6): await p.ev("__app.closeSong(__app.songs().length-1,{quiet:true})")
        cl = await p.ev("__app.closed()")
        rec("「最近關閉」保留最近 5 首", len(cl) == 5 and cl[0]["title"] == "示意甲", [c["title"] for c in cl])
        await pg.click("#closedBtn"); await pg.screenshot(path=str(OUT / "最近關閉選單.png"))
        await pg.click("#closedMenu button >> nth=2"); await p.wait("__app.songs().some(s=>s.title==='示意丙')")
        rec("從「最近關閉」叫回任一首", "示意丙" in [s["title"] for s in await p.ev("__app.songs()")] and len(await p.ev("__app.closed()")) == 4)
        m = len(await p.ev("__app.songs()"))
        await p.ev("()=>{window.__r=__app.closeSong(0)}"); await p.wait_dialog(); await p.ev("__app.answer('close')"); await p.ev("window.__r")
        rec("關閉分頁 → 還原會叫回來", (await p.ev("__app.undoInfo()"))["undo"].startswith("關閉"))
        await U(); rec("（還原後）分頁回來", len(await p.ev("__app.songs()")) == m)
        await p.ev("__app.flushHist()"); await p.reload()
        rec("重新整理後「最近關閉」還在", len(await p.ev("__app.closed()")) >= 4)
        # 每首歌各自一條歷史
        await p.ev("__app.switchSong(0)"); a = await p.ev("__app.history()"); await p.ev("__app.switchSong(1)"); bb = await p.ev("__app.history()")
        rec("每首歌各自一條歷史", a != bb, (len(a["labels"]), len(bb["labels"])))
        rec("沒有頁面錯誤", not [l for l in p.log if "pageerror" in l], p.log[:3])
        await b.close()
asyncio.run(main()); finish()
