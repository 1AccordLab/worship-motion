"""一鍵還原到初始狀態、整首貼上依標題對段落、長段落自動切支：python3 tests/test_reset.py（示意文字）"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
L = lambda n, w="示意": "\n".join(f"{w}第{i+1}行" for i in range(n))
def sec(name, bg, sub="gentle"): return {"name": name, "background": bg, "subtitle": sub, "lyrics": "", "lyrics2": ""}
SONG = {"format": "worship-motion/1", "title": "示意歌", "style": "type", "bpm": 120,
        "sections": [sec("主歌", "calm"), sec("導歌", "build", "flashy"), sec("副歌", "peak"), sec("橋段", "build")]}
async def reset_and_confirm(p):
    await p.ev("()=>{window.__r=__app.resetSong(); return 1}"); await p.wait_dialog(); await p.ev("__app.answer('ok')"); await p.ev("window.__r")
async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)
        await p.ev("t=>__app.importText(t)", "```json\n" + json.dumps(SONG, ensure_ascii=False) + "\n```")
        pj = await p.ev("__app.project")
        rec("打開設定檔：主歌／導歌／副歌／橋段", [s["name"] for s in pj["sections"]] == ["主歌", "導歌", "副歌", "橋段"], [s["name"] for s in pj["sections"]])
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
        await p.ev("()=>{window.__r=__app.resetSong(); return 1}"); d = await p.wait_dialog(); rec("還原前先問", d["open"] and "初始狀態" in d["title"], d["title"])
        await p.ev("__app.answer('ok')"); await p.ev("window.__r")
        pj = await p.ev("__app.project")
        rec("還原到初始狀態：歌詞清空、四段", all(not s["lyrics"] for s in pj["sections"]) and len(pj["sections"]) == 4)
        h = await p.ev("__app.history()"); rec("還原記在歷史", h["labels"][h["pos"]] == "還原到初始狀態", h["labels"][-3:])
        await p.ev("__app.undo()")
        pj = await p.ev("__app.project"); rec("按還原可以反悔", pj["sections"][2]["lyrics"].startswith("示意第1行"))
        # 換風格再還原，風格也回去；重新整理後初始狀態還在
        await p.reload()
        pj = await p.ev("__app.project"); pj["style"] = "swiss"; await p.ev("x=>__app.load(x)", pj)
        await reset_and_confirm(p)
        pj = await p.ev("__app.project"); rec("重新整理後：換過風格也還原回打開時的風格", pj["style"] == "type", pj["style"])
        await p.ev("__app.resetSong()")
        d = await p.ev("__app.dialog()"); rec("已經是初始狀態：不跳視窗", not d["open"])
        ui = await p.ev("[!!document.querySelector('#smReset'), !!document.querySelector('#histReset')]")
        rec("按鈕在「⋯」選單和歷史紀錄裡", all(ui))
        rec("沒有頁面錯誤", not p.log, p.log[:3])
        if b: await b.close()
asyncio.run(main()); finish()
