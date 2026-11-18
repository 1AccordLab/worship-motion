"""模擬不允許 Worker 的環境（例如 AI 對話裡的預覽）：python3 tests/test_workermode.py"""
import asyncio, sys, pathlib, time
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
EX = ROOT / "examples"
BLOCK = {
  "blob": "(()=>{const W=window.Worker;window.Worker=function(u,o){if(String(u).startsWith('blob:'))throw new DOMException(\"Failed to construct 'Worker': blocked\",'SecurityError');return new W(u,o)};})()",
  "all":  "(()=>{window.Worker=function(){throw new DOMException(\"Failed to construct 'Worker': blocked\",'SecurityError')};})()",
}
MIN = (EX / "minimal.js").read_text()
res = []
def rec(n, ok, d=""): ok = bool(ok); res.append(ok); print(("✔" if ok else "✘"), n, "｜", str(d)[:200], flush=True)
async def run(kind, expect):
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True, args=FLAGS)
        ctx = await b.new_context(); await ctx.add_init_script(BLOCK[kind])
        _, _, p = await open_page(pw, ctx=ctx)
        mode = await p.ev("__app.workerMode ? __app.workerMode() : null")
        rec(f"[{kind}] 執行模式", mode == expect, mode)
        styles = await p.ev("__app.builtins()")
        for st in styles:
            await p.ev("p=>__app.load(p)", proj(st)); info = await p.ev("__app.sceneInfo()")
            a = await p.shot(0, 0, 2.0); c = await p.shot(1, 0, 1.5, ROOT / "q" / "wmode" / f"{kind}_{st}.png")
            rec(f"[{kind}] {st} 背景＋字幕", info["id"] == st and a.getbbox() and c.getbbox(), await p.ev("__app.notices()"))
        ok = await p.ev("c=>__app.pasteScene(c)", (EX / "canvas_hatch.js").read_text()); info = await p.ev("__app.sceneInfo()")
        rec(f"[{kind}] Canvas 畫層", ok and info["canvas"], await p.ev("__app.sceneStatus()"))
        ok = await p.ev("c=>__app.pasteScene(c)", (EX / "duotone_shader.js").read_text()); info = await p.ev("__app.sceneInfo()")
        rec(f"[{kind}] 自訂 shader", ok and info["shader"], await p.ev("__app.sceneStatus()"))
        ok = await p.ev("c=>__app.pasteScene(c)", MIN.replace("C.main));", "C.main);")); st = await p.ev("__app.sceneStatus()")
        rec(f"[{kind}] 語法錯 → 擋下", not ok, st)
        ok = await p.ev("c=>__app.pasteScene(c)", MIN.replace("const y = x.step", "const y = nope.step")); st = await p.ev("__app.sceneStatus()")
        rec(f"[{kind}] 執行錯 → 擋下並標第 5 行", (not ok) and "第 5 行" in st, st)
        rec(f"[{kind}] 沒有頁面錯誤", not [l for l in p.log if "pageerror" in l], p.log[:3])
        await b.close()
asyncio.run(run("blob", "data")); asyncio.run(run("all", "inline"))
print("通過", sum(res), "/", len(res))
