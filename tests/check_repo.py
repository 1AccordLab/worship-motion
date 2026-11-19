"""repo 規則檢查（不開瀏覽器）：python3 tests/check_repo.py
(a) 沒有 \\uXXXX 跳脫碼藏中文  (b) 程式／測試／文件裡 lyrics、lyrics2 的字串值只用示意文字
(c) 已知真實歌詞的指紋（只存雜湊）  (d) src／skill／guide／README 沒有過時用語
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

# (d) 過時用語與掃描範圍；之後文件包會擴充
STALE_TERMS = ["以前", "舊版", "已拿掉", "改之前", "不再", "相容舊", "TODO", "FIXME"]
STALE_SCOPE = ("src/", "skill/", "guide/index.html", "README.md")
# (路徑前綴, 該行要包含的文字, 理由)：誤判才加，越小越好
STALE_ALLOW = [
    ("src/", "知道了，不再顯示", "按鈕上給使用者看的字，不是歷史說明"),
    ("src/", "行版權說明（詞、曲、©、CCLI 開頭），不會放進歌詞", "給使用者看的提示，描述這一次動作"),
]

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
            if name.startswith(STALE_SCOPE):
                for t in STALE_TERMS:
                    if t in line and not any(name.startswith(p) and s in line for p, s, _ in STALE_ALLOW): bad.append(f"{name}:{no}: (d) 過時用語「{t}」")
    for b in bad: print(b)
    print(f"check_repo：{'失敗 ' + str(len(bad)) + ' 處' if bad else '通過'}")
    sys.exit(1 if bad else 0)

main()
