"""新介面流程的無頭測試：python3 tests/test_ux.py
分頁切換、三步驟、複製給 AI（含輸入框文字與設定）、貼上偵測（只有設定／只有新風格／兩者／無框）、
換歌前提醒、存檔狀態、做新的一首、刪段落復原、自己調、影片清單、開場白含 SKILL.md、錯誤附「複製給 AI」。"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
EX = ROOT / "examples"
MIN = (EX / "minimal.js").read_text()
SKILL = (ROOT / "skill" / "SKILL.md").read_text()
OUT = OUT / "ux"; OUT.mkdir(parents=True, exist_ok=True)
def fence(lang, body): return f"```{lang}\n{body}\n```"
SONG = proj("riso", title="示意歌名")
OTHER = proj("riso", title="示意歌乙")

async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)
        try: await ctx.grant_permissions(["clipboard-read", "clipboard-write"])
        except Exception: pass
        await p.pg.set_viewport_size({"width": 1440, "height": 900})
        pg = p.pg
        async def dlg(): return await p.ev("__app.dialog()")
        settle_copy = p.settle_copy
        async def wait_dialog():
            await p.wait("__app.dialog().open"); return await dlg()
        async def visible(sel): return await pg.is_visible(sel)

        # ---------- 第一次打開 ----------
        rec("第一次打開：三步驟說明卡顯示", await visible("#intro"))
        rec("預設分頁是「請 AI 改」、步驟 1", await p.ev("__app.currentTab()") == "ai" and await p.ev("__app.step()") == 1 and await visible("#pane-ai") and not await visible("#pane-self"))
        st = await p.ev("__app.saveState()")
        rec("範例專案：存檔狀態＝未存成檔案", not st["saved"] and "還沒存成檔案" in st["text"], st)

        # ---------- 分頁、步驟 ----------
        await pg.click("#tab-self")
        ok1 = await visible("#pane-self") and not await visible("#pane-ai") and await p.ev("__app.step()") == 2
        await pg.click("#tab-adv"); ok2 = await visible("#pane-adv") and await p.ev("__app.currentTab()") == "adv"
        await pg.focus("#tab-adv"); await pg.keyboard.press("ArrowRight"); ok3 = await p.ev("__app.currentTab()") == "ai" and await p.ev("__app.step()") == 1
        rec("分頁切換（點、方向鍵）與步驟連動", ok1 and ok2 and ok3, f"{ok1} {ok2} {ok3}")
        await pg.click("#steps button[data-step='3']")
        rec("點步驟③ → 標成目前步驟、焦點到匯出", await p.ev("__app.step()") == 3 and await p.ev("document.activeElement.id") == "exOne")
        await pg.click("#steps button[data-step='2']")
        rec("點步驟② → 打開「自己調」", await p.ev("__app.currentTab()") == "self")
        await p.ev("__app.tab('ai')")

        # ---------- 複製給 AI ----------
        await p.ev("p=>__app.load(p)", SONG); await p.ev("__app.select(2,0)")
        await pg.fill("#askText", "整體想暖一點")
        await pg.click("#chips button:has-text('太躁')")
        await pg.click("#copyAI"); await settle_copy()
        txt = await p.ev("__app.lastCopied()")
        body = txt.split("```json\n", 1)[1].split("\n```", 1)[0] if "```json\n" in txt else "{}"
        rec("複製給 AI：含輸入框文字＋快捷說法（帶目前段落名）", "整體想暖一點" in txt and "「副歌」的背景太躁" in txt, txt[:120])
        rec("複製給 AI：含目前設定（可解析、等於專案）", json.loads(body) == await p.ev("__app.project"))
        try: await pg.wait_for_function("document.querySelector('#copyMsg').textContent.includes('已複製')", timeout=5000)
        except Exception: pass
        rec("複製給 AI：完成訊息出現在按鈕下方", "已複製" in await pg.inner_text("#copyMsg"))
        await pg.fill("#askText", "")
        await p.ev("__app.aiText()")
        rec("留空時請 AI 用選擇題問", "選擇題" in await p.ev("__app.aiText()"))
        rec("內建風格不顯示「附上新風格程式」選項", not await visible("#withCodeRow"))

        # ---------- 貼上偵測 ----------
        cfg = json.dumps(SONG, ensure_ascii=False)
        cases = {
            "只有設定": ("好的，改好了：\n" + fence("json", cfg) + "\n下次可以這樣說：…", (True, False, False)),
            "只有新風格": ("新風格：\n" + fence("js", MIN) + "\n貼上就好。", (False, True, False)),
            "兩者都有": ("新風格：\n" + fence("js", MIN) + "\n設定：\n" + fence("json", cfg), (True, True, False)),
            "無框、純設定": (cfg, (True, False, False)),
            "無框、含 defineScene": ("這是新風格，請貼上：\n" + MIN, (False, True, True)),
            "什麼都沒有": ("謝謝你！請問這首歌的感覺是？ 1A 2B", (False, False, False)),
        }
        for name, (text, (c, s, nf)) in cases.items():
            d = await p.ev("t=>__app.detect(t)", text)
            rec(f"貼上偵測：{name}", d["cfg"] == c and d["scene"] == s and d["noFence"] == nf, d)
        d = await p.ev("t=>__app.detect(t)", fence("json", '{"title": "x", "sections": [{"background": "calm"},]}'))
        rec("貼上偵測：設定格式壞掉 → 說明原因", not d["cfg"] and "格式有錯" in d["err"], d["err"])
        await pg.fill("#pasteText", "")
        rec("貼上框空白時「套用」不能按", await p.ev("document.querySelector('#pasteApply').disabled"))
        await pg.fill("#pasteText", cases["兩者都有"][0])
        dt = await pg.inner_text("#detect")
        rec("貼上後即時顯示「設定 ✔／新風格 ✔」、可以按套用", "設定 ✔" in dt and "新風格 ✔" in dt and not await p.ev("document.querySelector('#pasteApply').disabled"), dt)
        await pg.fill("#pasteText", cases["無框、含 defineScene"][0])
        rec("無框又有 defineScene → 提示用「複製」整則複製", "複製" in await pg.inner_text("#detect") and "```" in await pg.inner_text("#detect"))
        await pg.fill("#pasteText", fence("json", '{"title": "x",, }'))
        rec("格式壞掉 → 偵測區紅字＋「複製錯誤訊息給 AI」", "格式有錯" in await pg.inner_text("#detect") and await visible("#detect button"))

        # ---------- 套用＋摘要 ----------
        changed = json.loads(cfg); changed["bpm"] = 96; changed["sections"][2]["background"] = "build"
        await pg.fill("#pasteText", "好：\n" + fence("json", json.dumps(changed, ensure_ascii=False)))
        await pg.click("#pasteApply"); await pg.wait_for_function("document.querySelector('#cfgStatus').textContent.includes('已套用')", timeout=30000)
        stx = await pg.inner_text("#cfgStatus")
        rec("套用後摘要：風格、段數、影片數、改了哪些", all(k in stx for k in ("風格「", "3 段", "會產生", "速度：120 → 96", "副歌：背景 高潮 → 累積")), stx)
        rec("套用後貼上框清空、步驟到②", await p.ev("document.querySelector('#pasteText').value") == "" and await p.ev("__app.step()") == 2)
        await pg.fill("#pasteText", '```json\n{"style":"neon","sections":[{"background":"calm"}]}\n```')
        await pg.click("#pasteApply"); await pg.wait_for_function("document.querySelector('#cfgStatus').classList.contains('err')", timeout=30000)
        aifix = await visible("#cfgStatus + .aifix")
        await pg.click("#cfgStatus + .aifix"); await settle_copy()
        rec("錯誤紅字在貼上框下方＋「複製錯誤訊息給 AI」", aifix and "neon" in await p.ev("__app.lastCopied()"), await p.ev("__app.status()"))
        await p.ev("__app.load(" + json.dumps(SONG, ensure_ascii=False) + ")")
        await pg.fill("#pasteText", "新風格：\n" + fence("js", MIN))
        await pg.click("#pasteApply"); await pg.wait_for_function("document.querySelector('#cfgStatus').textContent.includes('已套用') || document.querySelector('#cfgStatus').classList.contains('err')", timeout=60000)
        rec("只貼新風格 → 同一個貼上框套用", "新風格「色帶」" in await pg.inner_text("#cfgStatus") and (await p.ev("__app.sceneInfo()"))["id"] == "bars", await pg.inner_text("#cfgStatus"))
        await p.ev("__app.tab('ai')")
        rec("新風格時顯示「附上新風格程式」選項", await visible("#withCodeRow"))
        await pg.check("#withCode"); await pg.click("#copyAI"); await settle_copy()
        txt = await p.ev("__app.lastCopied()")
        rec("勾選後複製給 AI 會附上 ```js 新風格程式", "```js" in txt and "defineScene" in txt and "```json" in txt)
        await pg.uncheck("#withCode")

        # ---------- 貼上另一首歌 → 問：開新分頁／取代／取消 ----------
        await p.ev("__app.load(" + json.dumps(SONG, ensure_ascii=False) + ")")
        other = "```json\n" + json.dumps(OTHER, ensure_ascii=False) + "\n```"
        n0 = len(await p.ev("__app.songs()"))
        await p.ev("t=>{window.__r=__app.applyPaste(t);}", other)
        d = await wait_dialog()
        rec("貼上另一首歌 → 頁內對話框：開新分頁（推薦）／取代／取消", "另一首歌" in d["title"] and "示意歌乙" in d["title"] and d["buttons"] == ["new", "replace", "cancel"], d)
        await p.ev("__app.answer('cancel')"); r = await p.ev("window.__r")
        rec("按「取消」→ 不套用、還是原本那首", r is False and (await p.ev("__app.project"))["title"] == "示意歌名" and len(await p.ev("__app.songs()")) == n0)
        await p.ev("t=>{window.__r=__app.applyPaste(t);}", other); await wait_dialog(); await p.ev("__app.answer('new')")
        r = await p.ev("window.__r"); sg = await p.ev("__app.songs()")
        rec("按「開新分頁」→ 新分頁放新歌、原本那首還在", r is True and len(sg) == n0 + 1 and (await p.ev("__app.project"))["title"] == "示意歌乙" and any(x["title"] == "示意歌名" for x in sg), [x["title"] for x in sg])
        await p.ev("__app.switchSong(__app.songs().findIndex(s=>s.title==='示意歌名'))")
        await p.ev("t=>{window.__r=__app.applyPaste(t);}", other); await wait_dialog(); await p.ev("__app.answer('replace')")
        r = await p.ev("window.__r")
        rec("按「取代目前這首」→ 目前分頁換成新歌", r is True and (await p.ev("__app.project"))["title"] == "示意歌乙" and len(await p.ev("__app.songs()")) == n0 + 1)

        # ---------- 存檔狀態膠囊 ----------
        await p.ev("__app.tab('self')"); await p.ev("__app.markSaved()")
        s1 = await p.ev("__app.saveState()")
        await pg.fill("#title", "示意歌乙（改）")
        s2 = await p.ev("__app.saveState()")
        rec("存檔狀態：存了→「已存成檔案」，再改→變回未存", s1["saved"] and "已存成檔案" in s1["text"] and not s2["saved"] and "還沒存成檔案" in s2["text"], f"{s1} → {s2}")
        async with pg.expect_download() as dl:
            await pg.click("#saveHTML")
        await dl.value; await pg.wait_for_function("__app.saveState().saved", timeout=10000)
        rec("按頂端「存成單檔 HTML」→ 下載、狀態變已存、顯示檔案大小", "KB" in await pg.inner_text("#saveMsg"), await pg.inner_text("#saveMsg"))

        # ---------- 做新的一首 = 開新分頁 ----------
        n0 = len(await p.ev("__app.songs()")); t0 = (await p.ev("__app.project"))["title"]
        await p.ev("document.querySelector('#openMsg').textContent=''")
        await pg.click("#newSong"); await p.wait("document.querySelector('#openMsg').textContent.includes('開場白')")
        pj = await p.ev("__app.project"); st = await p.ev("__app.saveState()"); sg = await p.ev("__app.songs()")
        rec("做新的一首 → 開新分頁（原本那首還在）、回到「請 AI 改」、提示複製開場白", len(sg) == n0 + 1 and any(x["title"] == t0 for x in sg) and len(pj["sections"]) == 2 and st["fresh"] and await p.ev("__app.currentTab()") == "ai" and "開場白" in await pg.inner_text("#openMsg"), [x["title"] for x in sg])
        rec("做新的一首不跳對話框", not (await dlg())["open"])

        # ---------- 開場白 ----------
        rec("編輯器內嵌完整 SKILL.md", await p.ev("__app.skill()") == SKILL, f"{len(await p.ev('__app.skill()'))} 字")
        await pg.click("#copyOpen"); await settle_copy(); await pg.wait_for_function("document.querySelector('#openMsg').textContent.includes('開場白 ✔')", timeout=5000)
        op = await p.ev("__app.lastCopied()")
        rec("複製開場白＝一句說明＋完整 SKILL.md", op.startswith("我要用「詩歌影片編輯器」") and SKILL.strip() in op and "選擇題" in op, f"{len(op)} 字")
        await pg.click("#copyOpenShort"); await settle_copy()
        sh = await p.ev("__app.lastCopied()")
        rec("短開場白：只叫 skill、不含整份說明", "worship-motion-backgrounds" in sh and len(sh) < 300, sh[:80])

        # ---------- 刪段落、復原 ----------
        await p.ev("__app.load(" + json.dumps(SONG, ensure_ascii=False) + ")")
        await p.ev("__app.tab('self')")
        names0 = [s["name"] for s in (await p.ev("__app.project"))["sections"]]
        await pg.click("#secList button[aria-label='刪除「導歌」']")
        names1 = [s["name"] for s in (await p.ev("__app.project"))["sections"]]
        has_undo = await visible("#undoDel")
        await pg.click("#undoDel")
        names2 = [s["name"] for s in (await p.ev("__app.project"))["sections"]]
        rec("刪除段落 → 出現「復原」→ 復原回原位", names1 == ["主歌", "副歌"] and has_undo and names2 == names0, f"{names1} → {names2}")
        await p.ev("p=>__app.load(p)", {"format": "worship-motion/1", "title": "一段", "style": "riso", "sections": [{"background": "calm"}]})
        r = await p.ev("__app.removeSection(0)")
        rec("只剩一段 → 不能刪、紅字在段落區", r is False and "至少" in await pg.inner_text("#secMsg"))

        # ---------- 自己調 ----------
        await p.ev("__app.load(" + json.dumps(SONG, ensure_ascii=False) + ")"); await p.ev("__app.select(1,0)"); await p.ev("__app.tab('self')")
        await pg.click("#sJump button:has-text('慢')")
        await pg.click("#sBg button:has-text('高潮')")
        s = (await p.ev("__app.project"))["sections"][1]
        rec("色塊換位「慢」＝每 8 拍、背景強度「高潮」", s["jumpBeats"] == 8 and s["background"] == "peak", s)
        hint = await pg.inner_text("#lyricHint")
        rec("歌詞框下方：會做成 N 支字幕影片＋切法", "會做成 1 支字幕影片" in hint and "一行" in hint, hint)
        await pg.fill("#sLyrics", "這是第[一]行示意文字\n這是第[二]行示意文字\n這是第[三]行示意文字")
        rec("改歌詞 → 支數即時更新", "會做成 3 支" in await pg.inner_text("#lyricHint"))
        await p.wait("document.querySelector('#clips').innerText.includes('字幕 1：這是第一行示意文字（播一次停住）') && document.querySelector('#exSecD').innerText.includes('3 支字幕')")
        clips = await pg.inner_text("#clips")
        rec("影片清單寫清楚：背景（會循環）、字幕 1：…（播一次停住）", "背景（會循環）" in clips and "字幕 1：這是第一行示意文字（播一次停住）" in clips, clips.replace("\n", " ")[:160])
        rec("匯出說明跟著這一段：背景＋3 支字幕", "3 支字幕" in await pg.inner_text("#exSecD"))
        await pg.click("#sSub button:has-text('不要')")
        rec("動態字幕「不要」→ 每支長度等選項收起、清單提示用 簡報軟體 打歌詞", (await p.ev("__app.project"))["sections"][1]["subtitle"] == "none" and not await visible("#subOpts") and "簡報軟體" in await pg.inner_text("#clips"))
        await pg.click("#secTabs button[aria-selected='false']:has-text('副歌')")
        rec("預覽上方段落分頁可切換", "副歌" in await pg.inner_text("#secTitle"))
        await pg.fill("#bpm", "300"); await pg.dispatch_event("#bpm", "change")
        rec("速度超出範圍 → 紅字在「整首歌」卡片＋複製給 AI 按鈕", "40 到 220" in await pg.inner_text("#selfMsg") and await visible("#selfMsg + .aifix"))

        # ---------- 「?」說明 ----------
        q = pg.locator("#pane-self .q").first
        await q.click(); tip_open = await p.ev("!!document.querySelector('.tipbox.show')")
        await pg.mouse.click(5, 5); tip_closed = not await p.ev("!!document.querySelector('.tipbox.show')")
        rec("「?」點開說明、點別處關閉", tip_open and tip_closed)

        # ---------- 單檔帶著新介面與 SKILL.md ----------
        html = await p.ev("__app.singleHTML()")
        f = OUT / "單檔_新介面.html"; f.write_text(html)
        p2 = await open_url(ctx, f.as_uri())
        rec("存成單檔：新介面、SKILL.md 都在；打開是「已存成檔案」", await p2.pg.is_visible("#tab-ai") and await p2.ev("__app.skill()") == SKILL and (await p2.ev("__app.saveState()"))["saved"], f"{len(html.encode())/1024:.1f} KB")

        # ---------- 說明卡關掉後不再出現 ----------
        await pg.click("#introClose")
        await p.reload()
        rec("說明卡「知道了」→ 重開不再顯示", not await visible("#intro"))
        rec("沒有頁面錯誤", not [l for l in p.log if "pageerror" in l], p.log[:3])
        await b.close()
asyncio.run(main()); finish()
