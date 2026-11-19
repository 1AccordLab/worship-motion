# 詩歌影片編輯器

教會敬拜用的動態背景與動態字幕影片。在瀏覽器裡預覽、調整，匯出 MP4 放進簡報軟體。只用 WebGPU，不連網、沒有外部依賴。

| 網址 | 分支 | 用途 |
|---|---|---|
| `/` | `main` | 正式版編輯器：給同工用 |
| `/guide/` | `main` | 教學 |
| `/dev/`、`/dev/guide/` | `develop` | 開發版：新功能先在這裡試 |

## 流程

```
在 Claude 裡改 → develop（自動部署到 /dev/）→ 試用、拍板 → 合併到 main（自動部署正式版）
```

## 資料夾

| 位置 | 內容 |
|---|---|
| `src/engine/` | 引擎：WebGPU 繪製（gpu.js）、場景執行環境（runtime.js）、簡轉繁對照表 |
| `src/scenes/` | 內建風格，一個風格一個檔案 |
| `src/app.js`、`src/editor.html` | 編輯器 |
| `examples/` | 自訂風格範例（例如海面） |
| `skill/SKILL.md` | 給 AI 的說明（任何 AI 都能用） |
| `guide/` | 給同工的教學頁（截圖由 `tests/shots_guide.py` 產生） |
| `tests/` | 無頭瀏覽器測試 |

## 打包與測試

```sh
python3 build_simple.py          # → dist/simple/詩歌影片編輯器.html（單檔）
python3 tests/test_ux.py         # 其他測試見 tests/
```

## 歌詞

歌詞受版權保護，**不放進這個 repo**。設定檔裡的 `lyrics` 留空，同工在編輯器「自己調 → 貼上整首歌詞」自己貼。
