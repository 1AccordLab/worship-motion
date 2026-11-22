"""預覽上的選取規則（防誤觸）：python3 tests/test_select.py（示意文字）
驗收條件：
E1 「調整畫面」預設關閉：在預覽上點、拖都不會選取、不會移動任何元素，游標移過去也沒有外框。
E2 打開「調整畫面」：游標移到元素上只顯示外框和名稱（還沒選取）；移到空白處外框消失。
E3 點一下只選取；在沒選取的元素上按住拖，不會移動任何元素。
E4 按住拖出一個範圍：碰到的元素都被選取（鋪滿畫面的、鎖定的、隱藏的除外）；多選時選取框是它們合起來的範圍，沒有縮放與旋轉把手。
E5 按住 Shift 點元素：加入選取或從選取中拿掉。
E6 從選取範圍裡開始拖：選取的元素一起移動同樣的距離，是一筆歷史紀錄，還原後全部回到原位。
E7 鎖定：清單上按鎖定後，設定記下 locked；在預覽上點不到、範圍選取選不到、點清單名稱也選不到；解鎖後恢復。
E8 點清單上的名稱會自動打開「調整畫面」；關掉「調整畫面」會取消選取。
E9 元素疊在一起的地方：點一下選最上面的；對已選取的元素在同一個位置再點一下（沒有拖），換選它底下的那一個，輪到最底再回到最上面；選到底下的元素後從那裡拖，移動的是它。
E10 疊著的地方其他規則照舊：按住 Shift 點是把最上面的那個加進選取或拿掉；多選後不按 Shift 點一下，只選最上面的那個；選取不是在這個位置點出來的（例如從清單選的），點一下選的是最上面的那個，再點才換底下。"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *

def center(b): return ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)
def near(a, b, tol): return all(abs(x - y) <= tol for x, y in zip(a, b))

async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)
        pg = p.pg
        async def els(): return {e["id"]: e for e in await p.ev("__app.elements()")}
        async def proj_now(): return await p.ev("__app.project")
        async def sel(): return await p.ev("__app.selection()")
        async def picked(): s = await sel(); return sorted(s["ids"]) if s else []
        async def at(si, ci, t, style="riso", edit=True):
            assert await p.ev("x=>__app.load(x)", proj(style))
            await p.ev(f"__app.select({si},{ci})"); await p.ev(f"__app.seek({t})"); await p.ev(f"__app.editMode({'true' if edit else 'false'})")
        async def view():
            await p.ev("document.querySelector('#view').scrollIntoView({block:'center'})")
            return await p.ev("(()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
        async def cpt(x, y): R = await view(); return (R[0] + x / 1920 * R[2], R[1] + y / 1080 * R[3])
        async def unit(): R = await view(); return 1920 / R[2]
        async def click(x, y, shift=False):
            if shift: await pg.keyboard.down("Shift")
            await pg.mouse.click(*await cpt(x, y))
            if shift: await pg.keyboard.up("Shift")
        async def drag(a, c, hold=False):
            await pg.mouse.move(*await cpt(*a)); await pg.mouse.down(); await pg.mouse.move(*await cpt(*c), steps=8)
            if not hold: await pg.mouse.up()
        async def hover(x, y): await pg.mouse.move(*await cpt(x, y), steps=3); return await p.ev("__app.hover()")
        async def shown(sel): return await p.ev("s=>{const e=document.querySelector(s);return !!e&&!e.hidden}", sel)
        async def safe(name, fn):
            try: await fn()
            except Exception as e: rec(name, False, "例外：" + str(e).split("\n")[0][:200])
            finally:
                await pg.mouse.up(); await pg.keyboard.up("Shift")

        async def e1():
            await p.reload(); assert await p.ev("x=>__app.load(x)", proj("riso")); await p.ev("__app.select(0,0)"); await p.ev("__app.seek(1.0)")
            off = await p.ev("__app.editMode()"); pressed = await p.ev("document.querySelector('#editToggle').getAttribute('aria-pressed')")
            rec("E1 剛打開編輯器：「調整畫面」是關的", off is False and pressed == "false", (off, pressed))
            h = await hover(1500, 95); await click(1690, 180); s1 = await sel(); await drag((1690, 180), (1390, 380)); pj = await proj_now()
            rec("E1 關著的時候：移過去沒有外框、點了沒有選取、拖了沒有移動", h is None and not await shown("#hoverBox") and s1 is None and await sel() is None and not pj.get("elements"), (h, s1, pj.get("elements")))
        await safe("E1 預設關閉", e1)

        async def e2():
            await at(0, 0, 1.0); h = await hover(1500, 95); name = await p.ev("document.querySelector('#hoverName').textContent")
            rec("E2 打開後游標移到橫條上：顯示外框和名稱「橫條」，還沒選取", h and h["id"] == "bar" and await shown("#hoverBox") and name == "橫條" and await sel() is None, (h, name))
            h = await hover(960, 540)
            rec("E2 移到空白處：外框消失", h is None and not await shown("#hoverBox"), h)
            await hover(1500, 95); await p.ev("__app.select(1,0)"); await p.ev("__app.seek(1.0)"); await p.ev("__app.hover()")
            rec("E2 游標停在橫條上時切到沒有橫條的段落：外框消失", not await shown("#hoverBox"), await p.ev("document.querySelector('#hoverName').textContent"))
        await safe("E2 游標移過的提示", e2)

        async def e3():
            await at(0, 0, 1.0); n0 = len((await p.ev("__app.history()"))["labels"])
            await click(1690, 180); s = await sel(); pj = await proj_now()
            rec("E3 點圓環：選取它，沒有移動、沒有多歷史紀錄", s and s["ids"] == ["ring"] and not pj.get("elements") and len((await p.ev("__app.history()"))["labels"]) == n0, s and s["ids"])
            await click(960, 540); await drag((1690, 180), (1390, 380)); pj = await proj_now(); e = await els()
            rec("E3 沒選取時在圓環上按住拖：圓環沒有移動、沒有多歷史紀錄", not pj.get("elements") and near(e["ring"]["box"], [1563, 53, 1817, 307], 0.5) and len((await p.ev("__app.history()"))["labels"]) == n0, (pj.get("elements"), e["ring"]["box"]))
            await at(0, 0, 1.0); await click(1690, 180); u = await unit()
            await pg.keyboard.down("Shift"); await drag((1690, 180), (1890, 215)); await pg.keyboard.up("Shift"); adj = ((await proj_now()).get("elements") or {}).get("ring", {})
            rec("E3 先按住 Shift 再拖選取中的圓環：只走水平的移動", near((adj.get("dx", 0),), (200,), 2 * u + 1) and adj.get("dy", 0) == 0 and await picked() == ["ring"], adj)
            await at(0, 0, 1.0); await click(1690, 180); R = await view(); a = await cpt(1690, 180); c = await cpt(1490, 280)
            await p.ev("pts=>{const o=document.querySelector('#stageOvl'),ev=(t,p,b)=>new PointerEvent(t,{clientX:p[0],clientY:p[1],button:0,buttons:b,bubbles:true,pointerId:1,isPrimary:true});o.dispatchEvent(ev('pointerdown',pts[0],1));window.dispatchEvent(ev('pointermove',pts[1],1));window.dispatchEvent(ev('pointerup',pts[1],0));}", [list(a), list(c)])
            await p.ev("__app.selection()"); adj = ((await proj_now()).get("elements") or {}).get("ring", {})
            rec("E3 按下、移動、放開一口氣送完（比判定點到誰還快）：還是算拖動", near((adj.get("dx", 0), adj.get("dy", 0)), (-200, 100), 2 * u + 1), adj)
        await safe("E3 先選取才能拖", e3)

        async def e4():
            await at(0, 0, 1.0)
            await drag((1200, 20), (1900, 330), hold=True); band = await shown("#marquee"); await pg.mouse.up(); s = await sel(); e = await els()
            rec("E4 從 (1200,20) 拖到 (1900,330)：拖的時候看得到範圍框，放開後選到橫條和圓環", band and await picked() == ["bar", "ring"] and not await shown("#marquee"), (band, await picked()))
            handles = await p.ev("[...document.querySelectorAll('#selBox .h')].filter(h=>getComputedStyle(h).display!=='none').length")
            rec("E4 多選時選取框是兩個元素合起來的範圍，沒有把手", s and near(s["box"], [1240, 53, 1860, 307], 0.5) and handles == 0, (s and s["box"], handles))
            await at(1, 0, 1.0, "type"); await drag((20, 20), (1900, 1060)); ids = await picked(); e = await els()
            rec("E4 大字排版整個畫面框起來：鋪滿畫面的整面閃色沒被選到，其他有畫東西的元素都選到", "wash" not in ids and len(ids) >= 5 and all(i in e and not e[i]["fixed"] for i in ids), ids)
            await at(0, 0, 1.0); await drag((20, 20), (1900, 1060)); many = await picked(); await click(960, 540)
            rec("E4 整個畫面框起來選了很多元素之後，點空白處：取消選取", len(many) >= 5 and await picked() == [], (many, await picked()))
        await safe("E4 範圍選取", e4)

        async def e5():
            await at(0, 0, 1.0); await click(1500, 95); await click(1690, 180, shift=True); two = await picked()
            await click(300, 1010, shift=True); three = await picked(); await click(1500, 95, shift=True); left = await picked()
            rec("E5 Shift 點：橫條 → 加圓環 → 加色票條 → 拿掉橫條", two == ["bar", "ring"] and three == ["bar", "ring", "swatches"] and left == ["ring", "swatches"], (two, three, left))
        await safe("E5 Shift 加選", e5)

        async def e6():
            await at(0, 0, 1.0); e0 = await els(); n0 = len((await p.ev("__app.history()"))["labels"]); u = await unit()
            await drag((1200, 20), (1900, 330)); await drag((1500, 95), (1400, 145)); pj = await proj_now(); e = await els(); h = await p.ev("__app.history()")
            adj = pj.get("elements") or {}
            rec("E6 選了橫條和圓環後從橫條上拖 (-100, +50)：兩個都記下同樣的 dx、dy", all(near((adj.get(k, {}).get("dx", 0), adj.get(k, {}).get("dy", 0)), (-100, 50), 2 * u + 1) for k in ("bar", "ring")) and adj.get("bar", {}).get("dx") == adj.get("ring", {}).get("dx"), adj)
            rec("E6 兩個元素的範圍一起平移，其他元素照舊", all(near(center(e[k]["box"]), (center(e0[k]["box"])[0] + adj.get(k, {}).get("dx", 0), center(e0[k]["box"])[1] + adj.get(k, {}).get("dy", 0)), 0.5) for k in ("bar", "ring")) and all(e[k]["box"] == e0[k]["box"] for k in e0 if k not in ("bar", "ring")), {k: e[k]["box"] for k in ("bar", "ring")})
            rec("E6 是一筆歷史紀錄（寫明幾個元素）", len(h["labels"]) == n0 + 1 and "2 個元素" in h["labels"][-1], h["labels"][-2:])
            await p.ev("__app.undo()"); pj = await proj_now()
            rec("E6 還原：兩個都回到原位", not pj.get("elements"), pj.get("elements"))
        await safe("E6 一起移動", e6)

        async def e7():
            await at(0, 0, 1.0); await p.ev("__app.tab('el')")
            await pg.click("#elList .elrow[data-id=ring] .ellock"); await p.wait("((__app.project.elements||{}).ring||{}).locked===true")
            state = await p.ev("document.querySelector('#elList .elrow[data-id=ring] .ellock').getAttribute('aria-pressed')"); await p.ev("__app.seek(1.0)")
            await click(1690, 180); by_click = await picked(); h = await hover(1690, 180)
            await drag((1200, 20), (1900, 330)); by_range = await picked()
            await click(960, 540); await pg.click("#elList .elrow[data-id=ring] .elname"); by_name = await picked()
            rec("E7 鎖定圓環：設定記下 locked、按鈕顯示已鎖定", state == "true", state)
            rec("E7 鎖定後：點不到、游標移過沒有外框、範圍選取只選到橫條、點清單名稱也選不到", by_click == [] and h is None and by_range == ["bar"] and by_name == [], (by_click, h, by_range, by_name))
            await pg.click("#elList .elrow[data-id=ring] .ellock"); await p.wait("!((__app.project.elements||{}).ring||{}).locked"); await p.ev("__app.seek(1.0)")
            await click(1690, 180)
            rec("E7 解鎖後：又點得到", await picked() == ["ring"] and not (await proj_now()).get("elements"), (await picked(), (await proj_now()).get("elements")))
            await pg.click("#elList .elrow[data-id=ring] .ellock"); await p.wait("((__app.project.elements||{}).ring||{}).locked===true")
            await p.ev("__app.setElement('ring',{opacity:0.5})"); await pg.click("#elList .elrow[data-id=ring] .elreset"); await p.wait("((__app.project.elements||{}).ring||{}).opacity===undefined"); pj = await proj_now()
            rec("E7 鎖定的元素按「還原」：調整還原，鎖定留著", pj["elements"].get("ring") == {"locked": True}, pj.get("elements"))
            sec = proj("riso"); sec["sections"][0]["elements"] = {"ring": {"locked": True, "opacity": 0.5}}
            ok = await p.ev("t=>__app.paste(t)", "```json\n" + json.dumps(sec, ensure_ascii=False) + "\n```"); st = await p.ev("__app.status()"); pj = await proj_now()
            rec("E7 段落的 elements 寫 locked：略過並提醒（鎖定只記在整首歌），其他照套", ok and pj["sections"][0]["elements"]["ring"] == {"opacity": 0.5} and "locked" in st and "略過" in st, (pj["sections"][0].get("elements"), st[-100:]))
            cfg = proj("riso", elements={"ring": {"locked": True}})
            ok = await p.ev("t=>__app.paste(t)", "```json\n" + json.dumps(cfg, ensure_ascii=False) + "\n```"); pj = await proj_now()
            rec("E7 設定 JSON 的 locked 貼上會套用", ok and pj["elements"]["ring"] == {"locked": True}, pj.get("elements"))
        await safe("E7 鎖定", e7)

        async def e8():
            await at(0, 0, 1.0, edit=False); await p.ev("__app.tab('el')"); await pg.click("#elList .elrow[data-id=bar] .elname")
            rec("E8 關著時點清單上的「橫條」：自動打開「調整畫面」並選取", await p.ev("__app.editMode()") is True and await picked() == ["bar"], (await p.ev("__app.editMode()"), await picked()))
            await pg.click("#editToggle")
            rec("E8 關掉「調整畫面」：取消選取、選取框消失", await p.ev("__app.editMode()") is False and await sel() is None and not await shown("#selBox"), await sel())
            await pg.click("#editToggle")
            await click(1690, 180); was = await p.ev("document.querySelector('#play').textContent"); await pg.keyboard.press("Space"); now = await p.ev("document.querySelector('#play').textContent")
            rec("E8 用滑鼠按開「調整畫面」、在預覽上選取後按空白鍵：是播放／暫停，開關和選取都還在", was != now and await p.ev("__app.editMode()") is True and await picked() == ["ring"], (was, now, await p.ev("__app.editMode()"), await picked()))
            await p.ev("__app.tab('el')")
            if not await p.ev("document.querySelector('#elList .elrow[data-id=ring]').classList.contains('open')"): await pg.click("#elList .elrow[data-id=ring] .elmore")
            await pg.focus("#elList .elrow[data-id=ring] .elnum[data-k=dx]"); await pg.keyboard.press("Escape")
            rec("E8 游標在數字欄裡按 Esc：選取留著", await picked() == ["ring"], await picked())
            rec("E8 再按一次打開，按鈕狀態跟著變", await p.ev("__app.editMode()") is True and await p.ev("document.querySelector('#editToggle').getAttribute('aria-pressed')") == "true")
        await safe("E8 開關", e8)

        async def e9():
            spot = (706, 871)
            await at(2, 0, 0); seen = []
            for _ in range(3): await click(*spot); seen.append(await picked())
            rec("E9 太陽蓋住光芒的地方：點一下選太陽，再點換成底下的光芒，再點回到太陽", seen == [["sun"], ["rays"], ["sun"]], seen)
            await click(*spot); u = await unit()
            await pg.keyboard.down("Control"); await drag(spot, (spot[0] + 150, spot[1] - 100)); await pg.keyboard.up("Control"); adj = (await proj_now()).get("elements") or {}
            rec("E9 選到底下的光芒後從同一個位置拖：移動的是光芒，太陽沒動", await picked() == ["rays"] and near((adj.get("rays", {}).get("dx", 0), adj.get("rays", {}).get("dy", 0)), (150, -100), 2 * u + 1) and "sun" not in adj, adj)
            await at(2, 0, 0); await click(250, 190); await click(250, 190)
            rec("E9 底下沒有別的元素時再點一下：選取不變", await picked() == ["dot"], await picked())
            await click(*spot, shift=True); both = await picked(); await click(*spot, shift=True)
            rec("E9 按住 Shift 點的規則照舊：加進選取、再點拿掉", both == ["dot", "sun"] and await picked() == ["dot"], (both, await picked()))
            await click(*spot); await view(); await pg.click("#selBox .h.nw")
            rec("E9 在選取框的把手上點一下（沒有拖）：選取不變", await picked() == ["sun"], await picked())
            await at(1, 1, 3.0, "type"); cx, cy = center((await els())["underline"]["box"]); seen = []
            for _ in range(8): await click(cx, cy); seen.append(await picked())
            rec("E9 大字排版被字蓋住的重點短線：在它上面連點，輪得到它", ["underline"] in seen, seen)
        await safe("E9 再點一下選底下", e9)

        async def e10():
            spot = (706, 871)
            await at(2, 0, 0); await click(*spot); await click(*spot); one = await picked()
            await click(*spot, shift=True); both = await picked(); await click(*spot, shift=True)
            rec("E10 選著底下的光芒，按住 Shift 點同一個位置：最上面的太陽加進選取，再點拿掉太陽", one == ["rays"] and both == ["rays", "sun"] and await picked() == ["rays"], (one, both, await picked()))
            await at(2, 0, 0); await click(*spot); await click(*spot); await click(250, 190, shift=True); multi = await picked(); await click(*spot)
            rec("E10 多選（光芒＋小圓）後不按 Shift 點太陽蓋住光芒的地方：只選太陽", multi == ["dot", "rays"] and await picked() == ["sun"], (multi, await picked()))
            await at(2, 0, 0); await click(*spot); await click(*spot); await p.ev("__app.selectElement('dot')"); await p.ev("__app.selectElement('rays')"); seen = [await picked()]
            for _ in range(2): await click(*spot); seen.append(await picked())
            rec("E10 從清單選了底下的光芒，再去點蓋在它上面的太陽：選到太陽；同一個位置再點一下才換成光芒", seen == [["rays"], ["sun"], ["rays"]], seen)
            await at(2, 0, 0); await click(*spot); await p.ev("__app.selectElement('dot')"); await p.ev("__app.selectElement('sun')"); seen = []
            for _ in range(2): await click(*spot); seen.append(await picked())
            rec("E10 從清單選了太陽，再點它一下：還是太陽；同一個位置再點一下換成光芒", seen == [["sun"], ["rays"]], seen)
        await safe("E10 疊著的地方其他規則照舊", e10)

        rec("沒有頁面錯誤", not p.log, p.log[:3])
        if b: await b.close()
asyncio.run(main()); finish()
