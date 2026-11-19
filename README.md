# 詩歌影片編輯器

教會敬拜用的動態背景與動態字幕影片。在瀏覽器裡預覽、調整，匯出 MP4 放進簡報軟體。只用 WebGPU，不連網、沒有外部依賴。

| 網址 | 分支 | 用途 |
|---|---|---|
| https://1accordlab.github.io/worship-motion/ | `main` | 正式版編輯器：給同工用 |
| https://1accordlab.github.io/worship-motion/guide/ | `main` | 教學 |
| https://1accordlab.github.io/worship-motion/dev/（教學在 `/dev/guide/`） | `develop` | 開發版：新功能先在這裡試 |

## 資料夾

| 位置 | 內容 |
|---|---|
| `src/engine/` | 引擎：WebGPU 繪製、自訂 WGSL 檢查、MP4／ZIP、場景執行環境、簡轉繁對照表 |
| `src/editor/` | 編輯器：介面外殼（`shell.html`）與各功能模組 |
| `src/scenes/` | 內建風格，一個風格一個檔案 |
| `examples/` | 自訂風格範例 |
| `skill/SKILL.md` | 給 AI 的說明（任何 AI 都能用，也內嵌在編輯器的「複製開場白」） |
| `guide/` | 給同工的教學頁 |
| `docs/architecture.md` | 架構：資料格式、執行時的組成、打包與部署、路線 |
| `tests/` | 靜態檢查與無頭瀏覽器測試 |
| `CLAUDE.md`、`.claude/` | 給 AI 開發者的指引、規則與工具 |

## 打包與測試

```sh
python3 build.py                # → dist/詩歌影片編輯器.html（單檔）
python3 tests/check_repo.py     # 靜態規則，1 秒
python3 tests/test_ux.py        # 瀏覽器測試，每支一個檔案：tests/test_*.py
```

瀏覽器測試需要 Python 的 Playwright 與 Chrome（路徑用 `WM_CHROME` 指定）。

## 開發流程

在 `develop` 上改，推上去自動部署到開發版；試用、拍板後才合併到 `main`。做法、規則與驗證方式見 `CLAUDE.md`。

## 歌詞

歌詞受版權保護，**不放進這個 repo**。設定檔裡的 `lyrics` 留空，同工在編輯器「自己調 → 貼上整首歌詞」自己貼。
