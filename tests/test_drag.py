"""預覽上直接拖（階段 2）：python3 tests/test_drag.py（示意文字）
驗收條件：
D1  在預覽上點元素會選到最上面那一個，出現選取框與把手，元素清單那一列標成選取中；點空白處取消選取。
D2  拖動元素：位置改變（dx、dy 等於拖的距離，單位是 1920×1080 的座標）、畫面改變；一次拖曳是一筆歷史紀錄，還原回到原位。
D3  拖動時按住 Shift 只走水平或垂直；靠近畫布中心會吸附並顯示吸附線。
D4  拉角落把手等比縮放：倍率＝游標到軸心的距離比。
D5  拖旋轉把手旋轉：角度＝游標繞軸心轉過的角度；按住 Shift 每 15 度一格。
D6  位置、大小、旋轉作用在整個元素上：移動讓它這一格的範圍平移；縮放與旋轉以它整個活動範圍的中心為軸；其他元素照舊。
D7  鋪滿畫面的元素（大字排版的整面閃色、剪紙拼貼的背景）選不到、不能移動；設定裡寫了位置會略過並提醒。
D8  字幕整體也能拖。
D9  選「只有這一段」時，拖動記在段落上。
D10 設定 JSON 的 dx、dy、scale、rotate：貼上會套用，超出範圍夾回範圍內，不是數字就不套用並說明哪一欄。
D11 元素清單在「畫面元素」分頁（和預覽並排）；點名稱會選取；「細部」的位置、大小、旋轉欄位會改設定。
D12 選取框不會進到抽格與匯出的影片；背景影片和字幕影片裡，同一個元素在同一個時間的位置一樣。
另外用 python3 tests/test_golden.py --ref <實作前的 commit> 確認：沒有任何調整時，畫面和實作前一格不差。"""
import asyncio, sys, pathlib, json, math
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
from PIL import ImageStat

def amount(a, b): return sum(ImageStat.Stat(ImageChops.difference(a, b)).sum)
def fence(kind, body): return "```" + kind + "\n" + body + "\n```"
def center(b): return ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)
def size(b): return (b[2] - b[0], b[3] - b[1])
def near(a, b, tol): return all(abs(x - y) <= tol for x, y in zip(a, b))
def turn(pt, about, deg):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg)); x, y = pt[0] - about[0], pt[1] - about[1]
    return (about[0] + c * x - s * y, about[1] + s * x + c * y)

async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)
        pg, out = p.pg, OUT / "drag"
        async def els(): return {e["id"]: e for e in await p.ev("__app.elements()")}
        async def set_el(i, patch, scope="song"): await p.ev("a=>__app.setElement(a[0],a[1],a[2])", [i, patch, scope])
        async def proj_now(): return await p.ev("__app.project")
        async def sel(): return await p.ev("__app.selection()")
        async def at(si, ci, t, style="riso"):
            assert await p.ev("x=>__app.load(x)", proj(style))
            await p.ev("(()=>{const b=document.querySelector('#elScope button');if(b)b.click()})()")
            await p.ev(f"__app.select({si},{ci})"); await p.ev(f"__app.seek({t})")
        async def view():
            await p.ev("document.querySelector('#view').scrollIntoView({block:'center'})")
            return await p.ev("(()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
        async def cpt(x, y): R = await view(); return (R[0] + x / 1920 * R[2], R[1] + y / 1080 * R[3])
        async def unit(): R = await view(); return 1920 / R[2]
        async def click(x, y): await pg.mouse.click(*await cpt(x, y))
        async def press(a): await pg.mouse.move(*await cpt(*a)); await pg.mouse.down()
        async def drag(a, c, shift=False, hold=False):
            await press(a)
            if shift: await pg.keyboard.down("Shift")
            await pg.mouse.move(*await cpt(*c), steps=8)
            if hold: return
            await pg.mouse.up()
            if shift: await pg.keyboard.up("Shift")
        async def handle(name):
            r = await p.ev("n=>{const h=document.querySelector('#selBox .h.'+n).getBoundingClientRect(),v=document.querySelector('#view').getBoundingClientRect();return [(h.left+h.width/2-v.left)/v.width*1920,(h.top+h.height/2-v.top)/v.height*1080]}", name)
            return tuple(r)
        async def safe(name, fn):
            try: await fn()
            except Exception as e: rec(name, False, "例外：" + str(e).split("\n")[0][:200])
            finally:
                await pg.mouse.up(); await pg.keyboard.up("Shift")

        async def d1():
            await at(0, 0, 1.0); e = await els()
            await click(1500, 95); s = await sel()
            rec("D1 點橫條：選到橫條，選取框就是它這一格的範圍", s and s["id"] == "bar" and near(s["box"], e["bar"]["box"], 0.5) and near(e["bar"]["box"], [1240, 70, 1860, 120], 0.5), s)
            shown = await p.ev("(()=>{const b=document.querySelector('#selBox');return !!b&&!b.hidden&&b.querySelectorAll('.h').length})()")
            row = await p.ev("[...document.querySelectorAll('#elList .elrow.sel')].map(r=>r.dataset.id)")
            rec("D1 選取框有四個角落把手和一個旋轉把手；清單的「橫條」標成選取中；切到「畫面元素」分頁", shown == 5 and row == ["bar"] and await p.ev("__app.currentTab()") == "el", (shown, row))
            await click(300, 1010); s = await sel()
            rec("D1 色票條疊在大圓上面的地方：選到上面的色票條", s and s["id"] == "swatches", s and s["id"])
            await click(960, 540)
            rec("D1 點空白處：取消選取，選取框消失", await sel() is None and await p.ev("document.querySelector('#selBox').hidden"), await sel())
        await safe("D1 選取", d1)

        async def d2():
            await at(0, 0, 1.0); base = await p.grab(1.0); e0 = await els(); n0 = len((await p.ev("__app.history()"))["labels"]); u = await unit()
            await click(1690, 180); s = await sel()
            await drag((1690, 180), (1390, 380)); e1 = await els(); pj = await proj_now(); h = await p.ev("__app.history()")
            moved = await p.grab(1.0, out / "ring_moved.png")
            adj = (pj.get("elements") or {}).get("ring", {})
            rec("D2 拖圓環往左 300、往下 200：設定記下 dx、dy", s and s["id"] == "ring" and near((adj.get("dx", 0), adj.get("dy", 0)), (-300, 200), 2 * u + 1), adj)
            rec("D2 圓環這一格的範圍跟著平移，其他元素的範圍照舊，畫面改變", near(center(e1["ring"]["box"]), (1690 + adj.get("dx", 0), 180 + adj.get("dy", 0)), 0.5) and all(e1[k]["box"] == e0[k]["box"] for k in e0 if k != "ring") and amount(base, moved) > 0, (e1["ring"]["box"], amount(base, moved)))
            rec("D2 一次拖曳是一筆歷史紀錄（提到元素名稱）", len(h["labels"]) == n0 + 1 and "圓環" in h["labels"][-1], h["labels"][-2:])
            await p.ev("__app.undo()"); pj = await proj_now(); await p.ev("__app.seek(1.0)"); e2 = await els()
            rec("D2 還原：回到原位", not (pj.get("elements") or {}).get("ring") and near(e2["ring"]["box"], e0["ring"]["box"], 0.5), (pj.get("elements"), e2["ring"]["box"]))
        await safe("D2 拖動", d2)

        async def d3():
            await at(0, 0, 1.0); await click(1690, 180)
            await drag((1690, 180), (1890, 215), shift=True); adj = (await proj_now())["elements"]["ring"]; u = await unit()
            rec("D3 按住 Shift 往右拖：只有水平移動", near((adj.get("dx", 0),), (200,), 2 * u + 1) and adj.get("dy", 0) == 0, adj)
            await at(0, 0, 1.0); await click(1690, 180)
            await drag((1690, 180), (966, 205), hold=True)
            guide = await p.ev("(()=>{const g=document.querySelector('#snapV');return !!g&&!g.hidden})()")
            await pg.mouse.up(); adj = (await proj_now())["elements"]["ring"]; e = await els()
            rec("D3 拖到離畫布中心 6 以內：顯示垂直吸附線，放開後中心剛好在 960", guide and abs(center(e["ring"]["box"])[0] - 960) < 0.01 and adj["dx"] == -730, (guide, adj, e["ring"]["box"]))
            rec("D3 放開後吸附線消失", await p.ev("document.querySelector('#snapV').hidden"))
        await safe("D3 鎖軸與吸附", d3)

        async def d4():
            await at(0, 0, 1.0); await click(1690, 180); s = await sel(); A = s["anchor"]; h0 = await handle("se")
            target = (A[0] + 1.5 * (h0[0] - A[0]), A[1] + 1.5 * (h0[1] - A[1]))
            await drag(h0, target); adj = (await proj_now())["elements"]["ring"]; e = await els()
            rec("D4 把角落把手拉到離軸心 1.5 倍遠：scale 約 1.5，位置沒有另外位移", abs(adj.get("scale", 1) - 1.5) < 0.04 and "dx" not in adj and "dy" not in adj, adj)
            rec("D4 圓環這一格的範圍變成 1.5 倍大", near(size(e["ring"]["box"]), (254 * adj.get("scale", 1), 254 * adj.get("scale", 1)), 0.5), size(e["ring"]["box"]))
        await safe("D4 縮放", d4)

        async def d5():
            await at(0, 0, 1.0); await click(1690, 180); s = await sel(); A = s["anchor"]; h0 = await handle("rot")
            await drag(h0, turn(h0, A, 30)); adj = (await proj_now())["elements"]["ring"]
            rec("D5 把旋轉把手繞軸心拖 30 度：rotate 約 30", abs(adj.get("rotate", 0) - 30) < 2, adj)
            await at(0, 0, 1.0); await click(1690, 180); s = await sel(); A = s["anchor"]; h0 = await handle("rot")
            await drag(h0, turn(h0, A, 40), shift=True); adj = (await proj_now())["elements"]["ring"]
            rec("D5 按住 Shift 拖 40 度：跳到 45 度", adj.get("rotate") == 45, adj)
        await safe("D5 旋轉", d5)

        async def d6():
            await at(0, 0, 1.0); e0 = await els(); T = (await p.ev("__app.territory()"))["bar"]; A = center(T); c0 = center(e0["bar"]["box"])
            rec("D6 橫條的活動範圍涵蓋它會跳到的四個位置", near(T, [60, 60, 1880, 1030], 0.5), T)
            await set_el("bar", {"dx": 100, "dy": 50}); e = await els()
            rec("D6 dx 100、dy 50：這一格的範圍平移 (100, 50)", near(e["bar"]["box"], [1340, 120, 1960, 170], 0.5), e["bar"]["box"])
            await set_el("bar", {"dx": 0, "dy": 0, "scale": 2}); e = await els()
            rec("D6 scale 2：寬高變兩倍，中心離軸心的距離也變兩倍", near(size(e["bar"]["box"]), (1240, 100), 0.5) and near(center(e["bar"]["box"]), (A[0] + 2 * (c0[0] - A[0]), A[1] + 2 * (c0[1] - A[1])), 0.5), e["bar"]["box"])
            await set_el("bar", {"scale": 1, "rotate": 90}); e = await els(); big = await p.grab(1.0, out / "bar_rot90.png")
            rec("D6 rotate 90：寬高互換，中心繞軸心轉 90 度", near(size(e["bar"]["box"]), (50, 620), 0.5) and near(center(e["bar"]["box"]), turn(c0, A, 90), 0.5), e["bar"]["box"])
            rec("D6 調整橫條時，其他元素的範圍照舊", all(e[k]["box"] == e0[k]["box"] for k in e0 if k != "bar"), {k: e[k]["box"] for k in e if k != "bar"})
        await safe("D6 位置大小旋轉的算法", d6)

        async def d7():
            await at(1, 0, 1.0, "type"); e = await els()
            rec("D7 整面閃色標成固定，其他元素沒有", e["wash"]["fixed"] is True and e["disc"]["fixed"] is False, {k: v["fixed"] for k, v in e.items()})
            ok = await p.ev("__app.selectElement('wash')")
            rec("D7 整面閃色選不到", ok is False and await sel() is None, (ok, await sel()))
            cfg = proj("type", elements={"wash": {"dx": 50, "opacity": 0.5}})
            ok = await p.ev("t=>__app.paste(t)", fence("json", json.dumps(cfg, ensure_ascii=False))); st = await p.ev("__app.status()"); pj = await proj_now()
            rec("D7 設定裡替整面閃色寫 dx：略過並提醒，透明度照常套用", ok and pj["elements"]["wash"] == {"opacity": 0.5} and "wash" in st and "略過" in st, (pj.get("elements"), st[-120:]))
            await at(0, 0, 1.0, "paper"); e = await els(); await click(960, 540)
            rec("D7 剪紙拼貼的背景是固定的，點預覽選不到", e["bg"]["fixed"] is True and await sel() is None, (e["bg"]["fixed"], await sel()))
        await safe("D7 鋪滿畫面的元素", d7)

        async def d8():
            await at(2, 1, 4.0); base = await p.grab(4.0); e0 = await els()
            await click(960, 500); s = await sel()
            await drag((960, 500), (960, 650)); adj = ((await proj_now()).get("elements") or {}).get("text", {}); e = await els(); u = await unit()
            moved = await p.grab(4.0, out / "text_moved.png")
            rec("D8 在字幕影片上點字：選到字幕；往下拖 150，設定記下 dy", s and s["id"] == "text" and near((adj.get("dy", 0),), (150,), 2 * u + 1) and abs(adj.get("dx", 0)) <= 2 * u + 1, (s and s["id"], adj))
            rec("D8 字幕的範圍往下移，背景的元素照舊，畫面改變", near(center(e["text"]["box"]), (center(e0["text"]["box"])[0] + adj.get("dx", 0), center(e0["text"]["box"])[1] + adj.get("dy", 0)), 0.5) and e["sun"]["box"] == e0["sun"]["box"] and amount(base, moved) > 0, e["text"]["box"])
        await safe("D8 字幕整體", d8)

        async def d9():
            await at(0, 0, 1.0); await p.ev("__app.tab('el')"); await pg.click("#elScope button:nth-child(2)")
            await click(1690, 180); await drag((1690, 180), (1500, 300)); pj = await proj_now()
            rec("D9 選「只有這一段」再拖：位置記在段落上，整首歌沒有", "dx" in (pj["sections"][0].get("elements") or {}).get("ring", {}) and "ring" not in (pj.get("elements") or {}), (pj.get("elements"), pj["sections"][0].get("elements")))
        await safe("D9 段落範圍", d9)

        async def d10():
            await at(2, 0, 1.0)
            cfg = proj("riso", elements={"sun": {"dx": 120, "dy": -40, "scale": 1.2, "rotate": 15}, "dot": {"scale": 99, "rotate": 370}})
            ok = await p.ev("t=>__app.paste(t)", fence("json", json.dumps(cfg, ensure_ascii=False))); st = await p.ev("__app.status()"); pj = await proj_now()
            rec("D10 貼上帶 dx、dy、scale、rotate 的設定：套用", ok and st.startswith("已套用") and pj["elements"]["sun"] == {"dx": 120, "dy": -40, "scale": 1.2, "rotate": 15}, (st[:40], pj.get("elements")))
            rec("D10 scale 99 夾成 5；rotate 370 換成 10", pj["elements"]["dot"] == {"scale": 5, "rotate": 10}, pj["elements"].get("dot"))
            bad = proj("riso", elements={"sun": {"dx": "右邊一點"}})
            ok = await p.ev("t=>__app.paste(t)", fence("json", json.dumps(bad, ensure_ascii=False))); st = await p.ev("__app.status()")
            rec("D10 dx 不是數字：不套用，說明是 elements.sun.dx", ok is False and "elements.sun.dx" in st and "沒有套用" in st, st[:140])
            sk = await p.ev("__app.skill()")
            rec("D10 給 AI 的說明寫了 dx、dy、scale、rotate 與 fixed", all(f"`{k}`" in sk for k in ("dx", "dy", "scale", "rotate", "fixed")), [k for k in ("dx", "dy", "scale", "rotate", "fixed") if f"`{k}`" not in sk])
        await safe("D10 設定 JSON", d10)

        async def d11():
            await at(0, 0, 1.0)
            tab = await p.ev("(()=>{const t=document.querySelector('#tab-el');return t&&t.textContent.trim()})()")
            rec("D11 有「畫面元素」分頁；元素清單在這個分頁，不在「自己調」", tab == "畫面元素" and await p.ev("!!document.querySelector('#pane-el #elList')&&!document.querySelector('#pane-self #elList')"), tab)
            await p.ev("__app.tab('el')"); R = await view()
            side = await p.ev("(()=>{const a=document.querySelector('#view').getBoundingClientRect(),b=document.querySelector('#elList').getBoundingClientRect();return [a.top,a.bottom,b.top,a.right,b.left]})()")
            rec("D11 清單和預覽並排：清單的開頭落在預覽的高度範圍內、在預覽右邊", side[0] - 60 <= side[2] <= side[1] and side[4] >= side[3], side)
            await pg.click("#elList .elrow[data-id=ring] .elname"); s = await sel()
            rec("D11 點清單上的名稱：選取那個元素", s and s["id"] == "ring" and await p.ev("document.querySelector('#elList .elrow[data-id=ring]').classList.contains('sel')"), s and s["id"])
            await pg.click("#elList .elrow[data-id=ring] .elmore")
            await pg.fill("#elList .elrow[data-id=ring] .elnum[data-k=dx]", "-120"); await pg.fill("#elList .elrow[data-id=ring] .elnum[data-k=scale]", "150"); await pg.fill("#elList .elrow[data-id=ring] .elnum[data-k=rotate]", "30")
            await p.wait("((__app.project.elements||{}).ring||{}).rotate===30"); adj = (await proj_now())["elements"]["ring"]
            rec("D11 「細部」填位置 -120、大小 150%、旋轉 30：設定記下 dx -120、scale 1.5、rotate 30", adj == {"dx": -120, "scale": 1.5, "rotate": 30}, adj)
        await safe("D11 畫面元素分頁", d11)

        async def d12():
            await at(2, 0, 2.0); plain = await p.grab(2.0)
            await p.ev("__app.selectElement('sun')"); picked = await p.grab(2.0); ex = await p.ev("__app.exportTest(0.3)")
            rec("D12 選取中抽格：畫面和沒選取時一格不差；匯出正常", (await sel())["id"] == "sun" and diff(plain, picked, 1) == 0 and ex["ftyp"] == "ftyp", (diff(plain, picked, 1), ex))
            await set_el("sun", {"scale": 1.3, "rotate": 20}); await p.ev("__app.seek(2.0)"); in_bg = (await els())["sun"]["box"]
            await p.ev("__app.select(2,1)"); await p.ev("__app.seek(2.0)"); in_sub = (await els())["sun"]["box"]
            rec("D12 放大並旋轉太陽：背景影片和字幕影片在第 2 秒的位置一樣", near(in_bg, in_sub, 0.01) and size(in_bg)[0] > 0, (in_bg, in_sub))
        await safe("D12 匯出與一致性", d12)

        rec("沒有頁面錯誤", not p.log, p.log[:3])
        if b: await b.close()
asyncio.run(main()); finish()
