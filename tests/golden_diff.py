"""比對兩個抽格資料夾：python3 tests/golden_diff.py 基準資料夾 新資料夾 [--expect 檔名樣式,…]
超過 200 個像素差距大於 24 就算不同。--expect 列出預期會不同的檔名（可用 * 萬用字元）；0 張非預期的不同、沒有缺少才 exit 0。"""
import sys, pathlib, fnmatch
from PIL import Image, ImageChops
def compare(a_dir, b_dir, expect=()):
    a_dir, b_dir = pathlib.Path(a_dir), pathlib.Path(b_dir); bad, expected, missing = [], [], []
    names = sorted(p.name for p in a_dir.glob("*.png"))
    for n in names:
        b = b_dir / n
        if not b.exists(): missing.append(n); continue
        d = sum(ImageChops.difference(Image.open(a_dir / n).convert("RGB"), Image.open(b).convert("RGB")).convert("L").histogram()[24:])
        if d > 200: (expected if any(fnmatch.fnmatch(n, e) for e in expect) else bad).append((n, d))
    return len(names), bad, expected, missing
def report(total, bad, expected, missing):
    print(f"比對 {total} 張；不同 {len(bad)}；缺少 {len(missing)}；預期內的不同 {len(expected)}")
    for n, d in bad: print("  不同", n, d)
    for n in missing: print("  缺少", n)
    return not bad and not missing and total > 0
if __name__ == "__main__":
    args = sys.argv[1:]; expect = args.pop(args.index("--expect") + 1).split(",") if "--expect" in args else []
    if "--expect" in args: args.remove("--expect")
    sys.exit(0 if report(*compare(args[0], args[1], expect)) else 1)
