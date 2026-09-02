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
| Схема типа документа | `module/data/`, регистрация в `module/data/index.mjs`, перечень типов в `system.json` → `documentTypes` | `template.json` удалён (этап 5.1 закрыт целиком) — новый тип объявляется в `system.json`, а не в отдельном файле |
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

### Длина идентификатора

_id документа и папки — РОВНО 16 символов `[A-Za-z0-9]`. Не «до 16».

Придуманный руками говорящий id (`LocusHeraldFld1`, `DreadTalentsFld` — по 15)
проходит ВСЕ гейты: `npm test`, `npm run lint`, `npm run packs:build` зелёные.
Ломается только живой мир, и насмерть: `DataModelValidationFailure … is not a valid
16-character alphanumeric ID`, клиент виснет с пустой страницей и `game.ready ===
false`. В логах сервера при этом «Launching World | Complete» — оттуда не видно.

Заводя записи в паки, берите id случайной строкой ровно 16 символов и помните, что
он живёт в четырёх местах: `_id`, `_key` (`!items!<id>`, `!folders!<id>`),
имя файла и поле `folder` у детей папки.
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

Все типы переведены, `template.json` удалён: перечень типов и их схема живут
раздельно — типы объявлены в `system.json` → `documentTypes.Actor`/`.Item`
(значения пустые `{}`, Foundry их не читает), поля — в классе `TypeDataModel`.
Приём на новый тип:

1. класс `TypeDataModel` в `module/data/item/` (или `actor/`);
2. регистрация в `index.mjs`;
3. имя типа добавляется в `documentTypes.Item` (или `.Actor`) в `system.json`,
   запись остаётся пустой — `"trait": {}`;
4. две записи в таблице `test/data/item-schemas.test.mjs` (у акторов —
   `actor-schemas.test.mjs`): умолчания и сохранность документов пака.

Общее у нескольких типов не копируется: характеристики, навыки и состояния
Персонажа, Демона и Принца собирает `module/data/actor/_creature.mjs`, а списки
навыков берутся из `constants/skills.mjs` — новый навык должен появляться в
схеме сам.

Три грабли, на которые уже наступали:

- **Поле, забытое в схеме, пропадает.** Не при загрузке — при первой правке
  предмета в игре, тихо. Поэтому проверка сохранности гоняется на настоящих
  данных `packs-src/`, а не на выдуманных: `defineSchema()` должен покрывать
  все ключи, которые реально лежат в паке типа, а не только те, что кажутся
  очевидными на бумаге.
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

## Время, активация и источники — правила для новой механики

Четыре решения, которые нужно принять для каждой новой механики новой книги.
Не готовый код — где механизм уже есть, подключаться к нему, а не изобретать
второй.

**Привязка к времени** — единица в тексте книги сама выбирает механизм:

| В книге | Механизм |
| --- | --- |
| минуты/часы/дни/недели/месяцы/годы | `game.time.worldTime`: штатная Duration (в секундах) `ActiveEffect` — движок сам сверяет её с `worldTime` при любой прокрутке виджета «Летоисчисление» ([module/apps/imperial-calendar.mjs](../module/apps/imperial-calendar.mjs)), либо прямое чтение `worldTime` в правиле/расчёте |
| раунды/ходы | `game.combat.round`/`.turn`: штатная Duration в раундах/ходах `ActiveEffect`, либо готовый примитив «раз-в-раунд» — `isRoundCapabilityAvailable`/`markRoundCapabilityUsed` в [module/apps/game-session.mjs](../module/apps/game-session.mjs) |
| сцены/сессии | НЕ новый таймер — метка `flags.warhammer-dbc.usageLimit = {scope:"scene"\|"session", used}` на предмете (у возможностей без предмета-носителя — `flags.warhammer-dbc.usageLimits.<имя>` на акторе), которую откатывают кнопки «🎬 Сцена»/«⏻ Сессия», уже встроенные в тело календаря — [module/apps/game-session.mjs](../module/apps/game-session.mjs) |

**Активация записи Конструктора.** Механика, которую игрок включает/выключает
сам (система силовой брони и подобное) — не заводить своё поле, использовать
пару, отработанную на Модификациях брони:
`activatable`/`active` (BooleanField) в схеме предмета
([module/data/item/armor-mod.mjs](../module/data/item/armor-mod.mjs)) → новый
`case` типа в `isItemActive()`
([module/apps/effects.mjs](../module/apps/effects.mjs)) → кнопка-тумблер
ВКЛ/выкл в строке предмета на листе, по образцу `armormod-active-toggle`
([templates/actor/parts/tab-gear.hbs](../templates/actor/parts/tab-gear.hbs)),
не отдельная вкладка.

**Активатор источника в Настройках.**
[module/constants/features.mjs](../module/constants/features.mjs) — реестр
«книга → флажок». Новая книга получает запись в `FEATURES` с уникальным
`key`; выключенный флажок обязан гасить всё, что книга приносит. Сейчас через
`actorTypes`/`raceKeys`/`sheetTypes` гасятся типы актора, расы и поля листа —
для типов ПРЕДМЕТОВ и компендиумов книги такого гейта в реестре ещё нет, это
расширение `FEATURES` и мест, где дёргается `isFeatureEnabled(key)`, а не
готовый механизм.

**Компендиумы: пак на тип документа × источник, не общий.** Новая книга не
подмешивается строками в существующие паки (`weapons`, `armor`, `talents`...)
— заводит свои: тот же тип документа, отдельный пак-библиотека (так уже
устроены Книга Машин — `vehicle-weapons`, Книга Пустоты — `ship-components`).
Общие `weapons`/`armor`/`talents`/`traits` держат core вперемешку с частью
старых книг по полю `bookSource` — унаследованный долг, а не образец: новыми
источниками его не увеличивать. Пак заводится в `system.json` (`packs`) и
сразу получает свою папку в `packFolders`, см. [[doombc-compendium-folders]].

## Шаблоны и Ауры — два разных пространственных механизма

Не путать (см. разведку wdbc-1pa): Шаблон — разовое размещение фигуры при
применении, Аура — постоянно живущая зона вокруг актора с живым
пересчётом. Оба про «кто сейчас в зоне», но разные по природе и разные по
готовности.

**Аура — реализована.**
[module/regions/auras.mjs](../module/regions/auras.mjs): чистая логика
(`tokenRelationship`, `auraDescriptorsOf`, `auraAffects` — без обращения к
`canvas`, тестируется напрямую) + Foundry-обвязка (`sweepAurasOnScene`,
`checkAuras` — `foundry.utils.debounce`, 150мс). Хуки —
`warhammer-dbc.mjs`, блок «Ауры»: `canvasReady`/`createToken`/
`deleteToken`/`updateToken` (движение, hidden, disposition) и
`createItem`/`deleteItem`/`updateItem` (флаг ауры, экипировка/активация
источника). Описание ауры — флаг на предмете-источнике,
`flags["warhammer-dbc"].aura = { radius, affects: "allies"|"enemies"|
"all", includesSelf, grant: [uuid,...] }`; задетому актору клонируется
`grant`-предмет с меткой `flags["warhammer-dbc"].auraSource` — эффект на
нём обычный `ActiveEffect`, ничего нового изобретать не нужно (см. выше
«Механика: эффекты…»). Тесты — `test/regions/auras.test.mjs`.
Сознательно НЕ сделано (следующий тикет): простановка флага `aura` через
Конструктор/UI, контентная выдача реальных Локусов в `packs-src`,
визуальный круг ауры на канвасе (косметика, не влияет на «кто задет»).

**Разовый Шаблон (Взрывное/Распыление) — реализован.**
[module/combat/templates.mjs](../module/combat/templates.mjs):
`blastCircleShape`/`sprayConeShape` — чистая геометрия (метры → пиксели
фигуры Region, тестируется напрямую, `test/combat/templates.test.mjs`) +
Foundry-обвязка `placeAttackTemplate`/`targetTokens`. Важно: в Foundry v14
`MeasuredTemplate` **deprecated** (`client/canvas/placeables/template.mjs`:
"since 14, until 16") — его функциональность объединена в `Region`, поэтому
размещение идёт через штатный `canvas.regions.placeRegion()` (core даёт весь
UX перетаскивания/поворота мышью бесплатно, своего слоя писать не
понадобилось). Регион создаётся эфемерным (`create:false`) — в сцену не
пишется, нужен только для `testPoint()` и сам исчезает; чистить нечего.
Накрытые токены (центр внутри фигуры) становятся целями пользователя
(`canvas.tokens.setTargets`) — дальше без изменений работает уже
существовавшая кнопка «Применить урон» → «Всем» (`damage.mjs`,
`showApplyDamageDialog`, берёт `game.user.targets`). Кнопка в карточке —
`.wh-place-template-btn` (`attack-card.mjs`/`hooks.mjs`), появляется при
`wp.blastRating > 0` (круг радиусом blastRating) или `wp.spray` (конус 30°,
длина = Rng режима оружия).

**Lingering-зона (свойство Linger) — реализована.**
[module/regions/linger-zone.mjs](../module/regions/linger-zone.mjs):
`LingerZoneBehaviorType` — `RegionBehaviorType` по образцу
[module/regions/difficult-terrain.mjs](../module/regions/difficult-terrain.mjs), только зона не рисуется ГМом
заранее, а создаётся программно в момент атаки (`placeLingerZone`, та же
геометрия из `templates.mjs`, но `canvas.regions.placeRegion` с
`create:true` — персистентный Region, не эфемерный). Правило корбука:
«Персонаж, впервые за ход входящий в шаблон или начинающий в нём ход,
получает попадание» — легло на нативные события Region Foundry v14 один в
один: `TOKEN_ENTER` (входит) + `TOKEN_TURN_START` (начинает в нём ход,
буквальное совпадение по смыслу, велосипед не понадобился); «впервые за
ход» — дедуп по ключу `раунд-ход` в `system.hitLog`.

Свойство Linger читается двумя рейтингами (пользователь уточнил дословно
в сессии 24.08.2026): X — сколько ходов **стрелка** (не любая смена
раунда!) зона переживает, Y (`lingerDrift`) — необязательный, на сколько
метров зона сдвигается каждый такой ход по розе смещения. Оба привязаны к
одному и тому же событию — началу Хода АКТОРА, породившего зону, — и это
не Region-событие (в зоне может никого не быть), а глобальный
`processShooterTurnStart(combatant)`, вызываемый из hooks.mjs по
`updateCombat` при смене хода (своя пара `Hooks.on`, не переиспользует ни
счётчики Орд/Сус-ан, ни `_lastTurnCombatant` экономики действий). Дрейф —
`LingerZoneBehaviorType#_drift()`: `SCATTER_ROSE` (module/combat/
scatter.mjs) получил числовые `deg` (0/45/90.../315, «Вперёд»=0°) именно
под это; «Вперёд» здесь — не линия огня (той уже нет спустя раунды), а
направление стрелок→точка первого размещения зоны, зафиксированное один
раз в `system.facingDeg` при создании. Задевает объединение токенов
«было ∪ стало» (позиция до и после сдвига) — приближение к «всем на пути»
без свипа полигона. Полная чистка — `clearAllLingerZones()` по
`deleteCombat` (бой кончился — считать ходы больше не от чего).

Кнопка `.wh-place-template-btn` та же, что у разового Шаблона — при
`wp.lingerRating > 0` несёт вместо мгновенной отметки целей полный
`damageData` (числа берутся из первого попадания очереди, «один бросок
урона на всех», как и у самого Взрывного) и создаёт не эфемерный, а
персистентный Region; дальше урон применяется автоматически, кнопку жать
больше не нужно.

Arc/Graviton/Through Shot (wdbc-wlwf) — ещё дальше, не начаты. Полный
разбор с file:line — «Атлас Механики» (ссылка в описании тикета wdbc-1pa,
раздел V).

## Параллельные сессии: общая рабочая копия и живые ресурсы

Рабочая копия и живой мир Foundry общие сразу на несколько сессий (правило с
20.08.2026). Два риска, и решаются они по-разному.

**Правка файла, которую тихо затирает другая сессия.** `Write` перезаписывает
файл целиком безусловно — если кто-то дописал что-то между вашим чтением и
записью, это стирается молча. `Edit` требует точного совпадения старого
текста: если файл с тех пор изменился, правка просто не применится с
ошибкой, а не тихо затрёт чужое. Поэтому: **перечитывать файл прямо перед
правкой, `Write` для существующих файлов не использовать** — только `Edit`
с точечным диффом. Действует на весь репозиторий, не только на код.

**Долгоживущий общий ресурс, где параллельная работа портит состояние, а не
просто конфликтует построчно.** Для этого — явный лок через `bd`, тот же
приём, что `--claim` даёт для задач: `bd update <id> --claim` перед началом
работы (атомарно: `assignee` = вы, `status=in_progress`, не даёт перехватить
занятое), `bd update <id> --status open --assignee ""` после. Не заводите
лок на каждую правку — только на подтверждённые горячие точки:

- `wdbc-a4l` — живой мир Foundry (один общий Chrome, один тестовый ГМ-аккаунт,
  один процесс на 30000 порту). Перед любой живой проверкой руками — взять.

**Живые проверки в Foundry сессия сама не делает** (правило с 02.09.2026).
Реализовал что-то, что по-хорошему нужно открыть и прощёлкать в мире — не
лезть в живой мир самому, а дописать пункт(ы) в `wdbc-5009` (накопитель
живых проверок) и продолжить работу. Обратный ход: если сессия САМА взяла
`wdbc-a4l` и по ходу дела живьём проверила что-то из списка `wdbc-5009` —
удалить эту конкретную подзадачу/пункт из тикета (она сделана, копить незачем).
Сам тикет `wdbc-5009` не закрывать никогда без прямого указания пользователя —
даже когда список пунктов внутри опустел.
- Книги во время постраничной сверки по PDF (метка `books` в `bd list --label
  books`) — один бид на книгу, состояние очереди и прогресс там же. Слияние
  правок в `packs-src/books/*.json` — не поверх всего файла, а по странице
  (см. `dbc-content`): у `entries[].pages[]` есть разреженный `pdfPage`
  (стоит только на первой странице-объекте группы, дальше — тот же физический
  лист PDF, пока не встретится следующий), так что ключ слияния — перенесённый
  вперёд номер страницы + имя раздела + позиция внутри страницы, а не сам
  `pdfPage` построчно. При любом расхождении структуры между версиями —
  останавливаться и показывать расхождение, не выбирать чью-то версию молча.

Это НЕ `bd merge-slot` — тот привязан к отдельной мердж-автоматике, назначение
которой в этом репозитории не выяснено; не переиспользовать, пока не
разобрались, что она делает.

**Скиллы `dbc-*` тоже общие и могут поменяться посреди сессии.** Штатная точка
чтения — начало работы (так написано в описании каждого скилла), поэтому
долгоживущая сессия может действовать по устаревшей версии, если её кто-то
обновил без её ведома. Перед тем как формировать финальный токен для сессии
«Гит», перечитать актуальную версию скиллов, которыми сессия пользовалась —
свериться, не разошлись ли выводы с текущими правилами.

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
