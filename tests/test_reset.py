"""一鍵還原到初始狀態、長段落自動切支、All the Lights 四段結構：python3 tests/test_reset.py（示意文字）"""
import asyncio, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
res = []
def rec(n, ok, d=""): res.append((n, bool(ok))); print(("✔" if ok else "✘"), n, "｜", str(d)[:200], flush=True)
L = lambda n, w="示意": "\n".join(f"{w}第{i+1}行" for i in range(n))
async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw, (ROOT / "dist/songs/AllTheLights_大字排版.html").as_uri())
        pj = await p.ev("__app.project")
        rec("All the Lights 是 主歌／導歌／副歌／橋段", [s["name"] for s in pj["sections"]] == ["主歌", "導歌", "副歌", "橋段"], [s["name"] for s in pj["sections"]])
        txt = f"【副歌】\n{L(8,'副')}\n\n【主歌】\n{L(6,'主')}\n\n【導歌】\n{L(4,'導')}\n\n【橋段】\n{L(6,'橋')}"
        P2 = await p.ev("t=>__app.applySplitText(t)", txt)
        got = {s["name"]: s["lyrics"] for s in P2["sections"]}
        rec("貼上有標題：照名字對到各段", got["副歌"].startswith("副第1行") and got["主歌"].startswith("主第1行") and got["導歌"].startswith("導第1行") and got["橋段"].startswith("橋第1行"), got)
        await p.ev("__app.select(0,0)"); sl = await p.ev("__app.slides()")
        rec("主歌 6 行（收斂）→ 每支 2–3 行、不丟行", sum(x.count("\n") + 1 for x in sl) == 6 and all(x.count("\n") <= 2 for x in sl), sl)
        # 直接在歌詞框打 8 行（沒空行）也不丟行
        pj = await p.ev("__app.project"); pj["sections"][2]["lyrics"] = L(8); await p.ev("x=>__app.load(x)", pj)
        await p.ev("__app.select(2,0)"); sl = await p.ev("__app.slides()")
        rec("一組 8 行（沒空行）→ 3、3、2 三支", [x.count("\n") + 1 for x in sl] == [3, 3, 2], sl)
        # 一鍵還原
        await p.ev("()=>{__app.resetSong(); return 1}"); await p.pg.wait_for_timeout(300)
        d = await p.ev("__app.dialog()"); rec("還原前先問", d["open"] and "初始狀態" in d["title"], d["title"])
        await p.ev("__app.answer('ok')"); await p.pg.wait_for_timeout(1500)
        pj = await p.ev("__app.project")
        rec("還原到初始狀態：歌詞清空、四段", all(not s["lyrics"] for s in pj["sections"]) and len(pj["sections"]) == 4)
        h = await p.ev("__app.history()"); rec("還原記在歷史", h["labels"][h["pos"]] == "還原到初始狀態", h["labels"][-3:])
        await p.ev("__app.undo()"); await p.pg.wait_for_timeout(1500)
        pj = await p.ev("__app.project"); rec("按還原可以反悔", pj["sections"][2]["lyrics"].startswith("示意第1行"))
        # 換風格再還原，風格也回去；重新整理後初始狀態還在
        await p.pg.reload(); await p.pg.wait_for_function("window.__app&&__app.ready", timeout=120000)
        pj = await p.ev("__app.project"); pj["style"] = "swiss"; await p.ev("x=>__app.load(x)", pj)
        await p.ev("()=>{__app.resetSong(); return 1}"); await p.pg.wait_for_timeout(300); await p.ev("__app.answer('ok')"); await p.pg.wait_for_timeout(2000)
        pj = await p.ev("__app.project"); rec("重新整理後：換過風格也還原回大字排版", pj["style"] == "type", pj["style"])
        await p.ev("()=>{__app.resetSong(); return 1}"); await p.pg.wait_for_timeout(300)
        d = await p.ev("__app.dialog()"); rec("已經是初始狀態：不跳視窗", not d["open"])
        ui = await p.ev("[!!document.querySelector('#smReset'), !!document.querySelector('#histReset')]")
        rec("按鈕在「⋯」選單和歷史紀錄裡", all(ui))
        rec("沒有頁面錯誤", not p.log, p.log[:3])
        if b: await b.close()
    n = sum(ok for _, ok in res); print(f"\n通過 {n} / {len(res)}"); sys.exit(0 if n == len(res) else 1)
asyncio.run(main())
