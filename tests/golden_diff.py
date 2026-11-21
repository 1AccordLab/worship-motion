"""比對兩個抽格資料夾：python3 tests/golden_diff.py 基準資料夾 新資料夾 [--expect 檔名樣式,…]
任一像素的任一 RGB 通道差距大於 CHANNEL_TOLERANCE 就算不同。--expect 列出預期會不同的檔名（可用 * 萬用字元）；0 張非預期的不同、沒有缺少才 exit 0。"""
import sys, pathlib, fnmatch
from PIL import Image, ImageChops
CHANNEL_TOLERANCE = 2
def pixels_over_tolerance(a, b):
    diff = ImageChops.difference(Image.open(a).convert("RGB"), Image.open(b).convert("RGB"))
    worst = ImageChops.lighter(ImageChops.lighter(*diff.split()[:2]), diff.split()[2])
    return sum(worst.histogram()[CHANNEL_TOLERANCE + 1:])
def compare(a_dir, b_dir, expect=()):
    a_dir, b_dir = pathlib.Path(a_dir), pathlib.Path(b_dir); bad, expected, missing = [], [], []
    names = sorted(p.name for p in a_dir.glob("*.png"))
    for n in names:
        b = b_dir / n
        if not b.exists(): missing.append(n); continue
        d = pixels_over_tolerance(a_dir / n, b)
        if d > 0: (expected if any(fnmatch.fnmatch(n, e) for e in expect) else bad).append((n, d))
    return len(names), bad, expected, missing
def discard_identical(a_dir, b_dir, bad, expected, missing):
    """比對完只留下不同與缺少的那幾張（兩個資料夾各一份），其餘刪掉；回傳 (刪掉幾個檔, 釋放幾 MB)"""
    keep = {n for n, _ in bad} | {n for n, _ in expected} | set(missing); gone = size = 0
    for d in (pathlib.Path(a_dir), pathlib.Path(b_dir)):
        for f in d.glob("*.png"):
            if f.name not in keep: size += f.stat().st_size; f.unlink(); gone += 1
    return gone, round(size / 1e6)
def report(total, bad, expected, missing):
    print(f"比對 {total} 張；不同 {len(bad)}；缺少 {len(missing)}；預期內的不同 {len(expected)}")
    for n, d in bad: print("  不同", n, d)
    for n in missing: print("  缺少", n)
    return not bad and not missing and total > 0
if __name__ == "__main__":
    args = sys.argv[1:]; expect = args.pop(args.index("--expect") + 1).split(",") if "--expect" in args else []
    if "--expect" in args: args.remove("--expect")
    sys.exit(0 if report(*compare(args[0], args[1], expect)) else 1)
