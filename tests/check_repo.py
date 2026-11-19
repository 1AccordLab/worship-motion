"""repo 規則檢查（不開瀏覽器、只用標準庫）：python3 tests/check_repo.py
(a) 沒有 \\uXXXX 跳脫碼藏中文  (b) 程式／測試／文件裡 lyrics、lyrics2 的字串值只用示意文字
(c) 已知真實歌詞的指紋（只存雜湊）  (d) 文件與程式沒有過時用語
(e) 配色不用純白、純黑  (f) 場景不連網、不碰 DOM；src、examples 不用 WebGL 與遊戲引擎
(g) 程式的註解一律以「注意：」開頭；場景與範例只有檔頭一行與宣告上方一行  (h) SKILL.md 的欄位表與風格說明和程式一致
(i) 教學頁引用的介面文字都在編輯器裡、圖都存在  (j) CLAUDE.md、README、.claude 提到的路徑都存在
(k) 質感表 T／ON（gpu.js）與 TEX_TYPES／TEX_ON（runtime.js）一致
失敗時列出 檔名:行號 並 exit 1；為了不把歌詞印出來，(b)(c) 只印位置。"""
import hashlib, pathlib, re, subprocess, sys, unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIP = ("tests/out/", "dist/", "tests/__pycache__/")
BINARY = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".ico", ".woff", ".woff2", ".mp4", ".zip"}

# (c) (正規化後長度, SHA-256)。正規化＝NFKC、小寫、只留文字與數字。長度 < 3 的只比對整行。
LYRIC_FINGERPRINTS = {
    (3, "a8bcc0be58a198b5d9412cf0b10c939f008ab44107b9b8a4fd9ca8ed1f99b080"),
    (3, "dbd8b6ee0ff15293f721902c9a02ff808f0c3ef2c6a8acf2d5818040f3dce90d"),
    (6, "9aff35982e5e3b788c37a845e74ed99c453349b9b056e0b28837fa2e5882f9b7"),
    (4, "294e80a8ccc20bb4a32fd79b3d33599044decb7f766ca3d68e564b59b294e11c"),
    (2, "ed0d3a17397314874a3411348d2758ba58940ccd44799a23dac489a17ed3299a"),
    (6, "4617cb1d9f55341d6dfbf09b915ca806e01c75bcc5214a1ae3ca0019acad91c2"),
    (2, "f2e57a8d3ae4ac7de5f2a39a8741354adc51a45989f59aa2978da5da350fc0d0"),
    (2, "17760cd1dc6eb2c5c04eb0458faa2315bef3b234c8440ae1acf5de5a09177fbc"),
}

# (d) 過時用語與掃描範圍（check_repo.py 自己不掃，因為清單寫在裡面）
STALE_TERMS = ["以前", "舊版", "舊的", "已拿掉", "已移除", "已刪除", "拿掉了", "改之前", "改之後", "不再", "相容舊", "向下相容", "過去的版本", "暫時解", "先這樣", "legacy", "deprecated", "TODO", "FIXME", "HACK"]
STALE_SCOPE = ("src/", "skill/", "guide/index.html", "README.md", "CLAUDE.md", ".claude/", "docs/", "examples/", "tests/", "build.py")
# (路徑前綴, 該行要包含的文字, 理由)：誤判才加，越小越好
STALE_ALLOW = [
    ("src/", "知道了，不再顯示", "按鈕上給使用者看的字，不是歷史說明"),
    ("src/", "已刪除「", "按下刪除後給使用者看的提示，描述這一次動作"),
    ("tests/test_ux.py", "重開不再顯示", "測試名稱描述使用者看到的行為（說明卡關掉後的狀態）"),
    ("tests/test_ux.py", "說明卡關掉後不再出現", "同上"),
    ("src/", "行版權說明（詞、曲、©、CCLI 開頭），不會放進歌詞", "給使用者看的提示，描述這一次動作"),
]

# (g) 註解：程式（CODE_SCOPE）每一行都以「注意：」開頭，只寫改不了的外部限制或陷阱；場景與範例（SCENE_SCOPE）第一行是檔頭，其餘只有宣告正上方的單行 // 說明畫什麼
CODE_SCOPE = ("src/engine/", "src/editor/", "build.py", "tests/", ".claude/hooks/")
SCENE_SCOPE = ("src/scenes/", "examples/")
COMMENT_JS = re.compile(r"^\s*(?://|/\*|\*(?=\s|$)|<!--)\s*(.*)|\s(?://|/\*)\s(.*)$")
COMMENT_PY = re.compile(r"^\s*#(?!!)\s*(.*)|\s#\s(.*)$")
DECLARATION = re.compile(r"^(?:const|let|function)\s")
# (e) 純白、純黑（src/engine 的文字遮罩用白色，不在範圍內）
PURE_RE = re.compile(r"#(?:fff|ffffff|000|000000)\b|rgba?\(\s*(?:255\s*,\s*255\s*,\s*255|0\s*,\s*0\s*,\s*0)\b", re.I)
PURE_SCOPE = ("src/scenes/", "src/editor/", "examples/", "guide/")
# (f) 場景（src/scenes、examples）在 Worker 裡跑：不連網、不碰 DOM、不 import
SCENE_RE = re.compile(r"\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|\bimport\b|\bdocument\.|\bwindow\.|\blocalStorage\b|https?://")
GPU_RE = re.compile(r"""getContext\(\s*['"](?:webgl2?|experimental-webgl)|\bTHREE\.|\bBABYLON\.|\bPIXI\.""")
# (i) 教學頁「」裡的字：在 src/editor、src/scenes、SKILL.md 找得到才算介面文字；其餘是示範對話或簡報軟體的字
GUIDE_QUOTE_OK = {"1D 2B 3B": "對話示範", "像木刻版畫": "對 AI 的說法", "想要海面": "對 AI 的說法", "循環播放": "簡報軟體的選項", "複製、貼上": "動作的說明", "熱": "範例"}
# (j) 文件裡的路徑：這些是產物或輸出，不一定存在
PATH_OK = ("dist/", "tests/out/", "lyrics/")

CJK_ESCAPE = re.compile(r"\\u([0-9a-fA-F]{4})|\\u\{([0-9a-fA-F]{1,6})\}")
LYRICS_LITERAL = re.compile(r"""(?<!\w)["']?lyrics2?["']?\s*[:=]\s*(?P<q>["'`])(?P<v>(?:\\.|(?!(?P=q)).)*)(?P=q)""")
SAMPLE_MARKS = ("示意", "Sample", "sample")


def is_cjk(cp):
    return any(a <= cp <= b for a, b in [(0x2E80, 0x9FFF), (0xF900, 0xFAFF), (0xFE30, 0xFE4F), (0xFF00, 0xFFEF), (0x20000, 0x2FA1F)])

def normalize(s):
    s = unicodedata.normalize("NFKC", s).lower()
    return "".join(c for c in s if unicodedata.category(c)[0] in "LN")

def text_files():
    out = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.splitlines()
    for name in sorted(set(out)):
        path = ROOT / name
        if name.startswith(SKIP) or path.suffix.lower() in BINARY or not path.is_file(): continue
        try: yield name, path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError: continue

def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")

def tracked():
    return [n for n, _ in text_files()]

def comment_lines(scope):
    for name, lines in text_files():
        if name == "tests/check_repo.py" or not name.startswith(scope) or not name.endswith((".js", ".py", ".html", ".css")): continue
        for no, line in enumerate(lines, 1):
            if name.endswith(".py") and no == 1 and line.startswith("#!"): continue
            m = (COMMENT_PY if name.endswith(".py") else COMMENT_JS).search(line)
            if m: yield name, no, (m.group(1) if m.group(1) is not None else m.group(2)).strip(), line

def scene_comment_problems():
    for name, lines in text_files():
        if not name.startswith(SCENE_SCOPE) or not name.endswith(".js"): continue
        if not lines or not lines[0].lstrip().startswith(("//", "/*")): yield f"{name}:1: (g) 第一行要是一行檔頭說明"
        for no, line in enumerate(lines[1:], 2):
            if not COMMENT_JS.search(line): continue
            nxt = lines[no] if no < len(lines) else ""
            if not line.startswith("// ") or not DECLARATION.match(nxt): yield f"{name}:{no}: (g) 場景的註解只能是宣告正上方的單行「// 畫什麼」"

def table_names(md, heading, stop):
    """SKILL.md 某一節裡，表格第一欄用反引號框起來的名稱"""
    body = md[md.index(heading):]
    body = body[:body.index(stop, len(heading))] if stop in body[len(heading):] else body
    names = set()
    for row in re.findall(r"^\|([^|\n]+)\|", body, re.M):
        for n in re.findall(r"`([^`]+)`", row): names.add(re.sub(r"^sections\[\]\.", "", n))
    return names

def check_files():
    bad, files = [], tracked()
    # (e) 純白、純黑
    for name, lines in text_files():
        if not name.startswith(PURE_SCOPE) or name.endswith(".md"): continue
        for no, line in enumerate(lines, 1):
            if PURE_RE.search(line): bad.append(f"{name}:{no}: (e) 純白或純黑色碼（用有色調的深淺色）")
    # (f) 場景不連網、不碰 DOM；不用 WebGL 與遊戲引擎
    for name, lines in text_files():
        scene = name.startswith(("src/scenes/", "examples/")) and name.endswith(".js")
        for no, line in enumerate(lines, 1):
            if scene and SCENE_RE.search(line): bad.append(f"{name}:{no}: (f) 場景裡不能連網、碰 DOM 或 import")
            if name.startswith(("src/", "examples/")) and name.endswith((".js", ".html")) and GPU_RE.search(line): bad.append(f"{name}:{no}: (f) 只用 WebGPU，不用 WebGL 或遊戲引擎")
    # (g) 註解
    for n, no, body, _ in comment_lines(CODE_SCOPE):
        if body and not body.startswith("注意："): bad.append(f"{n}:{no}: (g) 註解要以「注意：」開頭，只寫改不了的外部限制或陷阱（其他改用命名、拆函式或測試）")
    bad += scene_comment_problems()
    # (k) 質感表
    gpu = read("src/engine/gpu.js")
    gpu_types = re.search(r"const T = (\{[^}]*\})", gpu).group(1)
    gpu_on = re.search(r"\bON = (\{[^}]*\})", gpu).group(1)
    rt_types = re.search(r"TEX_TYPES = (\{[^}]*\})", rt_text := read("src/engine/runtime.js")).group(1)
    rt_on = re.search(r"TEX_ON = (\{[^}]*\})", rt_text).group(1)
    squash = lambda t: re.sub(r"\s", "", t)
    if squash(gpu_types) != squash(rt_types): bad.append("src/engine/gpu.js: (k) 質感種類 T 和 runtime.js 的 TEX_TYPES 不一致")
    if squash(gpu_on) != squash(rt_on): bad.append("src/engine/gpu.js: (k) 作用圖層 ON 和 runtime.js 的 TEX_ON 不一致")
    # (h) SKILL.md ⇄ 程式
    skill, proj, rt = read("skill/SKILL.md"), read("src/editor/project.js"), read("src/engine/runtime.js")
    norm = proj[proj.index("function normalize"):proj.index("function adapt")]
    top = set(re.findall(r"\braw\.(\w+)", norm)) | {"style"}
    sec = set(re.findall(r"\bs\.(\w+)", norm))
    doc = table_names(skill, "## 一、設定 JSON", "\n---")
    fields = (top | sec) - {"sections"}
    for k in sorted(fields - doc): bad.append(f"skill/SKILL.md: (h) 設定欄位「{k}」程式有讀，欄位表沒有")
    for k in sorted(doc - fields - {"sections"}): bad.append(f"skill/SKILL.md: (h) 設定欄位表的「{k}」程式沒有讀")
    scene_doc = table_names(skill, "### `defineScene({...})`", "\n###")
    scene_code = set(re.findall(r"\bd\.(\w+)", rt[rt.index("function defineScene"):]))
    for k in sorted(scene_code - scene_doc): bad.append(f"skill/SKILL.md: (h) defineScene 欄位「{k}」程式有讀，欄位表沒有")
    for k in sorted(scene_doc - scene_code): bad.append(f"skill/SKILL.md: (h) defineScene 欄位表的「{k}」程式沒有讀")
    for name in files:
        if name.startswith("src/scenes/") and name.endswith(".js"):
            m = re.search(r"description:\s*'([^']+)'", read(name))
            if not m: bad.append(f"{name}: (h) 缺少 description")
            elif m.group(1).split("。")[0] not in skill: bad.append(f"{name}: (h) description 的第一句沒有出現在 SKILL.md 的風格表")
    # (i) 教學頁
    guide = read("guide/index.html")
    ui = "".join(read(n) for n in files if n.startswith(("src/editor/", "src/scenes/"))) + skill
    for q in sorted(set(re.findall(r"「([^」]+)」", guide))):
        if q in GUIDE_QUOTE_OK or "○" in q: continue
        for part in re.split(r"\s*→\s*", q):
            if part not in ui: bad.append(f"guide/index.html: (i)「{part}」在編輯器裡找不到（改成實際的介面文字，或不加「」）")
    for img in sorted(set(re.findall(r'src="(img/[^"]+)"', guide))):
        if not (ROOT / "guide" / img).is_file(): bad.append(f"guide/index.html: (i) 圖 {img} 不存在")
    # (j) 文件提到的路徑
    for name in files:
        if not (name in ("CLAUDE.md", "README.md") or (name.startswith((".claude/", "docs/")) and name.endswith(".md"))): continue
        for no, line in enumerate(read(name).splitlines(), 1):
            for tok in re.findall(r"`([^`\s]+)`", line):
                if "/" not in tok or tok.startswith(("/",) + PATH_OK) or tok.rstrip("/") + "/" in PATH_OK or re.search(r"[<>$:{}]|^https?|^\.\.|\.\.\.", tok): continue
                tok = tok.rstrip("/")
                if not (re.search(r"\.(py|js|json|md|html|css|yml|txt)$", tok) or (ROOT / tok.split("/")[0]).exists()): continue
                if not list(ROOT.glob(tok)): bad.append(f"{name}:{no}: (j) 提到的路徑 {tok} 不存在")
    return bad

def main():
    bad = []
    by_len = {}
    for n, h in LYRIC_FINGERPRINTS: by_len.setdefault(n, set()).add(h)
    for name, lines in text_files():
        for no, line in enumerate(lines, 1):
            for m in CJK_ESCAPE.finditer(line):
                if is_cjk(int(m.group(1) or m.group(2), 16)): bad.append(f"{name}:{no}: (a) 用跳脫碼寫中文"); break
            for m in LYRICS_LITERAL.finditer(line):
                v = m.group("v")
                if v and "${" not in v and not any(k in v for k in SAMPLE_MARKS): bad.append(f"{name}:{no}: (b) lyrics 的值不是示意文字")
            norm = normalize(line)
            for n, hashes in by_len.items():
                spans = [norm] if n < 3 else (norm[i:i + n] for i in range(len(norm) - n + 1))
                if any(len(s) == n and hashlib.sha256(s.encode()).hexdigest() in hashes for s in spans): bad.append(f"{name}:{no}: (c) 符合已知真實歌詞的指紋")
            if name.startswith(STALE_SCOPE) and name != "tests/check_repo.py":
                for t in STALE_TERMS:
                    if t in line and not any(name.startswith(p) and s in line for p, s, _ in STALE_ALLOW): bad.append(f"{name}:{no}: (d) 過時用語「{t}」")
    bad += check_files()
    for b in bad: print(b)
    print(f"check_repo：{'失敗 ' + str(len(bad)) + ' 處' if bad else '通過'}")
    sys.exit(1 if bad else 0)

main()
