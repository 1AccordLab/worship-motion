"""名稱寬鬆：python3 tests/test_names.py（大小寫、-、_ 不計；id 自動轉小寫）"""
import asyncio, sys, json, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
MIN = (ROOT / "examples" / "minimal.js").read_text()
CODE = MIN.replace("id: 'bars'", "id: 'InkWash'").replace("subtitles: { gentle:", "subtitles: { verse1Text:")
async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)
        P = {"format": "worship-motion/1", "title": "命名", "style": "InkWash", "sections": [
            {"name": "主歌", "background": "Calm", "subtitle": "verse1Text", "lyrics": "這是第一行示意文字\n這是第二行示意文字"},
            {"name": "副歌", "background": "calm", "subtitle": "verse-1-text", "lyrics": "這是第三行示意文字"},
            {"name": "間奏", "background": "calm", "subtitle": "None"}]}
        text = "```js\n" + CODE + "\n```\n```json\n" + json.dumps(P, ensure_ascii=False) + "\n```"
        ok = await p.ev("t=>__app.paste(t)", text)
        info = await p.ev("__app.sceneInfo()"); proj = await p.ev("__app.project")
        rec("大寫 id、駝峰字幕名稱可以套用", ok and info["id"] == "inkwash", (info, await p.ev("__app.status()")))
        rec("JSON 名稱大小寫、- 不同也對得上", proj and [s["subtitle"] for s in proj["sections"]] == ["verse1Text", "verse1Text", "none"] and proj["sections"][0]["background"] == "calm", proj and [(s["background"], s["subtitle"]) for s in proj["sections"]])
        bad = MIN.replace("subtitles: { gentle:", "subtitles: { '1st':")
        ok2 = await p.ev("c=>__app.pasteScene(c)", bad)
        rec("數字開頭的名稱仍擋下並說明", (not ok2) and "英文字母開頭" in await p.ev("__app.sceneStatus()"), await p.ev("__app.sceneStatus()"))
        rec("沒有頁面錯誤", not [l for l in p.log if "pageerror" in l], p.log[:2])
        await b.close()
asyncio.run(main()); finish()
