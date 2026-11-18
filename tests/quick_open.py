import asyncio, pathlib, sys
from playwright.async_api import async_playwright
FLAGS = ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-vulkan=swiftshader", "--use-webgpu-adapter=swiftshader", "--disable-vulkan-surface"]
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True, args=FLAGS)
        pg = await b.new_page()
        pg.on("pageerror", lambda e: print("pageerror", e))
        pg.on("console", lambda m: print("console", m.type, m.text[:300]))
        await pg.goto(pathlib.Path(sys.argv[1]).resolve().as_uri() + "?nopreview")
        try: await pg.wait_for_function("window.__app&&__app.ready", timeout=60000)
        except Exception as e: print("not ready", e)
        print(await pg.evaluate("document.querySelector('#err').textContent + ' | ' + (window.__app? __app.notices().join(';'):'')"))
        await b.close()
asyncio.run(main())
