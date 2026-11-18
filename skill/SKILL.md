---
name: worship-motion-backgrounds
description: 教會敬拜詩歌的動態背景與動態字幕影片。使用者給一句話（歌名、段落、風格、歌詞），AI 回覆一份設定 JSON；要新風格時再回覆一段「場景程式」。使用者貼進「詩歌影片編輯器.html」預覽、存成單檔 HTML、匯出 MP4 放進簡報軟體（Keynote、PowerPoint、Google 簡報等）。適用任何 AI，不綁平台。
---

# 詩歌影片：設定 JSON ＋ 場景程式 ＋ 單檔編輯器

一句話：**簡單調整只給 JSON；要新風格才寫場景程式**。引擎是固定、測好的，AI 不寫引擎、不寫整頁 HTML。

| 使用者要的 | AI 回覆 | 使用者做 |
|---|---|---|
| 改歌詞、段落、BPM、配色、換內建風格 | 一個 ```json 設定 | 編輯器「請 AI 改」→「把 AI 的回覆整則貼回來」→ 套用 |
| 新風格、新動畫、特殊質感 | 一個 ```js 場景程式（＋可選 ```json 設定） | 同一個貼上框（整則貼上）→ 頂端「存成單檔 HTML」 |

回覆規則（任何 AI 都一樣）：資訊不夠時先**問**（見第零節）；給設定時只回程式碼區塊＋一兩句說明＋「下次可以這樣說」；給**完整**內容，不要只給差異；不要外部資源（字型檔、圖片、網址、import、fetch、DOM）。

編輯器：https://1accordlab.github.io/worship-motion/ （正式版，永遠是最新版；開發中的新功能在 /dev/；也可以用存好的單檔 HTML），用 Chrome 或 Edge 打開。

---

## 零、引導同工（AI 怎麼接）

同工大多不會下提示詞。**AI 主動問、用選擇題問**，問完再做；同時把好的說法教給同工。

### 提問規則

1. **缺什麼問什麼**：第一句已經講清楚的（歌詞、感覺、風格）不要再問；講得夠就直接做。
2. **一次最多 3 題**，每題給 3–5 個帶代號的選項，最後一個永遠是「交給你決定」。同工回「1B 2A 3C」就好。
3. **選項要能想像**：用畫面、用場合描述（「像音樂節海報」「像手作卡片」），不要只丟術語。
4. **同工描述不出來時**，換個問法：「聯想到什麼東西、材質、年代、海報或品牌？」「哪一首歌或哪一場聚會的畫面你很喜歡？」
5. **歌詞由同工自己貼**：AI 給設定時 `lyrics` 可以留空（受版權保護的歌詞不要由 AI 重打），請同工在編輯器「自己調 → 貼上整首歌詞」貼整首，會自動分段；先做背景也可以。
6. **雙語（中英）**：段落設定 `lyrics2`（第二語言）與 `swapLang`（大小對調），中英各一版的段落就做兩段，例如「副歌（中）」「副歌（英）」，後者 `swapLang: true`。

### 新歌：第一輪提問（照缺的挑，最多 3 題）

```
1. 這首歌給人的感覺？
   A 安靜敬拜　B 溫暖感恩　C 活潑歡慶　D 熱血宣告　E 前面安靜、副歌爆發　F 交給你決定
2. 畫面想要哪一種？
   A 瑞士網格：俐落色塊、跟拍子跳格，像設計展海報
   B 剪紙拼貼：溫暖手作、紙片有影子，像手作卡片
   C 大字排版：大字當背景，像口號海報
   D 包浩斯幾何：圓、三角、原色，活潑像兒童繪本
   E 網點印刷：復古印刷、顏色稍微錯位，像獨立樂團海報
   F 墨染：宣紙上墨慢慢暈開、淡去，像呼吸（安靜敬拜）
   G 光柱：深藍綠底，高窗落下幾道光（安靜敬拜）
   H 麥田：低地平線的麥田隨風擺，高潮金色麥浪（感恩、溫暖）；也有寫實版
   I 天空：雲層慢慢飄，高潮雲開、光束落下（敬拜、高舉）；也有寫實版
   J 都不像，我描述給你　K 交給你決定
3. 動態字幕？
   A 不用，只要背景（歌詞用簡報軟體打）　B 重點段落要（導歌、高潮）　C 每段都要　D 交給你決定
```

需要時第二輪再問：顏色（A 風格原色　B 教會主色，給色碼或描述　C 節期：聖誕、復活節…）、段落結構。

### 修改：同工說「怪怪的」「不夠好」時

先問哪裡不對（選擇題）：A 速度節奏　B 畫面太滿或太空　C 顏色　D 字幕　E 整體感覺不對。再照下表改：

| 同工說 | 改什麼 |
|---|---|
| 太躁、太急、看了累 | `jumpBeats` 加大（2→4→8）；`background` 降一級 |
| 太慢、不夠嗨 | `jumpBeats` 減小；`background` 升一級（calm→build→peak） |
| 太亂、太花 | 降成 `calm`；場景程式減少元件或質感層 |
| 太空、太單調 | 升一級；或在場景程式加元件 |
| 太暗／太亮 | 調 `palette.bg`（不要純白、純黑） |
| 顏色刺眼、不像我們教會 | 降低飽和，或換成教會主色 |
| 字出來太急／太慢 | `enterSpeed` 0.7／1.3 |
| 字停太短／太久 | `clipSeconds` |
| 放大的字不對 | 移動 `[ ]` |
| 整體感覺不對 | 先換內建 `style`；內建都沒有才寫場景程式 |

### 教同工怎麼說

每次給完設定，最後加一行 **「下次可以這樣說：」**，把這次的答案組成一句完整的話，例如：

> 下次可以這樣說：「All the Lights，熱血宣告，網點印刷風格，導歌和副歌要動態字幕，顏色用教會的墨綠。歌詞如下：…」

同工問「我該怎麼說」時，給這兩個範本和詞庫：

| 用途 | 範本 |
|---|---|
| 新歌 | 「歌名＿＿，感覺＿＿，畫面像＿＿，＿＿段要動態字幕，顏色＿＿。歌詞如下：…」 |
| 修改 | 「＿＿段的（背景／字幕）太＿＿，希望＿＿一點，像＿＿那樣。」 |

| 面向 | 可以用的詞 |
|---|---|
| 節奏 | 跳得快／慢、穩、有呼吸感、跟拍子 |
| 密度 | 滿／空、簡單、留白多 |
| 色調 | 暖／冷、亮／暗、鮮豔／柔和、教會主色 |
| 質感 | 紙、印刷、手繪、俐落、復古、現代 |
| 字幕 | 大／小、進場快／慢、華麗／收斂、重點字 |

### 轉成設定

- **段落照歌來**：主歌、導歌、副歌、橋段、間奏、結尾都可以；同名段落可重複（副歌 2）。沒給結構就照歌詞的空行與標題切。
- **BPM 不知道就省略**（120）。節拍對不準沒關係。

| 感覺 | 背景 `background` | 字幕 `subtitle` |
|---|---|---|
| 安靜、敬拜、禱告、主歌 | `calm` | `none` 或 `gentle` |
| 漸強、預備、導歌 | `build` | `flashy`（每行標一個 `[關鍵字]`） |
| 高潮、宣告、副歌、大合唱 | `peak` | `gentle`（字少、好跟唱）；宣告句用 `flashy` |
| 間奏、結尾、只要背景 | 依情緒 | `none` |

| 風格 `style` | 個性 | 適合 |
|---|---|---|
| `swiss` 瑞士網格 | 俐落、色塊跳格 | 快歌、現代 |
| `paper` 剪紙拼貼 | 溫暖、手作、紙影 | 青年、見證、溫馨 |
| `type` 大字排版 | 大字當背景紋理 | 宣告、口號型歌詞 |
| `bauhaus` 包浩斯幾何 | 活潑幾何、原色 | 兒童、歡慶 |
| `riso` 網點印刷 | 復古印刷、套色錯位 | 年輕、潮、活力 |
| `ink` 墨染 | 宣紙上墨慢慢暈開、淡去，像呼吸 | 適合敬拜、安靜的歌 |
| `nave` 光柱 | 深藍到墨綠底，高窗落下平塗光柱 | 適合敬拜、安靜的歌 |
| `field` 麥田 | 低地平線、筆觸麥穗三層流動，高潮金色麥浪 | 感恩、溫暖（例如數算恩典） |
| `sky` 天空 | 切紙雲層慢慢飄，高潮雲開、平塗光束 | 敬拜、宣告、高舉 |
| `field_photo` 麥田・寫實 | 像實拍：低機位麥田、一波波麥浪、夕陽金色（較吃顯示卡） | 感恩、溫暖 |
| `sky_photo` 天空・寫實 | 像實拍：體積雲、雲開、雲隙光（較吃顯示卡） | 敬拜、高舉 |

使用者說的感覺內建沒有（例如「木刻版畫」「拼布」「海面」），才寫新場景（第二節）。內建都有 `calm` `build` `peak` 三種背景與 `flashy` `gentle` 兩種字幕；`ink` `nave` `field` `sky`（含寫實版）的 `flashy` 是克制版（字重、顏色、慢慢淡入）。

---

## 一、設定 JSON `worship-motion/1`

```json
{
  "format": "worship-motion/1", "title": "All the Lights", "style": "riso", "bpm": 120,
  "palette": { "pink": "#e2536e" }, "params": {},
  "sections": [
    { "name": "主歌", "background": "calm", "jumpBeats": 4, "loopBeats": 32, "subtitle": "none" },
    { "name": "導歌", "background": "build", "subtitle": "flashy", "clipSeconds": 6, "lyrics": "這是第[一]行示意文字\n這是第[二]行示意文字" },
    { "name": "副歌", "background": "peak", "subtitle": "gentle", "lyrics": "這是第一行示意文字\n這是第二行示意文字" }
  ]
}
```

| 欄位 | 值 | 預設 | 說明 |
|---|---|---|---|
| `style` | 內建 `swiss` `paper` `type` `bauhaus` `riso` `ink` `nave` `field` `sky` `field_photo` `sky_photo`，或自訂場景的 `id` | 第一個 | 自訂場景要先貼上場景程式 |
| `bpm` | 40–220 | 120 | 會微調到循環格數為整數 |
| `palette` | `{ 鍵: "#rrggbb" }` | 場景原色 | 只填想改的；換風格會清空 |
| `params` | `{ 鍵: 數字 }` | 場景預設 | 場景有定義才有 |
| `sections[].background` | 場景提供的背景名稱 | 第一種 | 內建場景都有 `calm` `build` `peak`（平靜／累積／高潮） |
| `jumpBeats` | 1 2 4 8 | 場景設定 | 色塊每幾拍跳一次位置 |
| `loopBeats` | 32 64 128 | 32 | 背景循環長度 |
| `subtitle` | `none` 或場景提供的字幕名稱 | `none` | 內建：`flashy` 華麗（一行一支，`[ ]` 標關鍵字）、`gentle` 收斂（空一行分一支，最多 3 行） |
| `clipSeconds` | 2–60 | 場景設定 | 每支字幕長度 |
| `enterSpeed` | 0.5–2 | 1 | 字幕進場速度倍率 |
| `lyrics` | 文字，換行 `\n` | "" | 沒字幕時只當備註；可以留空讓同工自己貼 |
| `lyrics2` | 文字，換行 `\n` | "" | 第二語言歌詞（小字）：和 `lyrics` 同樣的切法、逐行配對，行數不同也可以 |
| `swapLang` | `true` `false` | `false` | 大小對調：第二語言當大字、第一語言當小字 |

內建風格配色鍵：swiss `bg org crm dim`｜paper `bg red yel crm pnk`｜type `bg tone org crm`｜bauhaus `bg red yel blu crm`｜riso `bg pink blue yel teal ink`｜ink `bg ink wash warm seal shade`｜nave `bg green win light gold`｜field `bg haze far green gold warm ink`｜sky `bg blue warm far mid near hill light`｜field_photo `zen hor warm green gold`｜sky_photo `zen hor warm cloud shade`。
純 JSON：雙引號、無註解、無尾逗號；不確定就省略。編輯器會檢查，錯了列出哪段哪欄、不套用。

---

## 二、做新風格：場景程式

### 最小完整範例

```js
// 最小場景：暖灰底、一條色帶跟拍子跳位置、右上一顆圓跟拍輕跳
const C = { bg: '#2a2925', main: '#d9643a', soft: '#e6dcc8' };

function calm(f, x) {
  const y = x.step([200, 760, 420, 880], 2);              // 每 2 秒（4 拍）跳一個位置
  f.add(rect(0, y, W, y + 40, C.main));
  f.add(circle(1640, 300, 90 * (1 + .06 * pulse(x.t)), C.soft, .9));
}
function gentle(f, x) {                                    // 字幕：背景＋深色橫條＋逐行淡入
  calm(f, x);
  f.add(rect(0, 400, W, 680, C.bg, .92));
  x.lines.forEach((l, i) => f.text(l, 960, 480 + i * 120, { px: 84, col: C.soft, a: seg(x.t, i * .1, .5 + i * .1) }));
}

defineScene({
  id: 'bars', name: '色帶',
  palette: C, labels: { bg: '底色', main: '主色', soft: '亮色' },
  backgrounds: { calm: { label: '平靜', jumpBeats: 4, draw: calm } },
  subtitles: { gentle: { label: '收斂', split: 'block', seconds: 16, draw: gentle } },
});
```

### `defineScene({...})`（整份程式只呼叫一次）

| 欄位 | 必填 | 內容 |
|---|---|---|
| `id` `name` | name 必填 | id：英文名稱（寫進 JSON 的 style，規則見下）；name：中文風格名 |
| `palette` | ✔ | `{ 鍵: "#RRGGBB" }`，一定要有 `bg`。繪圖時從這個物件讀，編輯器會把使用者改的顏色填進來 |
| `labels` | | 面板可調的顏色 `{ 鍵: "名稱" }`（省略＝全部） |
| `backgrounds` | ✔ | `{ 名稱: { label, jumpBeats, draw(f, x) } }`。可以做通用的 `calm` `build` `peak`，也可以每一段各設計一種背景（例如 `verse1`、`chorus1`、`bridge`）；`label` 寫中文，面板上會顯示 |
| `subtitles` | | `{ 名稱: { label, split: 'line'或'block', seconds, draw(f, x) } }`。建議 `flashy`（line）`gentle`（block）。可以只做兩三種共用，也可以每一段各做一種（例如 `verse1Text`、`chorus1Text`…，七種也沒問題）；歌詞一律放在 JSON 的 `sections[].lyrics`，不要寫死在場景程式裡，改歌詞才不用改程式 |
| `params` | | `{ 鍵: { value, min, max, label } }` → 面板滑桿；JS 讀 `x.params.鍵`，shader 讀 `param(第幾個)` |
| `look` | | 後製 `{ grain: .035, vignette: .22, paper: .05, lift, cap }`；lift ≥ .015、cap ≤ .95 是固定下限上限 |
| `textures` `canvas` `shader` | | 三層質感出口，見下 |

**命名規則**：`id`、背景名稱、字幕名稱都用英文字母開頭，只能有英文、數字、`-`、`_`（例：`inkwash`、`peak`、`verse1Text`），不要用 `none`。編輯器比對時不分大小寫、不計 `-` 和 `_`，`id` 會自動轉小寫。

### `draw(f, x)`：每一格呼叫一次

| `x.` | 意思 |
|---|---|
| `t` | 秒。**永遠當 120 BPM 寫**（1 拍＝0.5 秒），編輯器依實際 BPM 伸縮 |
| `beat` | 拍數（`t × 2`） |
| `step(陣列, 每幾秒, t?)` | 依時間輪流取陣列的下一個：位置用「跳」的。會跟面板的「換位間隔」連動 |
| `jt(t)` | 換位用時間（自己算跳位時用） |
| `pal` `params` | 目前配色、參數 |
| `text` `lines` `chars` `kw` `dur` | 字幕：原文、各行（去掉 `[ ]`）、大字那一行的字陣列、`[ ]` 那個字的位置、影片長度 |
| `text2` `lines2` | 第二語言：原文、各行（和 `lines` 逐行配對） |
| `big` `small` | 依 `swapLang` 對調好的兩組行：`big` 畫大字、`small` 畫小字（沒有第二語言時 `small` 是空陣列，畫面要和單語一樣） |
| `swap` | 這段有沒有大小對調 |

| `f.` | 用法（z：大的在上） |
|---|---|
| `f.add(形狀…)` | 形狀，z 0（可傳陣列） |
| `f.top(形狀…)` | 蓋在字上面，z 2（開場掃屏用） |
| `f.text(字, x, y, { px, weight, col, a, scale, rot, align, spacing, stroke, blur, shadow, z })` | 字，z 1，(x, y) 是中心；`align:'left'` 時 x 是左緣；`shadow:true` 用 blur 過的版本 |
| `f.measure(字, 同上)` | `{ tw }` 字寬，排版用 |
| `f.line(x0, y0, x1, y1, 粗細, 色, a)`、`f.poly(點陣列, 粗細, 色, a)` | 線，z 0 |
| `f.bg`、`f.grid = { alpha, col, w, h }` | 底色（預設 palette.bg）、網格線 |

| 形狀 | 參數 |
|---|---|
| `rect(x0, y0, x1, y1, 色, a)` | 矩形 |
| `band(cx, cy, 長, 寬, 角度°, 色, a)` | 旋轉長條 |
| `circle(cx, cy, r, 色, a)`、`wedge(cx, cy, r, 起始弧度, 弧長, 色, a)` | 圓、扇形 |
| `arc(cx, cy, r, 粗細, 起始弧度, 弧長, 色, a)` | 圓弧／圓環（弧長 ≥ 2π＝整圈） |
| `tri(cx, cy, 外接半徑, 旋轉弧度, 色, a)` | 正三角形 |

形狀最後可再加一個物件：`{ z, blend: 'multiply'（疊印）, tex: false（不套質感）, rough（手撕邊 px）, shadow（紙影）, fiber（紙纖維） }`。
內建工具：`W` `H`（1920×1080）`BEAT` `BAR` `LOOP`（16）`TAU`、`lerp` `clamp01` `seg(t,a,b)` `mod` `hash(n)` `pulse(t, k, 週期)` `E.io/out/out5/back`。

**雙語字幕**：`small` 有內容時，每行大字下方一行小字（約 0.42–0.5 倍字級、同色較淡），不擠不疊、在歌詞區內；`flashy` 的放大效果只用在大字行。

**時間規則**：背景在 t＝16（32 拍）頭尾相接——用 `mod(x.t, 16)`、正弦用整數圈數（`TAU * 圈數 * t / 16`）。字幕不循環。中間 x 420–1500、y 260–820 留給簡報軟體疊歌詞。

### 三層質感出口：由安全到自由

| 想要 | 用哪層 | AI 寫什麼 |
|---|---|---|
| 紙纖維、底片顆粒、網點、套色錯位、墨水暈染、絹印粗糙邊、手繪抖動 | **A 質感庫** | 只寫參數 |
| 筆觸、排線、不規則圖案、Canvas 漸層與路徑 | **B Canvas2D 自由畫層** | `draw(ctx, t, info)` |
| 整個畫面的特殊處理（雙色網點、版畫、色調分離） | **C 自訂 WGSL** | 一個 `fn shade` |

**A. `textures`**（最多 8 層，依序套用；`on`：`shapes` `text` `lines` `bg`，可用逗號合併）

```js
textures: [
  { type: 'halftone', on: 'shapes', cell: 9, angle: 22 },       // 半透明的形狀印成網點（a 越小點越小）
  { type: 'misreg', on: 'shapes,text', amount: 4, every: 8 },   // 每種墨色偏一點，每 8 拍重新對位
  { type: 'fiber', on: 'bg', amount: .16 },
],
```

| type | 參數（預設） | 效果 |
|---|---|---|
| `fiber` | amount .12 | 紙纖維 |
| `grain` | amount .04 | 底片顆粒（每格不同） |
| `halftone` | cell 8、angle 15、tone 1 | 濃度＝透明度×tone，變成網點 |
| `misreg` | amount 4、every 0 | 套色錯位（依顏色）；every＝幾拍重新對位 |
| `bleed` | amount 6 | 墨水暈染（形狀、線） |
| `rough` | amount 3、voids .15 | 絹印粗糙邊＋漏墨 |
| `wobble` | amount 3、scale .012、fps 8 | 手繪抖動，每秒換 fps 次 |

**B. `canvas`**：在另一個執行緒畫，畫完疊在 z 的位置。只能用自己的參數（`info.pal`、`info.params`、`info.beat`、`info.text`）和內建小工具（`hash` `lerp` `seg` `mod` `pulse`），**不能用外面的變數**。`half: true` 用半解析度。

```js
canvas: { z: .5, draw(ctx, t, info) {
  const k = Math.floor(t * 8);                                    // 每秒抖 8 次，像手繪
  ctx.strokeStyle = info.pal.soft; ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) { const x0 = 80 + i * 14 + (hash(i + k) - .5) * 5;
    ctx.beginPath(); ctx.moveTo(x0, 90); ctx.lineTo(x0 - 90, 380); ctx.stroke(); }
} },
```

**C. `shader`**：只寫 `fn shade(uv: vec2f, t: f32, beat: f32, base: vec4f) -> vec4f`，回傳這一點的新顏色。`base`＝底下圖層在這一點的顏色。可用：`scene(uv)` 取樣底下圖層、`pal(i)`（palette 第 i 個顏色）、`param(i)`、`hash(p)`、`noise(p)`、`RES`（1920×1080）。z 預設 .5＝只處理背景，字保持清楚；z 9＝連字一起。

```js
shader: { z: .5, code: `
fn shade(uv: vec2f, t: f32, beat: f32, base: vec4f) -> vec4f {
  let px = uv * RES;
  let l = dot(base.rgb, vec3f(0.299, 0.587, 0.114));
  let q = mat2x2f(0.966, -0.259, 0.259, 0.966) * px / 10.0;           // 網點轉 15°
  let ink = 1.0 - smoothstep(-0.04, 0.04, length(fract(q) - 0.5) - sqrt(clamp(0.85 - l, 0.0, 1.0)) * 0.62);
  return vec4f(mix(pal(0), pal(0) * pal(1), ink), 1.0);               // 紙色上印一版墨（相乘＝疊印）
}` },
```

### 編輯器會擋什麼

| 情況 | 結果 |
|---|---|
| 語法錯、執行錯、API 用錯 | 不套用、標出**第幾行**、保留原本的風格（把訊息貼回給 AI 修） |
| 場景程式卡住（無窮迴圈） | 載入超過 3 秒、一格超過 1 秒（第一格 5 秒）就停止；執行中才卡→退回內建風格 |
| Canvas 一格畫超過 1 秒 | 停用這一層，其他照常 |
| WGSL 有 `loop` `while` `@` `var<…>` `textureStore`、指標；`for` 不是「常數、≤64 次」；巢狀總次數 >4096；超過 6000 字；改迴圈變數 | 靜態擋下（標行號） |
| WGSL 編譯錯誤 | 擋下（標行號） |
| shader 太慢 | 先在極小畫面試跑測速；太慢自動改半解析度；還太慢就拒絕並說明 |
| 顯示卡卡住／斷線 | 自動重建、停用自訂 shader、專案不變 |
| 試跑時整頁當掉 | 下次打開會發現，預設停用那段程式並提示 |
| 在 AI 對話的預覽視窗裡打開（不允許背景執行緒） | 自動改在頁面裡執行：能看、能改，但沒有無窮迴圈保護；匯出與試新場景請下載後用 Chrome／Edge |

### 固定規則（只有兩條）

1. **背景不放字**（大字排版 `type` 的同色系大字紋理例外）。歌詞只在字幕影片。
2. **不要 AI 常見的效果**：光暈粒子、鏡頭光斑、霓虹發光、漸層球、玻璃擬態、無意義的 3D 旋轉。要質感就用印刷、紙、手作：網點、套色錯位、紙紋、粗糙邊、手繪抖動。

其他都是可調預設：位置用跳的、120 BPM 寫法、32 拍循環、配色、字幕長度。不要純白、純黑（後製 lift/cap 會擋）。

### 回覆前自我檢查

- [ ] 該問的先問了；回覆最後有「下次可以這樣說」。
- [ ] JSON 是純 JSON；`format` 是 `worship-motion/1`；每段都有 `background`。
- [ ] `flashy` 每行最多一個 `[ ]`；`gentle` 每支最多 3 行。
- [ ] 背景的 `draw` 沒有 `f.text`（`type` 風格的大字紋理例外）。
- [ ] 沒有光暈、光斑、霓虹、漸層球、玻璃、3D 旋轉；沒有純白 `#ffffff`、純黑 `#000000`。
- [ ] 背景在 16 秒頭尾接得上；位置變化用 `x.step` 跳，不是一直滑。
- [ ] 歌詞區（x 420–1500、y 260–820）在背景影片裡保持乾淨。
- [ ] 給的是完整程式，不是片段；沒有 import、fetch、網址、圖片。
- [ ] 名稱（id、背景、字幕）英文字母開頭、只有英文數字 - _；JSON 的 style／background／subtitle 對得上這些名稱；歌詞在 JSON，不在程式裡。

### 做不到的（直接說明，不要硬做）

照片或影片素材、外部字型（只用電腦內建的中文字型）、3D 模型、精準對拍（只有 BPM 近似）、透明背景影片。

---

## 三、匯出與放進簡報軟體

| 項目 | 做法 |
|---|---|
| 匯出 | 單支 MP4、這一段 ZIP、整首 ZIP、全部歌曲 ZIP（每首一個資料夾）；檔名照段落順序編號 |
| 背景影片 | 放進簡報軟體後設成**循環**；歌詞用簡報軟體自己的文字疊上去 |
| 字幕影片 | 一句一支，播一次、停在最後一格；換句就換下一支 |
| 存檔 | 一個分頁一首歌；「存成單檔 HTML」存整本（打開還是多分頁），分頁「⋯」→「只存這一首」；收在同一個雲端資料夾，下次直接打開接著改 |
| 歌詞 | 「自己調 → 貼上整首歌詞」：認得段落標題、濾掉版權行、中英交錯可選怎麼放、可轉繁體；全在瀏覽器裡處理 |
| 改錯了 | 頂端「↶ 還原」「↷ 重做」（Ctrl／⌘＋Z）；「進階 → 歷史紀錄」可回到最近 50 步的任一個狀態；關掉的分頁從「最近關閉」叫回 |
| 字型 | 用電腦內建字型，**在要播放的那台電腦上匯出**，字形才一致 |

---

## 四、維護（改引擎才需要）

| 部分 | 位置 |
|---|---|
| 場景執行環境（Worker） | `src/engine/runtime.js`：defineScene、形狀、文字圖集、逐格打包 |
| 引擎（主執行緒） | `src/engine/gpu.js`：WebGPU 繪製、質感庫、Canvas 圖層、自訂 WGSL 檢查與試跑、MP4／ZIP |
| 編輯器 | `src/app.js`、`src/editor.html`：設定檢查、Worker 與逾時、試跑標記、存成單檔 |
| 內建風格 | `src/scenes/*.js`（用的就是上面的場景 API）；範例 `examples/*.js` |
| 打包 | `python3 build_simple.py` → `dist/simple/詩歌影片編輯器.html`（加 `--s2t` 重新產生簡轉繁對照表 `src/engine/s2t.txt`，來源 OpenCC） |
| 測試 | `python3 tests/test_guard.py`（防護與新功能）、`tests/test_workermode.py`（不允許 Worker 的環境）、`tests/test_ux.py`（介面流程）、`tests/test_lyrics.py`（雙語、整首貼上、簡轉繁、歌曲檔）、`tests/test_tabs.py`（歌曲分頁）、`tests/test_history.py`（還原／重做、歷史紀錄）、`tests/shots_ux.py`（介面截圖）、`tests/shots_songs.py`（風格截圖）、`tests/capture.py`＋`tests/compare.py`（抽格比對） |

- 只用 WebGPU、不連網、不用外部函式庫；1920×1080、30fps、H.264（BT.709 limited）、自寫 MP4 muxer、stored ZIP。
- 文字：Canvas2D → `getImageData` 取 alpha → `writeTexture`；不要用 `copyExternalImageToTexture`（無頭會失敗）。
- 無頭測試：Chrome 旗標 `--enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader --use-webgpu-adapter=swiftshader --disable-vulkan-surface`，網址加 `?nopreview`；`__app.grab(秒)` 回 PNG bytes。只抽幾格、不要在測試裡匯出整支 MP4。
