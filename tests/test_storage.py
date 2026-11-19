"""正式版（/）和開發版（/dev/）的暫存分開：python3 tests/test_storage.py（同一個瀏覽器、同一個網域，看不到對方的歌、說明卡、試跑標記）"""
import asyncio, sys, pathlib, shutil, tempfile, threading, functools, http.server
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
async def reopen(p): await p.reload()
titles = lambda p: p.ev("__app.songs().map(s=>s.title)")
async def main():
    tmp = pathlib.Path(tempfile.mkdtemp())
    for rel in ("x/index.html", "x/dev/index.html"):
        (tmp / rel).parent.mkdir(parents=True, exist_ok=True); shutil.copy(EDITOR, tmp / rel)
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
        def do_GET(self):
            if self.path == "/favicon.ico": self.send_response(204); self.end_headers()
            else: super().do_GET()
    handler = functools.partial(Quiet, directory=str(tmp))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler); threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}/x/"
    try:
        async with async_playwright() as pw:
            b, ctx, main_p = await open_page(pw, base + "index.html")
            _, _, dev_p = await open_page(pw, base + "dev/index.html", ctx=ctx)
            rec("兩個網址一開始都是範例歌", await titles(main_p) == await titles(dev_p) == ["範例詩歌"], (await titles(main_p), await titles(dev_p)))
            await main_p.ev("x=>__app.load(x)", proj("swiss", title="正式版的歌"))
            await dev_p.ev("x=>__app.load(x)", proj("swiss", title="開發版的歌"))
            await reopen(main_p); await reopen(dev_p)
            rec("正式版只看到自己的歌", await titles(main_p) == ["正式版的歌"], await titles(main_p))
            rec("開發版只看到自己的歌", await titles(dev_p) == ["開發版的歌"], await titles(dev_p))
            keys = sorted(await main_p.ev("Object.keys(localStorage)"))
            rec("鍵名都帶 channel", keys and all(k.startswith(("wm:main:", "wm:dev:")) for k in keys) and any(k.startswith("wm:dev:") for k in keys) and any(k.startswith("wm:main:") for k in keys), keys)
            visible = lambda p: p.ev("!document.querySelector('#intro').hidden")
            rec("說明卡兩邊一開始都有", await visible(main_p) and await visible(dev_p))
            await main_p.pg.click("#introClose"); await reopen(main_p); await reopen(dev_p)
            rec("正式版關掉說明卡，開發版還在", not await visible(main_p) and await visible(dev_p), (await visible(main_p), await visible(dev_p)))
            await main_p.ev("()=>localStorage.setItem('wm:main:probe', JSON.stringify({kind:'scene', hash:'deadbeef', name:'測試風格'}))")
            await reopen(dev_p); await reopen(main_p)
            rec("試跑標記只影響同一個 channel", not any("上次在試跑" in n for n in await dev_p.ev("__app.notices()")) and any("上次在試跑" in n for n in await main_p.ev("__app.notices()")), (await dev_p.ev("__app.notices()"), await main_p.ev("__app.notices()")))
            rec("沒有頁面錯誤", not main_p.log and not dev_p.log, (main_p.log + dev_p.log)[:3])
            await b.close()
    finally:
        srv.shutdown(); shutil.rmtree(tmp, ignore_errors=True)
asyncio.run(main()); finish()
