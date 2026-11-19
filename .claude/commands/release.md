把 develop 合併到 main（正式版，推上去會自動部署給同工用）。

1. 確認目前在 develop、工作區乾淨、已推上 origin。
2. `python3 tests/check_repo.py`；`python3 build.py`；跑全部 `tests/test_*.py`（`test_golden` 除外，除非這次是純重構），列出每支的「通過 N / M」。有任何一支沒全過就停。
3. 列出 `git log --oneline main..develop` 和使用者看得到的變化（三到八行白話）。
4. 問使用者：「要合併到 main 嗎？」沒有明確說「要」就停在這裡。
5. 同意後：`git checkout main && git merge --ff-only develop && git push origin main && git checkout develop`。不能 fast-forward 就停下來回報，不要 rebase 或 force。
