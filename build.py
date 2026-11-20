"""用法：python3 build.py          （加 --s2t 重新產生簡轉繁對照表）
把引擎（ENGINE）、編輯器（EDITOR）、內建風格（src/scenes/*.js）和 skill/SKILL.md 打包成
dist/詩歌影片編輯器.html（單檔、無依賴）。ENGINE、EDITOR 是依序串接的明確清單，缺檔就失敗。
"""
import pathlib, re, json, shutil, subprocess, sys, tempfile, html
ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
OUT = ROOT / "dist" / "詩歌影片編輯器.html"
S2T = SRC / "engine" / "s2t.txt"
ENGINE = ["engine/gpu.js", "engine/shader_guard.js", "engine/mp4.js", "engine/zip.js", "engine/download.js"]
EDITOR = ["editor/core.js", "editor/guard.js", "editor/hosts.js", "editor/project.js", "editor/lyrics.js",
          "editor/preview.js", "editor/history.js", "editor/songs.js", "editor/paste.js", "editor/ui.js",
          "editor/bind.js", "editor/export.js", "editor/single.js", "editor/main.js"]
SHELL = "editor/shell.html"
RUNTIME = "engine/runtime.js"
SCENE_ORDER = ["swiss", "paper", "type", "bauhaus", "riso", "ink", "nave", "sky", "oil"]

def read(rel):
    p = SRC / rel
    if not p.is_file(): sys.exit(f"缺檔：{p}")
    return p.read_text()

def make_s2t():
    """簡轉繁對照表（src/engine/s2t.txt，約 35 KB）。來源：
    - OpenCC 字典（pip install --break-system-packages opencc-python-reimplemented）：
      STCharacters.txt（單字，取第一個候選）、STPhrases.txt（詞組）、TWVariants.txt（再轉成台灣常用字形，例如 裏→裡、着→著）。
    - 精簡：單字只留 GB2312 範圍內、簡繁不同的字；詞組只留「逐字轉會轉錯」的（例如 头发：逐字是 頭發，詞組是 頭髮），
      再用 jieba 詞典（pip install --break-system-packages jieba）的詞頻排序，取最常用的、總共約 22 KB。
    格式：第 1 行＝單字對（簡繁簡繁…）；第 2 行＝詞組（簡體詞＋繁體詞，等長，逗號分隔）。編輯器先套詞組（最長的先）再套單字。"""
    import opencc, os
    D = os.path.join(os.path.dirname(opencc.__file__), "dictionary")
    def load(n):
        m = {}
        for line in open(os.path.join(D, n), encoding="utf-8"):
            if "\t" not in line: continue
            k, v = line.rstrip("\n").split("\t", 1); m[k] = v.split(" ")[0]
        return m
    ch, ph, tw = load("STCharacters.txt"), load("STPhrases.txt"), load("TWVariants.txt")
    twc = lambda s: "".join(tw.get(c, c) for c in s)
    def ingb(c):
        try: c.encode("gb2312"); return True
        except UnicodeEncodeError: return False
    chars = {k: twc(v) for k, v in ch.items() if len(k) == 1 and ingb(k) and twc(v) != k}
    bychar = lambda s: "".join(chars.get(c, c) for c in s)
    cand = {k: twc(v) for k, v in ph.items() if len(k) == len(twc(v)) and all(ingb(c) for c in k) and bychar(k) != twc(v)}
    import jieba
    freq = {}
    for line in open(os.path.join(os.path.dirname(jieba.__file__), "dict.txt"), encoding="utf-8"):
        w, n = line.split(" ")[:2]; freq[w] = int(n)
    rank = sorted(cand, key=lambda k: (-freq.get(k, 0), len(k), k))
    out, size = [], 0
    for k in rank:
        size += len((k + cand[k]).encode()) + 1
        if size > 22 * 1024: break
        out.append(k + cand[k])
    S2T.write_text("".join(k + v for k, v in sorted(chars.items())) + "\n" + ",".join(sorted(out)) + "\n")
    print("s2t", len(chars), "字", len(out), "詞", f"{S2T.stat().st_size/1024:.1f} KB")

def esc(s):  # 注意：</script 出現在 <script> 內會提早結束標籤，所以要跳脫
    return re.sub(r"</(script)", r"<\\/\1", s, flags=re.I)

# 注意：只去縮排與空行，不逐行刪註解；逐行刪會誤傷模板字串（WGSL、CANVAS_WORKER、BOOT）
def slim(js):
    return "\n".join(s for s in (line.strip() for line in js.split("\n")) if s)

def check_syntax(name, js):
    node = shutil.which("node")
    if not node: return
    with tempfile.TemporaryDirectory() as tmp:
        f = pathlib.Path(tmp) / (name + ".js"); f.write_text(js)
        r = subprocess.run([node, "--check", str(f)], capture_output=True, text=True)
    if r.returncode: sys.exit(f"{name} 語法錯誤（node --check）：\n{r.stderr}")

def scene_files():
    found = {p.stem: p for p in sorted((SRC / "scenes").glob("*.js"))}
    for k in SCENE_ORDER:
        if k not in found: sys.exit(f"缺檔：{SRC / 'scenes' / (k + '.js')}")
    return [found[k] for k in SCENE_ORDER] + [p for k, p in found.items() if k not in SCENE_ORDER]

def build():
    tpl = read(SHELL)
    runtime = slim(read(RUNTIME))
    app = "\n".join(slim(read(f)) for f in ENGINE + EDITOR)
    check_syntax("wm-app", app)
    body = [f'<script type="text/plain" id="wm-runtime">{esc(runtime)}</script>']
    for p in scene_files():
        code = p.read_text()
        m = re.search(r"name:\s*'([^']+)'", code.split("defineScene(")[-1])
        if not m: sys.exit(f"{p} 找不到 name")
        body.append(f'<script type="text/plain" class="wm-scene" data-id="{html.escape(p.stem)}" data-name="{html.escape(m.group(1))}">\n{esc(code)}</script>')
    if "--s2t" in sys.argv: make_s2t()
    if not S2T.is_file(): sys.exit(f"缺檔：{S2T}（python3 build.py --s2t 可以重新產生）")
    body.append(f'<script type="text/plain" id="wm-s2t">{S2T.read_text().strip()}</script>')
    skill = (ROOT / "skill" / "SKILL.md").read_text()
    body.append(f'<script type="text/plain" id="wm-skill">{esc(skill)}</script>')
    body.append('<script type="application/json" id="wm-project">null</script>')
    body.append(f'<script id="wm-app">{esc(app)}</script>')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(tpl.replace("{{BODY}}", "\n".join(body)))
    sizes = {"runtime": len(runtime.encode()), "engine+editor": len(app.encode()), "editor shell": len(tpl.encode()), "SKILL.md": len(skill.encode()), "s2t": S2T.stat().st_size}
    print("built", OUT, f"{OUT.stat().st_size/1024:.1f} KB", {k: f"{v/1024:.1f} KB" for k, v in sizes.items()})

if __name__ == "__main__":
    build()
