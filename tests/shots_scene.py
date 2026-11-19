"""看一個風格：python3 tests/shots_scene.py 風格[,風格…] [輸出資料夾，預設 tests/out/scene]
每個風格抽 calm/build/peak 背景、gentle 雙語、flashy 雙語各一格（示意文字），並量歌詞安全區（x 420–1500、y 260–820）乾不乾淨。"""
import asyncio, sys, pathlib, json, time
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
from PIL import Image, ImageStat
BG = {"waves": ["calm", "storm", "peak"]}
def song(style, bgs):
    return {"format": "worship-motion/1", "title": "示意", "style": style, "bpm": 120, "sections": [
        {"name": "A", "background": bgs[0], "subtitle": "gentle", "lyrics": "這是第一行示意文字\n這是第二行示意文字", "lyrics2": "Sample line one\nSample line two"},
        {"name": "B", "background": bgs[1], "subtitle": "flashy", "lyrics": "這是第[一]行示意文字", "lyrics2": "Sample line one"},
        {"name": "C", "background": bgs[2], "subtitle": "gentle", "lyrics": "這是第一行示意文字\n這是第二行示意文字"}]}
def safe(im):
    z = im.crop((420, 260, 1500, 820)).convert("L"); st = ImageStat.Stat(z); return round(st.stddev[0], 1)
async def main():
    styles = sys.argv[1].split(","); out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else OUT / "scene")
    out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)
        for st in styles:
            bgs = BG.get(st, ["calm", "build", "peak"])
            ex = ROOT / "examples" / f"{st}.js"
            if st not in await p.ev("__app.builtins()") and ex.exists(): print("貼上", st, await p.ev("c=>__app.pasteScene(c)", ex.read_text()))
            ok = await p.ev("p=>__app.load(p)", song(st, bgs))
            if not ok: print(st, "載入失敗", await p.ev("__app.status()")); continue
            print(st, await p.ev("__app.sceneInfo()"), await p.ev("__app.notices()"))
            ims = []
            for name, si, ci, t in [(bgs[0], 0, 0, 3.0), (bgs[1], 1, 0, 5.0), (bgs[2], 2, 0, 9.0), ("gentle2", 0, 1, 4.0), ("flashy2", 1, 1, 3.5), ("gentle1", 2, 1, 4.0)]:
                t0 = time.time(); im = await p.shot(si, ci, t, out / f"{st}_{name}_{t}.png"); ims.append(im)
                print(f"  {name:8s} 安全區標準差 {safe(im):5.1f}  {time.time()-t0:.1f}s")
            sh = Image.new("RGB", (1440, 540))
            for i, im in enumerate(ims): sh.paste(im.resize((480, 270)), ((i % 3) * 480, (i // 3) * 270))
            sh.save(out / f"_sheet_{st}.png")
        print("錯誤", p.log[:4]); await b.close()
asyncio.run(main())
