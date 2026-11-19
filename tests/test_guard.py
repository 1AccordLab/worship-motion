"""防護與新功能的無頭測試：python3 tests/test_guard.py
貼上場景（正確／語法錯／執行錯）、三層質感正例、惡意案例、重開偵測、GPU 遺失、存成單檔再打開、匯出 1 秒。"""
import asyncio, sys, time, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import *
EX = ROOT / "examples"
OUT = OUT / "guard"; OUT.mkdir(parents=True, exist_ok=True)
MIN = (EX / "minimal.js").read_text()
def diff16(a, b): return diff(a, b, 16)
def with_shader(code): return MIN.replace("id: 'bars'", "id: 'bad'").replace("subtitles:", "shader: { code: `\n" + code + "\n` },\n  subtitles:")
SH_OK = "fn shade(uv: vec2f, t: f32, beat: f32, base: vec4f) -> vec4f { return base; }"

async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)
        await p.ev("__app.clearSuspects()")
        async def paste(code, label, expect, must=None):
            t0 = time.time(); before = (await p.ev("__app.sceneInfo()"))["id"]
            ok = await p.ev("c=>__app.pasteScene(c)", code); st = await p.ev("__app.sceneStatus()"); info = await p.ev("__app.sceneInfo()")
            good = ok == expect and (expect or info["id"] == before) and (must is None or must in st)
            rec(label, good, f"{'套用' if ok else '擋下'}（{time.time()-t0:.1f}s）{st} → 目前 {info['id']}")
            return ok, st, info
        async def alive(label):
            await p.ev("p=>__app.load(p)", {"format": "worship-motion/1", "title": "活著", "style": (await p.ev("__app.sceneInfo()"))["id"], "sections": [{"background": "calm"}]})
            im = await p.shot(0, 0, 2.0); rec(label, im.getbbox() is not None, "頁面還能抽格")

        # ---------- 貼上場景 ----------
        await p.ev("p=>__app.load(p)", proj("swiss"))
        await paste(MIN, "貼上正確場景", True)
        await p.ev("p=>__app.load(p)", {"format": "worship-motion/1", "title": "色帶", "style": "bars", "sections": [{"background": "calm", "subtitle": "gentle", "lyrics": "這是第一行示意文字\n這是第二行示意文字"}]})
        await p.shot(0, 1, 2.0, OUT / "minimal_sub.png")
        await paste(MIN.replace("f.add(rect(0, y, W, y + 40, C.main));", "f.add(rect(0, y, W, y + 40, C.main);"), "語法錯誤 → 擋下並標行號", False, "第 6 行")
        await paste(MIN.replace("const y = x.step", "const y = nope.step"), "執行錯誤 → 擋下並標行號", False, "第 5 行")
        await paste(MIN.replace("C.main));", "'red'));"), "API 用錯（顏色）→ 擋下並標行號", False, "第 6 行")
        await paste("console.log('沒有 defineScene')", "沒呼叫 defineScene → 擋下", False, "defineScene")

        # ---------- 三層質感正例 ----------
        tex = MIN.replace("id: 'bars'", "id: 'bars_tex'").replace("palette: C,", "palette: C, textures: [{ type: 'halftone', on: 'shapes', cell: 10 }, { type: 'wobble', on: 'shapes', amount: 4 }, { type: 'bleed', on: 'shapes', amount: 8 }],").replace("C.soft, .9));", "C.soft, .55));")
        ok, _, _ = await paste(tex, "A 質感庫（網點＋抖動＋暈染）", True)
        await p.ev("p=>__app.load(p)", {"format": "worship-motion/1", "title": "A", "style": "bars_tex", "sections": [{"background": "calm"}]})
        await p.shot(0, 0, 3.0, OUT / "A_textures.png")
        ok, _, info = await paste((EX / "canvas_hatch.js").read_text(), "B Canvas2D 自由畫層", True)
        await p.ev("p=>__app.load(p)", {"format": "worship-motion/1", "title": "B", "style": "hatch", "sections": [{"background": "calm"}]})
        imB = await p.shot(0, 0, 3.0, OUT / "B_canvas.png")
        rec("B 畫層有畫出來", info["canvas"] and imB.crop((60, 80, 900, 400)).convert("L").getextrema()[1] > 150, info)
        ok, _, info = await paste((EX / "duotone_shader.js").read_text(), "C 自訂 WGSL（雙色網點）", True)
        await p.ev("p=>__app.load(p)", {"format": "worship-motion/1", "title": "C", "style": "duotone", "sections": [{"background": "calm", "subtitle": "gentle", "lyrics": "這是第一行示意文字\n這是第二行示意文字"}]})
        await p.shot(0, 0, 3.0, OUT / "C_shader_bg.png"); await p.shot(0, 1, 2.0, OUT / "C_shader_sub.png")
        rec("C shader 已啟用", info["shader"], info)

        # ---------- 惡意／錯誤 shader ----------
        await paste(with_shader("fn shade(uv: vec2f, t: f32, beat: f32, base: vec4f) -> vec4f {\n  let k: f32 = vec3f(1.0);\n  return base;\n}"), "WGSL 編譯錯誤 → 擋下並標行號", False, "編譯錯誤")
        await paste(with_shader("fn shade(uv: vec2f, t: f32, beat: f32, base: vec4f) -> vec4f {\n  loop { }\n  return base;\n}"), "loop{} → 靜態擋下", False, "loop")
        await paste(with_shader("fn shade(uv: vec2f, t: f32, beat: f32, base: vec4f) -> vec4f {\n  var s = 0.0;\n  for (var i = 0; i < 64; i++) { for (var j = 0; j < 64; j++) { for (var k = 0; k < 64; k++) { s += noise(uv * f32(k)); } } }\n  return base * s;\n}"), "for 64 三層巢狀 → 靜態擋下", False, "巢狀")
        heavy = "fn shade(uv: vec2f, t: f32, beat: f32, base: vec4f) -> vec4f {\n  var s = 0.0;\n  for (var i = 0; i < 64; i++) {\n    for (var j = 0; j < 64; j++) { s += noise(uv * f32(i) + vec2f(f32(j), t)) * noise(uv * 3.0 + f32(i * j)) + sin(s + f32(j)); }\n  }\n  return base * (0.5 + s / 8192.0);\n}"
        await paste(with_shader(heavy), "超重運算（for 64×64 巢狀＋雜訊）→ 試跑後擋下", False, "太重")
        await paste(with_shader("fn shade(uv: vec2f, t: f32, beat: f32, base: vec4f) -> vec4f {\n  var s = 0.0;\n  for (var i = 0; i < 64; i++) { i = 0; s += 1.0; }\n  return base;\n}"), "改迴圈變數（想繞過上限）→ 擋下", False, "迴圈變數")
        await paste(with_shader("@group(0) @binding(9) var<storage, read_write> x: array<f32>;\n" + SH_OK), "宣告 storage 寫入 → 擋下", False, "不能")
        mid = heavy.replace("i < 64", "i < 16").replace("j < 64", "j < 16")
        ok, st, info = await paste(with_shader(mid), "中等運算（16×16）→ 自動改半解析度", True)
        rec("半解析度模式已啟用", info["half"], info)
        await p.ev("p=>__app.load(p)", {"format": "worship-motion/1", "title": "half", "style": "bad", "sections": [{"background": "calm"}]})
        im = await p.shot(0, 0, 2.0); rec("半解析度 shader 抽格正常", im.getbbox() is not None)
        await alive("惡意 shader 之後頁面正常")

        # ---------- Canvas2D 無窮迴圈 ----------
        hatch = (EX / "canvas_hatch.js").read_text()
        await paste(hatch.replace("const k = Math.floor(t * 8);", "while (true) { }"), "Canvas2D 無窮迴圈 → 1 秒逾時擋下", False, "1 秒")
        late = hatch.replace("id: 'hatch'", "id: 'hatch_late'").replace("const k = Math.floor(t * 8);", "if (t > 3) while (true) { }\n      const k = Math.floor(t * 8);")
        await paste(late, "Canvas2D 第 3 秒後才卡 → 試跑通過", True)
        await p.ev("p=>__app.load(p)", {"format": "worship-motion/1", "title": "late", "style": "hatch_late", "sections": [{"background": "calm"}]})
        t0 = time.time(); im = await p.shot(0, 0, 4.0)
        info = await p.ev("__app.sceneInfo()"); nt = await p.ev("__app.notices()")
        rec("Canvas2D 執行中卡住 → 停用該層、畫面照出", (not info["canvas"]) and any("Canvas" in n for n in nt) and im.getbbox() is not None, f"{time.time()-t0:.1f}s {nt}")

        # ---------- 場景 JS 無窮迴圈 ----------
        await paste(MIN.replace("const y = x.step", "while (true) { }\n  const y = x.step"), "場景 draw 無窮迴圈 → 逾時擋下", False, "沒有回應")
        await paste("while (true) { }\n" + MIN, "場景頂層無窮迴圈 → 3 秒擋下", False, "3 秒")
        lateJs = MIN.replace("id: 'bars'", "id: 'bars_late'").replace("const y = x.step", "if (x.t > 20) while (true) { }\n  const y = x.step")
        await paste(lateJs, "場景第 20 秒後才卡 → 試跑通過", True)
        await p.ev("p=>__app.load(p)", {"format": "worship-motion/1", "title": "late", "style": "bars_late", "sections": [{"background": "calm", "loopBeats": 64}]})
        t0 = time.time(); im = await p.shot(0, 0, 25.0)
        info = await p.ev("__app.sceneInfo()"); nt = await p.ev("__app.notices()")
        rec("場景執行中卡住 → 停用、退回內建場景", info["id"] in STYLES and im.getbbox() is not None, f"{time.time()-t0:.1f}s 目前 {info['id']}；{nt[-1][:90] if nt else ''}")

        # ---------- 重開時偵測殘留的試跑標記 ----------
        await paste(MIN, "（準備）貼上場景", True)
        h = await p.ev("c=>__app.hash(c)", MIN)
        await p.ev("([k,h])=>localStorage.setItem(k, JSON.stringify({kind:'scene', hash:h, name:'色帶'}))", [LS_PROBE, h])
        await p.reload()
        info = await p.ev("__app.sceneInfo()"); nt = await p.ev("__app.notices()")
        rec("重開：場景試跑標記殘留 → 停用該場景、退回內建", info["id"] != "bars" and any("上次" in n for n in nt), f"目前 {info['id']}；{' / '.join(nt)[:160]}")
        await p.ev("__app.clearSuspects()")
        await paste((EX / "duotone_shader.js").read_text(), "（準備）貼上自訂 shader 場景", True)
        sh = await p.ev("__app.shaderHash()")
        await p.ev("([k,h])=>localStorage.setItem(k, JSON.stringify({kind:'shader', hash:h, name:'雙色網點'}))", [LS_PROBE, sh])
        await p.reload()
        info = await p.ev("__app.sceneInfo()"); nt = await p.ev("__app.notices()")
        rec("重開：shader 試跑標記殘留 → 場景照常、shader 預設停用", info["id"] == "duotone" and not info["shader"] and any("shader" in n for n in nt), f"{info}；{' / '.join(nt)[:160]}")
        await p.ev("__app.clearSuspects()")

        # ---------- GPU 遺失：重建、停用 shader、保留專案 ----------
        await paste((EX / "duotone_shader.js").read_text(), "（準備）重新貼上 shader 場景", True)
        await p.ev("p=>__app.load(p)", {"format": "worship-motion/1", "title": "遺失測試", "style": "duotone", "sections": [{"background": "calm"}]})
        before = await p.ev("__app.project"); had = (await p.ev("__app.sceneInfo()"))["shader"]
        await p.ev("__app.simulateLoss()")
        info = await p.ev("__app.sceneInfo()"); after = await p.ev("__app.project"); im = await p.shot(0, 0, 2.0)
        rec("GPU 遺失 → 重建裝置、停用 shader、專案不變", had and (not info["shader"]) and before == after and im.getbbox() is not None, info)

        # ---------- 設定 JSON 仍可用、壞設定不弄壞頁面 ----------
        ok = await p.ev("t=>__app.paste(t)", "好的：\n```json\n" + json.dumps(proj("paper", bpm=96), ensure_ascii=False) + "\n```")
        rec("貼上設定 JSON（含換風格）", ok and (await p.ev("__app.project"))["style"] == "paper")
        ok = await p.ev("t=>__app.paste(t)", '{"style":"neon","sections":[{"background":"wild"}]}')
        rec("壞設定 → 不套用、列出原因", (not ok) and "neon" in await p.ev("__app.status()"), await p.ev("__app.status()"))
        both = "這是新風格：\n```js\n" + MIN + "\n```\n設定：\n```json\n" + json.dumps({"format": "worship-motion/1", "title": "一次貼兩個", "style": "bars", "sections": [{"background": "calm", "subtitle": "gentle", "lyrics": "這是第一行示意文字\n這是第二行示意文字"}]}, ensure_ascii=False) + "\n```"
        ok = await p.ev("t=>__app.paste(t)", both)
        rec("一次貼上場景程式＋設定 JSON", ok and (await p.ev("__app.project"))["title"] == "一次貼兩個")

        # ---------- 匯出 1 秒 ----------
        await p.ev("p=>__app.load(p)", proj("riso"))
        await p.ev("__app.select(0,0)")
        r = await p.ev("__app.exportTest(1)")
        rec("匯出 1 秒 MP4", r["ftyp"] == "ftyp" and r["size"] > 10000, r)

        # ---------- 存成單檔 → 再打開 ----------
        song = {"format": "worship-motion/1", "title": "示意歌名", "style": "riso", "bpm": 120, "sections": [
            {"name": "主歌", "background": "calm", "subtitle": "none"},
            {"name": "導歌", "background": "build", "subtitle": "flashy", "clipSeconds": 6, "lyrics": "這是第[一]行示意文字\n這是第[二]行示意文字\n這是第[三]行示意文字\n這是第[四]行示意文字"},
            {"name": "副歌", "background": "peak", "subtitle": "gentle", "lyrics": "這是第一行示意文字\n這是第二行示意文字\n\n這是第三行示意文字\n這是第四行示意文字"}]}
        await p.ev("p=>__app.load(p)", song)
        ref = await p.shot(2, 1, 2.0)
        html = await p.ev("__app.singleHTML()")
        f1 = OUT / "範例_單檔.html"; f1.write_text(html)
        rec("存成單檔 HTML", len(html.encode()) < 300 * 1024, f"{len(html.encode())/1024:.1f} KB")
        p2 = await open_url(ctx, f1.as_uri())
        pj = await p2.ev("__app.project")
        same = {k: pj[k] for k in ("title", "style", "bpm")} == {k: song[k] for k in ("title", "style", "bpm")} and len(pj["sections"]) == 3 and pj["sections"][1]["lyrics"] == song["sections"][1]["lyrics"]
        im2 = await p2.shot(2, 1, 2.0, OUT / "single_reopen.png")
        rec("單檔再打開：同一首歌、畫面一樣", same and diff16(ref, im2) < 2000, f"差異像素 {diff16(ref, im2)}；錯誤 {p2.log[:2]}")
        html2 = await p2.ev("__app.singleHTML()")
        f2 = OUT / "再存一次.html"; f2.write_text(html2)
        p3 = await open_url(ctx, f2.as_uri())
        rec("單檔再存一次、再打開", (await p3.ev("__app.project"))["title"] == "示意歌名", f"{len(html2.encode())/1024:.1f} KB")
        cs = OUT / "範例_自訂shader_單檔.html"
        await p2.ev("c=>__app.pasteScene(c)", (EX / "duotone_shader.js").read_text())
        cs.write_text(await p2.ev("__app.singleHTML()"))
        rec("自訂 shader 場景也能存成單檔", cs.stat().st_size < 300 * 1024, f"{cs.stat().st_size/1024:.1f} KB")

        print("\n頁面錯誤：", [x for x in p.log if "destroyed" not in x][:6])
        await b.close()
asyncio.run(main()); finish()
