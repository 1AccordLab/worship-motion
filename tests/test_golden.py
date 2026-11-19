"""畫面比對：python3 tests/test_golden.py [--ref origin/main] [--expect 檔名樣式,…]
把指定 git ref 和目前工作目錄各打包一份、各拍一次抽格再比對，0 張不同才通過。
有意改畫面時，用 --expect 列出預期會不同的檔名（可用 * 萬用字元）；ref 要有 build.py。"""
import argparse, pathlib, shutil, subprocess, sys, tempfile
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from wm import ROOT, OUT, rec, finish
from golden_diff import compare, report

def run(*cmd, cwd=ROOT): subprocess.run(cmd, cwd=cwd, check=True)

def build(root):
    run(sys.executable, "build.py", cwd=root)
    return root / "dist" / "詩歌影片編輯器.html"

def shoot(root, html, out):
    shutil.rmtree(out, ignore_errors=True)
    run(sys.executable, str(ROOT / "tests" / "golden.py"), str(out), str(html), "--examples", str(root / "examples"))

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--ref", default="origin/main"); ap.add_argument("--expect", default="")
    a = ap.parse_args(); expect = [e for e in a.expect.split(",") if e]
    if subprocess.run(["git", "cat-file", "-e", a.ref + ":build.py"], cwd=ROOT, capture_output=True).returncode:
        sys.exit(f"{a.ref} 沒有 build.py，不能當比對基準")
    if subprocess.run(["git", "rev-parse", "--verify", "--quiet", a.ref + "^{commit}"], cwd=ROOT, capture_output=True).returncode:
        sys.exit(f"找不到 git ref：{a.ref}（用 --ref 指定分支、tag 或 commit）")
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="wm-golden-")); wt = tmp / "ref"
    run("git", "worktree", "add", "--detach", str(wt), a.ref)
    try:
        ref_dir, cur_dir = OUT / "golden" / "ref", OUT / "golden" / "cur"
        shoot(wt, build(wt), ref_dir)
        shoot(ROOT, build(ROOT), cur_dir)
    finally:
        run("git", "worktree", "remove", "--force", str(wt)); shutil.rmtree(tmp, ignore_errors=True)
    ok = report(*(res := compare(ref_dir, cur_dir, expect)))
    for n, d in res[2]: print("  預期內的不同", n, d)
    rec(f"畫面比對：{a.ref} 與目前工作目錄 0 張非預期的不同（共 {res[0]} 張）", ok)
    finish()

main()
