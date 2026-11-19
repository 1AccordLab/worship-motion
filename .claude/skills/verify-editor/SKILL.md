---
name: verify-editor
description: 在無頭 Chrome 裡開詩歌影片編輯器，像同工一樣操作並留下證據。重現 bug、宣告改動完成前使用。
---
# 驗證詩歌影片編輯器

## 啟動

- `python3 build.py`，產出 `dist/詩歌影片編輯器.html`。
- 寫一支暫時的 Python 腳本（放 `/tmp`），用 `tests/wm.py` 開頁面：

```python
import asyncio, sys
sys.path.insert(0, "tests")
from wm import *
async def main():
    async with async_playwright() as pw:
        b, ctx, p = await open_page(pw)      # SwiftShader WebGPU，網址帶 ?nopreview
        ...                                  # 操作與取證
        print(p.log); await b.close()        # p.log 要是空的（沒有 pageerror）
asyncio.run(main())
```

- 就緒條件：`await p.ev("__app.ready")` 為 true。

## 健康檢查

- `__app.builtins()` 列出 8 種內建風格；`__app.status()` 沒有錯誤訊息；`p.log` 為空。不對就先停下來回報。

## 操作

- 優先走使用者路徑：`await p.ev("t=>__app.paste(t)", 文字)`（貼上 AI 回覆）、`__app.applyPaste`、分頁 `__app.tab(k)`、對話框 `__app.dialog()`／`__app.answer(v)`。
- `__app.load(設定)` 只用在準備前提，不拿來證明「貼上」這條路。
- 歌詞一律用「這是第一行示意文字」。

## 證據

- 存到 `tests/out/<任務>/`（gitignore）：讀回的值（`__app.project`、`__app.status()`、`__app.sceneInfo()`、`__app.clipInfo()`）、抽格（`await p.shot(段落, 片段, 秒, 路徑)`）、匯出檢查（`__app.exportTest(秒)`）。
- 判斷對錯看讀回的值；截圖給人看。

## 清理

- `await b.close()`。保留 `tests/out/<任務>/`。

## 功能地圖

| 功能 | 使用者怎麼進去 | 用什麼操作 | 證明完成的狀態 |
|---|---|---|---|
| 貼上 AI 回覆（設定＋新風格） | 「請 AI 改」→ 貼上 | `__app.paste` | `__app.project` 套用、`__app.status()` 以「已套用 ✔」開頭 |
| 新風格（場景程式） | 貼上框 | `__app.paste`、`__app.pasteScene` | `__app.sceneInfo()`；擋下時 `__app.sceneStatus()` 說明第幾行 |
| 貼上整首歌詞 | 「自己調 → 貼上整首歌詞」 | `__app.applySplitText` | `__app.project.sections[i].lyrics` |
| 歌曲分頁、歷史紀錄 | 分頁列、「＋ 新的一首」 | `__app.songs`、`newSong`、`undo`、`history` | `__app.songs()`、`__app.history()` |
| 存成單檔 HTML | 「存成單檔 HTML」 | `__app.singleHTML`、`saveHTML` | 產出的 HTML 重新開啟能用 |
| 匯出 MP4 | 「匯出」 | `__app.exportTest` | 回傳的 `size` 與 `ftyp` |
