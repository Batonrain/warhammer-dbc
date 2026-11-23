#!/usr/bin/env python3
"""SessionStart-хук: говорит сессии, какие скиллы грузить для её роли (.claude/roles.json).

Схема тредов-специалистов (docs/session-scheme.md): каждая сессия грузит набор
своей роли, а не всё подряд. Роль называет бриф координатора или название треда.
Сессия без роли берёт roles.json -> "noRole".

Хук сам читает roles.json, папку скиллов и папку агентов, поэтому новая роль,
скилл или агент видны без правки этого файла. Описания скиллов не печатает —
их и так показывает Claude Code. Скилл или агент из roles.json,
которого нет на диске, помечается «НЕТ ФАЙЛА» — устаревший roles.json виден сразу.
Ошибка хука никогда не мешает сессии: при любом сбое он молча выходит.
"""
import json
import os
import sys


def main() -> None:
    root = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    claude_dir = os.path.join(root, ".claude")
    with open(os.path.join(claude_dir, "roles.json"), encoding="utf-8") as f:
        roles = json.load(f)

    skills_dir = os.path.join(claude_dir, "skills")
    agents_dir = os.path.join(claude_dir, "agents")
    skills = {n for n in os.listdir(skills_dir)
              if os.path.isfile(os.path.join(skills_dir, n, "SKILL.md"))} if os.path.isdir(skills_dir) else set()
    agents = {n[:-3] for n in os.listdir(agents_dir) if n.endswith(".md")} if os.path.isdir(agents_dir) else set()

    def mark(names, existing):
        return ", ".join(n if n in existing else n + " (НЕТ ФАЙЛА)" for n in names)

    lines = []
    for role in roles.get("roles", []):
        part = "- {}: скиллы {}".format(role["name"], mark(role.get("skills", []), skills) or "—")
        if role.get("agents"):
            part += "; агенты " + mark(role["agents"], agents)
        if role.get("extra"):
            part += "; по случаю " + "; ".join(role["extra"])
        if role.get("brief"):
            part += "; бриф " + role["brief"]
        lines.append(part)

    context = (
        "РОЛЬ СЕССИИ (схема тредов-специалистов, docs/session-scheme.md): роль называет бриф координатора или название треда. "
        "ПЕРВЫМ действием вызови через Skill скиллы СВОЕЙ роли (одним сообщением, параллельно) и не грузи чужие; "
        "агенты и «по случаю» — когда задача до них дойдёт. В конце пишущим ролям — "
        + ", ".join(roles.get("everyWriter", [])) + ". "
        + (roles.get("note", "") + " " if roles.get("note") else "")
        + "Роль не названа (одиночная сессия): первым действием " + " и ".join(roles.get("noRole", []))
        + ", затем подходящие по задаче.\nНаборы ролей " + roles.get("project", "") + " (.claude/roles.json):\n"
        + "\n".join(lines)
    )
    sys.stdout.buffer.write(json.dumps({"hookSpecificOutput": {
        "hookEventName": "SessionStart", "additionalContext": context}}, ensure_ascii=False).encode("utf-8"))


try:
    main()
except Exception:
    sys.exit(0)
