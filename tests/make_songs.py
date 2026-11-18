"""用編輯器自己的存檔功能產生 dist/songs/（只有設定，不含歌詞）：python3 tests/make_songs.py"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
OUT = ROOT / "dist" / "songs"; OUT.mkdir(parents=True, exist_ok=True)
WAVES = (ROOT / "examples" / "waves.js").read_text()
HINT = "歌詞請自己貼：自己調 → 貼上整首歌詞。"
def S(name, bg, sub="gentle", **kw): return {"name": name, "background": bg, "subtitle": sub, "lyrics": "", "lyrics2": "", **kw}
ATL = {"format": "worship-motion/1", "title": "All the Lights", "style": "type", "bpm": 120, "note": HINT, "sections": [
    S("主歌", "calm"), S("導歌", "build", "flashy"), S("副歌", "peak"), S("橋段", "build")]}
FIX = {"format": "worship-motion/1", "title": "定睛在耶穌身上", "style": "waves", "bpm": 104, "note": HINT, "sections": [S("主歌", "storm"), S("副歌", "peak", "flashy")]}
def GRACE(style): return {"format": "worship-motion/1", "title": "數算恩典", "style": style, "bpm": 72, "note": HINT + "背景換位已調慢（每 8 拍）。", "sections": [
    S("主歌一", "calm", jumpBeats=8), S("副歌一", "build", jumpBeats=8), S("主歌二", "calm", jumpBeats=8), S("副歌二", "peak", jumpBeats=8)]}
def WORTHY(style):
    secs = []
    for base, bg in [("主歌一", "calm"), ("副歌", "peak"), ("主歌二", "calm"), ("橋段", "build")]:
        secs += [S(f"{base}（中）", bg), S(f"{base}（英）", bg, swapLang=True)]
    return {"format": "worship-motion/1", "title": "配得", "style": style, "bpm": 72,
            "note": HINT + "雙語：中文貼「歌詞」、英文貼「第二語言歌詞」；「（中）」「（英）」兩段貼一樣的內容（「（英）」段已設定大小對調：英文大、中文小）。整首貼上時選「中文當主要、英文當第二語言」會自動填好兩段。", "sections": secs}
def text_of(p): return ("```js\n" + WAVES + "\n```\n" if p["style"] == "waves" else "") + "```json\n" + json.dumps(p, ensure_ascii=False) + "\n```"
async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)
        async def build(songs, single_names, book_name):
            await p.ev("()=>{localStorage.clear()}")
            await p.pg.reload(); await p.pg.wait_for_function("window.__app&&__app.ready", timeout=120000)
            for i, s in enumerate(songs):
                ok = await p.ev("t=>__app.importText(t)", text_of(s)); assert ok, await p.pg.inner_text("#fileMsg")
            sg = await p.ev("__app.songs()"); assert [x["title"] for x in sg] == [s["title"] for s in songs], sg
            for i, name in enumerate(single_names):
                if not name: continue
                await p.ev(f"__app.switchSong({i})") if i != await p.ev("__app.active()") else None
                (OUT / name).write_text(await p.ev("__app.singleHTML('one')")); print("→", name, flush=True)
            await p.ev("__app.switchSong(0)")
            (OUT / book_name).write_text(await p.ev("__app.singleHTML('book')")); print("→", book_name, flush=True)
        await build([ATL, FIX, GRACE("field_photo"), WORTHY("sky_photo")], ["AllTheLights_大字排版.html", "定睛在耶穌身上_海面.html", "數算恩典_麥田寫實.html", "配得_天空寫實.html"], "四首詩歌.html")
        await build([ATL, FIX, GRACE("field"), WORTHY("sky")], [None, None, "數算恩典_麥田.html", "配得_天空.html"], "四首詩歌_平面版.html")
        print("錯誤", p.log[:4]); await b.close()
asyncio.run(main())
