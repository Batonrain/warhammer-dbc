# Agent Instructions

Система для Foundry VTT по Warhammer 40k. Ниже — то, что нужно знать именно про
неё; дальше по файлу идут общие инструкции про трекер задач и оболочку.

Установка системы, сборка компендиумов, порядок релизов и правила пул-реквестов
описаны в [README.md](README.md) — здесь это не повторяется. Замысел архитектуры
и план работ: [docs/architecture-plan.md](docs/architecture-plan.md).

## Проверки

Три команды. Ни одна правка не считается готовой, пока они не прогнаны, и в
отчёте приводится их вывод, а не память о нём:

```bash
npm test              # vitest, без живой Foundry
npm run lint          # eslint; ошибок быть не должно, предупреждения терпимы
npm run packs:build   # сборка компендиумов из packs-src/
```

`npm run packs:build` обязателен, если тронуты `packs-src/` или `tools/`: CI
проверяет круговорот сборка → извлечение и падает при расхождении.

Расчёты на акторе (`module/documents/actor.mjs`) стендом не покрыты — стенда для
живого документа Foundry в проекте нет. Если правка их задевает, так и скажите и
попросите владельца сверить в игре, назвав, что именно смотреть. Не выдавайте
непроверенное за проверенное.

## Где источник истины

Одна вещь описана в одном месте. Раньше её продублировали — значит, это долг, а
не образец для подражания.

| Что | Где живёт | Чего НЕ делать |
| --- | --- | --- |
| Схема типа документа | `module/data/`, регистрация в `module/data/index.mjs` | не описывать поля в `template.json` — от него остался только перечень типов (`types`), все записи пусты |
| Содержимое компендиумов | `packs-src/*.json` | не править `packs/` — папка в gitignore и собирается из исходников |
| Числовая механика предмета | embedded `ActiveEffect` либо Конструктор (`flags.warhammer-dbc.mechanics`) | не заводить новых читателей `system.effects.*` — это уходящий формат |
| Версия системы | git-тег | не править `version` в `system.json` вручную |
| Задачи | beads (`bd`) | не заводить markdown-списки TODO |

## Прежде чем сказать «система этого не умеет»

Открой определение записи и сами данные. Не суди по внешнему виду строк книги и
по тому, чего не видно в интерфейсе.

За один заход по Происхождениям это правило было нарушено четырежды, и каждый раз
вывод «так нельзя» оказывался ложным, а нужное — уже существующим:

| Сказано | На деле |
| --- | --- |
| «потолок Редкости в выдаче не выразить» | `equipMaxAvailability` был в записи `equipment` с самого начала |
| «идентификатор папки-Типа берётся только у запущенной игры» | папки лежат в `packs-src/**/_Folder.json`, имя разрешается офлайн |
| «слот Миньона через Конструктор не выдать» | механизм был; промахнулся поиск по имени (`Minion of Chaos` против `Minion`) |
| «такого Таланта в книге нет» | был, с опечаткой в паке: `Sure Stitch` вместо `Sure Strike` |

Стоимость ошибки несимметрична: лишние пять минут на чтение схемы против
выброшенной возможности и неверного вывода в отчёте. Поэтому:

- сначала `module/data/<тип>.mjs` и умолчания записи в `module/apps/mechanics.mjs`
  (`blankEntry`), потом суждение;
- «в исходниках этого нет» проверяется `grep` по `packs-src/`, а не памятью;
- если данные книги не разбираются, первая гипотеза — ошибка разбора, вторая —
  опечатка в паке, и только третья — «книга требует невозможного».

### Кириллица в регулярках

В JS `\w` без флага `u` — это `[A-Za-z0-9_]`, русские буквы в него не входят, а
`\b` строится на `\w`. Разбор книжных строк ломался на этом четыре раза подряд, и
каждый раз выглядело как «данные кривые»:

```js
/люб\w*\s+(\d+)/      // не ловит «любые 4» → четыре слота стали одним
/талант\w*/           // не ловит «12 Талантов 1 уровня» → запись потеряна
/\bдо\s*R\s*\d\b/     // не отрезает «до R1» от «20 доз Химии до R1»
```

Регулярка не падает, она просто не совпадает, и запись тихо уезжает в
«нераспознанное». В разборе русского текста бери `\S` или явный `[а-яёА-ЯЁ]`,
`\b` не используй вовсе, разделители ищи регуляркой (`/^\s+или\s+/`), а не
срезом фиксированной длины.

## Схемы документов

Все типы переведены: `template.json` остался перечнем типов (`Actor.types`,
`Item.types`), поля в нём не описываются — их читают из схемы. Приём на новый
тип:

1. класс `TypeDataModel` в `module/data/item/` (или `actor/`);
2. регистрация в `index.mjs`;
3. имя типа добавляется в `types` в `template.json`, запись остаётся пустой;
4. две записи в таблице `test/data/item-schemas.test.mjs` (у акторов —
   `actor-schemas.test.mjs`): умолчания и сохранность документов пака.

Общее у нескольких типов не копируется: характеристики, навыки и состояния
Персонажа, Демона и Принца собирает `module/data/actor/_creature.mjs`, а списки
навыков берутся из `constants/skills.mjs` — новый навык должен появляться в
схеме сам.

Три грабли, на которые уже наступали:

- **Поле, забытое в схеме, пропадает.** Не при загрузке — при первой правке
  предмета в игре, тихо. Поэтому проверка сохранности гоняется на настоящих
  данных `packs-src/`, а не на выдуманных. Прежде чем писать схему, сравните
  ключи в данных с ключами в `template.json`: у половины типов в данных лежат
  поля, которых в шаблоне не было.
- **Умолчание `0` вместо `null` меняет смысл.** Если код отличает «поля нет» от
  «поле равно нулю» (`system.shieldAP != null` — так отличают ручной щит от
  прочего оружия), поле объявляется `nullable` с `initial: null`.
- **Схема приводит типы.** Строковое `"1"` станет числом `1`. Это не потеря, но
  источник обязан совпасть со схемой — правьте `packs-src`, а не ослабляйте
  проверку.

## Механика: эффекты, Конструктор, миграции

Числовые бонусы несёт стандартный `ActiveEffect` Foundry, а `changes` лежат в
`system.changes` (схема ядра v13+), у каждой строки есть `phase`.

- **Целиться только в ключи из `module/constants/effect-keys.mjs`.** Путь мимо
  реального поля актора ошибки не даёт — эффект просто молча ни на что не
  влияет. Так система прожила с несуществующим `system.armour.*`.
- **Фаза выбирается по ключу, а не по вкусу.** Хранимое поле схемы правится в
  `initial` (расчёт листа читает его как вход), производное — в `final` (расчёт
  считает его заново, эффект ложится поверх). Что чему положено, отвечает
  `expectedPhase(ключ)` в том же файле.
- **Штатное место новой механики — Конструктор** (`module/apps/mechanics.mjs`).
  Он заводит эффекты сам, когда предмет попадает к актору.
- **Флаг `warhammer-dbc.migratedEffect` — не пометка «сделано».** Он велит
  расчёту актора НЕ читать старое `system.effects` у этого предмета. Поставить
  его предмету, механику которого эффект не выражает, значит убить механику с
  обеих сторон. Поля, которым в эффектах соответствия нет, перечислены в
  `LEGACY_ONLY_KEYS` (`module/migrations/item-effects.mjs`).
- **Миграции идемпотентны и живут в `module/migrations/`.** Правя данные в
  `packs-src`, проверьте, не нужен ли живым мирам починочный проход: у игроков
  предметы лежат снимками на акторах, и пак их не догонит.

## Тесты

`vitest`, живой Foundry нет: глобали подменяет `test/support/foundry-stub.mjs`.
Заглушка изображает структуру и умолчания, но не валидацию — если проверка
начинает зависеть от поведения заглушки, а не системы, она бесполезна.

Логика, способная жить без Foundry, переезжает в `module/rules/` и проверяется
без заглушки вовсе. Это направление, а не пожелание.

Правило проекта: сначала падающий тест, потом код. Данные паков — такой же
предмет проверки, как код: расхождение схемы с `packs-src` ловится тестом, а не
глазами.

## Язык и стиль

Комментарии, сообщения коммитов, названия задач и текст интерфейса — русские.
Комментарий объясняет, ПОЧЕМУ так, а не пересказывает код: почему именно эта
фаза, почему `null`, почему поле нельзя выкинуть. Ссылка на файл или биду в
комментарии ценится выше абзаца прозы.

Правьте то, что просили. Заметили рядом мусор — заведите биду
(`bd create -t bug`), а не чините попутно: чужая правка в диффе мешает читать
основную.

---

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

> **Architecture in one line:** Issues live in a local Dolt database
> (`.beads/dolt/`); cross-machine sync uses `bd dolt push/pull` (a
> git-compatible protocol), stored under `refs/dolt/data` on your git
> remote — separate from `refs/heads/*` where your code lives.
> `.beads/issues.jsonl` is a passive export, not the wire protocol.
>
> See [sync-concepts](https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md)
> for the one-screen overview and anti-patterns (don't treat JSONL as the
> source of truth; don't `bd import` during normal operation; don't
> reach for third-party Dolt hosting before trying the default).

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd dolt push          # Push beads data to remote
```

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:46cd31e7 -->
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
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->
