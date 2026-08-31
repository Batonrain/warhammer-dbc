# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:1105d646 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->


## Инструкции по этому проекту

Живут в [AGENTS.md](AGENTS.md) — там проверки, источники истины, приём на новый
тип данных, устройство механики (эффекты, Конструктор, миграции) и соглашения по
языку. Второй копии здесь нет намеренно: одна вещь описана в одном месте.

Коротко, чтобы не открывать: гейты — `npm test`, `npm run lint`,
`npm run packs:build`; схемы документов в `module/data/`, перечень типов — в
`system.json` → `documentTypes` (`template.json` удалён); содержимое
компендиумов правится в `packs-src/`, не в `packs/`.

Установка, сборка компендиумов и порядок релизов — [README.md](README.md).
Замысел архитектуры — [docs/architecture-plan.md](docs/architecture-plan.md).

## Цель проекта

Система должна работать как компьютерная игра: игрок минимально считает и
складывает сам. Всё, что можно посчитать, показать или подсветить
автоматически — должно считаться, показываться и подсвечиваться. Это не
пожелание к конкретной фиче, а критерий приоритета для любой находки/доработки:
что игрок почувствует раньше (меньше ручного счёта, больше видимой причины),
то и важнее.

Владелец проекта — не программист. Любой отчёт, находка и bd-тикет обязаны
объяснять суть в терминах книги и листа персонажа (Черты, Таланты, броски,
Движение, Раны, Опыт), а не в терминах кода. См. «Конвенция отчётов» ниже.

## Конвенция отчётов

Каждый отчёт, находка и bd-тикет заканчиваются строкой **«Для игры:»** — что
это значит для игрока/ГМа за столом, без жаргона (не «kind:testMod не
резолвит modScope», а «модификатор от Черты не подставляется в бросок сам,
игрок должен помнить и вписывать вручную»). `file:line`/доказательство остаётся
для исполнителя — вывод дублируется, не заменяется.

## Как работать с Сергеем

Правила пользователя, переданы дословно — не переформулировать смысл:

- Меняя позицию — назвать конкретно, чем новая лучше прежней. Если назвать
  нечего — сказать, что остаёшься на старой (пользователь может ответить
  «делай всё равно» — тогда делать).
- Перед согласием с его правкой — сначала изложить сильнейшие возражения
  против неё.
- Не подстраивать оценки под его реакцию.
- Если по данным он не прав или предлагает не лучший вариант — заявить
  прямо.

Причина: молчаливое согласие он считает вредом для себя.
