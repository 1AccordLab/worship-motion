"""行為基準抽格：python3 tests/golden.py <輸出資料夾> [編輯器 html] [--examples 資料夾]
內建風格（編輯器裡沒有的略過）× 背景／字幕／雙語／大小對調，加上 examples/ 四個自訂風格，共約 200 張。只依賴 __app.load／select／grab／pasteScene。"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
L = "這是第[一]行示意文字\n這是第[二]行示意文字"
G = "這是第一行示意文字\n這是第二行示意文字"
EXAMPLES = ["minimal", "canvas_hatch", "duotone_shader", "waves"]
def gproj(st, bgs=("calm", "build", "peak"), bi=False, swap=False):
    secs = []
    for b in bgs:
        l2 = "Sample line one\nSample line two" if bi else ""
        secs.append({"name": b + "-bg", "background": b, "subtitle": "none"})
        secs.append({"name": b + "-f", "background": b, "subtitle": "flashy", "clipSeconds": 6, "lyrics": L, "lyrics2": l2, "swapLang": swap})
        secs.append({"name": b + "-g", "background": b, "subtitle": "gentle", "lyrics": G, "lyrics2": l2, "swapLang": swap})
    return {"format": "worship-motion/1", "title": "golden", "style": st, "bpm": 120, "sections": secs}
async def shoot(out, html=None, examples=None):
    out = pathlib.Path(out); out.mkdir(parents=True, exist_ok=True)
    examples = pathlib.Path(examples) if examples else ROOT / "examples"
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw, pathlib.Path(html).resolve().as_uri() if html else None)
        async def cap(tag, pj, nb):
            assert await p.ev("x=>__app.load(x)", pj), tag
            for i in range(nb):
                si = i * 3
                for t in (1.0, 5.5): await p.shot(si, 0, t, out / f"{tag}_s{i}_bg_{t}.png")
                await p.shot(si + 1, 0, 0.9, out / f"{tag}_s{i}_flashy_0.9.png"); await p.shot(si + 1, 0, 3.0, out / f"{tag}_s{i}_flashy_3.0.png")
                await p.shot(si + 2, 0, 4.0, out / f"{tag}_s{i}_gentle_4.0.png")
        have = set(await p.ev("__app.builtins()"))
        for st in (s for s in STYLES if s in have):
            await cap(st, gproj(st), 3)
            await cap(st + "_bi", gproj(st, ("peak",), True), 1)
            await cap(st + "_swap", gproj(st, ("peak",), True, True), 1)
        for ex in EXAMPLES:
            await p.ev("c=>__app.pasteScene(c)", (examples / f"{ex}.js").read_text())
            m = await p.ev("__app.project"); bgs = list(dict.fromkeys(s["background"] for s in m["sections"]))
            await p.ev("x=>__app.load(x)", {"format": "worship-motion/1", "title": "golden", "style": m["style"], "bpm": 120, "sections": [{"name": "s", "background": bgs[0], "subtitle": "none"}]})
            await p.shot(0, 0, 2.0, out / f"ex_{ex}.png")
        (out / "log.json").write_text(json.dumps(p.log, ensure_ascii=False))
        print("done", len(list(out.glob("*.png"))), "log", p.log[:3])
        await b.close()
if __name__ == "__main__":
    args = [a for a in sys.argv[1:]]
    ex = args.pop(args.index("--examples") + 1) if "--examples" in args else None
    if "--examples" in args: args.remove("--examples")
    asyncio.run(shoot(args[0], args[1] if len(args) > 1 else None, ex))
