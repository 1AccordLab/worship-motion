"""新舊抽格比對：python3 tests/compare.py ref/frames q/new [風格,...]"""
import sys, pathlib
from PIL import Image, ImageChops
a, b = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
only = sys.argv[3].split(",") if len(sys.argv) > 3 else None
worst = 0
for p in sorted(a.glob("*.png")):
    if only and p.name.split("_")[0] not in only: continue
    q = b / p.name
    if not q.exists(): print("缺", p.name); continue
    x, y = Image.open(p).convert("RGB"), Image.open(q).convert("RGB")
    d = ImageChops.difference(x, y).convert("L")
    h = d.histogram(); n = x.width * x.height
    big = sum(h[24:]) / n * 100          # 差超過 24/255 的像素比例
    mean = sum(i * c for i, c in enumerate(h)) / n
    worst = max(worst, big)
    print(f"{p.name:28s} 平均差 {mean:5.2f}  明顯不同 {big:6.3f}%")
print("最差", f"{worst:.3f}%")
