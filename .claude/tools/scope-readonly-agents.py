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
    # 10.09.2026 (wdbc-51si): .claude/agents/book-proofreader.md переписан
    # 08.09.2026 (после закрытия wdbc-bus 01.09.2026) под протокол «замер
    # book-pdf-diff.py/book-coverage.py/book-holes.py → правка → npx vitest
    # → bd comment/close», но аллоулист остался старым — агент физически не
    # мог выполнить свой же документированный регламент (воспроизведено
    # вживую тремя независимыми сессиями 10.09.2026). Добавлены ровно те
    # команды, что book-proofreader.md называет обязательными шагами — все
    # читают/собирают/тестируют либо только пишут в трекер по своей же
    # находке, ни одна не пишет в код мимо Edit/Write. pdf-text.py
    # вызывается как `python`, не `node` — старый паттерн никогда не
    # совпадал, тоже исправлено.
    "book-proofreader": COMMON_ALLOW + [
        r"^python3?\s+(?!-)\S*pdfshot\.py(\s|$)",
        r"^python3?\s+(?!-)\S*pdf-text\.py(\s|$)",
        r"^(?:[A-Z_][A-Z0-9_]*=\S+\s+)*python3?\s+(?!-)\S*book-pdf-diff\.py(\s|$)",
        r"^(?:[A-Z_][A-Z0-9_]*=\S+\s+)*python3?\s+(?!-)\S*book-coverage\.py(\s|$)",
        r"^(?:[A-Z_][A-Z0-9_]*=\S+\s+)*python3?\s+(?!-)\S*book-holes\.py(\s|$)",
        r"^npx\s+vitest\s+run(\s|$)",
        r"^npm\s+test(\s|$)",
        r"^npm\s+run\s+lint(\s|$)",
        r"^bd\s+create\s+-t\s+bug(\s|$)",
        r"^bd\s+comment(\s|$)",
        r"^bd\s+close(\s|$)",
        r"^bd\s+update(\s|$)",
    ],
}


# Между интерпретатором и именем скрипта стоит `(?!-)\S*`, а не `.*`
# (wdbc-e9e): `.*` пускало произвольные флаги, и `python3 -c "код"
# book-coverage.py` проходило аллоулист — python выполнял бы код из -c, а имя
# скрипта досталось бы ему просто аргументом. `\S*` не оставляет места
# отдельному аргументу (в нём нет пробела), а lookahead отсекает слипшийся
# `-cbook-coverage.py`. Разбиение по `;`/`|` кавычки уважает, так что спрятать
# второй сегмент внутри строки тоже нельзя.
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
