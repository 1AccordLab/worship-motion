"""新介面截圖（1440×900）：python3 tests/shots_ux.py → q/ux/
無頭模式預覽 canvas 不畫，所以把 __app.grab 的畫面疊到 canvas 的位置再截圖。"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
OUT = ROOT / "q" / "ux"; OUT.mkdir(parents=True, exist_ok=True)
MIN = (ROOT / "examples" / "minimal.js").read_text()
SONG = {"format": "worship-motion/1", "title": "All the Lights", "style": "riso", "bpm": 120, "sections": [
    {"name": "主歌", "background": "calm", "subtitle": "none"},
    {"name": "導歌", "background": "build", "subtitle": "flashy", "clipSeconds": 6, "lyrics": "這是第[一]行示意文字\n這是第[二]行示意文字\n這是第[三]行示意文字\n這是第[四]行示意文字"},
    {"name": "副歌", "background": "peak", "subtitle": "gentle", "lyrics": "這是第一行示意文字\n這是第二行示意文字\n\n這是第三行示意文字\n第四行"}]}
OVERLAY = """(b64)=>{document.querySelectorAll('#ovl').forEach(x=>x.remove()); const c=document.querySelector('#view'); const r=c.getBoundingClientRect();
const i=document.createElement('img'); i.id='ovl'; i.src='data:image/png;base64,'+b64;
Object.assign(i.style,{position:'absolute',left:(r.left+scrollX)+'px',top:(r.top+scrollY)+'px',width:r.width+'px',height:r.height+'px',borderRadius:'4px',zIndex:5});
document.body.appendChild(i); return new Promise(res=>i.complete?res(1):i.onload=()=>res(1));}"""

async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)
        pg = p.pg; await pg.set_viewport_size({"width": 1440, "height": 900})
        async def frame(si, ci, t):
            await p.ev(f"__app.select({si},{ci})"); return await pg.evaluate(GRAB, t)
        async def overlay(png): await pg.evaluate(OVERLAY, png)
        async def shot(name): await pg.wait_for_timeout(150); await pg.screenshot(path=str(OUT / name)); print("→", OUT / name, flush=True)

        # 1. 預設「請 AI 改」（第一次打開，說明卡在）
        await p.ev("p=>__app.load(p)", SONG)
        await p.ev("()=>{document.querySelector('#cfgStatus').textContent='';document.querySelector('#cfgStatus').className='status'}")
        png = await frame(1, 1, 2.5); await p.ev("__app.select(1,1)"); await overlay(png)
        await shot("1_請AI改_預設.png")

        # 2. 貼上後偵測到「設定＋新風格」
        await pg.click("#introClose")
        await pg.click("#chips button:has-text('太躁')")
        reply = "好的！我做了一個新風格「色帶」，並把副歌改穩一點：\n```js\n" + MIN + "\n```\n設定：\n```json\n" + json.dumps({**SONG, "style": "bars"}, ensure_ascii=False, indent=2) + "\n```\n下次可以這樣說：「副歌背景想穩一點，色帶風格」"
        await pg.fill("#pasteText", reply); await p.ev("document.querySelector('#pasteText').scrollTop = 0")
        top = await p.ev("document.querySelector('#pasteCard').getBoundingClientRect().bottom + scrollY")
        await p.ev(f"scrollTo(0, {max(0, top - 880)})")
        await overlay(png); await shot("2_貼上偵測_設定與新風格.png")
        await pg.fill("#pasteText", "")

        # 3. 自己調
        await p.ev("scrollTo(0,0)"); await p.ev("__app.tab('self')")
        png = await frame(1, 1, 2.5); await p.ev("__app.select(1,1)"); await overlay(png)
        await shot("3_自己調.png")

        # 4. 匯出區
        await p.ev("__app.tab('ai')")
        png = await frame(2, 0, 3.0); await p.ev("__app.select(2,0)")
        await pg.click("#exportCard h2")
        bottom = await p.ev("document.querySelector('#exportCard').getBoundingClientRect().bottom + scrollY")
        await p.ev(f"scrollTo(0, {max(0, bottom - 885)})")
        await overlay(png); await shot("4_匯出區.png")
        print("頁面錯誤：", [l for l in p.log if "pageerror" in l])
        await b.close()
asyncio.run(main())
