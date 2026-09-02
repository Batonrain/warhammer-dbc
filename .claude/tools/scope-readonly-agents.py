#!/usr/bin/env python3
"""PreToolUse hook: сужает Bash/PowerShell до аллоулиста команд для read-only
субагентов (pr-reviewer, book-proofreader), у которых Bash в tools: нужен
легитимно (git diff, npm test/lint, pdfshot.py и т.п.), но сам по себе может
писать/удалять произвольные файлы. Остальных агентов и прямой диалог не трогает.
См. wdbc-bus.
"""
import json
import re
import sys

COMMON_ALLOW = [
    r"^cd(\s|$)",
    r"^git\s+diff(\s|$)",
    r"^git\s+log(\s|$)",
    r"^git\s+status(\s|$)",
    r"^git\s+show(\s|$)",
    r"^bd\s+list(\s|$)",
    r"^bd\s+show(\s|$)",
]

SCOPED_AGENTS = {
    "pr-reviewer": COMMON_ALLOW + [
        r"^npm\s+test(\s|$)",
        r"^npm\s+run\s+lint(\s|$)",
        r"^npm\s+run\s+packs:build(\s|$)",
        r"^gh\s+pr\s+view(\s|$)",
        r"^gh\s+pr\s+list(\s|$)",
    ],
    "book-proofreader": COMMON_ALLOW + [
        r"^python3?\s+.*pdfshot\.py(\s|$)",
        r"^node\s+.*pdf-text\.py(\s|$)",
        r"^bd\s+create\s+-t\s+bug(\s|$)",
    ],
}


def split_segments(cmd):
    segments = []
    current = []
    quote = None
    i, n = 0, len(cmd)
    while i < n:
        c = cmd[i]
        if quote:
            current.append(c)
            if c == quote:
                quote = None
            i += 1
            continue
        if c in ("'", '"'):
            quote = c
            current.append(c)
            i += 1
            continue
        if cmd[i:i + 2] in ("&&", "||"):
            segments.append("".join(current))
            current = []
            i += 2
            continue
        if c in (";", "|"):
            segments.append("".join(current))
            current = []
            i += 1
            continue
        current.append(c)
        i += 1
    segments.append("".join(current))
    return [s.strip() for s in segments if s.strip()]


def deny(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    if data.get("hook_event_name") != "PreToolUse":
        sys.exit(0)
    if data.get("tool_name") not in ("Bash", "PowerShell"):
        sys.exit(0)

    agent_type = data.get("agent_type")
    patterns = SCOPED_AGENTS.get(agent_type)
    if patterns is None:
        sys.exit(0)  # не один из read-only агентов wdbc-bus — не трогаем

    command = (data.get("tool_input") or {}).get("command")
    if not command:
        deny(f"read-only агент '{agent_type}': Bash-вызов без command, блокирую на всякий случай (wdbc-bus)")

    for segment in split_segments(command):
        if not any(re.match(p, segment, re.IGNORECASE) for p in patterns):
            deny(
                f"read-only агент '{agent_type}': команда вне аллоулиста wdbc-bus — "
                f"'{segment}'. Разрешены только git diff/log/status/show, bd list/show "
                f"и специфичные для агента команды из его .md. Если это легитимный "
                f"случай — расширить SCOPED_AGENTS в .claude/tools/scope-readonly-agents.py."
            )

    sys.exit(0)


if __name__ == "__main__":
    main()
