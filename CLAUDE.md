# 詩歌影片編輯器

教會敬拜用的動態背景與動態字幕影片編輯器：瀏覽器裡用 WebGPU 繪製，匯出 MP4 放進簡報軟體。任何 AI 照 `skill/SKILL.md` 產出設定 JSON 或場景程式，同工貼進編輯器。介面給不會寫程式的同工用，文字一律繁體中文。

## 不能破的規則

| 規則 | 由什麼強制 |
|---|---|
| 任何檔案都不寫真實歌詞；範例、測試、截圖一律用「這是第一行示意文字」。自己的歌詞放 gitignore 的 `lyrics/` | `tests/check_repo.py`（a）（b）（c） |
| 只用 WebGPU；不用 WebGL、遊戲引擎；不連網、沒有外部依賴；成品能存成單檔 HTML | `tests/check_repo.py`（f）、`build.py` 缺檔即失敗、`pages.yml` 產物檢查、`test_ux`／`test_tabs` 的存成單檔 |
| 配色不用純白、純黑 | `tests/check_repo.py`（e）；`src/engine/gpu.js` 的 lift／cap 下限上限 |
| 背景不放字（`type` 風格的背景大字紋理例外） | 人工審查 |
| 不用 AI 常見效果：發光粒子、鏡頭光暈、霓虹、漸層光球、毛玻璃、無意義 3D 旋轉 | 人工審查 |
| 對外介面不能改壞：設定格式 `worship-motion/1`、`defineScene({...})`、`x.under(f, 預設)`。要改就連 `skill/SKILL.md`、`examples/`、測試一起改，並說明理由 | `tests/check_repo.py`（h）比對欄位與風格說明；`test_ux`、`test_under`、`test_guard` |
| 文件、註解、測試名稱只描述現況：不寫歷史沿革、待辦、已不存在的東西 | `tests/check_repo.py`（d）。禁用字清單在 `STALE_TERMS` |
| 程式（`src/engine/`、`src/editor/`、`build.py`、`tests/`、`.claude/hooks/`）的註解每一行都以「注意：」開頭，只說明改不了的外部限制或陷阱；區段標題、重述函式名、說明程式在做什麼的註解一律不寫，改用命名、拆函式或測試表達。場景與範例（`src/scenes/`、`examples/`）例外：檔頭一行說明風格、每個背景／字幕函式最多一行「畫什麼」 | `tests/check_repo.py`（g）機械檢查這兩條 |
| 教學頁引用的介面文字要和編輯器一致 | `tests/check_repo.py`（i） |
| 推到 `main`、合併到 `main`、force push 要使用者明確同意 | `.claude/settings.json` 的 `ask`、`/release` |

## 怎麼跑、怎麼驗證

- 靜態規則（1 秒）：`python3 tests/check_repo.py`。Stop hook 每次結束前都會跑，沒過不能結束；check_repo 本身崩潰時會連 stderr 一起輸出。
- 打包：`python3 build.py` → `dist/詩歌影片編輯器.html`。瀏覽器測試讀的是這個檔，改完 `src/` 先打包。`--s2t` 才重產簡轉繁表（需要 opencc、jieba）。
- 瀏覽器測試：`python3 tests/test_<名稱>.py`，每支印「通過 N / M」，全過 exit 0。無頭 Chrome 用 SwiftShader 跑 WebGPU，旗標在 `tests/wm.py`；`WM_CHROME` 指定 Chrome 路徑，`WM_FORCE_FAIL=1` 驗證 exit code。
- 純重構（不該改畫面）：`python3 tests/test_golden.py [--ref origin/main]` 把 ref 與工作目錄各打包、各拍 204 張抽格比對，**必須 0 張不同**。有意改畫面時用 `--expect 檔名樣式,…` 列出預期不同的圖。
- 教學截圖：`python3 tests/shots_guide.py`。新風格開發：`tests/shots_scene.py`。
- 輸出與證據放 `tests/out/`（gitignore）。
- 宣告完成前，用 `verify-editor` skill 在真實編輯器上走一次受影響的操作，回覆附上指令和輸出。

## 程式在哪

| 位置 | 內容 |
|---|---|
| `src/engine/` | `gpu.js`（Renderer、WGSL）、`shader_guard.js`（自訂 WGSL 檢查）、`mp4.js`、`zip.js`、`download.js`、`runtime.js`（Worker 裡的場景環境）、`s2t.txt` |
| `src/editor/` | `core` `guard` `hosts` `project` `lyrics` `preview` `history` `songs` `paste` `ui` `bind` `export` `single` `main`（`.js`）＋ `shell.html` |
| `src/scenes/` | 8 個內建風格：swiss paper type bauhaus riso ink nave sky（`build.py` 的 `SCENE_ORDER` 決定下拉順序，第一個 swiss 是預設） |
| `examples/` | 自訂風格範例 |
| `skill/SKILL.md`、`guide/` | 給 AI 的說明、給同工的教學 |

## 常見陷阱

- 編輯器各檔由 `build.py` 的 `ENGINE`、`EDITOR` 清單依序串接成一份腳本，不是模組。新增檔案要加進清單，順序就是載入順序。
- 頂層 DOM 副作用只在 `src/editor/main.js`；事件綁定在 `bind.js` 的 `bindUI()`。其他檔只定義函式與常數。
- localStorage 鍵：`wm:<doc>:book|hist|saved`、`wm:<channel>:probe|suspect|intro`。網頁上 doc＝channel；存成的單檔 doc＝檔案自己的 id。channel 只在 http(s) 網址判斷，路徑含 `/dev/` 這一段是 `dev`，其餘（含 file://）是 `main`。正式版與開發版同網域，鍵不能混用。
- 場景檔（`src/scenes/`、`examples/`）會被整份拿去給 AI 當範例：檔頭一行說明風格，不寫歷史、不寫「不是…」這類否定句，會誤導 AI。
- `skill/SKILL.md` 是對外介面：整份給任何 AI，也內嵌在編輯器的「複製開場白」。不能出現 `src/`、`tests/`、`build.py` 這類開發者資訊，不寫真實歌詞，欄位、預設值、介面用語要和程式一致。
- 新增設定欄位或 `defineScene` 欄位：`project.js`／`runtime.js`、SKILL.md 的欄位表、範例、測試一起改。
- 質感表在 `gpu.js`（`T`／`ON`）和 `runtime.js`（`TEX_TYPES`／`TEX_ON`）各一份，要一起改；`tests/check_repo.py`（k）會比對。
- `x.under(f, 預設)` 的底跟著段落選的背景走，改字幕時一起看背景。
- 截圖與抽格給人看；判斷對錯用 `window.__app` 讀實際的值。
- 改了 `src/` 沒重新打包，測試跑的是上一次打包的 `dist/`。
- `test_guard` 有兩項量測效能（「中等運算 16×16」「半解析度」），機器忙時會因慢而失敗；判斷是不是真的壞掉之前，先看機器負載。
- 教學頁 `guide/` 載入 Google Fonts，離線時退回系統字型；這是唯一的連外例外，編輯器本身不連網。

## 做事流程

1. 一行能改完的事直接改。其他先寫一句可檢查的完成條件。
2. bug：先在編輯器上重現，再修，修完在同一個操作上確認消失。
3. 較大的任務：研究 → 驗收條件（AC，先寫會失敗的測試）→ 實作 → 審查。
   - AC 和修改範圍先給使用者確認。
   - 實作時不改測試和 AC 讓它假通過；認為它們有錯就停下來附證據回報。
   - 實作完交給 `verifier` subagent 獨立驗證，拿到 PASS 才算完成。
4. 同一個錯誤第二次被糾正，就把它變成 `tests/check_repo.py` 的一條檢查或改架構，不要只加一行文字。
5. 分支：在 `develop` 上工作（推上去自動部署到 `/dev/`）。**develop → main 一定要使用者明確同意**，用 `/release`。
6. 可逆的事直接做、做完報告。停下來問人：推到 `main`、force push、刪資料、改 `.github/`、放寬 `tests/check_repo.py` 或 `.claude/` 的規則。
