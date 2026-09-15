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

**Состязания/захват/верхом:** `combat/techniques.mjs` (Повалить/Финт/Давление/
Напролом), `combat/grapple.mjs` (Борьба), `combat/mount.mjs` + `rules/mount.
mjs` (верховой бой), `combat/tactical-map.mjs` + `rules/tactical-map.mjs`
(база/дистанция/контакт).

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
  `apps/legacy-weapon.mjs` (блок «Наследие» на листе оружия).
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

## 9. Состояния, Усталость, Страх, Здравомыслие

- `module/constants/conditions.mjs` — единый реестр книжных Состояний.
- `module/rules/condition-duration.mjs` (срок поверх Duration ActiveEffect),
  `condition-guards.mjs` (иммунитет/смягчение от Конструктора),
  `condition-mirrors.mjs` (игровые метки, отображаемые как Состояния),
  `turn-flags.mjs` (флаги «до начала следующего своего Хода»),
  `fatigue-grace.mjs` (порог Усталости).
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
- Техночудеса: `data/item/tech-power.mjs`, `constants/tech.mjs`,
  `tech-imperatives.mjs` + `combat/imperative-bonuses.mjs` + `rules/
  imperative.mjs`, `constants/implant-mechanics.mjs`, `apps/infoguard.mjs`
  (Инфограждение — сопротивление предмета Техночудесам).
- Сила Навигатора: `data/item/navigator-power.mjs`.
- Мистика/Варп: `constants/veil.mjs` (+`veil-icons.mjs`), `apps/veil.mjs`
  (окно ГМа: Завеса/Ритуалы/Навигация/Таро), `apps/veil-overlay.mjs`
  (варп-хоррор при истончённой Завесе).
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
  `constants/warp-travel.mjs` (варп-переходы).
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
