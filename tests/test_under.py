"""字幕底下的背景跟著段落選的背景走（x.bg / x.under）：python3 tests/test_under.py（示意文字）
每個內建風格：同一支字幕放在平靜／累積／高潮三種段落，畫面要不一樣；截圖存 q/under/。"""
import asyncio, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
from PIL import ImageChops
res = []
def rec(n, ok, d=""): res.append((n, bool(ok))); print(("✔" if ok else "✘"), n, "｜", str(d)[:200], flush=True)
def diff(a, b): return sum(ImageChops.difference(a, b).convert("L").histogram()[24:])
STYLES = ["swiss", "paper", "type", "bauhaus", "riso", "ink", "nave", "field", "sky", "field_photo", "sky_photo"]
G = "這是第一行示意文字\n這是第二行示意文字"
def proj(st, sub):
    lyr = G if sub == "gentle" else "這是[示]意文字"
    return {"format": "worship-motion/1", "title": "底圖", "style": st, "bpm": 120,
            "sections": [{"name": n, "background": n, "subtitle": sub, "lyrics": lyr} for n in ["calm", "build", "peak"]]}
async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)
        out = ROOT / "q" / "under"
        for st in STYLES:
            for sub, t in [("gentle", 4.0), ("flashy", 3.0)]:
                ok = await p.ev("x=>__app.load(x)", proj(st, sub))
                ims = [await p.shot(i, 1, t, out / f"{st}_{sub}_{n}.png") for i, n in enumerate(["calm", "build", "peak"])]
                d = [diff(ims[0], ims[1]), diff(ims[1], ims[2]), diff(ims[0], ims[2])]
                rec(f"{st}・{sub}：平靜／累積／高潮三種段落的字幕底圖不一樣", ok and min(d) > 3000, d)
        # 背景影片本身：大字排版高潮左邊多了元素，歌詞區不動
        await p.ev("x=>__app.load(x)", proj("type", "gentle"))
        await p.shot(2, 0, 4.0, out / "type_peak_bg.png")
        rec("沒有頁面錯誤", not p.log, p.log[:3])
        if b: await b.close()
    n = sum(ok for _, ok in res); print(f"\n通過 {n} / {len(res)}"); sys.exit(0 if n == len(res) else 1)
asyncio.run(main())
