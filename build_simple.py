"""用法：python3 build_simple.py          （加 --s2t 重新產生簡轉繁對照表）
把引擎（src/engine）、編輯器（src/app.js、src/editor.html）、內建場景（src/scenes/*.js）和 skill/SKILL.md 打包成
dist/simple/詩歌影片編輯器.html（單檔、無依賴）。場景程式保持原樣（給人和 AI 看）；引擎去掉註解與縮排。
"""
import pathlib, re, json, sys
ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
SCENES = ["swiss", "paper", "type", "bauhaus", "riso", "ink", "nave", "sky"]
S2T = SRC / "engine" / "s2t.txt"

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
    try:
        import jieba
        freq = {}
        for line in open(os.path.join(os.path.dirname(jieba.__file__), "dict.txt"), encoding="utf-8"):
            w, n = line.split(" ")[:2]; freq[w] = int(n)
    except ImportError:
        freq = {}
    rank = sorted(cand, key=lambda k: (-freq.get(k, 0), len(k), k))
    out, size = [], 0
    for k in rank:
        size += len((k + cand[k]).encode()) + 1
        if size > 22 * 1024: break
        out.append(k + cand[k])
    S2T.write_text("".join(k + v for k, v in sorted(chars.items())) + "\n" + ",".join(sorted(out)) + "\n")
    print("s2t", len(chars), "字", len(out), "詞", f"{S2T.stat().st_size/1024:.1f} KB")

def esc(s):  # 放進 <script> 裡不能出現 </script
    return re.sub(r"</(script)", r"<\\/\1", s, flags=re.I)

def slim(js):
    out = []
    for line in js.split("\n"):
        s = line.strip()
        if not s or s.startswith("//") or (s.startswith("/*") and s.endswith("*/") and "*/" not in s[2:-2]):
            continue
        out.append(s)
    return "\n".join(out)

def build():
    tpl = (SRC / "editor.html").read_text()
    runtime = slim((SRC / "engine" / "runtime.js").read_text())
    app = slim((SRC / "engine" / "gpu.js").read_text()) + "\n" + slim((SRC / "app.js").read_text())
    body = [f'<script type="text/plain" id="wm-runtime">{esc(runtime)}</script>']
    for k in SCENES:
        p = SRC / "scenes" / f"{k}.js"
        if not p.exists(): continue
        code = p.read_text()
        name = re.search(r"name:\s*'([^']+)'", code.split("defineScene(")[-1]).group(1)
        body.append(f'<script type="text/plain" class="wm-scene" data-id="{k}" data-name="{name}">\n{esc(code)}</script>')
    if not S2T.exists() or "--s2t" in sys.argv: make_s2t()
    body.append(f'<script type="text/plain" id="wm-s2t">{S2T.read_text().strip()}</script>')
    skill = (ROOT / "skill" / "SKILL.md").read_text()   # 「複製開場白」用：沒裝 skill 的 AI 也能照做
    body.append(f'<script type="text/plain" id="wm-skill">{esc(skill)}</script>')
    body.append('<script type="application/json" id="wm-project" data-doc="main">null</script>')
    body.append(f'<script id="wm-app">{esc(app)}</script>')
    out = ROOT / "dist" / "simple" / "詩歌影片編輯器.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(tpl.replace("{{BODY}}", "\n".join(body)))
    sizes = {"runtime": len(runtime.encode()), "engine+app": len(app.encode()), "editor shell": len(tpl.encode()), "SKILL.md": len(skill.encode()), "s2t": S2T.stat().st_size}
    print("built", out, f"{out.stat().st_size/1024:.1f} KB", {k: f"{v/1024:.1f} KB" for k, v in sizes.items()})

if __name__ == "__main__":
    build()
