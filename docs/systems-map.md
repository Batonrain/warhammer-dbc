# Карта систем

Зачем этот файл: агент часто не знает, что какая-то механика вообще
реализована, пока не наткнётся на неё случайно или пока владелец не скажет
прямо. Здесь — где искать код/данные КАЖДОЙ игровой системы, сгруппированные
по смыслу книги, а не по алфавиту файлов. Читается в начале сессии вместе с
[AGENTS.md](../AGENTS.md) (который остаётся источником истины по конвенциям
и ловушкам — этот файл только карта местности).

## Как искать, если системы нет в списке ниже

Одна механика почти всегда — 2-3 файла с одинаковым смысловым именем:

- `module/rules/<имя>.mjs` — чистая логика/арифметика, без Foundry, тестируется
  напрямую;
- `module/combat/<имя>.mjs` или `module/apps/<имя>.mjs` — обвязка Foundry
  (диалог, кнопка, hook, чат-карточка);
- `module/constants/<имя>.mjs` — таблицы/данные, если механика табличная.

Имя файла обычно — английская калька названия Таланта/Мутации/Дара из книги
(Blood Shield → `blood-shield.mjs`, Кровавый Щит). Если не находится по
русскому названию — искать по `grep` английское имя предмета в `packs-src/`,
оттуда брать `flags`/`name` для поиска по коду.

## Поддержание каталога

Не полная пересборка на каждую сессию — только точечное дополнение, когда
сессия реально коснулась механики без записи здесь (см. этап 1 протокола
«Конец сессии», `bd recall cmd-konec-sessii`). Собран одним проходом
10.09.2026; с этого момента дополняется по факту, не проверяется на полноту
целиком.

---

## 1. Персонаж: сборка и производные расчёты

- `module/documents/actor.mjs` — диспетчер: при каждом обновлении актора
  вызывает нужный оркестратор по типу (character/daemon/vehicle/ship/horde/
  formation/squad).
- `module/data/actor/_creature.mjs` — общий миксин схемы «существа»
  (характеристики, навыки, раны, броня по зонам, псайкер, одержимость,
  очки действия) для Персонажа/Демона/Демон-Принца/Миньона.
- `module/rules/character.mjs` + `module/rules/character/{armour,final-pools,
  movement}.mjs` — оркестратор производных Персонажа/Демона/Принца/Миньона.
- `module/data/actor/character.mjs` — схема листа Персонажа (Покровительство,
  Гемункул, Жизненные потребности, пилот Дредноута).
- `module/sheets/actor-sheet.mjs`, `character-context.mjs`, `sheet-helpers.mjs`
  — оболочка листа (сборка контекста, не механика).
- Мастер создания: `module/apps/character-wizard.mjs` (5 этапов одним окном),
  `creation.mjs` (чистые функции Раса→Субраса→Мировоззрение→Архетип),
  `character-start.mjs` (кнопка запуска).

## 2. Характеристики, Навыки, Склонности, Опыт/Продвижение

- `module/constants/characteristics.mjs` — Характеристики и ступени Улучшения.
- `module/constants/skills.mjs` (+ `skill-descriptions.mjs`,
  `skill-specializations.mjs`, `skill-specialty-descriptions.mjs`) — Навыки и
  групповые специализации.
- `module/constants/advancement.mjs` — таблицы цены Характеристик/Навыков/
  Талантов по Склонностям.
- `module/rules/advance-category.mjs` — категория цены (Дружественная/
  Нейтральная/Враждебная) для Характеристики/Навыка/Таланта.
- `module/rules/aptitude-binding.mjs` + `apps/aptitude-binding-dialog.mjs` —
  какие две Склонности привязаны к объекту, с ручным переопределением с листа.
- `module/rules/aptitude-overrides.mjs` — расовое/субрасовое переопределение
  Склонности («у Африэль это всегда Дружественная»).
- `module/rules/mastery-targets.mjs` — к чему привязывается Талант «Мастерство».
- `module/rules/duplicate-grants.mjs` + `apps/duplicate-refund.mjs` — что
  делать с повторной выдачей уже взятого Навыка/Таланта (возврат опыта).
- `module/rules/pick-xp-cost.mjs`, `pick-budget.mjs` — цена/бюджет выбора из
  компендиума в опыте.
- `module/rules/friendly-specialties.mjs` — «дружественные специализации»
  Родного мира.
- `module/apps/xp-log.mjs` — Журнал опыта, живое окно.
- `module/sheets/tabs/advance.mjs` — вкладка Развитие на листе.
- Награды за сессию: `constants/session-rewards.mjs`, `rules/session-rewards.
  mjs`, `apps/session-rewards-app.mjs` (окно «Итоги Сессии»).
- `module/constants/start-levels.mjs` — стартовый опыт/Бесчестие/Порча по
  уровню игры.

## 3. Раны, Смерть, Лечение, Аблативный пул

- `module/rules/wounds.mjs` — единая арифметика потери Ран/Критических и
  аблатива (откуда бы урон ни пришёл).
- `module/rules/wound-tier.mjs` — уровень Ранения (лёгкое/тяжёлое/критическое).
- `module/rules/death-save.mjs` — Чудесное Спасение, Божественная Защита,
  Замедленная Анимация (Сус-ан Мембрана Астартес).
- `module/rules/ablative-ap.mjs` — общий примитив «−1 заряд аблатива за
  попадание» (мод брони, Роба Чемпиона, Минный Плуг техники).
- `module/combat/ablative-wounds.mjs` — авторегенерация аблатива по Ходу.
- `module/combat/damage.mjs` — применение урона (`showApplyDamageDialog`):
  поглощение, локация, критический эффект — центральный расчёт.
- Подвиды урона в скобках книги (I(Cr)/X(Fr)/E(El)/E(Fl)/E(Ls)/C(Tx), wdbc-q0q8,
  12.09.2026) — на уровень точнее широкого `damageType`: `system.damageSubtype`
  у оружия (`data/item/weapon.mjs`), `damageImmunity.subtype.*` (иммунитет),
  `system.absorption.vsSubtype.<подвид>` (AP-бонус, читает
  `combat/armor-properties.mjs::resolveArmorAbsorptionAP`), `ARMOR_PROPERTIES`
  auto-директивы `noApVsSubtype`/`doubleApVsSubtype`/`tripleApVsSubtype`/
  `apBonusVsSubtype` (`constants/items.mjs`) для свойств брони (Conductive,
  Flak, Vulcanized, Flak Lining), Конструктор-вид `kind:"absorption"` (тот же
  AP-бонус, но для НЕ-брони — Мутаций/Черт/Талантов) и `kind:"shieldSubtype"`
  (только `type:"forcefield"`, читается НАПРЯМУЮ с самого предмета щита в
  момент броска — `_rollActiveShield`, не через синтетический ActiveEffect —
  щит либо не срабатывает против подвида (mode:"exclude", Нерушимая Лента),
  либо меняет рейтинг для этого броска (mode:"override", Морозное Сердце)).
  Исключение из общего конвейера: тик Горения (`combat/condition-ticks.mjs`)
  игнорирует броню целиком по умолчанию — свойство `fireproof` даёт точечное
  исключение (собственное AP тела ИМЕННО этого предмета, удвоенное — Броня
  Огненного Дракона).
- `module/sheets/tabs/{death,healing,wounds}.mjs` — UI Смерти, Лечения,
  расчётов Ран на листе.
- Именные: `apps/ablative-ap-shield.mjs` (Роба Чемпиона), `apps/
  psalm-unseen-fortress.mjs` (ресинк «Купола Рефрактора»), `apps/
  sus-an-heal.mjs` (исцеление Сус-ан по игровым суткам).

## 4. Движение и экономика действий

- `module/rules/movement.mjs` + `character/movement.mjs` — таблица SPD×1/2/3/6
  для Персонажа/Демона/Миньона/Принца/Орды.
- `module/rules/encumbrance.mjs` — общий Перевес инвентаря.
- `module/combat/action-economy.mjs` — 2 ОД + 1 Реакция за Ход.
- `module/combat/movement-actions.mjs` — Полудвижение/Полное/Натиск/Бег/Выход.
- `module/combat/movement-terrain.mjs` — Трудный Ландшафт при Беге/Натиске.
- **Полёт (стр. 30, wdbc-x1nz.2, 18.09.2026):** `combat/movement-actions.mjs`
  — `actorCanFly`/`actorHasFlyer` (гейт по Черте Flyer/Hoverer — Hoverer БЕЗ
  Flyer поднимается только на Приземную), `showFlightDialog` (4 тира:
  `landed`/`ground`/`low`/`high`, флаг `system.movement.altitude`, по
  умолчанию `landed` — явное «не летит», не молчаливый дефолт на Приземную),
  `_syncFlightElevation` (синхронизирует нативный `TokenDocument#elevation`
  — 0 у Приземной НАРОЧНО, не 2 буквальной книги, иначе ложный авто-бонус
  «Положение выше», `tactical-map.mjs::hasHighGround`; 10/25 у Низкой/
  Высокой), `_showFlightLocDialog`+`_resolveFallDamage` (Потеря управления —
  высота падения по таблице, ЗАТЕМ обычная механика Падения: 1d10+высота,
  Группирование, спецправило «успехов больше высоты — 0 урона гарантированно»).
  `movement-terrain.mjs::effectiveTerrainInfo` — Трудный Ландшафт полностью
  снимается на любой высоте полёта (`IN_FLIGHT_ALTITUDES`). Автомодификаторы
  попадания по высоте цели/атакующего (Низкая −10 стрелковой, Высокая —
  блок без Зенитного, рукопашная против Низкой/Высокой недосягаема целиком,
  гасится при равной высоте обеих сторон) — `sheets/attack/mods.mjs`.
  Шаблоны/зоны, построенные на `canvas.regions.placeRegion` (Взрывное —
  `combat/templates.mjs::placeAttackTemplate`, Остаётся — `regions/
  linger-zone.mjs`, Гравитонное — `regions/graviton-zone.mjs`, Вихрь Рока —
  `regions/vortex-zone.mjs`) получают `elevation:{bottom:0, top:радиус}` —
  без него Region у Foundry по умолчанию бесконечен по высоте (подтверждено
  по исходнику `region.mjs`), и персонаж, летящий НАД зоной на любой высоте,
  засчитывался бы попавшим наравне со стоящим в ней; граница «сфера радиусом
  с саму зону» — не буква правила, книга её текстом не даёт, это чтение.
  Трудный Ландшафт (`regions/difficult-terrain.mjs`) сюда НЕ входит — у него
  свой механизм игнора (флаг высоты полёта, не elevation региона), зона
  рисуется ГМом вручную и не привязана к конкретному радиусу оружия.
- Визуализация: `combat/range-cells.mjs`, `range-rings.mjs`,
  `reachable-cells.mjs` (подсветка клеток по Dijkstra).
- Доп. ходы/действия: `combat/snapshot.mjs`, `assassin-strike.mjs`,
  `extra-turn.mjs`, `last-actor.mjs`, `middle-of-the-hunt.mjs`,
  `devourer-of-time.mjs` (Пожиратель Времени — доп. Ход в конец инициативы
  после захвата Врасплох, полудействие жертв каждый раунд).

## 5. Бой: конвейер атаки/защиты, состязания

**Конвейер теста (общий, не только бой):**
`module/rules/resolve-test.mjs` (фазы 1-3), `kind-outcome.mjs`, `roll-outcome.
mjs`, `roll-mods.mjs`, `test-kind.mjs` (+`test-kind-widget.mjs`), `difficulty.
mjs`, `extended-test.mjs`, `delegate-test.mjs`, `reroll-pick.mjs`, `assists.
mjs`, `match-context.mjs`, `situational.mjs`, `initiative.mjs`; `documents/
combatant.mjs` (бросок Инициативы с Преимуществом).

**Конвейер атаки:** `combat/attack.mjs` (оркестратор) → `attack-weapon.mjs`
(профиль/хват/боеприпас) → `attack-threshold.mjs` (порог) → `attack-outcome.
mjs` (попадания/локация/урон) → `attack-card.mjs` (карточка чата);
`crit-effect-parser.mjs` (разбор крит-таблиц в счётчики). UI:
`sheets/attack-dialog.mjs` + `sheets/attack/{dialog,form,markup,mods,
selection}.mjs`, `combat/aim.mjs` (прицеливание кликом по канвасу).

**Защита:** `combat/defense.mjs` (Уклонение/Парирование), `combat/cover.mjs`
(авто-детект укрытия), `combat/evasion-pool.mjs`, `combat/hand-shield.mjs`,
`combat/shield.mjs` (силовые щиты, d100 против рейтинга).

**Прицеливание (wdbc-1rno.5, 16.09.2026):** Полу-/Полное — настоящие HUD-
действия (`combat/aiming-action.mjs::aimMenuItems/declareAim`), тратят ОД
(`rules/aiming.mjs::aimApCost`) вместо бывшей радиокнопки в диалоге атаки без
расхода вовсе (это был баг основного конвейера, не «не смоделировано»).
Бонус хранится как `actor.system.aiming` — читает `attack-dialog.mjs`, не
зная, откуда оно взялось; тратится любым действием актора, кроме следующей
Атаки (`action-economy.mjs::_maybeClearAiming`, `combat/damage.mjs`).
Модификаторы цены/бонуса — по одному файлу на источник: `rules/aim-focus.mjs`
(продление на все стрелковые атаки до конца следующего Хода за Реакцию),
`rules/tracking-aim.mjs` (бесплатный P+0 гасит штраф «Цель Бежит»),
`rules/cold-eyes.mjs`/`blessing-of-magnus.mjs`/`psalm-of-guidance.mjs`
(бесплатное/дешёвое Прицеливание — Холодные Глаза, Благословение Магнуса,
Псалом Наставления). Не путать с `combat/aim.mjs` — прицеливание КЛИКОМ
мыши для выбора цели атаки, другая вещь несмотря на созвучное имя.

**Незримое (wdbc-1rno.2, 16.09.2026):** атака типа Незримое (стр. 32) реально
блокирует Уклонение/Парирование, пока цель не засекла её — `rules/
unseen-attack.mjs` (wp.unseen structural-флаг оружия/психосилы/Техночуда,
`isUnseenDetected` — три канала: реактивный тест, персистентное Ноосферное
Сканирование, пассивное Варп-Зрение/hasWarpSight, радиационный канал/
hasRadiationDetection) + `combat/unseen-attack.mjs` (`_performUnseenDetect`
реактивный тест, `_performUnseenBypass` — Sixth Sense/Music of Battle тратят
Очко Бесчестия вместо теста) + `attack-card.mjs::defenseSection` gate (кнопки
disabled+data для клиентского разблока, `hooks.mjs`). Талант-слой (частично) —
`rules/unseen-talents.mjs`: Blind Fighting (−20 без засечения в рукопашной),
Backstab (×2 кубика урона), Sniper Assassin (продлённая лестница доп. кубиков),
Blindside (target-scoped метка), Defensive Rider (редирект НЕ работает против
Незримого), Hair Trigger (см. «Караул» ниже — реализован 16.09.2026). Честно
не смоделировано: призыв оружия Точным Телекинезом/Клинками Силы + третий
класс «частичного Незримого» (wdbc-1rno.28).

**Скрытная Атака/Врасплох (wdbc-1rno.3, 20.09.2026):** facing-детект
Незримого — `combat/facing.mjs::isOutsideDefenderView` (см. п. 8, «Тактическая
карта»), исключение для Janus (`rules/janus.mjs`). Per-attack галочка «Цель
Врасплох» доведена до именованного `attack.mjs::targetSurprised` (id
`atk-mod-surprised`, `sheets/attack/mods.mjs`→`form.mjs`→`dialog.mjs`, тот
же приём, что `hiddenAttack`) — читают `rules/quiet-elimination.mjs`
(+1 куб урона/тихая смерть по ЛЮБОМУ оружию при Врасплох, +10 к атаке
независимо от Врасплох с ножом/игольчатым/осколочным пистолетом —
situational авто-мод) и Rapid Reaction (п. 9, «Состояния» — другой,
несвязанный книжный пункт под тем же словом). Взор Неизбежности/Gaze of
Inevitability (Дар Нургла, `rules/gaze-of-inevitability.mjs`) — пассивная
половина: `combat/defense.mjs` комбинирует Порог Уклонения/Парирования с
W−10 (`rules/test-kind.mjs::combinedThreshold`), если защищающийся видит
глаза атакующего-носителя (геометрия `vision-target.mjs`), провал снимает
все Реакции — единственная находка сессии, тронувшая общий конвейер
защиты напрямую (не через facing-детект выше). Честно не смоделировано:
слежение за позицией/обзором весь Ход атакующего (только снимок на момент
атаки), ветка «+30 Врасплох» самой Скрытной Атаки (по-прежнему ручная
галочка ГМа).

**Караул/Overwatch (wdbc-1rno.27/.37, 16.09.2026):** действие «стрелять вне
своего Хода по врагу, вошедшему в объявленный сектор», реализовано с нуля —
`rules/overwatch.mjs` (бюджет Одиночных ½BS.b(окр.▼), капается наибольшим
RoF; правило «Очередь расходует Караул целиком, Одиночный — 1 из бюджета»),
`rules/simultaneous-action.mjs` («Одновременные Действия», core.json у
«Задержка» — сравнение Ag/Инициативы, кто действует первым), `rules/
hair-trigger.mjs` (пометка «следующий выстрел — Незримый», тот же примитив,
что Hidden Threat) + `combat/overwatch.mjs` (Foundry-обвязка: HUD-пункты
«Караул»/«Сканирующее Продвижение» по образцу `aiming-action.mjs`, реактивный
`Hooks.on("updateToken")` на движение врага в сектор — геометрия через уже
существующий `rules/facing.mjs::isWithinArc`, ручная кнопка «Стрелять из
Караула» для условий, которые движок не детектирует, тест Подавление+20 —
`combat/suppression.mjs::rollSuppressionTest`). Три Таланта-потребителя
подключены тем же проходом: Vigilance/Бдительность (реагирующий сравнивается
по max(Ag,P)), Hair Trigger/Палец на Спуске (встречный тест — за столом,
кнопка только фиксирует исход), Scanning Advance/Сканирующее Продвижение
(Полудвижение+Караул одним полным действием, сектор до 90°). Честно не
смоделировано: Легаси-Мутация Оружия Наследия «Терпение» (не История —
это Мутация таблицы характера «Бдительное», `constants/legacy-weapon.
mjs:154`, «+30/всегда первый в Карауле»; не путать с Мутациями/Дарами
ПЕРСОНАЖА от Порчи — две разные системы, см. wdbc-1rno.41). Машиночитаемое
поле у неё есть (`system.legacy.mutations[]` — `{name, text, roll,
character}`), просто никакой combat-код его пока не читает; стрелковая
половина вайрится примитивами Караула без новой архитектуры, рукопашная
ждёт отсутствующего в системе действия «Задержка».

**Состязания/захват/верхом:** `combat/techniques.mjs` (диспетчер опросного
диалога `_showContestDialog` для Повалить/Финт/Давление/Напролом/Обезоружить/
Заломить), `combat/grapple.mjs` (Борьба), `combat/mount.mjs` + `rules/mount.
mjs` (верховой бой), `combat/tactical-map.mjs` + `rules/tactical-map.mjs`
(база/дистанция/контакт).

**Финт/Давление/Напролом (wdbc-x1nz.2.65, 20.09.2026):** эффект победы в
состязании раньше нигде не применялся (бросок засчитывался и всё). Теперь —
`combat/feint-press.mjs` (`feintBlocksEvasion` — Финт реально запрещает
Уклонение/Парирование цели до конца её следующего Хода через пару флагов
attacker↔target, снимается `clearFeintAtTurnEnd` в `hooks.mjs`; Давление даёт
только текстовую подсказку дистанции, авто-толчок не реализован) и
`combat/bulldoze.mjs` (Напролом — штраф/запрет по Размеру цели, подавление
Свободных Атак через существующий `disengageActive`, Повален+Пинок на 5+
успехах). Честно не смоделировано: Напролом против ОЧЕРЕДИ из нескольких
врагов одним броском — `_showContestDialog` рассчитан на одного оппонента,
для честной реализации нужна отдельная архитектура (см. заголовок
`bulldoze.mjs`).

**Приёмы и Стойки (wdbc-x1nz.2.66, 22.09.2026):** эффекты сверх WS/
Уклонения/Парирования теперь реализованы почти все. Взмах — запрет
Избирательной атаки (форсированный `#atk-aim`, `attack-dialog.mjs::
forcedAimValue/aimLocked`). Пила — гейт по свойству оружия
(`requiresWeaponProps`), ½S.b урона (тот же слот, что у Обратного Хвата),
Rng→0, игнор силовых щитов-куполов (`damage.mjs::_rollActiveShield`
читает `wp.ignoreDomeShields`). Оглушить — тот же форс `#atk-aim`
(«Голова»), игнор Primitive, конверсия непоглощённого урона в Оглушение
(`damage.mjs::stunManeuver`, ⌈netDamage/2⌉ Раундов через уже существующий
`conditionApplyFields`). Захват — `combat/grapple.mjs::
resolveGrappleSuccess` (встречный тест Athletics vs Athletics вместо
безусловного попадания через `_showContestDialog`, запрет против целей на
2+ Размера), альтернатива штрафу Парирования −30 — банк Успехов
(`evasion-pool.mjs::spendPoolSuccesses`, тот же банк, что у Отскока/
негации попаданий). Повалить — новый `combat/knockdown.mjs` (авто-Ничком,
доп. урон на 5+ на выбор, штраф по Размеру); `_showContestDialog` получил
`techDef.allowedChars/charLabels` — сужает общий 10-характеристичный
дропдаун до Athletics(S)/Acrobatics(A) книгой, не любой характеристики.
Стойки: Защитная (Полное действие вместо Полудействия + запрет Натиска при
щите), Прикрывающая (`free-attack.mjs::coveringDefendersOf` — союзное
зеркало `enemyContactTokenDocs`, штраф −20 атакам по прикрытым союзникам +
триггер свободной атаки через `offerFreeAttack`), Пружинящая (SPD+2 Вольту
— `movement-actions.mjs::vaultHalfMove`, −10 тестам S — новый ситуативный
авто-мод `rules/situational.mjs::springingStrengthPenalty`), Частокол
(HUD-кнопки Натиск/Бег гейтятся `MELEE_STANCES[*].noCharge/noRun`, не
только пилюля диалога атаки), «только в пешем бою» учитывает высоту полёта
(`system.movement.altitude`, не только `isMounted`). Новый
`combat/recognize-stance.mjs` — Awareness(WS)+20 раз в Раунд, автоуспех на
Пределе 75+, раскрывает чужую Стойку. Честно не смоделировано: очерёдность
действий по инициативе (Частокол/Захват) и «поле зрения»/линия видимости
(`recognize-stance.mjs`) — решает стол.

**Приёмы и Стойки — фильтр доступности и доводка Прикрывающей (22.09.2026,
wdbc-x1nz.2.66.14/.15/.16):** диалог атаки уже прятал недоступные Приёмы/
Стойки из списка (категория оружия/Баланс/Тренировка/пешком) — но отдельная
персистентная панель «Стойка» на вкладке БОЙ (`character-context.mjs::
combatStanceOptions`, кнопки `.technique-btn-stance`) показывала все 6 Стоек
без этого фильтра. Общая логика вынесена в `rules/melee-stance-gate.mjs::
meleeStanceAllowed` — подключена и в контекст листа (список кнопок), и
вторым рубежом в клик-обработчик `tabs/combat.mjs` (на случай устаревшего
рендера листа у другого клиента). Заодно найден и убран мёртвый код: панель
«База» на той же вкладке была снята с разметки ещё 29.08.2026 (осознанно —
База выбирается в диалоге атаки, у «Натиска» есть быстрая кнопка на панели
ДВИЖЕНИЕ), но `combatBaseOptions`/`.technique-btn-base` в JS остались
неубранными. Прикрывающая Стойка (`free-attack.mjs::friendlyContactTokenDocs`)
решением стола расширена: Neutral-диспозиция защищена наравне с Friendly —
но симметрично по лагерям (обе диспозиции в {Friendly,Neutral}, либо обе
Hostile), не «любой Neutral рядом с кем угодно».

**Длина Оружия (wdbc-x1nz.2.67, закрыт 22.09.2026):** книжный раздел про
числовой Rng рукопашного оружия (стр. 39) раньше нигде не читался — теперь
все 5 книжных правил реализованы. `constants/combat.mjs::meleeEffectiveRange`
(база профиля/выбранной длины + Хват + Приём: Выпад +1, Пила →0) и
`rules/weapon-length.mjs` (`longerWeaponBonus`, `chargeTargetDodgeBonus`,
`closeQuartersPenalty`, `extendedReachCells`/`meleeContactDisplay`). Бонус
атакующему за более длинное оружие и штраф вблизи для Rng≥6 — автогалочки в
`sheets/attack/mods.mjs`; бонус Избегания цели при Натиске на оружие короче
на 3+ — живой пересчёт на сабмите формы (`sheets/attack/selection.mjs::
resolveSelection`). Расширенный Базовый контакт для Rng 8/9 (`wdbc-x1nz.2.
67.1`) — бейдж диалога атаки читает `meleeContactDisplay`, не трогая общий
`rules/tactical-map.mjs::contactType()` (сознательно, blast radius). Выбор
длины оружия за атаку (`wdbc-x1nz.2.67.2`) — поле `system.rangeMin` на
предмете (weapon.mjs), пилюли «Длина» в диалоге атаки, показываются только
когда `rangeMin>0 && rangeMin<range`; content-проход по всем 16 книгам
(только 3 реально содержат диапазоны Rng — core.json, chaos.json,
machines.json) плюс починка сопутствующего старого бага `range=0` у оружия
демонов/Дредноутов (`wdbc-x1nz.2.67.2.1`/`.2.1.1`).

**Хваты рукопашного оружия (wdbc-x1nz.2.68, закрыт 22.09.2026):** сверка
раздела «Хваты» (стр. 39, `constants/combat.mjs::GRIPS`) с книгой нашла 4
числовых расхождения и 1 несовпадение пака. «1р» давал +1 Rng ВСЕГДА, а
книга — только как вторичному хвату (перехват двуручного одной рукой);
`meleeEffectiveRange` получил параметр `isSecondary` (только вызов из окна
атаки, `sheets/attack/selection.mjs`, реально его вычисляет — остальные 3
вызывающих места читают основной хват оружия, `isSecondary=false`).
Попутно найден и починен третий баг того же хвата: «Баланс −1» (`secBal`)
был заведён в данных, но `gripEffects()` его не читал — Порог Парирования
не менялся; добавлено `balMod` (относительный мод, в отличие от `balSet` —
абсолютной подмены у Бл/Хв), подключено в `combat/defense.mjs::parryProfile`.
«2р» вторичный → +10 Оглушить/Повалить и «Об» → +10 Финт — новая
`gripManeuverBonus()`: Оглушить читает `selection.mjs` (обычный WS-манёвр),
Финт/Повалить — отдельные Состязания, бонус подсказан в `defaultMod`
диалога (`sheets/tabs/combat.mjs::contestGripBonus`). Длинные Руки (Размер
1+ увеличивает максимальную дальность, не минимальную) — новый параметр
`sizeBonus` у `meleeEffectiveRange`, исключены Ног/Гол/Зуб/Хв/Щуп (книга
явно исключает голову/ногу/укус; хвост/щупальце — не рука по тому же
принципу, книга их не описывает вовсе). Пак: `Parasitic_Bite` grips
«Рот»→«Зуб» (нераспознанный хват съедал 1 руку из бюджета за укус).
**Ловушка, пойманная тестами до коммита:** два разных фоллбэка «хват не
задан» в кодовой базе — `parseGrips(...)[0] ?? null` (данные) против
`currentMeleeGrip()`'s `parseGrips(...)[0] || "1р"` (rules/hands.mjs) —
если сравнивать их напрямую для isSecondary, любое оружие без заполненного
`sys.grips` ложно считается «вторичным хватом 1р». При написании новых
мест, сравнивающих «текущий хват» с «основным хватом оружия», брать
фоллбэк `|| "1р"` с ОБЕИХ сторон сравнения, не `?? null` ни с одной.

**Типы Рукопашного Оружия (core.json, разд. «Типы Рукопашного Оружия» +
«Безоружный Бой», 22.09.2026):** книжный раздел про типовые особенности по
`system.meleeCategory`/`system.meleeSubtype` (Булава/Топор/Молот/Крюк/Когти/
Кистень/Кнут/Посох/Меч-Рапира/Сабля/Кулак-Кулак.Б/Щит/Укус) не читался нигде
вообще. Статические бонусы/штрафы атаки — `sheets/attack-dialog.mjs`
(baseParts-строки Булава +10/Крюк −10/−15, Рапира −10 к штрафу Избирательной
за отказ от +1 Rng Выпада, Сабля отмена +20 Верховой Атаки) и `sheets/attack/
selection.mjs` (`swordSubtypeBon` — Рапира +10 Выпад/−10 Взмах, Сабля
наоборот). Урон/эффекты попадания — `combat/attack.mjs` (Молот/Топор +1d10 и
Concussive/Felling по лежачей/«у стены» цели — галочка `atk-target-against-
wall`, «лежачая» авто по `conditions.prone`; Когти.Р +1 Dmg за нечётный
Успех кроме первого — `flatBonus`, гейт по хвату «Л»/«П+Л»; Кнут — Snare(−2)
опциональной кнопкой при попадании в конечность) и `combat/draw-action.mjs::
resolveFlailMeleeFumble` (Кистень/Кнут — Критический Промах бьёт по себе в
случайную часть тела, Кнут без S.b). Реакция «Повалить» на 3+ Успеха
Крюком/Избирательное в Ногу Посохом — `attack-card.mjs::
reactionKnockdownSection` + `hooks.mjs::.wh-reaction-knockdown-btn`
(переиспользует готовый `combat/knockdown.mjs`). Занятость руки Когти.Р
(хват «Л»/«П+Л») была багом молчаливо игнорировавшим правило — `rules/
hands.mjs::MELEE_GRIP_HANDS` поправлен на 1 руку (было 0). Борьба: Укус
теперь автопопадание без WS/BS-теста (был баг, шёл полным броском) и
Заломить с экипированными Когтями бьёт их формулой урона вместо
фиксированного 1d5+S.b (deg=1) — оба `combat/grapple.mjs::_doBite/
_resolveWrenchSuccess`. Безоружное Парирование (раздел «Безоружный Бой», не
«Щит») — новая механика (раньше не было вовсе ни для одного оружия): −20
голым рукам против «полноценного» оружия, экземпция Кулака.Б
(`meleeSubtype:"Кулак.Б"` на интегральной атаке) только против R/E(+Power
Field); Силовое поле атакующего против безоружной защиты — 1-75 бросок,
попадание по Руке своим S.b — оба `combat/defense.mjs::_performParry`. Щит:
арка 180° и Primitive-броня щита потребовали новых derived-полей
`system.absorption.{noShield,shieldSourceLoc,shieldPrimitiveLoc}`
(`rules/character.mjs`, источник — `combat/hand-shield.mjs::
shieldCoverageByLocation`) и галочки «Цель вне арки щита» на кнопке
применения урона (`attack-card.mjs`/`hooks.mjs` → `combat/damage.mjs`,
параметр `shieldOutOfArc`); слепота от прикрытия головы щитом переиспользует
готовый `isBlindedActor`-путь (`attack-dialog.mjs`). Честно НЕ
смоделировано: выбор Сабли «две атаки по разным целям вместо +20» —
геометрии «пути Натиска» и второго независимого броска попадания в системе
нет (только галочка отмены +20 + текстовое напоминание в карточке, тот же
честный предел, что у `burstSecondaryTargets`); Трейт Bite → грант
природного оружия и «выбор укус/другие конечности, если источник не
единственный» — отдельная объёмная фича (генерация `integralAttack`-
предмета), в системе не существует вообще ни в каком виде.

**Связан в Рукопашной (wdbc-x1nz.2.64, 20.09.2026):** персонаж в базовом
контакте с враждебным не мог быть ограничен в стрельбе НЕ по рукопашной, и
промах по цели в чужой рукопашной не рикошетил. `combat/free-attack.mjs`
(`lockingContactTokenDocs`/`allContactTokenDocs` — контакт, отфильтрованный
по классу оружия рукопашное/пистолет) + `sheets/attack/mods.mjs`
(`lockedByEnemies`/`targetLocked` — автофейл стрельбы вне рукопашной и штраф
−20 по цели в чужой рукопашной) + `combat/attack.mjs` (`misfireHits` —
промах по заблокированной цели рикошетит в случайного участника контакта,
d100, новый бросок урона/локации) + `attack-card.mjs::misfireHitsSection`
(кнопка применения урона через существующий `data-force-target`, без
ре-таргета ГМом).

**Клин и Надёжность (wdbc-x1nz.2.61, 20.09.2026):** обычное оружие не
клинило вовсе. `combat/clear-jam.mjs::rollRestoreJammedAmmo`/
`clearJamOption` (Расклин — тест на восстановление патронов, не мгновенный),
`data/item/weapon.mjs` (`jammedAmmo`), Предел −2/Very Unreliable 81+ —
`combat/weapon-properties.mjs`.

**Подавление/Укрытие/Взрывы (wdbc-x1nz.2.62/.63, 20.09.2026):** рукопашники
были не подвержены Подавлению, укрытия не деградировали и не давали
множителя против Blast. `combat/suppression.mjs` (рукопашный охват),
`combat/damage.mjs` (`combinedCoverBase`/`blastCoverMult` — ×2/×3/×4 против
Blast по типу урона; деградация укрытия при `penetration >= manualCover`),
`combat/attack-outcome.mjs` (`bonusDamageDice` — +1d10 X-Dmg Blast в тесном
помещении).

**Мораль/Страх/Подавление:** `rules/morale-test.mjs`, `combat/suppression.
mjs`, `combat/intimidate.mjs`, `combat/fear.mjs`.

**Встречный тест — накопленный бонус по цели:** `rules/personal-adaptation.
mjs` (Персональная Адаптация, Тзинч — +5 к Порогу за каждый встречный тест
против ТОЙ ЖЕ цели, капируется Cor.b, срок 9 лет), подключена в ОБОИХ
местах разрешения встречного (сторона-инициатор — `rules/kind-outcome.mjs`;
сторона-ответчик — `sheets/actor-sheet.mjs::_maybePostOpposedComparison`,
uuid инициатора прокинут через `hooks.mjs::"opposedResponse"`).

**Именные боевые способности (по одному файлу на Талант/Дар/Черту)** — если
ищешь конкретный корбук-приём и не нашёл выше, он почти наверняка здесь:
`adjutant.mjs` (Командование, переброс для Командира), `adrenaline-rush.mjs`,
`arc.mjs` (Дуга — цепной удар), `avatar-of-slaughter.mjs`, `blade-shield.mjs`,
`bow-to-audience.mjs`, `counter-attack.mjs` (встречная атака), `deadly-
effectiveness.mjs`, `death-dance.mjs`, `dodge-advantage.mjs`, `dominator.mjs`,
`dread-wail.mjs` (+`apps/dread-wail-dialog.mjs`), `electrovigour.mjs`,
`enjoyment.mjs`, `eternal-warrior.mjs`, `eye-of-challenge.mjs` (Око Вызова),
`free-attack.mjs`, `fully-armed.mjs`, `gangrene.mjs`, `equipped-melee.mjs`,
`irradiated.mjs`, `just-the-light.mjs`, `lord-of-exodites.mjs`, `nurgling-
infestation.mjs`, `pacifism.mjs`, `perfect-host.mjs`, `plague-shepherd.mjs`
(+`apps`), `prisma.mjs` (Призма), `radiation.mjs` (Лучевая болезнь), `recharge.
mjs`, `recoil.mjs`/`recoil-pool.mjs`/`recoil-item-bonuses.mjs` (Отскок,
+`apps/recoil.mjs` UI), `reload.mjs`, `skillful-torture.mjs`, `snapshot.mjs`,
`through-shot.mjs` (Выстрел Насквозь), `tireless-warrior.mjs` (+`apps`),
`touch-of-entropy.mjs`, `turn-state-shield.mjs`, `unseen-beggar.mjs`,
`voice-of-god.mjs`, `vulture.mjs`, `witchs-edge.mjs`, `hallucinogenic.mjs`,
`ogryn-weapon-break.mjs`, `frenzy.mjs` (Ярость — переключатель,
`system.inRage`), `fully-armed.mjs`.

## 6. Оружие и его свойства

- `module/data/item/weapon.mjs` — схема Оружия; `ammo.mjs` (Боеприпас, правит
  профиль); `weapon-mod.mjs` (Модификация: прицел/глушитель/хват).
- `module/constants/weapon-properties.mjs` (реестр Свойств оружия), `ammo.mjs`,
  `weapon-categories.mjs`.
- `module/combat/weapon-properties.mjs` — движок автоматизации Свойств,
  центральный для атаки/защиты/урона; `weapon-profiles.mjs`, `weapon-mods.mjs`,
  `reload.mjs`.
- `module/rules/dual-wield.mjs` + `dual-wield-talents.mjs` — два оружия и
  ветка Талантов сверх базового штрафа; `weapon-training.mjs` (Арсенал);
  `improvised-weapon.mjs` (импровизированное/метание).
- Оружие Наследия: `constants/legacy-weapon.mjs`, `rules/legacy-weapon.mjs`,
  `apps/legacy-weapon.mjs` (блок «Наследие» на листе оружия, включая кнопки
  «потратить Очко Бесчестия» Убийцы/Перебора/Душесвязанного/Щита Ненависти).
  Применение конкретных Историй/Мутаций в бою (wdbc-1rno.35, закрыт
  21.09.2026 — 44/45 с механикой) — точечные хуки в `combat/attack.mjs`/
  `sheets/attack/mods.mjs`/`sheets/attack-dialog.mjs`/`combat/defense.mjs`/
  `combat/damage.mjs`/`combat/action-economy.mjs`/`hooks.mjs` (клики карточек,
  очистка на конец боя/смену Раунда), плюс geometry- и карточные хелперы:
  `combat/legacy-weapon-betrayal.mjs` (союзник рядом), `combat/legacy-weapon-
  mutations.mjs` (ближайший неповреждённый враг), `combat/legacy-weapon-
  excess.mjs` (каскад W+0/Порча), `combat/legacy-weapon-killer.mjs` (очистка
  Felling на конец боя), `combat/legacy-weapon-kill-credit.mjs` (Ужасающее/
  Злорадство — реагируют на смерть/трату Судьбы), `combat/legacy-weapon-
  reaper.mjs`/`legacy-weapon-stunning.mjs` (кнопки на карточке урона/
  Уклонения), `combat/legacy-weapon-brave-heart.mjs` + `combat/movement-
  actions.mjs::declareLegacyBraveHeartMove/declareLegacyBraveDisengage`
  (свободное Полудвижение/Выход из Боя), `combat/legacy-weapon-regroup.mjs`
  (отложенный переброс Инициативы на смену Раунда). Прогресс по всей таблице
  (10 Историй + 35 Мутаций) — bd-комментарии тикета `wdbc-1rno.35`.
- Дар «Рука-Пушка»: `rules/gun-arm.mjs`, `apps/gun-arm.mjs`, `migrations/
  gun-arm-source.mjs`. «Рука Смерти»: `rules/hand-of-death.mjs` + `apps`.
  «Выстрел не тратит патрон»: `rules/ammo-free.mjs`.
- `migrations/weapon-grips.mjs` — разовое заполнение Хватов/Профилей из текста.

## 7. Броня, щиты, защитные поля

- `module/data/item/armor.mjs` — схема Брони (AP по 6 зонам); `armor-mod.mjs`
  — Модификация/Система силовой брони; `forcefield.mjs` — Защитное поле
  (рефрактор/конверсионное/купол).
- `module/combat/armor-mods.mjs`, `armor-properties.mjs` (движок Свойств
  брони), `hand-shield.mjs` (Ручные щиты), `shield.mjs` (Силовые щиты).
- `module/rules/armour-penalty.mjs` (штраф выключенной силовой брони),
  `ablative-ap.mjs`, `void-air.mjs` (запас воздуха герметичной брони),
  `cover-locations.mjs` (Укрытие по зонам тела).
- Истории комплекта силовой брони: `data/item/armour-history-entry.mjs`,
  `constants/power-armour-lore.mjs`, `apps/armour-history.mjs` +
  `armour-history-trance.mjs`.
- Перегрузка щита: `combat/damage.mjs::_applyShieldOverload` — общий примитив,
  не только «выключился, нужен ремонт»: `overloadDamageFormula`/
  `overloadFatigueFormula` (доп. непоглощ. урон/Усталость НОСИТЕЛЮ, Морозное
  Сердце) и `overloadRetaliateFormula`/`overloadRetaliatePen` (wdbc-1rno.2,
  16.09.2026 — бьёт формулой в АТАКУЮЩЕГО обычным конвейером урона,
  Archeotech Refractor «Перегрузка»; `isRetaliation` обрывает цепь).

## 8. Пространственные механизмы: Шаблоны, Ауры, Зоны

Полное описание уже в [AGENTS.md](../AGENTS.md#шаблоны-и-ауры--два-разных-пространственных-механизма).
Дополнительно не разобрано там:
- `module/regions/cover.mjs`, `difficult-terrain.mjs` — Region Behavior
  Укрытия и Трудного Ландшафта (ГМ ставит вручную).
- `module/regions/graviton-zone.mjs` — свойство «Гравитонное» (уменьшающийся
  Blast).
- `module/regions/vortex-zone.mjs` — Vortex of Doom/Вихрь Рока (психосила,
  wdbc-ufns, 14.09.2026): персистентная Region-зона с раундовым тестом
  поддержания КОНТРОЛЁРА (W+5×тPR−5×Х на начале его Хода, тот же триггер, что
  и у Гравитонного/Linger — `processVortexTurnStart` из `updateCombat`),
  приглашением других псайкеров с Mind Over Matter в радиусе Х×10м
  вмешаться Реакцией и ПЕРЕХВАТИТЬ контроль (попарное состязание «текущий
  чемпион vs новый реагирующий», тай-брейк Успехи→тPR→W — не N-сторонний
  одновременный турнир, тот же принцип упрощения асинхронного чата, что у
  ЛЮБОГО делегированного теста проекта, `rules/delegate-test.mjs`),
  победитель тратит Успехи на ±1 Х или сдвиг зоны на 1м (`wh-vortex-spend-btn`),
  провал — случайный дрейф Х (1d10−6) и позиции. Первый прецедент в проекте
  «несколько кандидатов в радиусе МОГУТ вмешаться, победитель определяется
  состязанием» — если появится вторая такая сила, этот файл и есть образец.
- `module/regions/runic-weave-zone.mjs` — Руническая Вязь как Region-документ
  (носитель — стена/помещение, не предмет на акторе).
- `module/regions/scene-live-recalc.mjs` — общий регистратор «живой пересчёт
  по сцене», на нём держатся Ауры и Рунические Вязи.
- `module/rules/facing.mjs` + `combat/facing.mjs` — геометрия направления
  (Cloak, арки техники/корабля); `rules/vision-target.mjs` (кто меня видит,
  без стен/LoS); `rules/aoe-target.mjs` (разовая выборка токенов в радиусе).
  `combat/facing.mjs::isOutsideDefenderView` (wdbc-1rno.3) — «Скрытная
  Атака» (стр. 32): атакующий вне сектора обзора защищающегося на момент
  атаки → `wp.unseen=true` (`combat/attack.mjs`), снимок, не слежение за
  всем Ходом; дефолт `sight.angle=210°` всем новым акторам ставит хук
  `preCreateActor` в том же файле. Исключение — `rules/janus.mjs`
  (носитель Janus не подхватывает Незримое этим путём вовсе). Пассивная
  половина Взора Неизбежности (Дар Нургла, `rules/gaze-of-inevitability.mjs`)
  — отдельный крюк в `combat/defense.mjs` (Уклонение/Парирование
  Комбинированный с W−10, если защищающийся видит глаза атакующего-
  носителя; провал снимает все Реакции), не через этот facing-примитив.
- `module/rules/tactical-map.mjs` + `combat/tactical-map.mjs` — Тактическая
  карта (wdbc-8k0i, стр. 31): размер Базы (2×2/3×3, null = Размер 2+, «на
  откуп ГМу»), дистанции от края/от центра Базы, вид контакта none/base/deep,
  дефолт диагонали мира (`applyBookDiagonalDefaultOnce`, wdbc-x1nz.2.23).
  `isBaseTrackedActor` — кто вообще участвует (личный масштаб + Шагоход,
  wdbc-x1nz.2.21). `combat/free-attack.mjs` — Свободная Атака при разрыве
  контакта, гасится `disengageActive`/`deepContactCarry` (переноска раненого/
  пленного, wdbc-x1nz.2.19). `combat/squeeze.mjs` + `rules/squeeze.mjs` —
  напоминание о тесноте при протискивании через дверь уже половины Базы
  (wdbc-x1nz.2.24, только формальные Двери Foundry).

## 9. Состояния, Усталость, Страх, Здравомыслие

- `module/constants/conditions.mjs` — единый реестр книжных Состояний.
- `module/rules/condition-duration.mjs` (срок поверх Duration ActiveEffect),
  `condition-guards.mjs` (иммунитет/смягчение от Конструктора),
  `condition-mirrors.mjs` (игровые метки, отображаемые как Состояния),
  `turn-flags.mjs` (флаги «до начала следующего своего Хода»),
  `fatigue-grace.mjs` (порог Усталости).
- `combat/rapid-reaction.mjs` + `rules/rapid-reaction.mjs` (wdbc-1rno.3) —
  реакция на `conditions.surprised` (стр. 12, начало боя): карточка-
  приглашение в начале Хода носителя таланта, тест A+0 отменяет 0 ОД/0
  Реакций этого Хода (повторный `action-economy.mjs::resetActionEconomy`,
  уже без снятого флага). НЕ про per-attack галочку «Цель Врасплох» (стр.
  32) — то отдельное правило, см. `attack.mjs::targetSurprised`
  (п. 5, конвейер атаки).
- Конструктор kind:"condition" — пять режимов (не четыре книжных, wdbc-tqfj):
  apply/remove (разовые, момент получения предмета), immunity/mitigate (живые,
  condition-guards.mjs/item-rules.mjs), и **onTargetFail** (живой, новый,
  14.09.2026) — «наложить Состояние ЦЕЛИ делегированного теста Сопротивления
  психосилы при провале» (Choir of Poxes). Читает `rules/on-target-fail.mjs`
  из ЕДИНОЙ точки финализации ЛЮБОГО делегированного теста Навыка/
  Характеристики (`actor-sheet.mjs::_runTest`) по новому полю payload
  `onFailItemUuid` — кладёт ТОЛЬКО psychic.mjs при запросе теста
  Сопротивления, gate строгий (обычный делегированный тест это поле не несёт).
- `module/combat/condition-effects.mjs`, `condition-ticks.mjs` (тик по Ходам —
  Кровотечение/Горение). Горение несёт три завязанных на предметы живых
  проверки — все читают Механику НАПРЯМУЮ с предмета, ничего не пишут при
  получении (`combat/damage.mjs`): `kind:"shieldVsCondition"` (щит можно
  бросить против тика, гасит Состояние целиком, wdbc-5knb),
  `kind:"shieldArmorGate"` (щит не рассматривается без надетой брони,
  wdbc-giae), `kind:"burningGrace"` (armorMod ИЛИ forcefield — Cooler/
  Охладитель, Frozen Heart/Морозное Сердце: при уроне поджигания ≤10 даёт
  1d5 Ходов без эффектов Горения, автоматика без кнопки, `ensureBurningGrace`
  — wdbc-3pv5). Урон поджигания хранит `system.conditions.burningSourceDamage`
  (выставляется в момент наложения — Flame-свойство/крит-таблица).
- Потеря Конечностей (стр. 30-31, wdbc-1rno.6) — `lostHands/lostArms/lostFeet/
  lostLegs/lostEyes` в `constants/conditions.mjs` (counter:"count"), уже
  влияют на Экономику Рук (`rules/hands.mjs::maxHands`), Движение/Уклонение
  (`rules/character/movement.mjs`, `combat/defense.mjs`), BS и угол Караула
  (`sheets/attack/mods.mjs`, `rules/overwatch.mjs::overwatchMaxArc`), Ослепление
  при потере обоих глаз (`rules/predicates.mjs`). Автоналожение из
  Критических Эффектов и «Цель теряет руку/ногу» — `combat/crit-effect-
  parser.mjs`. Отложенная проверка Гангрены обрубка (T.b дней, 1d10 1-8 —
  80%) — `rules/limb-loss.mjs` (чистая логика) + `combat/limb-loss.mjs`
  (розыгрыш по тому же `updateWorldTime`, что двигает виджет Календаря).
  Лечение — три режима диалога `sheets/tabs/healing.mjs`: Ампутация,
  Пришивание, «Обработка обрубка»; Бионика восстанавливает lostX при выборе
  части тела. Мутация Loss of Limb/Потеря Конечности — НЕ реализована,
  вынесена в wdbc-1rno.6.1 (гейт Best.Q сравнением субмутации, субтаблица
  «Пальцы» — открытые решения).
- `module/apps/token-conditions.mjs` — синхронизация с Token HUD.
- `module/sheets/tabs/conditions.mjs` — вкладка Состояния/Усталость.
- `module/constants/fear-tables.mjs` — Страх/Шок/Ментальная Травма/Расстройства.
- Здравомыслие пилота Дредноута: `rules/dreadnought.mjs`, `sheets/tabs/
  dreadnought-panel.mjs`.
- Расстройства/Травмы: `data/item/mental-disorder.mjs`, `mental-trauma.mjs`,
  `sheets/tabs/disorders.mjs`.

## 10. Расы, Субрасы, Легионы, Пути, Архетипы, Элитные архетипы

- `module/constants/races.mjs`, `rules/race.mjs` (истинная раса с учётом
  Прошлого), `apps/races.mjs` (применение расы), `apps/race-library.mjs` +
  `sheets/race-picker.mjs`.
- `data/item/race.mjs`, `subrace.mjs` (parentKey, charRollAdvantage,
  removesTraits).
- `module/constants/legions.mjs` — Легионы Космодесанта (Геносемя/Культура/
  Проклятье); `rules/legion-fit.mjs`, `legion-upgrade.mjs`.
- Пути Азуриан: `constants/aeldari-paths.mjs`, `rules/library/paths.mjs`,
  `sheets/tabs/paths.mjs`, `apps/subrace-choice.mjs` (выбор «по игроку» у
  Африэль/Эльданар). Книжная фраза Таланта «Мастер на Пути X» уже проверяется
  готовой формальной системой, не нужно искать отдельный механизм (wdbc-318b):
  `AZURIANE_PATHS` хранит путь по ключу (например `bonesinger`) с градациями
  novice/next/master/lost, актёр хранит `system.paths: [{key, grade}]` —
  проверка `paths.some(p => p.key === X && p.grade === "master")`.
- Происхождения Аэльдари (Миры-Корабли/Корсары): `constants/aeldari-origins.
  mjs`.
- `module/constants/archetypes.mjs`, `data/item/archetype.mjs`, `apps/
  archetypes.mjs` — Архетипы Мастера создания.
- Элитные архетипы: `constants/elite-archetypes.mjs`, `data/item/
  elite-archetype.mjs`, `rules/elite-requirements.mjs`, `apps/elite-buy.mjs` +
  `elite-req-builder.mjs`, `sheets/elite-picker.mjs`.
- Расовые библиотеки правил: `rules/library/{aeldari,astartes,ogryn,core}.mjs`;
  `rules/ogryn-fit.mjs` (аналог legion-fit для Огринов).

## 11. Происхождения и Предсказания

- `constants/homeworlds.mjs`, `data/item/homeworld.mjs`, `apps/homeworlds.mjs`.
- `constants/divinations.mjs`, `data/item/divination.mjs`, `apps/
  divinations.mjs`.
- `rules/library/homeworlds.mjs` — машинная часть (Мир-храм/Мир Смерти/
  Промышленный мир).
- `apps/origin-shared.mjs` — общий диалог выборов/выдачи/отката для обоих;
  `withOriginLock(actor, tag, fn)` — очередь (не запрет) на actor+tag для
  ЛЮБОГО «clear носитель, потом grant новый» апплая (applyHomeworld(Picks),
  applyDivination(Picks), races.mjs::applyLegion) — без неё параллельный/
  повторный вызов (напр. character-wizard.mjs раньше звал `.then(...)` без
  `await`) читает «носителя ещё нет» дважды и создаёт два, задваивая бонусы
  (видно только на вкладке ЭФФЕКТЫ, не на самом листе — там дропдаун/`.find()`
  показывает только первый) — wdbc-gbpe, 14.09.2026. `clearGrantedBy` там же
  подчищает «осиротевших» дублей-носителей (только для homeworld/divination —
  их носитель НЕ самотегируется `originGrant`, в отличие от race/subrace/
  archetype, которых granted-фильтр уже ловит по тегу без доп. логики).
  Разовая миграция уже существующих дублей — `migrations/duplicate-origin-
  cleanup.mjs`, `game.warhammerDBC.migrateDuplicateOrigins()`.
- Подключаются флагами `homeworlds`/`divinations` в `constants/features.mjs`
  (см. §26).

## 12. Мутации, Дары Богов, Порча

- `constants/mutations.mjs`, `data/item/mutation.mjs`, `rules/submutations.
  mjs` + `apps/submutations.mjs` (таблица субмутаций из текста мутации).
- `constants/chaos-patron.mjs` — палитра листа по Богу.
- Именные Мутации/Дары (каждая — своя мини-механика): `addiction.mjs`
  (+`apps`), `cancerous-healing.mjs` (+`apps`), `compression.mjs`,
  `flayed.mjs` (+`apps`), `hyper-growth.mjs` (+`apps`), `icon-of-blasphemy.mjs`
  (+`apps`), `illusion-detection.mjs` (+`apps/illusion-of-normality.mjs`),
  `library/synesthesia.mjs`, `tentacle-hand-form.mjs` (+`apps`),
  `vampiric-dependency.mjs` (+`apps`), `warp-eater.mjs`, `fleshmetal-regen.mjs`
  (Облитератор), `breath-of-life.mjs` (+`apps`, Дар Нургла), `perfect-host.
  mjs`, `unseen-beggar.mjs` (см. также §5 — многие мутации срабатывают в бою).
- Лик Бога (Countenance of Khorne/Nurgle/Slaanesh/Tzeentch) — общий
  переиспользуемый механизм на все 4 Дарителя: `rules/countenance-of-
  gods.mjs`, script-запись на самом предмете (`apps/item-script.mjs`).
  `combat/purity-of-battle.mjs` (Дар Кхорна — снимает боевые
  наркотики/психосилы в радиусе), `combat/touch-of-pain.mjs` (Дар Слаанеш —
  безоружные/природные атаки игнорируют T.b и получают Shocking) (wdbc-1rno,
  13.09.2026).
- Ещё именные (wdbc-1rno, кластер Дары Богов/Общие Мутации, 12.09.2026):
  `crimson-angel.mjs` (Багровый Ангел, Кхорн), `cast-out-of-death.mjs`
  (Изгнанный из Смерти, Нургл — регенерация по «Календарю»), `fatalism.mjs`
  (Фатализм, Нургл), `dance-of-deception.mjs` (Танец Обмана, Слаанеш),
  `eater-of-pain.mjs` (Пожиратель Боли, Слаанеш), `egomania.mjs` (Эгомания,
  Слаанеш), `ever-youthful.mjs` (Вечно Юный, Слаанеш), `eye-of-envy.mjs` (Око
  Зависти, Слаанеш), `kiss-of-death.mjs` (Поцелуй Смерти, Слаанеш),
  `hatred.mjs` (Ненависть, Талант), `devourer-of-knowledge.mjs` (Пожиратель
  Знаний, Тзинч — кража Навыка на сутки/навсегда по «Календарю»),
  `perfect-sorcerer.mjs` (Совершенный Чародей, Тзинч — снимает запрет
  Высшего Колдовства по Покровительству), `sundering.mjs` (+`apps/`,
  Разделение, Тзинч — на смерти клонирует САМОГО чемпиона в 2 копии,
  урон копий d10→d5→флэт, откат в конце сцены), `armour-of-the-gods.mjs`
  (+`apps/`, Доспехи Богов, Общие Мутации — выдаёт Элитный архетип
  «Ironclad/Броненосец» без опыта + реальную броню «Божественные Латы»),
  `blessed-fits.mjs` (Благословенные Припадки, Общие Мутации — Оглушение от
  провала переброса за Очко Бесчестия, возврат Очка через
  `combat/condition-ticks.mjs`), `burned-senses.mjs` (+`apps/`, Выжженные
  Чувства, Общие Мутации — второй бросок по таблице чувств, перманентная
  потеря Зрения/Слуха). Общесистемный тест на Жару/Холод (`combat/
  temperature-hazard.mjs` — раньше был только в display-виджете Окружения,
  см. §21) найден и реализован попутно при разборе Бриза (Breeze).
- Ещё именные (wdbc-1rno/wdbc-ux8a, 15.09.2026): `fruit-of-flesh.mjs`
  (+`apps`, Плод Плоти), `soul-seer.mjs` (+`apps`, Душевидец),
  `organ-of-chaos.mjs` (+`apps`, Общие Мутации), `combat/wrapped-in-chaos.mjs`
  (+`apps`, Укутанный в Хаос — направленные штрафы атакующий↔защитник поверх
  паттерна из `combat/defense.mjs`, все 10 субмутаций закрыты),
  `volunteer-actor.mjs` (+`apps`, Доброволец Актёр — Поцелуй Арлекина, полная
  миграция личности через §22 `actor-control.mjs`), `maggot-parasite.mjs`
  (+`apps`, Опарыш-Паразит), `parasite-trait.mjs` (+`apps`, общий Трейт
  «Parasite» — контакт/срыв/слияние характеристик, любой носитель Трейта, не
  только Опарыш; `constants/conditions.mjs::parasiticContact` тикает
  generic-циклом `combat/condition-ticks.mjs`).
- Ещё именные (wdbc-1rno.1, 15-16.09.2026): `prophet-of-gallerpox.mjs`
  (Пророк Гэллерпокса, Нургл — заражение Vehicle/Ship-актора, штраф −30
  против ядов не-Нурглитам на сцене, новый scope "poison" в
  `resolve-test.mjs`), `hidden-threat.mjs` (Сокрытая Угроза, Тзинч — флаг
  «следующая атака Незримая», её собственный −50 к засечению) поверх общего
  примитива «Незримое» (wdbc-1rno.2, 16.09.2026): `rules/unseen-attack.mjs`
  (wp.unseen, isUnseenDetected/markUnseenDetectedUntilNextTurn/hasWarpSight)
  + `combat/unseen-attack.mjs` (_performUnseenDetect, реактивный тест) —
  Уклонение/Парирование ТЕПЕРЬ реально гейтятся, пока цель не засекла атаку
  (attack-card.mjs::defenseSection, клиентский DOM-разблок в hooks.mjs),
  `bronze-myrmidon.mjs` (Бронзовый Мирмидон, Кхорн — редирект попаданий
  Сочленение/Глаз → Рука/Голова у актора с активным Трейтом Machine),
  `black-eyes.mjs` (Чёрные Глаза, Слаанеш — иммунитет к штрафам
  Тьма/Дым/Слабый свет при Cor 60+). Уравнитель (Нургл, `item-rules.mjs::
  opposedTargetRerollRules`) дореализован целиком — вторая половина
  (противник-инициатор встречного теста) теперь тоже форсирует переброс,
  точка принуждения добавлена в `sheets/actor-sheet.mjs::_runTest`.

## 13. Демонология: Демоны, Демон-Принц, Одержимость

- `data/actor/daemon.mjs`, `demon-prince.mjs` (наследует Daemon);
  `sheets/daemon-sheet.mjs`, `demon-prince-sheet.mjs`.
- `constants/demon-mechanics.mjs` (пантеон/ранги/формы манифестации),
  `demon-prince.mjs` (Дары, пары Трейтов), `demon-weapon.mjs` (Демонические
  Свойства оружия по пантеонам).
- `combat/demon-destabilize.mjs` + `rules/demon-destabilize.mjs` —
  дестабилизация формы демона: реальный тикающий срок вместо справочной
  строки на листе.
- `apps/armiger-weapon.mjs` — демон-Оруженосец, связанный не с токеном на
  сцене (см. `apps/demon-summon.mjs`), а с `system.daemonWeapon` предмета-
  оружия; `rules/armiger-veil-range.mjs` — Завеса вокруг него считается по
  Порче ХОЗЯИНА, не своей.
- Одержимость: `constants/possession.mjs`, `mount-possession.mjs` (демон в
  скакуне/байке), `sheets/tabs/possession.mjs`.
- `rules/daemon-locus.mjs` (радиус Локуса Герольда), `daemonblood.mjs`
  (+`apps`, психосила «Кровь Демонов»).
- Бесчестие: `apps/infamy-points.mjs` (общий пул), `rules/starting-infamy.mjs`,
  `temp-infamy.mjs` (временное, отдельное от обычного).
- Именные: `blood-shield.mjs` (+`apps`), `eternal-war.mjs` (+`apps`,
  Принц Кхейна), `kings-plate.mjs` (+`apps`), `determination-to-fight.mjs`,
  `one-against-a-hundred.mjs`, `dominator.mjs`, `library/avatar-of-slaughter.
  mjs` (+`combat/avatar-of-slaughter.mjs`).
- `sheets/tabs/patron-panel.mjs` — Патрон/Протеже (Наследник, «Помазанник(X)»
  Демона-Принца).

## 13a. Друкхари: Гемункул, Биолаборатория, Осколочное оружие, Боль

- `constants/haemonculus.mjs` (6 ступеней возвышения), `bio-lab.mjs`
  (Ферментный Чан), `drukhari-bio.mjs`, `drukhari-factions.mjs` (Кабал/Культ
  Ведьм/Ковен), `drukhari-gear.mjs` (Клонирующее Поле), `drukhari-armor-
  fields.mjs` (Психокостяной костюм/Призрачная броня), `drukhari-splinter.mjs`
  (каскад яда Осколочного оружия).
- `sheets/tabs/haemonculus.mjs`, `sheets/tabs/pain.mjs` (Очки Боли).
- `apps/skillful-torture.mjs` — восстановление Характеристик от пытки.

## 14. Психосилы, Техночудеса, Мистика, Ритуалы, Варп

- Психосилы: `data/item/psychic-power.mjs`, `rules/psyker.mjs`, `psy-range.
  mjs` (парсер дальности), `psychic-vessel.mjs` (фамильяр/конструкт-
  манифестация), `constants/{disciplines,psyker,psyker-tables}.mjs`,
  `sheets/tabs/psychic.mjs`. Область Конструктора `power`/`power:<имя>`
  (модификатор/переброс/доп.провалы к манифестации конкретной силы или любой) —
  `rules/item-rules.mjs::scopeTarget`, `rules/resolve-test.mjs::powerScopeApplies`
  (wdbc-4bxa). `system.weaponProps` психосил (Экстремальный урон/Felling/Lance
  и т.п. на психической атаке) — движок готов (`sheets/tabs/psychic.mjs`,
  `aggregateAuto`); rating свойства может быть формулой с «PR» (Blast(2×PR) и
  т.п.), «СУ»/книжным «Успехи» (Devastating Rain) или Cor.b/др. бонусом
  характеристики (Infernal Gaze: Felling(Cor.b)) — резолвится
  `combat/weapon-properties.mjs::resolvePropRating(s, prValue, {deg, rollData, x})`
  тем же безопасным парсером, что и Пробитие психосилы (тот же резолвер, не
  отдельная копия, wdbc-ufns), плюс `mechRollData(actor)` для X.b-нотации;
  дайс-рейтинг (Flame «2d10», Arc «7/2d10+PR») возвращается строкой для
  `new Roll()`, не резолвится числом, «PR» ВНУТРИ дайс-строки тоже
  подставляется (wdbc-lui3/wdbc-kifa/wdbc-cy4z/wdbc-wv8u, 13-14.09.2026) —
  раньше не подставлялось и роняло бросок исключением Unresolved StringTerm.
  «Х» — опциональное item-defined производное значение (`sys.xFormula`, тем
  же языком формул), когда книга вводит одну переменную сразу для
  damage+penetration+rating одного предмета (Vortex of Doom: «Х=½Успехи
  (окр.▲)», wdbc-ufns) — считается один раз в psychic.mjs, подставляется
  текстом в damage (Roll не понимает функции резолвера) и через options.x
  во все резолверы rating/pen того же предмета. `requiredSuccesses` — поле
  НА ЗАПИСИ weaponProps (не в реестре), гейтит применение записи по числу
  Успехов ЭТОГО психотеста (`filterPropsBySuccesses`, Neural Storm/Fire
  Barrage-Bolt-Storm/Force Bolt, wdbc-zlx7); `requiredSuccessesScalesSize` —
  порог ×2 за уровень Размера ЦЕЛИ, проверяется отдельно в
  `hooks.mjs::_applyWeaponPropEffect` в момент клика (Размер известен только
  тогда, кнопка строится раньше выбора цели). Toxic/Haywire — нестандартный
  книжный урон через `rating2` вместо дефолтного «1d10»/табличного значения
  (`damageFromRating2`, wdbc-cy4z). Дуга (Arc) у психосил — кнопка `.wh-arc-btn`
  раньше не рисовалась вовсе (только у обычного оружия, attack-card.mjs);
  теперь строится и в psychic.mjs::executePsychotest тем же гейтом «первое
  попадание достигло arcRating» (wdbc-86rm).
  Контентом заполнены практически все атакующие психосилы с непустым уроном
  (~93 из 847 — остальные не атаки, weaponProps у них пуст правомерно);
  открытые остатки — wdbc-rhst (Energy Surge: профиль атаки по войдшипу, не
  по персонажу — реестр WEAPON_PROPERTIES тут неприменим в принципе, другой
  домен) и Neural Storm (движок не различает «выбрать одно» vs «оба сразу» —
  договорённость на игроке/ГМ по тексту карточки, не энфорсится).
  Сустейн-баффы к ДРУГИМ тестам (не к своей манифестации, kind:testMod
  modCharBonus:"pr") фиксируют эPR момента каста в `system.sustainedEpr`
  психосилы (по образцу `sustainedDegree`, wdbc-8m0x) — `item-rules.mjs`
  читает его вместо живого `psyker.currentRating`, если не null (wdbc-1wvn,
  14.09.2026). Force Blade (wdbc-vxgd) — первый пример ДИНАМИЧЕСКОГО заполнения
  `system.effects.weaponBuff` игроком через диалог (`apps/force-blade-choice.
  mjs`) вместо ручного авторства Конструктором: игрок тратит Успехи манифестации
  на покупку свойств из книжного прайс-листа (`constants/force-blade-shop.
  mjs`), результат пишется в weaponBuff и читается тем же
  `combat/weapon-mods.mjs`, что и статично прописанные баффы — переиспользовать
  этот паттерн, если появится вторая такая сила (флаг `hasWeaponShop`).
  Радиус поддержания (wdbc-efyl, 17.09.2026) — книга у части сил даёт ВТОРУЮ,
  отдельную дальность специально для поддержания (маркер `(П)`, не совпадает
  с дальностью манифестации: Concentration/Концентрация PR×1м/PR×5м и ещё 33
  силы, найдены и сверены построчно с книгой в wdbc-z9jp). Поле
  `system.sustainRange` психосилы (пусто — использовать обычный `range`),
  общая точка входа `rules/psy-range.mjs::sustainRangeText(system)`. Пока
  только хранится и показывается на карточке манифестации — живой геймплейный
  гейт (снятие поддержания при выходе цели за этот радиус) не подключён нигде,
  первый потребитель на очереди — Fruit of Flesh/Плод Плоти (`apps/
  fruit-of-flesh.mjs`, субмутация «Заточение Силы», см. NOTES в wdbc-efyl,
  связано с эпиком wdbc-1rno).
- Техночудеса: `data/item/tech-power.mjs`, `constants/tech.mjs`,
  `tech-imperatives.mjs` + `combat/imperative-bonuses.mjs` + `rules/
  imperative.mjs`, `constants/implant-mechanics.mjs`, `apps/infoguard.mjs`
  (Инфограждение — сопротивление предмета Техночудесам).
- Сила Навигатора: `data/item/navigator-power.mjs`.
- Мистика/Варп: `constants/veil.mjs` (+`veil-icons.mjs`), `apps/veil.mjs`
  (окно ГМа: Завеса/Ритуалы/Навигация/Таро), `apps/veil-overlay.mjs`
  (варп-хоррор при истончённой Завесе).
- Варп-маршруты (wdbc-r0w9, 17.09.2026): `data/item/warp-route.mjs` (мировой
  предмет — не вложен в систему, соединяет ровно две через systemAUuid/
  systemBUuid), `apps/warp-route.mjs` (привязка/отсоединение слотов,
  генератор признаков), `rules/{warp-route,warp-route-traits,warp-guide,
  warp-route-charting}.mjs` (шесть таблиц признаков, капы, Проводники —
  навигатор/психоактивный/демон/одержимый/принц демонов, Усталость,
  Прокладка/Начертание маршрута), `sheets/tabs/warp-routes.mjs` (блок
  «ВАРП-МАРШРУТЫ» на вкладке Мистика — Знание Проводника, `knownRoutes` на
  `data/actor/_creature.mjs`). Подключено в шаги окна «Навигация»
  (`apps/veil.mjs`) — см. также §19 (привязка к Звёздной системе).
- Ритуалы: `data/item/ritual.mjs`, `apps/ritual-cast.mjs`,
  `sheets/tabs/rituals.mjs`, `sheets/ritual-cast-dialog.mjs`.
- Рунические Вязи: `data/item/runic-weave.mjs`, `constants/runic-weaves.mjs`,
  `rules/runic-weave.mjs`, `regions/runic-weave-zone.mjs`.
- Таро Императора: `constants/{tarot,tarot-images}.mjs`.
- Именные психосилы/техночудеса: `psalm-unseen-fortress.mjs` (+`apps`),
  `reformation-song.mjs` (+`apps/reformation-song-dialog.mjs`),
  `bone-song.mjs`, `song-of-swiftness.mjs`, `wraithbone-song-dialog.mjs` (общий
  диалог трёх Техник Певцов Кости), `spirit-talk.mjs`, `preservation.mjs`,
  `just-the-light.mjs`, `conjure-wraith.mjs`, `dread-wail.mjs` (+`apps`),
  `resplendent-raiment.mjs` (+`apps`), `apps/herd-spirits-summon.mjs`,
  `apps/demon-summon.mjs`.
- **Фокус Дисциплины (wdbc-l6zg, 14.09.2026) — ЧИСТО ДАННЫЕ, без игрового
  эффекта.** `system.psyker.focusDisciplines` (выбор игрока) +
  `rules/psy-focus.mjs::effectiveFocusDisciplines/hasFocusDiscipline` (объединяет
  с дарованным способностями — первый потребитель `rules/perfect-sorcerer.mjs
  ::PERFECT_SORCERER_FOCUS_DISCIPLINES`), `constants/disciplines.mjs
  ::NO_FOCUS_DISCIPLINES/canHaveFocusDiscipline` (книжный список дисциплин без
  Фокуса). Видно на вкладке МИСТИКА (чипы в панели ПСАЙКЕР + бейдж «★ Фокус» на
  строке психосилы своей дисциплины), но у пометки нет механических
  последствий: книжный эффект Фокуса (изучение психосилы без «изучения», только
  за опыт; обучение других) висит на ещё не существующей в системе механике
  изучения психосил (wdbc-1rno) — когда она появится, читает отсюда же.
- Руны Сигиллитов: `rules/sigillite-runes.mjs` (пул `system.sigilliteRunes`,
  производный максимум 20 + Библиотека Рун × Бонус Интеллекта + ступени
  Forbidden Lore (Archeotech), цена манифестации бPR×2, Рунный Удар),
  `rules/sigillite-runes-combat.mjs` (установка пула в бPR на старте боя и
  начисление в начале своего Хода — хуки `combatStart`/`updateCombat`),
  Путь Силы `PSY_PATHS.sigillite` поверх обычного конвейера
  (`sheets/tabs/psychic.mjs`), ячейка «Руны N/M» в шапке листа. Включается
  Чертой «Магия Сигиллитов»; контент — `packs-src/traits/Элитные_архетипы/
  Сигиллит/` и Таланты в той же папке Талантов. Не Состояние: у записи
  реестра Состояний нет поля под растущий максимум.
  Сделано и подтверждено живой проверкой 12.09.2026 (wdbc-fsl9 закрыт,
  чек-лист wdbc-lx57 — 9 из 9 без расхождений). Числами подключены три
  Таланта из шести; остальные три — открытые тикеты wdbc-p2it (Заготовленная
  Руна), wdbc-exjp (Импровизированная Руна, Прометеев Огонь — обоим нужен
  список изученных Рун), wdbc-qd6w (сочетание механик Пути, Тауматургия,
  −30 обнаружению манифестации).

## 15. Крафт, Мастерская, Качество, Разгрузка

- `constants/craft.mjs` (движок Крафта/Исследований) + `craft-icons.mjs`,
  `apps/craft-workshop.mjs` (отдельное окно), `sheets/tabs/craft.mjs`
  (то же на листе), `rules/craft-advantage.mjs` (Преимущество на тестах).
- `constants/quality.mjs` — движок Качества снаряжения (Poor…Artisan).
- `constants/rig.mjs` + `apps/rig-manager.mjs` — Разгрузка (слотовая модель).

## 16. Хирургия, Импланты, Кибернетика, Геносемя

- `data/item/implant.mjs` (механика), `cybernetic.mjs` (просто замена части
  тела, механику несёт implant).
- `constants/body-map.mjs` (классификация по частям тела), `implants.mjs`
  (заготовки от архетипов), `implant-mechanics.mjs`.
- `apps/surgeon.mjs` (Хирургикон) + `surgeon-plan.mjs` (парная имплантация).
- `rules/cybernetic-excellence.mjs` + `apps/cybernetic-excellence.mjs`
  (синхронизация Трейта «Многорукий» с покупками Таланта).
- `apps/implant-bestq-choice.mjs` (wdbc-ukpu, 10.09.2026) — диалог выбора
  бонусного эффекта Best.Q-биоимплантов Друкхари при смене Качества на
  Высшее: `system.bestQualityEffects` (варианты из книги, `tools/bestq-
  implant-options.mjs`) → выбор пишется в `system.chosenEffects`, каждый
  доп. эффект (включая повтор) поднимает `system.availability` на 1.
  Хуки в `warhammer-dbc.mjs` (`createItem`/`updateItem`), кнопка на листе —
  страховка на случай отменённого диалога.
- `migrations/gene-seed-cleanup.mjs` — чистка снятой системы Органов Геносемени.

## 17. Миньоны, Орды, Отряды, Формирования, Командование

- Миньоны: `data/actor/minion.mjs`, `constants/{minions,minion-traits}.mjs`,
  `rules/minion-build.mjs`, `apps/{minion-creator,minion-talent,minions}.mjs`,
  `sheets/minion-sheet.mjs`, `sheets/tabs/minions-panel.mjs`.
- Орды: `data/actor/horde.mjs`, `rules/horde.mjs`, `horde-convert.mjs`
  (+`apps`), `horde-damage.mjs` (+`combat/horde-damage.mjs`),
  `horde-geometry.mjs`, `combat/horde-psych.mjs`, `combat/horde-tokens.mjs`,
  `sheets/horde-sheet.mjs`.
- Отряды: `data/actor/squad.mjs`, `rules/squad.mjs`, `squad-roles.mjs`,
  `constants/squad.mjs`, `sheets/squad-sheet.mjs`.
- Формирования («Книга Битв»): `data/actor/formation.mjs`, `rules/formation.
  mjs`, `constants/formation.mjs`, `sheets/formation-sheet.mjs`. Подключается
  флагом `battleBook` (см. §26) — единственная фича, добавляющая свой тип
  актора.
- Командование/Присутствие: `rules/command.mjs`, `sheets/tabs/command.mjs`
  («Под моим Присутствием» — командование не входящими в отряд).

## 18. Техника (Vehicles)

- `data/actor/vehicle.mjs`, `rules/vehicle.mjs`, `constants/{vehicle,
  vehicle-traits}.mjs`.
- `data/item/{vehicle-gear,vehicle-trait}.mjs`, `migrations/
  vehicle-trait-effects.mjs`.
- `constants/vehicle-weapons-library.mjs` — библиотека Орудий Техники.
- `combat/vehicle.mjs` — Вираж/Таран/Трудный Ландшафт/урон по стороне брони.
- `sheets/vehicle-sheet.mjs`.
- Пилот Дредноута — см. §9 (`rules/dreadnought.mjs`).
- **Шагоход (Walker)** — `rules/walker.mjs` (арифметика без Foundry) +
  `combat/walker.mjs` (обвязка): Ходовая «Шагоход» двигается и бьёт КАК
  ПЕРСОНАЖ, поэтому её Парирование/Уклонение (−Размер×10, Уклонение
  комбинировано с Operate−10), Натиск (+20 рукопашной машины на Раунд),
  Опрокидывание вместо сбивания с ног, поворот 180° вне Хода (Combat Master
  пилота — до ½WS.b раз) и «всё оружие за одно действие» считает пилот, а не
  машина. Дословный текст девяти книжных пунктов —
  `constants/vehicle.mjs::CHASSIS_FULL_NOTES.walker`.
- **Выбор стороны брони при атаке персонажа по технике** (wdbc-kp1o,
  11.09.2026) — `sheets/attack-dialog.mjs` + `sheets/attack/{dialog,form,
  markup}.mjs` показывают Лоб/Борт/Корму и опцию «Избирательная атака в
  Корму −20» (с Лба/Борта), когда цель — vehicle; проброс до
  `damageData.side` через `combat/attack.mjs` → `combat/attack-card.mjs` →
  `hooks.mjs` → `combat/damage.mjs` (fallback на `"side"`, если сторона не
  выбрана). Реализует п.9 Шагохода выше: `rearCalledShotBlockedByWalker =
  isMelee && isWalkerVehicle(target)` — рукопашная Избирательная атака в
  Корму по Шагоходу запрещена, дальнобойная и атака по обычной технике —
  разрешена.

## 19. Корабли, Космический бой, Звёздные системы

- `data/actor/ship.mjs`, `rules/ship.mjs`, `constants/ship.mjs`.
- `constants/{ship-combat,ship-corruption,ship-properties,ship-quality,
  ship-tokens}.mjs`.
- `data/item/{component,ship-hull,cargo,torpedo,small-craft,celestial-body}.
  mjs`.
- `data/actor/star-system.mjs`, `constants/star-system.mjs`,
  `constants/warp-travel.mjs` (варп-переходы). Блок «ВАРП-МАРШРУТЫ» на листе
  системы — привязка мировых предметов типа `warpRoute`, см. §14.
- `apps/{ship-hud,ship-hull,ship-hull-library,systems-overview}.mjs`,
  `sheets/{ship-sheet,hull-picker,star-system-sheet}.mjs`.
- `combat/{ship-attack,ship-node-damage}.mjs` — движок автоматизации боевых
  Свойств узлов и реакции узла на повреждение.
- `migrations/ship-hulls.mjs` — перевод легаси-узлов «корпус» на shipHull.

## 20. Фракции, Отношения, Социум

- `data/item/faction.mjs` (дерево принадлежностей), `rules/factions.mjs`
  (наследование Ненависти по иерархии), `constants/relations.mjs` (ступени
  отношений по социальным Умениям).
- `apps/{faction-cache,faction-roster,actor-factions}.mjs`.
- `sheets/tabs/social.mjs`, `rules/social.mjs` (что считается «социальным»),
  `rules/talent-targets.mjs` (цели Hatred/Peer/Enemy), `apps/target-choice.
  mjs`.

## 21. Календарь, Сессия, Окружение, Сцена, Жизнеобеспечение

- `constants/imperial-calendar.mjs` + `apps/imperial-calendar.mjs` — уже в
  AGENTS.md.
- `apps/game-session.mjs` — уже в AGENTS.md (кнопки «Сцена»/«Сессия»).
- `constants/environment.mjs` + `apps/environment.mjs` (окно+виджет
  Погода/Температура/Гравитация/Радиация), `apps/scene-settings.mjs` (общая
  страница настроек сцены). Тест на Жару/Холод (`rules/temperature-hazard.
  mjs` + `combat/temperature-hazard.mjs`, wdbc-1rno, 12.09.2026) — раньше
  `constants/environment.mjs::tempEffect` (штраф T + частота) был подключён
  ТОЛЬКО к отображению в виджете, ни для кого не катался; теперь кнопка в
  самом виджете реально катает тест (worldTime-кулдаун по частоте книги,
  провал — Усталость+1, тот же приём, что Лучевая болезнь `combat/
  radiation.mjs`). Аналогичный по форме штраф за сильный ветер (`WEATHER`,
  ключ "wind") и урон трения атмосферы на входе с орбиты по-прежнему НЕ
  реализованы вообще — ни числа, ни формулы для них в системе нет.
- `apps/scene-nexus.mjs` + `constants/scene-nexus.mjs` — Нексус Сцен (группы
  сцен, телепортация).
- `constants/vitals.mjs` — Голод/Жажда/Сон, авто-прогресс по `worldTime`.
- `apps/callouts.mjs` — выноски на картинке сцены.

## 22. Требования, Условия, Возможности — инфраструктура конвейера правил

Не отдельная игровая механика, а движок, на котором держится почти всё выше.
Смотреть сюда, когда речь о том, «как записать новое условие/возможность», а
не о конкретном Таланте:
`rules/flags.mjs` (`grantFlag`/`hasRuleFlag` — ядро системы возможностей),
`constants/capabilities.mjs` + `capability-forms.mjs` (реестр имён и форм без
читателя), `item-marker.mjs`, `ability-by-key.mjs`, `item-rules.mjs` (мост
Конструктор→конвейер теста), `predicates.mjs`, `req-atom.mjs`, `mech-when.
mjs`, `mech-formula.mjs` (мини-DSL формул), `effects.mjs` (реестр `kind`),
`source-registry.mjs` + `sources.mjs` + `collect.mjs` (сборка и отбор
источников правил — про цикл импортов см. AGENTS.md), `toggle-abilities.mjs`
(+`apps`), `cooldown.mjs`, `temp-grant.mjs`, `supply-timer.mjs`, `turn-flags.
mjs`. Реестр ключей ActiveEffect — `constants/effect-keys.mjs` (уже в
AGENTS.md).
- `rules/actor-control.mjs` (+`apps/actor-control.mjs`) — общий примитив
  «контроль над чужим актором» (флаг `controlledBy`, длительность
  permanent/round/battle/worldTime, честный контест через синтетический
  `techDef` в `combat/techniques.mjs::_showContestDialog`, GM-relay смена
  владения/`User#character`) — заведён под Volunteer Actor (wdbc-ux8a,
  15.09.2026), переиспользован без изменений для механики Паразита (см. §12).

## 23. Требования Талантов — текстовый разбор

- `constants/talent-requirements.mjs` — разбор строки «Требования» и сверка с
  листом. `constants/talents-library.mjs` — библиотека для наполнения
  компендиума при первом запуске.

## 24. Химия, Болезни

- Химия/наркотики/яды: `data/item/drug.mjs`, `sheets/tabs/drugs.mjs`.
- Болезни: `data/item/disease.mjs`, `constants/diseases.mjs` (справочник
  богов — сами болезни в компендиуме), `sheets/tabs/diseases.mjs`.

## 25. Стремления (Aspirations)

- `constants/aspirations.mjs`, `data/item/aspiration.mjs`, `apps/aspirations.
  mjs`, `sheets/tabs/aspirations.mjs` — три фиксированных слота
  Гордыня/Позор/Мотивация (Black Crusade).

## 26. Подключаемые подсистемы (флаги в Настройках)

`constants/features.mjs` — реестр `FEATURES`, ключ → что гасит выключение.
Уже описан в AGENTS.md как «Активатор источника в Настройках» — таблица
текущих ключей: `battleBook` (Формирования), `aeldariBook` (раса открывается
только с флагом), `homeworlds`, `divinations`, `helmetless`, `armourHistories`
(последние четыре — только добавляют поля/вкладки существующим листам, тип
актора не заводят).

## 27. Синхронизация мира с паками, Книги, Когитаторы

- `apps/content-sync-app.mjs` + `content-sync.mjs` — окно «Обновить мир»,
  диффинг предметов актёров против пака поле-в-поле; `migrations/
  content-sync-baseline.mjs` — бутстрап опоры для трёхстороннего диффа.
- `apps/books.mjs` — Книги системы как компендиумы Journal Entries.
- `apps/cogitator.mjs` — Когитаторы (постоянные терминалы-консоли).
- `apps/compendium-browser.mjs` + `compendium-filters.mjs` — Обозреватель
  компендиумов.

---

## Инфраструктура и UI-оболочка (не механика, но полезно знать, что есть)

Не несёт игровой логики сама по себе — рендер, хелперы, общие пикеры.
Перечислено, чтобы не искать заново, когда вопрос про интерфейс, а не про
правило:

- Листы: `sheets/{context-menu,picker-ui,v2-helpers,structural-sheet,
  item-sheet,item-picker,gear-picker,gear-mod-picker,active-effect-config}.
  mjs`.
- Прочее: `apps/{pack-doc-cache,pack-locks,scene-controls-guard,hud,
  token-variants,stat-log,temp-modifier,faction-cache}.mjs`,
  `rules/{merge-abilities,name-generator,name-generator-helpers}.mjs`,
  `constants/{item-icons,craft-icons,roll-icons,tech-icons,veil-icons,fonts,
  name-lists,name-gen,library-packs,items}.mjs`.
- `module/data/item/infoguard.mjs`, `_legacy-char-bonus.mjs` — не
  TypeDataModel, общие миксины схем (счётчик Инфограждения; миграция пары
  `charBonusStat/charBonusValue`).
