#!/usr/bin/env python3
"""Stop-hook: snapshot `git status`/`git diff --stat` into .handoff.md at repo root.

Runs on every Stop event so the file always reflects the current working
copy, even if the session ends mid-context without a final summary.
"""
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def read_session_id() -> str:
    try:
        payload = json.load(sys.stdin)
        return str(payload.get("session_id", "unknown"))
    except Exception:
        return "unknown"


def run_git(root: Path, *args: str) -> str:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=root,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=20,
        )
        return result.stdout.strip() or "(пусто)"
    except Exception as exc:
        return f"(ошибка: {exc})"


def find_repo_root() -> Path:
    tools_dir = Path(__file__).resolve().parent
    default_root = tools_dir.parent.parent
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=default_root,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=10,
        )
        if result.returncode == 0 and result.stdout.strip():
            return Path(result.stdout.strip())
    except Exception:
        pass
    return default_root


def main() -> int:
    session_id = read_session_id()
    root = find_repo_root()

    status = run_git(root, "status", "--porcelain")
    diff_stat = run_git(root, "diff", "--stat")
    branch_info = run_git(root, "status", "-sb")

    now = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")

    content = f"""# Хэндофф (авто, Stop-хук)

Обновлено: {now}
Сессия: {session_id}

## git status -sb

```
{branch_info}
```

## git status --porcelain

```
{status}
```

## git diff --stat

```
{diff_stat}
```
"""

    try:
        (root / ".handoff.md").write_text(content, encoding="utf-8")
    except Exception:
        pass

    return 0


if __name__ == "__main__":
    sys.exit(main())
