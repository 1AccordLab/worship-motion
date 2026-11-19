import json, pathlib, subprocess, sys

root = pathlib.Path(__file__).resolve().parents[2]
try:
    if json.load(sys.stdin).get("stop_hook_active"): sys.exit(0)
except ValueError:
    pass
r = subprocess.run([sys.executable, str(root / "tests" / "check_repo.py")], capture_output=True, text=True, cwd=root)
if r.returncode == 0:
    sys.exit(0)
print(r.stdout.strip(), file=sys.stderr)
if r.stderr.strip():
    print(r.stderr.strip(), file=sys.stderr)
print("tests/check_repo.py 沒過。照訊息修好再結束；規則本身有問題就停下來說明，不要改規則。", file=sys.stderr)
sys.exit(2)
