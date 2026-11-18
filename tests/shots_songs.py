"""風格與介面截圖（示意文字）：python3 tests/shots_songs.py → q/songs/
墨染、光柱、海面、麥田（寫實／平面）、天空（寫實／平面）各三種背景＋收斂雙語；海面華麗；瑞士網格雙語（中大／英大）；
多分頁整體畫面與歷史紀錄面板（1440×900，無頭模式把 grab 的畫面疊到預覽位置）。另外量寫實版的效能。"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
OUT = ROOT / "q" / "songs"; OUT.mkdir(parents=True, exist_ok=True)
WAVES = (ROOT / "examples" / "waves.js").read_text()
OVERLAY = (ROOT / "tests" / "shots_ux.py").read_text().split('OVERLAY = """')[1].split('"""')[0]
L1, L2 = "這是第一行示意文字\n這是第二行示意文字", "Sample line one\nSample line two"
STY = [("墨染", "ink", ["calm", "build", "peak"]), ("光柱", "nave", ["calm", "build", "peak"]), ("海面", "waves", ["calm", "storm", "peak"]),
       ("麥田寫實", "field_photo", ["calm", "build", "peak"]), ("天空寫實", "sky_photo", ["calm", "build", "peak"]),
       ("麥田平面", "field", ["calm", "build", "peak"]), ("天空平面", "sky", ["calm", "build", "peak"])]
ZH = {"calm": "平靜", "build": "累積", "peak": "高潮", "storm": "風浪"}
def proj2(style, bgs, swap=False):
    return {"format": "worship-motion/1", "title": "示意", "style": style, "bpm": 120, "sections": [
        {"name": "A", "background": bgs[0], "subtitle": "gentle", "lyrics": L1, "lyrics2": L2, "swapLang": swap},
        {"name": "B", "background": bgs[1], "subtitle": "flashy", "lyrics": "這是第[一]行示意文字", "lyrics2": "Sample line one"},
        {"name": "C", "background": bgs[2], "subtitle": "gentle", "lyrics": L1}]}
async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw); pg = p.pg
        await pg.set_viewport_size({"width": 1440, "height": 900})
        await p.ev("c=>__app.pasteScene(c)", WAVES)
        perf = {}
        for zh, st, bgs in STY:
            assert await p.ev("x=>__app.load(x)", proj2(st, bgs)), await p.ev("__app.status()")
            for i, bg in enumerate(bgs): await p.shot(i, 0, 5.0, OUT / f"{zh}_{ZH[bg]}.png")
            await p.shot(0, 1, 4.0, OUT / f"{zh}_收斂雙語.png")
            if st == "waves": await p.shot(1, 1, 3.0, OUT / "海面_華麗雙語.png")
            if st.endswith("_photo"):
                await p.ev("__app.select(2,0)"); info = await p.ev("__app.sceneInfo()")
                perf[zh] = {"試跑估計一格_ms": round(info["est"] or 0), "解析度": "半" if info["half"] else "全", "實測一格_ms": round(await p.ev("__app.bench(4)"))}
            print(zh, "done", flush=True)
        for nm, swap in [("瑞士網格_收斂雙語_中大", False), ("瑞士網格_收斂雙語_英大", True)]:
            await p.ev("x=>__app.load(x)", proj2("swiss", ["calm", "build", "peak"], swap)); await p.shot(0, 1, 4.0, OUT / f"{nm}.png")
        # 多分頁整體畫面
        await p.ev("()=>localStorage.clear()"); await pg.reload(); await pg.wait_for_function("window.__app&&__app.ready", timeout=120000)
        for f in ["四首詩歌.html"]:
            await p.ev("t=>__app.importText(t)", (ROOT / "dist" / "songs" / f).read_text())
        await p.ev("__app.switchSong(3)"); await p.ev("__app.tab('self')")
        await pg.click("#introClose") if await pg.is_visible("#introClose") else None
        d = proj2("sky_photo", ["calm", "build", "peak"], True)
        await p.ev("()=>{const t=document.querySelector('#lyrAll');t.value='[Verse 1]\\n這是第一行示意文字\\nSample line one\\n這是第二行示意文字\\nSample line two'}")
        await p.ev("__app.select(1,0)"); png = await pg.evaluate(GRAB, 3.0); await p.ev("scrollTo(0,0)")
        await pg.evaluate(OVERLAY, png); await pg.wait_for_timeout(200); await pg.screenshot(path=str(OUT / "多分頁整體畫面.png"))
        # 歷史紀錄面板
        await p.ev("__app.tab('self')"); await pg.fill("#sLyrics", "這是第一行示意文字"); await pg.click("#secCard h2")
        await pg.click("#sBg button:nth-child(3)"); await p.ev("__app.applySplitText('[Verse 1]\\n這是第一行示意文字\\n\\n[Chorus]\\n這是第二行示意文字')")
        await pg.click("#tab-adv"); await p.ev("document.querySelector('#histCard').scrollIntoView({block:'center'})")
        await pg.click("#histList .hrow >> nth=2"); await pg.evaluate(OVERLAY, png); await pg.wait_for_timeout(200)
        await pg.screenshot(path=str(OUT / "歷史紀錄面板.png"))
        (OUT / "效能.json").write_text(json.dumps(perf, ensure_ascii=False, indent=1)); print("效能（SwiftShader）", perf)
        print("錯誤", p.log[:4]); await b.close()
asyncio.run(main())
