"""一首歌自己的風格程式（AI 新風格、內建風格的改動）：python3 tests/test_customs.py（示意文字）
驗收條件：
K1 這首歌有 AI 新風格時，換到內建風格再貼改動：新風格還在風格清單、換得回去；內建風格的改動也留著。
K2 一首歌可以有好幾個 AI 新風格：都在風格清單，顯示風格的名稱；同一個 id 再貼一次是換掉那一個。
K3 每個風格各自記得自己的改動，換來換去都還在；拿掉內建風格的全部改動不影響別的風格。
K4 還原／重做、重新載入、存成單檔再打開之後都一樣。
K5 只有一個自訂程式的資料（暫存、整本的 JSON）照樣讀得進來。
K6 有好幾份風格程式的歌存檔後，改一下再還原：仍顯示已存成檔案，風格清單的順序不變。
K7 預設風格自己那一份改動因為卡住被暫停使用時，重新載入後編輯器照樣開得起來（先用內建的樣子），可以繼續操作；畫面上有提示說明並可以「仍要試跑」；從別的風格換回來也是先用內建的樣子加提示。
K8 風格的提示跟著那首歌：同一首歌改一下再還原，提示還在；換到別首歌，上一首的提示與按鈕不在畫面上，換回來又出現。被暫停的是預設以外的內建風格那一份時，墊底用的是同一個風格的內建樣子，還原、重新載入後風格不會變成別的。"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *

MIN = (ROOT / "examples" / "minimal.js").read_text()
PARTS = (ROOT / "examples" / "elements.js").read_text()
def star(label): return "```js\npatchScene({ label: '" + label + "', elements: { star: { label: '星星', draw(f, x, e) { f.add(circle(1500, 240, 60, '#e8d9a8')); } } } });\n```"

async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)
        pg = p.pg
        async def styles(q=p): return dict(await q.ev("[...document.querySelectorAll('#style option')].map(o=>[o.value,o.textContent])"))
        async def customs(q=p): return sorted([x for x in await q.ev("__app.songs()") if x["active"]][0]["customs"])
        async def labels(q=p): return [x["label"] for x in await q.ev("__app.patches()")]
        async def ids(q=p): return [e["id"] for e in await q.ev("__app.elements()")]
        async def paste(text): ok = await p.ev("t=>__app.paste(t)", text); return ok, await p.ev("__app.status()")
        async def use(sid, q=p): await q.ev("__app.tab('self')"); await q.pg.select_option("#style", sid); await q.wait(f"__app.project.style==='{sid}'&&__app.sceneInfo().id==='{sid}'")
        async def safe(name, fn):
            try: await fn()
            except Exception as e: rec(name, False, "例外：" + str(e).split("\n")[0][:200])

        async def k1():
            assert await p.ev("x=>__app.load(x)", proj("riso")); assert await p.ev("c=>__app.pasteScene(c)", MIN)
            await use("riso"); ok, st = await paste(star("加星星")); s = await styles()
            rec("K1 有 AI 新風格「色帶」的歌，換到網點印刷貼改動：兩個都留著，風格清單還有色帶", ok and await customs() == ["bars", "riso"] and s.get("bars") == "AI 新風格：色帶" and await labels() == ["加星星"], (st[:40], await customs(), s.get("bars")))
            await use("bars"); a = (await labels(), await ids()); await use("riso"); await p.ev("__app.select(2,0)")
            rec("K1 換到色帶再換回網點印刷：色帶沒有那個改動，網點印刷的星星還在", a[0] == [] and "star" not in a[1] and await labels() == ["加星星"] and "star" in await ids(), (a, await labels()))
        await safe("K1 新風格與內建風格的改動並存", k1)

        async def k2():
            assert await p.ev("c=>__app.pasteScene(c)", PARTS); s = await styles()
            rec("K2 再貼一個 AI 新風格「色帶與圓」：兩個新風格都在風格清單", await customs() == ["bars", "parts", "riso"] and s.get("bars") == "AI 新風格：色帶" and s.get("parts") == "AI 新風格：色帶與圓", (await customs(), s))
            assert await p.ev("c=>__app.pasteScene(c)", MIN.replace("name: '色帶'", "name: '色帶二'")); s = await styles()
            rec("K2 同一個 id 再貼一次：換掉那一個，數量不變", await customs() == ["bars", "parts", "riso"] and s.get("bars") == "AI 新風格：色帶二" and (await p.ev("__app.sceneInfo()"))["name"] == "色帶二", (await customs(), s.get("bars")))
        await safe("K2 好幾個新風格", k2)

        async def k3():
            ok, st = await paste(star("色帶加星星")); await use("riso"); a = await labels(); await use("bars"); c = await labels(); await use("parts"); d = await labels()
            rec("K3 色帶、網點印刷各自記得自己的改動，色帶與圓沒有", ok and a == ["加星星"] and c == ["色帶加星星"] and d == [], (a, c, d))
            await use("riso"); done = await p.ev("__app.removePatch(0)"); e = (await labels(), await customs()); await use("bars")
            rec("K3 拿掉網點印刷的全部改動：回到內建的樣子，色帶的改動不受影響", done and e == ([], ["bars", "parts"]) and await labels() == ["色帶加星星"], (e, await labels()))
        await safe("K3 各自的改動", k3)

        async def k4():
            await use("riso"); await paste(star("加星星")); had = await customs(); await p.ev("__app.undo()"); a = (await customs(), await labels()); await p.ev("__app.redo()")
            rec("K4 還原貼上的改動：網點印刷回到內建，新風格都還在；重做又回來", had == ["bars", "parts", "riso"] and a == (["bars", "parts"], []) and await customs() == had and await labels() == ["加星星"], (a, await customs(), await labels()))
            await p.ev("__app.flushHist()"); await p.reload(); s = await styles(); a = (await customs(), await labels()); await use("bars")
            rec("K4 重新載入：三份都在，各自的改動都在", a == (had, ["加星星"]) and s.get("parts") == "AI 新風格：色帶與圓" and await labels() == ["色帶加星星"], (a, s.get("parts"), await labels()))
            one = OUT / "customs_one.html"; one.parent.mkdir(parents=True, exist_ok=True); one.write_text(await p.ev("__app.singleHTML('one')")); q = await open_url(ctx, one.as_uri())
            a = (await customs(q), (await q.ev("__app.sceneInfo()"))["id"], await labels(q)); await use("riso", q); r = await labels(q); await use("parts", q)
            rec("K4 存成單檔再打開：三份都在、換得過去、顯示已存檔", a == (had, "bars", ["色帶加星星"]) and r == ["加星星"] and (await q.ev("__app.sceneInfo()"))["id"] == "parts" and not q.log, (a, r, q.log[:2]))
            await q.pg.close()
        await safe("K4 還原、重新載入、單檔", k4)

        async def k5():
            book = {"format": "worship-motion-book/1", "active": 0, "songs": [{"project": proj("bars", sections=[{"name": "主歌", "background": "calm", "subtitle": "none"}]), "scene": {"id": "bars", "code": MIN}}]}
            ok = await p.ev("t=>__app.importText(t)", json.dumps(book, ensure_ascii=False)); n = await p.ev("__app.songs().length"); await p.ev(f"__app.switchSong({n - 1})")
            rec("K5 只有一個自訂程式的整本 JSON：讀得進來，風格能用", ok and await customs() == ["bars"] and (await p.ev("__app.sceneInfo()"))["id"] == "bars", (ok, await customs()))
            await p.ev("__app.flushHist()")
            await p.ev("""(()=>{const k=Object.keys(localStorage).find(x=>x.endsWith(':book')),d=JSON.parse(localStorage.getItem(k));
              for(const s of d.songs){const c=(s.customs||[])[0];delete s.customs;s.custom=c?{id:c.id,code:c.code}:null;}
              localStorage.setItem(k,JSON.stringify(d));localStorage.removeItem(k.replace(':book',':hist'));})()""")
            await p.reload(); n = await p.ev("__app.songs().length"); await p.ev(f"__app.switchSong({n - 1})")
            rec("K5 暫存裡只有一個自訂程式的資料：重新載入後讀得進來，風格能用", await customs() == ["bars"] and (await p.ev("__app.sceneInfo()"))["id"] == "bars", await customs())
        await safe("K5 只有一個自訂程式的資料", k5)

        async def k6():
            await p.ev("__app.newSong({quiet:true})"); assert await p.ev("x=>__app.load(x)", proj("riso")); await paste(star("加星星")); assert await p.ev("c=>__app.pasteScene(c)", PARTS); assert await p.ev("c=>__app.pasteScene(c)", MIN)
            await p.ev("__app.markSaved()"); order = list(await styles()); was = (await p.ev("__app.saveState()"))["saved"]
            ok, st = await paste('```json\n{"format":"worship-motion-patch/1","set":{"bpm":96}}\n```'); mid = (await p.ev("__app.saveState()"))["saved"]; await p.ev("__app.undo()")
            rec("K6 三份風格程式的歌存檔後改速度再還原：仍顯示已存成檔案，風格清單順序不變", ok and was is True and mid is False and (await p.ev("__app.saveState()"))["saved"] is True and list(await styles()) == order, (was, mid, (await p.ev("__app.saveState()"))["text"], order[-3:], list(await styles())[-3:]))
            await p.ev("__app.flushHist()"); await p.reload()
            rec("K6 重新載入後也一樣", (await p.ev("__app.saveState()"))["saved"] is True and list(await styles()) == order, ((await p.ev("__app.saveState()"))["text"], list(await styles())[-3:]))
        await safe("K6 還原後的存檔狀態與順序", k6)

        async def k7():
            late = MIN.replace("id: 'bars', name: '色帶'", "id: 'late', name: '晚點卡住'").replace("const y = x.step", "if (x.t > 3 && x.t < 4) for (;;) { } const y = x.step")
            hang = "```js\npatchScene({ label: '晚點卡住的星星', elements: { star: { label: '星星', draw(f, x, e) { if (x.t > 3 && x.t < 4) for (;;) { } f.add(circle(1500, 240, 60, '#e8d9a8')); } } } });\n```"
            assert "id: 'late'" in late and "for (;;)" in late
            await p.ev("__app.newSong({quiet:true})"); assert await p.ev("x=>__app.load(x)", proj("swiss", sections=[{"name": "主歌", "background": "calm", "subtitle": "none"}]))
            await paste(hang); await p.ev("c=>__app.pasteScene(c)", late)
            for _ in range(5):
                try: await asyncio.wait_for(p.grab(3.5), 90); break
                except Exception: pass
            before = (await p.ev("__app.sceneInfo()"))["id"]; await p.ev("__app.flushHist()"); p.log.clear(); await pg.reload()
            try: await pg.wait_for_function(READY, timeout=45000); up = True
            except Exception: up = False
            info = await p.ev("__app.sceneInfo()") if up else None
            rec("K7 預設風格那一份被暫停使用時重新載入：編輯器開得起來，用的是內建風格", up and info and info["id"] == "swiss" and await p.ev("__app.songs().length") > 0, (before, up, info and info["id"], p.log[:2]))
            if up:
                note = await p.ev("__app.notices()"); btn = await p.ev("[...document.querySelectorAll('#guard button')].map(b=>b.textContent.trim())")
                rec("K7 重新載入後有提示說明那一份已暫停使用，並有「仍要試跑」", any("暫停使用" in x for x in note) and "仍要試跑" in btn and not any("。。" in x for x in note), (note, btn))
                await use("paper"); await p.ev("__app.tab('self')"); await pg.select_option("#style", "swiss"); await p.wait("__app.project.style==='swiss'&&__app.sceneInfo().id==='swiss'&&__app.notices().some(x=>x.includes('暫停使用'))", 30000); note = await p.ev("__app.notices()")
                rec("K7 換到剪紙拼貼再換回瑞士網格：換得回去（內建的樣子），同樣有提示", any("暫停使用" in x for x in note) and await labels() == [], (note, await pg.inner_text("#selfMsg")))
                await pg.click("#guard button >> text=仍要試跑"); await p.wait("__app.patches().length===1||__app.notices().some(x=>x.includes('卡住'))", 60000); await p.ev("__app.elements()")
                rec("K7 按「仍要試跑」：那一份被載回來（或再次卡住而退回），沒有頁面錯誤", not p.log, (await labels(), (await p.ev("__app.sceneInfo()"))["id"], p.log[:2]))
                await p.ev("__app.newSong({quiet:true})"); im = await p.shot(0, 0, 1.0)
                rec("K7 開起來之後可以做新的一首、看得到畫面", im.getbbox() is not None and (await p.ev("__app.project"))["title"] == "新的詩歌", (await p.ev("__app.project"))["title"])
            p.log.clear()
        await safe("K7 被暫停的那一份不會讓編輯器開不起來", k7)

        async def k8():
            one = [{"name": "主歌", "background": "calm", "subtitle": "none"}]; bpm = '```json\n{"format":"worship-motion-patch/1","set":{"bpm":96}}\n```'
            guard = lambda: p.ev("(()=>{const g=document.querySelector('#guard');return g.hidden?'':g.innerText})()")
            late2 = MIN.replace("id: 'bars', name: '色帶'", "id: 'late2', name: '晚點卡住二'").replace("const y = x.step", "if (x.t > 2.5 && x.t < 3.5) for (;;) { } const y = x.step")
            await p.ev("__app.newSong({quiet:true})"); assert await p.ev("x=>__app.load(x)", proj("riso", sections=one)); n = await p.ev("__app.active()"); await p.ev("c=>__app.pasteScene(c)", late2)
            for _ in range(5):
                try: await asyncio.wait_for(p.grab(3.0), 90); break
                except Exception: pass
            g1 = await guard(); await paste(bpm); await p.ev("__app.undo()"); await p.ev("__app.elements()"); g2 = await guard()
            rec("K8 AI 新風格卡住退回的提示：同一首歌改速度再還原後還在", "再試一次新風格" in g1 and "再試一次新風格" in g2, (g1[:60], g2[:60]))
            await p.ev("__app.newSong({quiet:true})"); g3 = await guard(); await p.ev(f"__app.switchSong({n})"); await p.ev("__app.elements()")
            rec("K8 換到新的一首：上一首的提示與按鈕不在畫面上", "再試一次" not in g3 and "仍要試跑" not in g3 and "晚點卡住" not in g3, g3[:80])
            hang = "```js\npatchScene({ label: '晚點卡住的圓', elements: { ball: { label: '圓', draw(f, x, e) { if (x.t > 3 && x.t < 4) for (;;) { } f.add(circle(1500, 240, 60, '#e8d9a8')); } } } });\n```"
            await p.ev("__app.newSong({quiet:true})"); assert await p.ev("x=>__app.load(x)", proj("paper", sections=one)); await paste(hang); await p.ev("__app.elements()"); away = (await p.ev("__app.sceneInfo()"))["id"]
            await use("paper"); await p.wait("document.querySelector('#guard').innerText.includes('暫停使用')", 30000); await paste(bpm); await p.ev("__app.undo()"); await p.ev("__app.elements()"); g4 = await guard()
            rec("K8 剪紙拼貼自己那一份被暫停、從選單換過去後改速度再還原：還是剪紙拼貼（內建的樣子），提示還在", away != "paper" and (await p.ev("__app.project"))["style"] == "paper" and (await p.ev("__app.sceneInfo()"))["id"] == "paper" and "暫停使用" in g4 and "仍要試跑" in g4, (away, (await p.ev("__app.project"))["style"], g4[:60]))
            await p.ev("__app.flushHist()"); p.log.clear(); await p.reload(); g5 = await guard()
            rec("K8 重新載入後也是剪紙拼貼，有提示", (await p.ev("__app.project"))["style"] == "paper" and (await p.ev("__app.sceneInfo()"))["id"] == "paper" and "暫停使用" in g5, ((await p.ev("__app.project"))["style"], g5[:60]))
            p.log.clear()
        await safe("K8 提示跟著那首歌", k8)

        rec("沒有頁面錯誤", not p.log, p.log[:3])
        if b: await b.close()
asyncio.run(main()); finish()
