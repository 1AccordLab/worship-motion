"""歌曲分頁的無頭測試：python3 tests/test_tabs.py
新增／切換／關閉復原／排序／改名、每首各自的自訂風格、整本存檔再開、只存這一首、舊的單首檔與設定 JSON 相容、
貼上另一首歌開新分頁、複製給 AI 只帶目前這首、全部歌曲 ZIP 檔名、窄螢幕橫向捲動。全部用示意文字。"""
import asyncio, sys, pathlib, json, re
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
OUT = ROOT / "q" / "tabs"; OUT.mkdir(parents=True, exist_ok=True)
MIN = (ROOT / "examples" / "minimal.js").read_text()
MIN2 = MIN.replace("id: 'bars'", "id: 'bars2'").replace("name: '色帶'", "name: '色帶二'").replace("'#d9643a'", "'#3a8fd9'")
res = []
def rec(n, ok, d=""): res.append(bool(ok)); print(("✔" if ok else "✘"), n, "｜", str(d).replace("\n", " ")[:200], flush=True)
def song(title, style="swiss"): return proj(style, title=title)
async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw); pg = p.pg
        await pg.set_viewport_size({"width": 1440, "height": 900})
        titles = lambda: p.ev("__app.songs().map(s=>s.title)")
        async def dlg_answer(v):
            await pg.wait_for_function("__app.dialog().open", timeout=10000); await p.ev(f"__app.answer('{v}')")
        await p.ev("x=>__app.load(x)", song("示意歌甲"))
        await pg.click("#newSong"); await pg.wait_for_function("__app.project.title==='新的詩歌'")
        await p.ev("x=>__app.load(x)", song("示意歌乙", "paper"))
        await p.ev("__app.newSong()"); await p.ev("x=>__app.load(x)", song("示意歌丙", "riso"))
        rec("新增：三個分頁、分頁上顯示歌名", await titles() == ["示意歌甲", "示意歌乙", "示意歌丙"] and await pg.locator("#songTabs .sname").all_inner_texts() == ["示意歌甲", "示意歌乙", "示意歌丙"], await titles())
        await pg.click("#songTabs .sname >> text=示意歌甲"); await pg.wait_for_function("__app.project.title==='示意歌甲'")
        await p.ev("__app.tab('self')")
        rec("切分頁：設定、風格、面板一起切換", (await p.ev("__app.sceneInfo()"))["id"] == "swiss" and await pg.input_value("#title") == "示意歌甲" and "導歌" in await pg.inner_text("#secTabs"))
        await p.ev("__app.select(2,1)"); await p.ev("__app.switchSong(1)"); await p.ev("__app.switchSong(0)")
        rec("切回來：記得原本在哪一段", "副歌" in await pg.inner_text("#secTitle"), await pg.inner_text("#secTitle"))
        # 每首各自的自訂風格
        await p.ev("c=>__app.pasteScene(c)", MIN); await p.ev("__app.switchSong(1)"); await p.ev("c=>__app.pasteScene(c)", MIN2)
        await p.ev("__app.switchSong(0)"); a = (await p.ev("__app.sceneInfo()"))["id"]
        await p.ev("__app.switchSong(1)"); bb = (await p.ev("__app.sceneInfo()"))["id"]
        sg = await p.ev("__app.songs()")
        rec("每首歌各自保存自訂風格（不再全域只記一個）", a == "bars" and bb == "bars2" and [s["custom"] for s in sg] == ["bars", "bars2", None], [(s["title"], s["custom"]) for s in sg])
        # 排序、改名
        await p.ev("__app.switchSong(2)"); await pg.click("#songTabs .smenu"); await pg.click("#smLeft")
        rec("分頁選單「往左移」", await titles() == ["示意歌甲", "示意歌丙", "示意歌乙"] and await p.ev("__app.active()") == 1, await titles())
        await p.ev("__app.moveSongTo(0,2)"); rec("拖曳排序（moveSongTo）", await titles() == ["示意歌丙", "示意歌乙", "示意歌甲"], await titles())
        await p.ev("()=>{window.__r=__app.renameSong(__app.active())}"); await pg.wait_for_function("__app.dialog().open")
        await p.ev("__app.dialogInput('示意歌丙改')"); await p.ev("__app.answer('ok')"); await p.ev("window.__r")
        rec("改名（頁內對話框）", (await p.ev("__app.project"))["title"] == "示意歌丙改" and "示意歌丙改" in await pg.inner_text("#songTabs"))
        # 關閉、復原
        await p.ev("()=>{window.__r=__app.closeSong(1)}"); d = await p.ev("__app.dialog()")
        await dlg_answer("close"); await p.ev("window.__r")
        rec("關閉：頁內確認後拿掉", await titles() == ["示意歌丙改", "示意歌甲"] and "關閉" in d["title"], await titles())
        await pg.click("#undoClose"); await pg.wait_for_function("__app.songs().length===3")
        rec("關閉後「復原」→ 放回原位、自訂風格還在", await titles() == ["示意歌丙改", "示意歌乙", "示意歌甲"] and (await p.ev("__app.songs()"))[1]["custom"] == "bars2", await titles())
        # 複製給 AI 只帶目前這首
        await p.ev("__app.switchSong(2)"); txt = await p.ev("__app.aiText()")
        rec("複製給 AI 只帶目前分頁", "示意歌甲" in txt and "示意歌乙" not in txt and "示意歌丙" not in txt)
        # 貼上另一首 → 開新分頁
        await p.ev("t=>{window.__r=__app.applyPaste(t)}", "```json\n" + json.dumps(song("示意歌丁"), ensure_ascii=False) + "\n```")
        await dlg_answer("new"); await p.ev("window.__r")
        rec("貼上另一首歌 → 開新分頁（放在目前這首後面）", await titles() == ["示意歌丙改", "示意歌乙", "示意歌甲", "示意歌丁"] and await p.ev("__app.active()") == 3, await titles())
        plan = await p.ev("__app.allSongsPlan()")
        dirs = sorted({n.split("/")[0] for n in plan})
        rec("全部歌曲（ZIP）：每首一個資料夾、依分頁順序", dirs == ["01_示意歌丙改", "02_示意歌乙", "03_示意歌甲", "04_示意歌丁"] and all(n.endswith(".mp4") for n in plan), dirs)
        rec("存檔狀態膠囊顯示整本", "整本 4 首" in (await p.ev("__app.saveState()"))["text"], (await p.ev("__app.saveState()"))["text"])
        # 整本存檔再開
        book = OUT / "整本.html"; book.write_text(await p.ev("__app.singleHTML('book')"))
        q = Page(await ctx.new_page(), []); q.pg.on("pageerror", lambda e: q.log.append(str(e)))
        await q.pg.goto(book.as_uri() + "?nopreview"); await q.pg.wait_for_function("window.__app&&__app.ready", timeout=120000)
        sq = await q.ev("__app.songs()")
        rec("整本存成單檔 → 打開還是四個分頁、各自的風格", [s["title"] for s in sq] == ["示意歌丙改", "示意歌乙", "示意歌甲", "示意歌丁"] and [s["custom"] for s in sq] == [None, "bars2", "bars", None] and (await q.ev("__app.saveState()"))["saved"], [(s["title"], s["custom"]) for s in sq])
        await q.ev("__app.switchSong(1)"); rec("再開後切到自訂風格那首能用", (await q.ev("__app.sceneInfo()"))["id"] == "bars2" and not q.log, q.log[:2])
        await q.pg.close()
        # 只存這一首
        await p.ev("__app.switchSong(2)")
        one = OUT / "只存這一首.html"; one.write_text(await p.ev("__app.singleHTML('one')"))
        q = Page(await ctx.new_page(), []); await q.pg.goto(one.as_uri() + "?nopreview"); await q.pg.wait_for_function("window.__app&&__app.ready", timeout=120000)
        sq = await q.ev("__app.songs()")
        rec("只存這一首 → 打開只有那一首（含它的自訂風格）", [(s["title"], s["custom"]) for s in sq] == [("示意歌甲", "bars")], sq)
        await q.pg.close()
        # 舊檔相容：舊的單首檔（wm-project 是一首歌的設定）
        html = one.read_text()
        old = re.sub(r'(<script type="application/json" id="wm-project" data-doc=")[^"]*(">)[\s\S]*?(</script>)', lambda m: m.group(1) + "olddoc" + m.group(2) + json.dumps(song("舊的單首", "bauhaus"), ensure_ascii=False) + m.group(3), html, count=1)
        of = OUT / "舊的單首.html"; of.write_text(old)
        q = Page(await ctx.new_page(), []); await q.pg.goto(of.as_uri() + "?nopreview"); await q.pg.wait_for_function("window.__app&&__app.ready", timeout=120000)
        sq = await q.ev("__app.songs()")
        rec("舊的單首 HTML → 打開成一個分頁", [(s["title"], s["style"]) for s in sq] == [("舊的單首", "bauhaus")], sq)
        await q.pg.close()
        ok = await p.ev("t=>__app.importText(t)", json.dumps(song("舊的設定檔", "type"), ensure_ascii=False))
        rec("舊的設定 JSON（打開設定檔）→ 成為一個新分頁", ok and "舊的設定檔" in await titles() and (await p.ev("__app.project"))["style"] == "type", await titles())
        ok = await p.ev("t=>__app.importText(t)", old)
        rec("在編輯器裡打開舊的單首 HTML → 也成為一個分頁", ok and "舊的單首" in await titles(), await titles())
        # 窄螢幕：分頁橫向捲動
        await pg.set_viewport_size({"width": 420, "height": 800})
        sw = await p.ev("(()=>{const r=document.querySelector('.songrow');return [r.scrollWidth,r.clientWidth,getComputedStyle(r).overflowX]})()")
        rec("窄螢幕：分頁列可以橫向捲動", sw[0] > sw[1] and sw[2] in ("auto", "scroll"), sw)
        await pg.screenshot(path=str(OUT / "窄螢幕.png"))
        rec("沒有頁面錯誤", not [l for l in p.log if "pageerror" in l], p.log[:3])
        await b.close()
    print(f"\n通過 {sum(res)} / {len(res)}")
asyncio.run(main())
