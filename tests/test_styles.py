"""每個內建風格都拆成元素：python3 tests/test_styles.py（示意文字）
驗收條件：
S1 瑞士網格、剪紙拼貼、包浩斯幾何、墨染、光柱、天空的背景影片：元素清單是一個個有名字的元素，沒有整塊的「背景」。
S2 這六個風格的字幕影片：清單＝段落背景的元素＋這種字幕自己的元素，沒有整塊的「字幕」。
S3 每個不固定、這一格有畫東西的元素都能單獨隱藏：它畫 0 個，其他元素畫的數量不變。
S4 每個風格挑一個背景元素、一個字幕元素移動：只有它的範圍跟著移動，其他元素的範圍不變，畫面改變。
S5 鋪滿畫面的元素（網格、底色漸層、天色漸層、開場掃屏）是固定的，在預覽上選不到，但能隱藏；瑞士網格的「網格」調透明度畫面會變。
S6 元素自己的顏色只影響它：墨染的墨團換色後遠山不變；瑞士網格的圓弧換色後色塊不變。
S7 油彩：背景是整塊的「背景」（3D 筆觸），字幕拆成歌詞、第二語言。
S8 給 AI 的說明列出每個內建風格的元素名稱。
另外用 python3 tests/test_golden.py --ref <實作前的 commit> 確認：沒有任何調整時，畫面和實作前一格不差。"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
from PIL import ImageStat

def amount(a, b): return sum(ImageStat.Stat(ImageChops.difference(a, b)).sum)
def near(a, b, tol): return all(abs(x - y) <= tol for x, y in zip(a, b))
def moved_by(b0, b1, dx, dy, tol=1.5): return bool(b0 and b1) and near(b1, [b0[0] + dx, b0[1] + dy, b0[2] + dx, b0[3] + dy], tol)

BG = {
    "swiss": {"calm": ["grid", "block", "rings", "blocks", "rule", "scan", "lights", "sequencer"],
              "build": ["grid", "block", "rings", "lights", "progress", "sequencer", "blocks", "scan"],
              "peak": ["grid", "darkband", "rings", "speed", "slash", "streak", "lights", "sequencer"]},
    "paper": {"calm": ["sheets", "strips", "sunrise", "confetti"], "build": ["sheets", "dots", "sunrise", "confetti"], "peak": ["rays", "sun", "confetti", "belt"]},
    "bauhaus": {"calm": ["half", "quarter", "tri", "bar", "ring", "dot", "slash", "square", "orbit", "beats"],
                "build": ["half", "quarter", "tri", "bar", "ring", "dot", "slash", "square", "tri2", "disc", "lines", "half2", "dial", "beats"],
                "peak": ["rays", "tri", "bar", "ring", "dot", "slash", "square", "brokenRing", "sun", "beats"]},
    "ink": {"calm": ["shade", "blots", "seal"], "build": ["shade", "blots", "seal", "hills", "moreBlots", "brush"], "peak": ["canopy", "hills", "blots", "seal", "brush"]},
    "nave": {"calm": ["ground", "windows", "beams"], "build": ["ground", "windows", "beams"], "peak": ["ground", "windows", "glow", "beams"]},
    "sky": {"calm": ["sky", "high", "hills", "low", "banks"], "build": ["sky", "high", "hills", "low", "banks"], "peak": ["sky", "rays", "high", "hills", "low", "banks"]},
}
SUB = {
    "swiss": {"flashy": ["keyword", "rail", "chars", "subline", "wipe"], "gentle": ["plate", "lyrics", "underline"]},
    "paper": {"flashy": ["stickers", "chars", "subline", "wipe"], "gentle": ["tallBelt", "lyrics", "underline"]},
    "bauhaus": {"flashy": ["charShapes", "chars", "subline", "wipe"], "gentle": ["plate", "lyrics", "ornament"]},
    "ink": {"flashy": ["halo", "chars", "subline", "mark"], "gentle": ["lyrics", "stroke"]},
    "nave": {"flashy": ["shaft", "chars", "subline", "goldline"], "gentle": ["lyrics", "underline"]},
    "sky": {"flashy": ["chars", "subline", "goldline"], "gentle": ["lyrics", "underline"]},
}
FIXED = {"swiss": ["grid", "wipe"], "paper": ["wipe"], "bauhaus": ["wipe"], "ink": [], "nave": ["ground"], "sky": ["sky"]}
MOVE = {"swiss": ("rings", "lyrics"), "paper": ("sun", "lyrics"), "bauhaus": ("sun", "lyrics"), "ink": ("hills", "lyrics"), "nave": ("beams", "lyrics"), "sky": ("hills", "lyrics")}
SECTION = {"calm": 0, "build": 1, "peak": 2}

async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)
        pg, out = p.pg, OUT / "styles"
        async def els(): return {e["id"]: e for e in await p.ev("__app.elements()")}
        async def set_el(i, patch, scope="song"): await p.ev("a=>__app.setElement(a[0],a[1],a[2])", [i, patch, scope])
        async def show(si, ci, t): await p.ev(f"__app.select({si},{ci})"); await p.ev(f"__app.seek({t})")
        async def fresh(style):
            pj = proj(style); pj["sections"][1]["lyrics2"] = "Sample line one"
            assert await p.ev("x=>__app.load(x)", pj)
        async def view():
            await p.ev("document.querySelector('#view').scrollIntoView({block:'center'})")
            return await p.ev("(()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
        async def click(x, y): R = await view(); await pg.mouse.click(R[0] + x / 1920 * R[2], R[1] + y / 1080 * R[3])
        async def safe(name, fn):
            try: await fn()
            except Exception as e: rec(name, False, "例外：" + str(e).split("\n")[0][:200])

        for style in BG:
            async def lists():
                await fresh(style); got, seen = {}, {}
                for name, si in SECTION.items(): await show(si, 0, 1.0); seen.update(await els()); got[name] = list(await els())
                rec(f"S1 {style} 的背景影片：三種背景的元素清單", got == BG[style], got)
                await show(1, 1, 3.0); flashy = await els(); await show(2, 1, 4.0); gentle = await els()
                rec(f"S2 {style} 的字幕影片：背景的元素＋字幕的元素，沒有整塊的字幕", list(flashy) == BG[style]["build"] + SUB[style]["flashy"] and list(gentle) == BG[style]["peak"] + SUB[style]["gentle"], (list(flashy), list(gentle)))
                named = {**flashy, **gentle}
                rec(f"S2 {style} 的每個元素都有中文名稱", all(e["label"] and e["label"] != i for i, e in named.items()), {i: e["label"] for i, e in named.items()})
                fixed = sorted(i for i, e in {**seen, **named}.items() if e["fixed"])
                rec(f"S5 {style} 固定的元素", fixed == sorted(FIXED[style]), fixed)
            await safe(f"S1 {style} 清單", lists)

            async def hide():
                await fresh(style); bad = []
                for si, ci, t in ((0, 0, 1.0), (1, 0, 1.0), (2, 0, 1.0), (1, 1, 3.0), (2, 1, 4.0)):
                    await show(si, ci, t); before = await els()
                    for i, e in before.items():
                        if e["fixed"] or not e["drawn"]: continue
                        await set_el(i, {"visible": False}); now = await els()
                        if now[i]["drawn"] != 0 or any(now[k]["drawn"] != before[k]["drawn"] for k in before if k != i): bad.append((si, ci, i))
                        await set_el(i, {"visible": True})
                rec(f"S3 {style} 的每個元素都能單獨隱藏，其他元素照舊", not bad, bad)
            await safe(f"S3 {style} 隱藏", hide)

            async def move():
                bg_el, sub_el = MOVE[style]
                await fresh(style); await show(2, 0, 1.0); base = await p.grab(1.0); e0 = await els()
                await set_el(bg_el, {"dx": -90, "dy": -60}); e1 = await els(); pic = await p.grab(1.0)
                still = all(e0[k]["box"] == e1[k]["box"] for k in e0 if k != bg_el)
                rec(f"S4 {style} 移動背景的「{e0[bg_el]['label']}」：只有它的範圍移動，畫面改變", moved_by(e0[bg_el]["box"], e1[bg_el]["box"], -90, -60) and still and amount(base, pic) > 0, (e0[bg_el]["box"], e1[bg_el]["box"]))
                await fresh(style); await show(2, 1, 4.0); base = await p.grab(4.0); e0 = await els()
                await set_el(sub_el, {"dy": 120}); e1 = await els(); pic = await p.grab(4.0)
                still = all(e0[k]["box"] == e1[k]["box"] for k in e0 if k != sub_el)
                rec(f"S4 {style} 移動字幕的「{e0[sub_el]['label']}」：只有它的範圍移動，畫面改變", moved_by(e0[sub_el]["box"], e1[sub_el]["box"], 0, 120) and still and amount(base, pic) > 0, (e0[sub_el]["box"], e1[sub_el]["box"]))
            await safe(f"S4 {style} 移動", move)

        async def s5():
            await fresh("swiss"); await show(0, 0, 1.0); base = await p.grab(1.0)
            await set_el("grid", {"opacity": 0.3}); dim = await p.grab(1.0); await set_el("grid", {"opacity": 1, "visible": False}); hid = await p.grab(1.0)
            rec("S5 瑞士網格的「網格」：調淡畫面會變，隱藏變更多", 0 < amount(base, dim) < amount(base, hid), (amount(base, dim), amount(base, hid)))
            await fresh("nave"); await show(0, 0, 1.0); await p.ev("__app.editMode(true)"); await click(960, 700); s = await p.ev("__app.selection()")
            ok = await p.ev("__app.selectElement('ground')")
            rec("S5 光柱的「底色漸層」：在預覽上點不到、點名稱也選不到", s is None and ok is False, (s, ok))
            base = await p.grab(1.0); await set_el("ground", {"visible": False}); hid = await p.grab(1.0)
            rec("S5 「底色漸層」能隱藏", amount(base, hid) > 0 and (await els())["ground"]["drawn"] == 0, amount(base, hid))
        await safe("S5 固定的元素", s5)

        async def s6():
            await fresh("ink"); await show(1, 0, 1.0); base = await p.grab(1.0)
            await set_el("blots", {"colors": {"wash": "#3a6a8a", "ink": "#3a6a8a", "warm": "#3a6a8a"}}); blue = await p.grab(1.0)
            await set_el("blots", {"visible": False}); gone = await p.grab(1.0)
            await fresh("ink"); await show(1, 0, 1.0); await set_el("blots", {"visible": False}); plain = await p.grab(1.0)
            rec("S6 墨染的墨團換色：畫面改變；把墨團藏起來後，畫面和沒換色時藏起來一樣（遠山、更多墨團沒被換色）", amount(base, blue) > 0 and amount(gone, plain) == 0, (amount(base, blue), amount(gone, plain)))
            await fresh("swiss"); await show(0, 0, 1.0); base = await p.grab(1.0)
            await set_el("rings", {"colors": {"org": "#3a8a5a", "crm": "#3a8a5a"}}); green = await p.grab(1.0)
            await set_el("rings", {"visible": False}); gone = await p.grab(1.0)
            await fresh("swiss"); await show(0, 0, 1.0); await set_el("rings", {"visible": False}); plain = await p.grab(1.0)
            rec("S6 瑞士網格的圓弧換色：畫面改變；把圓弧藏起來後，畫面和沒換色時藏起來一樣（色塊沒被換色）", amount(base, green) > 0 and amount(gone, plain) == 0, (amount(base, green), amount(gone, plain)))
        await safe("S6 元素自己的顏色", s6)

        async def s7():
            pj = proj("oil"); pj["sections"][1]["lyrics2"] = "Sample line one"
            assert await p.ev("x=>__app.load(x)", pj)
            await show(0, 0, 1.0); bg = await els(); await show(1, 1, 3.0); flashy = await els(); await show(2, 1, 4.0); gentle = await els()
            rec("S7 油彩：背景是整塊的「背景」，字幕拆成歌詞、第二語言", list(bg) == ["bg"] and bg["bg"]["fixed"] and list(flashy) == ["bg", "line", "subline"] and list(gentle) == ["bg", "lyrics"] and flashy["line"]["label"] == "歌詞" and flashy["line"]["drawn"] == 1 and flashy["subline"]["drawn"] == 1, (list(bg), list(flashy), list(gentle)))
            await show(1, 1, 3.0); await set_el("line", {"dy": 200}); moved = await els()
            rec("S7 油彩的歌詞可以單獨移動，第二語言留在原位", moved_by(flashy["line"]["box"], moved["line"]["box"], 0, 200) and moved["subline"]["box"] == flashy["subline"]["box"], (flashy["line"]["box"], moved["line"]["box"]))
        await safe("S7 油彩", s7)

        async def s8():
            sk = await p.ev("__app.skill()"); line = next((l for l in sk.split("\n") if l.startswith("內建風格的元素")), ""); missing = []
            parts = {seg.strip().split(" ")[0]: seg for seg in (line.split("：", 1)[1] if "：" in line else "").split("｜")}
            for style in list(BG) + ["riso", "type", "oil"]:
                await p.ev("x=>__app.load(x)", proj(style)); seen = set()
                for si, ci in ((0, 0), (1, 0), (2, 0), (1, 1), (2, 1)):
                    if style == "oil" and ci == 0 and si: continue
                    await p.ev(f"__app.select({si},{ci})"); seen |= {e["id"] for e in await p.ev("__app.elements()")}
                seg = parts.get(style, "")
                missing += [(style, i) for i in sorted(seen) if f"`{i} " not in seg]
            rec("S8 給 AI 的說明列出每個內建風格用到的每個元素名稱", line and not missing, missing[:12])
        await safe("S8 給 AI 的說明", s8)

        rec("沒有頁面錯誤", not p.log, p.log[:3])
        if b: await b.close()
asyncio.run(main()); finish()
