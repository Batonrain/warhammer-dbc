// module/constants/capabilities.mjs
//
// Имена возможностей, которые раздаёт запись Конструктора «Возможность»
// (kind:"capability" → эффект grantFlag) и спрашивает hasRuleFlag().
//
// Реестр нужен ровно по одной причине: имя — это договор между данными и кодом,
// и разойтись они могут молча. Запись с опечаткой в имени не сломается, она
// просто ничего не даст, а искать такое приходится днями (та же беда, что с
// ключами эффектов — см. module/constants/effect-keys.mjs).
//
// `reader` — где имя читают. Пустой означает, что читателя ещё нет: возможность
// объявлена данными и видна на листе, но в расчёт пока не входит. Это честнее,
// чем притворяться, будто она работает, и честнее, чем не заводить её вовсе:
// текст способности уже лежит правильно, останется дописать чтение.

export const CAPABILITIES = {
  // ── Иммунитет к свойствам оружия (wdbc-plsf) ────────────────────────────
  // Восемь свойств из ревизии Мутаций/Даров: Corrosive/Crippling/Flame
  // (Burning)/Toxic/Piercing/Haywire/Shocking/Snare. Ключ — сам ключ свойства
  // из module/constants/weapon-properties.mjs (не название состояния — Flame
  // накладывает "burning", Toxic — "poisoned" и т.д., но иммунитет проверяется
  // по свойству-источнику, не по состоянию: другие пути наложить то же
  // состояние этим иммунитетом не гасятся).
  "weaponPropertyImmunity.flame": {
    label: "Иммунитет к свойству оружия Flame (не загорается)",
    source: "Мутация: Burning Body / Shield of Purity (Общие мутации)",
    reader: "module/combat/weapon-properties.mjs hasWeaponPropertyImmunity() — hooks.mjs _applyWeaponPropEffect (кнопка condition:\"burning\")"
  },
  "weaponPropertyImmunity.corrosive": {
    label: "Иммунитет к свойству оружия Corrosive (не теряет AP брони)",
    source: "Мутация: Shield of Purity (Общие мутации)",
    reader: "module/combat/weapon-properties.mjs hasWeaponPropertyImmunity() — combat/damage.mjs applyDamageToActor (_applyCorrosive)"
  },
  "weaponPropertyImmunity.crippling": {
    label: "Иммунитет к свойству оружия Crippling (не получает рану с шипами)",
    source: "не выдана ни одним предметом пака на 30.08.2026 — заведена про запас",
    reader: "module/combat/weapon-properties.mjs hasWeaponPropertyImmunity() — combat/damage.mjs applyDamageToActor (_applyCrippling)"
  },
  "weaponPropertyImmunity.piercing": {
    label: "Иммунитет к свойству оружия Piercing (снаряд не застревает в ране)",
    source: "не выдана ни одним предметом пака на 30.08.2026 — заведена про запас",
    reader: "module/combat/weapon-properties.mjs hasWeaponPropertyImmunity() — combat/damage.mjs applyDamageToActor (_applyPiercing)"
  },
  "weaponPropertyImmunity.haywire": {
    label: "Иммунитет к свойству оружия Haywire (не подвержен ЭМИ-полю)",
    source: "не выдана ни одним предметом пака на 30.08.2026 — заведена про запас",
    reader: "module/combat/weapon-properties.mjs hasWeaponPropertyImmunity() — combat/damage.mjs applyDamageToActor (_applyHaywire)"
  },
  "weaponPropertyImmunity.toxic": {
    label: "Иммунитет к свойству оружия Toxic (не травится)",
    source: "не выдана ни одним предметом пака на 30.08.2026 — заведена про запас",
    reader: "module/combat/weapon-properties.mjs hasWeaponPropertyImmunity() — hooks.mjs _applyWeaponPropEffect (кнопка condition:\"poisoned\")"
  },
  "weaponPropertyImmunity.shocking": {
    label: "Иммунитет к свойству оружия Shocking (не оглушается)",
    source: "не выдана ни одним предметом пака на 30.08.2026 — заведена про запас (Дар Кхорна Purity of Wrath даёт похожий эффект, но только в Ярости — см. weaponPropertyImmunityInRage.shocking)",
    reader: "module/combat/weapon-properties.mjs hasWeaponPropertyImmunity() — hooks.mjs _applyWeaponPropEffect (кнопка condition:\"stunned\")"
  },
  "weaponPropertyImmunity.snare": {
    label: "Иммунитет к свойству оружия Snare (не обездвиживается)",
    source: "не выдана ни одним предметом пака на 30.08.2026 — заведена про запас (см. weaponPropertyImmunityInRage.snare)",
    reader: "module/combat/weapon-properties.mjs hasWeaponPropertyImmunity() — hooks.mjs _applyWeaponPropEffect (кнопка condition:\"pinned\")"
  },
  // ── Иммунитет к свойствам оружия ТОЛЬКО в Ярости (wdbc-plsf) ────────────
  // Второе пространство имён: hasWeaponPropertyImmunity() принимает его лишь
  // когда system.inRage === true (простой тумблер — стойка/база принцип,
  // tab-combat.hbs). Единственный известный источник на 30.08.2026 — Дар
  // Кхорна Purity of Wrath.
  "weaponPropertyImmunityInRage.crippling": {
    label: "В Ярости: иммунитет к свойству оружия Crippling",
    source: "Дар Кхорн (Purity of Wrath)",
    reader: "module/combat/weapon-properties.mjs hasWeaponPropertyImmunity() — condition system.inRage"
  },
  "weaponPropertyImmunityInRage.piercing": {
    label: "В Ярости: иммунитет к свойству оружия Piercing",
    source: "Дар Кхорн (Purity of Wrath)",
    reader: "module/combat/weapon-properties.mjs hasWeaponPropertyImmunity() — condition system.inRage"
  },
  "weaponPropertyImmunityInRage.haywire": {
    label: "В Ярости: иммунитет к свойству оружия Haywire",
    source: "Дар Кхорн (Purity of Wrath)",
    reader: "module/combat/weapon-properties.mjs hasWeaponPropertyImmunity() — condition system.inRage"
  },
  "weaponPropertyImmunityInRage.shocking": {
    label: "В Ярости: иммунитет к свойству оружия Shocking",
    source: "Дар Кхорн (Purity of Wrath)",
    reader: "module/combat/weapon-properties.mjs hasWeaponPropertyImmunity() — condition system.inRage"
  },
  "weaponPropertyImmunityInRage.snare": {
    label: "В Ярости: иммунитет к свойству оружия Snare",
    source: "Дар Кхорн (Purity of Wrath)",
    reader: "module/combat/weapon-properties.mjs hasWeaponPropertyImmunity() — condition system.inRage"
  },
  // ── Модификации брони против Варп-Оружия (wdbc-sg57) ────────────────────
  "armor.apVsWarpFull": {
    label: "AP брони этой локации целиком (не игнорируется) против Варп-Оружия",
    source: "Модификации брони «Гексаграмматические Печати» / «Руническая Кольчуга»",
    reader: "module/combat/damage.mjs — ветка warpSoak в applyDamageToActor, armorAP = absorption[loc] целиком"
  },
  // ── Крайне миролюбив (wdbc-gzuf) ──────────────────────────────────────────
  "pacifism.requiresAttackToRage": {
    label: "Не может войти в Ярость, пока не атакован в этом бою — иначе тест Воли−20 или отказ",
    source: "Раса: Серый Человек (Oteshii)",
    reader: "module/combat/damage.mjs (флаг «атакован»), warhammer-dbc.mjs (гейт на system.inRage), module/combat/pacifism.mjs (тест/карточки)"
  },
  // ── Всегда «Связанный» по трейту Psyker (wdbc-gzuf) ──────────────────────
  "psyker.alwaysBound": {
    label: "Независимо от обстоятельств всегда считается «Связанным» (system.psyker.class)",
    source: "Раса: Серый Человек (Oteshii)",
    reader: "module/rules/character.mjs — prepareCharacterDerived(), блок system.psyker, пересчитывается каждый цикл"
  },
  // ── Природа психосилы «Древнее Мастерство» у всех рас Аэльдари (wdbc-l07y) ──
  "psyker.ancientMastery": {
    label: "Природа психосилы всегда «Древнее Мастерство» (независимо от system.psyker.class)",
    source: "Расы группы «Аэльдари»: Экзодит/Друкхари/Азуриане/Арлекин/Иннари/Полуэльдар",
    reader: "module/sheets/tabs/psychic.mjs — showManifestDialog(), isEldar/nature"
  },
  // ── Иммунитет к Грозному Воплю у посвящённых Слаанеш (wdbc-l07y) ─────────
  "dreadWail.immune": {
    label: "Иммунитет к звуковой волне Грозного Вопля",
    source: "Покровительство: Слаанеш (system.patronGod)",
    reader: "module/combat/dread-wail.mjs — applyDreadWailWave(), фильтр целей в радиусе"
  },
  // ── Иммунитет к физическим мутациям (wdbc-gzuf) ──────────────────────────
  "mutation.physicalImmune": {
    label: "Не получает физических мутаций (таблица «Общие мутации» недоступна; Дары Богов — доступны)",
    source: "Раса: Серый Человек (Oteshii)",
    reader: "module/sheets/tabs/mutations.mjs rollMutationOrGift()/openMutationPicker(), module/sheets/actor-sheet.mjs onMutgiftAdd() (Shift-путь)"
  },
  // ── «Считает Cor как Безумие» (wdbc-gzuf) ────────────────────────────────
  "corruption.redirectsToMadness": {
    label: "Любое изменение Порчи (рост и снижение) уходит в Безумие вместо Порчи",
    source: "Раса: Серый Человек (Oteshii)",
    reader: "warhammer-dbc.mjs — Hooks.on(\"preUpdateActor\") перехватывает system.corruption.value"
  },
  // ── Избегание Орды как одиночной цели (wdbc-gzuf) ────────────────────────
  "horde.singleTargetImmune": {
    label: "Избегает атак Орды как одиночная цель (без бонусных кубиков урона за Магнитуду), теряется при Размере 2+",
    source: "Раса: Серый Человек (Oteshii)",
    reader: "module/combat/damage.mjs — applyDamageToActor() вычитает magDiceBonus из rawDamage, если sizeTotal < 2"
  },
  // ── Бросок «с Преимуществом» на боевую Инициативу (wdbc-0tzr) ────────────
  // НЕ то же самое, что charRollAdvantage субрасы (module/rules/roll-advantage.mjs) —
  // тот про разовый бросок Мастера создания (Inf), этот про боевой трекер,
  // каждый бой заново.
  "combat.initiativeAdvantage": {
    label: "Инициатива в бою кидается трижды, берётся лучший результат",
    source: "Раса: Серый Человек (Oteshii)",
    reader: "module/documents/combatant.mjs — WarhammerCombatant.getInitiativeRoll() подменяет кубик формулы на kh"
  },
  // ── Роли ──────────────────────────────────────────────────────────────────
  "pilot.dreadnought": {
    label: "Заключён в саркофаг Дредноута",
    source: "Книга Машин, «Дредноуты» (стр. 57-58)",
    reader: "module/rules/sources.mjs — источник «dreadnought»; Требования Талантов Дредноутов"
  },

  // ── Папки пикера Талантов (talentGroupLock, wdbc-sauo) ──────────────────
  // Раньше — прямые сравнения race/legion/имени предмета в самом item-picker.mjs;
  // теперь папку отпирает возможность, а раздают её раса/легион/предмет своими
  // данными. talents.geneSeed была первым таким переводом (этап до wdbc-sauo) —
  // добавлена сюда задним числом вместе с остальными.
  "talents.geneSeed": {
    label: "Доступна папка Талантов «Геносемя»",
    source: "Раса: Астартес (module/rules/library/astartes.mjs, astartes.geneseed)",
    reader: "module/sheets/item-picker.mjs — talentGroupLock"
  },
  "talents.nightLords": {
    label: "Доступна папка Талантов «Повелители Ночи»",
    source: "Астартес с Геносеменем легиона VIII (module/rules/library/astartes.mjs, astartes.nightLords)",
    reader: "module/sheets/item-picker.mjs — talentGroupLock"
  },
  "talents.psyker": {
    label: "Доступны папки Талантов «Псайкер»/«Псайкана»",
    source: "Пси-Рейтинг больше 0, любая раса (module/rules/library/core.mjs, core.psyker)",
    reader: "module/sheets/item-picker.mjs — talentGroupLock"
  },
  "talents.exodite": {
    label: "Доступна папка Талантов Экзодитов",
    source: "Раса: Экзодит (module/rules/library/aeldari.mjs, EXODITE_RULES)",
    reader: "module/sheets/item-picker.mjs — talentGroupLock"
  },
  "talents.drukhari": {
    label: "Доступны папки Талантов «Друкхари»/«Таланты Боли»",
    source: "Раса: Друкхари и её субрасы (module/rules/library/aeldari.mjs, DRUKHARI_RULES)",
    reader: "module/sheets/item-picker.mjs — talentGroupLock"
  },
  "talents.azuriane": {
    label: "Доступна папка Талантов «Азуриани»",
    source: "Раса: Азуриане (module/rules/library/aeldari.mjs, AZURIANE_RULES)",
    reader: "module/sheets/item-picker.mjs — talentGroupLock"
  },
  "talents.harlequin": {
    label: "Доступна папка Талантов Арлекинов",
    source: "Раса: Арлекин (module/rules/library/aeldari.mjs, HARLEQUIN_RULES)",
    reader: "module/sheets/item-picker.mjs — talentGroupLock"
  },
  "talents.ynnari": {
    label: "Доступна папка Талантов «Иннари»",
    source: "Раса: Иннари (module/rules/library/aeldari.mjs, YNNARI_RULES)",
    reader: "module/sheets/item-picker.mjs — talentGroupLock"
  },
  "talents.navigatorGen": {
    label: "Доступна папка Талантов «Ген навигатора»",
    source: "Черта Navigator's Gen / Ген Навигатора (Mechanics самой Черты)",
    reader: "module/sheets/item-picker.mjs — talentGroupLock"
  },
  "talents.skitarii": {
    label: "Доступна папка Талантов «Скитарии»",
    source: "Установленный имплант Skitarii War Plate / Боевые Латы Скитарии (Mechanics импланта)",
    reader: "module/sheets/item-picker.mjs — talentGroupLock"
  },
  "talents.mechanicum": {
    label: "Доступна папка Талантов «Механикум»/«Техномистик»",
    source: "Черта Mechanicum Implants / Импланты Механикум (Mechanics самой Черты)",
    reader: "module/sheets/item-picker.mjs — talentGroupLock"
  },

  // ── Саркофаг Дредноута (Книга Машин, стр. 57) ─────────────────────────────
  // Пункты книги, которые не выражаются числом. Раздаются, пока актор назначен
  // пилотом; читатели — там, где книга их применяет.
  "sarcophagus.autoPassFear": {
    label: "Автоматически проходит тесты Страха, Подавления и Запугивания",
    source: "Саркофаг Дредноута (стр. 57)",
    reader: "module/combat/fear.mjs — _executeFearRoll (тест Страха) + module/combat/suppression.mjs — rollSuppressionTest/rollSuppressionRecovery (тест Подавления) + module/combat/intimidate.mjs — rollIntimidateContest (встречная проверка Запугивания: тест Морали цели). Все три из семи пунктов книги теперь подключены."
  },
  "sarcophagus.immuneBleedingFatigue": {
    label: "Иммунен к Кровотечению и Усталости",
    source: "Саркофаг Дредноута (стр. 57)",
    reader: "module/sheets/tabs/conditions.mjs::addFatigue (полный иммунитет к Усталости из любого источника) + module/combat/condition-ticks.mjs::processConditionTurnEnd (Кровотечение не наносит вреда)"
  },
  "sarcophagus.noPsychicPowers": {
    label: "Не может манифестировать и поддерживать психосилы",
    source: "Саркофаг Дредноута (стр. 57); снимается Матрицей Осирис",
    reader: "module/sheets/tabs/psychic.mjs::showManifestDialog (манифестация) + module/sheets/tabs/psychic.mjs::activatePsychicListeners (чекбокс поддержания) — блок снят, если на Дредноуте стоит module/rules/dreadnought.mjs::hasOsirisMatrix"
  },
  "sarcophagus.helpless": {
    label: "Без конечностей: Беспомощен, когда не подключён к машине",
    source: "Саркофаг Дредноута (стр. 57)",
    reader: "module/rules/character.mjs::sarcophagusHelplessNow (system.sarcophagusHelplessNow) + module/sheets/tabs/dreadnought-panel.mjs (предупреждение на листе) — состояние system.conditions.helpless не форсируется кодом (ни одно состояние в системе так не работает), ГМ накладывает вручную по этому предупреждению; system.sarcophagusInterred — персистентный маркер хирургического заключения, ставится один раз на панели"
  },
  "sarcophagus.noFoodWaterAir": {
    label: "Не нуждается в воде, еде и воздухе",
    source: "Саркофаг Дредноута (стр. 57)",
    reader: "module/rules/character.mjs — вкл vitalMods (Голод/Жажда обнуляются; своей механики «воздуха» в системе нет вовсе, нечего гейтить)"
  },
  "sarcophagus.autoWakeFromStun": {
    label: "Электрошок в конце Хода снимает Оглушение (кроме Галлюцинаций)",
    source: "Саркофаг Дредноута (стр. 57)",
    reader: "module/combat/condition-ticks.mjs::processConditionTurnEnd (снимает Оглушение целиком в конце Хода, кроме вызванного Галлюцинациями)"
  },
  "sarcophagus.autoSenses": {
    label: "Видит только авточувствами саркофага; лишён обоняния и вкуса",
    source: "Саркофаг Дредноута (стр. 57)",
    reader: "нечего гейтить: своей механики бонусов нюха/вкуса в системе нет вовсе (Taster/Дегустатор и Heightened Senses (Обоняние/Вкус) сами — текст без mechanics-хука)"
  },

  // ── Штрафы ────────────────────────────────────────────────────────────────
  "penalty.twoWeapon.off": {
    label: "Снимает штраф за бой несколькими руками",
    source: "Локус Быстроты (DoomBC — Хаос, стр. 29)",
    reader: "module/sheets/attack-dialog.mjs — галочка «Бой несколькими руками»"
  },
  "penalty.calledShot.head.reduce20": {
    label: "Избирательная атака в голову: штраф меньше на 20",
    source: "Локус Подношения (стр. 31)",
    reader: "module/sheets/attack-dialog.mjs — headPenalty в списке целей Избирательной атаки"
  },
  "calledShot.notMental": {
    label: "Избирательные атаки не считаются ментальными",
    source: "Локус Подношения (стр. 31)",
    // Нечего гейтить (сверено wdbc-smc, 31.08.2026): в системе вообще нет
    // правила «Ментальное действие блокируется в Ярости/опьянении», которое
    // эта возможность должна была бы снимать — grep по frenzy.mjs/
    // attack-dialog.mjs пуст. Появится базовое правило — тогда и читатель.
    reader: ""
  },

  // ── Подмена характеристики ────────────────────────────────────────────────
  "charSwap.wp.forWsS": {
    label: "Можно бросать W вместо WS и/или S",
    source: "Локус Мутации (стр. 28, 32)",
    reader: "module/sheets/attack-dialog.mjs — подпись у пункта «W» в выборе характеристики"
  },

  // ── Действия и приёмы ─────────────────────────────────────────────────────
  "autoHit.melee.oncePerRound": {
    label: "Раз в Раунд рукопашная атака попадает автоматически с 1 Успехом (штраф −10 до след. Хода)",
    source: "Локус Неизбежности (стр. 30)",
    reader: "module/sheets/attack-dialog.mjs — showAttackDialog (галочка «Локус Неизбежности»), module/combat/attack.mjs (opts.fixedSuccessDeg), module/rules/sources.mjs (daemonInevitability — штраф −10), module/combat/action-economy.mjs (снятие штрафа). Не подключено к showAttackDialogNoWeapon (безоружная атака без диалога — принудительное применение без выбора игрока для штрафной способности сочли неверным по умолчанию)"
  },
  "action.bonusHalfMove": {
    label: "Бонусное полудействие, только на Движение",
    source: "Локус Стремительности (стр. 29)",
    reader: "module/combat/movement-actions.mjs — declareHalfMove (раз в Раунд, 0 ОД вместо 1)"
  },
  "technique.baseFullAttack": {
    label: "Раз в Раунд любая рукопашная атака считается имеющей базу Полная Атака",
    source: "Локус Сокрушения (стр. 31)",
    reader: "module/sheets/attack-dialog.mjs — meleeBaseKey в showAttackDialog/showAttackDialogNoWeapon; module/apps/game-session.mjs — isRoundCapabilityAvailable/markRoundCapabilityUsed"
  },

  // ── Ауры и особые правила ─────────────────────────────────────────────────
  "aura.touchedByFates": {
    label: "За Очко Бесчестия даёт демонам ниже рангом Трейт Touched by the Fates (1)",
    source: "Локус Фанатизма (стр. 28)",
    reader: "module/rules/daemon-locus.mjs (demonsInHeraldLocus/applyTouchedByFates), module/sheets/actor-sheet.mjs — onCapabilitySpend (кнопка «Потратить» панели ВОЗМОЖНОСТИ СЕЙЧАС)"
  },
  "horror.splitsIntoThree": {
    label: "Ужасы при смерти делятся на 3, а не на 2",
    source: "Локус Трансмогрификации (стр. 32)",
    // Нечего гейтить (сверено wdbc-smc, 31.08.2026): базовой механики «Ужасы
    // при смерти делятся на 2» в коде нет вовсе — grep по horde-sheet.mjs/
    // horde-damage.mjs пуст. Этот Локус меняет параметр несуществующего
    // правила; сперва нужна сама базовая механика деления Орды на смерти.
    reader: ""
  },
  "ignore.lingerTemplates": {
    label: "Игнорирует шаблоны со свойством Linger",
    source: "Локус Упорства (стр. 30)",
    reader: "module/regions/linger-zone.mjs — #onTrigger/_drift (иммунитет к попаданиям и дрейфу зоны)"
  },

  // ── Арсенал: блочные обходы Melee/Weapon Training ───────────────────────
  // «Персонаж считается имеющим все специализации Талантов Melee Training и
  // Weapon Training» — вместо покупки специализации на каждую категорию.
  "weapon.trained.legion": {
    label: "Владеет всем легионным вооружением без штрафов (Melee+Weapon Training)",
    source: "Legion Weapon Training / Тренировка Легиона (стр. 62)",
    reader: "module/rules/weapon-training.mjs — meleeTrainingStatus/weaponTrainingPenalty"
  },
  "weapon.trained.eldar": {
    label: "Владеет всем эльдарским вооружением без штрафов (Melee+Weapon Training)",
    source: "Eldar Weapon Training / Эльдарская Тренировка",
    reader: "module/rules/weapon-training.mjs — meleeTrainingStatus/weaponTrainingPenalty"
  },
  "weapon.trained.drukhari": {
    label: "Владеет всем друкхарийским вооружением без штрафов (Melee+Weapon Training)",
    source: "Kabalite Weapon Training / Тренировка Кабалита",
    reader: "module/rules/weapon-training.mjs — meleeTrainingStatus/weaponTrainingPenalty"
  },
  "weapon.trained.allMelee": {
    label: "Считается имеющим все специализации Melee Training",
    source: "Arms Master / Оружейный Мастер (стр. 62)",
    reader: "module/rules/weapon-training.mjs — meleeTrainingStatus"
  },

  // ── Безоружный бой (стр. 40) ──────────────────────────────────────────────
  "unarmed.warriorProfile": {
    label: "Профили безоружных ударов улучшены: d5 в уроне → d10",
    source: "Unarmed Warrior / Безоружный Воин",
    reader: "module/sheets/attack-dialog.mjs — profileOptions (requiresCapability у альт-профиля Кулака/Пинка/Удара головой)"
  },

  // ── Приёмы Талантов (стр. 14: «Дополнительные [Приёмы] можно найти в
  //    разделе «Таланты»») — MELEE_MANEUVERS.swift/lightning ─────────────────
  "technique.swiftAttack": {
    label: "Доступен Приём «Быстрая Атака»: попадание за каждый нечётный Успех (до WS.b)",
    source: "Swift Attack / Быстрая Атака",
    reader: "module/sheets/attack-dialog.mjs — computeManeuverOptions; module/combat/attack-outcome.mjs — hitCount(isSwift)"
  },
  "technique.lightningAttack": {
    label: "Доступен Приём «Молниеносная Атака»: попадание за каждый Успех (до WS.b)",
    source: "Lightning Attack / Молниеносная Атака",
    reader: "module/sheets/attack-dialog.mjs — computeManeuverOptions; module/combat/attack-outcome.mjs — hitCount(isLightning)"
  },
  "technique.counterAttack": {
    label: "После успешного Парирования может тут же атаковать тем же оружием со штрафом −10 (раз в Раунд)",
    source: "Counter Attack / Контратака",
    reader: "module/combat/defense.mjs — _performParry; module/hooks.mjs — кнопка «Контратака» в карточке чата"
  },

  "weapon.trained.allRanged": {
    label: "Считается имеющим все специализации Weapon Training",
    source: "Оракул Стали (Дар Кхорна, стр. 453-460): «владение всеми видами оружия». " +
            "Настоящую экзотику (weaponType:\"exotic\") не покрывает — она вообще не проверяется системой.",
    reader: "module/rules/weapon-training.mjs — weaponTrainingPenalty"
  },
  // ── Хват дальнобойного (wdbc-3hxg и потомки) ────────────────────────────
  "weapon.doubleGripPistol": {
    label: "Пистолет двумя руками: Прицеливание +15/+30 вместо +10/+20, Короткие/Длинные очереди +5/+10",
    source: "Double Grip / Двойной Хват (стр. 62), BS 35",
    reader: "module/sheets/attack-dialog.mjs — doubleGripActive"
  },
  "weapon.commandoCarbine": {
    label: "Карабины (свойство Carbine) в одной руке считаются пистолетами",
    source: "Commando / Командо (Стрелок), BS 45, S 40",
    reader: "module/sheets/attack-dialog.mjs — commandoGrip"
  },
  "weapon.fanningRevolver": {
    label: "Револьвер в одной руке со свободной второй: Длинная очередь без штрафа −10",
    source: "Fanning / Быстрый Курок (Оружейник), BS 40, A 40",
    reader: "module/sheets/attack-dialog.mjs — fanningActive"
  },
  "mutation.burningHead": {
    label: "Удар головой меняет профиль: 1d10 E, Pen 0, Cheap Shot, Tainted",
    source: "Burning Head / Горящая Голова (Общие мутации, d100 43)",
    reader: "module/sheets/attack-dialog.mjs — profileOptions (requiresCapability у альт-профиля Удара головой)"
  },
  // ── Таланты Азуриани (DoomBC — Аэльдари, стр. 10) — Фаза 2, book-verified
  //    23-24.08.2026. Проверено кодом: Быстрая/Молниеносная Атака, Парирование,
  //    Disarm/Blade Binding и расчёт эффектов оружия живут в РАЗНЫХ файлах
  //    (attack-dialog.mjs / defense.mjs / weapon-properties.mjs) — общего
  //    читателя на "используй X вместо Y" не завести одним универсальным
  //    свопом, несмотря на текстовое сходство формулировок. Ключи ниже честно
  //    задокументированы (видны на листе), читатели дописываются по одному —
  //    см. doombc-mechanics-constructor Фаза 2 в памяти.
  "maneuver.fastLightning.baseCharge": {
    label: "Быстрая/Молниеносная Атака берёт базой Натиск (доп. реакция); после Бега — доп. одиночная атака за реакцию",
    source: "Asuryani Speed / Скорость Асуриан",
    reader: ""
  },
  "dodge.advantage.vsBurst": {
    label: "Преимущество на Уклонение/Парирование против Короткой/Длинной Очереди механизировано (wdbc-u0by) — burst = rofMode semi/full, тот же признак, что уже использует Storm of Lead",
    source: "Dancing Among The Fire / Танец Среди Огня",
    reader: "module/rules/dodge-advantage.mjs (danceOfFireAdvantage), module/combat/defense.mjs (_performDodge/_performParry)"
  },
  "maneuver.grantBrutalCharge.onCharge": {
    label: "Раз в бой после Натиска (до попаданий) можно получить Brutal Charge (+A.b); повторно — за очко судьбы",
    source: "Death Dance / Смертельный Танец",
    reader: "module/combat/death-dance.mjs + кнопка в module/sheets/attack-dialog.mjs (wdbc-sk8s)"
  },
  "skillSwap.acrobatics.forAthletics": {
    label: "Acrobatics вместо Athletics в соревновательных тестах / тестах от получаса",
    source: "Dexterity Technique / Техника Ловкости",
    reader: ""
  },
  "combat.eldarWeapon.gripStanceSwitch": {
    label: "Смена хвата/стойки эльдарским рукопашным оружием между атаками (между попаданиями при A 55 и Bl 2)",
    source: "Dexterous Fighter / Ловкий Боец",
    reader: ""
  },
  "charSwap.ag.forStr.weaponEffects": {
    label: "A.b вместо S.b во всех эффектах оружия, требующих S.b (включая метание)",
    source: "Eldanesh Technique / Техника Эльданеша",
    reader: ""
  },
  "actionPoint.bonusPerTurn.stacking3": {
    label: "+1 ОД за взятие (до 3, стакается копиями предмета) — смоделировано ActiveEffect на system.actionPoints.max. «На 3-м взятии — доп. действие с типом Атака за раунд»: в системе нет счётчика «атак за Ход» вовсе (проверено, wdbc-niv7) — доп. ОД от 3 копий уже практически позволяет лишнюю атаку через обычный расход ОД, отдельного примитива «доп. атака вне лимита» заводить не на чем.",
    source: "Eldar Agility / Эльдарская Ловкость",
    reader: "packs-src/talents/Азуриани/Eldar_Agility..., ActiveEffect system.actionPoints.max"
  },
  "stealth.advantage.plusSuccesses": {
    label: "Преимущество на Stealth механизировано (wdbc-u0by, kind:\"reroll\"/keepBest). +½A.b успехов на соревновательные тесты со Stealth — не механизировано: числовой бонус к Успехам не выражается существующими видами записи Конструктора",
    source: "Fast And Swift / Быстрый И Проворный",
    reader: "module/rules/item-rules.mjs (kind:\"reroll\" → rollMode-правило общего реестра)"
  },
  "skillSwap.acrobatics.forWsS.disarmBladeBinding": {
    label: "Acrobatics(A)+0 вместо WS/S в тестах Disarm/Blade Binding",
    source: "Nimble Blade / Ловкий Клинок",
    reader: ""
  },
  "weapon.canUse.witchsEdge": {
    label: "Может использовать оружие со свойством Witch's Edge",
    source: "Secrets of the Seer / Секреты Видящих",
    reader: ""
  },
  "movement.outOfCombatSpdBonus": {
    label: "+2 SPD вне боя; в бою — бонус к движению по итогам прошлого раунда (см. текст таланта)",
    source: "Speed of the Faolchú / Скорость Сокола",
    reader: ""
  },
  "combat.parryCounterDisarm.acrobaticsSwap": {
    label: "Acrobatics(A) вместо Parry(WS)/WS; после Парирования+Контратаки — цепочка тестов на разоружение",
    source: "Ultanesh Technique / Техника Ультанеша",
    reader: ""
  },
  // Именованный флаг «нельзя обезоружить» (wdbc-egll) — общий для любого
  // источника с таким текстом. Актёрский уровень (не «этот конкретный
  // предмет в этой конкретной руке») — тот же компромисс детализации, что и у
  // остальных Возможностей без per-limb модели в системе. У Tentacle/Extra
  // Arm — безопасно грантить безусловно (постоянный эффект руки с этой
  // субмутацией, ничего не включает и не выключает). У gift.khorne.
  // livingWeapon иммунитет условный («до конца боя/сцены» после активации) —
  // подключён ЧЕРЕЗ activatable/active (module/data/item/mutation.mjs,
  // wdbc-egll: тот же тумблер, что у armorMod/armor в isItemActive(),
  // module/apps/effects.mjs), не безусловным грантом: весь предмет (в т.ч.
  // capabilityKey gift.khorne.livingWeapon самой Способности) гейтится
  // system.active, включает кнопка на листе (МУТАЦИИ И ДАРЫ БОГОВ,
  // mutgiftToggleActive). Полудействие+1 Бесчестия на активацию и авто-
  // выключение по концу боя/сцены — на столе, вручную (тот же уровень
  // автоматизации, что у Стойки/Базы).
  "combat.cannotBeDisarmed": {
    label: "Приём Обезоружить проходит с предупреждением у цели, но не снимает оружие — актёрский уровень, не привязано к конкретному предмету/руке",
    source: "Мутация: Tentacle, субмутация 4-5 «С Присосками» (Общие мутации); субмутация 7 «Опутанная Корнями» (Extra Arm); gift.khorne.livingWeapon, пока активирован — все три подключены (wdbc-egll)",
    reader: "module/constants/combat.mjs MELEE_CONTESTS.disarm (targetImmunityFlag) — module/combat/techniques.mjs::_showContestDialog"
  },
  "reroll.pathTest.sceneOnce": {
    label: "Раз за сцену/битву переброс теста своего Пути; повторный провал считается успехом с 1 успехом",
    source: "Understanding the Path / Понимание Пути",
    reader: ""
  },
  "damage.sneakAttack.plusPerBonus": {
    label: "+P.b к Dmg по застигнутой врасплох цели, пока она Оглушена (выбранная специализация атак)",
    source: "Unexpected Strike / Неожиданный Удар",
    reader: ""
  },

  // ── Таланты Друкхари / Боли (DoomBC — Аэльдари: Ответвления, стр. 8-9) —
  //    Фаза 2, book-verified 23-24.08.2026. Почти все — активные/условные
  //    реактивные способности (трать Боль/Реакцию → эффект), а не разовый
  //    бонус на взятие; Конструктор такое не применяет при получении, только
  //    документирует. Часть завязана на W.b/P.b (динамическая формула) —
  //    poolMax берёт только фиксированное число, не формулу.
  "pain.spend.vsPsychicOpposed": {
    label: "Во встречном тесте против нематериальной психосилы можно тратить Боль на +5 за пункт (даже проиграв тест)",
    source: "A Lost Ray of Light / Потерянный Луч Света", reader: ""
  },
  "weapon.provenVsHelpless.primitiveNatural": {
    label: "Атаки примитивным/безоружным/естественным оружием получают Proven (3) против паникующих/сбитых/без сознания целей",
    source: "Cruelty / Жестокость", reader: ""
  },
  "poison.noCalledShotRequired.handmade": {
    label: "Яды, изготовленные вручную для Отравителя, не требуют Избирательных попаданий; ими могут пользоваться и другие",
    source: "Disciple Of Shaimesh / Учение Шаимеш", reader: ""
  },
  "pain.freeGain.onceBattle.reactionEffect": {
    label: "Раз в бой получает 1 Боль без траты Реакции, получив выбранный эффект от противника (кроме Наркотика)",
    source: "Enjoyment / Наслаждение", reader: "module/combat/enjoyment.mjs (wdbc-sk8s)"
  },
  "maneuver.unlimitedFastLightning.hekatriiStance": {
    label: "В Стойке Гекатрии — неограниченные Быстрые/Молниеносные Атаки (ценой Реакции/Финта); доп. руки дерутся с −20 за руку",
    source: "Hekatrii Technique / Техника Гекатрии", reader: ""
  },
  "damage.escalateCondition.calledShotRepeat": {
    label: "Повторная Избирательная Атака, накладывающая уже имеющееся у цели Отравление/Кровотечение/Crippling/Piercing, усиливает состояние на +1 (не чаще раза в Раунд)",
    source: "Pain After Pain / Боль За Болью", reader: ""
  },
  "pain.transfer.allyReaction": {
    label: "Может передать 1 Боль союзному Друкхари (оба тратят Реакцию, в пределах общей дальности усвоения Боли)",
    source: "Share The Pain / Разделяя Боль", reader: ""
  },
  "pain.selfHarmForPain.combatStart": {
    label: "В начале боя может нанести себе до 3 непоглощаемого урона Свободным Действием и получить столько же Боли (в друкхарийской броне)",
    source: "Siphon Pain / Сифон Боли", reader: ""
  },
  "condition.denyLeapUp.afterStunProne": {
    label: "Цель успешного Оглушения при сбивании с ног не может использовать Leap Up; подъём без него стоит +1 действие",
    source: "That's Not All / Ещё Не Всё", reader: ""
  },
  "pain.absorbRange.perceptionScaling": {
    label: "Дальность поглощения Боли растёт на P.b м за каждое взятие (до 3 раз, по ступеням Psyniscience)",
    source: "Agony From Afar / Агония Издалека", reader: ""
  },
  "pain.maxBonus.willpowerScaling": {
    label: "Максимум Боли увеличен на W.b (можно брать до 3 раз) — формула, не фиксированное число, poolMax не годится",
    source: "Bottomless Soul / Бездонная Душа", reader: ""
  },
  "pain.bypassResistance.meleeKill": {
    label: "В ближнем бою получает Боль даже с целей, устойчивых к её поглощению (Сслиты, Астартес, Орки, Скитарии...), без сравнения характеристик",
    source: "Copious Slaughter / Обильная Резня", reader: ""
  },
  "action.bonusReaction.painTalentsOnly": {
    label: "Получает доп. Реакцию, тратимую только на таланты, связанные с Болью",
    source: "Cruel Desire / Жестокое Желание", reader: ""
  },
  "pain.bonusOnKill.fearedTarget": {
    label: "Убийство цели в состоянии Страха/Шока/Ужаса даёт ещё 1 Боль",
    source: "Deep Fear / Глубокий Страх", reader: ""
  },
  "pain.absorbViaHalfAction": {
    label: "Может поглощать Боль не только Реакцией, но и Полудействием",
    source: "Sadistic Pleasure / Садистическое Наслаждение", reader: ""
  },
  "ritual.groupPainHeal.tortureBeneficiary": {
    label: "Успешная 5-минутная пытка Беспомощного даёт всем причастным друкхари 2 Боли + 1d5 лечения всех Характеристик (+бонусы за доп. успехи, до W.b раз в сутки)",
    source: "Skillful Torture / Искусная Пытка", reader: "module/apps/skillful-torture.mjs (wdbc-sk8s)"
  },

  // ── Трейты Тиранид/Некрон, заведённые в Фазе 1 (23-24.08.2026) — бестиарий
  //    ещё не реализован, читатель появится вместе с ним.
  "immunity.tyranid.fearPsychicWarpTempDiseasePoison": {
    label: "Иммунитет к Подавлению, психосилам/Варп-эффектам на разум, холоду, жаре, болезням и ядам",
    source: "Tyranid / Тиранид", reader: ""
  },
  "aura.synapticFearless.ignoreInstinct": {
    label: "Тираниды в радиусе получают Fearless и игнорируют Инстинктивное Поведение",
    source: "Synaptic Creature / Синаптическое Существо", reader: ""
  },
  "aura.psychicPenalty.shadowInWarp": {
    label: "Псайкеры (не тираниды) в радиусе получают штраф на психотесты",
    source: "Shadow In The Warp / Тень В Варпе", reader: ""
  },
  "behavior.instinctive.noSynapse": {
    label: "Вне синаптической связи следует одному из инстинктов профиля: Прятаться/Кормёжка/Преследование",
    source: "Instinctive Behaviour / Инстинктивное Поведение", reader: ""
  },
  "resurrection.necron.reanimationProtocols": {
    label: "После смерти может пройти тест Regeneration(10) на восстание; при провале — шанс Phase Evacuation",
    source: "Reanimation Protocols / Реанимационные Протоколы", reader: ""
  },
  "resurrection.necron.phaseEvacuation": {
    label: "Не восставший через Reanimation Protocols с 99% шансом телепортируется в гробницу, иначе аннигилируется",
    source: "Phase Evacuation / Фазовая Эвакуация", reader: ""
  },
  "fury.necron.destroyerCult.bsInsteadOfPenalty": {
    label: "Вход в Ярость — свободное действие; Ярость даёт +10 BS вместо −20",
    source: "Destroyer Cult / Культ Уничтожения", reader: ""
  },
  "aura.heroicPresence.vehicleMorale": {
    label: "Даёт войскам Храбрость/Сплочение/Прикрытие на 3 успеха; влияет на расчёт командования и Героический Конец",
    source: "Heroic Presence / Героическое Присутствие", reader: ""
  },

  // ── Элитные Архетипы, заведённые в Фазе 1 — Сигиллиты (руны) и Шаман
  //    Зверолюдей (ритуалы Боли/Богов). Обе — полностью новые подсистемы,
  //    реализация масштаба отдельной сессии, не капалка.
  "psychicPath.sigillites.runeMagic": {
    label: "Уникальный Путь Силы «Руны Сигиллитов» — своя экономика рун вместо обычных Психофокусов",
    source: "Sigillite Magic / Магия Сигиллитов", reader: ""
  },
  "rune.sigillites.improvised": {
    label: "Может создавать любые руны ценой R Dmg в руку + урона S/A/W",
    source: "Improvised Rune / Импровизированная Руна", reader: ""
  },
  "rune.sigillites.prepared": {
    label: "Одна выбранная руна дешевле на I.b в начале боя",
    source: "Prepared Rune / Заготовленная Руна", reader: ""
  },
  "rune.sigillites.prometheusFire": {
    label: "Может создавать руны Божественных психосил/Либрариума, игнорируя их уникальные требования",
    source: "Prometheus Fire / Прометеев Огонь", reader: ""
  },
  "rune.sigillites.library": {
    label: "Лимит рун +I.b + бонус от Forbidden Lore (Archeotech), до 3 взятий",
    source: "Rune Library / Библиотека Рун", reader: ""
  },
  "rune.sigillites.calculator": {
    label: "Первый ход в бою даёт +I.b рун, до 3 взятий",
    source: "Rune Calculator / Вычислитель Рун", reader: ""
  },
  "rune.sigillites.strike": {
    label: "Манифестация психосилы может тратить 4 руны за +1 эPR, повторно",
    source: "Rune Strike / Рунный Удар", reader: ""
  },

  // ── Шаман Зверолюдей (wdbc-xxb7, DoomBC — Психокеры-Жабы, стр. 102-104) —
  //    книжный принцип: «Таланты Шамана Зверолюда чутка изменяются при
  //    наличии Метки одного из богов» (Кхорн/Нургл/Слаанеш/Тзинч),
  //    5 из 6 Талантов. Метка/простое Покровительство не различаются —
  //    гейт when.patronGod (module/rules/mech-when.mjs, entryWhenOk) читает
  //    ЕДИНОЕ actor.system.patronGod, ту же Покровительство, которым уже
  //    пользуется вся система (constants/patronage.mjs) — отдельного поля
  //    «Метка» на акторе нет, книжный порог Inf 70+ для «просто
  //    Покровительства» тоже не смоделирован. Каждый Талант несёт в
  //    Конструкторе одну kind:"capability" запись БЕЗ гейта (базовый эффект)
  //    и по одной с when.patronGod на god-ответвление — так лист актора
  //    показывает только реально доступную сейчас ветку, а не все четыре
  //    сразу. Само срабатывание (кнопка/бросок/наложение состояния на цель)
  //    не автоматизировано — общий паттерн проекта для триггерных
  //    способностей вне статичных видов Конструктора, см. capability-стабы
  //    «Мёртвое Могущество» Иннари выше в этом файле.
  "aura.beastmanShaman.primalHowl.base": {
    label: "Полное Действие раз в бой: союзники-зверолюди/мутанты в радиусе Cor.b×10 м получают +10 S/+10 T до начала следующего Хода персонажа, враги считают персонажа источником Fear (+1)",
    source: "Primal Howl / Первобытный Вой", reader: "module/combat/beastman-shaman.mjs — applyPrimalHowl(): раз/бой, радиус Cor.b×10 м. РЕАЛЬНО: временный ActiveEffect Fear(+1) на шамана и +10 S/+10 T каждому союзнику (system.characteristics.*.totalFx, снимается по границе Хода шамана, clearBeastmanShamanTempEffects). НЕ смоделировано: сам факт «враг считает персонажа источником Fear» как условие для его собственных тестов."
  },
  "aura.beastmanShaman.primalHowl.khorneVariant": {
    label: "Кхорн: бонус к T заменяется на +10 WS, рукопашный урон союзников +4, союзники без Frenzy входят в Ярость (с Frenzy — за Свободное Действие)",
    source: "Primal Howl / Первобытный Вой", reader: "module/combat/beastman-shaman.mjs — applyPrimalHowl(): РЕАЛЬНО — временный ActiveEffect +10 S/+10 WS (замена T→WS) каждому союзнику, союзники без Frenzy входят в Ярость (system.inRage). +4 Dmg рукопашным атакам — нет безопасного ключа эффекта для урона, не смоделировано."
  },
  "aura.beastmanShaman.primalHowl.nurgleVariant": {
    label: "Нургл: вместо бонуса к S — +1d10 аблативных ран, переброс проваленных тестов сопротивления движению",
    source: "Primal Howl / Первобытный Вой", reader: "module/combat/beastman-shaman.mjs — applyPrimalHowl(): РЕАЛЬНО — временный ActiveEffect +10 T (замена S→T) + реальные +1d10 Аблативных Ран (system.wounds.ablative/ablativeMax) каждому союзнику. Переброс тестов сопротивления движению — не смоделирован."
  },
  "aura.beastmanShaman.primalHowl.slaaneshVariant": {
    label: "Слаанеш: вместо обычных бонусов — +10 A до конца следующего Хода и снятие 1 Усталости; враги, провалившие тест на Страх, получают 1 Усталость",
    source: "Primal Howl / Первобытный Вой", reader: "module/combat/beastman-shaman.mjs — applyPrimalHowl(): РЕАЛЬНО — временный ActiveEffect +10 A (вместо S/T) + реальное −1 Усталость (system.fatigue.value) каждому союзнику. Усталость проваливших Страх врагов — не смоделирована (тест на Страх не запускается)."
  },
  "aura.beastmanShaman.primalHowl.tzeentchVariant": {
    label: "Тзинч: вместо обычных бонусов — +10 P союзникам; враги получают неизбегаемое попадание Hallucinogenic(1); варп-феномены до конца следующего хода получают +20",
    source: "Primal Howl / Первобытный Вой", reader: "module/combat/beastman-shaman.mjs — applyPrimalHowl(): РЕАЛЬНО — временный ActiveEffect +10 P (вместо S/T) каждому союзнику; Hallucinogenic(1) врагам — кнопка, переиспользующая настоящий движок Особых Свойств Оружия (combat/weapon-properties.mjs::buildTargetEffectButtons), тест и наложение состояния идут по нему, не по копии. +20 к варп-феноменам — не смоделировано."
  },
  "mark.beastmanShaman.hexMarkedPrey.base": {
    label: "Полудействие, Соревновательный тест W+0 vs W+10: цель получает Метку Проклятого до конца боя, союзники-зверолюди получают +15 на атаки против неё",
    source: "Hex-Marked Prey / Проклятая Метка", reader: "module/combat/beastman-shaman.mjs — applyHexMarkedPrey() (тест/флаг метки на цели) + rules/library/beastman-shaman.mjs::BEASTMAN_SHAMAN_RULES (правило \"beastmanShaman.hexMarkedPrey.allyBonus\", предикат rules/predicates.mjs::hexMarkedPreyAllyBonus) — РЕАЛЬНО: +15 к тесту Атаки любого зверолюда-союзника (effectiveRace(actor.system)===\"beastman\") по помеченной цели, тот же общий реестр правил, что Avatar of Slaughter. Проверять disposition/конкретную \"союзность\" не может — predicates.mjs не видит canvas, гейтит по расе."
  },
  "mark.beastmanShaman.hexMarkedPrey.khorneVariant": {
    label: "Кхорн: атаки союзников по цели получают Proven(3); крит с R-уроном дополнительно вызывает кровотечение",
    source: "Hex-Marked Prey / Проклятая Метка", reader: "module/rules/library/beastman-shaman.mjs::BEASTMAN_SHAMAN_RULES (правило \"beastmanShaman.hexMarkedPrey.khorneProven\", grantWeaponProp, wdbc-w8z4) — РЕАЛЬНО: Proven(3) сам доливается в Особые Свойства атак союзников-зверолюдей по цели. Доп. кровотечение на крите с R-уроном — не смоделировано."
  },
  "mark.beastmanShaman.hexMarkedPrey.nurgleVariant": {
    label: "Нургл: атаки союзников по цели получают Toxic(1); выживший при непоглощённом уроне провал T+10 в конце боя = Гниль Нургла",
    source: "Hex-Marked Prey / Проклятая Метка", reader: "module/rules/library/beastman-shaman.mjs::BEASTMAN_SHAMAN_RULES (правило \"beastmanShaman.hexMarkedPrey.nurgleToxic\", grantWeaponProp, wdbc-w8z4) — РЕАЛЬНО: Toxic(1) сам доливается в Особые Свойства атак союзников-зверолюдей по цели. Тест на Гниль Нургла в конце боя — не смоделирован."
  },
  "mark.beastmanShaman.hexMarkedPrey.slaaneshVariant": {
    label: "Слаанеш: цель не может добровольно удаляться от шамана дальше 20 м, штраф −10 Dodge/Parry против его атак; урон шамана цели восстанавливает ему 1d3 Раны",
    source: "Hex-Marked Prey / Проклятая Метка", reader: "module/combat/beastman-shaman.mjs — applyHexMarkedPrey(): текст в карточке; штраф Dodge/Parry и лечение шамана уроном по цели — не смоделированы."
  },
  "mark.beastmanShaman.hexMarkedPrey.tzeentchVariant": {
    label: "Тзинч: выбранная характеристика цели (S/T/A/I/W) −10 на время метки; провал цели по ней даёт шаману +5 к следующей манифестации психосилы",
    source: "Hex-Marked Prey / Проклятая Метка", reader: "module/combat/beastman-shaman.mjs — applyHexMarkedPrey(): текст в карточке; штраф −10 к характеристике цели и бонус к манифестации — не смоделированы."
  },
  "selfSacrifice.beastmanShaman.riteOfSelfSacrifice.base": {
    label: "Полудействие: 1d5+1 непоглощаемого R Dmg себе в руку → +2 эPR до конца следующего Хода, ближний бой получает Tainted на тот же срок",
    source: "Rite of Self-Sacrifice / Ритуал Самопожертвования", reader: "module/combat/beastman-shaman.mjs — applyRiteOfSelfSacrifice(): реально наносит 1d5+1 непоглощаемого урона (rules/wounds.mjs::applyWoundLoss). +2 эPR/Tainted до конца следующего Хода — не смоделированы."
  },
  "selfSacrifice.beastmanShaman.riteOfSelfSacrifice.khorneVariant": {
    label: "Кхорн: вместо эPR — бонус к Dmg = непоглощённый урон ×2; урон можно взять максимальным (6) без броска",
    source: "Rite of Self-Sacrifice / Ритуал Самопожертвования", reader: "module/combat/beastman-shaman.mjs — applyRiteOfSelfSacrifice(): самоурон применяется по-прежнему; бонус к Dmg=урон×2 — только текст в карточке."
  },
  "selfSacrifice.beastmanShaman.riteOfSelfSacrifice.nurgleVariant": {
    label: "Нургл: эPR-бонус −1, но в начале следующего хода восстанавливает бPR Ран и центрирует на себе 1d10+T.b C(Tx), Pen 0, Blast(T.b), Toxic(1)",
    source: "Rite of Self-Sacrifice / Ритуал Самопожертвования", reader: "module/combat/beastman-shaman.mjs — applyRiteOfSelfSacrifice(): самоурон применяется; регенерация бPR Ран и шаблон Toxic — не смоделированы, текст в карточке."
  },
  "selfSacrifice.beastmanShaman.riteOfSelfSacrifice.slaaneshVariant": {
    label: "Слаанеш: эPR-бонус −1, но +10 A, +2 Реакции и атака за Реакцию (штраф −15, вне лимита, только утончённым оружием/Bl 2)",
    source: "Rite of Self-Sacrifice / Ритуал Самопожертвования", reader: "module/combat/beastman-shaman.mjs — applyRiteOfSelfSacrifice(): самоурон применяется; +10 A/+2 Реакции/атака за Реакцию — не смоделированы."
  },
  "selfSacrifice.beastmanShaman.riteOfSelfSacrifice.tzeentchVariant": {
    label: "Тзинч: дополнительно +20 к манифестации следующей психосилы; во время ритуала — ускорение и +20 к самому ритуалу",
    source: "Rite of Self-Sacrifice / Ритуал Самопожертвования", reader: "module/combat/beastman-shaman.mjs — applyRiteOfSelfSacrifice(): самоурон применяется; бонус к манифестации психосилы — не смоделирован."
  },
  "aura.beastmanShaman.warpTaintedAura.base": {
    label: "Полудействие раз в час: аура 20 м до начала следующего Хода — не-еретики проваливший W−10 получают 1 Cor, союзники в ауре +20 к Сопротивлению (пока нет метки)",
    source: "Warp-Tainted Aura / Аура Скверны", reader: "module/combat/beastman-shaman.mjs — applyWarpTaintedAura(): раз/час (worldTime), радиус 20 м, реальный тест W−10 каждому врагу, провал → +1 Порча (system.corruption.value). +20 Сопротивления союзникам — реален (kind:testMod +20 на временной Черте, живьём подтверждено wdbc-5smq): галочка в диалоге теста Стойкости, снимается на начале следующего Хода шамана."
  },
  "aura.beastmanShaman.warpTaintedAura.khorneVariant": {
    label: "Кхорн: провалившие тест враги немедленно проходят тест на Fear(4)",
    source: "Warp-Tainted Aura / Аура Скверны", reader: "module/combat/beastman-shaman.mjs — applyWarpTaintedAura(): тест/Порча применяются как в базовом эффекте; Fear(4) провалившим — только текст в карточке."
  },
  "aura.beastmanShaman.warpTaintedAura.nurgleVariant": {
    label: "Нургл: провалившие враги Задыхаются (−30 на Удушение) в ауре; герметичная броня — попадание Corrosive(Cor.b)",
    source: "Warp-Tainted Aura / Аура Скверны", reader: "module/combat/beastman-shaman.mjs — applyWarpTaintedAura(): тест/Порча применяются; провалившие РЕАЛЬНО получают Состояние «Удушье» (system.conditions.suffocating, тот же CONDITIONS_DEF/токен-статус, что обычное книжное Удушье). Corrosive от герметичной брони — не смоделирован (нужен контекст реального попадания/брони)."
  },
  "aura.beastmanShaman.warpTaintedAura.slaaneshVariant": {
    label: "Слаанеш: провалившие враги очарованы — не атакуют шамана/стадо на Провалы Раунда, пока не атакованы первыми",
    source: "Warp-Tainted Aura / Аура Скверны", reader: "module/combat/beastman-shaman.mjs — applyWarpTaintedAura(): тест/Порча применяются; очарование врагов — не смоделировано."
  },
  "aura.beastmanShaman.warpTaintedAura.tzeentchVariant": {
    label: "Тзинч: провалившие враги смещаются на PR метров по горизонтали; внутри препятствия — 1d5 непоглощаемого X урона в торс и выталкивание",
    source: "Warp-Tainted Aura / Аура Скверны", reader: "module/combat/beastman-shaman.mjs — applyWarpTaintedAura(): тест/Порча применяются; смещение целей на PR метров — не смоделировано (нет геометрии в этой функции)."
  },
  "rune.beastmanShaman.boneRuneEtching.base": {
    label: "Создаёт руну (1 час, тест Schol.Lore(Occult)−20 + Trade−20, 1 Очко Бесчестия) с одной известной психосилой; в бою — Свободное Действие/Реакция, манифестация с Успехами = бPR на момент создания; лимит Cor.b рун",
    source: "Bone-Rune Etching / Костяная Рунопись", reader: ""
  },
  "rune.beastmanShaman.boneRuneEtching.khorneVariant": {
    label: "Кхорн: вместо психосилы — нуль-поле радиусом Cor.b×3 м на Cor.b раундов, не вредящее персонажу",
    source: "Bone-Rune Etching / Костяная Рунопись", reader: ""
  },
  "rune.beastmanShaman.boneRuneEtching.nurgleVariant": {
    label: "Нургл: психосила получает Toxic(2); шаблон/аура даёт Toxic(1) всем в нём; союзник от руны получает +PR аблативных ран",
    source: "Bone-Rune Etching / Костяная Рунопись", reader: ""
  },
  "rune.beastmanShaman.boneRuneEtching.slaaneshVariant": {
    label: "Слаанеш: после использования руну можно немедленно восстановить за Очко Бесчестия",
    source: "Bone-Rune Etching / Костяная Рунопись", reader: ""
  },
  "rune.beastmanShaman.boneRuneEtching.tzeentchVariant": {
    label: "Тзинч: при успешном создании — бросок на феномен (бонус PR×3, PR×2 на прорыв), запирается в руне и высвобождается на дистанции PR+W.b+Cor.b м",
    source: "Bone-Rune Etching / Костяная Рунопись", reader: ""
  },
  "ritual.beastmanShaman.summonHerdSpirits.grantsRitual": {
    label: "Открывает доступ к Ритуалу «Summon Herd Spirits / Призыв Духов Стада» (warhammer-dbc.rituals)",
    source: "Summon Herd Spirits / Призыв Духов Стада", reader: ""
  },
  "trigger.beastmanShaman.ritualBloodletting.onKillBuff": {
    label: "Убив живое существо с душой — Свободное Действие: персонаж и союзники-зверолюди в радиусе F м получают +5 ко всем тестам и иммунитет к Страху/Подавлению до начала следующего Хода (×2, если жертва была особо важной; не складывается)",
    source: "Ritual Bloodletting / Ритуал Кровопускания", reader: "module/combat/beastman-shaman.mjs — applyRitualBloodletting(): реальный радиус F.b и список союзников в чат, бонус (5/10 за важную жертву) — информационный флаг актора, не интегрирован в производные тесты (тот же уровень, что «Мёртвое Могущество» Иннари выше)."
  },
  "psyfocus.beastmanShaman.symbolOfPower.hornFocusAndPainBoost": {
    label: "Рог как Good.Q пси-фокус (10 мин на изготовление) + врождённый Comm.Q пси-фокус; при манифестации может добровольно получить 1d5+2 R Dmg Pen∞ за +2 эPR, тогда манифестация всегда вызывает варп-феномен +10; Natural Weapons → Deadly Natural Weapons + отдельный трейт рогов Deadly Natural Weapons (бPR, Рога) со свойством Tainted, пока есть покровительство",
    source: "Symbol of Power / Символ Власти", reader: "module/combat/beastman-shaman.mjs — applySymbolOfPowerGrant(): РЕАЛЬНО заменяет Natural Weapons на Deadly Natural Weapons и добавляет отдельный трейт рогов Deadly Natural Weapons (рейтинг = бPR персонажа на момент получения, не отслеживает рост ПР дальше). НЕ смоделировано: психо-фокус из рога/врождённый Comm.Q фокус, добровольная боль за +2 эPR, авто-феномен +10, свойство Tainted на рога, покровительство-условная проверка."
  },
  "skill.beastmanShaman.symbolOfPower.aversionAndCyberneticsExemption": {
    label: "Навыки Lore/Trade не считаются враждебными от Aversion to Order (обычные правила цены), нет штрафов от кибернетики/имплантов",
    source: "Symbol of Power / Символ Власти", reader: ""
  },
  "trait.beastmanShaman.symbolOfPower.loseStepchildrenOfTheGods": {
    label: "Персонаж лишается трейта Stepchildren of the Gods",
    source: "Symbol of Power / Символ Власти", reader: "module/combat/beastman-shaman.mjs — applySymbolOfPowerGrant() (Hooks.on(\"createItem\") в warhammer-dbc.mjs): РЕАЛЬНО снимает Stepchildren of the Gods при получении Symbol of Power, тот же безопасный приём удаления по имени, что race-def removesTraits (apps/races.mjs)."
  },

  // ── Таланты Певцов Кости (DoomBC — Аэльдари, стр. 11) — Фаза 2,
  //    book-verified 23.08.2026. Все — активные F.b-раз-за-сессию Полные
  //    Действия на психокостяную технику, не разовый бонус на взятие.
  "wraithbone.songOfRepair.techniqueOrArea": {
    label: "Костяная Песнь: восстанавливает структуру/AP техники (1 цель или область), до F.b раз за сессию",
    source: "Bone Song / Костяная Песня",
    reader: "module/combat/bone-song.mjs (wdbc-sk8s) — applyBoneSongSingle/applyBoneSongArea; кнопка в sheets/tabs/combat.mjs, диалог apps/wraithbone-song-dialog.mjs. AP техники не отслеживается движком — не смоделировано."
  },
  "wraithbone.conjure.itemOrWeapon": {
    label: "Создаёт психокостяной предмет/оружие (без Reinforced), до F.b раз за сессию",
    source: "Conjure Wraith / Вызвать Психокость",
    reader: "module/combat/conjure-wraith.mjs (wdbc-sk8s) — applyConjureWraith; кнопки в sheets/tabs/combat.mjs, пикер openCompendiumBrowser (gear/tools, maxAvailability −1, ИЛИ папка «Психокостяное» весь пул weapons без фильтра). «R» = Редкость/Доступность (подтверждено пользователем) — «до R−1» читается фиксированным порогом −1. «Обычное» оружие (не именное) — книжный эпитет, не автоматизируемый фильтр, тот же честный компромисс, что LOS у Resplendent Raiment."
  },
  "wraithbone.songOfShield.techniqueOrArea": {
    label: "Песнь Защиты: неперегружаемый щит-дефлектор технике (1 цель или область), до F.b раз за сессию",
    source: "Preservation / Защита",
    reader: "module/combat/preservation.mjs (wdbc-sk8s) — applyPreservationSingle/applyPreservationArea, встроенный Item type:forcefield; кнопка в sheets/tabs/combat.mjs. «Складывается с другими щитами» не смоделировано — движок берёт только сильнейший активный щит."
  },
  "wraithbone.songOfReformation.restoreOrDestroy": {
    label: "До F.b психокостяных вещей получают Восстановление или Разрушение (оружие/броня/снаряжение), до 3 раз за сессию",
    source: "Reformation Song / Песня Изменений",
    reader: "module/combat/reformation-song.mjs (wdbc-vwfk) — applyReformationSong, per-target пикер в apps/reformation-song-dialog.mjs (фильтр по item.system.wraithbone/wraithboneImmune), кнопка в sheets/tabs/combat.mjs. Полностью автоматизировано: AP брони (armorMod ±F.b/+½F.b до конца боя), глушение чужих модов/талантов на разрушенной броне (armor-mods.mjs::getInstalledArmorMods + reformationSongSuppressMods) и обнуление актёрского пула Аблативных Ран на то же «до конца боя», Reinforced оружия (до конца боя), заклинивание оружия (weapon.jammed/jamLockedRound — впервые в проекте реальное состояние, не разовая строка в чате; combat/attack.mjs пишет его при обычном срабатывании jamThreshold, снимается weapon-properties.mjs::clearWeaponJam), качество Снаряжения (шаг ±1 до конца боя), флаги weapon.destroyed/gear.malfunctioning (тот же паттерн, что armor.breached). Осталось решением за столом только само наполнение флагов wraithbone/wraithboneImmune для новых/самодельных предметов — готовой UI-галочки нет (тот же прецедент, что item.system.drukhari)."
  },
  "wraithbone.reshapeForCraft.halfSuccessesBack": {
    label: "Разрушает свой психокостяной предмет ради ½ успехов крафта на новый",
    source: "Reshape Song / Песня Изменения Формы", reader: ""
  },
  "wraithbone.songOfSwiftness.techniqueOrArea": {
    label: "Песнь Скорости: +SPD/манёвренность технике (1 цель или область) до конца боя, до 3 раз за сессию",
    source: "Song of Swiftness / Песня Стремительности",
    reader: "module/combat/song-of-swiftness.mjs (wdbc-sk8s) — applySongOfSwiftnessSingle/applySongOfSwiftnessArea, встроенный Item type:vehicleTrait, снимается по hooks.mjs::deleteCombat; кнопка в sheets/tabs/combat.mjs."
  },
  "wraithbone.spiritTalk.possessConstruct": {
    label: "Захватывает контроль над психокостяным конструктом на F.b раундов (встречный тест на враждебном), до 3 раз за сессию",
    source: "Spirit Talk / Духовный Разговор",
    reader: "module/combat/spirit-talk.mjs (wdbc-q30d) — triggerSpiritTalk (кнопка на вкладке БОЙ, 2 ОД, до 3 раз за сессию), applySpiritTalkPossession/processSpiritTalkRoundStart встраивают Combatant цели в очередь ходов сразу за кастером на F.b раундов (та же инфраструктура extra-turn.mjs/паттерн раундового хука, что Last Actor/Middle of the Hunt, wdbc-1rno). Дальность W м (WP+0, measureTokens/edgeM — та же геометрия, что у стрельбы) и предел размера «не больше призрачного лорда» (Wraithlord Size 2, Книга Эльдар: Техника) — гейт блокирует кнопку. Манифестация психосил через захваченный конструкт — rules/psychic-vessel.mjs (общий примитив с Путём Силы Псайбер-Фамильяра, PSY_PATHS.familiar), заметка Пути называет носителя по имени. НЕ смоделировано: характеристики/таланты/навыки персонажа на самом конструкте (у Техники в схеме вообще нет characteristics — подтверждено книжным stat-блоком Призрачного Стража/Лорда, тот же AP/Структура/Размер формат, что у прочей техники — заводить временный оверлей ради одной находки не оправдано, эффект остаётся на столе); сторона цели встречного теста WP+0 (Техника не несёт характеристику Воли) — автоматизирована только сторона персонажа (WP+0/Fel+10 на выбор системы, лучшее), исход подтверждает стол диалогом (тот же приём, что Deadly Effectiveness); сама дальность манифестации психосилы через носителя (sheets/tabs/psychic.mjs вообще не мерит дистанцию даже для собственной позиции кастера)."
  },
  "wraithbone.summonStelthene": {
    label: "Может призывать Стелхене так же, как психокость",
    source: "Stelthene Song / Песня Стелхене", reader: ""
  },
  "ritual.shaman.bloodletting": {
    label: "Убийство даёт разовый ритуал: +5 на тесты и иммунитет к Страху/Подавлению союзникам-зверолюдям в радиусе",
    source: "Ritual Bloodletting / Ритуал Кровопускания", reader: ""
  },
  "ritual.shaman.symbolOfPower": {
    label: "Рог как пси-фокус; можно жертвовать R Dmg за +2 эPR ценой автоматического феномена",
    source: "Symbol of Power / Символ Власти", reader: ""
  },
  "ritual.shaman.primalHowl": {
    label: "Раз в бой: союзники +10 S/T (по богу иначе), враги Fear(+1)",
    source: "Primal Howl / Первобытный Вой", reader: ""
  },
  "ritual.shaman.hexMarkedPrey": {
    label: "Метит врага: союзники-зверолюди +15 на атаки по нему (по богу — доп. эффекты)",
    source: "Hex-Marked Prey / Проклятая Метка", reader: ""
  },
  "ritual.shaman.selfSacrifice": {
    label: "Наносит себе урон ради +2 эPR и Tainted в ближнем бою (по богу — иначе)",
    source: "Rite of Self-Sacrifice / Ритуал Самопожертвования", reader: ""
  },
  "aura.shaman.warpTainted": {
    label: "Аура: не-еретики тест W−10 или 1 Cor, союзники +20 к Сопротивлению",
    source: "Warp-Tainted Aura / Аура Скверны", reader: ""
  },
  "rune.shaman.boneRuneEtching": {
    label: "Вырезает руну психосилы на кости; активируется бесплатно с Успехами = бPR на момент создания",
    source: "Bone-Rune Etching / Костяная Рунопись", reader: ""
  },
  "ritual.shaman.summonHerdSpirits": {
    label: "Открывает ритуал «Призыв Духов Стада» (призыв Минотавра/Тролля/Великана)",
    source: "Summon Herd Spirits / Призыв Духов Стада", reader: ""
  },

  // ── Мелкие Изменения (DoomBC — Особые Псайкеры, стр. 4) — правки Вмешательства/
  //    Пси-Капюшона, отдельная психическая подсистема (module/sheets/tabs/psychic.mjs).
  "psychic.interference.singleTestVsMundane": {
    label: "Вмешательство против не-псайкера проходит только первый тест, сравнивается напрямую с его психотестом",
    source: "Stop Grumbling! / Не Бухти!", reader: ""
  },
  "psychic.interference.noPhysicalNoMeleeTest": {
    label: "Вмешательство больше не Физическое и не требует рукопашного теста",
    source: "Battle of the Wits / Битва Умов", reader: ""
  },
  "psychic.interference.plusPsychicHoodSameRound": {
    label: "Может применить Вмешательство и Пси-Капюшон в тот же раунд за одну реакцию, эффекты складываются",
    source: "Countermeasure / Контрмера", reader: ""
  },

  // ── Таланты Иннари (DoomBC — Аэльдари: Ответвления, ЭЛИТНЫЕ АРХЕТИПЫ ИННАРИ)
  //    — ресурс «Мёртвое Могущество» (system.deadMight, max=W.b×3) РЕАЛЬНО
  //    существует в actor.mjs (см. документацию рядом), но эти таланты все
  //    триггерные/условные (не разовый бонус на взятие), Конструктор не годится.
  "warpWeapon.bladeOfDeath.atMaxDeadMight": {
    label: "На максимуме Мёртвого Могущества рукопашные атаки клинковым оружием получают Warp Weapon",
    source: "Blade of Death / Клинок Смерти", reader: ""
  },
  "deadMight.spend.extremeBonusDamage": {
    label: "За 5 Мёртвого Могущества попадание получает Extreme(6/−1) и +W.b урона",
    source: "Conductor of Death / Проводник Смерти", reader: ""
  },
  "actionPoint.bonusOnFeintKill.extraMeleeAttack": {
    label: "Убийство после финта в том же раунде: раз в раунд +2 ОД (доп. рукопашная атака вне лимита не нужна — в системе нет счётчика атак за Ход, тот же вывод, что для Eldar Agility) — смоделировано КНОПКОЙ на вкладке БОЙ (wdbc-1rno, module/combat/deadly-effectiveness.mjs, module/rules/cooldown.mjs unit «round»). НЕ детектируется автоматически: в системе нет ни понятия «убийство»/смерть актора, ни отметки «применил Финт в этом раунде» — игрок сам подтверждает клик, система считает только «раз в Раунд» и сам +2 ОД (тот же честный компромисс, что у Категории C).",
    source: "Deadly Effectiveness / Смертоносная Эффективность", reader: "module/combat/deadly-effectiveness.mjs"
  },
  "deadMight.gainAtCombatStart.willpowerScaling": {
    label: "В начале боя получает +W.b Мёртвого Могущества",
    source: "Death Incarnate / Смерть Воплощённая", reader: ""
  },
  "deadMight.gainOnSoulBurn.willpowerTest": {
    label: "Непоглощённый урон через Выжигание Души: тест W даёт Мёртвое Могущество = успехам; убийство — W.b×2",
    source: "Devour the Soul / Пожрать Душу", reader: ""
  },
  "combat.advantageVsHorde.devastatingWsB": {
    label: "Против Орды (actor.type===\"horde\") — Преимущество на атаку (диалог атаки, авто) и на Уклонение/Парирование (реестр правил, module/rules/one-against-a-hundred.mjs); Низшие Миньоны не распознаются (нет поля «тир» на акторе). Devastating(WS.b) по Орде и предел входящего урона 10/раунд — не смоделированы (другие механики, не Преимущество)",
    source: "One Against A Hundred / Один Против Сотни", reader: "module/rules/one-against-a-hundred.mjs"
  },
  "damage.convertUnabsorbed.toWillpower": {
    label: "Раз в раунд может нанести непоглощённый урон в Волю (1d10+W.b) вместо обычного",
    source: "Vulnerability / Уязвимость", reader: ""
  },
  // ── Экзодиты — Воин Троп (DoomBC — Аэльдари: Ответвления, Архетипы Экзодитов)
  "exodite.pathWarrior.determinationToFight": {
    label: "При отрицательных ранах персонаж снижает получаемый урон на WP.b (после поглощения, мин.1) и получает +1 ОД — смоделировано (module/rules/determination-to-fight.mjs, читают module/combat/damage.mjs::applyDamageToActor и module/combat/action-economy.mjs::resetActionEconomy/effectiveActionPointsMax). При отрицательных ранах + прошлый раунд в Защитной Стойке — доп. снижение на WS.b (мин.1, тот же читатель урона) и +30 к тестам Парирования (module/combat/defense.mjs::_performParry) — тоже смоделировано (снимок Стойки на смену Раунда, hooks.mjs::updateCombat). «Лимит атак до 2» — не смоделирован: базовое правило «одна Атака за Ход» (стр. 32) в системе нигде не проверяется вовсе, не только для этого Таланта — заводить счётчик атак и включать проверку для ВСЕХ акторов системы это отдельная, гораздо более рискованная правка (меняет наблюдаемое поведение боя всем акторам, не только владельцу этого Таланта).",
    source: "Determination To Fight / Решительность Сражаться",
    reader: "module/rules/determination-to-fight.mjs, module/combat/damage.mjs::applyDamageToActor, module/combat/defense.mjs::_performParry, module/combat/action-economy.mjs::resetActionEconomy"
  },
  "exodite.pathWarrior.eternalGuardian": {
    label: "Unnatural WS архетипа меняется на +4, +1 очко судьбы. Против фракции, которую персонаж ранее побеждал: +2 Dmg и +1 Pen (или +3/+2 при Hatred…",
    source: "Eternal Guardian / Вечный Страж", reader: ""
  },
  "exodite.pathWarrior.eternalOath": {
    label: "Черта Воина Троп. Скован клятвой (нарушение — потеря бонусов архетипа). Авто-проходит социальные тесты против экзодитов,",
    source: "Eternal Oath / Вечная Клятва", reader: ""
  },
  "exodite.pathWarrior.selflessWarrior": {
    label: "Черта Воина Троп. Рядом с союзниками или защищая эльдарскую символику/строения: +1 рукопашного урона за каждую потерянную чётную рану (при >…",
    source: "Selfless Warrior / Самоотверженный Воин", reader: ""
  },
  "exodite.pathWarrior.spearStand": {
    label: "Успешно попав со стойки Частокол на +3 успеха, персонаж может совершить ещё одну свободную атаку до основной. Убив так противника,",
    source: "Spear Stand / Стойка Копья", reader: ""
  },
  "exodite.pathWarrior.stoppingForce": {
    label: "Свободная атака персонажа получает Crippling (2/+1), Extreme (7/−1) и Proven (4/+1). Если она убивает противника или делает беспомощным,",
    source: "Stopping Force / Останавливающая Сила", reader: ""
  },
  "exodite.pathWarrior.stormOnslaught": {
    label: "Преуспев в атаке на +5 успехов, персонаж может совершить точно такую же атаку (приём/стойка/база, с тем же бонусом) со штрафом −20;",
    source: "Storm Onslaught / Штормовой Натиск", reader: ""
  },
  "exodite.pathWarrior.swordStance": {
    label: "Парировав атаку на +3 успеха, персонаж проходит WS+20−20×Размер противника и при успехе перенаправляет вражескую атаку на самого противника…",
    source: "Sword Stance / Стойка Меча", reader: ""
  },
  "exodite.pathWarrior.virtuosoOfProtection": {
    label: "В Защитной Стойке: +1 реакция на физическое избегание и +20 на Парирование. Провалившему атаку противнику −30 на Вольт.",
    source: "Virtuoso of Protection / Виртуоз Защиты", reader: ""
  },
  "exodite.pathWarrior.virtuosoOfWeapons": {
    label: "Можно брать раз за каждое Оружие Наследия. Выбранный вид рукопашного оружия даёт +10 на все тесты с ним, Extreme (9/−1),",
    source: "Virtuoso of Weapons / Виртуоз Оружия", reader: ""
  },
  // ── Экзодиты — Воин Курноуса
  "exodite.kurnousWarrior.crushingGallop": {
    label: "Если скакун не передвигался больше SPD в прошлом раунде, он увеличивает натиск до значения Бега, +S.",
    source: "Crushing Gallop / Сокрушающий Галоп", reader: ""
  },
  "exodite.kurnousWarrior.eliteOfRiders": {
    label: "Черта Воина Курноуса. Survival и таланты ветки «Всадник» всегда дружественны. Получив урон впервые за ход,",
    source: "Elite of Riders / Элита Всадников", reader: ""
  },
  "exodite.kurnousWarrior.heroOfMyths": {
    label: "За каждую разницу в размерах в пользу противника персонаж и скакун получают +10 на все тесты атаки против него, а успешные атаки — +1 успех.",
    source: "Hero of Myths / Герой Мифов", reader: ""
  },
  "exodite.kurnousWarrior.knightlyLegacy": {
    label: "При верховой атаке натиском противник получает штраф к уклонению = успехи на атаке×5 (макс 40).",
    source: "Knightly Legacy / Рыцарское Наследие", reader: ""
  },
  "exodite.kurnousWarrior.lightTread": {
    label: "Персонаж на скакуне (и сам скакун) может передвигаться на любой скорости по трудному ландшафту.",
    source: "Light Tread / Лёгкая Поступь", reader: ""
  },
  "exodite.kurnousWarrior.richVariety": {
    label: "Персонаж может иметь до Unnatural P дополнительных скакунов с чертой Unbreakable Bond. С ними слабая психическая связь,",
    source: "Rich Variety / Богатое Разнообразие", reader: ""
  },
  "exodite.kurnousWarrior.unbreakableBond": {
    label: "Черта Воина Курноуса. Обменивается приказами со скакуном без физического общения. Тратя очко судьбы,",
    source: "Unbreakable Bond / Нерушимая Связь", reader: ""
  },
  "exodite.kurnousWarrior.unstoppableGallop": {
    label: "Действие таланта Thunder Charge распространяется на скакуна. При маневре напролом скакун получает бонус = ранг Survival×5 (Survival+0 → +5,",
    source: "Unstoppable Gallop / Неостановимый Галоп", reader: ""
  },
  "exodite.kurnousWarrior.unstoppableOnslaught": {
    label: "Когда персонаж атакует противника верховой атакой, его скакун (если имеет атаки) может за Свободное действие или реакцию атаковать после пер…",
    source: "Unstoppable Onslaught / Неостановимый Натиск", reader: ""
  },
  // ── Экзодиты — Танцор Войны
  "exodite.warDancer.artOfSpeed": {
    label: "Атакуя противника, персонаж получает бонус к урону = разнице SPD в свою пользу. При разнице 5+ — Proven (+3) и Extreme (6/−2);",
    source: "Art of Speed / Искусство Скорости", reader: ""
  },
  "exodite.warDancer.carvingOnBones": {
    label: "Черта Танцора Войны. Может создавать Фетиши, используя кости противника и Trade (Jeweler); заряды фетиша +A.b.",
    source: "Carving On Bones / Резьба На Костях", reader: ""
  },
  "exodite.warDancer.cognitionOfDance": {
    label: "+1 реакция на физические избегания. Успешное Парирование даёт +5 на Уклонение, успешное Уклонение — +5 на Парирование (складывается до +30,",
    source: "Cognition of Dance / Познание Танца", reader: ""
  },
  "exodite.warDancer.danceOfCarnage": {
    label: "Преуспев в рукопашной атаке на +5 успехов, персонаж может совершить движение до полудвижения; войдя в контакт с противником(ами),",
    source: "Dance of Carnage / Танец Рассечения", reader: ""
  },
  "exodite.warDancer.incessantDance": {
    label: "Атакуя одного и того же противника, за каждую совершённую по нему атаку (не обязательно попавшую) персонаж получает +10 на атаки (до +60;",
    source: "Incessant Dance / Непрекращающийся Танец", reader: ""
  },
  "exodite.warDancer.momentOfDancing": {
    label: "Успешно избежав рукопашной атаки на +2 успеха, персонаж может переместиться за спину противника; если его A.b выше P.b противника,",
    source: "Moment of Dancing / Момент Танца", reader: ""
  },
  "exodite.warDancer.shadowDance": {
    label: "Персонаж получает фокусы дисциплин Прорицание, Телекинез и Фантасмагория и может купить элитный архетип Теневой Провидец,",
    source: "Shadow Dance / Теневой Танец", reader: ""
  },
  "exodite.warDancer.worshippersOfDance": {
    label: "Черта Танцора Войны. Полудвижение SPD×2, Полное Движение SPD×3, Натиск SPD×6, Бег SPD×12. +1 реакция.",
    source: "Worshippers of Dance / Почитатели Танца", reader: ""
  },
  // ── Экзодиты — Лесной Владыка
  "exodite.forestLord.chosenVictim": {
    label: "За Свободное действие персонаж избирает враждебное существо Выбранной Жертвой (остаётся 1 очко судьбы, если было больше).",
    source: "Chosen Victim / Выбранная Жертва", reader: ""
  },
  "exodite.forestLord.lordOfTheExodites": {
    label: "Черта Лесного Владыки. Аура F.b×2: союзники +30 к тестам Морали и переброс. Полное действие: выводит до F.b союзников из Страха/Шока/Подавления.",
    source: "Lord of the Exodites / Повелитель Экзодитов",
    reader: "packs-src/aeldari-traits/…/Lord_of_the_Exodites (mechanics: aura+reroll), " +
      "module/combat/lord-of-exodites.mjs (clearMoraleConditions/rallyExoditeSquad/applyLordOfExoditesFailPenalty), " +
      "module/sheets/tabs/command.mjs::rollCommand (declaredSuccesses)"
  },
  "exodite.forestLord.rightToChoose": {
    label: "Персонаж может менять местами эффекты талантов The Beginning of the Hunt, The Middle of the Hunt и The End of the Hunt (например,",
    source: "Right to Choose / Право Избирать", reader: ""
  },
  "exodite.forestLord.theBeginningOfTheHunt": {
    label: "Избрав Духа Курноуса: подчинённые с копьём как основным оружием получают +10 к WS/T и могут входить в стойку Частокол за Свободное действие…",
    source: "The Beginning of the Hunt / Начало Охоты", reader: ""
  },
  "exodite.forestLord.theEndOfTheHunt": {
    label: "В начале 5-го и 6-го раундов все противники персонажа получают штраф ко всем броскам физического избегания/страха/шока/подавления/оглушения,",
    source: "The End of the Hunt / Конец Охоты", reader: ""
  },
  "exodite.forestLord.theEpitomeOfAristocracy": {
    label: "Персонаж считает все таланты группы «Лидерство» дружественными, F становится дружественной характеристикой.",
    source: "The Epitome of Aristocracy / Воплощение Аристократии", reader: ""
  },
  "exodite.forestLord.theMiddleOfTheHunt": {
    label: "В начале 3-го и 4-го раундов персонаж поднимает свою Инициативу на 10 — смоделировано (wdbc-1rno, module/combat/middle-of-the-hunt.mjs, hooks.mjs::updateCombat). Старая метка ошибочно описывала это как «доп. Ход» — книжный текст проще: плоский +10 к уже брошенной Инициативе, не лишний Combatant. Выбор до F.b союзников для +2 их Инициативе — НЕ смоделирован, нужен диалог выбора.",
    source: "The Middle of the Hunt / Середина Охоты", reader: "module/combat/middle-of-the-hunt.mjs"
  },
  "exodite.forestLord.weaponsOfTheNobleOnes": {
    label: "Черта Лесного Владыки. Используя копьё как основное оружие, перед боем может обратиться к Духу Курноуса (запрещает другое рукопашное оружие)…",
    source: "Weapons of the Noble Ones / Оружие Благородных", reader: ""
  },
  // ── Арлекины — Солитер (DoomBC — Аэльдари: Ответвления)
  "harlequin.solitaire.bowToTheAudience": {
    label: "За 3 ОД персонаж проходит Awareness(P)−20 против до P.b видимых противников, умножает степень успеха на три и до начала своего следующего Хода получает этот бонус на все физические действия против них, накладывая равный штраф на их физические Избегания — смоделировано кнопкой на вкладке БОЙ (wdbc-1rno, module/combat/bow-to-audience.mjs). Метка живёт на АТАКУЮЩЕМ (кто прошёл тест), не на цели — точнее книжного текста: бонус/штраф действуют только когда бьёт именно отметивший, читается module/sheets/attack-dialog.mjs по attackCtx.targetActor. Цели — до P.b из game.user.targets (тот же приём, что Bone Song). «На один Ход» прочитано как «до начала следующего Хода атакующего» (тот же такт, что усилитель Dread Wail) — не буквально «до конца текущего Хода», расхождение честно задокументировано.",
    source: "Bow to the Audience / Поклон Публике", reader: "module/combat/bow-to-audience.mjs"
  },
  "harlequin.solitaire.damnedActor": {
    label: "Черта Солитера (Аребенниан). Полный иммунитет к Выжиганию Души и психосилам демонов/псайкеров с Cor>20.",
    source: "Damned Actor / Проклятый Актёр", reader: ""
  },
  "harlequin.solitaire.inevitable": {
    label: "Персонаж игнорирует свойства Blast, Flush и Storm в физическом избегании (уворачивается как от одиночного выстрела, не тратя движение).",
    source: "Inevitable / Неизбежный", reader: ""
  },
  "harlequin.solitaire.justTheLight": {
    label: "Если персонаж потратил весь прошлый Ход на движение (или совершил хотя бы одно движение и сжёг остальные ОД), получает щит-дефлектор A.b×3 до начала следующего Хода — смоделировано (wdbc-1rno, module/combat/just-the-light.mjs, hooks.mjs::updateCombat конец Хода + action-economy.mjs сброс на старте следующего Хода, читается той же точкой incomingDamageReduction, что и Determination To Fight). НЕ смоделировано: «складывается с технологическими, но не колдовскими щитами» — incomingDamageReduction плоское число без разметки природы источника, ограничение на честном слове ГМ (тот же принцип, что Категория C).",
    source: "Just the Light / Лишь Свет", reader: "module/combat/just-the-light.mjs"
  },
  "harlequin.solitaire.lastActor": {
    label: "Черта Солитера. «Бросает трижды на инициативу (три хода в раунде)» — смоделировано (wdbc-1rno, module/combat/last-actor.mjs+extra-turn.mjs: 2 доп. Combatant при старте боя, hooks.mjs::combatStart). Остальные 7 пунктов (A.b реакций и 4 ОД, Парирование Flexible/любого размера, безлимитный контроль в рукопашной, авто-контратака/избегание, бонус от разницы A, урон = разница инициатив, любые рукопашные таланты на любые атаки) — не смоделированы, каждый требует своей точки в конвейере.",
    source: "Last Actor / Последний Актёр", reader: "module/combat/last-actor.mjs, module/combat/extra-turn.mjs"
  },
  "harlequin.solitaire.massacre": {
    label: "Успешно попав рукопашной атакой, персонаж может пройти Trade (Dance)(A)−20 и нанести ещё одну одиночную атаку; повторяет до провала,",
    source: "Massacre / Бойня", reader: ""
  },
  "harlequin.solitaire.skillOfKilling": {
    label: "Персонаж не получает штрафов от атак в сочленения. Все его рукопашные атаки получают Eldar Accurate и Eldar Precise.",
    source: "Skill of Killing / Мастерство Убийства", reader: ""
  },
  "harlequin.solitaire.theDoomedActor": {
    label: "Персонаж получает манифестацию психосил Хрономантии (PR = A.b, вместо W — A; без Варп-феноменов/прорывов) и бесплатно владеет: Внутренние Ча…",
    source: "The Doomed Actor / Роковой Актёр", reader: ""
  },
  // ── Арлекины — Теневой Провидец
  "harlequin.shadowseer.aBitOfAHassle": {
    label: "Существа под действием наркотиков или галлюцинаций получают −W.b×3 на сопротивление психосилам персонажа.",
    source: "A Bit of a Hassle / Лёгкий Морок", reader: ""
  },
  "harlequin.shadowseer.actorOfLiesAndDeception": {
    label: "Черта Теневого Провидца. Может считывать мысли в обход обычной защиты (кроме покровителей ксено-божеств).",
    source: "Actor of Lies and Deception / Актёр Лжи и Обмана", reader: ""
  },
  "harlequin.shadowseer.athesdan": {
    label: "Если противник проигрывает персонажу в любом психотесте и при этом под действием Hallucinogenic,",
    source: "Athesdan / Высший Теневой Провидец", reader: ""
  },
  "harlequin.shadowseer.conductiveHand": {
    label: "Все рукопашные атаки персонажа получают свойство Hallucinogenic (6). За Свободное действие персонаж может изменить тип урона своих рукопашны…",
    source: "Conductive Hand / Проводящая Длань", reader: ""
  },
  "harlequin.shadowseer.handTrick": {
    label: "Персонаж добавляет свойство Independent для крейданна (галлюциногенного граната). Может стрелять из него за реакцию в начале и в конце движе…",
    source: "Hand Trick / Ручной Фокус", reader: ""
  },
  "harlequin.shadowseer.twilightPuppeteer": {
    label: "Черта Теневого Провидца. Персонаж проходит проверки F через W (с бонусами Unnatural W), но Command — через F (кроме как для теневидцев).",
    source: "Twilight Puppeteer / Кукловод Сумерек", reader: ""
  },
  // ── Арлекины — Шут Смерти
  "harlequin.deathJester.deathIsNotTheEnd": {
    label: "Черта Шута Смерти. В начале раунда персонаж может пройти BS+10 и при успехе получить +2 Dmg на все стрелковые атаки до конца битвы;",
    source: "Death Is Not The End / Смерть – Это Не Конец", reader: ""
  },
  "harlequin.deathJester.domino": {
    label: "Когда противник проигрывает тест против Страха/Шока/Подавления от действий Шута Смерти,",
    source: "Domino / Домино", reader: ""
  },
  "harlequin.deathJester.eternalDespair": {
    label: "Все персонажи считаются неважными в расчёте тестов против Страха Шута Смерти. Провалив тест против страха от Шута Смерти и покинув поле битв…",
    source: "Eternal Despair / Вечное Отчаяние", reader: ""
  },
  "harlequin.deathJester.everyoneIsEqual": {
    label: "Нанеся минимум 5 непоглощённого урона технике, весь её экипаж проходит тест против Страха.",
    source: "Everyone Is Equal / Все Равны", reader: ""
  },
  "harlequin.deathJester.falseHopes": {
    label: "Раз в раунд, если противник успешно уворачивается от стрелковой атаки персонажа, тот может за реакцию сразу совершить одиночную атаку по нем…",
    source: "False Hopes / Ложные Надежды", reader: ""
  },
  "harlequin.deathJester.quickDeath": {
    label: "Персонаж добавляет полный BS.b к урону от стрелковых атак вместо ½ BS.b (включая Blast и Spray).",
    source: "Quick Death / Быстрая Смерть", reader: ""
  },
  "harlequin.deathJester.reaperOfTorment": {
    label: "Персонаж добавляет Felling (+12) всему оружию и Toxic (+4) всему неэнергетическому оружию. Его Felling, помимо Unnatural T,",
    source: "Reaper of Torment / Жнец Мучений", reader: ""
  },
  "harlequin.deathJester.sweepingStorm": {
    label: "С Крикуном персонаж за полудействие может отметить BS.b целей на ретинальном дисплее: +20 на стрельбу по ним, игнор укрытий,",
    source: "Sweeping Storm / Сметающий Шторм", reader: ""
  },
  // ── Общие (DoomBC — Основная книга, Таланты)
  "general.core.beyondHuman": {
    label: "Персонаж превзошёл пределы человеческих возможностей. Он получает Трейт Unnatural Characteristic (+1) для соответствующей Характеристики и п…",
    source: "Beyond Human / За Гранью Человека", reader: ""
  },
  "general.core.combatFormation": {
    label: "Персонаж тщательно планирует расстановку в бою. Персонаж и все его соратники, с которыми он поделился планами,",
    source: "Combat Formation / Боевое Построение", reader: ""
  },
  "general.core.combatSense": {
    label: "Персонаж может использовать P.b вместо A.b при броске на Инициативу.",
    source: "Combat Sense / Чувство Боя", reader: ""
  },
  "general.core.fastestHand": {
    label: "Когда персонаж вооружён только ножами и/или пистолетами, он получает бонус к Инициативе, равный WS.b или BS.",
    source: "Fastest Hand / Самая Быстрая Рука", reader: ""
  },
  "general.core.lightningReflexes": {
    label: "Персонаж бросает на Инициативу 2 раза и выбирает больший результат.",
    source: "Lightning Reflexes / Молниеносные Рефлексы", reader: ""
  },
  "general.core.mastery": {
    label: "Персонаж может потратить Очко Бесчестия, чтобы автоматически пройти тест на выбранный Навык с финальным модификатором +0 или легче с количес…",
    source: "Mastery / Мастерство", reader: ""
  },
  "general.core.paranoia": {
    label: "Персонаж получает бонус +2 к Инициативе. ГМ может тайно провести Тест на P или Awareness, чтобы узнать, ощутил ли персонаж скрытую угрозу.",
    source: "Paranoia / Паранойя", reader: ""
  },
  "general.core.rapidReaction": {
    label: "Когда персонажа застали Врасплох, он может пройти тест на А+0, чтобы действовать обычным образом.",
    source: "Rapid Reaction / Быстрая Реакция", reader: ""
  },
  // ── Смелость (DoomBC — Основная книга, Таланты)
  "courage.core.fearless": {
    label: "Персонаж автоматически проходит тесты Морали, но, чтобы выйти из боя или отказаться от драки, должен пройти W+0.",
    source: "Fearless / Бесстрашный", reader: ""
  },
  "courage.core.fireman": {
    label: "Персонаж не паникует от Горения и получает +30 на тесты тушения себя или других.",
    source: "Fireman / Пожарный", reader: ""
  },
  "courage.core.idolater": {
    label: "В присутствии своего кумира персонаж авто-проходит тесты Морали, но получает −30 на встречные броски против Команд и социального взаимодейст…",
    source: "Idolater / Идолопоклонник", reader: ""
  },
  "courage.core.jaded": {
    label: "Персонаж автоматически проходит тесты на Страх при виде крови, смерти, насилия и прочих земных ужасов.",
    source: "Jaded / Пресыщенный", reader: ""
  },
  "courage.core.mindKiller": {
    label: "Персонаж отнимает ½I (окр.▼) от бросков на Шок и, будучи Подавлен или в Панике от Горения/Удушья, может пройти I−10,",
    source: "Mind Killer / Убийца Разума", reader: ""
  },
  "courage.core.nervesOfSteel": {
    label: "Персонаж может перебрасывать тесты на Подавление.",
    source: "Nerves of Steel / Стальные Нервы", reader: ""
  },
  "courage.core.unshakeableWill": {
    label: "Персонаж может перебрасывать тесты Морали.",
    source: "Unshakeable Will / Несокрушимая Воля", reader: ""
  },
  // ── Скитарии
  "skitarii.core.boonOfOmnissiah": {
    label: "Подключившись к электросети и имея нужные сырые материалы, Скитарий за смену работы без инструментов и тестов может создать или перезарядить…",
    source: "Boon of Omnissiah / Дар Омниссии", reader: ""
  },
  "skitarii.core.cyberdeacon": {
    label: "Скитарий может генерировать и накапливать мотивирующую силу как персонаж с Имплантами Механикум, но на 1 в Ход меньше.",
    source: "Cyberdeacon / Кибердьякон", reader: ""
  },
  "skitarii.core.deliveranceOfArkhan": {
    label: "Попав в поле Haywire интенсивностью 7+, Скитарий может получить 1 Усталости или потратить 1 заряд Актуаторных Банков,",
    source: "Deliverance of Arkhan / Избавление Аркхана", reader: ""
  },
  "skitarii.core.shiftingMantle": {
    label: "Раз в Ход за ментальное свободное действие Скитарий может отключить один Модуль и/или включить другой.",
    source: "Shifting Mantle / Смещающаяся Мантия", reader: ""
  },
  "skitarii.core.skitariiAlpha": {
    label: "Скитарий увеличивает максимум своих установленных и активных Модулей на 1.",
    source: "Skitarii Alpha / Скитарий Альфа", reader: ""
  },
  // ── Мудрец
  "sage.core.foresight": {
    label: "Потратив 5 минут на обдумывание задачи, персонаж может избрать лучший курс действий и получить +10 на следующий тест I,",
    source: "Foresight / Предусмотрительность", reader: ""
  },
  "sage.core.infusedKnowledge": {
    label: "Персонаж считается имеющим все Common Lore и Scholastic Lore на +0. Он не получает их в расчёте продвижений и должен изучать как обычно,",
    source: "Infused Knowledge / Вложенные Знания", reader: ""
  },
  "sage.core.totalRecall": {
    label: "Всегда дружественный для Космодесантников. Персонаж способен вспоминать мельчайшие детали прошедших событий без тестов и запоминать массивы…",
    source: "Total Recall / Идеальная Память", reader: ""
  },
  "sage.core.wisdomOfTheAncients": {
    label: "Персонаж может потратить 1 Очко Бесчестия, чтобы попросить ГМа о подсказке к текущей ситуации,",
    source: "Wisdom of the Ancients / Мудрость Древних", reader: ""
  },
  // ── Метание
  "throwing.core.balearic": {
    label: "Персонаж добавляет ½A.b (окр.▲) к S.b в расчёте дальности и урона метательного и примитивного стрелкового оружия.",
    source: "Balearic / Балеарец", reader: ""
  },
  "throwing.core.clobber": {
    label: "Попадая по цели метательным оружием (в т.ч. импровизированным), весящим ≥¼ цели, цель проходит S+0 или Сбивается с ног.",
    source: "Clobber / Поколотить", reader: ""
  },
  "throwing.core.grenadeCooking": {
    label: "Перед броском гранаты персонаж может пройти Logic(I)+0. При Успехе Уклонения от гранаты получают −5×Успехи.",
    source: "Grenade Cooking / Выдержка Гранаты", reader: ""
  },
  "throwing.core.grenadier": {
    label: "Если брошенная граната промахнулась, персонаж может уменьшить дистанцию смещения на BS.b.",
    source: "Grenadier / Гренадер", reader: ""
  },
  "throwing.core.runningThrow": {
    label: "Раз в Ход, совершая любое Движение, персонаж может пройти Acrobatics−10, чтобы совершить дополнительную атаку метательным оружием или гранат…",
    source: "Running Throw / Бросок на Бегу", reader: ""
  },
  "throwing.core.volleyThrow": {
    label: "Персонаж может использовать метательные ножи, флешеты и подобное метательное оружие в режиме длинной очереди с модификатором +0 вместо −10 и…",
    source: "Volley Throw / Залповый Бросок", reader: ""
  },
  // ── Огнемётчик
  "flamer.core.fireDance": {
    label: "Накрывая цели шаблоном огнемёта, после тестов А на избегание от огня, но до настоящих Избеганий,",
    source: "Fire Dance / Танец Пламени", reader: ""
  },
  "flamer.core.fireMaze": {
    label: "Стреляя из огнемёта, персонаж бросает на свойство Linger 2 раза и выбирает один результат по своему усмотрению.",
    source: "Fire Maze / Лабиринт Пламени", reader: ""
  },
  "flamer.core.friendlyFire": {
    label: "Стреляя из оружия со свойством Spray, персонаж может дать всем целям в пределах дистанции по своему выбору +30 на тест А для избегания от по…",
    source: "Friendly Fire / Дружественный Огонь", reader: ""
  },
  "flamer.core.pyromaniac": {
    label: "Цели должны перебрасывать успешные тесты, чтобы не загореться от атак персонажа оружием со свойствами Spray и Flame,",
    source: "Pyromaniac / Пироман", reader: ""
  },
  "flamer.core.sprayer": {
    label: "Цели, накрытые шаблоном оружия со свойством Spray от персонажа, получают −20 на бросок А для избегания попадания.",
    source: "Sprayer / Распылитель", reader: ""
  },
  "flamer.core.torrent": {
    label: "Стреляя из огнемёта, над которым работал хотя бы 1 смену, персонаж может удвоить расход боеприпасов,",
    source: "Torrent / Поток", reader: ""
  },
  // ── Геносемя
  "geneseed.core.blackMantle": {
    label: "Десантник ощущает приблизительный уровень фоновой радиации и за полудействие может ввести Меланохром в усиленный режим (радиационная защита…",
    source: "Black Mantle / Чёрная Мантия", reader: ""
  },
  "geneseed.core.heroSSleep": {
    label: "Десантник может перебрасывать неудачные тесты на активацию Сус-ан мембраны и может активировать её до порога −(10+T.",
    source: "Hero's Sleep / Сон Героя", reader: ""
  },
  "geneseed.core.letItFlow": {
    label: "Когда десантник умирает от Кровотечения, вместо этого он только получает 1 Усталости.",
    source: "Let It Flow / Пусть Льётся", reader: ""
  },
  "geneseed.core.memoryThief": {
    label: "Успешно использовав Омофагею, десантник может получить один из Навыков жертвы на том же уровне продвижения на I.b суток.",
    source: "Memory Thief / Вор Памяти", reader: ""
  },
  "geneseed.core.tasteTheSoul": {
    label: "Десантник получает +½ P (окр.▲) на тесты использования Омофагеи.",
    source: "Taste the Soul / Испробовать Душу", reader: ""
  },
  "geneseed.core.temperedCocoon": {
    label: "Десантник получает ещё +10 на все тесты против жара, холода и вакуума, и вместо переброса этих тестов от Мукраноида получает на них Преимуще…",
    source: "Tempered Cocoon / Закалённый Кокон", reader: ""
  },
  // ── Всадник
  "rider.core.defensiveRider": {
    label: "Подвергаясь атаке верхом, персонаж может выбрать получать все не-Избирательные попадания в себя вместо распределения между собой и скакуном/…",
    source: "Defensive Rider / Всадник-Защитник", reader: ""
  },
  "rider.core.dragonKnight": {
    label: "Если персонаж и скакун действуют в одну Инициативу, за полудействие он может пройти Survival−10,",
    source: "Dragon Knight / Драконий Рыцарь", reader: ""
  },
  "rider.core.hussar": {
    label: "Совершая Верховую Атаку, персонаж может потратить бонусное верховое полудействие, чтобы провести ещё одну верховую атаку по другой цели на п…",
    source: "Hussar / Гусар", reader: ""
  },
  "rider.core.ironMount": {
    label: "Получив попадание верхом (после Избеганий), персонаж может пройти Operate−10 или Survival−10,",
    source: "Iron Mount / Железный Скакун", reader: ""
  },
  "rider.core.mountSense": {
    label: "Приспособившись к ходу скакуна, оба действуют в Инициативу персонажа, а не наименьшую. Скакун получает бонус на тесты Трудного Ландшафта,",
    source: "Mount Sense / Чувство Скакуна", reader: ""
  },
  "rider.core.roadkill": {
    label: "Успешно проводя Напролом байком, цель всегда сбивается с ног и вместо обычного урона получает 2d10+A.b R Dmg, Pen P.b, Tearing.",
    source: "Roadkill / Переехать", reader: ""
  },
  "rider.core.saddleJump": {
    label: "Персонаж может Оседлать/Спешиться за свободное действие.",
    source: "Saddle Jump / Прыжок в Седло", reader: ""
  },
  "rider.core.skilledRider": {
    label: "Персонаж может перебрасывать тесты, чтобы удержаться в седле. При смерти/сбивании скакуна или байка он может пройти Survival(А)+10 (скакун)…",
    source: "Skilled Rider / Опытный Всадник", reader: ""
  },
  "rider.core.squire": {
    label: "Персонаж не получает штраф −10 на маневрирование за пассажира, а пассажир уменьшает свои штрафы на физические действия верхом на 10.",
    source: "Squire / Оруженосец", reader: ""
  },
  "rider.core.trot": {
    label: "Двигаясь не более SPD в Ход, скакун или байк игнорируют Трудный Ландшафт и не дают штрафов на действия всадника или пассажира.",
    source: "Trot / Рысь", reader: ""
  },
  "rider.core.unstoppableCharge": {
    label: "Когда персонаж верхом совершает Натиск, его рукопашные атаки (но не атаки скакуна/лезвий байка) получают Felling (½WS.b (окр.▲)).",
    source: "Unstoppable Charge / Неостановимый Натиск", reader: ""
  },
  // ── Разбойник
  "rogue.core.backstab": {
    label: "Нанося попадание незримой Избирательной атакой ножом (например, со спины, проведя весь Ход вне поля зрения цели),",
    source: "Backstab / Удар в Спину", reader: ""
  },
  "rogue.core.bladeJuggler": {
    label: "Вооружённый ножом с пустой рукой, раз в Ход за ментальное свободное действие персонаж проходит против противника Deceive(WS)+0 vs Awareness(…",
    source: "Blade Juggler / Жонглер Клинком", reader: ""
  },
  "rogue.core.blindside": {
    label: "Раз в Ход при численном преимуществе персонаж может ментальным свободным действием пройти Stealth(A)+0 vs Awareness(P)+0. При победе,",
    source: "Blindside / Из Слепой Зоны", reader: ""
  },
  "rogue.core.closeQuarters": {
    label: "Если персонаж вооружён ножом, кулаками, когтями и/или пистолетом, противники, начавшие Ход в рукопашной с ним,",
    source: "Close Quarters / Бой Вплотную", reader: ""
  },
  "rogue.core.coupDeGrace": {
    label: "Вооружённый ножом в любом хвате, или мечом/копьём в Ближнем Хвате, и попадая по сочленениям/глазам Оглушённой или Лежащей цели,",
    source: "Coup de Grace / Ку де Гра", reader: ""
  },
  "rogue.core.knifeFighter": {
    label: "Персонаж может перебрасывать броски на урон от ножей, а ножи, наносящие d10 урона, в его руках получают свойство Extreme (9).",
    source: "Knife Fighter / Боец на Ножах", reader: ""
  },
  "rogue.core.razorSEdge": {
    label: "Если Инициатива персонажа выше, чем у цели, при использовании ножей он добавляет разницу в Инициативе к Dmg (максимум +10;",
    source: "Razor's Edge / На Лезвии Бритвы", reader: ""
  },
  "rogue.core.ridingTheMomentum": {
    label: "Персонаж может совершать Уклонение (но не Парирование) со штрафом −10 после Полной Атаки кулаками или ножами в любой комбинации.",
    source: "Riding the Momentum / В Ногу с Моментом", reader: ""
  },
  "rogue.core.sabotage": {
    label: "Персонаж может совершать ножом Избирательные атаки по оружию противника (−10 тяжёлое, −20 винтовки и рукопашное Л+П,",
    source: "Sabotage / Саботаж", reader: ""
  },
  "rogue.core.streetFighting": {
    label: "Нанося Критические Эффекты ножом или кулаками (от Отрицательных Ран или Экстремального Урона),",
    source: "Street Fighting / Уличный Боец", reader: ""
  },
  // ── Крафт
  "craft.core.fabricator": {
    label: "Персонаж удваивает бонусы от инструментов на тесты Крафта и ремонта.",
    source: "Fabricator / Фабрикатор", reader: ""
  },
  "craft.core.hecatoncheires": {
    label: "Персонаж уменьшает время смены для Крафта/ремонта/обслуживания со стандартных 8 часов на 30 минут за каждый утилитарный мехадендрит или допо…",
    source: "Hecatoncheires / Гекатонхейр", reader: ""
  },
  "craft.core.journeyman": {
    label: "Преимущество крафтеру от ассистента-Подмастерья — ИСПРАВЛЕНО (wdbc-1rno): раньше был честный флаг без проверки, теперь Мастерская Крафта несёт assistantId (реальная ссылка на актора) — hasJourneyman(assistantActor) читает его настоящий инвентарь Талантов.",
    source: "Journeyman / Подмастерье",
    reader: "module/rules/craft-advantage.mjs (effectiveDiceMode/hasJourneyman), module/apps/craft-workshop.mjs::_rollShift"
  },
  "craft.core.juryRigging": {
    label: "Персонаж может починить поломку, обычно требующую до ½ смены, за одно полное действие, но уменьшает Качество предмета/машины на 1.",
    source: "Jury Rigging / На Честном Слове", reader: ""
  },
  "craft.core.locum": {
    label: "Занимаясь Крафтом/ремонтом в мастерской, где проработал хотя бы месяц, персонаж за одну смену делает двойную работу (два теста,",
    source: "Locum / Локум", reader: ""
  },
  "craft.core.prototyping": {
    label: "При Крафте уже создававшихся предметов персонаж может перебрасывать тесты Крафта (если уже делал в таком же Качестве) и уменьшает мультиплик…",
    source: "Prototyping / Прототипирование", reader: ""
  },
  "craft.core.safetyPrecautions": {
    label: "Персонаж не теряет Успехи из банка от Критических Провалов на тесты Крафта, а ассистируя другим — те теряют только 1 Успех от своих Критичес…",
    source: "Safety Precautions / Техника Безопасности", reader: ""
  },
  "craft.core.slowShift": {
    label: "+30 и Преимущество за +4ч смены механизировано (wdbc-u0by) — галочка в Мастерской Крафта, видна владельцу Таланта. Сами +4ч на слово стола, время нигде не тикает",
    source: "Slow Shift / Медленная Смена",
    reader: "module/rules/craft-advantage.mjs (slowShiftBonus/effectiveDiceMode), module/apps/craft-workshop.mjs::_rollShift"
  },
  "craft.core.stableBuild": {
    label: "Персонаж может потратить ½ смены работы (без теста), чтобы убрать у предмета в процессе Улучшения обычные штрафы на работу с ним,",
    source: "Stable Build / Стабильная Сборка", reader: ""
  },
  "craft.core.workaholic": {
    label: "Персонаж не получает штрафы за занятие одним и тем же Крафтом несколько смен подряд.",
    source: "Workaholic / Трудоголик", reader: ""
  },
  // ── Оккультист
  "occultist.core.brainwashing": {
    label: "Потратив смену работы и пройдя Interrogate+0 vs W+0 против жертвы, персонаж может заставить её добровольно поучаствовать в одном ритуале (ка…",
    source: "Brainwashing / Промывка Мозгов", reader: ""
  },
  "occultist.core.divineMask": {
    label: "Потратив 15 минут и Очко Бесчестия, персонаж на Cor.b часов считается имеющим покровительство одного из Богов для ритуалов и демонического в…",
    source: "Divine Mask / Божественная Маска", reader: ""
  },
  "occultist.core.dominator": {
    label: "Преимущество на тест Владычества (R.type===\"dominion\", roll×2+keepBest, module/rules/dominator.mjs) — авто, кнопка «Провести ритуал» без доп. диалога.",
    source: "Dominator / Покоритель", reader: "module/apps/ritual-cast.mjs::castRitual"
  },
  "occultist.core.eruditeInfernal": {
    label: "Персонаж игнорирует штрафы за недостаточные знания о призываемом или покоряемом демоне в модификаторах Призыва.",
    source: "Erudite-Infernal / Эрудит-Инфернал", reader: ""
  },
  "occultist.core.fallbacks": {
    label: "Персонаж может вовлечь в ритуал до ½ I.b (окр.▲) запасных ассистентов (без бонуса). Запасной может заменить выбывшего основного.",
    source: "Fallbacks / Запасные Планы", reader: ""
  },
  "occultist.core.gloriousPurpose": {
    label: "При использовании демонического оружия персонаж может использовать свой Inf вместо W или F для всех тестов против демона.",
    source: "Glorious Purpose / Славное Назначение", reader: ""
  },
  "occultist.core.infernalMaster": {
    label: "Персонаж может использовать Forbidden Lore (Daemons)(W) вместо Command в тестах командования демонами, демонхостами,",
    source: "Infernal Master / Инфернальный Владыка", reader: ""
  },
  "occultist.core.instructor": {
    label: "Персонаж может потратить 8 часов на подготовку к ритуалу, чтобы снизить требования к ассистентам на 1 уровень продвижения нужных Навыков (уб…",
    source: "Instructor / Инструктор", reader: ""
  },
  "occultist.core.ritePuzzler": {
    label: "Персонаж может добывать ритуалы, требующие Записи, как если бы их Редкость была на 1 ниже.",
    source: "Rite Puzzler / Разгадыватель Ритуалов", reader: ""
  },
  "occultist.core.scapegoat": {
    label: "Потратив смену работы на ритуальную подготовку другого разумного существа для определённого ритуала, при Успехе цена или цена ошибки,",
    source: "Scapegoat / Козёл Отпущения", reader: ""
  },
  "occultist.core.warprod": {
    label: "Персонаж делает все броски на цену ритуала 2 раза, выбирая один. Ассистируя, главный ритуалист не может переносить на него цену ритуала/пров…",
    source: "Warprod / Варпоотвод", reader: ""
  },
  // ── Внимательность
  "awareness.core.analyticalEye": {
    label: "Персонаж может использовать I вместо P для тестов Awareness, не проводимых как свободное действие,",
    source: "Analytical Eye / Аналитический Взгляд", reader: ""
  },
  "awareness.core.blindFighting": {
    label: "Персонаж уменьшает вдвое штрафы на рукопашные Атаки и Избегания рукопашных атак от слепоты, тьмы и сниженной видимости.",
    source: "Blind Fighting / Бой Вслепую", reader: ""
  },
  "awareness.core.blindsight": {
    label: "Когда персонаж не носит шлем, он получает Трейт Unnatural Senses (P.b). Когда его глаза закрыты или он ослеплён,",
    source: "Blindsight / Слепое Зрение", reader: ""
  },
  "awareness.core.heightenedSenses": {
    label: "Одно из пяти чувств развито лучше: +10 ко всем Тестам, связанным с этим чувством. Усиленные Чувства (Зрение) не даёт бонусов к тестам BS.",
    source: "Heightened Senses / Усиленные Чувства", reader: ""
  },
  "awareness.core.lightSleeper": {
    label: "При тестах на P или Awareness персонаж всегда считается бодрствующим, даже если спит.",
    source: "Light Sleeper / Чуткий Сон", reader: ""
  },
  "awareness.core.lipReading": {
    label: "Если персонаж чётко видит губы другого, он может понять, о чём тот говорит, даже не слыша слов. Тесты обычно не требуются;",
    source: "Lip Reading / Чтение По Губам", reader: ""
  },
  "awareness.core.securityDetail": {
    label: "При любом тесте Awareness для поиска спрятавшихся существ, скрытого оружия, мин, ловушек и т.д.",
    source: "Security Detail / Служба Безопасности", reader: ""
  },
  "awareness.core.sentry": {
    label: "Преимущество на Awareness механизировано (wdbc-u0by, kind:\"reroll\") — появляется опциональной радиокнопкой в ЛЮБОМ тесте Awareness (тот же честный принцип самоподтверждения, что у всех перебросов Локусов): условие «как свободное действие» не проверяется программно, решает игрок/стол",
    source: "Sentry / Часовой",
    reader: "module/rules/item-rules.mjs (kind:\"reroll\" → опциональный переброс в диалоге теста)"
  },
  "awareness.core.sixthSense": {
    label: "Получив попадание с типом Незримое, персонаж может потратить Очко Бесчестия, чтобы Избежать от него как обычно и до начала своего следующего…",
    source: "Sixth Sense / Шестое Чувство", reader: ""
  },
  "awareness.core.taster": {
    label: "Персонаж получает +20 на тесты нюха и +40 на тесты вкуса для распознания ядов. Распознав яд на вкус, он может безопасно его сплюнуть.",
    source: "Taster / Дегустатор", reader: ""
  },
  "awareness.core.thiefcatcher": {
    label: "При Успехе на любом тесте Awareness, чтобы распознать изменённую внешность, слияние с толпой или движения, скрытые Sleight of Hands,",
    source: "Thiefcatcher / Воролов", reader: ""
  },
  // ── Арсенал
  "arsenal.core.ancientWarrior": {
    label: "Персонаж уменьшает Редкость всего Легион снаряжения на 1 и получает +10 на все социальные взаимодействия с обладателями этого Таланта и Косм…",
    source: "Ancient Warrior / Древний Воин", reader: ""
  },
  "arsenal.core.armourTraining": {
    label: "Персонаж увеличивает Max.A этого вида брони на 10 и уменьшает её штраф к А на 5 (если есть).",
    source: "Armour Training / Тренировка в Броне", reader: ""
  },
  "arsenal.core.cursedHeirloom": {
    label: "Персонаж может выбрать получить одно оружие с Редкостью до 4. Оно не может быть уничтожено (в т.ч.",
    source: "Cursed Heirloom / Проклятое Наследство", reader: ""
  },
  "arsenal.core.excessiveWealth": {
    label: "Персонаж получает +10 на тесты Inf для получения снаряжения и тесты Commerce, если тратит время и ресурсы для демонстрации своего богатства…",
    source: "Excessive Wealth / Чрезмерное Богатство", reader: ""
  },
  "arsenal.core.exoticWeaponTraining": {
    label: "Берясь за экзотическое оружие без Таланта на владение им, персонаж получает −20 на соответствующие тесты WS/BS.",
    source: "Exotic Weapon Training / Экзотическая Оружейная Тренировка", reader: ""
  },
  "arsenal.core.giantSArms": {
    label: "Нося силовую броню, персонаж может использовать оружие и снаряжение Легиона без обычных штрафов.",
    source: "Giant's Arms / Оружие Гигантов", reader: ""
  },
  "arsenal.core.lordOfWar": {
    label: "Персонаж уменьшает Редкость всего Экзотического снаряжения и Кибернетики на 1 и получает +20 на тесты Inf для получения снаряжения и тесты C…",
    source: "Lord of War / Повелитель Войны", reader: ""
  },
  "arsenal.core.meleeTraining": {
    label: "Если персонаж не владеет этим Талантом для выбранного оружия, он может использовать только Обычную Атаку как приём,",
    source: "Melee Training / Рукопашная Тренировка", reader: ""
  },
  "arsenal.core.weaponTraining": {
    label: "Персонаж может использовать всё оружие классов выбранной специализации без штрафов. Без Таланта на владение — штраф −20 на соответствующие т…",
    source: "Weapon Training / Оружейная Тренировка", reader: ""
  },
  // ── Скорость
  "speed.core.breacher": {
    label: "Когда персонаж вооружён щитом в одной руке и находится в защитной стойке, он может одним полным действием совершить Полудвижение и Атаку (в…",
    source: "Breacher / Прорыватель", reader: ""
  },
  "speed.core.halfStep": {
    label: "В Ход, когда персонаж не совершает других движений, он может раз за свободное действие подвигаться на до ½ SPD,",
    source: "Half-Step / Полушаг", reader: ""
  },
  "speed.core.jumper": {
    label: "Персонаж может проводить Прыжки за полудействие или как часть Натиска.",
    source: "Jumper / Прыгун", reader: ""
  },
  "speed.core.leapUp": {
    label: "Персонаж может автоматически Встать за свободное действие.",
    source: "Leap Up / Вскочить", reader: ""
  },
  "speed.core.preternaturalSpeed": {
    label: "Персонаж может совершать Натиск на дистанцию Бега.",
    source: "Preternatural Speed / Запредельная Скорость", reader: ""
  },
  "speed.core.quickDraw": {
    label: "Персонаж может Взять метательное оружие, пистолет, винтовку, одноручное рукопашное оружие или одноручный инструмент за свободное действие.",
    source: "Quick Draw / Быстрое Выхватывание", reader: ""
  },
  "speed.core.quickStore": {
    label: "Персонаж может Сложить метательное оружие, пистолет, винтовку, одноручное рукопашное оружие или одноручный инструмент за свободное действие.",
    source: "Quick Store / Быстрое Складывание", reader: ""
  },
  "speed.core.rapidReload": {
    label: "Время перезарядки любого оружия снижается вдвое (окр.▼). Если оружие можно было перезарядить полудействием,",
    source: "Rapid Reload / Быстрая Перезарядка", reader: ""
  },
  "speed.core.reposition": {
    label: "В начале боя сразу после бросков Инициативы персонаж может подвигаться на Полудвижение. Если несколько персонажей имеют этот Талант,",
    source: "Reposition / Смена Позиции", reader: ""
  },
  "speed.core.sprint": {
    label: "Персонаж может совершать Полное Движение на дистанцию Натиска и Бег на двойную дистанцию Бега.",
    source: "Sprint / Спринт", reader: ""
  },
  "speed.core.technicalKnock": {
    label: "Ритуальным обращением и жестами персонаж может провести Расклин за полудействие.",
    source: "Technical Knock / Технический Трюк", reader: ""
  },
  // ── Миньоны
  "minion.core.belovedLeader": {
    label: "Миньоны персонажа получают +10 Лояльности.",
    source: "Beloved Leader / Обожаемый Лидер", reader: ""
  },
  "minion.core.betrayer": {
    label: "Раз в сессию персонаж может убить собственного Миньона, чтобы получить +20 (+10 если Миньон легко заменим) к следующему тесту Inf или восста…",
    source: "Betrayer / Предатель", reader: ""
  },
  "minion.core.cannonFodder": {
    label: "Можно взять несколько раз для каждого Миньона. Миньон теряет 20 Лояльности, но если умирает,",
    source: "Cannon Fodder / Пушечное Мясо", reader: ""
  },
  "minion.core.lordOfChaos": {
    label: "Персонаж увеличивает максимум своих Миньонов на 50% (окр.▼).",
    source: "Lord of Chaos / Лорд Хаоса", reader: ""
  },
  "minion.core.minionOfChaos": {
    label: "Уровень: разный. Можно брать несколько раз, каждый раз даёт персонажу одного Миньона. Цены, требования и создание — в подразделе «Миньоны».",
    source: "Minion of Chaos / Миньон Хаоса", reader: ""
  },
  "minion.core.tyrant": {
    label: "Стартовая Лояльность Миньонов персонажа может использовать Inf.",
    source: "Tyrant / Тиран", reader: ""
  },
  "minion.core.unholyDevotion": {
    label: "Получив попадание, любой Миньон персонажа в пределах Полудвижения может пройти А+0 и получить попадание вместо него (+30,",
    source: "Unholy Devotion / Нечестивая Преданность", reader: ""
  },
  // ── Пилот
  "pilot.core.aceOperator": {
    label: "Персонаж может потратить Очко Бесчестия, чтобы уменьшить число Провалов на вождение техники на A.b, потенциально превращая Провал в Успех,",
    source: "Ace Operator / Ас Оператор", reader: ""
  },
  "pilot.core.dive": {
    label: "Находясь на Высокой высоте, пилот может вместо Виража спуститься на Приземную высоту и избежать всех атак по нему,",
    source: "Dive / Нырок", reader: ""
  },
  "pilot.core.holdHarder": {
    label: "Раз в Раунд персонаж может добавить +20 к тесту Operate на маневры. При Провале машина получает Критический Эффект 1d5 в Шасси.",
    source: "Hold Harder! / Держитесь!", reader: ""
  },
  "pilot.core.hotshotPilot": {
    label: "Персонаж может водить технику ксеносов и совершенно незнакомые модели техники со штрафом −10 без всякого обучения.",
    source: "Hotshot Pilot / Искусный Пилот", reader: ""
  },
  "pilot.core.jink": {
    label: "Тратя Очко Бесчестия на переброс Виража или Уклонения шагохода, персонаж делает второй бросок без штрафов за Размер машины и отрицательную М…",
    source: "Jink / Манёвр Уклонения", reader: ""
  },
  "pilot.core.pedalToMetal": {
    label: "Водитель может увеличить SPD машины на свой P.b, но в этот Ход машина не может поворачивать и до начала следующего Хода водителя не может со…",
    source: "Pedal to Metal / Педаль в Пол", reader: ""
  },
  "pilot.core.pushTheLimit": {
    label: "Раз в Раунд персонаж может добавить +10 к тесту Operate на маневры. При Провале техника получает 1 непоглощаемого урона в Шасси за каждый Пр…",
    source: "Push the Limit / Преодолеть Предел", reader: ""
  },
  "pilot.core.putThatOut": {
    label: "За полное действие персонаж может потушить Пожар в машине, получив 1 Усталости и 1d10 E(Fl) Dmg, игнорирующего броню.",
    source: "Put That Out! / Гаси Это!", reader: ""
  },
  "pilot.core.rollWithIt": {
    label: "Персонаж может Уклоняться от эффектов аварий, действующих на экипаж, как от обычных атак. Успешно уклонившись от взрыва боекомплекта,",
    source: "Roll With It / Выдержи", reader: ""
  },
  "pilot.core.screechingSteel": {
    label: "Персонаж может стрелять из орудий с поломкой «Орудие Заклинило», как если бы её не было,",
    source: "Screeching Steel / С Визгом Стали", reader: ""
  },
  "pilot.core.senseOfBalance": {
    label: "Когда Шагоход получает эффект Опрокидывание, пилот может пройти Operate(P)−10, чтобы отменить его и устоять на ногах.",
    source: "Sense of Balance / Чувство Баланса", reader: ""
  },
  "pilot.core.tankAce": {
    label: "Персонаж может использовать Таланты группы Стрелок на орудии, которым управляет лично, а как командир машины — передать до ½ I.b (окр.",
    source: "Tank Ace / Танковый Ас", reader: ""
  },
  "pilot.core.tankCommander": {
    label: "Когда персонаж занимает станцию командира машины, весь экипаж может действовать в Инициативу командира,",
    source: "Tank Commander / Танковый Командир", reader: ""
  },
  // ── Два оружия
  "dualWield.core.allGunsBlazing": {
    label: "Делая две атаки короткой/длинной очередью по одной цели, та проходит тест на Подавление+0. Если обе атаки длинной очередью — Подавление−20.",
    source: "All Guns Blazing / Огонь из Всех Орудий", reader: ""
  },
  "dualWield.core.ambidextrous": {
    label: "Персонаж не получает штраф −20 за использование оружия в неосновной руке и уменьшает штраф за парное оружие на 10.",
    source: "Ambidextrous / Амбидекстр", reader: ""
  },
  "dualWield.core.bladeDancer": {
    label: "Персонаж уменьшает штраф за парные мечи на 10.",
    source: "Blade Dancer / Танцор с Клинками", reader: ""
  },
  "dualWield.core.brawler": {
    label: "Персонаж уменьшает штраф за парное оружие для атак кулаками на 10.",
    source: "Brawler / Боксёр", reader: ""
  },
  "dualWield.core.crossblock": {
    label: "Вооружённый двумя рукопашными оружиями с Балансом не ниже 0, персонаж может Парировать атаки существ на 1 Размер больше обычного и суммирует…",
    source: "Crossblock / Крестовой Блок", reader: ""
  },
  "dualWield.core.fanOfKnives": {
    label: "Персонаж уменьшает штраф за парное метательное оружие на 10.",
    source: "Fan of Knives / Веер Ножей", reader: ""
  },
  "dualWield.core.gunGuard": {
    label: "Вооружённый рукопашным оружием с Балансом не ниже −1 и винтовкой, выстрелы из неё в рукопашной не получают бонуса +30 на Избегание.",
    source: "Gun Guard / Винтовочная Гарда", reader: ""
  },
  "dualWield.core.gunslinger": {
    label: "Персонаж уменьшает штраф за парные пистолеты на 10.",
    source: "Gunslinger / Македонец", reader: ""
  },
  "dualWield.core.independentTargeting": {
    label: "Цели стрельбы персонажа с двух оружий могут быть на расстоянии более 10м друг от друга.",
    source: "Independent Targeting / Независимое Прицеливание", reader: ""
  },
  "dualWield.core.maineGauche": {
    label: "Вооружённый двумя оружиями, одно из которых нож, и не использовав этот нож для атаки в предыдущий Ход,",
    source: "Maine-Gauche / Мэн-Гош", reader: ""
  },
  "dualWield.core.pounder": {
    label: "Вооружённый парой топоров, булав, молотов или их комбинацией, когда противник успешно Парирует каждое попадание этого оружия,",
    source: "Pounder / Молотильщик", reader: ""
  },
  "dualWield.core.savage": {
    label: "Вооружённый парными когтями, персонаж может перебрасывать одну неудачную атаку ими в Ход и получает +2 Успеха при успешной атаке.",
    source: "Savage / Дикарь", reader: ""
  },
  "dualWield.core.sidearm": {
    label: "Персонаж уменьшает штраф за парное оружие на 10, если одно из них — пистолет, а второе — рукопашное.",
    source: "Sidearm / Запасной Ствол", reader: ""
  },
  "dualWield.core.sideblade": {
    label: "Персонаж уменьшает штраф за парное оружие на 10, если одно из них — нож.",
    source: "Sideblade / Запасной Клинок", reader: ""
  },
  "dualWield.core.twoWeaponWielder": {
    label: "Персонаж может совершать атаки с обеих рук как одну атаку, занимающую наибольшее действие из двух, но эти атаки получают −20.",
    source: "Two Weapon Wielder / Два Оружия", reader: ""
  },
  // ── Пси-стойкость
  "psyResist.core.aetherCocoon": {
    label: "За каждую действующую на него психосилу (Вливания, Изменения, Ауры, Призывы с зонами влияния) персонаж уменьшает штраф к W от Daemonic Prese…",
    source: "Aether Cocoon / Эфирный Кокон", reader: ""
  },
  "psyResist.core.bastionOfIronWill": {
    label: "Персонаж получает +тPR×5 на любые встречные тесты против психосил.",
    source: "Bastion of Iron Will / Бастион Железной Воли", reader: ""
  },
  "psyResist.core.defiance": {
    label: "Преимущество механизировано (wdbc-u0by, kind:\"reroll\", scope:\"all\") — опциональная радиокнопка на ЛЮБОМ тесте, шире книги (не сужено ни до встречных тестов, ни тем более до психосил/выжигания/одержимости от Ненавистных) — честное самоподтверждение игроком. Область \"opposed\" оказалась мёртвой (effectAppliesTo её не матчит нигде в конвейере, ctx.kind никогда не бывает \"opposed\" — «Вид: Встречный» это отдельный параметр исхода теста, не контекст правил), заменена на рабочую \"all\"",
    source: "Defiance / Неповиновение",
    reader: "module/rules/item-rules.mjs (kind:\"reroll\" → опциональный переброс в диалоге теста)"
  },
  "psyResist.core.divineProtection": {
    label: "Раз в Раунд, получая эффект психосилы, демонического дара, варп-оружия, выжигания души или иной полагающийся на Варп эффект,",
    source: "Divine Protection / Божественная Защита", reader: ""
  },
  "psyResist.core.donTTrustYourEyes": {
    label: "Подвергаясь психосиле, изменяющей восприятие, ГМ тайно проходит за персонажа Awareness−10; при Успехе персонаж узнаёт,",
    source: "Don't Trust Your Eyes / Не Верь Глазам Своим", reader: ""
  },
  "psyResist.core.forsaken": {
    label: "Связанные и несвязанные псайкеры получают −10 на тесты психосил, действующих только на этого персонажа,",
    source: "Forsaken / Отверженный", reader: ""
  },
  "psyResist.core.gazeIntoAbyss": {
    label: "Персонаж получает на 1 Порчи меньше от эффектов Феноменов, Прорывов, Варп-Шока, Отвращения Варпа, Психосил и Атаки Одержимостью.",
    source: "Gaze Into Abyss / Взгляд в Бездну", reader: ""
  },
  "psyResist.core.infernalFamiliarity": {
    label: "Персонаж считает всех демонов имеющими Рейтинг Страха на 1 ниже настоящего и уменьшает штраф к W от Трейта Daemonic Presence на 5.",
    source: "Infernal Familiarity / Инфернальное Знакомство", reader: ""
  },
  "psyResist.core.neuralTriggers": {
    label: "Когда персонаж вынужден действовать против своей воли (контроль разума/тела/бионики, чуждые эмоции, паразитический контроль,",
    source: "Neural Triggers / Нейральные Триггеры", reader: ""
  },
  "psyResist.core.orthoproxy": {
    label: "Персонаж получает +20 на тесты сопротивления контролю разума и допросу.",
    source: "Orthoproxy / Ортопрокси", reader: ""
  },
  "psyResist.core.psychicCollapse": {
    label: "За полудействие псайкер может развеять психосилу, что поддерживал на себе/оружии (поддержание которой уменьшает его тPR),",
    source: "Psychic Collapse / Психический Обвал", reader: ""
  },
  "psyResist.core.shieldOfContempt": {
    label: "Потратив 1 ОБ и 5 минут на ритуал, персонаж обязан каждый раз, когда на него нацелена психосила (полезная или вредная), пройти W+0.",
    source: "Shield of Contempt / Щит Презрения", reader: ""
  },
  "psyResist.core.solipsism": {
    label: "Персонаж может перебрасывать все встречные тесты против психосил (кроме непрямых), одержимости или выжигания души.",
    source: "Solipsism / Солипсизм", reader: ""
  },
  "psyResist.core.strongMinded": {
    label: "Персонаж может перебрасывать встречные тесты против психосил и прочих основанных на Варпе эффектов, влияющих на его разум.",
    source: "Strong Minded / Непреклонный", reader: ""
  },
  "psyResist.core.witchfinder": {
    label: "Персонаж может перебрасывать неудачные тесты Awareness на засекание проявления психосил и тесты Forbidden Lore (Psykers) для распознания пси…",
    source: "Witchfinder / Ведьмоискатель", reader: ""
  },
  // ── Техномистик
  "technomystic.core.apocryphaCoil": {
    label: "Персонаж может установить в себя ещё одну Катушку Потенции (добывается отдельно). Её заряды нельзя использовать напрямую,",
    source: "Apocrypha Coil / Катушка Апокрифа", reader: ""
  },
  "technomystic.core.cloudCognition": {
    label: "Подключённый к Ноосфере, раз в Ход за свободное действие персонаж может пройти Tech-Use(I)+0,",
    source: "Cloud Cognition / Облачная Когниция", reader: ""
  },
  "technomystic.core.decompile": {
    label: "Засекая Ноосферным Сканированием неизвестное себе Техночудо, персонаж может потратить 1 Когницию, чтобы распознать его,",
    source: "Decompile / Декомпиляция", reader: ""
  },
  "technomystic.core.digitalHatred": {
    label: "Персонаж уменьшает цену активации (но не Процессов) своих негативно воздействующих Техночудес на 1 Когницию,",
    source: "Digital Hatred / Цифровая Ненависть", reader: ""
  },
  "technomystic.core.digitalRevelation": {
    label: "Персонаж уменьшает суммарную цену всех своих Процессов на 1 Когницию. Можно брать до 3 раз (2-й требует For.Lore (Mechanicum)+20,",
    source: "Digital Revelation / Цифровое Откровение", reader: ""
  },
  "technomystic.core.electrovigour": {
    label: "Преимущество на тест Компенсатора (roll×2 + keepBest, module/rules/electrovigour.mjs) — авто, кнопка активации без диалога.",
    source: "Electrovigour / Электрорвение", reader: "module/sheets/tabs/tech.mjs::activateTechMiracle"
  },
  "technomystic.core.glimpseOfOmniscience": {
    label: "Персонаж может потратить 1 Когницию, чтобы перебросить тест Ноосферного Сканирования.",
    source: "Glimpse of Omniscience / Проблеск Всеведенья", reader: ""
  },
  "technomystic.core.motiveEucharist": {
    label: "Подключаясь Электу-Индукторами к портам другого техножреца, раз в Ход за свободное действие персонаж может передать до 3 Когниции любому сог…",
    source: "Motive Eucharist / Мотивное Причастие", reader: ""
  },
  "technomystic.core.noosphericPiety": {
    label: "Персонаж уменьшает суммарную стоимость Процессов своих скомпилированных Славословий на 1 Когницию (только готовых к активации,",
    source: "Noospheric Piety / Ноосферная Набожность", reader: ""
  },
  "technomystic.core.omnimnesis": {
    label: "Персонаж может потратить 1 Когницию, чтобы перебросить тест I на активацию Техночуда или любой встречный тест I против чужого техночуда.",
    source: "Omnimnesis / Омнимнезис", reader: ""
  },
  "technomystic.core.overclock": {
    label: "Раз в Ход за свободное действие персонаж может потратить 1 Когницию, чтобы восстановить себе до I.b Когниции,",
    source: "Overclock / Разгон", reader: ""
  },
  "technomystic.core.powerCache": {
    label: "Персонаж увеличивает максимальный заряд Катушки Потенции на ½I.b (окр.▲). Не действует на Катушку Апокрифу.",
    source: "Power Cache / Силовой Заряд", reader: ""
  },
  "technomystic.core.recompile": {
    label: "За ментальное полудействие персонаж может потратить 1 Когницию, чтобы заменить одно скомпилированное Славословие другим равного или меньшего…",
    source: "Recompile / Рекомпиляция", reader: ""
  },
  "technomystic.core.virtualMemory": {
    label: "Подключённый к Ноосфере, персонаж увеличивает максимум Когниции на 2 (при отключении «лишняя» теряется).",
    source: "Virtual Memory / Виртуальная Память", reader: ""
  },
  "technomystic.core.votiveMass": {
    label: "Персонаж может скомпилировать Славословие за полное ментальное действие вместо <Рейтинг>×5 минут, потратив <Рейтинг>×4 Когниции.",
    source: "Votive Mass / Вотивная Месса", reader: ""
  },
  // ── Механикум
  "mechanicum.core.binaryDominion": {
    label: "Персонаж может использовать Tech-Use вместо Command в тестах командования сервиторами, роботами и Скитариями,",
    source: "Binary Dominion / Бинарное Владычество", reader: ""
  },
  "mechanicum.core.binaryFlock": {
    label: "Персонаж может брать миньонов-людей с Латами Скитарии или Трейтом Mechanicum Implants как Миньонов-машин (в расчёте требований и максимума М…",
    source: "Binary Flock / Бинарная Паства", reader: ""
  },
  "mechanicum.core.blessingOfSteel": {
    label: "Потратив 5 минут на ритуал, персонаж может благословить оружие или набор брони, увеличив их Качество на 1 до конца следующего боя.",
    source: "Blessing of Steel / Благословение Стали", reader: ""
  },
  "mechanicum.core.calculusLogi": {
    label: "Персонаж может перебрасывать тесты на Logic, способен невероятно быстро подсчитывать вещи в поле зрения и проводить сложные вычисления в уме…",
    source: "Calculus Logi / Калькулюс Логи", reader: ""
  },
  "mechanicum.core.cyberMantleCalibration": {
    label: "Персонаж увеличивает максимум своих мехадендритов на 1. Можно брать до I.b раз.",
    source: "Cyber-Mantle Calibration / Калибровка Кибер-Мантии", reader: ""
  },
  "mechanicum.core.cyberneticExcellence": {
    label: "Персонаж может установить дополнительную бионическую руку, получая Трейт Multiple Arms (+1). Можно брать до ½I.b+1 (окр.▼) раз.",
    source: "Cybernetic Excellence / Кибернетическое Превосходство", reader: ""
  },
  "mechanicum.core.cyberneticRebirth": {
    label: "Персонаж получает Трейт Machine(2).",
    source: "Cybernetic Rebirth / Кибернетическое Перерождение", reader: ""
  },
  "mechanicum.core.cyberpreacher": {
    label: "Преимущество на тесты категории «Бионика и Мехадендриты» механизировано (wdbc-u0by, автоматически, без галочки). Уменьшение вдвое времени восстановления после операции — не механизировано: пост-операционное восстановление не часть резолва Крафта",
    source: "Cyberpreacher / Киберпроповедник",
    reader: "module/rules/craft-advantage.mjs (cyberpreacherApplies/effectiveDiceMode), module/apps/craft-workshop.mjs::_rollShift"
  },
  "mechanicum.core.fleshIsWeak": {
    label: "Персонаж увеличивает рейтинг Трейта Machine на 1. Можно брать до ½I.b (окр.▲) раз.",
    source: "Flesh is Weak / Плоть Слаба", reader: ""
  },
  "mechanicum.core.fleshmetal": {
    label: "Несмотря на Трейт Machine, персонаж может лечиться как органическое существо, получать эффекты Биомантии, есть,",
    source: "Fleshmetal / Плотеметалл", reader: ""
  },
  "mechanicum.core.infiniteOptimization": {
    label: "Персонаж может заменить любую свою бионику/кибернетику одноимённой другого Качества/Вариации за 1 минуту без теста.",
    source: "Infinite Optimization / Бесконечная Оптимизация", reader: ""
  },
  "mechanicum.core.ironGarden": {
    label: "Если у персонажа несколько одноимённых мехадендритов, он может атаковать ими в рукопашной как одним оружием со свойством Multi-strike (X),",
    source: "Iron Garden / Железный Сад", reader: ""
  },
  "mechanicum.core.masterEngineseer": {
    label: "Персонаж получает +10 к Tech-Use на Крафт и ремонт. Может потратить Очко Бесчестия, чтобы автоматически преуспеть в расширенном тесте Tech-U…",
    source: "Master Engineseer / Мастер-Технопровидец", reader: ""
  },
  "mechanicum.core.mechadendriteUse": {
    label: "Персонаж получил обучение, посвящение и гипнонаставление по использованию конкретного типа мехадендритов.",
    source: "Mechadendrite Use / Использование Мехадендритов", reader: ""
  },
  "mechanicum.core.steelRatio": {
    label: "Персонаж увеличивает максимальное количество изучения Таланта Sound Constitution на I.b.",
    source: "Steel Ratio / Стальное Сечение", reader: ""
  },
  "mechanicum.core.testudo": {
    label: "За смену работы (без теста) персонаж может модифицировать щит для установки на мехадендрите (Manipulator, Technical, Plasma Cutter,",
    source: "Testudo / Тестудо", reader: ""
  },
  // ── Пугилист
  "pugilist.core.chokehold": {
    label: "Сжать персонажа наносит цели 1 Усталости, Заломить — 1 Усталости за Успех победы (или 1 даже при проигрыше).",
    source: "Chokehold / Удушение", reader: ""
  },
  "pugilist.core.flyingKick": {
    label: "В Раунд, когда персонаж совершает Натиск в полёте или дерётся в воздухе с летающим противником,",
    source: "Flying Kick / Пинок с Полёта", reader: ""
  },
  "pugilist.core.goadingStrike": {
    label: "Совершая атаку кулаком, персонаж может дать ей −20, чтобы при Успехе (даже при Избегании) сразу провести против цели Давление за свободное д…",
    source: "Goading Strike / Направляющий Удар", reader: ""
  },
  "pugilist.core.haymaker": {
    label: "При атаке кулаком (до броска) персонаж может отказаться от атаки второй рукой в этот Ход, чтобы дать атаке +½ T.b Dmg;",
    source: "Haymaker / Тяжёлый Хук", reader: ""
  },
  "pugilist.core.headcracker": {
    label: "При безоружном ударе головой (не рогами) персонаж уменьшает штраф на Избирательные атаки в голову на 20 и не считает их ментальными,",
    source: "Headcracker / Головолом", reader: ""
  },
  "pugilist.core.jockey": {
    label: "Персонаж может совершать Захват против целей крупнее себя через Acrobatics(A) вместо Athletics(S), игнорируя штрафы за разницу Размеров,",
    source: "Jockey / Жокей", reader: ""
  },
  "pugilist.core.kneeStrike": {
    label: "Успешно взяв цель в Захват 2+ руками, персонаж может немедленно нанести автоматическое попадание ногой, которой ещё не атаковал,",
    source: "Knee Strike / Удар с Колена", reader: ""
  },
  "pugilist.core.pinDown": {
    label: "Держа врага в Борьбе 2+ руками, раз в Ход за свободное действие персонаж может провести Сжать,",
    source: "Pin Down / Прижать", reader: ""
  },
  "pugilist.core.pounce": {
    label: "Успешно проведя Захват с базой Натиск и победив во встречном Athletics на 3+ Успеха, персонаж может немедленно за свободное действие провест…",
    source: "Pounce / Наскок", reader: ""
  },
  "pugilist.core.rollingWithPunches": {
    label: "Персонаж увеличивает поглощение против безоружных атак на +½A.b, если не Оглушён, Беспомощен и атака не Незримая.",
    source: "Rolling With Punches / Скользить за Ударами", reader: ""
  },
  "pugilist.core.roundhouseKick": {
    label: "Попадая по цели равного/меньшего Размера ударом ногой с Натиска (или если её Парируют, но не Уклоняются),",
    source: "Roundhouse Kick / Пинок с Разворота", reader: ""
  },
  "pugilist.core.slam": {
    label: "Взяв цель в Захват и победив во встречном Athletics на 5+ Успехов при достаточном весе подъёма,",
    source: "Slam / Швырнуть", reader: ""
  },
  "pugilist.core.thunderCharge": {
    label: "Проводя Напролом, противники, проигравшие во встречном тесте, всегда сбиваются с ног и получают урон, как если бы проиграли на 5+ Провалов.",
    source: "Thunder Charge / Громовой Натиск", reader: ""
  },
  "pugilist.core.unarmedMaster": {
    label: "Безоружные атаки персонажа теряют Primitive, он считается вооружённым при парировании голыми руками, его Захват нельзя Парировать,",
    source: "Unarmed Master / Безоружный Мастер", reader: ""
  },
  "pugilist.core.whack": {
    label: "Персонаж может совершать безоружные атаки руками, в которых держит одноручное рукопашное оружие (кроме П+Л). Противники,",
    source: "Whack / Затрещина", reader: ""
  },
  "pugilist.core.wrestler": {
    label: "Раз в Ход персонаж может перебросить любой тест на Борьбу, проведение Захвата или Уклонение от вражеского Захвата. Противники,",
    source: "Wrestler / Борец", reader: ""
  },
  // ── Берсерк
  "berserker.core.battleRage": {
    label: "В Ярости персонаж может совершать Парирование. Кроме того, когда Ярость движет его в почти верную гибель,",
    source: "Battle Rage / Боевой Гнев", reader: ""
  },
  "berserker.core.berserkCharge": {
    label: "Персонаж получает ещё +10 на рукопашные приёмы при Натиске.",
    source: "Berserk Charge / Натиск Берсерка", reader: ""
  },
  "berserker.core.coldFury": {
    label: "Персонаж может свободно говорить и совершать ментальные действия в Ярости и не получает штрафа к F от Ярости;",
    source: "Cold Fury / Холодная Ярость", reader: ""
  },
  "berserker.core.fireInBlood": {
    label: "Персонаж может войти в Ярость за полудействие.",
    source: "Fire in Blood / Огонь в Крови", reader: ""
  },
  "berserker.core.focusedWrath": {
    label: "Используя Очко Бесчестия для рукопашной атаки по Ненавистной цели, персонаж усиливает эффект: Усиление +20 вместо +10;",
    source: "Focused Wrath / Сфокусированный Гнев", reader: ""
  },
  "berserker.core.frenzy": {
    label: "За полное действие персонаж входит в боевую ярость: +10 к WS, S и W; −20 на все тесты BS, I и F; игнорирует −10 от Усталости;",
    source: "Frenzy / Ярость", reader: "module/combat/frenzy.mjs — только лимит повторного входа за бой (wdbc-sk8s), остальное не смоделировано"
  },
  "berserker.core.furiousAssault": {
    label: "После успешной атаки с базой Полная Атака (даже отменённой Избеганием) персонаж может потратить Реакцию,",
    source: "Furious Assault / Яростный Штурм", reader: ""
  },
  "berserker.core.hammerBlow": {
    label: "Атакой с базой Полная Атака персонаж добавляет +½WS.b (окр.▲) Pen и свойство Concussive (2) своему рукопашному оружию.",
    source: "Hammer Blow / Удар Молота", reader: ""
  },
  "berserker.core.hatred": {
    label: "Цели, против которых у персонажа есть этот Талант (Ненавистные), дают ему +10 на рукопашные атаки по ним;",
    source: "Hatred / Ненависть", reader: ""
  },
  "berserker.core.killingStrike": {
    label: "Атакой с базой Полная Атака персонаж может потратить Очко Бесчестия, чтобы любые тесты на Избегание от неё авто-проваливались.",
    source: "Killing Strike / Смертельный Удар", reader: ""
  },
  "berserker.core.mentalRage": {
    label: "Когда персонаж в Ярости, любой псайкер или демон, решивший воздействовать на его разум, получает Ступор на 1 Раунд,",
    source: "Mental Rage / Ментальный Гнев", reader: ""
  },
  "berserker.core.oneWillGoDown": {
    label: "Атакой с базой Полная Атака по Ненавистной цели персонаж может удвоить её Dmg (до Поглощения).",
    source: "One Will Go Down / Один Из Нас Падёт", reader: ""
  },
  "berserker.core.overpower": {
    label: "Атакой с базой Полная Атака персонаж может пройти S+0 vs S+0 после успешного парирования этой атаки врагом,",
    source: "Overpower / Пересилить", reader: ""
  },
  "berserker.core.recklessCharge": {
    label: "Проводя Натиск, персонаж может скомбинировать его с Полной Атакой, получив все бонусы и штрафы последней вместо бонусов Натиска.",
    source: "Reckless Charge / Безрассудный Натиск", reader: ""
  },
  "berserker.core.reprise": {
    label: "После успешной дополнительной атаки от Furious Assault (даже отменённой Избеганием) персонаж может тратить оставшиеся Реакции на Парирование…",
    source: "Reprise / Реприз", reader: ""
  },
  "berserker.core.ridingTheBeast": {
    label: "В Ярости персонаж может пройти W+0, чтобы направить свои атаки на цель по своему выбору вместо ближайшего видимого врага.",
    source: "Riding the Beast / Верхом на Звере", reader: ""
  },
  "berserker.core.vengeance": {
    label: "Убивая лидера/чемпиона Ненавистного врага в рукопашной, персонаж восстанавливает 1 Очко Бесчестия (1d5,",
    source: "Vengeance / Месть", reader: ""
  },
  "berserker.core.woundedBeast": {
    label: "Если персонаж легко ранен, он увеличивает бонусы к WS и S от Ярости до +15; если тяжело или критически ранен — до +20.",
    source: "Wounded Beast / Раненный Зверь", reader: ""
  },
  // ── Социальные
  "social.core.balefulDirge": {
    label: "Действие: Свободное (Физическое, Ментальное). До начала следующего Хода персонажа все существа в 30м, слышащие его,",
    source: "Baleful Dirge / Мрачный Плач", reader: ""
  },
  "social.core.cluesFromTheCrowds": {
    label: "Персонаж может потратить сутки на расспрос в толпах мира-улья. Целенаправленные поиски дают +10 к тестам Inquiry.",
    source: "Clues from the Crowds / Разговор с Толпой", reader: ""
  },
  "social.core.coldHearted": {
    label: "Любые попытки соблазнения против персонажа автоматически проваливаются, и он получает +20 на встречные тесты W против Charm.",
    source: "Cold Hearted / Ледяное Сердце", reader: ""
  },
  "social.core.contactNetwork": {
    label: "Используя Сеть Контактов, персонаж может использовать F вместо Inf для тестов Реквизиции, делая бросок по каждому миру с ячейкой отдельно,",
    source: "Contact Network / Сеть Контактов", reader: ""
  },
  "social.core.coverUp": {
    label: "Персонаж может потратить Inf (Характеристику, не Очки), чтобы организовать ячейку тайных агентов с сетью информаторов. Inf 1 → ср.",
    source: "Cover Up / Работа под Прикрытием", reader: ""
  },
  "social.core.demagogue": {
    label: "Персонаж может воздействовать на до F.b×100 персонажей одновременно своими речами.",
    source: "Demagogue / Демагог", reader: ""
  },
  "social.core.disturbingVoice": {
    label: "Персонаж получает +10 на тесты Intimidate, но −10 на все социальные взаимодействия (кроме запугивания) с пугливыми персонажами (большинство…",
    source: "Disturbing Voice / Пугающий Голос", reader: ""
  },
  "social.core.enemy": {
    label: "Уровень: 1–3. Персонаж получает −10 ко всем социальным взаимодействиям с этой группой за уровень Таланта.",
    source: "Enemy / Враг", reader: ""
  },
  "social.core.faceInACrowd": {
    label: "Персонаж может использовать F вместо A для тестов на Stealth в людных местах.",
    source: "Face in a Crowd / Лицо в Толпе", reader: ""
  },
  "social.core.goodReputation": {
    label: "Персонаж получает ещё +10 к тестам при работе с этой группой.",
    source: "Good Reputation / Хорошая Репутация", reader: ""
  },
  "social.core.inspireWrath": {
    label: "За Полное Действие персонаж может пройти Charm+0, чтобы дать аудитории Талант Hatred против определённой группы. Воздействует на до F.",
    source: "Inspire Wrath / Вдохновить Гнев", reader: ""
  },
  "social.core.mimic": {
    label: "Изучив тембр голоса цели как минимум час, персонаж может сойти за неё через встречный Deceive+0 vs Scrutiny−10 (или Scrutiny+0,",
    source: "Mimic / Мимик", reader: ""
  },
  "social.core.peer": {
    label: "Персонаж получает +10 ко всем социальным взаимодействиям с выбранной группой.",
    source: "Peer / Связи", reader: ""
  },
  "social.core.pityTheWeak": {
    label: "Персонаж получает +10 на Command, Commerce, Deceive и Intimidate против целей слабее его в данной ситуации,",
    source: "Pity the Weak / Жалкие Слабаки", reader: ""
  },
  "social.core.polyglot": {
    label: "Пройдя Trade (Linguist)(I)−10, персонаж может понимать на базовом уровне незнакомые языки и проводить на них простейшие беседы.",
    source: "Polyglot / Полиглот", reader: ""
  },
  "social.core.unremarkable": {
    label: "Попытки идентифицировать персонажа среди других людей, описать его приметы или вспомнить черты лица выполняются со штрафом −20.",
    source: "Unremarkable / Непримечательный", reader: ""
  },
  "social.core.ventriloquist": {
    label: "Персонаж может говорить, не открывая рта, и даже проецировать свой голос, чтобы казалось, что он исходит из точки в пределах 2 м.",
    source: "Ventriloquist / Чревовещатель", reader: ""
  },
  "social.core.warCry": {
    label: "В начале Хода персонаж может как Свободное действие провести боевой клич и получить рейтинг Страха 1 (или +1 к текущему) до начала следующег…",
    source: "War Cry / Боевой Клич", reader: ""
  },
  // ── Оружейник
  "weaponsmith.core.batpackDump": {
    label: "Из лаз-оружия с модификацией Power Setting персонаж может провести длинную очередь с RoF 10, дав оружию +1d10 Dmg и свойство Storm(2).",
    source: "Batpack Dump / Выпуск Батареи", reader: ""
  },
  "weaponsmith.core.bolterDrill": {
    label: "Успешные тесты персонажа на стрельбу Болт оружием получают +1 Успех.",
    source: "Bolter Drill / Болтерная Муштра", reader: ""
  },
  "weaponsmith.core.fanning": {
    label: "Вооружённый револьвером в одной руке со свободной второй, персонаж может использовать револьвер в режиме длинной очереди с модификатором +0…",
    source: "Fanning / Быстрый Курок", reader: ""
  },
  "weaponsmith.core.fieldAssembly": {
    label: "За полное действие персонаж может пересобрать один пистолет, винтовку или дл. винтовку, поменяв штык, прицел или комби-подствольник.",
    source: "Field Assembly / Полевая Сборка", reader: ""
  },
  "weaponsmith.core.galvanicResonance": {
    label: "Попадая в цель из Гальванического оружия после любого прицеливания, персонаж узнаёт расчётные Т.b,",
    source: "Galvanic Resonance / Гальванический Резонанс", reader: ""
  },
  "weaponsmith.core.igniter": {
    label: "При Избирательном выстреле из Фосфорного оружия оно получает доп. эффекты по цели: Голова — Blinding игнорирует визоры/авточувства;",
    source: "Igniter / Поджигатель", reader: ""
  },
  "weaponsmith.core.irradiate": {
    label: "При стрельбе из Рад оружия персонаж может (до броска) либо удвоить рейтинг его свойства Felling,",
    source: "Irradiate / Облучить", reader: ""
  },
  "weaponsmith.core.lensTuning": {
    label: "Потратив 5 минут на настройку лаз-оружия, персонаж даёт ему I.b зарядов. Любой атакой он может потратить 1 заряд,",
    source: "Lens Tuning / Настройка Линз", reader: ""
  },
  "weaponsmith.core.litanyOfCleaning": {
    label: "Тратя хотя бы 30 минут в сутки на тщательную чистку и смазывание оружия выбранного типа,",
    source: "Litany of Cleaning / Литания Чистки", reader: ""
  },
  "weaponsmith.core.meltdown": {
    label: "Имея лаз-оружие с улучшением Power Setting и металлический нож, за полудействие персонаж проходит Tech-Use+10.",
    source: "Meltdown / Расплавление", reader: ""
  },
  "weaponsmith.core.needlestorm": {
    label: "Персонаж может совершать Стрельбу на Подавление из Флешетного и Иглового оружия за полудействие вместо полного действия.",
    source: "Needlestorm / Иглошторм", reader: ""
  },
  "weaponsmith.core.plasmaExpertise": {
    label: "Плазменное оружие со свойством Overheats увеличивает Надёжность на 1 в руках персонажа.",
    source: "Plasma Expertise / Эксперт Плазмы", reader: ""
  },
  "weaponsmith.core.plasmaMastery": {
    label: "При стрельбе из плазменного оружия с активированным Maximal оно получает ещё +2 к Dmg, Pen, и персонаж может дать +2 к радиусу Blast.",
    source: "Plasma Mastery / Мастерство Плазмы", reader: ""
  },
  "weaponsmith.core.shocker": {
    label: "Попадая Избирательной атакой Гальванического оружия в голову (не в глаза/сочленения шеи), это попадание получает свойство Shocking.",
    source: "Shocker / Шокер", reader: ""
  },
  "weaponsmith.core.sparks": {
    label: "Попадая Дуговым оружием, персонаж бросает 2d10 и может заменить один из кубиков урона оружия или кубик свойства Haywire на больший из этих д…",
    source: "Sparks / Искры", reader: ""
  },
  "weaponsmith.core.tandem": {
    label: "За ¼ смены персонаж может встроить пистолет или винтовку в тяжёлое оружие, что позволяет стрелять любым из двух профилей.",
    source: "Tandem / Тандем", reader: ""
  },
  "weaponsmith.core.wallop": {
    label: "При Избирательном выстреле с короткой дистанции или ближе из оружия со свойством Scatter оно получает Concussive на первое попадание (после…",
    source: "Wallop / Трепка", reader: ""
  },
  "weaponsmith.core.weaponTech": {
    label: "Персонаж может увеличить Dmg и Pen плазменного, мельта или экзотического стрелкового оружия на I.b.",
    source: "Weapon-Tech / Тех-Оружейник", reader: ""
  },
  "weaponsmith.core.welder": {
    label: "Попадая Избирательной атакой из оружия со свойством Melta по машине и нанося непоглощённый урон,",
    source: "Welder / Сварщик", reader: ""
  },
  // ── Медик
  "medic.core.antivenom": {
    label: "За полудействие, потратив 3 дозы Детокса, 1 Очко Бесчестия и пройдя тест Scholastic Lore (Chymistry)(I)+0,",
    source: "Antivenom / Противоядие", reader: ""
  },
  "medic.core.butAScratch": {
    label: "Персонаж автоматически проходит тесты на Первую Помощь легко раненным персонажам.",
    source: "But a Scratch / Просто Царапина", reader: ""
  },
  "medic.core.butcher": {
    label: "Персонаж автоматически проходит тесты на лечение бесполезных конечностей и ампутацию при помощи Нартеция.",
    source: "Butcher / Мясник", reader: ""
  },
  "medic.core.cook": {
    label: "Имея набор разнообразных химикатов, персонаж может потратить Очко Бесчестия и за 5 минут приготовить I.b смесей,",
    source: "Cook / Повар", reader: ""
  },
  "medic.core.councilium": {
    label: "Персонаж удваивает максимум ассистентов для любого теста лечения (до 4 для Первой Помощи),",
    source: "Councilium / Консилиум", reader: ""
  },
  "medic.core.deepDetox": {
    label: "Потратив 2 дозы Детокса и 1 дозу Стимма, персонаж тестом Trade(Chymist)+0 готовит дозу глубокой детоксикации против определённого наркотика.",
    source: "Deep Detox / Глубокая Детоксикация", reader: ""
  },
  "medic.core.fastStitches": {
    label: "Персонаж может провести тест на Первую Помощь как одно полное действие, но считает свой I.b вдвое ниже (окр.▲) для эффективности.",
    source: "Fast Stitches / Быстрые Стежки", reader: ""
  },
  "medic.core.fieldSurgeon": {
    label: "Персонаж может проводить тесты Medicae, обычно требующие полноценной госпитализации, «в поле» со штрафом −20.",
    source: "Field Surgeon / Полевой Хирург", reader: ""
  },
  "medic.core.frontlineMedic": {
    label: "За полное действие персонаж может подвигаться на до дистанции Натиска (считается Натиском) к союзнику и сделать одно из: остановить Кровотеч…",
    source: "Frontline Medic / Фронтовой Медик", reader: ""
  },
  "medic.core.hookUp": {
    label: "Персонаж может дать −30 на свой тест крафта наркотиков, чтобы уменьшить вдвое (окр.▼) их минимальное опасное количество применений в неделю…",
    source: "Hook Up / Крючок", reader: ""
  },
  "medic.core.masterChirurgeon": {
    label: "Персонаж получает +10 на все тесты Medicae на лечение, и его пациенты восстанавливают +2 Раны от его Первой Помощи и любого другого лечения.",
    source: "Master Chirurgeon / Мастер-Хирургеон", reader: ""
  },
  "medic.core.placebo": {
    label: "За полудействие персонаж может ввести что-то другому и пройти комбинированный тест Deceive(I)+0 и Medicae(I)−10,",
    source: "Placebo / Плацебо", reader: ""
  },
  "medic.core.poisoner": {
    label: "Нанося Избирательное попадание оружием со свойством Toxic или заряженным ядом, цель должна перебрасывать успешные тесты против этого яда,",
    source: "Poisoner / Отравитель", reader: ""
  },
  "medic.core.radicalTreatment": {
    label: "Проводя Первую Помощь, персонаж может дать тесту дополнительно −10/−20/−30, но при Успехе восстановить цели дополнительно +1/2/3 Раны соотве…",
    source: "Radical Treatment / Радикальное Лечение", reader: ""
  },
  "medic.core.reanimate": {
    label: "Раз за бой/сцену персонаж может потратить Очко Бесчестия и за полное действие вернуть к жизни труп на расстоянии касания, подняв Раны до 0,",
    source: "Reanimate / Реанимировать", reader: ""
  },
  "medic.core.restitching": {
    label: "Персонаж может повторить попытку Первой Помощи, если предыдущая была неудачной и прошла не более I.b минут назад (в т.ч.",
    source: "Restitching / Перешивание", reader: ""
  },
  "medic.core.surgicalPrecision": {
    label: "Перед нанесением урона от одиночной Избирательной атаки по биологической цели персонаж может пройти тест Medicae−10 и получить +1 Dmg за каж…",
    source: "Surgical Precision / Хирургическая Точность", reader: ""
  },
  "medic.core.tolerance": {
    label: "Персонаж увеличивает минимальное опасное количество применений в неделю для всех наркотиков на 1. Этот Талант можно брать до P.b раз.",
    source: "Tolerance / Толерантность", reader: ""
  },
  "medic.core.torturer": {
    label: "Проводя пытки или ассистируя в них, персонаж может пройти тест Medicae−10 и при Успехе дать жертве −3×Успехи на её встречные тесты;",
    source: "Torturer / Мучитель", reader: ""
  },
  "medic.core.triage": {
    label: "Персонаж может оказывать медицинский уход до 10×I.b пациентам в смену (8 часов).",
    source: "Triage / Триаж", reader: ""
  },
  // ── Лидерство
  "leadership.core.adjutant": {
    label: "Командир персонажа может до ½I.b (окр.▲) раз за бой перебросить тест Командования и раз в Раунд — любой тест Lore для распознания событий на…",
    source: "Adjutant / Адъютант", reader: "module/rules/adjutant.mjs (wdbc-sk8s) — источник правил \"adjutant\" в sources.mjs"
  },
  "leadership.core.airOfAuthority": {
    label: "Персонаж может применять Command (и Intimidate на подчинённых) на до F.b×20 целей одновременно. Его Миньоны-люди получают +10 Лояльности.",
    source: "Air of Authority / Аура Власти", reader: ""
  },
  "leadership.core.backToBack": {
    label: "Успешно совершив Команду, персонаж может получить Трейт Fanatic и дать его до ½F.b (окр.",
    source: "Back to Back / Спиной к Спине", reader: ""
  },
  "leadership.core.battleSigns": {
    label: "Отряд персонажа может общаться его языком жестов, если «говорящий» в поле зрения «слушающего». Передаются только простые концепты;",
    source: "Battle Signs / Боевые Жесты", reader: ""
  },
  "leadership.core.bravado": {
    label: "Персонаж считает свой уровень Риска на 1 выше реального, если он не равен 1.",
    source: "Bravado / Бравада", reader: ""
  },
  "leadership.core.bringItDown": {
    label: "Давая Короткую Команду на бонус к попаданию по цели Размером 2+, персонаж может уменьшить бонус на 20, чтобы дать +1d10 Dmg по этой цели,",
    source: "Bring It Down! / Валите Это!", reader: ""
  },
  "leadership.core.camaraderie": {
    label: "В начале миссии персонаж поднимает Слаженность отряда до +20, даже если ведёт этих солдат впервые,",
    source: "Camaraderie / Дружество", reader: ""
  },
  "leadership.core.dutyAboveAll": {
    label: "Если персонаж — Лидер отряда, Конфликты между членами отряда не понижают его Слаженность (постоянную и во время миссии).",
    source: "Duty Above All / Долг Превыше Всего", reader: ""
  },
  "leadership.core.eloquence": {
    label: "Отдавая Команду на языке с Linguistics +10 и выше, персонаж получает +5 на эту Команду за каждый уровень продвижения выше +0,",
    source: "Eloquence / Красноречие", reader: ""
  },
  "leadership.core.fanOut": {
    label: "В начале боя сразу после бросков Инициативы персонаж может пройти Command (P)+0 (с бонусами Слаженности),",
    source: "Fan Out! / Разбежаться!", reader: ""
  },
  "leadership.core.fieldExecution": {
    label: "Когда подчинённый в Шоке/Подавлен/запуган/отступает, персонаж может пройти Intimidate(W)+0 vs W+0 против него и при успехе атаковать его как…",
    source: "Field Execution / Полевая Казнь", reader: ""
  },
  "leadership.core.frontlineCommander": {
    label: "Если персонаж не дальше от ближайшего врага, чем любой из его подчинённых, он может перебрасывать тесты на Command. Связанный в рукопашной,",
    source: "Frontline Commander / Фронтовой Командир", reader: ""
  },
  "leadership.core.intoTheJawsOfHell": {
    label: "Если персонаж сражается рядом с подчинёнными, все они автоматически проходят тесты Морали, кроме вызванных им самим.",
    source: "Into the Jaws of Hell / В Самое Пекло", reader: ""
  },
  "leadership.core.ironDiscipline": {
    label: "Все подчинённые персонажа могут перебрасывать проваленные тесты Морали, кроме вызванных самим персонажем. Работает даже без персонажа рядом.",
    source: "Iron Discipline / Железная Дисциплина", reader: ""
  },
  "leadership.core.livingLegend": {
    label: "Персонаж может использовать Inf вместо F во всех механиках командования и лидерства, если только его цель не имеет соразмерное Inf (начиная…",
    source: "Living Legend / Живая Легенда", reader: ""
  },
  "leadership.core.protege": {
    label: "Персонаж может выбрать одного подчинённого/Миньона и раз в Ход отдавать ему Личную Команду свободным действием,",
    source: "Protege / Протеже", reader: ""
  },
  "leadership.core.radiantPresence": {
    label: "Все союзники, способные видеть или слышать персонажа, получают +10 на тесты Морали, кроме вызванных самим персонажем.",
    source: "Radiant Presence / Блистательное Присутствие", reader: ""
  },
  "leadership.core.rally": {
    label: "Когда у отряда падает Слаженность и Лидер имеет Риск 3+, он может за Реакцию пройти Command (W)+0, и при Успехе отряд не теряет Слаженность.",
    source: "Rally / Сплотить", reader: ""
  },
  "leadership.core.rancor": {
    label: "Отдавая Команду против Ненавистных врагов или на защиту от них, персонаж получает +10 на эту Команду и +1 к максимуму Успехов от Риска.",
    source: "Rancor / Злопамятность", reader: ""
  },
  "leadership.core.voiceOfGod": {
    label: "До ½Inf.b (окр.▲) раз за бой, имея Риск 4+ и успешно отдавая Личную Команду, получатель также получает Очко Бесчестия,",
    source: "Voice of God / Глас Божий",
    reader: "module/combat/voice-of-god.mjs (wdbc-sk8s) — hasVoiceOfGod/voiceOfGodAvailable/applyVoiceOfGod; module/sheets/squad-sheet.mjs::_executeCommand (kind:\"short\", cKey:\"personal\")"
  },
  "leadership.core.warChant": {
    label: "В начале Хода Лидер может распевать боевую песнь: раздаёт все 3 эффекта Командного Присутствия всем подчинённым, что слышат песнь (макс. W.",
    source: "War Chant / Боевая Песнь", reader: ""
  },
  // ── Избегание
  "dodge.core.adrenalineRush": {
    label: "Один раз за бой или сцену персонаж может потратить Очко Бесчестия, чтобы восстановить все потраченные Реакции и потраченную дистанцию отскок…",
    source: "Adrenaline Rush / Прилив Адреналина",
    reader: "module/combat/adrenaline-rush.mjs (wdbc-ks1r/wdbc-2b93) — hasAdrenalineRush/adrenalineRushAvailable/applyAdrenalineRush восстанавливают Реакции И сбрасывают пул дистанции Отскока (recoil-pool.mjs::resetRecoilPool)"
  },
  "dodge.core.bladeReader": {
    label: "Персонаж может перебрасывать встречные тесты против Финта; переброс (но не начальный бросок) делается через Scrutiny(WS). Не работает,",
    source: "Blade Reader / Чтец Клинков", reader: ""
  },
  "dodge.core.bladeShield": {
    label: "Вооружённый оружием с Балансом 1+, персонаж может парировать им стрелковую атаку. Успех всегда блокирует только одно попадание независимо от…",
    source: "Blade Shield / Щит Клинков", reader: ""
  },
  "dodge.core.bodyguard": {
    label: "Персонаж может парировать атаки по союзнику, если атакующий на расстоянии удара от персонажа.",
    source: "Bodyguard / Телохранитель", reader: ""
  },
  "dodge.core.bulwark": {
    label: "Персонаж может перебрасывать тесты Парирования щитом и считает щиты имеющими Баланс 1 для других Талантов.",
    source: "Bulwark / Оплот", reader: ""
  },
  "dodge.core.catfall": {
    label: "Персонаж автоматически уменьшает высоту падения в расчёте урона на A.b и получает +20 на тесты Группирования. Даже получив урон от падения,",
    source: "Catfall / Кошачье Приземление", reader: ""
  },
  "dodge.core.caution": {
    label: "Раз в Ход за ментальное полудействие, считающееся Концентрацией, персонаж может получить 1 Реакцию.",
    source: "Caution / Осторожность", reader: ""
  },
  "dodge.core.chomper": {
    label: "Персонаж может пытаться Парировать своей атакой укусом (если она есть), как если бы у неё был Баланс 0,",
    source: "Chomper / Кусака", reader: ""
  },
  "dodge.core.combatMaster": {
    label: "Противники не получают бонусов за численное превосходство для рукопашных атак по персонажу.",
    source: "Combat Master / Мастер Боя", reader: ""
  },
  "dodge.core.counterfeint": {
    label: "Персонаж может использовать Awareness(P) вместо WS во встречных тестах против Финтов, но тогда не получает бонусы на этот тест от оружия.",
    source: "Counterfeint / Контрфинт", reader: ""
  },
  "dodge.core.deflectShot": {
    label: "Вооружённый оружием с Балансом 1+, персонаж может парировать им дозвуковые снаряды (стрелы, ракеты) и метательное оружие (ножи, гранаты),",
    source: "Deflect Shot / Отбить Выстрел", reader: ""
  },
  "dodge.core.escapeArtist": {
    label: "Используя А против Snare или чтобы Выкрутиться из Борьбы, персонаж уменьшает штрафы на этот тест (в т.ч. от Сжать) на A.",
    source: "Escape Artist / Освобождение от Пут", reader: ""
  },
  "dodge.core.flip": {
    label: "Когда персонаж сбивается с ног, он может пройти тест Acrobatics+0, чтобы сразу встать.",
    source: "Flip / Кувырок", reader: ""
  },
  "dodge.core.flourishDance": {
    label: "Нося плащ и имея свободную руку, персонаж за полудействие (или как часть полу-/полного движения) берёт плащ и проходит тест Dancer (A)+0 vs…",
    source: "Flourish Dance / Размашистый Танец", reader: ""
  },
  "dodge.core.hardTarget": {
    label: "Когда персонаж совершает Верховую Атаку, Натиск или Бег, вся стрельба по нему получает −10 до начала его следующего Хода.",
    source: "Hard Target / Трудная Цель", reader: ""
  },
  "dodge.core.highGuard": {
    label: "Персонаж может проводить Вольт, используя Parry(WS) вместо Acrobatics(A), используя при этом модификаторы баланса рукопашного оружия.",
    source: "High Guard / Высокая Защитная Стойка", reader: ""
  },
  "dodge.core.meatShield": {
    label: "Держа другого персонажа в Захвате, все попадания по нему с арки 180° со стороны захваченного вместо него попадают в этого захваченного.",
    source: "Meat Shield / Живой Щит", reader: ""
  },
  "dodge.core.pirouette": {
    label: "Будучи целью Напролом или Тарана, персонаж может пройти тест Acrobatics+0 и пропустить атакующего, не тратя реакции, сместившись в сторону.",
    source: "Pirouette / Пируэт", reader: ""
  },
  "dodge.core.salto": {
    label: "Персонаж увеличивает максимальную дистанцию отскока в Раунд на P.b м. Раз в Ход он может без траты Реакции Уклониться от шаблона со свойство…",
    source: "Salto / Сальто", reader: ""
  },
  "dodge.core.slipAway": {
    label: "Раз в Раунд при тесте Уклонения от Захвата или любом тесте А в Борьбе персонаж может либо получить +30 на этот тест (решить до броска),",
    source: "Slip Away / Ускользнуть", reader: ""
  },
  "dodge.core.snapshot": {
    label: "Если в свой Ход персонаж подвигался не больше полудвижения, в конце Хода получает +1 ОД — смоделировано (wdbc-1rno, module/combat/snapshot.mjs, hooks.mjs::updateCombat, читает movement-actions.mjs::moveDegreeThisTurn). НЕ смоделировано: ОД можно потратить только на выстрел по брошенному предмету и игнорируя ограничение атак Задержкой — в системе нет ни earmarked-подмножества ОД, ни кодового понятия «атака Задержкой» вообще, заводить оба под одну находку не оправдано; бонусное ОД тратится как обычное.",
    source: "Snapshot / Выстрел Навскидку", reader: "module/combat/snapshot.mjs"
  },
  "dodge.core.speedAwareness": {
    label: "Персонаж может совершать Избегания после Бега, но получает −5 на эти Избегания за каждые полные P.b метров, которые он пробежал.",
    source: "Speed Awareness / Скоростная Внимательность", reader: ""
  },
  "dodge.core.stepAside": {
    label: "Персонаж получает 1 дополнительную Реакцию, которую может потратить только на Избегание.",
    source: "Step Aside / Шаг в Сторону", reader: ""
  },
  // ── Стойкость
  "resilience.core.ablativeHardening": {
    label: "Каждый раз, тратя хотя бы 1 час на обслуживание брони, персонаж даёт ей I.b зарядов прочности. Когда броня получает эффект, снижающий АР,",
    source: "Ablative Hardening / Аблативное Укрепление", reader: ""
  },
  "resilience.core.armourMonger": {
    label: "Персонаж увеличивает AP своей брони на +2 на всех участках, пока ежедневно тратит час на её чистку, ремонт или мелкую переделку.",
    source: "Armour-Monger / Бронник", reader: ""
  },
  "resilience.core.decadence": {
    label: "При употреблении алкоголя и подобного персонаж удваивает все пределы накопленных провалов на его эффекты.",
    source: "Decadence / Декаданс", reader: ""
  },
  "resilience.core.dieHard": {
    label: "Персонаж может перебрасывать тесты на Кровотечение и смерть от шока.",
    source: "Die Hard / Крепкий Орешек", reader: ""
  },
  "resilience.core.dropAndRoll": {
    label: "За полудействие персонаж может автоматически потушить себя или согласного (или паникующего) персонажа на расстоянии касания,",
    source: "Drop and Roll / Падай и Перекатывайся", reader: ""
  },
  "resilience.core.eyeOfTheGods": {
    label: "Персонаж не может потерять больше 10 Ран в Раунд от атак рядовых врагов суммарно, а также не больше 10 Ран в Раунд от атак каждого значимого…",
    source: "Eye of the Gods / Взор Богов", reader: ""
  },
  "resilience.core.finalPush": {
    label: "Получив Критические Эффекты, персонаж может пройти тест на Т+0, чтобы отложить их применение до конца своего Хода.",
    source: "Final Push / Последний Рывок", reader: ""
  },
  "resilience.core.hardenedSoul": {
    label: "Персонаж добавляет ½ I.b (окр.▲) к поглощению урона от варп-оружия и, проигрывая тест против Выжигания Души,",
    source: "Hardened Soul / Укреплённая Душа", reader: ""
  },
  "resilience.core.hardy": {
    label: "В отношении лечения персонаж всегда считается легко раненным.",
    source: "Hardy / Крепкий", reader: ""
  },
  "resilience.core.headGuard": {
    label: "Раз в Раунд, получая попадание в голову (но не Избирательный в глаз или сочленения шеи),",
    source: "Head Guard / Прикрытие Головы", reader: ""
  },
  "resilience.core.hellishResilience": {
    label: "Получив непоглощённый урон, персонаж может потратить Очко Бесчестия, чтобы получить +Cor.",
    source: "Hellish Resilience / Адская Живучесть", reader: ""
  },
  "resilience.core.hunkerDown": {
    label: "Находясь в укрытии, персонаж может потратить полудействие, чтобы удвоить расчётный AP этого укрытия и дать своим выглядывающим частям тела о…",
    source: "Hunker Down / Залегание", reader: ""
  },
  "resilience.core.ironJaw": {
    label: "Получив эффект Оглушения, персонаж может пройти тест на Т+0, чтобы проигнорировать его.",
    source: "Iron Jaw / Стальная Челюсть", reader: ""
  },
  "resilience.core.mentalFortitude": {
    label: "Когда Усталость персонажа не выше W.b, он не получает штрафов от Усталости. Он теряет сознание, когда Усталость достигает T.b+2×W.b, а не T.",
    source: "Mental Fortitude / Ментальная Стойкость", reader: ""
  },
  "resilience.core.neverDie": {
    label: "Получив Критический Эффект, персонаж может потратить Очко Бесчестия, чтобы проигнорировать все его эффекты. Это не предотвращает урон.",
    source: "Never Die / Не Умирать", reader: ""
  },
  "resilience.core.painIsAnIllusion": {
    label: "Получив Критический Эффект, персонаж может пройти тест на W+0 и уменьшить эффект на Успехи, до минимума 1.",
    source: "Pain Is an Illusion / Боль – Лишь Иллюзия", reader: ""
  },
  "resilience.core.resistance": {
    label: "Персонаж получает +10 на тесты сопротивления специализации Таланта.",
    source: "Resistance / Сопротивление", reader: ""
  },
  "resilience.core.snakeEater": {
    label: "Персонаж уменьшает вдвое (окр.▲) получаемый урон от ядов, а длительность Отравления, эффектов ядов и пост-эффектов стимуляторов на нём умень…",
    source: "Snake Eater / Пожиратель Змей", reader: ""
  },
  "resilience.core.soundConstitution": {
    label: "Цена: 100 ХР или 70 ХР при Покровительстве Нургла. Персонаж получает +1 Рану. Этот Талант можно брать до T.",
    source: "Sound Constitution / Крепкое Телосложение", reader: ""
  },
  "resilience.core.stonewall": {
    label: "Когда персонажа сбивают с ног или насильно перемещают, он может пройти тест на S+0, чтобы проигнорировать это.",
    source: "Stonewall / Стена", reader: ""
  },
  "resilience.core.thumper": {
    label: "Преимущество на T механизировано (wdbc-u0by, kind:\"reroll\") — появляется опциональной радиокнопкой в ЛЮБОМ тесте Т (тот же честный принцип самоподтверждения, что у переброса Sentry выше): условие «именно против Оглушения ударной волной» не проверяется программно. Уменьшение вдвое штрафов от инфразвука и снижение штрафа расслышать сквозь шум — не механизировано",
    source: "Thumper / Громыхатель",
    reader: "module/rules/item-rules.mjs (kind:\"reroll\" → опциональный переброс в диалоге теста)"
  },
  "resilience.core.tireless": {
    label: "Персонаж не получает штраф −10 от Усталости на действия, не имеющие типа Ментальное.",
    source: "Tireless / Неутомимый", reader: ""
  },
  "resilience.core.trueGrit": {
    label: "Когда Раны персонажа ниже 0, он уменьшает полученный урон на T.b до минимума 1 (в т.ч. от попадания, опустившего их ниже 0),",
    source: "True Grit / Настоящая Выдержка", reader: ""
  },
  // ── Псайкана
  "psyker.core.aegisOfWill": {
    label: "При психосилах, действующих на площадь (аура, психический взрыв, дыхание), псайкер может исключить до ½PR (окр.▲) целей из воздействия.",
    source: "Aegis of Will / Эгида Воли", reader: ""
  },
  "psyker.core.alpha": {
    label: "Персонаж может продвигать свой бPR до 15 независимо от W.b и Cor.b. Существует в основном для персонажей не-Хаоситов.",
    source: "Alpha / Альфа", reader: ""
  },
  "psyker.core.blasphemousIncantation": {
    label: "Персонаж может использовать Путь Силы «Инкантация», а также увеличить время любого ритуала вдвое,",
    source: "Blasphemous Incantation / Богохульная Инкантация", reader: ""
  },
  "psyker.core.calmWinds": {
    label: "Используя Очко Бесчестия для Усмирения Варпа, псайкер может выбрать отменить второй бросок и вернуть потраченное Очко Бесчестия,",
    source: "Calm Winds / Штиль", reader: ""
  },
  "psyker.core.channel": {
    label: "Манифестируя психосилу Путём Силы «Психофокус» после успешного теста психофокуса, она не вызывает Проявлений Силы,",
    source: "Channel / Пропускание", reader: ""
  },
  "psyker.core.childOfTheWarp": {
    label: "Персонаж получает +1 PR при Усиленной манифестации, но его постоянно окружает незначительный постоянный феномен (определяется ГМом при взяти…",
    source: "Child of the Warp / Дитя Варпа", reader: ""
  },
  "psyker.core.corpusConversion": {
    label: "Псайкер может использовать Путь Силы «Телесная Конверсия».",
    source: "Corpus Conversion / Телесная Конверсия", reader: ""
  },
  "psyker.core.dreamingOfMind": {
    label: "Талант позволяет поддерживать одну выбранную психосилу даже во сне или без сознания (или Оглушённым, если Оглушение прерывает поддержку).",
    source: "Dreaming of Mind / Сон Разума", reader: ""
  },
  "psyker.core.fastWeaving": {
    label: "В начале боя сразу после бросков инициативы персонаж получает 2 полудействия, которые может потратить только на психосилы без типа «Атака».",
    source: "Fast Weaving / Быстрое Плетение", reader: ""
  },
  "psyker.core.favouredByTheWarp": {
    label: "Персонаж бросает два кубика на Феномены (но не Прорывы) и может выбрать любой из них.",
    source: "Favoured by the Warp / Любимец Варпа", reader: ""
  },
  "psyker.core.fluidWeave": {
    label: "Персонаж получает I.b очков Текучего Плетения. Раз в Ход за свободное действие он может развеять одну из своих психосил Вливаний/Призывов/Пс…",
    source: "Fluid Weave / Текучее Плетение", reader: ""
  },
  "psyker.core.innumerations": {
    label: "Когда манифестация вызывает Феномен, сразу после психотеста, но до бросков на Феномен и эффекты, псайкер может уменьшить эPR силы на 1,",
    source: "Innumerations / Исчисления", reader: ""
  },
  "psyker.core.meditation": {
    label: "За 5 минут медитации персонаж получает +30 на тест Пси-чутья или использует Путь Силы «Медитация».",
    source: "Meditation / Медитация", reader: ""
  },
  "psyker.core.psyRating": {
    label: "Можно брать множество раз; за каждое взятие +1 PR. Максимум PR = W.b + Cor.b (не-Хаоситы — только до W.b).",
    source: "Psy Rating / Пси-Рейтинг", reader: ""
  },
  "psyker.core.psychicLocus": {
    label: "Изучая потоки Варпа 8 часов, персонаж проходит Psyniscience+0 и при Успехе запоминает местность (запишите Успехи). Не дальше P.",
    source: "Psychic Locus / Психический Локус", reader: ""
  },
  "psyker.core.psychicPrecision": {
    label: "При манифестации стрелковых психосил псайкер может уменьшить эPR силы на 2, чтобы выбрать часть тела попадания,",
    source: "Psychic Precision / Психическая Точность", reader: ""
  },
  "psyker.core.psychicResurgence": {
    label: "Персонаж может потратить Очко Бесчестия, чтобы до начала своего следующего Хода игнорировать штрафы к тPR от поддержания психосил.",
    source: "Psychic Resurgence / Психическое Возрождение", reader: ""
  },
  "psyker.core.psychicSpite": {
    label: "Манифестируя психосилу на Ненавистном враге, псайкер получает +2 к эPR в расчёте психотеста, или дальности,",
    source: "Psychic Spite / Психическая Злоба", reader: ""
  },
  "psyker.core.psychicVampire": {
    label: "Раз в Раунд, убивая обладающее душой существо (но не изгоняя демона) психосилой или психосиловым оружием,",
    source: "Psychic Vampire / Психический Вампир", reader: ""
  },
  "psyker.core.restraint": {
    label: "Персонаж может рассчитывать свой эPR для манифестации в безопасном режиме как тPR−3 вместо ½тPR как обычно.",
    source: "Restraint / Сдержанность", reader: ""
  },
  "psyker.core.sacrifice": {
    label: "Псайкер может использовать Путь Силы «Жертва».",
    source: "Sacrifice / Жертва", reader: ""
  },
  "psyker.core.signaturePowers": {
    label: "Персонаж выбирает до I.b известных психосил. Раз в Раунд он может потратить Очко Бесчестия для любого теста,",
    source: "Signature Powers / Ключевые Силы", reader: ""
  },
  "psyker.core.techniqueFocus": {
    label: "Псайкер получает +10 на манифестацию выбранной психосилы и −10 на все вызванные ею Феномены.",
    source: "Technique Focus / Фокус Техники", reader: ""
  },
  "psyker.core.unburdened": {
    label: "При манифестации выбранной психосилы персонаж игнорирует штраф к тPR от поддержания психосил,",
    source: "Unburdened / Необременённый", reader: ""
  },
  "psyker.core.warpConduit": {
    label: "Творя психосилу в Усиленном режиме, персонаж может потратить Очко Бесчестия, чтобы добавить +1d5 к эPR для расчёта окончательных эффектов (н…",
    source: "Warp Conduit / Проводник Варпа", reader: ""
  },
  "psyker.core.warpLock": {
    label: "Раз в час персонаж может игнорировать выпавший Феномен или Прорыв, но получает 1d5 непоглощаемого E Dmg в голову,",
    source: "Warp Lock / Варп-Замок", reader: ""
  },
  "psyker.core.warpSense": {
    label: "Персонаж может использовать Варп-Чутьё как свободное действие и применяет его пассивно без концентрации.",
    source: "Warp Sense / Варп-Чутьё", reader: ""
  },
  "psyker.core.warpWhisper": {
    label: "Персонаж может уменьшить эPR психосилы на X, чтобы наложить −10×X на тесты Пси-Чутья для её засекания.",
    source: "Warp Whisper / Варповый Шёпот", reader: ""
  },
  "psyker.core.woundInReality": {
    label: "Тратя как минимум 3 PR на поддержание психосил, персонаж может не тратить тPR на поддержание новых манифестаций (ограничиваясь изначальными…",
    source: "Wound In Reality / Рана в Реальности", reader: ""
  },
  // ── Рукопашные
  "meleeCore.core.assassinStrike": {
    label: "Раз в Раунд после рукопашной атаки (успешной или нет) персонаж может пройти Acrobatics+0 и совершить Полудвижение как свободное действие,",
    source: "Assassin Strike / Удар Ассасина",
    reader: "module/combat/assassin-strike.mjs + кнопка в module/combat/attack-card.mjs (wdbc-qpcg)"
  },
  "meleeCore.core.bayonetCharge": {
    label: "Приём (База: любая; Оружие: штык). Персонаж делает базовую рукопашную атаку со штрафом −10.",
    source: "Bayonet Charge / Штыковая Атака", reader: ""
  },
  "meleeCore.core.bladeBinding": {
    label: "Когда противник успешно парирует атаку персонажа, тот может пройти S+0 vs S+0 и при победе сцепить оружия. Ни персонаж,",
    source: "Blade Binding / Сцепление Клинков", reader: ""
  },
  "meleeCore.core.blademaster": {
    label: "Раз в Раунд персонаж может перебросить любой неудачный тест на атаку клинковым рукопашным оружием.",
    source: "Blademaster / Мастер Клинка", reader: ""
  },
  "meleeCore.core.cleave": {
    label: "Если рукопашная атака нанесла цели 16+ непоглощённого урона и вывела её из строя, персонаж может за свободное действие атаковать базовой ата…",
    source: "Cleave / Разрубить", reader: ""
  },
  "meleeCore.core.cripplingStrike": {
    label: "Когда рукопашная атака персонажа наносит Отрицательные Раны, она получает +2 к Dmg.",
    source: "Crippling Strike / Калечащий Удар", reader: ""
  },
  "meleeCore.core.crushingBlow": {
    label: "Персонаж добавляет +½WS.b (окр.▲) ко всему своему рукопашному урону.",
    source: "Crushing Blow / Крушащий Удар", reader: ""
  },
  "meleeCore.core.disarm": {
    label: "Приём (База: Стандартная/Натиск/Осторожная Атака; Оружие: любое). Персонаж и цель проходят WS+0 vs WS+0. Заведён Состязанием MELEE_CONTESTS.disarm (wdbc-egll) — сам встречный тест бросается, +10 с кнутом/кистенём и что конкретно роняет/забирает цель на 5+ Успехов остаются на стол (тот же уровень автоматизации, что у Финта/Давления/Напролома). Талант в коде НЕ гейтит доступность кнопки — тот же принцип, что у остальных Состязаний (character-context.mjs)",
    source: "Disarm / Обезоружить", reader: "module/constants/combat.mjs MELEE_CONTESTS.disarm — module/combat/techniques.mjs::_showContestDialog"
  },
  "meleeCore.core.doubleTeam": {
    label: "Персонаж получает ещё +10 на попадание в ближнем бою за численное превосходство 2 к 1 или выше.",
    source: "Double Team / Гурьбой", reader: ""
  },
  "meleeCore.core.everythingAWeapon": {
    label: "Персонаж не получает штрафы на попадание за импровизированное оружие (в т.ч. стрелковое как рукопашное),",
    source: "Everything a Weapon / Всё – Оружие", reader: ""
  },
  "meleeCore.core.falseAdvance": {
    label: "Заканчивая Полудвижение или Полное движение в контакте с врагом, персонаж может провести против него один Финт или Давление за свободное дей…",
    source: "False Advance / Ложный Натиск", reader: ""
  },
  "meleeCore.core.fleshRender": {
    label: "Персонаж получает +2 кубика на урон рукопашным оружием со свойством Tearing вместо обычного +1 и отбрасывает два наименьших.",
    source: "Flesh Render / Терзатель Плоти", reader: ""
  },
  "meleeCore.core.gatekeeper": {
    label: "Персонаж может совершить до WS.b свободных атак в Раунд вместо одной.",
    source: "Gatekeeper / Привратник", reader: ""
  },
  "meleeCore.core.grind": {
    label: "Проводя приём Пила против противника, которого держит в Борьбе, персонаж использует полный S.b для урона вместо половины как обычно.",
    source: "Grind / Перемолоть", reader: ""
  },
  "meleeCore.core.hamstring": {
    label: "Раз в Ход, когда Избирательная рукопашная атака персонажа в ногу наносит непоглощённый урон,",
    source: "Hamstring / Подрезать Сухожилья", reader: ""
  },
  "meleeCore.core.preciseBlow": {
    label: "Персонаж уменьшает штраф на рукопашные атаки за Избирательные атаки или Размер цели ниже 0 ещё на 10.",
    source: "Precise Blow / Выверенный Удар", reader: ""
  },
  "meleeCore.core.raptor": {
    label: "Совершая Натиск в полёте, персонаж наносит +1d10 Dmg на 2+ Успехах на попадание и ещё +1d10 Dmg на 4+ Успехах.",
    source: "Raptor / Раптор", reader: ""
  },
  "meleeCore.core.reaper": {
    label: "Совершая Натиск и убивая цель при непотраченных атаках, персонаж может продолжить движение до следующей цели и атаковать её,",
    source: "Reaper / Жнец", reader: ""
  },
  "meleeCore.core.reverseStrike": {
    label: "Приём (База: Стандартная/Натиск/Осторожная Атака; Оружие: с профилем посоха, в двуручном хвате). Базовая атака +0 любым профилем,",
    source: "Reverse Strike / Обратный Удар", reader: ""
  },
  "meleeCore.core.riposte": {
    label: "Вооружённый двумя оружиями и успешно парировав атаку, персонаж может тут же атаковать противника базовой атакой +0 другим оружием,",
    source: "Riposte / Рипост", reader: ""
  },
  "meleeCore.core.savior": {
    label: "Оказываясь в базовом контакте с союзником и врагом одновременно, персонаж может потратить Реакцию и немедленно без траты действий провести п…",
    source: "Savior / Спаситель", reader: ""
  },
  "meleeCore.core.showOff": {
    label: "Действие: Полудействие (Физическое, Рукопашное, Ментальное). В рукопашной персонаж проводит WS+0 vs WS+0 против до F.",
    source: "Show-Off / Рисовка", reader: ""
  },
  "meleeCore.core.steadyFootwork": {
    label: "Персонаж не получает штрафов к тестам WS от Трудного ландшафта.",
    source: "Steady Footwork / Надёжная Стойка", reader: ""
  },
  "meleeCore.core.stockGrip": {
    label: "Персонаж может использовать штыки в одноручном хвате; это даёт −10 на все тесты WS с ними, а не −5 как обычно.",
    source: "Stock Grip / Прикладный Хват", reader: ""
  },
  "meleeCore.core.strangeTechnique": {
    label: "Персонаж получает дополнительную Реакцию, которую может потратить только на атаки вроде атак хвостом,",
    source: "Strange Technique / Странная Техника", reader: ""
  },
  "meleeCore.core.sureStrike": {
    label: "Персонаж уменьшает штраф на рукопашные атаки за Избирательные атаки или Размер цели ниже 0 на 10.",
    source: "Sure Strike / Верный Удар", reader: ""
  },
  "meleeCore.core.takedown": {
    label: "Персонаж может совершать приём Оглушить с любым оружием и не-Избирательной атакой. При успешном Оглушении он может также сбить цель с ног.",
    source: "Takedown / Вырубание", reader: ""
  },
  "meleeCore.core.tenacity": {
    label: "Совершив только одну одиночную рукопашную атаку в Ход, не нанёсшую урона (промах, Избегание, поглощение, щиты),",
    source: "Tenacity / Упорство", reader: ""
  },
  "meleeCore.core.whirlwindOfDeath": {
    label: "Рукопашные атаки персонажа по Ордам наносят дополнительный урон в Магнитуду, равный ½WS.b (окр.▲).",
    source: "Whirlwind of Death / Ураган Смерти", reader: ""
  },
  // ── Стрелок
  "rangedCore.core.aimFocus": {
    label: "Совершая любое прицеливание, персонаж может потратить 1 Реакцию, чтобы бонус прицеливания действовал на все его стрелковые атаки до конца сл…",
    source: "Aim Focus / Фокус на Прицеле", reader: ""
  },
  "rangedCore.core.appliedPhysics": {
    label: "Попадая из оружия со свойством Blast, после Избеганий персонаж может сместить шаблон взрыва на до ½ BS.b (окр.▲) м.",
    source: "Applied Physics / Прикладная Физика", reader: ""
  },
  "rangedCore.core.bulgingBiceps": {
    label: "Персонаж не получает штрафов за стрельбу из тяжёлого оружия без Закрепления.",
    source: "Bulging Biceps / Бугрящиеся Мышцы", reader: ""
  },
  "rangedCore.core.cageFiring": {
    label: "Совершая Широкую Длинную Очередь по одиночной цели, персонаж может уменьшить эффективный RoF ещё на 3,",
    source: "Cage Firing / Огневая Клеть", reader: ""
  },
  "rangedCore.core.chamberIn": {
    label: "Держа винтовку/дл. винтовку двумя руками или пистолет со свободной рукой, персонаж раз в Ход свободным действием заряжает в это оружие один…",
    source: "Chamber In / Досылание", reader: ""
  },
  "rangedCore.core.commando": {
    label: "Персонаж считает винтовки со свойством Carbine пистолетами для всех механик, кроме стрельбы в рукопашной.",
    source: "Commando / Командо", reader: ""
  },
  "rangedCore.core.controlledBurst": {
    label: "После Короткой или Длинной очереди (но не Широкой/Подавления) персонаж может уменьшить расчётный RoF оружия вплоть до половины (окр.▲),",
    source: "Controlled Burst / Контролируемая Очередь", reader: ""
  },
  "rangedCore.core.coveringFire": {
    label: "Совершая Выход из Боя, в конце движения персонаж может за свободное действие совершить короткую/длинную очередь из пистолета/винтовки (не дл…",
    source: "Covering Fire / Прикрывающий Огонь", reader: ""
  },
  "rangedCore.core.crackShot": {
    label: "Когда стрелковая атака персонажа наносит Отрицательные Раны, она получает +2 к Dmg.",
    source: "Crack Shot / Пробивной Удар", reader: ""
  },
  "rangedCore.core.deadeyeShot": {
    label: "Персонаж уменьшает штраф на стрелковые атаки за Избирательные атаки или Размер цели ниже 0 на 10.",
    source: "Deadeye Shot / В Яблочко", reader: ""
  },
  "rangedCore.core.doubleGrip": {
    label: "Держа пистолет двумя руками, Полу- и Полное Прицеливание дают +15/+30 вместо +10/+20, а Короткие/Длинные очереди — +5/+10 соответственно.",
    source: "Double Grip / Двойной Хват", reader: ""
  },
  "rangedCore.core.doubleTap": {
    label: "Совершая любую не-Избирательную очередь, персонаж может нанести первое успешное попадание (после Избеганий) в торс, а второе — в голову,",
    source: "Double Tap / Двойной Выстрел", reader: ""
  },
  "rangedCore.core.dragoon": {
    label: "Персонаж уменьшает на 10 штраф на стрельбу из пистолетов, винтовок и дл. винтовок за нестабильную платформу.",
    source: "Dragoon / Драгун", reader: ""
  },
  "rangedCore.core.drawFire": {
    label: "Раз в Раунд, снимая пистолет с удобной разгрузки, персонаж может сразу за свободное действие совершить из него не-Избирательный одиночный вы…",
    source: "Draw Fire / Огонь с Вытягивания", reader: ""
  },
  "rangedCore.core.eyeOfVengeance": {
    label: "Персонаж может потратить 1 Очко Бесчестия, чтобы добавить Inf.b к Dmg и Pen одного стрелкового оружия до конца Хода.",
    source: "Eye of Vengeance / Око Мщения", reader: ""
  },
  "rangedCore.core.fireThreat": {
    label: "Вооружённый стрелковым оружием (кроме дл. винтовки и тяжёлого), персонаж может проводить Давление, используя BS вместо WS,",
    source: "Fire Threat / Огневая Угроза", reader: ""
  },
  "rangedCore.core.fullFire": {
    label: "Персонаж может потратить Реакцию, чтобы одновременно стрелять из: винтовки и её комби-подствольника;",
    source: "Full Fire / Полный Огонь", reader: ""
  },
  "rangedCore.core.hairTrigger": {
    label: "Раз в Раунд при выстреле из Караула (до броска) персонаж проходит Awareness(P)+0 vs Awareness(P)+0;",
    source: "Hair Trigger / Палец на Спуске", reader: ""
  },
  "rangedCore.core.hipShooting": {
    label: "Персонаж может провести Полное Движение и Одиночный Выстрел (не Избирательный) как одно полное действие (в любом порядке). Не с дл.",
    source: "Hip Shooting / Стрельба от Бедра", reader: ""
  },
  "rangedCore.core.marksman": {
    label: "Персонаж не получает штрафов к стрельбе за дальнюю и экстремальную дистанцию.",
    source: "Marksman / Снайпер", reader: ""
  },
  "rangedCore.core.masterDragoon": {
    label: "Персонаж игнорирует любые штрафы на стрельбу из пистолетов, винтовок и дл. винтовок за нестабильную платформу.",
    source: "Master Dragoon / Мастер-Драгун", reader: ""
  },
  "rangedCore.core.mightyShot": {
    label: "Персонаж добавляет +½BS.b (окр.▲) ко всему своему стрелковому урону, кроме урона по площади (Blast/Spray);",
    source: "Mighty Shot / Могучий Выстрел", reader: ""
  },
  "rangedCore.core.onThisMark": {
    label: "Персонаж может без штрафов стрелять по невидимым целям, если засекает их методами, дающими только координаты (ауспекс, Mind Radiance),",
    source: "On This Mark / По Этим Координатам", reader: ""
  },
  "rangedCore.core.runAndGun": {
    label: "Совершая Натиск, персонаж может из любой точки пути за свободное действие выстрелить из не-тяжёлого оружия (не Избирательно),",
    source: "Run and Gun / Стрельба на Бегу", reader: ""
  },
  "rangedCore.core.saturationFire": {
    label: "При длинной/короткой очереди половина непопавших выстрелов (окр.▲) вместо этого попадает в укрытие цели или другое укрытие в 2м по выбору.",
    source: "Saturation Fire / Стрельба на Насыщение", reader: ""
  },
  "rangedCore.core.scanningAdvance": {
    label: "Персонаж может провести Полудвижение и Караул как одно полное действие, а его сектор обстрела в Карауле увеличивается до 90°.",
    source: "Scanning Advance / Сканирующее Продвижение", reader: ""
  },
  "rangedCore.core.sharpshooter": {
    label: "Персонаж уменьшает штраф на стрелковые атаки за Избирательные атаки или Размер цели ниже 0 ещё на 10.",
    source: "Sharpshooter / Меткий Стрелок", reader: ""
  },
  "rangedCore.core.sniperAssassin": {
    label: "Одиночный выстрел из оружия со свойством Accurate после Полного Прицеливания получает Незримое и может получать до 4 дополнительных кубиков…",
    source: "Sniper Assassin / Снайпер-Убийца", reader: ""
  },
  "rangedCore.core.stormOfLead": {
    label: "Стрелковые атаки персонажа короткими/длинными очередями, а также оружием со свойством Blast или Spray по Ордам наносят дополнительный урон в…",
    source: "Storm of Lead / Свинцовый Дождь", reader: ""
  },
  "rangedCore.core.sureShot": {
    label: "После успешного одиночного выстрела персонаж может потратить 1 Очко Бесчестия, чтобы противник получил −10 за каждый Успех на попадание на в…",
    source: "Sure Shot / Верный Выстрел", reader: ""
  },
  "rangedCore.core.tankHunter": {
    label: "Раз в Ход свободным действием персонаж может пройти Common Lore (War)−10, чтобы получить +2×I.",
    source: "Tank Hunter / Охотник на Танки", reader: ""
  },
  "rangedCore.core.targetSelection": {
    label: "Персонаж может стрелять в цели, связанные в ближнем бою, без штрафов, а его промахи никогда не попадают в союзников (но могут в других враго…",
    source: "Target Selection / Выбор Целей", reader: ""
  },
  "rangedCore.core.terrorSniper": {
    label: "Попадая Избирательной атакой оружием со свойством Accurate после любого Прицеливания, персонаж может пройти Intimidate(BS)+0;",
    source: "Terror Sniper / Снайпер Ужаса", reader: ""
  },
  "rangedCore.core.trackingAim": {
    label: "Совершая Прицеливание, персонаж может пройти P+0, чтобы его следующий выстрел игнорировал все штрафы за скорость цели, высоту и Таланты,",
    source: "Tracking Aim / Прицел на Упреждение", reader: ""
  },
  "rangedCore.core.trickShooter": {
    label: "Персонаж уменьшает на 30 штраф за атаки по необычным целям, не наносящим прямого урона персонажам (выстрел по летящей гранате, сбить шапку,",
    source: "Trick Shooter / Стрелок-Трюкач", reader: ""
  },
  "rangedCore.core.vigilance": {
    label: "При определении очерёдности одновременных действий (Задержка, Караул), если действие персонажа — стрельба, он может использовать P вместо А.",
    source: "Vigilance / Бдительность", reader: ""
  },
  // ── . — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite..atramentar": {
    label: "Убив противника в ближнем бою, Терминатор может потратить Реакцию или ещё не использованную Атаку другой рукой,",
    source: "Atramentar / Атраментар", reader: ""
  },
  "elite..hellbound": {
    label: "За смену работы может отметить машину дополнительными рунами связывания (не более ½W.b (окр.",
    source: "Hellbound / Адсвязанный", reader: ""
  },
  "elite..savantImmaterial": {
    label: "Изучая любую психосилу, может сразу же без траты опыта изучить ещё одну психосилу, которая стоит в 2 раза меньше опыта или меньше.",
    source: "Savant Immaterial / Савант Имматериал", reader: ""
  },
  "elite..voltageistBlast": {
    label: "Совершая Натиск с Техночудом Voltageist Shield в Процессах, может в конце своего Хода потратить 3⚙,",
    source: "Voltagheist Blast / Вольтагейст Взрыв", reader: ""
  },
  "elite..voltageistBubble": {
    label: "Имея в Процессах Техночудо Voltageist Shield, может выбрать получить иммунитет к эффектам вакуума и газов,",
    source: "Voltagheist Bubble / Вольтагейст Пузырь", reader: ""
  },
  // ── Азуриани — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.azuriani.fullShelter": {
    label: "За полную смену персонаж может модифицировать рейнджерскую плетёную броню (и производные),",
    source: "Full Shelter / Полное Укрытие", reader: ""
  },
  "elite.azuriani.theCursedUnion": {
    label: "Персонаж может считать людей за эльдар в расчёте механики и теряет штраф на социальное взаимодействие с людьми. В конце каждой сессии,",
    source: "The Cursed Union / Проклятый Союз", reader: ""
  },
  // ── Дредноуты — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.drednouty.ashMantle": {
    label: "Может использовать орудия со свойством Spray, даже будучи связанным в рукопашной, и вместо обычного шаблона нанести попадание этим орудием п…",
    source: "Ash Mantle / Мантия Пепла", reader: ""
  },
  "elite.drednouty.bastion": {
    label: "Подвергшись Тарану, может пройти тест Parry+0 со штрафом −10 за каждый Размер таранящей машины выше своего: при Успехе не получает урона и н…",
    source: "Bastion / Бастион", reader: ""
  },
  "elite.drednouty.coreMemories": {
    label: "Увеличивает максимум Здравомыслия на 5. Можно брать до I.b раз. Смоделировано (module/rules/dreadnought.mjs::sanityMax) — считается автоматически в prepareDerivedData.",
    source: "Core Memories / Ядро Воспоминаний", reader: "module/rules/dreadnought.mjs::sanityMax, module/rules/character.mjs"
  },
  "elite.drednouty.cruelty": {
    label: "Убив цель рукопашной атакой или стрелковой атакой в конечность, может потратить 1 Очко Бесчестия: немедленно заканчивает свой Ход и пропуска… Смоделирована только трата/бросок (кнопка панели ЗДРАВОМЫСЛИЕ: −1 Очко Бесчестия → +2d10 Здравомыслия) — условие (добита конечность) книга не проверяет автоматически, самоотчёт игрока.",
    source: "Cruelty / Жестокость (Дредноут)", reader: "module/rules/dreadnought.mjs::SANITY_RECOVERY_TALENTS, module/sheets/actor-sheet.mjs::onSanityTalentRecover"
  },
  "elite.drednouty.endurance": {
    label: "Когда пилот или Дредноут получает непоглощённый урон хотя бы 3 раза с конца своего предыдущего Хода, Смоделирована только трата/бросок (та же кнопка панели, что у Cruelty) — счётчик «3-й урон подряд» не отслеживается автоматически, самоотчёт игрока.",
    source: "Endurance / Превозмогание", reader: "module/rules/dreadnought.mjs::SANITY_RECOVERY_TALENTS, module/sheets/actor-sheet.mjs::onSanityTalentRecover"
  },
  "elite.drednouty.ferumInfernus": {
    label: "Если Здравомыслие ниже ½Inf +5, каждый час восстанавливает 1 Здравомыслия. Смоделировано (module/rules/dreadnought.mjs::ferumInfernusActive/Threshold) — порог и индикатор «активна» считаются автоматически, тик +1 в час — кнопка панели (часовой таймер не тикает сам, тот же случай, что Электростимуляторы/Препараты).",
    source: "Ferum Infernus / Ферум Инфернус", reader: "module/rules/dreadnought.mjs::ferumInfernusActive, module/sheets/actor-sheet.mjs::onFerumInfernusTick"
  },
  "elite.drednouty.fistfulOfThunder": {
    label: "Попав по цели рукопашным орудием, может немедленно атаковать встроенным в него орудием ту же цель или другую в базовом контакте с ним и изна…",
    source: "Fistful of Thunder / Пригоршня Грома", reader: ""
  },
  "elite.drednouty.ironWrath": {
    label: "Сохраняет способность стрелять как обычно и игнорирует штраф к BS от Ярости. В Ярости не обязан двигаться к ближайшей цели быстрее Шага,",
    source: "Iron Wrath / Железный Гнев", reader: ""
  },
  "elite.drednouty.payback": {
    label: "Когда ненавистный противник наносит Дредноуту или пилоту непоглощённый урон, пилот может потратить Реакцию и немедленно атаковать этого прот…",
    source: "Payback / Расплата", reader: ""
  },
  "elite.drednouty.superiority": {
    label: "Победив потенциально опасного противника (способного серьёзно навредить) с помощью нечестного преимущества, Смоделирована только трата/бросок (та же кнопка панели, что у Cruelty) — условие книга не проверяет автоматически, самоотчёт игрока.",
    source: "Superiority / Превосходство", reader: "module/rules/dreadnought.mjs::SANITY_RECOVERY_TALENTS, module/sheets/actor-sheet.mjs::onSanityTalentRecover"
  },
  "elite.drednouty.triumph": {
    label: "Убив рукопашной атакой или выстрелом в упор сильного противника (вражеского чемпиона, монстра или машину), Смоделирована только трата/бросок (та же кнопка панели, что у Cruelty) — условие книга не проверяет автоматически, самоотчёт игрока.",
    source: "Triumph / Триумф", reader: "module/rules/dreadnought.mjs::SANITY_RECOVERY_TALENTS, module/sheets/actor-sheet.mjs::onSanityTalentRecover"
  },
  "elite.drednouty.venerable": {
    label: "Использовав Избегание и всё равно получив попадание, может подставить под удар любую сторону,",
    source: "Venerable / Почтенный", reader: ""
  },
  // ── Книга_Пустоты\Варп_навигация — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.knigaPustoty.varpNavigatsiya.burdenOfResponsibility": {
    label: "Персонаж получает +5 к тестам Navigation (Warp) при навигировании корабля в варпе.",
    source: "Burden of Responsibility / Груз ответственности", reader: ""
  },
  "elite.knigaPustoty.varpNavigatsiya.corruptedLight": {
    label: "В регионах без света Астрономикона персонаж ориентируется на иной маяк варпа. При покровительстве Бога ориентируется на его царство (Нургл/К…",
    source: "Corrupted Light / Осквернённый Свет", reader: ""
  },
  "elite.knigaPustoty.varpNavigatsiya.eyeOfANeedle": {
    label: "Каждая купленная группа этого таланта считает, что относящиеся к ней корабли флотилии того же типа,",
    source: "Eye of a Needle / Игольное ушко", reader: ""
  },
  "elite.knigaPustoty.varpNavigatsiya.likeAtHome": {
    label: "Любые тесты Навыков на варп-путешествия в пределах выбранного варп-шторма, на выход/вход в него, получают +20.",
    source: "Like at Home / Как дома", reader: ""
  },
  "elite.knigaPustoty.varpNavigatsiya.navigatorPrimaris": {
    label: "При проведении через варп флотилий персонаж получает +10 ко всем тестам Navigation (Warp).",
    source: "Navigator Primaris / Навигатор Примарис", reader: ""
  },
  "elite.knigaPustoty.varpNavigatsiya.rideTheWaves": {
    label: "При Длительном Действии Варп-наведение персонаж может отказаться от обычных эффектов и вместо этого модифицировать последующие броски на эфф…",
    source: "Ride the Waves / Оседлать Волны", reader: ""
  },
  "elite.knigaPustoty.varpNavigatsiya.vectorizationMaster": {
    label: "При Длительном Действии Варп-наведение персонаж может принять −10 и при успехе расширить эффект и на Стрельбу, и на Движение с Поворотами.",
    source: "Vectorization Master / Мастер наведения", reader: ""
  },
  "elite.knigaPustoty.varpNavigatsiya.warpEngineExpert": {
    label: "При проведении флотилии через варп каждый несинхронизированный тип движка даёт штраф −5 вместо −10.",
    source: "Warp Engine Expert / Знаток варп-двигателей", reader: ""
  },
  // ── Книга_Пустоты\Ген_навигатора — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.knigaPustoty.genNavigatora.aGazeThatPiercesTheSoul": {
    label: "Выберите одну имеющуюся Силу навигатора — её применение получает +10.",
    source: "A Gaze that Pierces the Soul / Взгляд, что пронзает душу", reader: ""
  },
  "elite.knigaPustoty.genNavigatora.changingDestinyAndGenes": {
    label: "Получая Мутацию Навигатора, персонаж может кидать дважды и выбирать результат, а также модифицировать его на свой бонус Inf.",
    source: "Changing Destiny and Genes / Изменяя Судьбу и Гены", reader: ""
  },
  "elite.knigaPustoty.genNavigatora.concentratedGaze": {
    label: "Один раз за игровую встречу персонаж может заставить одного врага перебросить успешный тест сопротивления Силам навигатора.",
    source: "Concentrated Gaze / Сосредоточенный взгляд", reader: ""
  },
  "elite.knigaPustoty.genNavigatora.proximityToTheWarp": {
    label: "При применении Силы навигатора персонаж может потратить Очко Бесчестья, чтобы автоматически пройти тест (если важны успехи — считается,",
    source: "Proximity to the Warp / Близость к Варпу", reader: ""
  },
  "elite.knigaPustoty.genNavigatora.theEyeThatHasSeen": {
    label: "При получении новой мутации от Порчи (но не от приобретения новой Силы навигатора) персонаж может выбирать: бросать по таблице Мутаций навиг…",
    source: "The Eye that has Seen / Око Узревшее", reader: ""
  },
  // ── Книга_Пустоты\Дух_машины — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.knigaPustoty.duhMashiny.comprehensionOfTheEngine": {
    label: "Персонаж получает +10 к Длительному Действию Полный ход.",
    source: "Comprehension of the Engine / Постижение двигателя", reader: ""
  },
  "elite.knigaPustoty.duhMashiny.everyMinuteCounts": {
    label: "При Длительном Действии Срочный ремонт персонаж за очко Бесчестья может перекинуть бросок 1d5 на число СР длительности ремонта.",
    source: "Every Minute Counts / Каждая минута на счету", reader: ""
  },
  "elite.knigaPustoty.duhMashiny.omnissianCongregator": {
    label: "Персонаж получает +10 к Длительному Действию Помощь Духу Машины.",
    source: "Omnissian Congregator / Омниссианский конгрегатор", reader: ""
  },
  "elite.knigaPustoty.duhMashiny.patchingTheSacredFrame": {
    label: "Руководя Длительным ремонтом силами экипажа, при успехе персонаж восстанавливает дополнительно свой I.b очков прочности корпуса.",
    source: "Patching the Sacred Frame / Латание священного корпуса", reader: ""
  },
  // ── Книга_Пустоты\Псайкер — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.knigaPustoty.psayker.astrotelepathicResonance": {
    label: "Персонаж может объединять других астропатов (с психосилой Astral Telepathy) в хоры, получая от них Помощь по обычным правилам с максимальным…",
    source: "Astrotelepathic Resonance / Астротелепатический резонанс", reader: ""
  },
  // ── Книга_Пустоты\Пустотный_Волк — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.knigaPustoty.pustotnyyVolk.boarder": {
    label: "Руководя или отражая Действия Абордаж и Ударил-отступил, персонаж получает +10 ко всем своим тестам.",
    source: "Boarder / Абордажник", reader: ""
  },
  "elite.knigaPustoty.pustotnyyVolk.calculationOfTrajectories": {
    label: "Стреляя по противнику, подвергшемуся успешному Длительному Действию Захват Цели, персонаж получает дополнительный +5.",
    source: "Calculation of Trajectories / Расчёт траекторий", reader: ""
  },
  "elite.knigaPustoty.pustotnyyVolk.chaoticPattern": {
    label: "Персонаж получает +10 к тестам маневра Уклонение.",
    source: "Chaotic Pattern / Хаотичный паттерн", reader: ""
  },
  "elite.knigaPustoty.pustotnyyVolk.flightCommander": {
    label: "Раз в СХ персонаж может перебросить проваленный тест Operate (Voidship), когда лично руководит звеном малых судов.",
    source: "Flight Commander / Командир звена", reader: ""
  },
  "elite.knigaPustoty.pustotnyyVolk.holdTheHelm": {
    label: "Один раз в СХ персонаж может перебросить любой проваленный тест при действиях Маневра.",
    source: "Hold the Helm / Держи штурвал", reader: ""
  },
  "elite.knigaPustoty.pustotnyyVolk.knowTheEnemy": {
    label: "При успешном тесте Направленной Авгурии считается, что персонаж выкинул на один успех больше.",
    source: "Know the Enemy / Познай врага", reader: ""
  },
  "elite.knigaPustoty.pustotnyyVolk.masterGunner": {
    label: "Раз в СХ персонаж может перебрасывать один проваленный тест при действиях Стрельбы.",
    source: "Master Gunner / Мастер-канонир", reader: ""
  },
  "elite.knigaPustoty.pustotnyyVolk.unityWithTheAugurs": {
    label: "Раз в СХ персонаж может перебросить проваленный тест, использующий DT.",
    source: "Unity with the Augurs / Единение с авгурами", reader: ""
  },
  "elite.knigaPustoty.pustotnyyVolk.voxSilence": {
    label: "Персонаж получает +20 к Длительному Действию Заглушить коммуникации.",
    source: "Vox Silence / Вокс-тишина", reader: ""
  },
  // ── Книга_Пустоты\Пустоход — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.knigaPustoty.pustohod.appealToTheCrew": {
    label: "При совершении Длительного Действия Навались персонаж получает +10 на этот тест.",
    source: "Appeal to the Crew / Воззвание к экипажу", reader: ""
  },
  "elite.knigaPustoty.pustohod.byTheCaptainSWill": {
    label: "Когда персонаж предпринимает корабельные Действия, использующие Command, он получает +10 к этим тестам.",
    source: "By the Captain's Will / По воле капитана", reader: ""
  },
  "elite.knigaPustoty.pustohod.captainOnTheBridge": {
    label: "Во время СХ, находясь на мостике и отдавая приказы видящим/слышащим его, персонаж за СД может дать +10 к любому корабельному действию.",
    source: "Captain on the Bridge / Капитан на мостике", reader: ""
  },
  "elite.knigaPustoty.pustohod.chartaArtifex": {
    label: "Персонаж получает +10 ко всем тестам на Awareness и P, проводимым во время путешествия в варпе и при обнаружении звёздных явлений.",
    source: "Charta-artifex / Карто-артифекс", reader: ""
  },
  "elite.knigaPustoty.pustohod.continuationOfFleshAndSoul": {
    label: "При броске на Искажения персонаж может изменить результат по таблице на свой Inf.b в любую сторону (как при получении Даров Богов),",
    source: "Continuation of Flesh and Soul / Продолжение плоти и души", reader: ""
  },
  "elite.knigaPustoty.pustohod.disciplinaryOfficer": {
    label: "Пока персонаж на борту, тесты Command с участием экипажа корабля не получают штрафов за снижение CM.",
    source: "Disciplinary Officer / Надзиратель за дисциплиной", reader: ""
  },
  "elite.knigaPustoty.pustohod.divisionOfSpoils": {
    label: "Когда жертвуется хотя бы 1 Inf на восстановление CM, персонаж может сделать дополнительный тест Commerce (+0) и восстановить ещё 1 очко CM з…",
    source: "Division of Spoils / Делёж добычи", reader: ""
  },
  "elite.knigaPustoty.pustohod.fireFighter": {
    label: "Персонаж получает +20 ко всем тестам Command, проводимым для борьбы с пожаром на борту.",
    source: "Fire Fighter / Борец с огнём", reader: ""
  },
  "elite.knigaPustoty.pustohod.firstAfterTheGods": {
    label: "Персонаж может тратить Очки Бесчестья на переброс любых проваленных корабельных Действий, предпринятых NPC, другими игроками или через CR.",
    source: "First After the Gods / Первый после богов", reader: ""
  },
  "elite.knigaPustoty.pustohod.guidingHand": {
    label: "Проводя как минимум Смену работы в день, пока он на борту, CR растёт на 5 при Trade (Voidfarer) +10, на 10 — при +20 и на +15 при +30.",
    source: "Guiding Hand / Направляющая рука", reader: ""
  },
  "elite.knigaPustoty.pustohod.manipulationOfFacts": {
    label: "Персонаж получает +10 к тестам Длительного Действия Дезинформация.",
    source: "Manipulation of Facts / Манипулирование фактами", reader: ""
  },
  "elite.knigaPustoty.pustohod.mutantRecruitment": {
    label: "Сразу после космического боя персонаж может совершить набег на нижние палубы, заменив часть мёртвого экипажа рабами-мутантами: корабль восст…",
    source: "Mutant Recruitment / Вербовка мутантов", reader: ""
  },
  "elite.knigaPustoty.pustohod.pityOfWarp": {
    label: "При использовании ритуала Очищения, если персонаж не провалил тест, ему не нужно делать проверку Inf, чтобы не получить Порчу самому.",
    source: "Pity of Warp / Жалость варпа", reader: ""
  },
  "elite.knigaPustoty.pustohod.preservationOfAnUndefiledSpirit": {
    label: "При проведении ритуалов Очищения от Осквернения персонаж получает +10 к тесту вне зависимости от избранного метода.",
    source: "Preservation of an Undefiled Spirit / Сохранение неосквернённого духа", reader: ""
  },
  "elite.knigaPustoty.pustohod.rationRationing": {
    label: "Удваивает эффективные запасы судна, давая ему трейт Travel Supplies (X), где X — текущее значение запасов (обычно 6, если нет этого трейта),",
    source: "Ration Rationing / Нормирование пайков", reader: ""
  },
  "elite.knigaPustoty.pustohod.ruthlessSorting": {
    label: "Персонаж получает +10 к Длительному Действию Сортировка раненых.",
    source: "Ruthless Sorting / Безжалостная сортировка", reader: ""
  },
  "elite.knigaPustoty.pustohod.theFactotumCase": {
    label: "При приобретении узлов и реквизиции на обслуживание пустолёта персонаж получает +10.",
    source: "The Factotum Case / Дело Фактотума", reader: ""
  },
  "elite.knigaPustoty.pustohod.thirstForDesecration": {
    label: "При проведении ритуала Осквернения Пустотного Титана персонаж получает +10 к тестам.",
    source: "Thirst for Desecration / Жажда осквернения", reader: ""
  },
  "elite.knigaPustoty.pustohod.toyOfTheGodsChosen": {
    label: "При броске на Искажения персонаж может бросить дважды и выбрать результат.",
    source: "Toy of the Gods' Chosen / Игрушка избранника богов", reader: ""
  },
  "elite.knigaPustoty.pustohod.viciousSigils": {
    label: "Руководя Длительным действием Ударил-отступил, персонаж может осквернить палубы и узлы вражеского корабля,",
    source: "Vicious Sigils / Порочные сигилы", reader: ""
  },
  "elite.knigaPustoty.pustohod.whateverTheChildEnjoys": {
    label: "При проведении ритуала Очищения персонаж получает Очки Порчи лишь при провале теста.",
    source: "Whatever the Child Enjoys / Чем бы дитя ни тешилось", reader: ""
  },
  // ── Таланты_Астартес\Повелители_Ночи — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.talantyAstartes.poveliteliNochi.propheticVision": {
    label: "Персонаж может раз в Раунд перебросить любой свой тест, но его тесты против Рока Ночного Призрака становятся W+0 вместо W+10.",
    source: "Prophetic Vision / Пророческое Видение", reader: ""
  },
  "elite.talantyAstartes.poveliteliNochi.theLongNightmare": {
    label: "Когда ГМ посылает персонажу пророческий сон с его смертью, он может пройти тест W+20 и при Успехе растянуть сон на 2 часа за каждый Успех,",
    source: "The Long Nightmare / Долгий Кошмар", reader: ""
  },
  // ── Таланты_одержимых\Дары___Движение — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.talantyOderzhimyh.daryDvizhenie.beastLegs": {
    label: "Digitigrade (4) + Deadly Natural Weapon (Копыта) от Проявления; если руки — когти, ещё Quadruped (1).",
    source: "Beast Legs / Дар: Звериные Ноги", reader: ""
  },
  "elite.talantyOderzhimyh.daryDvizhenie.fluidForm": {
    label: "Amorphous + Crawler: просачивается через узкие проходы, облепляет врага.",
    source: "Fluid Form / Дар: Текучий", reader: ""
  },
  "elite.talantyOderzhimyh.daryDvizhenie.spiderClimb": {
    label: "Ходьба по стенам/потолку: ½ SPD ногами, полная на четвереньках.",
    source: "Spider Climb / Дар: Паук", reader: ""
  },
  "elite.talantyOderzhimyh.daryDvizhenie.wings": {
    label: "Flyer (A.b×2). Несовместим с «Руки на Спине».",
    source: "Wings / Дар: Крылья", reader: ""
  },
  // ── Таланты_одержимых\Дары___Единение — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.talantyOderzhimyh.daryEdinenie.brotherhood": {
    label: "Доп. пара рук (Multiple Arms +2) на WS/BS/S/A демона; демон призывает Daemonic Armament (Демонетка — клинки/клешни,",
    source: "Brotherhood / Дар: Братство", reader: ""
  },
  "elite.talantyOderzhimyh.daryEdinenie.locusOfTheSymbiote": {
    label: "Излучает Локус демона (можно менять); действует на всех дружественных Одержимых в Проявлении. Только для Высших Одержимых.",
    source: "Locus of the Symbiote / Дар: Локус Симбиоза", reader: ""
  },
  "elite.talantyOderzhimyh.daryEdinenie.mentor": {
    label: "Хост получает до 3 Навыков/Талантов уровня демона (если демон позволяет); набор меняется при активации.",
    source: "Mentor / Дар: Ментор", reader: ""
  },
  "elite.talantyOderzhimyh.daryEdinenie.stacking": {
    label: "Daemonic Presence (10/10) + способности по демону (зависит от Двойного Духа — см. блок Наслоения).",
    source: "Stacking / Дар: Наслоение", reader: ""
  },
  "elite.talantyOderzhimyh.daryEdinenie.twoFaced": {
    label: "Доп. глаза/рот второй души: 2 броска Awareness; неконтролирующая душа получает полудействие только на общение/Команду/Запугивание/Baleful Di…",
    source: "Two-Faced / Дар: Двуликий", reader: ""
  },
  "elite.talantyOderzhimyh.daryEdinenie.warpSight": {
    label: "Warp Sight и Unnatural Senses (W.b демона).",
    source: "Warp Sight / Дар: Варп-Зрение", reader: ""
  },
  // ── Таланты_одержимых\Дары___Защита — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.talantyOderzhimyh.daryZaschita.auraOfChaos": {
    label: "Мерцает между реальностью и Варпом: не перегружающийся сквозной силовой щит 1-W демона; на любом дубле при успехе — Феномен.",
    source: "Aura of Chaos / Дар: Аура Хаоса", reader: ""
  },
  "elite.talantyOderzhimyh.daryZaschita.carapace": {
    label: "Natural Armour (Cor.b), не складывается с носимой бронёй.",
    source: "Carapace / Дар: Панцирь", reader: ""
  },
  "elite.talantyOderzhimyh.daryZaschita.giant": {
    label: "+1 Размер, +10 S, +10 к макс. и текущим Ранам (без бонуса +1 SPD от Размера).",
    source: "Giant / Дар: Гигант", reader: ""
  },
  "elite.talantyOderzhimyh.daryZaschita.regeneration": {
    label: "Regeneration (½Cor.b, окр.▲); активация на Cor+0 вместо Т+0. Не лечит урон от Sanctified.",
    source: "Regeneration / Дар: Регенерация", reader: ""
  },
  "elite.talantyOderzhimyh.daryZaschita.veilOfDarkness": {
    label: "Облако тьмы: все зрячие атаки по нему −20.",
    source: "Veil of Darkness / Дар: Завеса Тьмы", reader: ""
  },
  // ── Таланты_одержимых\Дары___Оружие — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.talantyOderzhimyh.daryOruzhie.fusion": {
    label: "Рукопашное оружие сливается с рукой: Reinforced, нельзя менять хват, двуручное — одной рукой, получает Дары-усилители.",
    source: "Fusion / Дар: Слияние", reader: ""
  },
  "elite.talantyOderzhimyh.daryOruzhie.gunArm": {
    label: "Пистолет/винтовка втягивается в предплечье: одной рукой без штрафов, не тратит боеприпасы; Reinforced, Wrist, Дары-усилители.",
    source: "Gun Arm / Дар: Рука-Пушка", reader: ""
  },
  // ── Таланты_одержимых\Дары___Трансформация — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.talantyOderzhimyh.daryTransformatsiya.horns": {
    label: "Deadly Natural Weapon (Рога) от Проявления.",
    source: "Horns / Дар: Рога", reader: ""
  },
  "elite.talantyOderzhimyh.daryTransformatsiya.manyEyed": {
    label: "Круговое зрение; выглядывает из укрытия рукой/ногой вместо головы.",
    source: "Many-Eyed / Дар: Многоглазый", reader: ""
  },
  "elite.talantyOderzhimyh.daryTransformatsiya.massiveMaw": {
    label: "Bite + Deadly Natural Weapon (Укус) от Проявления; при попадании укусом — Захват; может не наносить урон.",
    source: "Massive Maw / Дар: Огромная Пасть", reader: ""
  },
  "elite.talantyOderzhimyh.daryTransformatsiya.maw": {
    label: "Bite с рейтингом Deadly Natural Weapon от Проявления.",
    source: "Maw / Дар: Пасть", reader: ""
  },
  // ── Таланты_одержимых\Дары___Усилители — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.talantyOderzhimyh.daryUsiliteli.bladesOfTheSoul": {
    label: "Оружие получает Warp Weapon, но урон уменьшается до поглощения вдвое (окр.▲).",
    source: "Blades of the Soul / Дар: Лезвия Душ", reader: ""
  },
  "elite.talantyOderzhimyh.daryUsiliteli.daemonicVenom": {
    label: "Оружие получает Felling (½Cor.b, окр.▲) и Toxic (½Cor.b, окр.▲).",
    source: "Daemonic Venom / Дар: Демонический Яд", reader: ""
  },
  "elite.talantyOderzhimyh.daryUsiliteli.lightningField": {
    label: "Оружие: +2 Dmg и Pen, наносит E, получает Power Field.",
    source: "Lightning Field / Дар: Молниевое Поле", reader: ""
  },
  "elite.talantyOderzhimyh.daryUsiliteli.warpflame": {
    label: "Оружие наносит E(Fl) и получает Flame.",
    source: "Warpflame / Дар: Варп-Пламя", reader: ""
  },
  // ── Таланты_одержимых\Таланты_архетипа — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.talantyOderzhimyh.talantyArhetipa.greaterPossessed": {
    label: "Демон возвышается в Герольда с Inf = ½ Inf Одержимого; Фавор 75xp/Inf, ОБ герольда из Inf.b. Локусы не действуют изнутри.",
    source: "Greater Possessed / Высший Одержимый", reader: ""
  },
  "elite.talantyOderzhimyh.talantyArhetipa.introspection": {
    label: "+бонус FL (Daemons) на общение с демоном; раз в Ход Charm/Logic vs W демона — уговорить проявить +1 Дар.",
    source: "Introspection / Интроспекция", reader: ""
  },
  "elite.talantyOderzhimyh.talantyArhetipa.realityRipple": {
    label: "Проявление или смена любого числа Даров за свободное действие, получая 1 Порчи.",
    source: "Reality Ripple / Рябь Реальности", reader: ""
  },
  "elite.talantyOderzhimyh.talantyArhetipa.risingTogether": {
    label: "Демон становится Возвышенным (вариации выбирает игрок).",
    source: "Rising Together / Восходя Вместе", reader: ""
  },
  "elite.talantyOderzhimyh.talantyArhetipa.sharedDefense": {
    label: "Доп. Реакция, тратит её только неконтролирующая тело душа (свои Хар-ки/Навыки без Проявления и Даров).",
    source: "Shared Defense / Общая Защита", reader: ""
  },
  "elite.talantyOderzhimyh.talantyArhetipa.sharedPain": {
    label: "В Проявлении: потратить ОБ, уменьшить непоглощённый урон до 1; проигнорированный урон переносится на дух демона.",
    source: "Shared Pain / Общая Боль", reader: ""
  },
  "elite.talantyOderzhimyh.talantyArhetipa.sharedPath": {
    label: "−1 к максимуму Очков Бесчестия, но демон получает 3 своих ОБ (может тратить даже когда телом правит хост).",
    source: "Shared Path / Общий Путь", reader: ""
  },
  "elite.talantyOderzhimyh.talantyArhetipa.sharedSlaughter": {
    label: "В Проявлении считается двумя персонажами для численного превосходства; раз в Ход переброс промаха меньшим WS/BS.",
    source: "Shared Slaughter / Общая Бойня", reader: ""
  },
  "elite.talantyOderzhimyh.talantyArhetipa.sharedSorcery": {
    label: "Неконтролирующая душа раз в Раунд манифестирует психосилу (своб./полу-/полное действие; штраф-простой после полу-/полного).",
    source: "Shared Sorcery / Общее Колдовство", reader: ""
  },
  "elite.talantyOderzhimyh.talantyArhetipa.switch": {
    label: "Хост или демон раз в Ход за свободное действие передаёт контроль над телом другому.",
    source: "Switch / Подменить", reader: ""
  },
  // ── Элитные_архетипы\Архимаг — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.arhimag.exemptus": {
    label: "Умеют вырывать нити, связывающие умирающего псайкера с его дисциплиной, и вплетать в свою душу. Когда в поле зрения умирает другой псайкер,",
    source: "Exemptus / Экземптус", reader: ""
  },
  "elite.elitnyeArhetipy.arhimag.innerEye": {
    label: "Эмпирейный взор фокусируется, не упуская ни одно заклинание. После успешного теста на Пси-Чутьё, может потратить Очко Бесчестия,",
    source: "Inner Eye / Внутренний Глаз", reader: ""
  },
  "elite.elitnyeArhetipy.arhimag.mirrorSoul": {
    label: "Создаёт в Варпе копию своей души, поддерживающую отдельные плетения психической энергии.",
    source: "Mirror Soul / Зеркальная Душа", reader: ""
  },
  "elite.elitnyeArhetipy.arhimag.mysticFeint": {
    label: "Позволяет оставлять ложные следы своего колдовства в Варпе. При манифестации психосилы с Чародейским Посохом может пройти тест Deceive+0,",
    source: "Mystic Feint / Мистический Финт", reader: ""
  },
  "elite.elitnyeArhetipy.arhimag.savantImmaterial": {
    label: "Известен обширным арсеналом психосил и скоростью их освоения. Изучая любую психосилу,",
    source: "Savant Immaterial / Савант Иммматериал", reader: ""
  },
  "elite.elitnyeArhetipy.arhimag.unlimitedPower": {
    label: "Невероятная мистическая сила пробивает контрмеры оппонентов. При манифестации психосилы,",
    source: "Unlimited Power / Безграничная Сила", reader: ""
  },
  // ── Элитные_архетипы\Архимагос — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.arhimagos.archDominus": {
    label: "Когитаторы и банки данных обрабатывают командные данные на множество потоков одновременно.",
    source: "Arch-Dominus / Архи-Доминус", reader: ""
  },
  "elite.elitnyeArhetipy.arhimagos.avatarOfMetal": {
    label: "Разум полностью перехватывает контроль над одним из слуг. В свой Ход может взять под прямой контроль одного из подчинённых,",
    source: "Avatar of Metal / Аватар Металла", reader: ""
  },
  "elite.elitnyeArhetipy.arhimagos.concordax": {
    label: "Достигает истинного машинного единения со слугами, сливая их сознание в единый вычислительный хор.",
    source: "Concordax / Конкордакс", reader: ""
  },
  "elite.elitnyeArhetipy.arhimagos.dogmatix": {
    label: "Мощь бинарных инкантаций сокрушает ноосферное присутствие низших Механикум. Удваивает все Успехи на встречных тестах Tech-Use, как в атаке,",
    source: "Dogmatix / Догматикс", reader: ""
  },
  "elite.elitnyeArhetipy.arhimagos.infernax": {
    label: "Власть над машинами столь велика, что сковывает даже заключённых в них демонов. Считает демонические машины машинами, а не демонами,",
    source: "Infernax / Инфернакс", reader: ""
  },
  "elite.elitnyeArhetipy.arhimagos.visioIrae": {
    label: "Ноосферный облик внушает благоговейный ужас в холодные механические сердца. Может потратить Очко Бесчестия,",
    source: "Visio Irae / Лик Гнева", reader: ""
  },
  // ── Элитные_архетипы\Архонт — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.arhont.ascendOfWeapon": {
    label: "Можно брать до ½ Inf.b (окр. вверх) раз. Беря талант, выбирает любое своё оружие и превращает его в оружие Наследия,",
    source: "Ascend of Weapon / Возвышение Оружия", reader: ""
  },
  "elite.elitnyeArhetipy.arhont.deviousMind": {
    label: "Чувствует использование Очков Бесчестия и Очков Судьбы в радиусе Inf метров. За Реакцию может пройти тест Inf+0 и при успехе отменить эффект…",
    source: "Devious Mind / Коварный Ум", reader: ""
  },
  "elite.elitnyeArhetipy.arhont.fightDieInMyName": {
    label: "Видя, что подчинённые боятся сражаться, в шоке или подавлены огнём, за Свободное действие проходит тест Command(Inf)−30 и при успехе даёт вс…",
    source: "Fight, Die In My Name! / В Бой! Умрите Во Имя Меня!", reader: ""
  },
  "elite.elitnyeArhetipy.arhont.overlord": {
    label: "Может тратить по 3 Очка Боли, чтобы перебрасывать любой свой тест, даже если уже перебрасывал его ранее.",
    source: "Overlord / Повелитель", reader: ""
  },
  "elite.elitnyeArhetipy.arhont.terrifyingPresence": {
    label: "Все подчинённые Архонта, включая его самого, получают +½ Inf (окр. вверх) Архонта на все соревновательные тесты против психосил,",
    source: "Terrifying Presence / Ужасающее Присутствие", reader: ""
  },
  // ── Элитные_архетипы\Берсерк_Кхорна — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.berserkKhorna.bloodOffering": {
    label: "Когда с лезвий стекает кровь жизни, мощь Владыки Резни пробивает барьеры и трюки трусливых чародеев и демонов.",
    source: "Blood Offering / Кровавое Подношение", reader: ""
  },
  "elite.elitnyeArhetipy.berserkKhorna.forHeCaresNot": {
    label: "Кхорн награждает дарящих кровью — как врагов, так и последователей. Когда Берсерк страдает от Кровотечения,",
    source: "For He Cares Not / Ему Не Важно", reader: ""
  },
  "elite.elitnyeArhetipy.berserkKhorna.paintItRed": {
    label: "Лезвия пропитаны жаждой крови. Рукопашное оружие R Dmg наносит Экстремальный Урон, если на любом кубике урона (даже отброшенном) выпало 8 в…",
    source: "Paint It Red / Окрась Всё в Красный", reader: ""
  },
  "elite.elitnyeArhetipy.berserkKhorna.redStreak": {
    label: "Если вооружён рукопашным оружием, наносящим R Dmg, может свободным действием нанести себе 1 непоглощаемого R Dmg и покрыть клинки кровью.",
    source: "Red Streak / Красная Полоса", reader: ""
  },
  "elite.elitnyeArhetipy.berserkKhorna.skullOffering": {
    label: "Череп достойного противника — лучшее подношение Кхорну. Убив в рукопашном бою вражеского командира, чемпиона,",
    source: "Skull Offering / Подношение Черепов", reader: ""
  },
  "elite.elitnyeArhetipy.berserkKhorna.temperedInBlood": {
    label: "Мощь кузницы Кровавого Бога пронизывает оружие сквозь покрывающую его кровь. Если рукопашное оружие R Dmg нанесло хотя бы 1 урона в этом бою…",
    source: "Tempered in Blood / Закалённое в Крови", reader: ""
  },
  // ── Элитные_архетипы\Броненосец — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.bronenosets.chaosGreatbow": {
    label: "Луки обычных смертных неспособны выдержать силу Броненосца. Получив в руки огромный металлический лук,",
    source: "Chaos Greatbow / Великий Лук Хаоса", reader: ""
  },
  "elite.elitnyeArhetipy.bronenosets.chosenFlame": {
    label: "Мощь Богов вливается в оружие Броненосца, манифестируясь на кромках лезвий как призрачное пламя.",
    source: "Chosen Flame / Избранное Пламя", reader: ""
  },
  "elite.elitnyeArhetipy.bronenosets.divineShield": {
    label: "Сила Богов, струящаяся сквозь доспех, вливается в его щит. Экипировав щит, может концентрироваться на нём минуту и трансформировать его: щит…",
    source: "Divine Shield / Божественный Щит", reader: ""
  },
  "elite.elitnyeArhetipy.bronenosets.exaltedPlate": {
    label: "Порча в душе Броненосца проникает в его латы и укрепляет их. Может потратить Очко Бесчестия, чтобы до конца боя или сцены получить +½Cor.",
    source: "Exalted Plate / Возвышенные Латы", reader: ""
  },
  "elite.elitnyeArhetipy.bronenosets.hedgehog": {
    label: "Узкие ломкие шипы вырастают из лат. Броня получает модификацию «Шипы», но наносимый шипами урон получает свойство Crippling (½Cor.b, окр.▲),",
    source: "Hedgehog / Дикобраз", reader: ""
  },
  "elite.elitnyeArhetipy.bronenosets.potence": {
    label: "Мощь божественных лат позволяет использовать двуручное оружие одной рукой. Может использовать двуручное рукопашное оружие или одноручное рук…",
    source: "Potence / Могущество", reader: ""
  },
  "elite.elitnyeArhetipy.bronenosets.riderOfChaos": {
    label: "Сила, дарованная Богами, вливается в его боевого зверя. Может потратить 8 часов, чтобы ритуально посвятить скакуна себе на службу — тот мути…",
    source: "Rider of Chaos / Всадник Хаоса", reader: ""
  },
  "elite.elitnyeArhetipy.bronenosets.sinEater": {
    label: "Могучие владыки Броненосцев черпают силу из душ тех, кого сразили на пути к славе. Когда Броненосец убивает другого чемпиона Хаоса,",
    source: "Sin Eater / Пожиратель Греха", reader: ""
  },
  "elite.elitnyeArhetipy.bronenosets.sorcererSPlate": {
    label: "Латы Броненосцев, искушённых в колдовских практиках, отражаются в эмпиреях, защищая сами их души.",
    source: "Sorcerer's Plate / Латы Чародея", reader: ""
  },
  // ── Элитные_архетипы\Вампир — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.vampir.pactStage1": {
    label: "Укус получает свойства Precise и Razor Sharp, наносит жертве 3d10 урона в W и 2 Обескровливания, а Вампир получает 2 Жажды.",
    source: "Pact Stage 1 / Стадия Пакта 1", reader: ""
  },
  "elite.elitnyeArhetipy.vampir.pactStage2": {
    label: "Совершая укус, может потратить 1 Реакцию, чтобы нанести жертве ещё 1d10 урона в W и 1 Обескровливания, получая ещё 1 Жажды.",
    source: "Pact Stage 2 / Стадия Пакта 2", reader: ""
  },
  "elite.elitnyeArhetipy.vampir.pactStage3": {
    label: "Совершая укус, может потратить 1 Реакцию, чтобы нанести ещё 2d10 урона в W и 2 Обескровливания, получая ещё 2 Жажды. Выпивая жертву до дна,",
    source: "Pact Stage 3 / Стадия Пакта 3", reader: ""
  },
  "elite.elitnyeArhetipy.vampir.pactStage4": {
    label: "При укусе может потратить до 2 Реакций для увеличения урона в W и получения дополнительной Жажды.",
    source: "Pact Stage 4 / Стадия Пакта 4", reader: ""
  },
  "elite.elitnyeArhetipy.vampir.pactStage5": {
    label: "Может пить кровь от любого рукопашного попадания клинковым оружием, а не только укусом (но это не вводит жертву в Ступор и нельзя тратить Ре…",
    source: "Pact Stage 5 / Стадия Пакта 5", reader: ""
  },
  // ── Элитные_архетипы\Варп_Кузнец — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.varpKuznets.cellOfShame": {
    label: "Особо строптивых демонов может обречь на позорную судьбу — быть источником энергии. Потратив 5 Ходов и тест For.Lore(Daemons)−20,",
    source: "Cell of Shame / Ячейка Позора", reader: ""
  },
  "elite.elitnyeArhetipy.varpKuznets.empyreanWhip": {
    label: "Тёмные Механикум держат демонические машины на коротком поводке, в страхе перед эфирной пыткой.",
    source: "Empyrean Whip / Эмпирейная Плеть", reader: ""
  },
  "elite.elitnyeArhetipy.varpKuznets.forgeOfOne": {
    label: "Поле боя — его кузница. Полагаясь только на встроенные в тело инструменты, может в поле проводить ремонт и создание предметов и машин,",
    source: "Forge of One / Кузница Одного", reader: ""
  },
  "elite.elitnyeArhetipy.varpKuznets.runDown": {
    label: "По велению Кузнеца узы впиваются в дух заключённого демона, заставляя вложить частичку сущности в следующий рывок.",
    source: "Run Down / Загнать", reader: ""
  },
  "elite.elitnyeArhetipy.varpKuznets.sigilOfDominion": {
    label: "Может запечатлеть свой образ на железной печати и связать её с духом Сломленного демона.",
    source: "Sigil of Dominion / Печать Владычества", reader: ""
  },
  // ── Элитные_архетипы\Ведьма — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.vedma.agonizingDance": {
    label: "Каждый раз, нанося непоглощённый урон Агонайзером, заставляет цель пройти тест T+10 или получить 1 урон в S, T, A и P.",
    source: "Agonizing Dance / Агонизирующий Танец", reader: ""
  },
  "elite.elitnyeArhetipy.vedma.bloodbride": {
    label: "Может входить в ярость и выходить из неё за Свободное действие, не получает штрафов от Ярости и свободно выбирает противников.",
    source: "Bloodbride / Кровавая Невеста", reader: ""
  },
  "elite.elitnyeArhetipy.vedma.hydrae": {
    label: "Вооружённый Перчаткой Гидры, может вонзать шипы внутрь себя: +1 к урону и пробитию перчатки за каждый шип,",
    source: "Hydrae / Гидрае", reader: ""
  },
  "elite.elitnyeArhetipy.vedma.powerDance": {
    label: "Разрушив вражеское оружие оружием со свойством Power Field, может тестом A+10 совершить атаку в руку противника,",
    source: "Power Dance / Силовой Танец", reader: ""
  },
  "elite.elitnyeArhetipy.vedma.shavingDance": {
    label: "Удерживая бритвоцеп в форме хлыста, может совершить Полную Атаку вокруг, центрируя на себе шаблон Blast,",
    source: "Shaving Dance / Бритвенный Танец", reader: ""
  },
  "elite.elitnyeArhetipy.vedma.yraqnae": {
    label: "Вооружённый Осколочной Сетью и Пронзателем, может за одну атаку атаковать обоими: сначала сетью, затем пронзателем.",
    source: "Yraqnae / Иракнае", reader: ""
  },
  // ── Элитные_архетипы\Ветеран_Долгой_Войны — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.veteranDolgoyVoyny.builderOfBridges": {
    label: "Может обращать (меняя местами десятки и единицы) броски на любые социальные взаимодействия с другими Хаоситами.",
    source: "Builder of Bridges / Строитель Мостов", reader: ""
  },
  "elite.elitnyeArhetipy.veteranDolgoyVoyny.diabolist": {
    label: "В свой Ход может потратить Очко Бесчестия, чтобы до конца боя/сцены иметь возможность обращать (меняя местами десятки и единицы) броски на р…",
    source: "Diabolist / Дьяболист", reader: ""
  },
  "elite.elitnyeArhetipy.veteranDolgoyVoyny.hubReaver": {
    label: "В узких тоннелях улья, коридорах корабля или траншеях Имперской Гвардии чувствует себя как дома. В свой Ход может потратить Очко Бесчестия,",
    source: "Hub Reaver / Разоритель Хабов", reader: ""
  },
  "elite.elitnyeArhetipy.veteranDolgoyVoyny.lordReaper": {
    label: "В свой Ход может потратить Очко Бесчестия, чтобы обращать (меняя местами десятки и единицы) любые броски на действия против рядовых противни…",
    source: "Lord Reaper / Лорд Жнец", reader: ""
  },
  "elite.elitnyeArhetipy.veteranDolgoyVoyny.proselyte": {
    label: "Может обращать (меняя местами десятки и единицы) броски на любые социальные взаимодействия с Имперцами.",
    source: "Proselyte / Прозелит", reader: ""
  },
  "elite.elitnyeArhetipy.veteranDolgoyVoyny.shadowStalker": {
    label: "В свой Ход может потратить Очко Бесчестия, чтобы до конца боя/сцены обращать (меняя местами десятки и единицы) броски на скрытность,",
    source: "Shadow Stalker / Крадущийся в Тенях", reader: ""
  },
  "elite.elitnyeArhetipy.veteranDolgoyVoyny.slayerOfChampions": {
    label: "В свой Ход может потратить Очко Бесчестия и отметить одного противника. До конца боя может обращать (меняя местами десятки и единицы) любые…",
    source: "Slayer of Champions / Убийца Чемпионов", reader: ""
  },
  "elite.elitnyeArhetipy.veteranDolgoyVoyny.warSage": {
    label: "Может обращать (меняя местами десятки и единицы) броски на Знания для распознания способностей противников.",
    source: "War Sage / Боевой Мудрец", reader: ""
  },
  // ── Элитные_архетипы\Виткис — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.vitkis.battleSage": {
    label: "Преимущество на Common Lore (War) механизировано (wdbc-u0by, kind:\"reroll\"/keepBest, skillKey:commonLore) — специализация в отборе не участвует (resolve-test.mjs, тот же компромисс, что у всех групповых записей): срабатывает на любой Common Lore, не только War",
    source: "Battle Sage / Мудрец Битвы",
    reader: "module/rules/item-rules.mjs (kind:\"reroll\" → rollMode-правило общего реестра)"
  },
  "elite.elitnyeArhetipy.vitkis.bloodFeud": {
    label: "Гнев и мудрость сочетаются в его душе, открывая разум к ещё большим тайнам битвы. Когда использует War Seer против Ненавистного врага,",
    source: "Blood Feud / Кровная Вражда", reader: ""
  },
  "elite.elitnyeArhetipy.vitkis.bookOfBattle": {
    label: "Может читать движения врага как раскрытую книгу. Когда использует War Seer для усиления урона или попадания своих рукопашных атак,",
    source: "Book of Battle / Книга Битвы", reader: ""
  },
  "elite.elitnyeArhetipy.vitkis.brothersAtArms": {
    label: "Когда Виткис берёт на себя основную ответственность в битве, Бог Крови вознаграждает его смелость дополнительным прозрением.",
    source: "Brothers at Arms / Братья по Оружию", reader: ""
  },
  "elite.elitnyeArhetipy.vitkis.harderTheyFall": {
    label: "Зная слабые и сильные места противника, использует его размер и вес против него. Когда использует Трейт War Seer против цели Размером больше…",
    source: "Harder They Fall / Тем Больнее Им Падать", reader: ""
  },
  "elite.elitnyeArhetipy.vitkis.splitVision": {
    label: "Может концентрировать своё видение на нескольких врагах или нескольких аспектах боевого стиля одного противника.",
    source: "Split Vision / Разделённое Видение", reader: ""
  },
  "elite.elitnyeArhetipy.vitkis.witchslayer": {
    label: "Комбинируя полученную от Кхорна мудрость и свои знания о ведьмах, может направлять как свой клинок, так и чужие,",
    source: "Witchslayer / Убийца Ведьм", reader: ""
  },
  // ── Элитные_архетипы\Воин_Ноты — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.voinNoty.aria": {
    label: "Рассекая воздух элегантными дугами, клинки издают божественную музыку. Вооружённый клинковым оружием с Балансом не ниже 0,",
    source: "Aria / Ария", reader: ""
  },
  "elite.elitnyeArhetipy.voinNoty.crescendo": {
    label: "Врываясь в рукопашную, сеет смерть стремительными сериями атак. Может совершать Быструю Атаку или Молниеносную Атаку с каждой руки в Ход,",
    source: "Crescendo / Крещендо", reader: ""
  },
  "elite.elitnyeArhetipy.voinNoty.finale": {
    label: "Шок и ужас на лицах врагов питает его тщеславие. Убив или парализовав рукопашной или метательной атакой вражеского чемпиона,",
    source: "Finale / Финале", reader: ""
  },
  "elite.elitnyeArhetipy.voinNoty.leitmotif": {
    label: "Когда чует на себе внимание враждебного чемпиона, Тёмный Принц ниспосылает ему мелодию, раскрывающую секреты противника.",
    source: "Leitmotif / Лейтмотив", reader: ""
  },
  "elite.elitnyeArhetipy.voinNoty.overture": {
    label: "Порченая душа всегда настроена на мелодии, льющиеся сквозь Шесть Кругов Искушения. Может потратить Очко Бесчестия,",
    source: "Overture / Увертюра", reader: ""
  },
  "elite.elitnyeArhetipy.voinNoty.symphony": {
    label: "Под божественную гармонию музыки клинки поражают врагов со сверхъестественной точностью.",
    source: "Symphony / Симфония", reader: ""
  },
  "elite.elitnyeArhetipy.voinNoty.waltz": {
    label: "Лёгкими танцующими движениями обходит телохранителей и свиту, добираясь напрямую к цели.",
    source: "Waltz / Вальс", reader: ""
  },
  // ── Элитные_архетипы\Ворон — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.voron.acupuncture": {
    label: "Точечным иглоукалыванием тонко настраивает механику своего тела и рунических узоров в нём. Может за полудействие поменять текущую Стойку,",
    source: "Acupuncture / Акупунктура", reader: ""
  },
  "elite.elitnyeArhetipy.voron.flowReader": {
    label: "Сквозь биения своей порченной души Ворон более чутко ощущает потоки судьбы. Получает 2 бонусных Очка Бесчестия вместо 1 каждый Ход от Трейта…",
    source: "Flow Reader / Чтец Течения", reader: ""
  },
  "elite.elitnyeArhetipy.voron.hiddenPatterns": {
    label: "Совершенствует сокрытие рунических узоров, дарующих ему силу, скрывая их даже от чувств Одарённых.",
    source: "Hidden Patterns / Скрытые Узоры", reader: ""
  },
  "elite.elitnyeArhetipy.voron.leverage": {
    label: "Техники Ворона позволяют полагаться на навык в приёмах, что требуют грубой силы. Может использовать WS вместо S и Deceive вместо Athletics в…",
    source: "Leverage / Рычаг", reader: ""
  },
  "elite.elitnyeArhetipy.voron.passBy": {
    label: "Уходя из-под атаки, умелым манёвром заставляет врага сделать пару лишних шагов и зайти ему за спину. Избегая рукопашной атаки на 5+ Успехов,",
    source: "Pass By / Пропустить", reader: ""
  },
  "elite.elitnyeArhetipy.voron.redirectBlow": {
    label: "Противники в рукопашной с Вороном должны опасаться не только его, но и друг друга. Когда Ворон связан в рукопашной,",
    source: "Redirect Blow / Перенаправить Удар", reader: ""
  },
  "elite.elitnyeArhetipy.voron.trip": {
    label: "Выбивая врага из баланса выпад за выпадом, Ворон опрокидывает его наземь. Когда побеждает в любом атакующем встречном тесте WS на 5+ Успехов…",
    source: "Trip / Подножка", reader: ""
  },
  "elite.elitnyeArhetipy.voron.twinFate": {
    label: "Постигает ещё более продвинутые техники контроля судьбы своих клинков. Когда тратит Очко Бесчестия для переброса теста WS и результат перебр…",
    source: "Twin Fate / Двойная Судьба", reader: ""
  },
  // ── Элитные_архетипы\Герольд — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.gerold.ancient": {
    label: "Удостаивается чести нести в бой знамя или икону банды. Знамя должно включать геральдику банды, икона — религиозную иконографию.",
    source: "Ancient / Древний", reader: ""
  },
  "elite.elitnyeArhetipy.gerold.greaterHerald": {
    label: "Одним лишь представлением способен возвысить кого-то в глазах слушателей, укрепив его авторитет и репутацию.",
    source: "Greater Herald / Высший Герольд", reader: ""
  },
  "elite.elitnyeArhetipy.gerold.standYourGround": {
    label: "Установив стяг на позицию, провозглашает владычество банды над этим местом. За полудействие может установить знамя/икону на позиции,",
    source: "Stand Your Ground / Ни Шагу Назад", reader: ""
  },
  "elite.elitnyeArhetipy.gerold.tipOfTheSpear": {
    label: "На острие атаки вдохновляет боевых братьев личным примером. Попав по противнику хотя бы одной атакой ближнего боя,",
    source: "Tip Of The Spear / Остриё Копья", reader: ""
  },
  "elite.elitnyeArhetipy.gerold.villainousHonour": {
    label: "Может выжать из побед наибольшее влияние на соратников. Убив вражеского чемпиона, знаменосца или лорда (убив,",
    source: "Villainous Honour / Честь Злодеев", reader: ""
  },
  // ── Элитные_архетипы\Гладиатор — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.gladiator.bestiarius": {
    label: "Обучен сражаться со зверями, ксеносами или демонами, не использующими оружие. Получает удвоенный бонус от Момента на атаки по противникам и…",
    source: "Bestiarius / Бестиарий", reader: ""
  },
  "elite.elitnyeArhetipy.gladiator.dimacherus": {
    label: "Сражается в агрессивном стиле, используя оружие в каждой руке. Если вооружён хотя бы двумя рукопашными оружиями,",
    source: "Dimacherus / Димахер", reader: ""
  },
  "elite.elitnyeArhetipy.gladiator.malearius": {
    label: "Сражается метеоритным молотом, танцуя на его реактивных струях как артист. Вооружённый метеоритным молотом и не нося броню прочнее AP4 ни на…",
    source: "Malearius / Малеарий", reader: ""
  },
  "elite.elitnyeArhetipy.gladiator.militarius": {
    label: "Сражается в оборонительной позиции, используя копьё или винтовку со штыком, изображая имперского гвардейца.",
    source: "Militarius / Милитарий", reader: ""
  },
  "elite.elitnyeArhetipy.gladiator.retiarius": {
    label: "Сражается с расстояния, изматывая врагов оружием на цепях. Присоединив метательное или одноручное рукопашное оружие к броне на своей руке це…",
    source: "Retiarius / Ретиарий", reader: ""
  },
  "elite.elitnyeArhetipy.gladiator.secutorius": {
    label: "Полагается на свой щит, чтобы сблизиться с противником. Вооружённый щитом и рукопашным оружием с Rng не более 3,",
    source: "Secutorius / Секуторий", reader: ""
  },
  // ── Элитные_архетипы\Дикий_Псайкер — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.dikiyPsayker.chainsOfAlacrity": {
    label: "Фокусируя волю на движительных рунах Цепей, перемещается с пугающей скоростью. В начале своего Хода, сразу после регенерации Щита,",
    source: "Chains of Alacrity / Цепи Стремительности", reader: ""
  },
  "elite.elitnyeArhetipy.dikiyPsayker.chainScars": {
    label: "Воспалённая плоть вокруг соединений Порванных Цепей укреплена порчей. Когда получает урон в Характеристики от Трейтов и Талантов этого Архет…",
    source: "Chain Scars / Шрамы Цепей", reader: ""
  },
  "elite.elitnyeArhetipy.dikiyPsayker.deathEater": {
    label: "Порванные Цепи собирают эхо психической энергии от смерти. Если с начала его предыдущего Хода в пределах Cor м умер хотя бы один разумный пе…",
    source: "Death Eater / Пожиратель Смерти", reader: ""
  },
  "elite.elitnyeArhetipy.dikiyPsayker.heartFire": {
    label: "Может перегрузить Цепи, выжав из себя дополнительную психическую силу ценой ускоренного отторжения.",
    source: "Heart Fire / Пламя Сердца", reader: ""
  },
  "elite.elitnyeArhetipy.dikiyPsayker.powerOverwhelming": {
    label: "Высвобождая всю накопленную энергию Цепей, обрушивает психическую мощь апокалиптической силы. Если Щит имеет полный запас Ран,",
    source: "Power Overwhelming / Мощь Переполняет", reader: ""
  },
  "elite.elitnyeArhetipy.dikiyPsayker.residualAbsorption": {
    label: "Учится втягивать в щит остаточные энергии развеянных психосил. Когда в пределах W.b м от него развеивается поддерживаемая психосила,",
    source: "Residual Absorption / Остаточное Поглощение", reader: ""
  },
  "elite.elitnyeArhetipy.dikiyPsayker.witheringCharge": {
    label: "Убийственное касание Цепей иссушает искру жизни, чтобы быстро восстановить заряд Щита. В любой момент, даже вне своего Хода,",
    source: "Withering Charge / Иссушающий Заряд", reader: ""
  },
  // ── Элитные_архетипы\Длань_Архонта — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.dlanArhonta.archsybarite": {
    label: "За каждые 10 слаженности отряда поверх 0 получает Unnatural F (+1) на все тесты командования своим отрядом.",
    source: "Archsybarite / Архисибарит", reader: ""
  },
  "elite.elitnyeArhetipy.dlanArhonta.crimsonDuellist": {
    label: "Вооружённый хотя бы в одной руке бритвоцепом и находясь в рукопашной с 1-2 существами, может за одну реакцию объявить «Багряный Караул».",
    source: "Crimson Duellist / Багряный Дуэлянт", reader: ""
  },
  "elite.elitnyeArhetipy.dlanArhonta.discipleOfYaelindra": {
    label: "Перед боем может пройти тест I+10 и за каждый успех увеличить или дать одному союзнику свойства Felling и Toxic одного оружия на +1,",
    source: "Disciple of Yaelindra / Ученик Яэлиндры", reader: ""
  },
  "elite.elitnyeArhetipy.dlanArhonta.elixicant": {
    label: "Все члены отряда под его руководством получают иммунитет к обычным болезням и +20 на сопротивление остальным.",
    source: "Elixicant / Элексикант", reader: ""
  },
  "elite.elitnyeArhetipy.dlanArhonta.flayer": {
    label: "Всё рукопашное оружие в его руках получает Extreme (8/−1) и Felling (2/+2). Нанося любой экстремальный R урон, увеличивает его на WS.b.",
    source: "Flayer / Свежеватель", reader: ""
  },
  "elite.elitnyeArhetipy.dlanArhonta.kabaliteAgent": {
    label: "Считается имеющим на +1d5 успехов больше в расчёте бонусов от командования Архисибарита. Провалив тест,",
    source: "Kabalite Agent / Агент Кабалит", reader: ""
  },
  "elite.elitnyeArhetipy.dlanArhonta.kabaliteGunner": {
    label: "Удерживая любое друкхарийское оружие типа Длинная Винтовка или Тяжёлое, получает Auto-Stabilized,",
    source: "Kabalite Gunner / Кабалитский Стрелок", reader: ""
  },
  "elite.elitnyeArhetipy.dlanArhonta.skysplinterAssassin": {
    label: "Вооружённый любым осколочным оружием, увеличивает его дальность стрельбы на +20, а темносветовым — на +10.",
    source: "Skysplinter Assassin / Ассасин Клана «Осколок Неба»", reader: ""
  },
  // ── Элитные_архетипы\Житель_Бездны — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.zhitelBezdny.darkFlesh": {
    label: "Автоматически преуспевает в тестах Stealth в местах с уровнем света Тьма. Атакованный оружием со свойством Sanctified,",
    source: "Dark Flesh / Тёмная Плоть", reader: ""
  },
  "elite.elitnyeArhetipy.zhitelBezdny.darkHand": {
    label: "Может использовать Daemonic вместо S.b в расчёте рукопашных атак (модифицируется свойством Mighty и прочими). Добавляет +Dmg,",
    source: "Dark Hand / Тёмная Длань", reader: ""
  },
  "elite.elitnyeArhetipy.zhitelBezdny.doomRunes": {
    label: "Потратив 8 часов на нанесение зелёных рун, делает снаряжение способным находиться в теневом измерении, если его несёт Мандрагора.",
    source: "Doom Runes / Губительные Руны", reader: ""
  },
  "elite.elitnyeArhetipy.zhitelBezdny.heraldOfDarkness": {
    label: "Может получать очки для Губительных способностей даже от противников, убитых губительными способностями.",
    source: "Herald of Darkness / Герольд Тьмы", reader: ""
  },
  "elite.elitnyeArhetipy.zhitelBezdny.hungryDarkness": {
    label: "Все рукопашные атаки получают Corrosive (3/+1) и Crippling (3/+1), а стрелковые на боевой дистанции или в упор — Corrosive (+1) и Crippling…",
    source: "Hungry Darkness / Голодная Тьма", reader: ""
  },
  "elite.elitnyeArhetipy.zhitelBezdny.theHandsOfDeath": {
    label: "Убив противника, обладающего усталостью, получает Multiple Arms (+1) и увеличивает Daemonic (+1). Бонусы складываются до 6 раз,",
    source: "The Hands of Death / Руки Несмерти", reader: ""
  },
  // ── Элитные_архетипы\Иерарх — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.ierarh.aTrainedEye": {
    label: "Снижает редкость любых услуг по поиску профессиональных воинов и наёмников на 1. Снижает требования для получения миньона на один этап для в…",
    source: "A Trained Eye / Наметанный Глаз", reader: ""
  },
  "elite.elitnyeArhetipy.ierarh.convincingArgument": {
    label: "Может потратить 10 Очков Боли и добавить к любому тесту F успехи, равные значению его Unnatural (F).",
    source: "Convincing Argument / Убедительный Аргумент", reader: ""
  },
  "elite.elitnyeArhetipy.ierarh.pleaseAtAnyCost": {
    label: "Если Архонт просит или требует реквизировать что-то до R4, Иерарх может начать особое задание по поиску этого предмета и гарантированно выйд…",
    source: "Please At Any Cost! / Угодить Любой Ценой!", reader: ""
  },
  "elite.elitnyeArhetipy.ierarh.sophisticatedSpeech": {
    label: "Получает бонус к тестам F, равный разнице F между ним и собеседником в свою пользу. Если F противника больше, бонуса нет.",
    source: "Sophisticated Speech / Утончённая Речь", reader: ""
  },
  "elite.elitnyeArhetipy.ierarh.theContractNetwork": {
    label: "Получает доступ к любым ресурсам до R2 и любому снаряжению до R1 через свою сеть контрактов, которая заполняет траты сама.",
    source: "The Contract Network / Сеть Контрактов", reader: ""
  },
  "elite.elitnyeArhetipy.ierarh.whateverYouWant": {
    label: "Когда Архонт требует пройти тест на реквизицию для удовлетворения своих нужд, персонаж получает бонус F.b×2 + Inf.b Архонта на этот тест.",
    source: "Whatever You Want / Что Захотите", reader: ""
  },
  // ── Элитные_архетипы\Иерофант — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.ierofant.bloodOfMartyrs": {
    label: "Верные последователи готовы отдать за него жизнь. Когда находится в Орде, созданной Трейтом Великий Агитатор,",
    source: "Blood of Martyrs / Кровь Мучеников", reader: ""
  },
  "elite.elitnyeArhetipy.ierofant.hail": {
    label: "Даже обычные булыжники становятся смертельным оружием, когда их метает толпа. Орды под Командным Присутствием могут отказываться от части ст…",
    source: "Hail / Град", reader: ""
  },
  "elite.elitnyeArhetipy.ierofant.livingTide": {
    label: "Фанатичные орды сметают стены и укрепления и порой переворачивают танки. Может использовать доп. детальную команду (2 Успеха),",
    source: "Living Tide / Живая Волна", reader: ""
  },
  "elite.elitnyeArhetipy.ierofant.mobJustice": {
    label: "Ненависть, взращённая в душах, даёт плоды, когда они проливают кровь угнетателей. Когда Орда под его командованием имеет Талант Hatred и уби…",
    source: "Mob Justice / Правосудие Толпы", reader: ""
  },
  "elite.elitnyeArhetipy.ierofant.profaneCardinal": {
    label: "По мере совращения паствы его власть над их душами крепнет. Получает бонус к тестам командования и взаимодействия с паствой Хаосопоклонников…",
    source: "Profane Cardinal / Нечестивый Кардинал", reader: ""
  },
  "elite.elitnyeArhetipy.ierofant.zealousMasses": {
    label: "Заведённые проповедями орды бросаются на врагов, невзирая на опасность. Может потратить Очко Бесчестия,",
    source: "Zealous Masses / Фанатичные Толпы", reader: ""
  },
  // ── Элитные_архетипы\Избиратель_Плоти — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.izbiratelPloti.anyHandsAnyKind": {
    label: "Может использовать для ритуалов бионические и металлические руки. Отсекая кому-либо физическую (не энергетическую) руку во время битвы,",
    source: "Any Hands... Any Kind! / Любые Руки… Любые!", reader: ""
  },
  "elite.elitnyeArhetipy.izbiratelPloti.devouringOfLife": {
    label: "Когда в радиусе 25 метров кто-то получает критический эффект R, персонаж может пройти тест W+20 и при успехе нанести противнику непоглощаемы…",
    source: "Devouring of Life / Поглощение Жизни", reader: ""
  },
  "elite.elitnyeArhetipy.izbiratelPloti.dissection": {
    label: "Получает приём «Рассечение» (база: Обычная Атака, Полная Атака, Натиск; оружие: меч в двуручном хвате).",
    source: "Dissection / Рассечение", reader: ""
  },
  "elite.elitnyeArhetipy.izbiratelPloti.fieryWounds": {
    label: "Рукопашные атаки получают свойство Flame (1d10+I.b). Это пламя не подчиняется законам физики: горит под водой,",
    source: "Fiery Wounds / Огненные Раны", reader: ""
  },
  "elite.elitnyeArhetipy.izbiratelPloti.rottingLife": {
    label: "Нанося непоглощённый урон, также наносит противнику гангрену, если это возможно. Провалив тест от Огненной Раны,",
    source: "Rotting Life / Гниющая Жизнь", reader: ""
  },
  "elite.elitnyeArhetipy.izbiratelPloti.theCursedHand": {
    label: "Может модифицировать ритуал, используя руки Best.Q своих жертв. Одна рука даёт на выбор: считаться ассистентом-ритуалистом со всеми нужными…",
    source: "The Cursed Hand / Проклятая Рука", reader: ""
  },
  // ── Элитные_архетипы\Инзорцист — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.inzortsist.blackHand": {
    label: "Касание открывает демонам путь к душе врага. Касаясь другого персонажа, может провести Инзорцизм,",
    source: "Black Hand / Чёрная Рука", reader: ""
  },
  "elite.elitnyeArhetipy.inzortsist.daemonicLevy": {
    label: "Призыв могучего демона открывает путь для его свиты. Призывая Инзорцизмом демона с Inf 31+,",
    source: "Daemonic Levy / Демоническое Ополчение", reader: ""
  },
  "elite.elitnyeArhetipy.inzortsist.fleetingPossession": {
    label: "Проводя Инзорцизм, может вместо призыва в Истинной Форме вселить демона в оружие в руках или машину, которой касается.",
    source: "Fleeting Possession / Мимолётная Одержимость", reader: ""
  },
  // ── Элитные_архетипы\Инкуб — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.inkub.coldFace": {
    label: "Увеличивает снижение рейтинга страха всех существ до −2, включая демонов. Не распространяется на Высших Демонов.",
    source: "Cold Face / Холодное Лицо", reader: ""
  },
  "elite.elitnyeArhetipy.inkub.discipleTormentor": {
    label: "Когда противник, чей Inf ниже Inf персонажа, начинает свой ход в рукопашном бою с Инкубом, он проходит тест против страха персонажа.",
    source: "Disciple Tormentor / Ученик Мучителя", reader: ""
  },
  "elite.elitnyeArhetipy.inkub.klaivex": {
    label: "Может использовать WS в тестах командования остальными Инкубами и помогать в обучении искусству Инкубов, снижая цену архетипа Инкуб вдвое.",
    source: "Klaivex / Клэйвекс", reader: ""
  },
  "elite.elitnyeArhetipy.inkub.letSFinishItFaster": {
    label: "В начале битвы может отказаться от всех Очков Боли и не получать их в течение всей битвы, взамен получив +WS.",
    source: "Let's Finish It Faster / Закончим Быстрее", reader: ""
  },
  "elite.elitnyeArhetipy.inkub.swordDuel": {
    label: "Находясь в рукопашной схватке, получает неперегружаемый колдовской щит-дефлектор, равный A.b×3, срабатывающий против всех стрелковых атак,",
    source: "Sword Duel / Дуэль Мечей", reader: ""
  },
  "elite.elitnyeArhetipy.inkub.theTeachingsOfArhra": {
    label: "Получает Путь Жалящих Скорпионов на уровне Мастер — а точнее, только его бонусы.",
    source: "The Teachings of Arhra / Учения Архры", reader: ""
  },
  // ── Элитные_архетипы\Кенетаи — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.kenetai.bladesOfBrotherhood": {
    label: "Мистическая сила клинков перетекает в клинки братьев по оружию. Манифестируя Психический Клинок на своё оружие,",
    source: "Blades of Brotherhood / Клинки Братства", reader: ""
  },
  "elite.elitnyeArhetipy.kenetai.focusedStorm": {
    label: "Заклинания с лезвия Оккультного Клинка фокусируют мощь в точку. При использовании Оккультного Клинка для манифестации Психического Шторма ил…",
    source: "Focused Storm / Фокусированный Шторм", reader: ""
  },
  "elite.elitnyeArhetipy.kenetai.soulThrust": {
    label: "Клинок пробивает не только плоть, но и психическую защиту. Если попадает приёмом Выпад и использует Оккультный Клинок для манифестации психо…",
    source: "Soul Thrust / Выпад Души", reader: ""
  },
  "elite.elitnyeArhetipy.kenetai.spellBreaker": {
    label: "Клинок разрубает нити заклинаний, опутывающих цель. При использовании Оккультного Клинка может вместо манифестации пройти психотест W+0 vs W…",
    source: "Spell Breaker / Разрушитель Чар", reader: ""
  },
  "elite.elitnyeArhetipy.kenetai.wayOfTwoBlades": {
    label: "Подобно Кенетаи Ордена Шакала, идёт в бой с двумя Психосиловыми клинками. Может применять Оккультный Клинок два раза в Раунд,",
    source: "Way of Two Blades / Путь Двух Клинков", reader: ""
  },
  "elite.elitnyeArhetipy.kenetai.wideBerth": {
    label: "Незримые нити, связывающие сознания, поддерживают связь на большем расстоянии. Удваивает радиус действия Трейта Общее Сознание.",
    source: "Wide Berth / Пространство для Маневра", reader: ""
  },
  // ── Элитные_архетипы\Когитор — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.kogitor.cogitorPactStage1": {
    label: "Продолжает трансформироваться в конструкта: кровеносная и нервная системы превращаются в сети металлических трубок и проводов,",
    source: "Cogitor Pact Stage 1 / Стадия Пакта 1 (Когитор)", reader: ""
  },
  "elite.elitnyeArhetipy.kogitor.cogitorPactStage2": {
    label: "Трансформация расширяется: кости становятся металлическими, мышцы превращаются в пучки ЭФМ или гидравлики,",
    source: "Cogitor Pact Stage 2 / Стадия Пакта 2 (Когитор)", reader: ""
  },
  "elite.elitnyeArhetipy.kogitor.cogitorPactStage3": {
    label: "Последние остатки плоти обращаются в машинную форму: кожа превращается в металлическую ткань, глаза — в кристаллические сенсоры,",
    source: "Cogitor Pact Stage 3 / Стадия Пакта 3 (Когитор)", reader: ""
  },
  "elite.elitnyeArhetipy.kogitor.cogitorPactStage4": {
    label: "Кости и мышцы трансмутируют в конструкты из сияющих кристаллов и колдовского пламени, частично просвечивающие через трещины в коже,",
    source: "Cogitor Pact Stage 4 / Стадия Пакта 4 (Когитор)", reader: ""
  },
  "elite.elitnyeArhetipy.kogitor.cogitorPactStage5": {
    label: "Полностью трансформируется в конструкт из сияющих кристаллов и колдовского пламени и даже поглощает всё снаряжение,",
    source: "Cogitor Pact Stage 5 / Стадия Пакта 5 (Когитор)", reader: ""
  },
  // ── Элитные_архетипы\Когнитэ — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.kognite.corruptedCall": {
    label: "Позволяет программировать пленных Астропатов для подмены имперских сообщений. При Гипно-Программировании Астропата может потратить 3 Успеха,",
    source: "Corrupted Call / Искаженный Зов", reader: ""
  },
  "elite.elitnyeArhetipy.kognite.perfectMask": {
    label: "Комбинацией технологии и колдовства создаёт сложную обвязку, проецирующую ложный образ носителя в реальность.",
    source: "Perfect Mask / Совершенная Маска", reader: ""
  },
  "elite.elitnyeArhetipy.kognite.proxyVeil": {
    label: "Глубоким гипнозом сооружает подставную личность в сознании союзника. Потратив Очко Бесчестия и 4 часа работы,",
    source: "Proxy Veil / Замещающая Вуаль", reader: ""
  },
  "elite.elitnyeArhetipy.kognite.teacher": {
    label: "Талант в обучении, натаскивающий компетентных агентов за считанные дни. Проводит сеанс обучения за 1 час вместо 1 смены,",
    source: "Teacher / Учитель", reader: ""
  },
  "elite.elitnyeArhetipy.kognite.thousandPapercuts": {
    label: "Способны поставить на службу имперскую бюрократию. Успешно внедрившись в местный Администратум (может занять целую миссию),",
    source: "Thousand Papercuts / Тысяча Бумажных Порезов", reader: ""
  },
  // ── Элитные_архетипы\Коготь_Варпа — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.kogotVarpa.rift": {
    label: "Впиваясь в разлом реальности, обрушивает его внутрь себя, вызывая взрыв Варп-энергий. Когда открывает разрыв в Варп,",
    source: "Rift / Разлом", reader: ""
  },
  "elite.elitnyeArhetipy.kogotVarpa.speedOfThought": {
    label: "Расстояние и время лишены смысла в Варпе. Находясь в Варпе, может потратить полное действие и пройти тест Navigation(Warp)+0,",
    source: "Speed of Thought / Со Скоростью Мысли", reader: ""
  },
  "elite.elitnyeArhetipy.kogotVarpa.vulture": {
    label: "Может восстанавливать мистические силы, поглощая частицы души жертвы после смерти. Получает ½Cor.b (окр.▲) дополнительных Очков Бесчестия,",
    source: "Vulture / Стервятник", reader: ""
  },
  "elite.elitnyeArhetipy.kogotVarpa.warpFlash": {
    label: "Раны в реальности, открываемые Когтями Варпа, выпускают наружу противоестественный не-свет, пожирающий обычное освещение.",
    source: "Warp Flash / Варп Вспышка", reader: ""
  },
  "elite.elitnyeArhetipy.kogotVarpa.warpTrail": {
    label: "Может преследовать жертв по следу, что оставляют их души. Может пройти тест Awareness−30,",
    source: "Warp Trail / Варп-След", reader: ""
  },
  // ── Элитные_архетипы\Колдун_Рубрики — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.koldunRubriki.infernalShells": {
    label: "Инферно-болты Тзинча поражают душу и являются ключевым инструментом для резьбы. При наличии минимальных инструментов может потратить 1 час,",
    source: "Infernal Shells / Инфернальные Снаряды", reader: ""
  },
  "elite.elitnyeArhetipy.koldunRubriki.nexusOfSouls": {
    label: "Связь с одним из големов укреплена ритуалами, объединяющими их разумы и души. Голем действует в Инициативу колдуна и является его Псайбером.",
    source: "Nexus Of Souls / Узы Душ", reader: ""
  },
  "elite.elitnyeArhetipy.koldunRubriki.psychicEcho": {
    label: "Сотворив заклинание, направляет энергии сквозь душу голема. Раз в Ход после успешной манифестации психосилы может усилить регенерацию одного…",
    source: "Psychic Echo / Психическое Эхо", reader: ""
  },
  "elite.elitnyeArhetipy.koldunRubriki.rebornInDust": {
    label: "За полное действие может потратить Очко Бесчестия и пройти психотест W−20 в Усиленном режиме,",
    source: "Reborn in Dust / Возрождён во Прахе", reader: ""
  },
  "elite.elitnyeArhetipy.koldunRubriki.sekhmet": {
    label: "Освоил вселение душ големов в более продвинутые доспехи. Может создавать големов в Терминаторских Доспехах вместо обычных силовых.",
    source: "Sekhmet / Сехмет", reader: ""
  },
  // ── Элитные_архетипы\Король_Червей — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.korolChervey.freeRoamer": {
    label: "Может отпустить один из конструктов из-под прямого контроля, убрав его из лимита Cor.b.",
    source: "Free Roamer / Свободный Скиталец", reader: ""
  },
  "elite.elitnyeArhetipy.korolChervey.kingSPlate": {
    label: "Один из Роёв обволакивает его и становится живым доспехом из хитина и мышц. За полудействие поглощает один Рой в базовом контакте: рой уничт…",
    source: "King's Plate / Латы Короля", reader: ""
  },
  "elite.elitnyeArhetipy.korolChervey.maggotMark": {
    label: "Может создать крохотного опарыша и одарить им слугу или союзника. Опарыш зарывается в плоть и отмечает носителя как союзника для конструктов…",
    source: "Maggot Mark / Метка Опарыша", reader: ""
  },
  "elite.elitnyeArhetipy.korolChervey.shellGuard": {
    label: "За три полных действия один из Роёв под прямым контролем поглощает от 200 кг плоти и окукливается (куколка беспомощна, теряет Трейт Swarm).",
    source: "Shell Guard / Стражи Панциря", reader: ""
  },
  "elite.elitnyeArhetipy.korolChervey.wormwalker": {
    label: "За полное действие один из Роёв растекается и набрасывается на трупы в радиусе 7м, забираясь внутрь и замещая мышцы и органы чувств.",
    source: "Wormwalker / Червеход", reader: ""
  },
  // ── Элитные_архетипы\Кузнец_Крови — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.kuznetsKrovi.bloodShield": {
    label: "Утоляя голод демонического оружия кровью врагов, создаёт кокон из кровавых нитей, поглощающий удары.",
    source: "Blood Shield / Кровавый Щит", reader: ""
  },
  "elite.elitnyeArhetipy.kuznetsKrovi.boundByBlood": {
    label: "Узы порабощённого демона с Кузнецом пробивают Завесу, позволяя протащить демона обратно в реальность через существующую трещину.",
    source: "Bound by Blood / Связанный Кровью", reader: ""
  },
  "elite.elitnyeArhetipy.kuznetsKrovi.daemonPlate": {
    label: "Может вселить порабощённого демона в любой полный доспех. Такой демонический доспех даёт владельцу Трейты Daemonic,",
    source: "Daemon Plate / Демонические Латы", reader: ""
  },
  "elite.elitnyeArhetipy.kuznetsKrovi.fealty": {
    label: "Поработив демона в схватке, может потребовать его Истинное Имя, и тот обязан его раскрыть.",
    source: "Fealty / Присяга", reader: ""
  },
  "elite.elitnyeArhetipy.kuznetsKrovi.unforge": {
    label: "Одного слова достаточно, чтобы разрушить своё демоническое оружие. Раз в Ход за свободное действие может уничтожить одно демоническое оружие…",
    source: "Unforge / Расковать", reader: ""
  },
  // ── Элитные_архетипы\Лакрималлус — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.lakrimallus.assemblyLine": {
    label: "Программирует рабов на простое независимое производство. Орды Миньонов тех-траллов пассивно генерируют 1 Успех за каждые 3 Магнитуды в сутки…",
    source: "Assembly Line / Сборочная Линия", reader: ""
  },
  "elite.elitnyeArhetipy.lakrimallus.chainsOfProduction": {
    label: "Модифицирует рабов минимальной кибернетикой для Ноосферной синхронизации. За 1 минуту может аугментировать человека,",
    source: "Chains of Production / Цепи Производства", reader: ""
  },
  "elite.elitnyeArhetipy.lakrimallus.cyberShepherd": {
    label: "Командные алгоритмы позволяют дирижировать ордами траллов в бою. Может давать Команды Ордам тех-траллов,",
    source: "Cyber-Shepherd / Кибер-Пастырь", reader: ""
  },
  "elite.elitnyeArhetipy.lakrimallus.inhumanResources": {
    label: "Продвинутые хирургические алгоритмы позволяют рациональнее расходовать плоть мёртвых.",
    source: "Inhuman Resources / Бесчеловечные Ресурсы", reader: ""
  },
  "elite.elitnyeArhetipy.lakrimallus.rapidEmbrace": {
    label: "Если имеет медицинский механодендрит и 2 механодендрита, может вместо 1 минуты потратить на подъём тех-тралла из трупов в пределах 3м от себ…",
    source: "Rapid Embrace / Быстрые Объятья", reader: ""
  },
  "elite.elitnyeArhetipy.lakrimallus.thrallOverclock": {
    label: "Алгоритмы оптимизации понукают траллов к повышенной эффективности ценой износа. Тех-траллы и Орды могут перебрасывать тесты,",
    source: "Thrall Overclock / Разгон Траллов", reader: ""
  },
  // ── Элитные_архетипы\Ламия — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.lamiya.crueltyOfThePoison": {
    label: "Если жертва имеет свойство Отравление, все Toxic против неё получают +2 к рейтингу, а сама жертва — штраф −20 на сопротивление всем ядам.",
    source: "Cruelty of the Poison / Жестокость Яда", reader: ""
  },
  "elite.elitnyeArhetipy.lamiya.daughterOfShiamesh": {
    label: "Если жертва получает дозу Детокса против яда персонажа, бросьте 1d10: на 1-8 детокс не выводит яд.",
    source: "Daughter of Shiamesh / Дочь Шаимеш", reader: ""
  },
  "elite.elitnyeArhetipy.lamiya.handsInAPoison": {
    label: "Иммунен ко всем ядам R2 и ниже, а также ко всем ядам низших рас R3 и ниже. Автоматически распознаёт яд, пытающийся на него воздействовать.",
    source: "Hands In A Poison / Руки В Яде", reader: ""
  },
  "elite.elitnyeArhetipy.lamiya.lhamaeanKiss": {
    label: "Целуя другого персонажа в губы, может пройти тест Trade (Chymist)(I)+10 vs T+0 (против яда) и за каждый успех нанести 1d5 непоглощаемого C(T…",
    source: "Lhamaean Kiss / Ламеянский Поцелуй", reader: ""
  },
  "elite.elitnyeArhetipy.lamiya.saltOnTheWound": {
    label: "Пробив вражескую броню и нанеся непоглощённый урон, может пройти тест A+10 и достать флакон с ядом вектора Рана или Контакт,",
    source: "Salt On The Wound / Соль На Рану", reader: ""
  },
  "elite.elitnyeArhetipy.lamiya.shardOfPoison": {
    label: "Потратив 8 часов работы, может заменить кристалл осколочного оружия, окунув его в любой имеющийся яд. Нужно 150 доз яда с вектором Инъекция,",
    source: "Shard of Poison / Осколок Яда", reader: ""
  },
  // ── Элитные_архетипы\Лорд_Дискордант — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.lordDiskordant.discordantDuo": {
    label: "Опытный Лорд-Дискордант умеет делиться дарами своей судьбы со скакуном. Верхом на Адском Сталкере может тратить свои Очки Бесчестия на эффек…",
    source: "Discordant Duo / Дискордантный Дуэт", reader: ""
  },
  "elite.elitnyeArhetipy.lordDiskordant.hellbound": {
    label: "Сделки с Кузницей Душ дают доступ к продвинутым ритуалам связывания демона с машиной. Может за смену работы отметить машину доп.",
    source: "Hellbound / Адосвязанный", reader: ""
  },
  "elite.elitnyeArhetipy.lordDiskordant.stalkersmith": {
    label: "Даже лишённый скакуна легко его заменит за счёт рутин создания оболочки и ритуала вселения. Делает тесты Крафта оболочки Адского Сталкера,",
    source: "Stalkersmith / Кузнец Сталкеров", reader: ""
  },
  "elite.elitnyeArhetipy.lordDiskordant.torturedSpirit": {
    label: "Вырывает духи машин вместе с когитаторами из избранных повреждённых им машин и встраивает их в оболочку Адского Сталкера.",
    source: "Tortured Spirit / Истерзанный Дух", reader: ""
  },
  // ── Элитные_архетипы\Малагра — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.malagra.fellDischarge": {
    label: "Может обратить сердце мотивирующей силы Механикум против него самого. Успешно используя Numerica Dominion,",
    source: "Fell Discharge / Жестокая Разрядка", reader: ""
  },
  "elite.elitnyeArhetipy.malagra.iovex": {
    label: "Мощь мотивирующей силы покоряется его воле. Когда Совершенная Катушка активирована, может увеличивать урон всех Люминен Техночудес на 1d10 и…",
    source: "Iovex / Йовекс", reader: ""
  },
  "elite.elitnyeArhetipy.malagra.magnetomorphosis": {
    label: "Мастерство в манипуляции магнитными полями не знает равных. Активируя Ferric Commandment, вместо двух магнитных рук получает I.",
    source: "Magnetomorphosis / Магнитоморфоз", reader: ""
  },
  "elite.elitnyeArhetipy.malagra.prescontax": {
    label: "Мысли и тайны Механикум открыты перед Малагрой. Используя Numerica Delving, чтобы прочесть память жертвы,",
    source: "Prescontax / Пресконтакс", reader: ""
  },
  "elite.elitnyeArhetipy.malagra.rogoex": {
    label: "Раскрывает функции поведенческих анализаторов в кортексе, позволяющие предсказывать мыслительные процессы других посвящённых.",
    source: "Rogoex / Рогоекс", reader: ""
  },
  "elite.elitnyeArhetipy.malagra.venefactor": {
    label: "Рутины таинств Бога Машины выжжены в схемах и памяти, став столь же естественными, как работа респираторного блока.",
    source: "Venefactor / Вэнефактор", reader: ""
  },
  // ── Элитные_архетипы\Мастер_Казней — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.masterKazney.finalExecution": {
    label: "Обрушивает удары нарастающей мощи. Совершая атаку Казнью, может потратить Очко Трофеев,",
    source: "Final Execution / Окончательная Казнь", reader: ""
  },
  "elite.elitnyeArhetipy.masterKazney.markedPrey": {
    label: "За свободное действие может потратить очко Трофеев, чтобы отметить достойную трофея цель в прямой видимости или Трейта Unnatural Senses,",
    source: "Marked Prey / Отмеченная Добыча", reader: ""
  },
  "elite.elitnyeArhetipy.masterKazney.mistLeap": {
    label: "За полное действие может потратить очко Трофеев и телепортироваться Трейтом Mistwalker в базовый контакт с достойной трофея добычей в предел…",
    source: "Mist Leap / Туманный Прыжок", reader: ""
  },
  "elite.elitnyeArhetipy.masterKazney.mistSavior": {
    label: "Служащие телохранителями Мастера Казней подменяют собой союзников. Приняв на себя удар Трейтом Fanatic, может поменяться с целью местами,",
    source: "Mist Savior / Спаситель Туманов", reader: ""
  },
  "elite.elitnyeArhetipy.masterKazney.trophiesOfJudgement": {
    label: "Включает доп. ритуалы в обряды трофеев, черпая силу из казней преступивших законы банды. Честно (по мнению ГМа) определив вину члена банды,",
    source: "Trophies of Judgement / Трофеи Приговора", reader: ""
  },
  "elite.elitnyeArhetipy.masterKazney.trophiesOfTriumph": {
    label: "Сила Богов позволяет извлекать больше силы из достойных трофеев. Убив достойную трофея цель с Inf 30-59, получает 2 очка Трофеев;",
    source: "Trophies of Triumph / Трофеи Триумфа", reader: ""
  },
  // ── Элитные_архетипы\Медуза — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.meduza.alienConsciousnessAlienPowers": {
    label: "Медуза игнорирует все психосилы Телепатии, применяя свои эффекты на противников как обычно и игнорируя урон от телепатических сил.",
    source: "Alien Consciousness, Alien Powers / Чуждое Сознание, Чуждые Силы", reader: ""
  },
  "elite.elitnyeArhetipy.meduza.emotionalExplosion": {
    label: "Получает дополнительную атаку для трейта Эмпат — Emotional Explosion (Exotic Пистолет, дальность 70 м, S/–/–, Незримая).",
    source: "Emotional Explosion / Эмоциональный Взрыв", reader: ""
  },
  "elite.elitnyeArhetipy.meduza.emotionalVision": {
    label: "Получает Unnatural Senses (W), реагирующее на всех живых существ, способных ощущать эмоции — даже слабые и холодные вроде прагматизма.",
    source: "Emotional Vision / Эмоциональное Зрение", reader: ""
  },
  "elite.elitnyeArhetipy.meduza.extremeSensations": {
    label: "Когда во время битвы вражеский псайкер впервые получает критический эффект, медуза может пройти тест W+10 и при успехе немедленно объявить с…",
    source: "Extreme Sensations / Экстремальные Ощущения", reader: ""
  },
  "elite.elitnyeArhetipy.meduza.materialWreck": {
    label: "Получает изменённую версию Волны Эмпатии, теряющую Warp Weapon и наносящую урон вражеской технике.",
    source: "Material Wreck / Материальное Крушение", reader: ""
  },
  // ── Элитные_архетипы\Мейстер — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.meyster.maesterPactStage1": {
    label: "Получает видение диковинного аппарата, который может за смену работы собрать из медицинских инструментов и подручных материалов.",
    source: "Maester Pact Stage 1 / Стадия Пакта 1 (Мейстер)", reader: ""
  },
  "elite.elitnyeArhetipy.meyster.maesterPactStage2": {
    label: "Может вкалывать инъекции Вируса Жизни в любое существо, а не только в пациента, под которого они приготовлены,",
    source: "Maester Pact Stage 2 / Стадия Пакта 2 (Мейстер)", reader: ""
  },
  "elite.elitnyeArhetipy.meyster.maesterPactStage3": {
    label: "Вместо восстановления 3 Аблативных Ран Прожектором (бесплатным или за полудействие) может выбрать: цель немедленно пытается вылечиться Трейт…",
    source: "Maester Pact Stage 3 / Стадия Пакта 3 (Мейстер)", reader: ""
  },
  "elite.elitnyeArhetipy.meyster.maesterPactStage4": {
    label: "Отныне считается демоном в Хосте собственного тела и получает Трейт Daemonic (3). При смерти или изгнании может быть призван как низший демо…",
    source: "Maester Pact Stage 4 / Стадия Пакта 4 (Мейстер)", reader: ""
  },
  "elite.elitnyeArhetipy.meyster.maesterPactStage5": {
    label: "Когда тратит полудействие на дополнительное использование Прожектора в Ход, может применять эти срабатывания на другие цели,",
    source: "Maester Pact Stage 5 / Стадия Пакта 5 (Мейстер)", reader: ""
  },
  // ── Элитные_архетипы\Монарх — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.monarh.awakening": {
    label: "Электростимуляцией и ослаблением рунических цепей пробуждает вассала к полному бодрствованию.",
    source: "Awakening / Пробуждение", reader: ""
  },
  "elite.elitnyeArhetipy.monarh.cerebralChanneling": {
    label: "Тонкая калибровка контрольных цепей Короны позволяет эффективнее координировать долговременные усилия вассалов.",
    source: "Cerebral Channeling / Церебральный Поток", reader: ""
  },
  "elite.elitnyeArhetipy.monarh.dragonMonarch": {
    label: "Может одновременно контролировать несколько подключённых мозгов. Позволяет одновременно активировать ещё одного порабощённого псайкера (кажд…",
    source: "Dragon Monarch / Монарх Дракон", reader: ""
  },
  "elite.elitnyeArhetipy.monarh.neuronist": {
    label: "Научился обучать одного из вассалов. Может тратить свой опыт, чтобы изучать новые психосилы для одного из своих псайкеров.",
    source: "Neuronist / Нейронист", reader: ""
  },
  // ── Элитные_архетипы\Моритат — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.moritat.beltFeed": {
    label: "Модифицирует ранец для хранения болтов или пуль и создаёт продвинутую ленту, подающую патроны.",
    source: "Belt Feed / Ленточное Питание", reader: ""
  },
  "elite.elitnyeArhetipy.moritat.flyBy": {
    label: "Способен танцевать в воздухе вокруг врагов, появляясь в их поле зрения на долю секунды для меткого выстрела и скрываясь от ответного огня.",
    source: "Fly-By / Пролётом", reader: ""
  },
  "elite.elitnyeArhetipy.moritat.lightningFingers": {
    label: "Может применять Таланты Quick Draw и Quick Store к пистолетам с питанием от кабеля или ленты и не получает штрафов на вытягивание и складыва…",
    source: "Lightning Fingers / Молниеносные Пальцы", reader: ""
  },
  "elite.elitnyeArhetipy.moritat.loneWarrior": {
    label: "Полагается только на себя. Когда в пределах 15м нет ни одного дружественного персонажа, не получает преимуществ дружественных психосил,",
    source: "Lone Warrior / Одинокий Воин", reader: ""
  },
  "elite.elitnyeArhetipy.moritat.mortido": {
    label: "Танцует на грани верной гибели. В начале своего Хода, если в его поле зрения есть противники, может потратить все свои Реакции,",
    source: "Mortido / Мортидо", reader: ""
  },
  "elite.elitnyeArhetipy.moritat.outgun": {
    label: "Винтовки движутся в руках с лёгкостью и грацией пистолетов. Может считать любую винтовку, которую держит в одной руке,",
    source: "Outgun / Огневая Мощь", reader: ""
  },
  // ── Элитные_архетипы\Ночной_Демон — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.nochnoyDemon.darknessIsOurHome": {
    label: "Находясь во Тьме, получает Unnatural S и T (+4) от неестественных нитей тьмы. До F.b Мандрагор по воле персонажа могут получить этот бонус.",
    source: "Darkness is Our Home / Тьма Дом Родной", reader: ""
  },
  "elite.elitnyeArhetipy.nochnoyDemon.freezeTheBlood": {
    label: "Получив попадание от рукопашной атаки персонажа, цель проходит тест T−20 (против холода) или получает на Провалы раундов следующие эффекты:…",
    source: "Freeze the Blood / Заморозить Кровь", reader: ""
  },
  "elite.elitnyeArhetipy.nochnoyDemon.shimmeringBodies": {
    label: "Получает бонусы на уворот (бонус и преимущество) даже при Тусклом или Искусственном Свете, а Слабый Свет считает за Тьму.",
    source: "Shimmering Bodies / Мерцающие Тела", reader: ""
  },
  "elite.elitnyeArhetipy.nochnoyDemon.skullsToTheThroneOfMandrakes": {
    label: "Убив существо с Inf 40 и выше, за полудействие может отрезать и освежевать его голову. Собирая черепа в одном месте,",
    source: "Skulls to the Throne of Mandrakes / Черепа Трону Мандрагор", reader: ""
  },
  "elite.elitnyeArhetipy.nochnoyDemon.theColdOfDarkness": {
    label: "В радиусе 24 метров существует аура абсолютного холода, сравнимого с сильной зимой арктического мира. Мандрагоры к нему иммунны; остальные,",
    source: "The Cold of Darkness / Холод Тьмы", reader: ""
  },
  "elite.elitnyeArhetipy.nochnoyDemon.theGlimmerOfBlades": {
    label: "В качестве Детальной Команды (5 Успехов) может добавить свойство Warp Weapon себе и подчинённым на рукопашные атаки оружием из Мерцающей Ста…",
    source: "The Glimmer of Blades / Мерцание Клинков", reader: ""
  },
  // ── Элитные_архетипы\Облитератор — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.obliterator.broadside": {
    label: "Способен выпустить в противника абсурдное количество огневой мощи. Уменьшает штраф на стрельбу тяжёлым оружием и винтовками с двух рук (в лю…",
    source: "Broadside / Залп", reader: ""
  },
  "elite.elitnyeArhetipy.obliterator.bulletEater": {
    label: "Может поглощать специализированные боеприпасы и хранить их внутри тела. Может заряжать их в подходящее оружие и менять боеприпасы в оружии,",
    source: "Bullet Eater / Пожиратель Пуль", reader: ""
  },
  "elite.elitnyeArhetipy.obliterator.fireproof": {
    label: "Бронированное тело отращивает огнеупорный слой и систему пожаротушения. Получает иммунитет к эффекту Горения и +5 AP против E(Fl) Dmg.",
    source: "Fireproof / Огнеупорный", reader: ""
  },
  "elite.elitnyeArhetipy.obliterator.mutilator": {
    label: "Модифицирует себя для ближнего боя. Может за полудействие потерять Трейт Auto-Stabilized и убрать ограничение на Бег и скорость Натиска,",
    source: "Mutilator / Расчленитель", reader: ""
  },
  "elite.elitnyeArhetipy.obliterator.selfForging": {
    label: "Может поглощать броню так же, как оружие и инструменты. Поглощение занимает 5 минут вместо полного действия и позволяет отращивать модификац…",
    source: "Self-Forging / Самоперековывание", reader: ""
  },
  "elite.elitnyeArhetipy.obliterator.shredder": {
    label: "Сконцентрировавшись, способен ощетиниться десятками или сотнями небольших стволов, палящих во все стороны.",
    source: "Shredder / Измельчитель", reader: ""
  },
  "elite.elitnyeArhetipy.obliterator.toTheTeeth": {
    label: "За полудействие может потратить Очко Бесчестия, чтобы отрастить любую винтовку или пистолет как наплечное оружие до конца боя/сцены.",
    source: "To the Teeth / До Зубов", reader: ""
  },
  // ── Элитные_архетипы\Питати — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.pitati.livingBullet": {
    label: "Пропитывает узоры на рунных пулях собственной кровью, делая их продолжением плоти. Может вплетать психосилы Биомантии,",
    source: "Living Bullet / Живая Пуля", reader: ""
  },
  "elite.elitnyeArhetipy.pitati.piercingShot": {
    label: "Переполняет пулю чистой психической мощью, превращая её в пушечное ядро. При Рунном Выстреле может вместо вплетения психосилы за полудействи…",
    source: "Piercing Shot / Сквозной Выстрел", reader: ""
  },
  "elite.elitnyeArhetipy.pitati.runicArtillery": {
    label: "Способен стрелять с невероятной дальностью. Совершая рунный выстрел после Полного Прицеливания при поддержании психосилы Preternatural Aware…",
    source: "Runic Artillery / Рунная Артиллерия", reader: ""
  },
  "elite.elitnyeArhetipy.pitati.seekerBullet": {
    label: "Пуля способна огибать препятствия и разворачиваться к цели. Вплетая в Рунный Выстрел Mind Over Matter (W+0),",
    source: "Seeker Bullet / Пуля Искатель", reader: ""
  },
  "elite.elitnyeArhetipy.pitati.timedExplosion": {
    label: "Умело заряжает пули психическими взрывами, чтобы они взорвались на расстоянии цели. Вплетая любой психический взрыв в Рунный Выстрел,",
    source: "Timed Explosion / Выдержанный Взрыв", reader: ""
  },
  // ── Элитные_архетипы\Ревенант — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.revenant.revenantPactStage1": {
    label: "Может за свободное действие вселить Мстительный Дух в одно из своих Оружий Возмездия, сделав его Демоническим Оружием,",
    source: "Revenant Pact Stage 1 / Стадия Пакта 1 (Ревенант)", reader: ""
  },
  "elite.elitnyeArhetipy.revenant.revenantPactStage2": {
    label: "За свободное действие может потратить 1 Очко Мести, чтобы принять Грозную Форму до конца боя или сцены, окружив себя иллюзорной пеленой,",
    source: "Revenant Pact Stage 2 / Стадия Пакта 2 (Ревенант)", reader: ""
  },
  "elite.elitnyeArhetipy.revenant.revenantPactStage3": {
    label: "Грозная Форма принимает ещё более пугающие и демонические формы, наслаиваясь поверх лица ужасающей маской, что даёт рейтинг Страха 1.",
    source: "Revenant Pact Stage 3 / Стадия Пакта 3 (Ревенант)", reader: ""
  },
  "elite.elitnyeArhetipy.revenant.revenantPactStage4": {
    label: "Отныне считается демоном в Хосте собственного тела и получает Трейт Daemonic (3). При смерти или изгнании может быть призван как низший демо…",
    source: "Revenant Pact Stage 4 / Стадия Пакта 4 (Ревенант)", reader: ""
  },
  "elite.elitnyeArhetipy.revenant.revenantPactStage5": {
    label: "Может выбрать до 2 новых Оружий Возмездия: одно до R2 и одно до R3. Его Оружие Возмездия, сделанное Оружием Наследия,",
    source: "Revenant Pact Stage 5 / Стадия Пакта 5 (Ревенант)", reader: ""
  },
  // ── Элитные_архетипы\Секутор — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.sekutor.destructor": {
    label: "Структурные анализаторы способны заметить мельчайшую слабину в броне. Может потратить Очко Бесчестия,",
    source: "Destructor / Деструктор", reader: ""
  },
  "elite.elitnyeArhetipy.sekutor.fusillade": {
    label: "Укрепляет конечности усиленными подвесками и гасителями отдачи, устанавливая тяжёлое оружие в баллистические механодендриты и используя его…",
    source: "Fusillade / Фузилада", reader: ""
  },
  "elite.elitnyeArhetipy.sekutor.gunzerker": {
    label: "Холодная ненависть Секутора более контролируема, чем у биологических существ. В начале Хода может пройти тест W+0,",
    source: "Gunzerker / Берсерк-Стрелок", reader: ""
  },
  "elite.elitnyeArhetipy.sekutor.myrmidon": {
    label: "Интегрировал боевые алгоритмы суб-ордена Мирмидонов. Может считать винтовки пистолетами,",
    source: "Myrmidon / Мирмидон", reader: ""
  },
  "elite.elitnyeArhetipy.sekutor.ordinator": {
    label: "Мощные внутренние гироскопы всегда удерживают его на ногах. Не может быть сбит с ног,",
    source: "Ordinator / Ординатор", reader: ""
  },
  "elite.elitnyeArhetipy.sekutor.sustainedAssault": {
    label: "С каждой атакой вносит правки в боевые алгоритмы, подстраиваясь под цель. Если атакует одну и ту же цель несколько раз подряд без переключен…",
    source: "Sustained Assault / Непрерывный Натиск", reader: ""
  },
  // ── Элитные_архетипы\Сибарит — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.sibarit.dracon": {
    label: "Может использовать Charm в отношении подчинённых вместо Command, получая при этом бонус F.b×3 на тесты командования.",
    source: "Dracon / Драконт", reader: ""
  },
  "elite.elitnyeArhetipy.sibarit.hekatrix": {
    label: "Может использовать A как характеристику для Intimidate. За Полное действие может пройти тест Trade (Dancer)(A)+20 и при успехе получить бону…",
    source: "Hekatrix / Гекатрица", reader: ""
  },
  "elite.elitnyeArhetipy.sibarit.helliarch": {
    label: "Может трижды за раунд перебрасывать любые тесты Operate (Aeronautica) и добавляет к манёвренности своего геллиона.",
    source: "Helliarch / Геллиарх", reader: ""
  },
  "elite.elitnyeArhetipy.sibarit.solarite": {
    label: "Пока персонаж в воздухе на крыльях от архетипа Бичеватель, получает Nimble (+10) и может перебрасывать проваленные тесты на избегание атаки.",
    source: "Solarite / Соларит", reader: ""
  },
  "elite.elitnyeArhetipy.sibarit.sybarite": {
    label: "Может иметь в отряде до 20 друкхари, если те из того же кабала, распространяя на них все бонусы как обычно.",
    source: "Sybarite / Сибарит", reader: ""
  },
  // ── Элитные_архетипы\Скорбные_Пасти — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.skorbnyePasti.darkOmens": {
    label: "Цель с Меткой Мести ощущает потусторонний страх, и сама судьба становится к ней менее благосклонна. Все проклятия, накладываемые на цель,",
    source: "Dark Omens / Тёмные Предзнаменования", reader: ""
  },
  "elite.elitnyeArhetipy.skorbnyePasti.fearIncarnate": {
    label: "Можно взять до 3 раз. За каждое взятие рейтинг Fear против цели с Меткой Мести растёт на +1.",
    source: "Fear Incarnate / Воплощение Страха", reader: ""
  },
  "elite.elitnyeArhetipy.skorbnyePasti.gameHasOnlyJustBegun": {
    label: "Может выпускать захваченную жертву из карманного измерения в любой участок тьмы, где находится сам,",
    source: "Game Has Only Just Begun / Игра Только Началась", reader: ""
  },
  "elite.elitnyeArhetipy.skorbnyePasti.iceKingdom": {
    label: "Приходя за целью с Меткой Мести, покрывает инеем и холодом всю поверхность в радиусе 500 метров от места появления,",
    source: "Ice Kingdom / Ледяное Царство", reader: ""
  },
  "elite.elitnyeArhetipy.skorbnyePasti.sentence": {
    label: "Время, за которое существо получает урон в W при нахождении в карманном измерении Скорбной Пасти, снижается до 1 дня.",
    source: "Sentence / Приговор", reader: ""
  },
  "elite.elitnyeArhetipy.skorbnyePasti.whisperOfDeath": {
    label: "Приходя за целью с Меткой Мести, заставляет её слышать в голове особенно сильный шёпот. Этот шёпот накладывает штраф −3×Inf.",
    source: "Whisper of Death / Шёпот Смерти", reader: ""
  },
  // ── Элитные_архетипы\Скульптор_Плоти — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.skulptorPloti.appolyon": {
    label: "Может изменять одного подопытного месяцами до полной неузнаваемости. Может потратить Очко Бесчестия,",
    source: "Appolyon / Аполион", reader: ""
  },
  "elite.elitnyeArhetipy.skulptorPloti.eidolon": {
    label: "Позволяет превратить живого человека в податливую сжатую плоть, обвивающую его словно змея. Потратив три полных действия и тест Medicae+0,",
    source: "Eidolon / Эйдолон", reader: ""
  },
  "elite.elitnyeArhetipy.skulptorPloti.narcissus": {
    label: "Мастерство позволяет проводить операции на себе. Может проводить ритуал Лепки Плоти на себе,",
    source: "Narcissus / Нарцисс", reader: ""
  },
  "elite.elitnyeArhetipy.skulptorPloti.sculpturite": {
    label: "Живые жертвенные палитры Скульптуриты создаются из Миньонов-людей. Проводит изменённый ритуал Лепки Плоти,",
    source: "Sculpturite / Скульптурит", reader: ""
  },
  // ── Элитные_архетипы\Суккуб — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.sukkub.bloodDancer": {
    label: "Вооружённый Гекатрийским, Ведьминским или Суккубовским клинком либо Гекатрийским Копьём,",
    source: "Blood Dancer / Кровавый Танцор", reader: ""
  },
  "elite.elitnyeArhetipy.sukkub.leaderOfBridesOfDeath": {
    label: "Все ведьмы Культа под его командованием получают +20 на атаки по Сочленениям и дополнительный +20 на атаки по сочленениям тех,",
    source: "Leader of Brides of Death / Предводительница Невест Смерти", reader: ""
  },
  "elite.elitnyeArhetipy.sukkub.performanceOfBlades": {
    label: "После Молниеносной или Быстрой Атаки, но до броска на урон, может совершить ещё один бросок на атаку и выбрать наилучший результат.",
    source: "Performance of Blades / Представление Клинков", reader: ""
  },
  "elite.elitnyeArhetipy.sukkub.prerogativeOfStrike": {
    label: "Подвергаясь рукопашной атаке, которую может парировать, проходит тест WS−10 и при успехе наносит по противнику атаку как при контратаке.",
    source: "Prerogative of Strike / Прерогатива Удара", reader: ""
  },
  "elite.elitnyeArhetipy.sukkub.superagility": {
    label: "Пока носит Костюм Ведьмы или не носит брони вовсе, снижает урон всех видимых им атак на A.b до минимума в 1. Все короткие и длинные очереди,",
    source: "Superagility / Сверхловкость", reader: ""
  },
  "elite.elitnyeArhetipy.sukkub.thrillingSpectacle": {
    label: "Раз в битву может автоматически преуспеть в тесте на Молниеносную Атаку на 12 Успехов и, игнорируя обычные лимиты,",
    source: "Thrilling Spectacle / Захватывающее Представление", reader: ""
  },
  // ── Элитные_архетипы\Т_мный_Апостол — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.tMnyyApostol.layOnHands": {
    label: "Душа Апостола — проводник воли Хаоса в материальный мир. Возложив руки на добровольную цель, может дать ей столько Порчи,",
    source: "Lay On Hands / Возложение Рук", reader: ""
  },
  "elite.elitnyeArhetipy.tMnyyApostol.litanyOfChaos": {
    label: "Нечестивые литании наполняют паству силой Тёмных Богов. Может потратить Очко Бесчестия,",
    source: "Litany of Chaos / Литания Хаоса", reader: ""
  },
  "elite.elitnyeArhetipy.tMnyyApostol.martyr": {
    label: "Истинно верующие готовы пожертвовать собой, чтобы впустить в мир посланцев Богов. Потратив полное действие на ритуальные распевы и тест For.",
    source: "Martyr / Мученик", reader: ""
  },
  "elite.elitnyeArhetipy.tMnyyApostol.mortalInstrument": {
    label: "Самые могущественные Апостолы напрямую проводят волю Пантеона. Раз в сессию, находясь в смертельной опасности,",
    source: "Mortal Instrument / Смертный Инструмент", reader: ""
  },
  "elite.elitnyeArhetipy.tMnyyApostol.truePrayer": {
    label: "Когда произносит молитвы, по ту сторону Завесы их слышат. Может потратить полудействие, чтобы пройти тест For.",
    source: "True Prayer / Истинная Молитва", reader: ""
  },
  // ── Элитные_архетипы\Тенеткач — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.tenetkach.coldOfDarkness": {
    label: "Пробуждает фокус Криомантии, который может изучать через трейт «Владыка Тьмы». Криомантия работает по тем же правилам, что и умбрамантия.",
    source: "Cold of Darkness / Холод Тьмы", reader: ""
  },
  "elite.elitnyeArhetipy.tenetkach.embraceOfDarkness": {
    label: "Все мандрагоры в зоне с освещением уровня Тьма получают неперегружаемый колдовской щит-купол 1−3×Daemonic персонажа.",
    source: "Embrace of Darkness / Объятия Тьмы", reader: ""
  },
  "elite.elitnyeArhetipy.tenetkach.eternalDarkness": {
    label: "Можно взять два раза. При взятии аура тьмы от трейта «Владыка Тьмы» увеличивается на его Daemonic. Взятие поднимает уровень таланта на +1,",
    source: "Eternal Darkness / Вечная Тьма", reader: ""
  },
  "elite.elitnyeArhetipy.tenetkach.stalker": {
    label: "Может развивать Psyniscience как дружественный навык и автоматически преуспевает в обнаружении через пси-чутьё существ во тьме.",
    source: "Stalker / Преследователь", reader: ""
  },
  // ── Элитные_архетипы\Тех_Ассасин — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.tehAssasin.bisection": {
    label: "Разделяет фрейм на ещё больше независимых модулей на магнитных замках. При Уклонении от атаки (не по площади) может потратить на него 2 Когн…",
    source: "Bisection / Рассечение", reader: ""
  },
  "elite.elitnyeArhetipy.tehAssasin.chrysalis": {
    label: "Аркано-механические репликаторы в головном модуле восстанавливают фрейм даже из одной головы.",
    source: "Chrysalis / Куколка", reader: ""
  },
  "elite.elitnyeArhetipy.tehAssasin.cranialMantle": {
    label: "Участок Кибер-Мантии подсоединяется напрямую к головному мозгу вместо спинного. Может установить два своих механодендрита на голову вместо т…",
    source: "Cranial Mantle / Черепная Мантия", reader: ""
  },
  "elite.elitnyeArhetipy.tehAssasin.disjoint": {
    label: "Отсечённые (но не уничтоженные) конечности всё ещё подчиняются командам. Могут совершать действия и атаки по правилам Multiple Arms,",
    source: "Disjoint / Разделение", reader: ""
  },
  "elite.elitnyeArhetipy.tehAssasin.modularAutonomy": {
    label: "Каждый модуль фрейма самодостаточен. Может игнорировать Критические Эффекты и урон от ранений в конечность или торс, отсоединяя их.",
    source: "Modular Autonomy / Модульная Автономия", reader: ""
  },
  "elite.elitnyeArhetipy.tehAssasin.scorpio": {
    label: "Когда обе ноги отсоединены, выпускает снизу торса длинное хребтоподобное жало. Уменьшает Размер на 1 и получает Трейт Parasite,",
    source: "Scorpio / Скорпион", reader: ""
  },
  // ── Элитные_архетипы\Укротитель — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.ukrotitel.barghesi": {
    label: "Получает возможность приобретать необученных Бхаргези как предмет R4, обученных как R5. Бхаргези считается для Укротителя Высшим Миньоном.",
    source: "Barghesi / Бхаргези", reader: ""
  },
  "elite.elitnyeArhetipy.ukrotitel.clawedFiend": {
    label: "Получает возможность приобретать необученных Когтистых Дьяволов как предмет R3, обученных как R4.",
    source: "Clawed Fiend / Когтистый Дьявол", reader: ""
  },
  "elite.elitnyeArhetipy.ukrotitel.hellspider": {
    label: "Получает возможность приобретать необученных Адских Пауков как предмет R2, обученных как R3.",
    source: "Hellspider / Адский Паук", reader: ""
  },
  "elite.elitnyeArhetipy.ukrotitel.khymera": {
    label: "Получает возможность приобретать необученных Кхимер как предмет R3, обученных как R4. Кхимера считается для Укротителя Средним Миньоном.",
    source: "Khymera / Кхимера", reader: ""
  },
  "elite.elitnyeArhetipy.ukrotitel.unusualAnimals": {
    label: "Может считать Миньонов Людей, Машин и Демонов за Зверей, сломив их волю. Механикум и Тираниды удваивают свой W.b против пыток персонажа,",
    source: "Unusual Animals / Необычные Звери", reader: ""
  },
  // ── Элитные_архетипы\Чемпион_Терминатор — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.chempionTerminator.anointed": {
    label: "Раз в Раунд может без траты Реакции парировать атаку по дружественному персонажу в 1м от него, или получить попадание вместо него.",
    source: "Anointed / Помазанник", reader: ""
  },
  "elite.elitnyeArhetipy.chempionTerminator.atramentar": {
    label: "Убив противника в ближнем бою, может потратить Реакцию или ещё не использованную Атаку другой рукой,",
    source: "Atramentar / Атрамэнтар", reader: ""
  },
  "elite.elitnyeArhetipy.chempionTerminator.deathShroud": {
    label: "Если вооружён древковым оружием в двуручном хвате, может за полное действие совершить Стандартную Базовую атаку по всем противникам в радиус…",
    source: "Death Shroud / Саван Смерти", reader: ""
  },
  "elite.elitnyeArhetipy.chempionTerminator.devourer": {
    label: "Совершая Напролом, может проноситься сквозь укреплённые стены и игнорирует Трудный Ландшафт.",
    source: "Devourer / Поглотитель", reader: ""
  },
  "elite.elitnyeArhetipy.chempionTerminator.justaerin": {
    label: "Считается как два персонажа в расчёте численного перевеса в рукопашной. Может считать винтовки пистолетами,",
    source: "Justaerin / Юстаэринец", reader: ""
  },
  "elite.elitnyeArhetipy.chempionTerminator.lernean": {
    label: "Не получает штрафов к Stealth от брони. Не страдает от уменьшенного угла обзора от брони и может перебрасывать тесты Awareness на обнаружени…",
    source: "Lernean / Лернеец", reader: ""
  },
  "elite.elitnyeArhetipy.chempionTerminator.phoenician": {
    label: "Если вооружён древковым оружием в двуручном хвате, может совершать Прыжок или Вольт и не получает обычного штрафа −10 к Уклонению.",
    source: "Phoenician / Фениксиец", reader: ""
  },
  "elite.elitnyeArhetipy.chempionTerminator.tyranthikos": {
    label: "Уменьшает штраф за стрельбу из любой пары стрелкового оружия на 10, в т.ч. двух тяжёлых. Если вооружён двумя тяжёлыми стрелковыми,",
    source: "Tyranthikos / Тирантикос", reader: ""
  },
  // ── Элитные_архетипы\Чернокнижник — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.chernoknizhnik.cannibalMage": {
    label: "Ритуальный каннибализм позволяет поглотить остатки души жертвы для усиления манифестаций. За полное действие может съесть глаз, кусок мозга,",
    source: "Cannibal Mage / Маг-Каннибал", reader: ""
  },
  "elite.elitnyeArhetipy.chernoknizhnik.finalEcho": {
    label: "Растягивает энергию жертвоприношения, придавая колдовству гибкость истинного псайкера. После манифестации психосилы с Путём Жертва,",
    source: "Final Echo / Последнее Эхо", reader: ""
  },
  "elite.elitnyeArhetipy.chernoknizhnik.highRitualist": {
    label: "Глубокое понимание оккультных механизмов позволяет подчинять Эмпиреи силой чистого разума. Может использовать I вместо W и P в психотестах.",
    source: "High Ritualist / Высший Ритуалист", reader: ""
  },
  "elite.elitnyeArhetipy.chernoknizhnik.interpreter": {
    label: "Способен освоить даже экзотические психосилы. Может обучаться редким дисциплинам у псайкеров и при обучении у псайкеров получает Преимуществ…",
    source: "Interpreter / Интерпретатор", reader: ""
  },
  "elite.elitnyeArhetipy.chernoknizhnik.listener": {
    label: "Частично трансмутирует свою душу, открывая её течениям Варпа. Может использовать Пси-Чутьё как псайкер.",
    source: "Listener / Слушающий", reader: ""
  },
  "elite.elitnyeArhetipy.chernoknizhnik.silentStudent": {
    label: "Способен собрать эхо психосилы в формулу для своих инкантаций. После 8 ч изучения места, где недавно проходила манифестация психосилы,",
    source: "Silent Student / Тихий Ученик", reader: ""
  },
  "elite.elitnyeArhetipy.chernoknizhnik.warpDancer": {
    label: "Позволяет фокусировать энергии Варпа сложными пассами и стойками, подобно боевым искусствам.",
    source: "Warp Dancer / Варп-Танцор", reader: ""
  },
  // ── Элитные_архетипы\Чумной_Десантник — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.chumnoyDesantnik.bileSpit": {
    label: "Кислота Бетчера проедает решётку респиратора. Может плеваться кислотой, не снимая шлема; плевок +1d5 урона +1 Pen.",
    source: "Bile Spit / Жёлчный Плевок", reader: ""
  },
  "elite.elitnyeArhetipy.chumnoyDesantnik.blessedWithPus": {
    label: "Густая гниль сочится из пор и трещин брони, покрывая слоем скользкой жижи. Противники получают Помеху на все тесты Захвата против него.",
    source: "Blessed with Pus / Благословенный Гноем", reader: ""
  },
  "elite.elitnyeArhetipy.chumnoyDesantnik.gloriousRust": {
    label: "Снаряжение выглядит ржавым, но благословение Дедушки укрепляет качественные вещи. Считает все не мистические предметы Poor.Q как Good.",
    source: "Glorious Rust / Славная Ржавчина", reader: ""
  },
  "elite.elitnyeArhetipy.chumnoyDesantnik.plagueGardener": {
    label: "Научился лучше контролировать испускаемую заразу. Используя любую способность, вызывающую заражение, может выбрать,",
    source: "Plague Gardener / Чумной Садовник", reader: ""
  },
  "elite.elitnyeArhetipy.chumnoyDesantnik.rotsmith": {
    label: "Гниль Нургла из трещин брони заражает даже мёртвую плоть и металл. За 5 минут может заразить любой нож или отрубленную голову Гнилью Нургла;",
    source: "Rotsmith / Кузнец Гнили", reader: ""
  },
  "elite.elitnyeArhetipy.chumnoyDesantnik.walkingWasteland": {
    label: "Кровь и ошмётки некротической плоти оскверняют землю. Получив непоглощённый урон в бою, заражает всё поле боя вокруг (до 1 гектара);",
    source: "Walking Wasteland / Ходячая Пустошь", reader: ""
  },
  // ── Элитные_архетипы\Чумной_Монах — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.chumnoyMonah.feverStance": {
    label: "Доведя техники боя до совершенства, монах вплетает удары кулаками в свои атаки, больше не полагаясь на живительную силу паразитов.",
    source: "Fever Stance / Стойка Горячки", reader: ""
  },
  "elite.elitnyeArhetipy.chumnoyMonah.gluttony": {
    label: "Ритуальным жертвоприношением и усиленной медитацией достигает нового уровня взаимопонимания с паразитами внутри.",
    source: "Gluttony / Чревоугодие", reader: ""
  },
  "elite.elitnyeArhetipy.chumnoyMonah.longHandOfCorrosion": {
    label: "Порченная плоть монаха служит лучшим проводником силы паразитов, позволяя им защищать его даже от атак издали,",
    source: "Long Hand of Corrosion / Длинная Рука Коррозии", reader: ""
  },
  "elite.elitnyeArhetipy.chumnoyMonah.putridClarity": {
    label: "Медитируя над природой жизни и смерти, монах глубже проникает в тайны ядов и полнее раскрывает смертоносный потенциал своих паразитов.",
    source: "Putrid Clarity / Гнилостное Просвещение", reader: ""
  },
  "elite.elitnyeArhetipy.chumnoyMonah.trueRot": {
    label: "Глубокое понимание природы болезни и разложения раскрывает полный потенциал трупных ядов.",
    source: "True Rot / Истинная Гниль", reader: ""
  },
  "elite.elitnyeArhetipy.chumnoyMonah.wormListener": {
    label: "Прислушиваясь к шёпоту паразитов внутри, монах способен избрать лучшие части жертвы и отложить их на будущее. Потратив 7 минут над трупом,",
    source: "Worm Listener / Слушающий Червей", reader: ""
  },
  // ── Элитные_архетипы\Шумовой_Десантник — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.shumovoyDesantnik.dirgeOfDespair": {
    label: "Оружие издаёт протяжный низкий вопль грядущих пыток. До начала следующего Хода может дать своему звуковому оружию свойство Concussive(3),",
    source: "Dirge of Despair / Песнь Отчаянья", reader: ""
  },
  "elite.elitnyeArhetipy.shumovoyDesantnik.distilledTorment": {
    label: "Убив звуковым оружием обладающее душой существо, может потратить Реакцию, чтобы обратить его плоть в сверкающую пыль.",
    source: "Distilled Torment / Дистиллированная Мука", reader: ""
  },
  "elite.elitnyeArhetipy.shumovoyDesantnik.nectarOfTheGods": {
    label: "Развил ультимативную зависимость и сопротивляемость к стимуляторам. Иммунен к пост-эффектам наркотиков.",
    source: "Nectar Of The Gods / Нектар Богов", reader: ""
  },
  "elite.elitnyeArhetipy.shumovoyDesantnik.painIsPleasure": {
    label: "Прикосновение лезвия или пули вызывает всплеск экстаза. Получив не поглощённый урон, снимает 1 Усталости и получает +10 на все тесты до конц…",
    source: "Pain Is Pleasure / Боль Это Наслаждение", reader: ""
  },
  "elite.elitnyeArhetipy.shumovoyDesantnik.singForMe": {
    label: "Крики боли — музыка для персонажа. Может потратить 15 минут на пытку беспомощной или сдавшейся жертвы (Interrogate+0 vs W+0).",
    source: "Sing For Me! / Спой Мне!", reader: ""
  },
  "elite.elitnyeArhetipy.shumovoyDesantnik.sweetCacophony": {
    label: "Звуковые усилители на броне пропитываются его душевной порчей. Может использовать Грозный Вопль до Cor.b раз за бой, а не только один раз.",
    source: "Sweet Cacophony / Сладкая Какофония", reader: "module/combat/dread-wail.mjs::dreadWailMax (wdbc-sk8s)"
  },
  "elite.elitnyeArhetipy.shumovoyDesantnik.wallOfDiscord": {
    label: "За полудействие может потратить Очко Бесчестия, чтобы выпустить стену хаотического звука в радиусе Cor.b×2 м.",
    source: "Wall of Discord / Стена Диссонанса", reader: ""
  },
  // ── Элитные_архетипы\Электрожрец — Элитный Архетип/подсистема, книжно проверено в Фазе 1, ниже — Фаза 2 (все триггерные/активные, capability-документация) ──
  "elite.elitnyeArhetipy.elektrozhrets.conduitMarch": {
    label: "Обращаясь к литаниям Проводниковых Войн, наполняет тело мотивирующей силой. Может тратить по 1 Когниции, чтобы: получить +½W.b (окр.",
    source: "Conduit March / Проводниковый Марш", reader: ""
  },
  "elite.elitnyeArhetipy.elektrozhrets.motiveSight": {
    label: "Чувствуя потоки энергии в нервах и проводах, поражает врагов без промаха. Атакуя живые существа или машины,",
    source: "Motive Sight / Мотивное Зрение", reader: ""
  },
  "elite.elitnyeArhetipy.elektrozhrets.voltagheistBlast": {
    label: "Щит накапливает статическое электричество при движении и разряжается всплеском. Совершая Натиск с Voltagheist Shield в Процессах,",
    source: "Voltagheist Blast / Вольтагейст Взрыв", reader: ""
  },
  "elite.elitnyeArhetipy.elektrozhrets.voltagheistBubble": {
    label: "Щит генерирует сферический кокон, задерживающий воздух. Имея в Процессах Voltagheist Shield,",
    source: "Voltagheist Bubble / Вольтагейст Пузырь", reader: ""
  },
  "elite.elitnyeArhetipy.elektrozhrets.voltaicAbsorption": {
    label: "Чувствуя биение мотивирующей силы врагов, может втягивать часть покидающей их тела энергии.",
    source: "Voltaic Absorption / Вольтаическое Поглощение", reader: ""
  },
  "elite.elitnyeArhetipy.elektrozhrets.voltaicConfluence": {
    label: "Свивая электрические поля щита в направляющие потоки, лучше контролирует молнии и дуги. Когда имеет Аблативные Раны на Вольтагейст Щите,",
    source: "Voltaic Confluence / Вольтаическое Слияние", reader: ""
  },
  // ── Черты: packs-src/traits — Фаза 2, capability-документация ──
  "trait.ablativePlating": {
    label: "При полном запасе любой непоглощённый урон уменьшается до 1.",
    source: "Ablative Plating / Аблативное Бронирование", reader: ""
  },
  "trait.abominablePhysiology": {
    label: "Иммунитет к ядам/пост-эффектам/зависимости; лечение как у Космодесантника +1 доп. Рана/сутки; тест T+0 в начале Хода снимает Кровотечение.",
    source: "Abominable Physiology / Изуверская Физиология", reader: ""
  },
  "trait.adaptiveVenom": {
    label: "Toxic 1d10.",
    source: "Adaptive Venom / Адаптивная Отрава", reader: ""
  },
  "trait.adaptiveXenos": {
    label: "В людском облике (шлем/капюшон + не-эльдарская броня/плащ >70%) и на Низком Готике — нет штрафов на общение с людьми.",
    source: "Adaptive Xenos / Адаптивный Ксенос", reader: ""
  },
  "trait.adroit": {
    label: "Выбирает одну Характеристику (кроме Inf и Cor): все успешные тесты на неё (в т.ч. навыки через неё) получают +1 Успех.",
    source: "Adroit / Искусный", reader: ""
  },
  "trait.alchemMonster": {
    label: "×2 длительность наркотиков/ядов на себя и ×2 лимит приёма наркотиков в неделю; но обязан перебрасывать УСПЕШНЫЕ тесты против ядов и Зависимо…",
    source: "Alchem Monster / Алхимическое Чудовище", reader: ""
  },
  "trait.alluringPresence": {
    label: "Все враги получают штраф −10 на Избегания против атак демона.",
    source: "Alluring Presence / Чарующее Присутствие", reader: ""
  },
  "trait.allTerrain": {
    label: "Нет верхового штрафа −20 на трудный и опасный ландшафт.",
    source: "All-Terrain / Вездеход", reader: ""
  },
  "trait.amorphous": {
    label: "−SPD; иммунитет к путам; легко вырывается из Борьбы.",
    source: "Amorphous / Аморфный", reader: ""
  },
  "trait.amphibious": {
    label: "Дышит под водой; перебрасывает Плавание.",
    source: "Amphibious / Амфибия", reader: ""
  },
  "trait.autoStabilized": {
    label: "Тяжёлое оружие без штрафов; всегда «закреплён».",
    source: "Auto-Stabilized / Авто-Стабилизированный", reader: ""
  },
  "trait.aversionToOrder": {
    label: "Lore/Trade враждебны.",
    source: "Aversion to Order / Отвращение к Порядку", reader: ""
  },
  "trait.aThousandSongs": {
    label: "При провале теста крафта — за Очко Судьбы вместо этого преуспеть на F.b успехов. Игнорирует требования по характеристикам для Миньонов-машин…",
    source: "A Thousand Songs / Тысяча Песен", reader: ""
  },
  "trait.barefoot": {
    label: "+20 Stealth (бесшумность).",
    source: "Barefoot / Босоногий", reader: ""
  },
  "trait.bestial": {
    label: "Авто Survival; не использует сложные действия.",
    source: "Bestial / Зверь", reader: ""
  },
  "trait.bite": {
    label: "Естественное оружие: Укус (профиль).",
    source: "Bite / Укус (X)", reader: ""
  },
  "trait.bladesX": {
    label: "Свободным действием — попадание с профилем X по врагу на пути.",
    source: "Blades (X) / Лезвия (X)", reader: ""
  },
  "trait.blind": {
    label: "Перманентно Ослеплён.",
    source: "Blind / Слепой", reader: ""
  },
  "trait.bloodForTheBloodGod": {
    label: "Убив живое существо или изгнав другого демона, демон получает +2 ко всему рукопашному урону (складывается, до максимума +8) до конца боя.",
    source: "Blood for the Blood God / Кровь Богу Крови", reader: ""
  },
  "trait.blunted": {
    label: "Скрыт от Варпа; защита от психо-атак ×X.",
    source: "Blunted / Затупленный (X)", reader: ""
  },
  "trait.bolterVirtuoso": {
    label: "Болт-оружие получает ещё один дополнительный кубик ко всем альтернативным профилям (приклад, штык, из подствольника и т.д.).",
    source: "Bolter Virtuoso / Болтерный Виртуоз", reader: ""
  },
  "trait.boneHead": {
    label: "Импланты интеллекта (с оговорками).",
    source: "BONE-Head / Костеголов", reader: ""
  },
  "trait.braggingWealth": {
    label: "+15 на оценку ценности, поиск трофеев и взлом замков. При провале поиска ценностей — находит 1d5+1 расходников. До I.",
    source: "Bragging Wealth / Бахвальное Богатство", reader: ""
  },
  "trait.brutalCharge": {
    label: "+X урона при Натиске/Верховой атаке.",
    source: "Brutal Charge / Брутальный Натиск (X)", reader: ""
  },
  "trait.brutePhysiology": {
    label: "+15 Ран; штрафы на немодифицированное оружие.",
    source: "Brute Physiology / Физиология Громилы", reader: ""
  },
  "trait.burrower": {
    label: "Роет тоннели со скоростью SPD×X.",
    source: "Burrower / Бурильщик (X)", reader: ""
  },
  "trait.chaosPsyker": {
    label: "Получает Трейт Psyker с PR3 и +1d5 Cor. В расчёте психической силы считается Несвязанным.",
    source: "Chaos Psyker / Псайкер Хаоса", reader: ""
  },
  "trait.cleverHands": {
    label: "+15 на тонкую ручную работу, поднимается до +30 в экстремальных ситуациях (вроде взлома замка посреди боя).",
    source: "Clever Hands / Умные Руки", reader: ""
  },
  "trait.clovenOne": {
    label: "+20 vs Трудный Ландшафт.",
    source: "Cloven One / Раздвоенный", reader: ""
  },
  "trait.coldKiller": {
    label: "При нанесении Экстремального Урона бросает d5 дважды на Критический Результат 2 и берёт лучший.",
    source: "Cold Killer / Хладнокровный Убийца", reader: ""
  },
  "trait.constrictor": {
    label: "+20 Захват; Unnatural S в Захвате.",
    source: "Constrictor / Удав", reader: ""
  },
  "trait.couldnTHurt": {
    label: "В начале сессии находит 1d5+P.b расходников. +20 на поиск ценного/спрятанного у погибших. Обычно недоступны Кабал/Культ/Ковен.",
    source: "Couldn't Hurt / Не Помешает", reader: ""
  },
  "trait.crawler": {
    label: "Нет штрафов за трудный ландшафт.",
    source: "Crawler / Ползун", reader: ""
  },
  "trait.cultLeader": {
    label: "Имеет фанатичный культ: добровольные жертвы для ритуалов, Навыки +10 для ритуалов. Может использовать I вместо W или W вместо I с Преимущест…",
    source: "Cult Leader / Лидер Культа", reader: ""
  },
  "trait.daemonicArmament": {
    label: "Призываемое демоническое оружие (Warp Weapon).",
    source: "Daemonic Armament / Демоническое Вооружение", reader: ""
  },
  "trait.daemonicPresence": {
    label: "Аура: −X к тестам W в радиусе Y.",
    source: "Daemonic Presence / Демоническое Присутствие (X/Y)", reader: ""
  },
  "trait.darkPrinceSChild": {
    label: "Впервые набирая 30/60/90 Inf, может выбрать либо +2 руки (Multiple Arms +2), либо +2 к максимуму Очков Бесчестья.",
    source: "Dark Prince's Child / Дитя Тёмного Принца", reader: ""
  },
  "trait.darkSight": {
    label: "Видит в темноте.",
    source: "Dark Sight / Ночное Зрение", reader: ""
  },
  "trait.dataAcquisition": {
    label: "Преимущество на тесты Awareness механизировано (wdbc-u0by, kind:\"reroll\"/keepBest). Иммунитет к кодам командования Боевых Лат Скитария — не механизировано, нет такого понятия в коде вовсе",
    source: "Data Acquisition / Получение Данных",
    reader: "module/rules/item-rules.mjs (kind:\"reroll\" → rollMode-правило общего реестра)"
  },
  "trait.deadlyNaturalWeapons4": {
    label: "Естественное оружие (когти) теряет свойство Primitive.",
    source: "Deadly Natural Weapons (4, когти) / Смертельное Естественное Оружие", reader: ""
  },
  "trait.deadlyNaturalWeapons": {
    label: "Естественное оружие теряет Primitive.",
    source: "Deadly Natural Weapons / Смертельное Естественное Оружие", reader: ""
  },
  "trait.dedicationToTheShrine": {
    label: "В начале сессии избирает один Путь Воина и одну Характеристику (кроме Inf/Cor): все успешные тесты на неё +1 Успех.",
    source: "Dedication to the Shrine / Приверженность Храму", reader: ""
  },
  "trait.dedication": {
    label: "Покровительство Бога и его божественный Трейт демонов.",
    source: "Dedication / Посвящение", reader: ""
  },
  "trait.digitigrade": {
    label: "+X к SPD; +5×X на группирование.",
    source: "Digitigrade / Двусоставный (X)", reader: ""
  },
  "trait.divinelyGifted": {
    label: "Выбирает 1 дополнительную мутацию/субмутацию (кроме Доспеха Богов и Знания Веков). На покровительстве Бога может вместо этого выбрать 1 Дар.",
    source: "Divinely Gifted / Божественно Одарённый", reader: ""
  },
  "trait.emergencyMaintenance": {
    label: "Тратит Очко Бесчестья и полное действие, чтобы починить повреждения оружия/брони/снаряжения Легиона (обычно требующие 1 смены работы).",
    source: "Emergency Maintenance / Экстренное Обслуживание", reader: ""
  },
  "trait.enduring": {
    label: "Игнор штрафа Усталости.",
    source: "Enduring / Стойкий", reader: ""
  },
  "trait.experimentalSerum": {
    label: "Может создавать Яды и Наркотики с вектором Рана/Инъекция из любых других, повышая редкость итогового (по усмотрению ГМа).",
    source: "Experimental Serum / Экспериментальная Сыворотка", reader: ""
  },
  "trait.expirationDate": {
    label: "Короткий срок жизни.",
    source: "Expiration Date / Срок Годности", reader: ""
  },
  "trait.fanatic": {
    label: "Может перехватить атаку по союзнику.",
    source: "Fanatic / Фанатик", reader: ""
  },
  "trait.fastLearner": {
    label: "+X% к опыту.",
    source: "Fast Learner / Ловит на Лету (X)", reader: ""
  },
  "trait.firePoint": {
    label: "Тратит Очко Бесчестья на переброс стрелковой атаки, даже Оглушённым/лёжа/сбит с ног. На покровительстве Нургла может перебрасывать с Преимущ…",
    source: "Fire Point / Огневая Точка", reader: ""
  },
  "trait.flyer": {
    label: "Полёт со скоростью SPD×X.",
    source: "Flyer / Летун (X)", reader: ""
  },
  "trait.fromBeyond": {
    label: "Иммунитет Страх/Подавление/Паника и ментальным психосилам.",
    source: "From Beyond / Не От Мира Сего", reader: ""
  },
  "trait.fullyArmed": {
    label: "Не-тяжёлое стрелковое оружие с модом Custom Grip считается удобным: +1 надёжность и ½ веса (окр.▼) такого оружия в расчёте Разгрузки. Смоделировано (wdbc-1rno): module/combat/fully-armed.mjs (детект Черты+мода по имени «Персональный Хват»), подключено в module/combat/weapon-mods.mjs::getModEffects (Надёжность) и module/constants/rig.mjs (вес). Прежняя пометка «мод Custom Grip не заведён нигде в системе» была ошибочной — мод существовал под русским переводом «Персональный Хват» (packs-src/weapon-mods/Стрелковое/Прочие/Personal_Grip и .../Рукопашное/Разное/Personal_Grip__Melee), найден по книжному тексту, а не по литеральной строке «Custom Grip». НЕ смоделировано: −1 ОД (до ½) к перезарядке — system.reload свободная строка («1»/«полн.»/«2 полн.»), в системе нет числового движка экономии действий, который бы её читал (тот же честный пробел у Rapid Reload с идентичной формулировкой, capabilities.mjs «Время перезарядки... вдвое»).",
    source: "Fully Armed / Во Всеоружии", reader: "module/combat/fully-armed.mjs"
  },
  "trait.geneticDecay": {
    label: "Падение макс. возраста.",
    source: "Genetic Decay / Генетическое Угасание", reader: ""
  },
  "trait.geneSplice": {
    label: "Выбор адаптаций.",
    source: "Gene-Splice / Гено-Сплайс", reader: ""
  },
  "trait.hardAsStone": {
    label: "Сопротивление ментальным эффектам.",
    source: "Hard as Stone / Крепкий как Камень", reader: ""
  },
  "trait.hollowBones": {
    label: "−5 Поглощение vs I(Cr).",
    source: "Hollow Bones / Пустые Кости", reader: ""
  },
  "trait.hoverer": {
    label: "Парение со скоростью SPD X.",
    source: "Hoverer / Парящий (X)", reader: ""
  },
  "trait.hypnoScars": {
    label: "Крит. Провал → Ступор.",
    source: "Hypno-Scars / Гипно-Шрамы", reader: ""
  },
  "trait.imperialSanctioning": {
    label: "Получает Трейт Psyker с PR2 и +1 Cor. Считается Связанным. Тратит Очко Бесчестья для переброса Феномена, если он вызвал Прорыв.",
    source: "Imperial Sanctioning / Имперское Санкционирование", reader: ""
  },
  "trait.incorporeal": {
    label: "Нематериален; проходит сквозь стены; +30 Stealth.",
    source: "Incorporeal / Бесплотный", reader: ""
  },
  "trait.inspiringPresence": {
    label: "Может позволять союзникам/подчинённым в пределах видимости использовать его Очки Бесчестья;",
    source: "Inspiring Presence / Вдохновляющее Присутствие", reader: ""
  },
  "trait.itWonTHurt": {
    label: "Первая Помощь без анестезии: цель получает 1d5 Усталости, но восстанавливает столько же Ран; Алхимик получает 1 Очко Боли.",
    source: "It Won't Hurt… / Будет Не Больно…", reader: ""
  },
  "trait.justCivilian": {
    label: "Знает 2 Пути на выбор (можно начать следовать в любой момент). +1 Очко Судьбы к максимуму; избирает Элитный Архетип, сохраняющий цену;",
    source: "Just Civilian / Просто Гражданский + Взор Судьбы", reader: ""
  },
  "trait.legionSurgery": {
    label: "Тратит Очко Бесчестья, чтобы авто-пройти тест лечения/работы с геносеменем с 1 Успехом; может пробудить десантника из Сус-ан анимации.",
    source: "Legion Surgery / Хирургия Легиона", reader: ""
  },
  "trait.limitedLift": {
    label: "Полёт ограничен весом/бронёй.",
    source: "Limited Lift / Ограниченная Подъёмная Сила", reader: ""
  },
  "trait.lordOfTheStreams": {
    label: "Тест W−30: проводит суда Эльдар сквозь потоки Варпа (быстрее имперских прыжков, но на короткие дистанции/множество коротких).",
    source: "Lord of the Streams / Владыка Потоков", reader: ""
  },
  "trait.lyingSpeechOfALiar": {
    label: "Преимущество на соц. тесты механизировано (wdbc-u0by, kind:\"reroll\") — опциональная радиокнопка на ЛЮБОМ соц. тесте, честное самоподтверждение (resolveTest вообще не знает ПРОТИВ КОГО идёт соц. тест — персистентный флаг на цели физически не смог бы это гейтить, проверено). Обращение бросков Deceive и +1 успех при провале встречного Deceive/Scrutiny против него — не механизировано",
    source: "Lying Speech Of A Liar / Лживые Речи Лжеца",
    reader: "module/rules/item-rules.mjs (kind:\"reroll\" → опциональный переброс в диалоге теста)"
  },
  "trait.malagraCortex": {
    label: "Утраивает Успехи во встречных тестах на сопротивление Техночудесам Ноотеургии и Аниматеургии, удваивает Успехи на сопротивление психосилам,",
    source: "Malagra Cortex / Кортекс Малагры", reader: ""
  },
  "trait.maneuverable": {
    label: "+20 на тесты поворотов и Заноса.",
    source: "Maneuverable / Манёвренный", reader: ""
  },
  "trait.masterOfMachines": {
    label: "Игнорирует требования по Inf для Миньонов-машин.",
    source: "Master of Machines / Повелитель Машин", reader: ""
  },
  "trait.masterOfMindsOfMonKeigh": {
    label: "Если Люди под его командованием не знают его природы (или признают лидером) — за Очко Судьбы даёт им Fearless (с инстинктом самосохранения)…",
    source: "Master of Minds of Mon-Keigh / Повелитель Разумов Мон-Кей", reader: ""
  },
  "trait.mockeryOfLife": {
    label: "Раз в Раунд, когда Раны опускаются ниже 0, демон может пройти тест Т+10 и при Успехе остаться с 0 Ран.",
    source: "Mockery of Life / Насмешка Над Жизнью", reader: ""
  },
  "trait.monodevotant": {
    label: "Переброс неудачных тестов Лояльности; без субстанции 1d10+W.b дней — штраф −10 ко всем Характеристикам (−5 за каждый доп. день);",
    source: "Monodevotant / Монозависимый", reader: ""
  },
  "trait.multipleArms": {
    label: "Доп. конечности → доп. атаки/манипуляции.",
    source: "Multiple Arms / Многорукий (X)", reader: ""
  },
  "trait.mutant": {
    label: "Имеет X мутаций.",
    source: "Mutant / Мутант", reader: ""
  },
  "trait.naturalWeapons": {
    label: "Естественное оружие (профиль).",
    source: "Natural Weapons / Естественное Оружие", reader: ""
  },
  "trait.newMen": {
    label: "Регенерация и иммунитеты Нового Человека.",
    source: "New Men / Новые Люди", reader: ""
  },
  "trait.nimble10": {
    label: "Штраф атакующим по нему (−Ag.b).",
    source: "Nimble (10) / Проворный", reader: ""
  },
  "trait.nimble": {
    label: "Штраф атакующим по нему (−Ag.b).",
    source: "Nimble / Проворный", reader: ""
  },
  "trait.nobleEugenics": {
    label: "Выбирает 2 Характеристики — они становятся дружественными в плане продвижений и остаются такими, независимо от Покровительства.",
    source: "Noble Eugenics / Благородная Евгеника", reader: ""
  },
  "trait.ogryn": {
    label: "+15 S и T, −15 Ag и Int, +15 Ран, набор Трейтов и Талантов огрина.",
    source: "Ogryn / Огрин", reader: ""
  },
  "trait.packConscious": {
    label: "Телепатия со стаей.",
    source: "Pack Conscious / Сознание Стаи", reader: ""
  },
  "trait.performance": {
    label: "Раз в раунд — Реакция + Очко Судьбы: +A.b к поглощению урона до начала следующего хода. Талант (Скл. A/Fin; требование — Арлекин).",
    source: "Performance / Выступление (талант)", reader: ""
  },
  "trait.phase": {
    label: "Переключает Incorporeal (полудействие).",
    source: "Phase / Фаза", reader: ""
  },
  "trait.pheromoneGlands": {
    label: "+10 социальные (феромоны).",
    source: "Pheromone Glands / Феромонные Железы", reader: ""
  },
  "trait.possession": {
    label: "Вселяется в тело смертного.",
    source: "Possession / Одержимость", reader: ""
  },
  "trait.preferredStrike": {
    label: "Доп. куб урона для переброса за каждый −10 от Сочленений цели (макс 3). Талант-снижение штрафа не уменьшает кубы. До ½ P.b раз/битву.",
    source: "Preferred Strike / Предпочтительный Удар", reader: ""
  },
  "trait.psyber": {
    label: "Связь хозяин↔псайбер; манифестация психосил.",
    source: "Psyber / Псайбер (X)", reader: ""
  },
  "trait.psyker": {
    label: "Является псайкером.",
    source: "Psyker / Псайкер", reader: ""
  },
  "trait.quadruped": {
    label: "Удваивает SPD и Ношение.",
    source: "Quadruped / Четвероногий (X)", reader: ""
  },
  "trait.quietElimination": {
    label: "Атака врасплох: +1 куб урона, цель гибнет беззвучно. Только ножи/игольчатые/осколочные пистолеты — +10 к атаке.",
    source: "Quiet Elimination / Тихое Устранение", reader: ""
  },
  "trait.razorTalons": {
    label: "Естественное оружие: Razor Sharp.",
    source: "Razor Talons / Бритвенные Когти", reader: ""
  },
  "trait.regeneration": {
    label: "В начале Хода тест T+0 → +X Ран.",
    source: "Regeneration / Регенерация (X)", reader: ""
  },
  "trait.reliableSoldier": {
    label: "Выбирает по одному типу рукопашного и стрелкового оружия: +2 Dmg, +1 Pen, +1 надёжность.",
    source: "Reliable Soldier / Надёжный Вояка", reader: ""
  },
  "trait.ritualOfEightSpokes": {
    label: "Каждую неделю получает видение с требованием определённого жертвоприношения («отец 5 детей», «предавший лучшего друга» и т.п.).",
    source: "Ritual of Eight Spokes / Ритуал Восьми Спиц", reader: ""
  },
  "trait.runt": {
    label: "−4 Ран; Compact с оружием.",
    source: "Runt / Коротышка", reader: ""
  },
  "trait.scrounge": {
    label: "Тратит смену работы и Очко Бесчестья, чтобы добыть расходники/находку до 2d10 Редкости (R2).",
    source: "Scrounge / Наскрести", reader: ""
  },
  "trait.serpentSTongue": {
    label: "При провале социального/командного/допроса теста может потратить Очко Бесчестья, чтобы вместо этого преуспеть на 1 Успех.",
    source: "Serpent's Tongue / Змеиный Язык", reader: ""
  },
  "trait.serumHook": {
    label: "Без дозы — каждые 8 часов 1d5 урона в S и T без возможности восстановления отдыхом/медитацией.",
    source: "Serum Hook / Крючок Сывороток", reader: ""
  },
  "trait.servoskull": {
    label: "Size (−2), Hoverer, Machine; одна «рука» со встроенным оружием и +15 на тесты с ним.",
    source: "Servoskull / Сервочереп", reader: ""
  },
  "trait.singleCombat": {
    label: "Против одного противника без союзников: +1 Успех на успешные тесты WS, S и A; Unnatural Characteristic на встречные WS;",
    source: "Single Combat / Бой Один На Один", reader: ""
  },
  "trait.skyPredator": {
    label: "В Ход, когда Раптор совершает Натиск с полёта, может заменить до 2 кубиков урона от рукопашных атак Успехами на попадание.",
    source: "Sky Predator / Хищник Небес", reader: ""
  },
  "trait.sonarSense": {
    label: "Сонар (круговой обзор) на 30 м.",
    source: "Sonar Sense / Сонарное Чувство", reader: ""
  },
  "trait.sophisticatedCombat": {
    label: "+1 успех на WS/A при числ. превосходстве врага; переброс WS/A в бою 1-на-1. Если WS противника ниже — Unnatural WS (+1).",
    source: "Sophisticated Combat / Утончённый Бой", reader: ""
  },
  "trait.sophisticatedSpeech": {
    label: "+15 на соц. тесты при знании фракции собеседника (+10). Может потратить 1 Очко Боли, чтобы преуспеть в провальном соц.",
    source: "Sophisticated Speech / Утончённая Речь", reader: ""
  },
  "trait.sorcerer": {
    label: "Получает Трейт Psyker с PR2 и +1 Cor. В расчёте психической силы считается Связанным.",
    source: "Sorcerer / Чародей", reader: ""
  },
  "trait.sorcerousBarrier": {
    label: "Не перегружающийся колдовской щит-купол 1-35. Включается и выключается за свободное действие.",
    source: "Sorcerous Barrier / Чародейский Барьер", reader: ""
  },
  "trait.soulBound": {
    label: "Защита души ценой жертвы.",
    source: "Soul-Bound / Душесвязанный", reader: ""
  },
  "trait.stampede": {
    label: "Паническая скачка при Страхе.",
    source: "Stampede / Затопот", reader: ""
  },
  "trait.stand": {
    label: "Всадник стоит: руки свободны, попадания делятся по чётности.",
    source: "Stand / Стойка", reader: ""
  },
  "trait.steed": {
    label: "На Миньоне можно ездить верхом; открывает Трейты скакунов.",
    source: "Steed / Скакун", reader: ""
  },
  "trait.stepchildrenOfTheGods": {
    label: "Бонусы против богов Хаоса.",
    source: "Stepchildren of the Gods / Пасынки Богов", reader: ""
  },
  "trait.stuffOfNightmares": {
    label: "Иммунитет к Усталости/ядам/болезням/радиации/экстрим.температурам/вакууму/Кровотечению/Обескровливанию; не может быть Оглушён; не стареет;",
    source: "Stuff of Nightmares / Существо из Кошмаров", reader: ""
  },
  "trait.sturdy": {
    label: "+20 vs Захват/Оглушение, +30 vs сбивание/отбрасывание.",
    source: "Sturdy / Надёжный", reader: ""
  },
  "trait.sureTread": {
    label: "−1 SPD, максимум 3×SPD пешком; вместо A использует Awareness(P) на Трудном Ландшафте (3+ Успеха — не замедляет).",
    source: "Sure Tread / Надёжная Поступь", reader: ""
  },
  "trait.survivor": {
    label: "При провале не-атакующего теста S/T/A/P может потратить Очко Бесчестья — вместо этого преуспеть на 1 Успех.",
    source: "Survivor / Выживальщик", reader: ""
  },
  "trait.swarm": {
    label: "Рой: половина урона от обычных атак; уязвим к Blast/Flame.",
    source: "Swarm / Рой", reader: ""
  },
  "trait.sycophant": {
    label: "+15 к Лояльности хозяина.",
    source: "Sycophant / Подхалим", reader: ""
  },
  "trait.takeEverything": {
    label: "Преимущество на тесты поиска/оценки трофеев механизировано (wdbc-u0by, решение пользователя: Awareness+Commerce) — kind:\"reroll\"×2. Несёт предметы до своего веса Ношения независимо от разгрузки — не механизировано, нет точки входа в расчёт разгрузки под 'независимо от нормальных правил'",
    source: "Take Everything / Забирай Всё",
    reader: "module/rules/item-rules.mjs (kind:\"reroll\" → rollMode-правило общего реестра)"
  },
  "trait.theBloodOfHeroes": {
    label: "Раз/битву за Свободное действие тест W+10: при успехе — Unnatural Characteristic (+1) на выбор до конца битвы.",
    source: "The Blood of Heroes / Кровь Героев", reader: ""
  },
  "trait.theInevitable": {
    label: "При попадании в рукопашной за Очко Судьбы — состязание W+20 vs W+0; при успехе все атаки им и союзниками по этой цели в след.",
    source: "The Inevitable / Неизбежное", reader: ""
  },
  "trait.theOldDays": {
    label: "Обезоружив противника — сразу безоружный удар. +20 vs Snare/Monofilament. Переброс физ. избегания против зверей/чудовищ.",
    source: "The Old Days / Старые Деньки", reader: ""
  },
  "trait.thePredictedSolution": {
    label: "Раз/раунд, когда враг избегает его атаку или он промахнулся — реакция + тест W−30 (как манифестация): превращает свои провалы в успехи,",
    source: "The Predicted Solution / Предсказанное Решение", reader: ""
  },
  "trait.theQuickAndTheDead": {
    label: "+2 к Инициативе; Избегание атак Орды.",
    source: "The Quick and The Dead / Быстрые и Мёртвые", reader: ""
  },
  "trait.theSilentGuard": {
    label: "Игнорирует требования по характеристикам для Миньонов-машин из психокости; погибшего миньона воскрешает за смену.",
    source: "The Silent Guard / Безмолвная Стража", reader: ""
  },
  "trait.thrallWyrd": {
    label: "Monodevotant и Psyker (PR 0); принимает на себя Феномен и Прорыв Варпа ценой жизни.",
    source: "Thrall-Wyrd / Тралл-Вирд", reader: ""
  },
  "trait.toxic": {
    label: "Естественное оружие получает Toxic (X).",
    source: "Toxic / Токсичный (X)", reader: ""
  },
  "trait.undying": {
    label: "Иммунитет ядам/болезням; не умирает мгновенно.",
    source: "Undying / Неумирающий", reader: ""
  },
  "trait.unnaturalCharacteristic": {
    label: "+X к Бонусу выбранной Характеристики; дополнительно +½X (окр.▼) степени успеха на ВСЕ успешные тесты по ней (не только встречные).",
    source: "Unnatural Characteristic / Сверхъестественная Характеристика (X)", reader: ""
  },
  "trait.unnaturalSenses": {
    label: "Чувства на дистанции X м, круговой обзор.",
    source: "Unnatural Senses / Сверхъестественные Чувства (X)", reader: ""
  },
  "trait.unruly": {
    label: "Непоглощённый урон скакуну — тест Акробатики или выпадение из седла.",
    source: "Unruly / Непослушный", reader: ""
  },
  "trait.unstableGenome": {
    label: "Урон в Характеристики усиливается на +1 (плюс ещё +1 за каждую доп. адаптацию).",
    source: "Unstable Genome / Нестабильный Геном", reader: ""
  },
  "trait.vanityUnbound": {
    label: "Hatred ко всем.",
    source: "Vanity Unbound / Безграничное Тщеславие", reader: ""
  },
  "trait.warpGifted": {
    label: "Врождённая психосила.",
    source: "Warp Gifted / Одарённый Варпом", reader: ""
  },
  "trait.warpInstability": {
    label: "Может быть изгнан в Варп при уроне.",
    source: "Warp Instability / Варп-Нестабильность", reader: ""
  },
  "trait.warpWeapon": {
    label: "Естественное оружие игнорирует броню.",
    source: "Warp Weapon / Варп-Оружие", reader: ""
  },
  "trait.warTrained": {
    label: "Управление без рук, кроме скорости Натиска и Бега.",
    source: "War-Trained / Боевая Тренировка", reader: ""
  },
  // ── Черты: packs-src/traits/Книга_Пустоты — Фаза 2, capability-документация ──
  "trait.knigaPustoty.navigatorSGen": {
    label: "НЕ получает Порчу от Варп-Шока (на другие источники Порчи не распространяется). Может брать Силы навигаторов и таланты раздела «Ген Навигато…",
    source: "Navigator's Gen / Ген Навигатора", reader: ""
  },
  // ── Черты: packs-src/traits/Трейты_рас — Фаза 2, capability-документация ──
  "trait.treytyRas.acrobaticMastery": {
    label: "Полудвижение SPD×2, Полное SPD×4, Натиск SPD×8, Бег SPD×14 (со Sprint — удвоение самого Бега, SPD×28). +2 Реакции.",
    source: "Acrobatic Mastery / Акробатическое Мастерство", reader: ""
  },
  "trait.treytyRas.clearMind": {
    label: "При обучении Пути от более опытного: +30 к тесту I/Logic в конце и ×2 успехи. При обучении других: +60 к Trade(Instructor)(I) (÷2,",
    source: "Clear Mind / Чистый Разум", reader: ""
  },
  "trait.treytyRas.craftworldCitizen": {
    label: "Trade на 1 ступень дружественнее. Персонаж начинает с 2 Путями на уровне «Следующий».",
    source: "Craftworld Citizen / Житель Мира-Корабля", reader: ""
  },
  "trait.treytyRas.discordant": {
    label: "Аура Haywire против техники.",
    source: "Discordant / Дискордант", reader: ""
  },
  "trait.treytyRas.distortedBody": {
    label: "Не нуждается в еде, воде, сне; иммунитет к обычным и сверхъестественным болезням; не страдает от погодного жара/холода (но не от огнемёта/кр…",
    source: "Distorted Body / Искажённое Тело", reader: ""
  },
  "trait.treytyRas.dorchacarrec": {
    label: "Взаимный +10 на Атаку и W с демонами Слаанеш. −20 на сопротивление одержимости и больше Cor.",
    source: "Dorchacarrec / Тёмная Душа", reader: ""
  },
  "trait.treytyRas.drasii": {
    label: "Игнорирует страх (включая сверхъест. ужас) и свойства Daemonic/Daemonic Presence/From Beyond/Stuff of Nightmares врагов.",
    source: "Drasii / Житель Тьмы", reader: ""
  },
  "trait.treytyRas.druchiiten": {
    label: "Доп. Реакция; +4 к Инициативе (3 броска, лучший); избегает атак Орды/«Троек» как одиночные (теряется при Размере 2+).",
    source: "Druchiiten / Друкхарийское Тело", reader: ""
  },
  "trait.treytyRas.eldarten": {
    label: "Доп. Реакция; инициатива — 3 броска, лучший, +4 к Инициативе. Psyniscience с ½ штрафов (Mastery → трейт Warp Sight).",
    source: "Eldarten / Эльдарское Тело", reader: ""
  },
  "trait.treytyRas.godless": {
    label: "Нет Очков Судьбы и Очков Бесчестья (нет Покровительства). Для талантов, требующих ОБ, тратит Очки Боли по уровню таланта.",
    source: "Godless / Безбожник", reader: ""
  },
  "trait.treytyRas.hulking": {
    label: "Может использовать оружие/снаряжение Легиона как десантник.",
    source: "Hulking / Громила (Легион)", reader: ""
  },
  "trait.treytyRas.illiengau": {
    label: "−15 на Мораль/Шок/Командование против последователей Слаанеш; −15 на сопротивление одержимости и больше Порчи;",
    source: "Illiengau / Древний Рок", reader: ""
  },
  "trait.treytyRas.mercenaryLoyalty": {
    label: "Не предаёт нанимателя. Наниматель или уважаемый персонаж получает +30 на Командование Сслитом;",
    source: "Mercenary Loyalty / Наёмничья Верность", reader: ""
  },
  "trait.treytyRas.myriadMasks": {
    label: "Выберите ОДНУ маску (меняется раз в месяц с согласия Мастера Труппы/Цегораха): Маска Света — +3 к SPD и Инициативе;",
    source: "Myriad Masks / Мириада Масок", reader: ""
  },
  "trait.treytyRas.nonImperial": {
    label: "Навыки Знаний об Империуме враждебны при покупке; до Forbidden Lore (Mon-Keigh)+0 все имперские знания стоят вдвое.",
    source: "Non Imperial / Не Имперец", reader: ""
  },
  "trait.treytyRas.pariah": {
    label: "Аура чернокнижия (Untouchable).",
    source: "Pariah / Пария", reader: ""
  },
  "trait.treytyRas.powerOfSouls": {
    label: "Когда Иннари кого-либо убивает или кто-то умирает в радиусе 10 м — тест W+20, при успехе +1 Мёртвое Могущество (макс. W.b×3).",
    source: "Power of Souls / Сила Душ", reader: ""
  },
  "trait.treytyRas.reignCraving": {
    label: "+10 на социальные тесты ради власти, свержения или предательства. Вдвое снижает штрафы соц. тестов, пока участвует в заговоре.",
    source: "Reign Craving / Жажда Власти", reader: ""
  },
  "trait.treytyRas.speakNotUntoTheAlien": {
    label: "При общении с людьми считается мутантом: −20 на общение (взаимно). Другие мутанты относятся дружелюбнее.",
    source: "Speak Not Unto The Alien / С Чужаком Ты Не Заговори", reader: ""
  },
  "trait.treytyRas.sslythPhysiology": {
    label: "Иммунитет к ядам, пост-эффектам и зависимости от наркотиков. +15 к максимуму Ран; лечится как Космодесантник и дополнительно +1 Рана в сутки…",
    source: "Sslyth Physiology / Физиология Сслита", reader: ""
  },
  "trait.treytyRas.thePriceOfImmortality": {
    label: "При гибели Гемункулы Кабала/Ковена/Культа возвращают друкхари из мёртвых: каждую главу −2d5 Inf за услуги. Невозможно при Выжигании Души,",
    source: "The Price of Immortality / Цена Бессмертия", reader: ""
  },
  "trait.treytyRas.theReborn": {
    label: "Может использовать архетипы и элитные архетипы любых эльдар. Нет штрафов от Illiengau и Dorchacarrec. Автоуспех на тесты против Страха,",
    source: "The Reborn / Перерождённые", reader: ""
  },
  "trait.treytyRas.throughThePain": {
    label: "Может развивать Psyniscience как враждебный навык (видит лишь тяжелораненых/в страхе, радиус P м). За Реакцию впитывает страдания (крит.",
    source: "Through the Pain / Через Боль", reader: ""
  },
  "trait.treytyRas.unnaturalX": {
    label: "+X к Бонусу выбранной из S/T/A/P; дополнительно +½X (окр.▼) степени успеха на все успешные тесты по ней. Укажите в авто-эффектах.",
    source: "Unnatural (выбор) (X) / Сверхъестественная (выбор) (X)", reader: ""
  },
  "trait.treytyRas.untouchable": {
    label: "Иммунитет к ритуалам, феноменам и прорывам. Душу нельзя схватить, удержать или выжечь — её спасает Цегорах.",
    source: "Untouchable / Неприкосновенные", reader: ""
  },
  "trait.treytyRas.willOfCegorach": {
    label: "Талант Bastion of Iron Will; может использовать W.b вместо PR. Игнорирует иммунитет к психосилам от трейта From Beyond.",
    source: "Will of Cegorach / Воля Цегораха", reader: ""
  },
  "trait.treytyRas.wrackSBody": {
    label: "Не носит немодифицированную броню (но Size 0). Best.Q Инъекторы в руках; постоянно имеет Best.Q Аптечку, Good.Q Комби-Инструмент,",
    source: "Wrack’s Body / Тело Развалины", reader: ""
  },
  "trait.treytyRas.x": {
    label: "From Beyond. Natural Weapons (A.b, Кулаки; Proven 3, Extreme 8). Nimble (+10). Soul-Bound (Цегорах, защита Чёрной Библиотеки).",
    source: "Дары Цегораха / Базовые Черты Арлекина", reader: ""
  },
  // ── Черты: packs-src/traits/Трейты_рас\Зверолюды — Фаза 2, capability-документация ──
  "trait.treytyRas.zverolyudy.khorngorButcher": {
    label: "Кхорнгор имеет запас кубиков: по 1 за каждый Талант Hatred 2-го уровня и 1 за 2 Таланта Hatred 1-го уровня.",
    source: "Khorngor Butcher / Кхорнгор Мясник", reader: ""
  },
  "trait.treytyRas.zverolyudy.pestigorMourner": {
    label: "Раз за бой или сцену после получения непоглощённого урона Пестигор может уменьшить его до 1 и на 1 Раунд удвоить свой T.",
    source: "Pestigor Mourner / Пестигор Плакальщик", reader: ""
  },
  "trait.treytyRas.zverolyudy.slaangorFiendblood": {
    label: "Раз за бой или сцену после завершения рукопашной атаки Слаангор может совершить ещё одну атаку с той же базой (в т.ч. с нескольких рук).",
    source: "Slaangor Fiendblood / Слаангор Извергкровка", reader: ""
  },
  "trait.treytyRas.zverolyudy.tzaangorEnlightened": {
    label: "Проведя ритуал длительностью один час без тестов, Тзаангор призывает Диск Тзинча под своим управлением,",
    source: "Tzaangor Enlightened / Тзаангор Просвещённый", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Архимаг — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.arhimag.magusSupreme": {
    label: "Тонкий контроль над ненадёжными силами Варпа. Феномены (но не Прорывы), вызванные им самим, не воздействуют на него,",
    source: "Magus Supreme / Высший Магус", reader: ""
  },
  "trait.elitnyeArhetipy.arhimag.masteryOfForm": {
    label: "Полезные мутации — знак благосклонности Тзинча. Потратив 9 часов на медитацию и Очко Бесчестия, может тестом For.",
    source: "Mastery of Form / Мастерство Формы", reader: ""
  },
  "trait.elitnyeArhetipy.arhimag.wizardStaff": {
    label: "Посох — фокус и проводник психической силы. Вооружённый психосиловым посохом в двуручном хвате,",
    source: "Wizard Staff / Чародейский Посох", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Архимагос — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.arhimagos.doctrinaImperative": {
    label: "Машинные слуги — продолжение его воли; может на ходу калибровать их прицелы и актуаторы.",
    source: "Doctrina Imperative / Доктрина Императив", reader: ""
  },
  "trait.elitnyeArhetipy.arhimagos.masterpieceFrame": {
    label: "Оборудован восемью элементами бионики или кибернетики Best.Q на выбор игрока и может заменить их особые свойства от Качества на любые подход…",
    source: "Masterpiece Frame / Фрейм Шедевра", reader: ""
  },
  "trait.elitnyeArhetipy.arhimagos.voiceOfOmnissiah": {
    label: "Командные протоколы опираются на глубочайшие базы кода. Распространяет эффект Таланта Binary Dominion на всех персонажей с Имплантами Механи…",
    source: "Voice of Omnissiah / Глас Омниссии", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Архонт — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.arhont.lordOfTheSpiresOfCommoragh": {
    label: "В расчёте всего считается имеющим на +30 Inf больше. Любые друкхари, бывшие в Коммораге при его возвышении, автоматически узнают персонажа,",
    source: "Lord of the Spires of Commoragh / Владыка Шпилей Комморага", reader: ""
  },
  "trait.elitnyeArhetipy.arhont.oldFeelings": {
    label: "Больше не получает Очки Боли от обычных условий — только от смерти тысячи рабов в агонии,",
    source: "Old Feelings / Старые Ощущения", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Берсерк_Кхорна — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.berserkKhorna.avatarOfSlaughter": {
    label: "Раз за бой в конце своего Хода может потратить Очко Бесчестия, чтобы направить кровожадность в одного противника в пределах видимости.",
    source: "Avatar of Slaughter / Аватар Резни", reader: "module/combat/avatar-of-slaughter.mjs + rules/library/avatar-of-slaughter.mjs (wdbc-sk8s)"
  },
  "trait.elitnyeArhetipy.berserkKhorna.butcherSNails": {
    label: "Импланты гложут разум, держа на границе боевого безумия. Может входить в Ярость свободным действием, неограниченное число раз за бой.",
    source: "Butcher's Nails / Гвозди Мясника", reader: "module/combat/frenzy.mjs::hasButchersNails (wdbc-sk8s)"
  },
  "trait.elitnyeArhetipy.berserkKhorna.unstoppableWrath": {
    label: "Раз за Раунд может пройти тест T+0, чтобы проигнорировать Критические Эффекты ранений, Оглушения,",
    source: "Unstoppable Wrath / Неостановимый Гнев", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Бичеватель — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.bichevatel.bornForHeights": {
    label: "При взятии архетипа получает 4 или Inf.b+1 (что выше) Очков имплантов, где 1 редкость = 1 очко.",
    source: "Born for Heights / Рождены Для Высоты", reader: ""
  },
  "trait.elitnyeArhetipy.bichevatel.corporateEthics": {
    label: "Получает Hatred против любого, кто пытался убить или убил другого бичевателя, даже если знает об этом лишь понаслышке.",
    source: "Corporate Ethics / Корпоративная Этика", reader: ""
  },
  "trait.elitnyeArhetipy.bichevatel.vulturesOfCommorragh": {
    label: "Вооружаясь тяжёлым оружием и нося призрачную броню, получает свойство Auto-Stabilized на всё друкхарийское стрелковое оружие.",
    source: "Vultures of Commorragh / Стервятники Комморры", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Броненосец — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.bronenosets.divinePlate": {
    label: "Носит несъёмную тяжёлую броню AP 8/10/8/8, которая ведёт себя как Трейт Natural Armour. Не нуждается в еде,",
    source: "Divine Plate / Божественные Латы", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Вампир — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.vampir.pactProtection": {
    label: "Трейт From Beyond вызван связью его души с демоническим патроном, и (по крайней мере изначально) его разум не сильно отличается от человечес…",
    source: "Pact Protection / Защита Пакта", reader: ""
  },
  "trait.elitnyeArhetipy.vampir.soulDrinker": {
    label: "Когда укус опускает W жертвы до 0, та умирает, а Вампир получает дополнительно ½W.b (окр.",
    source: "Soul Drinker / Испивающий Души", reader: ""
  },
  "trait.elitnyeArhetipy.vampir.supremeAvarice": {
    label: "Получает неизлечимое ментальное расстройство «Перфекционизм» на Тяжести −2, и его Тяжесть не может опуститься ниже −2.",
    source: "Supreme Avarice / Высшая Алчность", reader: ""
  },
  "trait.elitnyeArhetipy.vampir.theThirst": {
    label: "Пробив укусом броню цели, имеющей душу, может выпить её кровь (или аналог, вплоть до машинного масла или реакторной жидкости мутанта-механои…",
    source: "The Thirst / Жажда", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Варп_Кузнец — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.varpKuznets.ironCage": {
    label: "Техно-арканные инструменты доспеха заарканивают демонов петлями эфирных излучателей и нуль-полей.",
    source: "Iron Cage / Железная Клеть", reader: ""
  },
  "trait.elitnyeArhetipy.varpKuznets.mechanicumImplants": {
    label: "Варп-Кузнец имеет полный комплект имплантов Механикум.",
    source: "Mechanicum Implants / Импланты Механикум", reader: ""
  },
  "trait.elitnyeArhetipy.varpKuznets.warpforgedPlate": {
    label: "Доспех — больше чем силовая броня. Закалённый в пламени Варпа и эфирной крови демонов, слился с полумеханической плотью и стал новой кожей.",
    source: "Warpforged Plate / Закалённые Варпом Латы", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Ведьма — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.vedma.gladiatorsOfCommoragh": {
    label: "Вооружённая примитивным оружием друкхари или метательным (кроме гранат), при успешном попадании (после щитов) может нанести себе непоглощённ…",
    source: "Gladiators of Commoragh / Гладиаторы Комморага", reader: ""
  },
  "trait.elitnyeArhetipy.vedma.strikingPerformance": {
    label: "Полное Движение на SPD×3, Натиск на SPD×6, Бег на SPD×12. Не ограничена полудвижением при движении через Reaper,",
    source: "Striking Performance / Разящее Представление", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Ветеран_Долгой_Войны — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.veteranDolgoyVoyny.adaptation": {
    label: "Может получить Трейт любого из стартовых Архетипов, кроме Трейтов Нумена (взятие Трейта Еретека требует сначала раздобыть Импланты Механикум…",
    source: "Adaptation / Адаптация", reader: ""
  },
  "trait.elitnyeArhetipy.veteranDolgoyVoyny.archenemy": {
    label: "Может перебрасывать все броски на распознание Имперского вооружения, техники, снаряжения, технологии, тактики и геральдики.",
    source: "Archenemy / Архивраг", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Виткис — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.vitkis.allKnowing": {
    label: "Духовная связь с Владыкой Войны даёт несравнимые знания о всех инструментах и техниках войны.",
    source: "All-Knowing / Всеведающий", reader: ""
  },
  "trait.elitnyeArhetipy.vitkis.bloodFather": {
    label: "Личным примером и мудрым советом ведёт своих последователей в бой. Считает все Таланты группы Лидерство дружественными,",
    source: "Blood Father / Отец Крови", reader: ""
  },
  "trait.elitnyeArhetipy.vitkis.warSeer": {
    label: "Раз в Ход за свободное действие может сконцентрировать своё боевое всеведение на одном персонаже в том же бою и пройти тест Common Lore(War)…",
    source: "War Seer / Провидец Войны", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Воин_Ноты — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.voinNoty.adoringCrowds": {
    label: "Фанаты стягиваются к нему из-за славы мечника и его выступлений. Может использовать A вместо F и Trade(Dancer) вместо Command для своих Минь…",
    source: "Adoring Crowds / Обожание Толпы", reader: ""
  },
  "trait.elitnyeArhetipy.voinNoty.danceOfPain": {
    label: "Элегантными выверенными ударами изматывает противника, обрывая его жизнь только когда вдоволь наиграется. Раз в Ход,",
    source: "Dance of Pain / Танец Боли", reader: ""
  },
  "trait.elitnyeArhetipy.voinNoty.musicOfBattle": {
    label: "Когда слышит музыку, получает преимущества (музыканты бросают на исполнение каждый Ход, кроме записи;",
    source: "Music of Battle / Музыка Битвы", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Ворон — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.voron.bladesOfFate": {
    label: "Оккультные практики Воронов позволяют полнее использовать вихри судьбы вокруг чемпионов в дуэли.",
    source: "Blades of Fate / Клинки Судьбы", reader: ""
  },
  "trait.elitnyeArhetipy.voron.falseBlade": {
    label: "Вплетает мастерство обмана в движения своего оружия. Может проводить все свои встречные тесты WS (как в атаке,",
    source: "False Blade / Ложный Клинок", reader: ""
  },
  "trait.elitnyeArhetipy.voron.stancesOfDeceit": {
    label: "Принимая определённые стойки, формирует работающий мистический узор из фрагментов, вживлённых под кожу и выгравированных на костях.",
    source: "Stances of Deceit / Стойки Обмана", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Гемункул — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.gemunkul.haemonculiCoven": {
    label: "Доступ к Лаборатории Гемункула (стационарный предмет R5): +80 на все тесты Medicae, Scholastic Lore (Chymistry) и Trade (Chymist),",
    source: "Haemonculi Coven / Ковен Гемункулов", reader: ""
  },
  "trait.elitnyeArhetipy.gemunkul.idealOfScience": {
    label: "Получает неизлечимое ментальное расстройство «Перфекционизм» Тяжести −2; Тяжесть не может опуститься ниже −2.",
    source: "Ideal of Science / Идеал Науки", reader: ""
  },
  "trait.elitnyeArhetipy.gemunkul.lordOfLords": {
    label: "При взятии архетипа может отказаться от любых Hatred, Enemy и Peer, связанных с жителями Комморага и их организациями (с одобрения ГМа).",
    source: "Lord of Lords / Владыка Владык", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Герольд — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.gerold.delegate": {
    label: "Представляет интересы всей верхушки банды и говорит от её имени. Если геральдика на его броне отображает личную символику одного из членов б…",
    source: "Delegate / Делегат", reader: ""
  },
  "trait.elitnyeArhetipy.gerold.livingBanner": {
    label: "Воплощение банды. В свой Ход может потратить Очко Бесчестия, чтобы пройти тест Command(F)+10 и Charm(F)+10 и восстановить одно ранее потраче…",
    source: "Living Banner / Живой Стяг", reader: ""
  },
  "trait.elitnyeArhetipy.gerold.noblesseOblige": {
    label: "Высокое доверие налагает большую ответственность — его провалы навлекают позор на всю банду.",
    source: "Noblesse Oblige / Благородство Обязывает", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Гладиатор — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.gladiator.bloodyPerformance": {
    label: "Гладиатор в равной мере артист и воин; его движения в бою завораживают аудиторию симфонией кровопролития.",
    source: "Bloody Performance / Кровавое Представление", reader: ""
  },
  "trait.elitnyeArhetipy.gladiator.momentum": {
    label: "Удача сопутствует смелым, и опытный гладиатор извлекает максимум из даже мельчайшей победы. Каждый раз,",
    source: "Momentum / Момент", reader: ""
  },
  "trait.elitnyeArhetipy.gladiator.morituri": {
    label: "Тренировка Гладиаторов позволяет выдерживать невероятные ранения. При получении непоглощённого урона в часть тела с AP 2 или меньше от носим…",
    source: "Morituri / Идущие на Смерть", reader: ""
  },
  "trait.elitnyeArhetipy.gladiator.redSands": {
    label: "Умелый гладиатор проливает кровь противника, но знает, что его жизнь принадлежит аудитории, а не ему.",
    source: "Red Sands / Красные Пески", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Дикий_Псайкер — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.dikiyPsayker.brokenChains": {
    label: "Аркано-механическая разгрузка вживлена в спину, затылок и руки, интегрирована в нервную систему. Даёт +3 бPR и Трейты Hoverer (W.",
    source: "Broken Chains / Порванные Цепи", reader: ""
  },
  "trait.elitnyeArhetipy.dikiyPsayker.chainRejection": {
    label: "Порванные Цепи медленно высасывают жизнь. Каждую неделю получает 1 урона в S и T, который нельзя восстановить отдыхом и медитацией;",
    source: "Chain Rejection / Отторжение Цепей", reader: ""
  },
  "trait.elitnyeArhetipy.dikiyPsayker.shieldOfChains": {
    label: "Защищён мощным психическим щитом из Порванных Цепей. Полученное попадание наносится по Щиту (бPR×3 Ран, бPR AP, поглощает через W.",
    source: "Shield of Chains / Щит Цепей", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Длань_Архонта — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.dlanArhonta.equalizeTheOdds": {
    label: "Отряд Длани Архонта обычно состоит из 8 участников, один из которых лидер. Если отряд превосходят численно,",
    source: "Equalize The Odds / Уравнивание Шансов", reader: ""
  },
  "trait.elitnyeArhetipy.dlanArhonta.establishedRole": {
    label: "При взятии архетипа может взять один из его талантов бесплатно, если в отряде эта роль не занята.",
    source: "Established Role / Установленная Роль", reader: ""
  },
  "trait.elitnyeArhetipy.dlanArhonta.fear1": {
    label: "Рейтинг Страха 1.",
    source: "Fear (1) / Страх", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Житель_Бездны — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.zhitelBezdny.daemonic4": {
    label: "+4 к рейтингу Daemonic.",
    source: "Daemonic (+4) / Демонический", reader: ""
  },
  "trait.elitnyeArhetipy.zhitelBezdny.theConductorOfDarkEnergy": {
    label: "Получает дополнительные атаки: Doomshock (Губительный Шок), Doomstorm (Губительный Шторм), Doomwave (Губительная Волна).",
    source: "The Conductor of Dark Energy / Проводник Тёмной Энергии", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Иерарх — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.ierarh.hisWill": {
    label: "Получает Hatred (Мятежники, враждебные банды Комморага, враждебные геллионы), кроме лояльных Архонту или полезных персонажу.",
    source: "His Will / Его Воля", reader: ""
  },
  "trait.elitnyeArhetipy.ierarh.invisibleThreads": {
    label: "Может пробрасывать Inquiry, Command, Charm, Commerce, Deceive и Scrutiny через Common Lore (Intrigue)(F/I). Может проходить Intimidate,",
    source: "Invisible Threads / Невидимые Нити", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Иерофант — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.ierofant.grandAgitator": {
    label: "Речи зажигают пламя праведной ярости и рвения к битве. Выступая перед толпой, может пройти комбинированный тест Charm+0 и Scholastic Lore(Im…",
    source: "Grand Agitator / Великий Агитатор", reader: ""
  },
  "trait.elitnyeArhetipy.ierofant.masterOfMasses": {
    label: "Глубокое понимание души толпы позволяет управлять ордами умело и точно, как опытный офицер дисциплинированными солдатами.",
    source: "Master of Masses / Владыка Масс", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Избиратель_Плоти — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.izbiratelPloti.daemonic2": {
    label: "+2 к рейтингу Daemonic.",
    source: "Daemonic (+2) / Демонический", reader: ""
  },
  "trait.elitnyeArhetipy.izbiratelPloti.darkSurgery": {
    label: "Работает только с R уроном. При успешном попадании (после щитов) может тестом Medicae(I)−10 добавить успехи к наносимому урону.",
    source: "Dark Surgery / Тёмная Хирургия", reader: ""
  },
  "trait.elitnyeArhetipy.izbiratelPloti.theRitualOfTheLimbs": {
    label: "Каждый 21 день должен собрать 5 конечностей качества Good.Q — 2 руки, 2 ноги и 1 голову. Конечности должны быть добыты в бою,",
    source: "The Ritual of the Limbs / Ритуал Конечностей", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Инзорцист — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.inzortsist.insorcism": {
    label: "Извлекая запечатанное имя, призывает демона в Материум, используя собственную душу как якорь.",
    source: "Insorcism / Инзорцизм", reader: ""
  },
  "trait.elitnyeArhetipy.inzortsist.markOfSubjugator": {
    label: "Душа отмечена связью с демонами. Демоны автоматически распознают его как поработителя своего рода при первом взгляде и получают Талант Hatre…",
    source: "Mark of Subjugator / Метка Поработителя", reader: ""
  },
  "trait.elitnyeArhetipy.inzortsist.nameSeal": {
    label: "Способен запечатать Истинное Имя демона в собственном разуме. Зная Истинное Имя, в присутствии демона (не более W м) может провести ритуал З…",
    source: "Name Seal / Печать Имени", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Инкуб — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.inkub.mercenaryOfTheMatter": {
    label: "Не отдаётся желанию пытать жертв, убивая их быстрыми ударами. В первом раунде имеет бесплатное Полное Движение,",
    source: "Mercenary of the Matter / Наёмник Дела", reader: ""
  },
  "trait.elitnyeArhetipy.inkub.mercenaryOfTheWord": {
    label: "Лишается всех Hatred и не имеет штрафов на общение с кем-либо, пока этот кто-то может быть потенциальным нанимателем.",
    source: "Mercenary of the Word / Наёмник Слова", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Кенетаи — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.kenetai.occultBlade": {
    label: "Способны формировать сложные психосилы на кромке клинка. Раз в Раунд после успешной рукопашной атаки Психосиловым оружием может за свободное…",
    source: "Occult Blade / Оккультный Клинок", reader: ""
  },
  "trait.elitnyeArhetipy.kenetai.sharedConsciousness": {
    label: "В бою Кенетаи и соратники действуют как единый организм. Потратив 5 минут на ритуал, может телепатически соединить свой разум с разумами до…",
    source: "Shared Consciousness / Общее Сознание", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Когитор — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.kogitor.dreamChaser": {
    label: "Получает неизлечимое ментальное расстройство «Психопатия» на Тяжести −1 (не может опуститься ниже −1);",
    source: "Dream Chaser / Гоняющийся за Мечтой", reader: ""
  },
  "trait.elitnyeArhetipy.kogitor.heartOfStone": {
    label: "При заключении Пакта сердце Когитора трансмутирует из плоти в техномагический конструкт, в который заключается его душа,",
    source: "Heart of Stone / Каменное Сердце", reader: ""
  },
  "trait.elitnyeArhetipy.kogitor.infernalInspiration": {
    label: "Разум освобождён от многих ограничений смертного тела и способен на сверхъестественную концентрацию.",
    source: "Infernal Inspiration / Инфернальное Вдохновение", reader: ""
  },
  "trait.elitnyeArhetipy.kogitor.pactProtection": {
    label: "Трейт From Beyond вызван связью его души с демоническим патроном, и (по крайней мере изначально) его разум не сильно отличается от человечес…",
    source: "Pact Protection / Защита Пакта (Когитор)", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Когнитэ — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.kognite.hypnoProgramming": {
    label: "Владеют невероятно эффективными техниками гипноза. Получают уникальный Навык Гипно-Программирование(W)+0 и могут развивать его как обычный Н…",
    source: "Hypno-Programming / Гипно-Программирование", reader: ""
  },
  "trait.elitnyeArhetipy.kognite.riteOfEightSpecks": {
    label: "Силы Когнитэ исходят из сделок с Разрушительными Силами, требующих подпитки свежими жертвами. Каждую неделю получает видение,",
    source: "Rite of Eight Specks / Ритуал Восьми Спиц", reader: ""
  },
  "trait.elitnyeArhetipy.kognite.veilOfLies": {
    label: "Гипноиндоктринация превращает разум в многослойный лабиринт из сконструированных личностей, в сердце которого скрыто ядро настоящих мыслей.",
    source: "Veil of Lies / Вуаль Лжи", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Коготь_Варпа — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.kogotVarpa.veilRender": {
    label: "Потратив Очко Бесчестия и полудействие, может разорвать когтями реальность и нырнуть в Варп по ту сторону.",
    source: "Veil Render / Разрыватель Завесы", reader: ""
  },
  "trait.elitnyeArhetipy.kogotVarpa.vorpalClaws": {
    label: "Руки и ноги искажаются в длинные когти, потрескивающие энергией Варпа. Считаются Когтями с профилем: Когти.P, Rng 1, Dmg 1d10+4 R, Pen 7,",
    source: "Vorpal Claws / Стрижающие Когти", reader: ""
  },
  "trait.elitnyeArhetipy.kogotVarpa.warpTalonSuit": {
    label: "Броня и прыжковый ранец сливаются с телом. Не способен снимать броню и прыжковый ранец,",
    source: "Warp Talon Suit / Доспех Когтя Варпа", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Колдун_Рубрики — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.koldunRubriki.golemMaster": {
    label: "Имеет 8 душ големов, привязанных к его душе. Может потратить одну (комплект силовой брони, Л. Болтер или любое оружие, слот Миньона),",
    source: "Golem Master / Повелитель Големов", reader: ""
  },
  "trait.elitnyeArhetipy.koldunRubriki.rubricOfAhriman": {
    label: "Пережил великий ритуал Аримана, не обратившись в прах. Получает Трейт Unnatural Willpower (+2), но эти +2 не увеличивают максимальный PR.",
    source: "Rubric of Ahriman / Рубрика Аримана", reader: ""
  },
  "trait.elitnyeArhetipy.koldunRubriki.shieldOfRubric": {
    label: "Рубрика одарила персонажа мистической защитой, отражающей вражеские болты и клинки. Даёт не перегружающий чародейский щит-купол с рейтингом…",
    source: "Shield of Rubric / Щит Рубрики", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Король_Червей — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.korolChervey.handOfPlenty": {
    label: "Избран вести свой народ и обеспечивать всем необходимым. Расширяя рой паразитов, может создавать еду, питьё,",
    source: "Hand of Plenty / Рука Изобилия", reader: ""
  },
  "trait.elitnyeArhetipy.korolChervey.verminousConduit": {
    label: "Благословенные Нурглом черви в плоти служат проводником мистической силы. Получает +1 к эPR психосил Нургла и Биомантии.",
    source: "Verminous Conduit / Паразитический Проводник", reader: ""
  },
  "trait.elitnyeArhetipy.korolChervey.wormMaster": {
    label: "В бою может мистически размножать рои паразитов, формируя аморфные боевые конструкты.",
    source: "Worm Master / Повелитель Червей", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Кузнец_Крови — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.kuznetsKrovi.ringOfBlood": {
    label: "Победив демона в ритуальном поединке, может поработить его. Перед призывом демона может заключить себя и его в ритуальный круг,",
    source: "Ring of Blood / Кольцо Крови", reader: ""
  },
  "trait.elitnyeArhetipy.kuznetsKrovi.valourousAccord": {
    label: "Связан жёстким кодексом чести — полагаться только на собственные силы. Если использует психосилы, психосиловое оружие,",
    source: "Valourous Accord / Соглашение Доблести", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Лакрималлус — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.lakrimallus.cyberembrace": {
    label: "За минуту работы может встроить в беспомощного или не сопротивляющегося человека рудиментарные кибернетические импланты (авто-фабрикаторы ег…",
    source: "Cyberembrace / Киберобъятья", reader: ""
  },
  "trait.elitnyeArhetipy.lakrimallus.toilseer": {
    label: "Может использовать Миньонов-сервиторов и тех-траллов как ассистентов в тестах Крафта даже без нужных Навыков (Орды считаются как 1 ассистент…",
    source: "Toilseer / Трудовидец", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Ламия — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.lamiya.blessingOfShaimesh": {
    label: "Перед боем может усилить оружие до I.b персонажей (для себя бесплатно), дав ему Crippling (+2), Felling (4/+2), Toxic (+2).",
    source: "Blessing of Shaimesh / Благословение Шаимеша", reader: ""
  },
  "trait.elitnyeArhetipy.lamiya.shaimeshDisciple": {
    label: "Снижает редкость всех ядов на 1 в расчёте крафта. Заканчивая крафт яда, может тестом Trade (Chymist)(I)+10 поднять его качество на 1.",
    source: "Shaimesh Disciple / Ученица Шаимеш", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Лорд_Дискордант — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.lordDiskordant.corruptedNoosphere": {
    label: "Подключив импланты к эфирным излучателям Сталкера, наполняет Ноосферу вокруг порченым кодом. В ауре радиусом I.",
    source: "Corrupted Noosphere / Порченная Ноосфера", reader: ""
  },
  "trait.elitnyeArhetipy.lordDiskordant.daemonicUplink": {
    label: "Тесная связь души и разума с демоническими машинами позволяет оптимизировать их рутины. Когда в пределах I.",
    source: "Daemonic Uplink / Демоническое Подключение", reader: ""
  },
  "trait.elitnyeArhetipy.lordDiskordant.machineSpiritThief": {
    label: "Техно-арканные накопители в скакуне поглощают психические эхо разрушенных духов машин.",
    source: "Machine Spirit Thief / Вор Духов Машины", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Малагра — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.malagra.astralConverter": {
    label: "Реактор в сердце черпает силу из крохотной звезды, заключённой техниками Тёмной Эры Технологий.",
    source: "Astral Converter / Астральный Конвертер", reader: ""
  },
  "trait.elitnyeArhetipy.malagra.digitalGhost": {
    label: "Ноосферные протоколы способны проскользнуть мимо внимания самого бдительного наблюдателя, не оставляя следов.",
    source: "Digital Ghost / Цифровой Призрак", reader: ""
  },
  "trait.elitnyeArhetipy.malagra.malagraCortex": {
    label: "Кортикальные импланты экранированы гексаграмматическими кодами и защищают разум от вторжения чужой воли.",
    source: "Malagra Cortex / Кортекс Малагра", reader: ""
  },
  "trait.elitnyeArhetipy.malagra.paragonCoil": {
    label: "Комплекс электромагнитных имплантов окутывает его мантией магнитного поля и нимбом сияния. Оснащён Люминен Конденсаторами, Маглев Спиралями,",
    source: "Paragon Coil / Совершенная Катушка", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Мастер_Казней — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.masterKazney.execution": {
    label: "Вооружённый двуручным рукопашным оружием в двуручном хвате, совершая им атаку по достойной трофея цели: если не убил её этой атакой,",
    source: "Execution / Казнь", reader: ""
  },
  "trait.elitnyeArhetipy.masterKazney.hunterSight": {
    label: "Трейт Unnatural Senses отображает способность видеть души жертв. Автоматически распознаёт души существ, достойных трофея,",
    source: "Hunter Sight / Взор Охотника", reader: ""
  },
  "trait.elitnyeArhetipy.masterKazney.mistwalker": {
    label: "Раз в Раунд за свободное действие может разбиться на облако тумана и собраться обратно, телепортируясь на P.",
    source: "Mistwalker / Туманоходец", reader: ""
  },
  "trait.elitnyeArhetipy.masterKazney.singleMindedHunter": {
    label: "Ритуалы перманентно изменяют разум. Получает ментальное расстройство «Психопатия» на Тяжести 0, и его Тяжесть не может опуститься ниже 0.",
    source: "Single-Minded Hunter / Целеустремлённый Охотник", reader: ""
  },
  "trait.elitnyeArhetipy.masterKazney.trophyTaker": {
    label: "Убив вражеского офицера, чемпиона или чудовище (по усмотрению ГМа), получает 1 очко Трофеев (макс. P.b).",
    source: "Trophy Taker / Собиратель Трофеев", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Медуза — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.meduza.deadlyNaturalWeapon2Tentacles7Bite": {
    label: "Естественное оружие медузы.",
    source: "Deadly Natural Weapon (2, Tentacles; 7, Bite) / Deadly Natural Weapon (2, Щупальца; 7, Укус)", reader: ""
  },
  "trait.elitnyeArhetipy.meduza.empath": {
    label: "Медуза получает дополнительные профили атак, совершаемые через тест W: Eyeburst (Глазная Вспышка), Empathy (Эмпатия), Coma (Кома),",
    source: "Empath / Эмпат", reader: ""
  },
  "trait.elitnyeArhetipy.meduza.fromBeyond": {
    label: "Чуждое сознание: сопротивление воздействиям на разум.",
    source: "From Beyond / Извне", reader: ""
  },
  "trait.elitnyeArhetipy.meduza.fromBeyond2": {
    label: "Чуждое сознание: сопротивление воздействиям на разум.",
    source: "From Beyond / Извне", reader: ""
  },
  "trait.elitnyeArhetipy.meduza.hovererWB": {
    label: "Медуза парит, пока она без хоста.",
    source: "Hoverer (W.b) / Парящий", reader: ""
  },
  "trait.elitnyeArhetipy.meduza.medusae": {
    label: "Сознание персонажа объединяется с медузой. Медуза должна получать эмоции как пищу: без хотя бы одной сильной эмоции в месяц она дематериализ…",
    source: "Medusae / Медуза", reader: ""
  },
  "trait.elitnyeArhetipy.meduza.parasite": {
    label: "Медуза существует за счёт носителя.",
    source: "Parasite / Паразит", reader: ""
  },
  "trait.elitnyeArhetipy.meduza.warpSight": {
    label: "Видит потоки имматериума.",
    source: "Warp Sight / Варп-Зрение", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Мейстер — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.meyster.cultivation": {
    label: "Вирус Жизни в теле пациента собирает его страдания и боль, накапливая их для сбора Мейстером. Каждый раз,",
    source: "Cultivation / Культивация", reader: ""
  },
  "trait.elitnyeArhetipy.meyster.deathlessOath": {
    label: "Получает неизлечимое ментальное расстройство «Сноб» на Тяжести 0 (не может опуститься ниже 0);",
    source: "Deathless Oath / Несмертная Клятва", reader: ""
  },
  "trait.elitnyeArhetipy.meyster.lifeVirus": {
    label: "Потратив 5 минут работы, может синтезировать дозу персонализированного вируса, укрепляющего организм цели.",
    source: "Life Virus / Вирус Жизни", reader: ""
  },
  "trait.elitnyeArhetipy.meyster.pactProtection": {
    label: "Трейт From Beyond вызван связью его души с демоническим патроном, и (по крайней мере изначально) его разум не сильно отличается от человечес…",
    source: "Pact Protection / Защита Пакта (Мейстер)", reader: ""
  },
  "trait.elitnyeArhetipy.meyster.savantOfLifeAndDeath": {
    label: "Имеет доступ к безграничным медицинским знаниям своего покровителя. Автоматически преуспевает во всех тестах медицинской диагностики и автом…",
    source: "Savant of Life and Death / Савант Жизни и Смерти", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Монарх — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.monarh.brainHarvesting": {
    label: "Не может изучать новые психосилы или повышать PR своих вассалов — только достать новый контейнер с мозгом псайкера с нужными знаниями.",
    source: "Brain Harvesting / Извлечение Мозга", reader: ""
  },
  "trait.elitnyeArhetipy.monarh.coronaPolentia": {
    label: "Позволяет подсоединять к своему мозгу контейнеры с мозгами живых псайкеров, чтобы использовать их силы.",
    source: "Corona Polentia / Корона Полентия", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Моритат — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.moritat.chainShot": {
    label: "Перегружая силовой ранец, может выжать из пистолетов невероятную скорострельность. Силовой ранец включает интегрированный прыжковый ранец па…",
    source: "Chain Shot / Цепной Выстрел", reader: ""
  },
  "trait.elitnyeArhetipy.moritat.noLordNorServant": {
    label: "Путь Моритата — путь одиночества. Не может признавать авторитет командиров и не получает преимущества Командования.",
    source: "No Lord, Nor Servant / Ни Владыка, Ни Слуга", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Ночной_Демон — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.nochnoyDemon.chosenOneOfDarkness": {
    label: "Все подчинённые-мандрагоры, когда персонаж уходит во тьму или фазовое состояние, могут уйти вместе с ним и перенестись в указанную им точку.",
    source: "Chosen One of Darkness / Избранник Тьмы", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Облитератор — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.obliterator.fleshmetalBody": {
    label: "Не способен носить броню или использовать обычное оружие и инструменты — формирует их из собственного тела.",
    source: "Fleshmetal Body / Тело Из Плотеметалла", reader: ""
  },
  "trait.elitnyeArhetipy.obliterator.livingArsenal": {
    label: "За полное действие может ассимилировать касанием любое оружие или механизм размера, которым может пользоваться космодесантник или персонаж п…",
    source: "Living Arsenal / Живой Арсенал", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Питати — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.pitati.runicBullet": {
    label: "Имея инструменты резчика или хотя бы нож и потратив 5 минут, может отметить одну пулю личными рунами для использования с Трейтом Рунный Выст…",
    source: "Runic Bullet / Рунная Пуля", reader: ""
  },
  "trait.elitnyeArhetipy.pitati.runicShot": {
    label: "Одиночные выстрелы рунной пулей получают +тPR Dmg и +½тPR Pen (окр.▼). Раз в Ход после успешной одиночной стрелковой атаки рунной пулей може…",
    source: "Runic Shot / Рунный Выстрел", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Ревенант — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.revenant.pactProtection": {
    label: "Трейт From Beyond вызван связью его души с демоническим патроном, и (по крайней мере изначально) его разум не сильно отличается от человечес…",
    source: "Pact Protection / Защита Пакта (Ревенант)", reader: ""
  },
  "trait.elitnyeArhetipy.revenant.shadowOfVengeance": {
    label: "Считает Навыки Inquiry, Interrogate, Security и Stealth дружественными, а Acrobatics и Dodge — нейтральными, независимо от покровительства.",
    source: "Shadow of Vengeance / Тень Отмщения", reader: ""
  },
  "trait.elitnyeArhetipy.revenant.vengeanceWeapon": {
    label: "Выбирает одно оружие Редкостью 1 или ниже (Космодесантники считают по Редкости аналогов для людей). Может сделать это оружие Best.",
    source: "Vengeance Weapon / Оружие Отмщения", reader: ""
  },
  "trait.elitnyeArhetipy.revenant.vengefulOne": {
    label: "Получает неизлечимое ментальное расстройство «Ненависть» на Тяжести 0 (не может опуститься ниже 0);",
    source: "Vengeful One / Мстительный", reader: ""
  },
  "trait.elitnyeArhetipy.revenant.vengefulSpirit": {
    label: "Демон-покровитель при заключении Пакта отрывает от себя крохотную частичку своей сущности, формируя из неё мелкого демона,",
    source: "Vengeful Spirit / Мстительный Дух", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Секутор — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.sekutor.lumberingGiant": {
    label: "Массивный фрейм прочен, но медлителен. Весит 1,2 тонны, получает +10 Ран, но не может совершать Бег,",
    source: "Lumbering Giant / Громыхающий Гигант", reader: ""
  },
  "trait.elitnyeArhetipy.sekutor.paladinFrame": {
    label: "Фрейм почти полностью заменяет тело, оставляя головной и спинной мозг. Оборудован всеми кибернетическими чувствами Best.Q,",
    source: "Paladin Frame / Фрейм Паладина", reader: ""
  },
  "trait.elitnyeArhetipy.sekutor.structuralAnalysis": {
    label: "Церебральные импланты позволяют определять слабые места в любой структуре и поражать их. Проводя одиночную Избирательную атаку,",
    source: "Structural Analysis / Структурный Анализ", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Сибарит — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.sibarit.powerOfStrength": {
    label: "Может использовать Intimidate вместо Command; командуя своим отрядом, получает +15 на тесты командования.",
    source: "Power of Strength / Власть Силы", reader: ""
  },
  "trait.elitnyeArhetipy.sibarit.tyrantSReputation": {
    label: "Теряет Inf, если подчинённый подрывает его репутацию отказом подчиняться, бездействием или громким провалом: от 1 Inf за неподчинение до 10…",
    source: "Tyrant's Reputation / Репутация Тирана", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Скорбные_Пасти — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.skorbnyePasti.markOfRevenge": {
    label: "Обладая именем, изображением, каплей крови, подписью или личным предметом существа, может объявить на него Метку Мести. Пока метка держится,",
    source: "Mark of Revenge / Метка Мести", reader: ""
  },
  "trait.elitnyeArhetipy.skorbnyePasti.theTimeHasCome": {
    label: "Появляясь в материальном мире в 500 м от цели с меткой, гасит все осветительные приборы в 100 м от неё,",
    source: "The Time Has Come / Время Пришло", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Скульптор_Плоти — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.skulptorPloti.insanelyMalleable": {
    label: "Власть над собственной плотью позволяет изменять её за секунды. За полудействие может потратить Очко Бесчестия и пройти тест Medicae−10,",
    source: "Insanely Malleable / Безумно Податливый", reader: ""
  },
  "trait.elitnyeArhetipy.skulptorPloti.riteOfFleshmolding": {
    label: "Имея доступ к операционной, освящённой как храм Слаанеш, к одному подопытному и хотя бы одному донору (разумные существа),",
    source: "Rite of Fleshmolding / Ритуал Лепки Плоти", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Суккуб — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.sukkub.brideOfDeath": {
    label: "Если при Быстрой или Молниеносной атаке число попаданий меньше ⅓ (окр. вверх) A.b персонажа, оно становится равно ⅓ (окр. вверх) A.b.",
    source: "Bride of Death / Невеста Смерти", reader: ""
  },
  "trait.elitnyeArhetipy.sukkub.brutalChargeWsB": {
    label: "Дополнительный урон при Натиске, равный Бонусу Оружейного Мастерства.",
    source: "Brutal Charge (WS.b) / Жестокий Натиск", reader: ""
  },
  "trait.elitnyeArhetipy.sukkub.stormOfBlades": {
    label: "Доступна Стойка Суккуба; её можно совмещать со Стойкой Гекатрии, имея сразу две. Стойка Суккуба (парное оружие одного типа): когда персонаж…",
    source: "Storm of Blades / Шторм Клинков", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Т_мный_Апостол — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.tMnyyApostol.darkDevotion": {
    label: "Может потратить Очко Бесчестия, чтобы соорудить монумент Разрушительным Силам. Время и ресурсы зависят от амбиций (алтарь из ритуально распя…",
    source: "Dark Devotion / Тёмное Поклонение", reader: ""
  },
  "trait.elitnyeArhetipy.tMnyyApostol.harbingerOfHeresy": {
    label: "Опытный религиозный оратор. Может социально воздействовать в 10 раз на больше целей, чем обычно. Может потратить Очко Бесчестия,",
    source: "Harbinger of Heresy / Предвестник Ереси", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Тенеткач — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.tenetkach.daemonic3": {
    label: "+3 к рейтингу Daemonic.",
    source: "Daemonic (+3) / Демонический", reader: ""
  },
  "trait.elitnyeArhetipy.tenetkach.daemonic32": {
    label: "+3 к рейтингу Daemonic.",
    source: "Daemonic (+3) / Демонический", reader: ""
  },
  "trait.elitnyeArhetipy.tenetkach.daemonic33": {
    label: "+3 к рейтингу Daemonic.",
    source: "Daemonic (+3) / Демонический", reader: ""
  },
  "trait.elitnyeArhetipy.tenetkach.lordOfDarkness": {
    label: "В радиусе Daemonic метров любые источники света затухают независимо от природы. Псайкеры-пироманты могут применять силы,",
    source: "Lord of Darkness / Владыка Тьмы", reader: ""
  },
  "trait.elitnyeArhetipy.tenetkach.theExaltedMandrake": {
    label: "Получает Multiple Arms (+2). Руки из чистой тьмы игнорируют E(Ls) урон и существуют в любой зоне.",
    source: "The Exalted Mandrake / Возвышенный Мандрагор", reader: ""
  },
  "trait.elitnyeArhetipy.tenetkach.theExaltedMandrake2": {
    label: "Получает Multiple Arms (+2). Руки из чистой тьмы игнорируют E(Ls) урон и существуют в любой зоне.",
    source: "The Exalted Mandrake / Возвышенный Мандрагор", reader: ""
  },
  "trait.elitnyeArhetipy.tenetkach.theExaltedMandrake3": {
    label: "Получает Multiple Arms (+2). Руки из чистой тьмы игнорируют E(Ls) урон и существуют в любой зоне.",
    source: "The Exalted Mandrake / Возвышенный Мандрагор", reader: ""
  },
  "trait.elitnyeArhetipy.tenetkach.theExaltedMandrake4": {
    label: "Получает Multiple Arms (+2). Руки из чистой тьмы игнорируют E(Ls) урон и существуют в любой зоне.",
    source: "The Exalted Mandrake / Возвышенный Мандрагор", reader: ""
  },
  "trait.elitnyeArhetipy.tenetkach.theExaltedMandrake5": {
    label: "Получает Multiple Arms (+2). Руки из чистой тьмы игнорируют E(Ls) урон и существуют в любой зоне.",
    source: "The Exalted Mandrake / Возвышенный Мандрагор", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Тех_Ассасин — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.tehAssasin.assassinFrame": {
    label: "Фрейм почти полностью заменяет тело, оставляя только головной и спинной мозг, биологические глаза и уши.",
    source: "Assassin Frame / Фрейм Ассасина", reader: ""
  },
  "trait.elitnyeArhetipy.tehAssasin.paradoxVeil": {
    label: "Наполовину технологическое, наполовину демоническое устройство стирает его с восприятия любых технологических сенсоров и Ноосферы: микрофоны…",
    source: "Paradox Veil / Вуаль Парадокса", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Укротитель — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.ukrotitel.beastMaster": {
    label: "Игнорирует Inf для подчинения Миньонов-Зверей и увеличивает максимум миньонов на P.b×2. Его звери в его присутствии игнорируют страх,",
    source: "Beast Master / Мастер Зверей", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Чемпион_Терминатор — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.chempionTerminator.gracefulGiant": {
    label: "Двигается в Терминаторской броне почти так же непринуждённо, как в обычной. Уменьшает штраф к A на 10, увеличивает Max.A на 10,",
    source: "Graceful Giant / Изящный Гигант", reader: ""
  },
  "trait.elitnyeArhetipy.chempionTerminator.legendaryPlate": {
    label: "Терминаторская броня — символ могущества среди Космодесантников Хаоса. В общении с другими Космодесантниками и персонажами с Талантом Ancien…",
    source: "Legendary Plate / Легендарные Латы", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Чернокнижник — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.chernoknizhnik.darkArts": {
    label: "Работает аналогично Трейту Psyker (PR2), но исключительно в части использования психосил.",
    source: "Dark Arts / Тёмные Искусства", reader: ""
  },
  "trait.elitnyeArhetipy.chernoknizhnik.transcription": {
    label: "Нуждается в глубоком понимании механизмов, а не инстинктивном. Не имеет врождённого фокуса ни на одну психодисциплину, кроме божественных.",
    source: "Transcription / Транскрипция", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Чумной_Десантник — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.chumnoyDesantnik.abominablePhysiology": {
    label: "Болезни и паразиты делают его невероятно живучим. Не получает негативных эффектов болезней и ядов (в т.ч. наркотиков), если сам не пожелает.",
    source: "Abominable Physiology / Отвратная Физиология", reader: ""
  },
  "trait.elitnyeArhetipy.chumnoyDesantnik.infectiousMiasma": {
    label: "Раз за бой может потратить Очко Бесчестия, выпустив облако демонических мух и трупных газов.",
    source: "Infectious Miasma / Заразные Миазмы", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Чумной_Монах — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.chumnoyMonah.carrionEater": {
    label: "За 7 минут может сожрать труп разумного существа на расстоянии рукопашной атаки, восстанавливая 1d5 + T.b Ран, т.к.",
    source: "Carrion Eater / Пожиратель Мертвечины", reader: ""
  },
  "trait.elitnyeArhetipy.chumnoyMonah.corpsePoison": {
    label: "Безоружные атаки Монаха получают свойства Toxic (2) и Corrosive (2). Может за полное действие измазать одно своё оружие ближнего боя в трупн…",
    source: "Corpse Poison / Трупный Яд", reader: ""
  },
  "trait.elitnyeArhetipy.chumnoyMonah.feveredSpeed": {
    label: "Энергия жизни, расходящаяся от вздутого паразитами живота, придаёт ему неестественную дёрганую скорость.",
    source: "Fevered Speed / Горячечная Скорость", reader: ""
  },
  "trait.elitnyeArhetipy.chumnoyMonah.forsakeTheFlame": {
    label: "Благословения монаха отрицают оружие, что сжигает плоть, изгоняя её из цикла жизни и смерти. Не может использовать оружие,",
    source: "Forsake the Flame / Отвергни Пламя", reader: ""
  },
  "trait.elitnyeArhetipy.chumnoyMonah.putrescenceWithin": {
    label: "Благословенные паразиты в плоти монаха защищают его от вреда, а их дары разрушают и размягчают оружие.",
    source: "Putrescence Within / Гниль Внутри", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Шумовой_Десантник — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.shumovoyDesantnik.dreadWail": {
    label: "Раз за бой может потратить Очко Бесчестия, чтобы перегрузить динамики и звуковые усилители брони: до начала следующего Хода усилить Dmg и Pe…",
    source: "Dread Wail / Грозный Вопль", reader: "module/combat/dread-wail.mjs + apps/dread-wail-dialog.mjs (wdbc-sk8s)"
  },
  "trait.elitnyeArhetipy.shumovoyDesantnik.intoxicatingUproar": {
    label: "Шумовой Десантник слышит каждый щелчок и выстрел на поле боя, опьянён шумами смерти. Получает +20 на все тесты слуха и не может быть застигн…",
    source: "Intoxicating Uproar / Пьянящий Рёв", reader: ""
  },
  // ── Черты: packs-src/traits/Элитные_архетипы\Электрожрец — Фаза 2, capability-документация ──
  "trait.elitnyeArhetipy.elektrozhrets.electropriestCoils": {
    label: "Сеть накопителей и эмиттеров расходится через тело от блока священных машин на спине;",
    source: "Electropriest Coils / Катушки Электрожреца", reader: ""
  },
  "trait.elitnyeArhetipy.elektrozhrets.motiveStimulation": {
    label: "Считает S, T и A дружественными Характеристиками независимо от Покровительства, за счёт постоянной электростимуляции мышц, придающей тонус,",
    source: "Motive Stimulation / Мотивирующая Стимуляция", reader: ""
  },
  "trait.elitnyeArhetipy.elektrozhrets.powerFromFlesh": {
    label: "Все эффекты Архетипа (включая бонусы к Характеристикам) действуют только с фреймом Хоминис и теряются при установке другого Фрейма.",
    source: "Power From Flesh / Сила Из Плоти", reader: ""
  },
  // ── Дары Богов Хаоса (wdbc-1rno) — активные/условные способности без
  // подходящего поля Конструктора, заглушка данными, reader пуст сознательно ──
  "gift.khorne.bloodAnointed": {
    label: "Не перегружающийся щит-дефлектор 1-44 (1-88 в крови) от стрелковых атак/взрывов, если не стрелял и связан/шёл к врагу",
    source: "Дар Кхорн (Blood-Anointed)",
    reader: ""
  },
  "gift.khorne.bloodFlame": {
    label: "Полудействие+1R себе: рукопашное оружие получает Power Field+Flame, +2 Dmg за убийство (макс +8), ломается после боя",
    source: "Дар Кхорн (Blood Flame)",
    reader: ""
  },
  "gift.khorne.bronzeMyrmidon": {
    label: "Попадания в сочленения/визоры = попадания в конечности/голову (себе и скакуну/технике при верховой/пилотируемой) — редиректа попаданий в локацию в системе нет, гейтить нечем (Трейт Machine(+½Cor.b) в Ярости вынесен отдельной записью kind:trait/when.requireRage, wdbc-wyr3)",
    source: "Дар Кхорн (Bronze Myrmidon)",
    reader: ""
  },
  "gift.khorne.countenanceOfKhorne": {
    label: "+20/+30 социальные тесты (солдаты/воины ⇄ смертные последователи) и +10 Запугивание против прочих механизированы тремя записями kind:\"testMod\" на этом же предмете — читаются как галочки диалога броска (игрок сам решает, применимо ли к конкретной цели, тот же принцип, что и у любого другого testMod в системе). Capability покрывает ТОЛЬКО остаток: демоны Кхорна ниже Герольда признают авторитет при Inf 30+; +1 Бесчестия: Страх 3 на ход (не действует на Кхорнитов, особая реакция у Слаанешитов) — не смоделированы",
    source: "Дар Кхорн (Countenance of Khorne)",
    reader: ""
  },
  "gift.khorne.crimsonAngel": {
    label: "Видя Ненавистную цель — Трейт Flyer(A.b×2); теряется, если в свой Ход не двигался к ней/не атаковал",
    source: "Дар Кхорн (Crimson Angel)",
    reader: ""
  },
  "gift.khorne.eternalWarrior": {
    label: "Умирая в Ярости — раз за сессию бесплатное Чудесное Спасение/Божественная Защита (без траты Бесчестия/Порчи), либо за Очко Бесчестия при дальней стрелковой смерти",
    source: "Дар Кхорн (Eternal Warrior)",
    reader: "module/combat/eternal-warrior.mjs (wdbc-sk8s) — eternalWarriorEligible/eternalWarriorFreeSaveAvailable/markEternalWarriorUsed; module/sheets/tabs/death.mjs::_resolveFateSave(eternalWarrior). «Дистанция Натиска до убийцы» не отслеживается движком — путь FLAT (1 Очко Бесчестия) подтверждается самим игроком флажком в диалоге, не автоопределением."
  },
  "gift.khorne.eyeOfChallenge": {
    label: "+1 Бесчестия: выделить 4 сильнейших воинов в поле зрения, узнать WS/S/Parry/Берсерк-Таланты одного — не бросить вызов за минуту = 2d10+8 урона в W",
    source: "Дар Кхорн (Eye of Challenge)",
    reader: ""
  },
  "gift.khorne.fatherOfBattle": {
    label: "Полудействие: видение указывает следующее действие к цели; выполнение по видению без отклонений даёт +1 Бесчестия сверх обычного",
    source: "Дар Кхорн (Father of Battle)",
    reader: ""
  },
  "gift.khorne.handOfKhorne": {
    label: "Основная рука: +8 AP, ×2 S.b в атаках ею, +2 Размера при парировании этой рукой; стрелковые атаки этой рукой автопровальны — см. также ОТЛОЖЕНО в памяти (слишком составной/локальный для текущих полей)",
    source: "Дар Кхорн (Hand of Khorne)",
    reader: ""
  },
  "gift.khorne.knightOfKhorne": {
    label: "Демонический скакун (Джаггернаут Кхорна) в услужении — призыв ритуалом, Демоническое Владычество, вселение в технику даёт +8 AP от стрельбы и доп. кубик урона в ближнем бою/Таране",
    source: "Дар Кхорн (Knight of Khorne)",
    reader: ""
  },
  "gift.khorne.livingWeapon": {
    label: "Полудействие+1 Бесчестия: до конца боя оружие/импровизированное оружие в руке нельзя выбить, +10 WS, Баланс до 0, Pen до Cor.b, теряет Primitive/получает Reinforced (импровизированное: без штрафа −20, +1 кубик, ×2 S.b). Disarm-часть подключена под combat.cannotBeDisarmed (wdbc-egll), гейтится system.activatable/active (isItemActive) — кнопка на листе включает/выключает предмет целиком, полудействие/1 Бесчестие на вход и конец боя/сцены на выход — вручную. +10 WS/Баланс/Pen/Reinforced-Primitive — ещё не заведены (нужен профиль оружия в руке, отдельная работа).",
    source: "Дар Кхорн (Living Weapon)",
    reader: "module/data/item/mutation.mjs (activatable/active) + module/apps/effects.mjs::isItemActive case \"mutation\" — только capabilityKey combat.cannotBeDisarmed, остальное ещё не читается"
  },
  "gift.khorne.priestOfBloodshed": {
    label: "Раз за Раунд: в 8м от чемпиона Кровотечение/смерть в бою другого персонажа даёт 1 Очко Бесчестия (сгорает в конце следующего Хода)",
    source: "Дар Кхорн (Priest of Bloodshed)",
    reader: ""
  },
  "gift.khorne.purityOfBattle": {
    label: "Полное действие (даже в Ярости)+1 Бесчестия: сферическая волна Cor.b м снимает боевые наркотики/психосилы/техночудеса со всех в радиусе, эффекты нельзя наложить повторно до конца боя",
    source: "Дар Кхорн (Purity of Battle)",
    reader: ""
  },
  "gift.khorne.purityOfWrath": {
    label: "В Ярости: иммунитет к ядам/радиации/болезням и к Crippling/Piercing/Haywire/Shocking/Snare — иммунитет к 5 свойствам оружия реализован через weaponPropertyImmunityInRage.* (гейт по system.inRage), см. те записи; иммунитет к ядам/радиации/болезням (не свойства оружия, отдельная категория) остаётся неавтоматизированным",
    source: "Дар Кхорн (Purity of Wrath)",
    reader: "5 записей weaponPropertyImmunityInRage.{crippling,piercing,haywire,shocking,snare}"
  },
  "gift.khorne.redSun": {
    label: "В Ярости+1 Бесчестия: нимб над головой до конца Ярости — видящие его в 16м проходят W+0 или впадают в Ярость, не могут выйти из неё, пока видят нимб",
    source: "Дар Кхорн (Red Sun)",
    reader: ""
  },
  "gift.khorne.theHunter": {
    label: "Полное действие+1 Бесчестия, видя псайкера: призыв Гончей Плоти в Истинной Форме, атакующей ближайшего псайкера, возвращается в Варп после убийства",
    source: "Дар Кхорн (The Hunter)",
    reader: ""
  },
  "gift.khorne.tirelessWarrior": {
    label: "Убийство рукопашной атакой в бою: снять 1 Усталость, восстановить 1d5-1 Ран/урона в Характеристику, засчитан 1 час здорового сна",
    source: "Дар Кхорн (Tireless Warrior)",
    reader: ""
  },
  "gift.khorne.truthSeer": {
    label: "Автопобеда над обманом с Cor.b Успехами; иммунитет к галлюциногенам/Иллюзионизму, видит истинные формы/сквозь иллюзии — статус см. остальные записи блока mechanics. Преимущество на встречные тесты против Финта механизировано (wdbc-u0by, kind:\"reroll\", char:ws) — опциональная радиокнопка в диалоге Состязаний (module/combat/techniques.mjs::_showContestDialog, раньше вообще не читал реестр правил). Диалог общий для ОБЕИХ сторон контеста (инициатора и обороняющегося) — роль не различается программно, честное самоподтверждение игрока решает, отмечать ли галочку (тот же принцип, что у остальных опциональных перебросов); заодно шире книги — сработает на любом тесте WS, не только Финте",
    source: "Дар Кхорн (Truth-Seer)",
    reader: "module/rules/item-rules.mjs (kind:\"reroll\" → опциональный переброс), module/combat/techniques.mjs::_showContestDialog"
  },
  "gift.khorne.witchSeeker": {
    label: "+30 Выживание (выслеживание псайкеров) механизировано отдельной записью kind:\"testMod\" на этом же предмете. Capability покрывает ТОЛЬКО остаток: Awareness+0 (+30 если псайкер манифестировал в сцене) чует псайкеров по запаху; на 3+ Успехах опознаёт использованные ими психосилы — не смоделированы",
    source: "Дар Кхорн (Witch-Seeker)",
    reader: ""
  },
  "gift.nurgle.absurdlyFat": {
    label: "+10 аблативных Ран и авторегенерация 1/Ход (kind:\"poolMax\"/ablativeWounds); Размер +1 без влияния на SPD — kind:\"characteristic\"/charKey:\"sizeNoSpd\" (wdbc-w8ws)",
    source: "Дар Нургл (Absurdly Fat)",
    reader: "module/rules/wounds.mjs (ablativeAbsorb/applyWoundLoss/woundLossUpdates), module/combat/ablative-wounds.mjs (processAblativeWoundsTurnStart), module/apps/mechanics.mjs (characteristicEffectKey charKey:\"sizeNoSpd\" → system.sizeModNoSpd), module/rules/character.mjs (traitSizeModNoSpd, не идёт в calcMovement)"
  },
  "gift.nurgle.blackPhysician": {
    label: "Полное действие+1R себе: заражает до 3 трупов в 2м, оживают зомби (Раны×2, теряют Навыки/Таланты кроме оружейных), контроль до Cor.b зомби",
    source: "Дар Нургл (Black Physician)",
    reader: ""
  },
  "gift.nurgle.breathOfLife": {
    label: "Раны чемпиона падают до 0, труп (умерший ≤3 дня назад) оживает с 0 Ран; повторно недоступно, пока свои Раны не вылечены полностью",
    source: "Дар Нургл (Breath of Life)",
    reader: ""
  },
  "gift.nurgle.cancerousHealing": {
    label: "Полное действие: касание раненого (текущая цель game.user.targets) — диалог «Цель согласна»; без согласия — полноценная безоружная атака (showAttackDialogNoWeapon: WS/база/стойка/усталость, Уклонение/Парирование цели), эффект по кнопке в чат-карточке ПОСЛЕ подтверждённого попадания, не автоматически. Лечит Кровотечение/Crippling, даёт аблативные Раны = недостающим; −2 A/−2 S (Значение, .totalFx — сверено с книгой) за каждую, считает только СВОЮ долю пула",
    source: "Дар Нургл (Cancerous Healing)",
    reader: "module/rules/cancerous-healing.mjs, module/apps/cancerous-healing.mjs (promptConsent/applyCancerousHealingEffect/applyCancerousHealingFromButton/useCancerousHealing/syncCancerousHealingPenalty — читает флаг cancerousHealingAblative, не весь system.wounds.ablative), module/sheets/attack-dialog.mjs (showAttackDialogNoWeapon, techDef.hitSectionHtml), module/hooks.mjs (делегированный клик .ch-apply-touch-btn), хук updateActor в warhammer-dbc.mjs пересинхронизирует штраф и долю"
  },
  "gift.nurgle.castOutOfDeath": {
    label: "Не может умереть от Критического Эффекта (эффект применяется в остальном); уничтоженные части тела регенерируют за 7ч до минимально функционального состояния",
    source: "Дар Нургл (Cast Out of Death)",
    reader: ""
  },
  "gift.nurgle.countenanceOfNurgle": {
    label: "+20/+30 социальные тесты (больные/отбросы общества ⇄ смертные последователи) и −10 с элитой механизированы тремя записями kind:\"testMod\" на этом же предмете — читаются как галочки диалога броска (игрок сам решает, применимо ли к конкретной цели). Capability покрывает ТОЛЬКО остаток: демоны Нургла ниже Герольда признают авторитет при Inf 30+; +1 Бесчестия: Страх 3 на ход (не действует на Нурглитов, особая реакция у Тзинчитов) — не смоделированы",
    source: "Дар Нургл (Countenance of Nurgle)",
    reader: ""
  },
  "gift.nurgle.fatalism": {
    label: "Аура Cor.b м: игнорирование чужих психосил Прорицания/манипуляции судьбой (кроме сознательно исключённых) — аура-подобный эффект без существующего Трейта-носителя под грант через kind:\"aura\"",
    source: "Дар Нургл (Fatalism)",
    reader: ""
  },
  "gift.nurgle.gazeOfInevitability": {
    label: "Видящие глаза чемпиона комбинируют Избегание с W-10 или теряют все Реакции; полное действие: сфокусированный взор W-30 на одну цель на тот же эффект",
    source: "Дар Нургл (Gaze of Inevitability)",
    reader: ""
  },
  "gift.nurgle.heraldOfHumility": {
    label: "Аура ½Cor(окр.▲) м: −10 на встречные тесты (−30 против требований сдаться), Тзинчиты иммунны — аура-подобный эффект без существующего Трейта под kind:\"aura\"",
    source: "Дар Нургл (Herald of Humility)",
    reader: ""
  },
  "gift.nurgle.iconoclast": {
    label: "Уничтожение произведения искусства: тест Cor∓30 (по качеству) восстанавливает 1 Очко Бесчестия",
    source: "Дар Нургл (Iconoclast)",
    reader: ""
  },
  "gift.nurgle.irradiated": {
    label: "Аура 3м: попадание Rad(1d10) всем в начале их Хода, Cor.b Dmg в пробитие; сам иммунен к радиации; вкусивший плоти/крови получает иммунитет на 7 дней (тест T+0 или 1d5 Порчи без покровительства Нургла)",
    source: "Дар Нургл (Irradiated)",
    reader: ""
  },
  "gift.nurgle.knightOfNurgle": {
    label: "Демонический скакун (Паланкин Нургла) в услужении — призыв ритуалом, вселение в технику даёт +7 Ран/Структуры и автопрохождение тестов Трудного Ландшафта",
    source: "Дар Нургл (Knight of Nurgle)",
    reader: ""
  },
  "gift.nurgle.maggotParasite": {
    label: "Сознание в паразите-опарыше (S/T/A=10, Раны=7, Трейты Deadly Natural Weapons(Cor.b)/Parasite/Size(−2)) с возможностью захвата нового тела через атаку Паразитом",
    source: "Дар Нургл (Maggot Parasite)",
    reader: ""
  },
  "gift.nurgle.nurglingInfestation": {
    label: "Получив непоглощённый урон — манифестирует дружественного Нурглинга (1d5 при уроне 3+, 1d10 при 7+) в Истинной Форме",
    source: "Дар Нургл (Nurgling Infestation)",
    reader: ""
  },
  "gift.nurgle.perfectHost": {
    label: "Не страдает от симптомов своих болезней, не может быть излечен от них; может заражаться болезнями, не действующими на его вид; переносимые болезни делят общие векторы заражения",
    source: "Дар Нургл (Perfect Host)",
    reader: ""
  },
  "gift.nurgle.plagueShepherd": {
    label: "Команда/Брифинг: подчинённые с patronGod:\"nurgle\" (кому вообще доходят Команды) дополнительно получают Успехи аблативных Ран, не складывая с прошлой командой. Сам+все подчинённые заражены → Короткая/Детальная Команда РЕАЛЬНО списывают меньше ОД (module/combat/action-economy.mjs): Полудействие→Свободное, Полное→Полудействие; попутно Короткая/Детальная Команда вообще стали списывать ОД у отдающего (раньше не списывали ни у кого)",
    source: "Дар Нургл (Plague Shepherd)",
    reader: "module/rules/plague-shepherd.mjs (plagueShepherdGrant/plagueShepherdFreeCommandActive/isInfected), module/sheets/squad-sheet.mjs (_commandApCost/_commandReachableMemberDocs, _executeCommand списывает spendActionPoints ДО броска, context.shortApGate/detailApGate/plagueShepherdFreeCommand в _prepareContext), templates/actor/squad-sheet.hbs (гейт кнопок + заголовки панелей)"
  },
  "gift.nurgle.prophetOfGallerpox": {
    label: "Полное действие: заражает большую жизнеобеспечивающую машину Гэллерпоксом (одержание Чумоносом), не-Нурглиты в радиусе действия машины −30 к тестам против ядов/болезней; удалённое вкл/выкл машины в пределах 7км полным действием",
    source: "Дар Нургл (Prophet of Gallerpox)",
    reader: ""
  },
  "gift.nurgle.shieldOfSloth": {
    label: "Закончил Ход с непотраченным полудействием: не перегружающийся щит-дефлектор 1-77 до начала следующего Хода (1-99, если не потратил действий вовсе)",
    source: "Дар Нургл (Shield of Sloth)",
    reader: ""
  },
  "gift.nurgle.theEqualizer": {
    label: "Атакующий/встречный противник с более высокой базовой Характеристикой для теста должен перебрасывать Успехи",
    source: "Дар Нургл (The Equalizer)",
    reader: ""
  },
  "gift.nurgle.touchOfEntropy": {
    label: "Безоружные/природные атаки снижают AP места попадания на ½Cor.b (окр.▲) до урона, или Качество парировавшего оружия на 1 (ломает при AP=0/Qual<Poor.Q); чинится сменой ремонта без теста",
    source: "Дар Нургл (Touch of Entropy)",
    reader: ""
  },
  "gift.nurgle.unseenBeggar": {
    label: "Нося только снаряжение Poor.Q — полудействие накладывает морок «ещё один нищий» на всех наблюдателей с душой, полудействие снимает",
    source: "Дар Нургл (Unseen Beggar)",
    reader: ""
  },
  "gift.nurgle.vulture": {
    label: "3+ персонажа с −5 Ран/меньше или свежих трупа боя в радиусе 7м — 1 Очко Бесчестия в начале своего Хода (сгорает к следующему)",
    source: "Дар Нургл (Vulture)",
    reader: ""
  },
  "gift.nurgle.weepingRot": {
    label: "Реализовано полностью (wdbc-1rno) четырьмя записями weaponPropertyImmunity.{flame,crippling,corrosive,toxic} (module/combat/weapon-properties.mjs::hasWeaponPropertyImmunity) — «яды через раны» = свойство Toxic, добавлено этой находкой. Сам ключ gift.nurgle.weepingRot остаётся пустой заглушкой-«зонтиком» без своего читателя — вся механика уже доставлена другими ключами, читать нечего. Нюанс «снаряжение всё равно страдает от Corrosive» не автоматизирован (считается по актору целиком, не отдельно предмет/носитель).",
    source: "Дар Нургл (Weeping Rot)",
    reader: ""
  },
  "gift.slaanesh.avatarOfGreed": {
    label: "Атака по персонажу с лучшим снаряжением (по решению ГМа) — перебросить все тесты этой атаки",
    source: "Дар Слаанеш (Avatar of Greed)",
    reader: ""
  },
  "gift.slaanesh.blackEyes": {
    label: "+½Cor(окр.▲) Бдительность механизировано отдельной записью kind:\"testMod\" (modValueMode:formula, wdbc-1rno — впервые тестMod читает живую формулу mech-formula.mjs, а не только голое число) на этом же предмете, тот же навык, что Cyclops. Capability покрывает ТОЛЬКО остаток: при Cor 40+ ИК/УФ зрение; при Cor 60+ видит сквозь дым/тьму/колдовской морок без штрафов; при Cor 80+ Полу-Прицеливание свободным действием — пороговые бонусы не смоделированы",
    source: "Дар Слаанеш (Black Eyes)",
    reader: ""
  },
  "gift.slaanesh.confessorOfDesires": {
    label: "Спрошенный о сокровенных желаниях проходит W-60 (как от психосилы) или честно отвечает не осознавая влияния; прошедший тест — иммунен 6 дней",
    source: "Дар Слаанеш (Confessor of Desires)",
    reader: ""
  },
  "gift.slaanesh.countenanceOfSlaanesh": {
    label: "Базовый +10 ко всем социальным тестам механизирован отдельной записью kind:\"testMod\" (modScope:social) на этом же предмете — capability покрывает ТОЛЬКО остаток: доп. +30 конкретно с последователями Слаанеш (нет распознавания цели), признание авторитета демонами Слаанеш ниже Герольда при Inf 30+, полудействие+1 Бесчестия на Страх 3 (Кхорниты впадают в Ярость вместо Шока) — не смоделированы",
    source: "Дар Слаанеш (Countenance of Slaanesh)",
    reader: ""
  },
  "gift.slaanesh.cuttingWords": {
    label: "Победа в тесте социального взаимодействия — 1d5+Успехи непоглощаемого R Dmg в торс проигравшему (кровавые стигматы)",
    source: "Дар Слаанеш (Cutting Words)",
    reader: ""
  },
  "gift.slaanesh.danceOfDeception": {
    label: "Финт через Acrobatics(A)+0 или Trade(Dancer)(A)+20 вместо WS+0; +1 Бесчестия — Финт свободным действием",
    source: "Дар Слаанеш (Dance of Deception)",
    reader: ""
  },
  "gift.slaanesh.danceOfLife": {
    label: "Тратит 1 Успех вместо 2 на повторные Уклонения в тот же Ход; сохраняет неизрасходованные Успехи Уклонения до начала следующего Хода на чужие попадания",
    source: "Дар Слаанеш (Dance of Life)",
    reader: ""
  },
  "gift.slaanesh.darkMuse": {
    label: "Крафт-часть смоделирована (wdbc-1rno): именованный ассистент (assistantId) с этим Даром даёт +30 вместо +10 за себя (module/rules/craft-advantage.mjs::darkMuseAssistBonus, читает module/apps/craft-workshop.mjs::_rollShift) — «отклонение результата от замысла автора» не отражено численно, текстовая оговорка. Общее «+20 вместо +10» ВНЕ Крафта (обычный ассистент диалога Навыка, module/rules/assists.mjs) — НЕ смоделировано, отдельная точка интеграции.",
    source: "Дар Слаанеш (Dark Muse)",
    reader: "module/rules/craft-advantage.mjs::darkMuseAssistBonus, module/apps/craft-workshop.mjs"
  },
  "gift.slaanesh.eaterOfPain": {
    label: "Разумное существо в Cor.b м получает Критический Эффект — 1d10+1 против результата даёт снятие 1d5 Усталости/1d5 Ран/1d10 урона в Характеристику; Пытка даёт то же за каждый Успех",
    source: "Дар Слаанеш (Eater of Pain)",
    reader: ""
  },
  "gift.slaanesh.egomania": {
    label: "Автопобеда во встречных тестах против социальных взаимодействий; может получать преимущества Командования, даже нарушая приказы своего командира",
    source: "Дар Слаанеш (Egomania)",
    reader: ""
  },
  "gift.slaanesh.enchantingVoice": {
    label: "+½Cor(окр.▲) социальные тесты механизировано отдельной записью kind:\"testMod\" (modValueMode:formula) на этом же предмете — «не встречные, не против Кхорнитов» оставлено подписью галочки (игрок сам решает, применимо ли, тот же принцип, что у остальных testMod). Capability покрывает ТОЛЬКО остаток: отказ от бонуса до след. Хода даёт бесплатную Короткую/Детальную Команду (не на Кхорнитов) — не смоделирован",
    source: "Дар Слаанеш (Enchanting Voice)",
    reader: "packs-src/mutations/Дары_Богов/Слаанеш/Enchanting_Voice..., kind:\"testMod\""
  },
  "gift.slaanesh.everYouthful": {
    label: "Не стареет, иммунитет к старению/болезням/негативной Биомантии/мутагенным эффектам (кроме накопления Порчи)",
    source: "Дар Слаанеш (Ever-Youthful)",
    reader: ""
  },
  "gift.slaanesh.eyeOfEnvy": {
    label: "Атака/встречный тест против цели с более высокой базовой Характеристикой — 1 Очко Бесчестия (теряется по завершении теста, если не потрачено)",
    source: "Дар Слаанеш (Eye of Envy)",
    reader: ""
  },
  "gift.slaanesh.hermaphrodite": {
    label: "+30 Обаяние механизировано отдельной записью kind:\"testMod\" (skillKey:charm) на этом же предмете — это capability покрывает ТОЛЬКО остаток: доступ к обычно иммунным целям (оскоплённые Механикум, асексуальные Астартес, без бонуса на них) и возврат утраченного либидо/способности к соитию, не смоделированы",
    source: "Дар Слаанеш (Hermaphrodite)",
    reader: ""
  },
  "gift.slaanesh.immortalBeauty": {
    label: "Тяжело/критически ранен — Трейт Regeneration(1) механизирован отдельной записью kind:\"trait\" под when.woundTier:[\"heavy\",\"dying\"] на этом же предмете (старая пометка «гейт не поддержан entry.when» устарела — wdbc-wyr3 закрыт, woundTier есть, см. Толстокожий/Thick_Skinned). Capability покрывает ТОЛЬКО остаток: тот же Трейт ещё и при потере части тела ВНЕ завязки на тир Ран (нет отдельного триггера «лишился конечности»); лёгкое ранение — чисто косметическое заживление без Ран, эффекта не требует",
    source: "Дар Слаанеш (Immortal Beauty)",
    reader: ""
  },
  "gift.slaanesh.kissOfDeath": {
    label: "Поцелуй в губы существа с душой: встречный тест W+Cor.b×5 vs W+Cor.b×5, победа — d10 непогл. R Dmg за Успех; убийство — 1d5 Бесчестия, снятие Усталости, лечение 1d10+W.b жертвы; спасение от этой смерти стоит вдвое",
    source: "Дар Слаанеш (Kiss of Death)",
    reader: ""
  },
  "gift.slaanesh.knightOfSlaanesh": {
    label: "Демонический скакун (Скакун Слаанеш) в услужении — призыв ритуалом, вселение в технику даёт +20 на тесты управления",
    source: "Дар Слаанеш (Knight of Slaanesh)",
    reader: ""
  },
  "gift.slaanesh.lordOfSloth": {
    label: "Иммунитет к пост-эффектам/зависимостям от наркотиков; никаких негативных эффектов от еды (включая яды в пище); не набирает вес от обжорства",
    source: "Дар Слаанеш (Lord of Sloth)",
    reader: ""
  },
  "gift.slaanesh.nobleBearing": {
    label: "Игнор штрафов Трудного Ландшафта механизирован отдельной записью kind:\"terrainIgnore\" (все 11 свойств) на этом же предмете — capability покрывает ТОЛЬКО остаток: может (и обязан при грязной жидкости) ходить по поверхности жидкостей на телекинетических полях — не смоделировано",
    source: "Дар Слаанеш (Noble Bearing)",
    reader: ""
  },
  "gift.slaanesh.progenitor": {
    label: "+30 социальные и +30 встречные (психосилы/психоатаки) с прямыми потомками механизированы двумя записями kind:\"testMod\" на этом же предмете (галочки — игрок решает применимость по цели). Capability покрывает ТОЛЬКО остаток: репродуктивные способности (оплодотворение/зачатие/регенерация Прогеноидов), автопобеда в тестах Одержимости против потомка при возвышении в Демоничество — вне числовых полей",
    source: "Дар Слаанеш (Progenitor)",
    reader: ""
  },
  "gift.slaanesh.resplendentRaiment": {
    label: "Снаряжение выглядит как Best.Q (физически, не иллюзия); раз за бой/сцену+1 Бесчестия: видящие проходят W-30 или видят только чемпиона до след. Хода",
    source: "Дар Слаанеш (Resplendent Raiment)",
    reader: "Реализовано (wdbc-sk8s): кнопка «👑 Блистательные Одеяния» (вкладка БОЙ) → module/combat/resplendent-raiment.mjs. Лимит раз за бой/сцену — game.combat?.started выбирает unit (battle/scene), throttleCount из cooldown.mjs. Трата Очка Бесчестия — system.fate.value. W-30 против всех токенов сцены кроме отмеченных кастером в диалоге исключений (LOS не автоматизирован). Провал ставит информационный флаг seesOnlyCaster — не enforced в движке видимости."
  },
  "gift.slaanesh.senseOfLust": {
    label: "Доп. чувство: засекает сексуальные эмоции в радиусе Cor.b км с направлением/природой, особенно чётко — влечение к самому чемпиону",
    source: "Дар Слаанеш (Sense of Lust)",
    reader: ""
  },
  "gift.slaanesh.touchOfPain": {
    label: "Безоружные/природные атаки игнорируют T.b в Поглощении живых целей, получают Shocking; Критические Эффекты от них никогда не убивают/не калечат; +30 на тесты пыток",
    source: "Дар Слаанеш (Touch of Pain)",
    reader: ""
  },
  "gift.tzeentch.akashicLibrary": {
    label: "+1 Бесчестия: Критический успех в любом тесте Знания (даже без владения, до/после броска), затем Cor+10 или 1 Порча + 1d5 непогл. E Dmg в голову",
    source: "Дар Тзинч (Akashic Library)",
    reader: ""
  },
  "gift.tzeentch.countenanceOfTzeentch": {
    label: "Базовый +10 Обман/Проницательность механизирован двумя записями kind:\"testMod\" на этом же предмете — capability покрывает ТОЛЬКО остаток: доп. +30 против союзников (нет распознавания цели), признание авторитета демонами Тзинча ниже Герольда при Inf 30+, полудействие+1 Бесчестия на Страх 3 — не смоделированы",
    source: "Дар Тзинч (Countenance of Tzeentch)",
    reader: ""
  },
  "gift.tzeentch.devourerOfKnowledge": {
    label: "9 минут касания: похищает воспоминание/Навык жертвы на 1 день (жертва теряет на этот срок); 9 дней подряд похищения тех же знаний — перманентная потеря у жертвы",
    source: "Дар Тзинч (Devourer of Knowledge)",
    reader: ""
  },
  "gift.tzeentch.devourerOfTime": {
    label: "Застав врасплох — первый Ход в бою совершается дважды (в свою инициативу и в конце инициативы); застигнутые Врасплох теряют полудействие во второй Ход",
    source: "Дар Тзинч (Devourer of Time)",
    reader: ""
  },
  "gift.tzeentch.etherealSwarm": {
    label: "Полное действие: Inf.b призрачных Крикунов на Cor.b минут; получив попадание (после Избегания, до урона/щитов) — тест Cor+0 как реакция без траты Реакций: Успех переносит попадание на Крикуна, изгоняя его",
    source: "Дар Тзинч (Ethereal Swarm)",
    reader: ""
  },
  "gift.tzeentch.falseWitness": {
    label: "Автослышит и распознаёт любую ложь (не честное заблуждение) в радиусе Cor м; +1 Бесчестия увеличивает радиус до Cor км до конца сцены",
    source: "Дар Тзинч (False Witness)",
    reader: ""
  },
  "gift.tzeentch.hiddenThreat": {
    label: "+1 Бесчестия: следующая атака получает тип Незримое, тесты пси-чутья/ноосканирования на засечение получают −50",
    source: "Дар Тзинч (Hidden Threat)",
    reader: ""
  },
  // «Infernal Armiger» физически лежит 4 файлами в packs-src/mutations/Дары_Богов/Тзинч/,
  // но system.god у них — khorne/nurgle/slaanesh/tzeentch по отдельности (не все 4 в Тзинче,
  // как предполагала папка). Найдено 24.08.2026 при живой проверке mutationItemData() против
  // собранного пака (см. wdbc-1rno) — ИСХОДНО все 4 получили один и тот же capabilityKey
  // (ошибка группировки по папке вместо system.god), здесь исправлено на 4 разных ключа.
  // САМ ТЕКСТ benefit во всех 4 документах при этом одинаковый («Розовый Ужас», демон Тзинча) —
  // не совпадает со статической библиотекой module/constants/mutations.mjs (там у Кхорна
  // «Кровопускатель», у Нургла «Чумонос», у Слаанеш «Демонетка», у Тзинча «Розовый Ужас» —
  // 4 РАЗНЫХ текста). Похоже на баг импорта контента в packs-src (не тема Механики) —
  // флагнуто отдельной задачей, не правится здесь.
  "gift.khorne.infernalArmiger": {
    label: "Демон-прислужник в услужении как Миньон без траты слотов, автопобеда во Владычестве, вселение в оружие делает его Демоническим (при возвышении Inf 60 демон становится возвышенным) — текст документа сейчас ошибочно говорит про Розового Ужаса Тзинча, должен про Кровопускателя (см. комментарий выше)",
    source: "Дар Кхорн (Infernal Armiger)",
    reader: ""
  },
  "gift.nurgle.infernalArmiger": {
    label: "Демон-прислужник в услужении как Миньон без траты слотов, автопобеда во Владычестве, вселение в оружие делает его Демоническим (при возвышении Inf 60 демон становится возвышенным) — текст документа сейчас ошибочно говорит про Розового Ужаса Тзинча, должен про Чумоноса (см. комментарий выше)",
    source: "Дар Нургл (Infernal Armiger)",
    reader: ""
  },
  "gift.slaanesh.infernalArmiger": {
    label: "Демон-прислужник в услужении как Миньон без траты слотов, автопобеда во Владычестве, вселение в оружие делает его Демоническим (при возвышении Inf 60 демон становится возвышенным) — текст документа сейчас ошибочно говорит про Розового Ужаса Тзинча, должен про Демонетку (см. комментарий выше)",
    source: "Дар Слаанеш (Infernal Armiger)",
    reader: ""
  },
  "gift.tzeentch.infernalArmiger": {
    label: "Розовый Ужас в услужении как Миньон без траты слотов, автопобеда во Владычестве, вселение в оружие делает его Демоническим (при возвышении Inf 60 демон становится возвышенным)",
    source: "Дар Тзинч (Infernal Armiger)",
    reader: ""
  },
  "gift.tzeentch.knightOfTzeentch": {
    label: "Демонический скакун (Диск Тзинча) в услужении — призыв ритуалом, вселение в технику даёт себе и всаднику не перегружающийся чародейский щит-купол 1-50",
    source: "Дар Тзинч (Knight of Tzeentch)",
    reader: ""
  },
  "gift.tzeentch.mutableSoul": {
    label: "9 минут медитации: сменить Природу Дара как псайкер на любую другую; если не был псайкером — Трейт Psyker(PR0)",
    source: "Дар Тзинч (Mutable Soul)",
    reader: ""
  },
  "gift.tzeentch.omniglot": {
    label: "Понимает все языки (устные и письменные) и автоматически расшифровывает любые коды/шифры — не даёт говорить/писать на них",
    source: "Дар Тзинч (Omniglot)",
    reader: ""
  },
  "gift.tzeentch.perfectSorcerer": {
    label: "Фокус Колдовства/Пагубной Демонологии/Высшего Колдовства/всех Фундаментальных дисциплин; обучает любой психосиле этих дисциплин вне своего PR (даже не будучи псайкером); изучает Высшее Колдовство вне Покровительства",
    source: "Дар Тзинч (Perfect Sorcerer)",
    reader: ""
  },
  "gift.tzeentch.personalAdaptation": {
    label: "После встречного теста: +5 на все дальнейшие встречные тесты против того же персонажа (макс. +(½Cor.b(окр.▲))×5), сохраняется до 9 лет на каждого",
    source: "Дар Тзинч (Personal Adaptation)",
    reader: ""
  },
  "gift.tzeentch.spellwise": {
    label: "Переброс тестов Пси-чутья (Psyniscience) механизирован отдельной записью kind:\"reroll\" на этом же предмете. Capability покрывает ТОЛЬКО остаток: автоопознание наблюдаемых психосил/ритуалов; изучает Psyniscience без псайкерства; при Forbidden Lore(Psykers) выше атакующего псайкера — перебрасывает Избегания/встречные тесты против его психосил — не смоделированы",
    source: "Дар Тзинч (Spellwise)",
    reader: ""
  },
  "gift.tzeentch.sundering": {
    label: "Умирая: +1 Бесчестия — тело исчезает, появляются 2 копии (Размер−1, 9 Ран, S/T−20, Daemonic(+1)/Stuff of Nightmares/Warp Instability, урон d10→d5/1); в конце сцены сливаются в оригинал с 0 Ран, гибель обеих копий = смерть персонажа",
    source: "Дар Тзинч (Sundering)",
    reader: ""
  },
  "gift.tzeentch.theUnnameable": {
    label: "Через 9 минут после произнесения имени чемпиона вслух — получает воспоминание всего сказанного в ±9 минут в том же месте, понимая любые языки/шифры; может сознательно подавить, теряя пропущенное",
    source: "Дар Тзинч (The Unnameable)",
    reader: ""
  },
  "gift.tzeentch.wishGranter": {
    label: "+1 Бесчестия: автоманифестация любой психосилы (даже незнакомой) на эPR9/9 Успехов, исполняющей чужое высказанное желание буквально; если помогает загадавшему больше, чем чемпиону — 2d10+9 урона в W",
    source: "Дар Тзинч (Wish Granter)",
    reader: ""
  },

  // ── Общие мутации (wdbc-1rno) — активные/переключаемые способности,
  // заглушка данными, reader пуст сознательно ──
  "mutation.spatialInstability": {
    label: "Выдача Трейта Incorporeal механизирована отдельной записью kind:\"script\" (ручная кнопка «▶ Запустить» на листе предмета) на этом же предмете: клонирует Incorporeal из пака Черт, дедуп-проверка от повторной выдачи, длительность Cor.b Раундов теперь снимается АВТОМАТИЧЕСКИ (rules/temp-grant.mjs, снятие на смену Раунда текущего боя — hooks.mjs) — при клике вне боя Раундами мерить нечего, кнопка честно предупреждает и ничего не выдаёт. НЕ автоматизированы: частота «раз в 12−Cor.b ч» (throttle Конструктора не умеет формулу), добровольный возврат раньше срока (удалить Черту вручную), 10 god-гейтнутых субмутаций. wdbc-1rno — не проверено живьём в Foundry (мир не запущен на момент правки)",
    source: "Мутация: Spatial Instability (Общие мутации)",
    reader: ""
  },
  "mutation.janus": {
    label: "Полудействие: доп. глаза/рот перемещаются в любую точку тела (обзор назад/за угол, независимая речь)",
    source: "Мутация: Janus (Общие мутации)",
    reader: ""
  },
  "mutation.pureForm": {
    label: "Полностью механизирована двумя записями kind:\"script\" на этом же предмете, поверх нового примитива rules/mutation-suppression.mjs (wdbc-1rno) — НЕ удаление, отключение: подавленные Мутации/Дары теряют эффекты (isItemActive() в apps/effects.mjs знает про flags.warhammer-dbc.suppressed), но остаются на листе и возвращаются в прежнем виде. Первая кнопка переключает подавление/безопасный возврат (1 час концентрации туда и обратно предполагается отыгранным, не отсчитывается системой), вторая — аварийный разрыв (мгновенный возврат + 1d10 непогл. R Dmg, rules/wounds.mjs::woundLossUpdates). Триггер разрыва (Оглушение/потеря сознания) не детектируется автоматически — кнопка жмётся по факту события. Искажение снаряжения, надетого в Чистой Форме — на усмотрение ГМа, не смоделировано",
    source: "Мутация: Pure Form (Общие мутации)",
    reader: ""
  },
  "mutation.compression": {
    label: "Реактивная замена Уклонению механизирована (wdbc-1rno, module/rules/compression.mjs + combat/defense.mjs::_performCompression, кнопка «Сжатие» рядом с Уклонением/Парированием на карточке атаки, если место попадания — не Торс): без броска, тратит Реакцию, нивелирует ИМЕННО это попадание, помнит втянутые части (flags.warhammer-dbc.compressedParts), кнопка «Разложить» возвращает часть обратно. НЕ автоматизировано (честно, книга не даёт числа для первых двух и не даёт занять существующий счётчик-таймер для третьего — см. шапку rules/compression.mjs): слепота от втянутой Головы, снижение мобильности от втянутых Ног, автовыпуск удерживаемого оружия/инструмента из втягиваемой Руки — только чат-заметки. Не проверено живьём в Foundry (мир не запущен на момент правки)",
    source: "Мутация: Compression (Общие мутации)",
    reader: "module/combat/defense.mjs — _performCompression/_performExtendBodyPart; module/hooks.mjs — кнопки «Сжатие»/«Разложить»"
  },
  "mutation.mistTransformation": {
    label: "Выдача Трейтов Incorporeal+Flyer(A.b×2) механизирована отдельной записью kind:\"script\" (ручная кнопка на листе предмета) на этом же предмете: клонирует обе Черты из пака, дедуп-проверка, длительность Cor.b минут теперь снимается АВТОМАТИЧЕСКИ (rules/temp-grant.mjs — worldTime-таймер, снятие на updateWorldTime/updateCombat, hooks.mjs). НЕ автоматизированы: частота «Cor.b раз/сутки, не чаще раза в 10−Cor.b Раундов» (throttle Конструктора не умеет формулу), радиус облака/неуязвимость/блокировка обзора, растворение до Cor.b союзников. wdbc-1rno — не проверено живьём в Foundry (мир не запущен на момент правки)",
    source: "Мутация: Mist Transformation (Общие мутации)",
    reader: ""
  },
  "mutation.iconOfBlasphemy": {
    label: "Визуальный канал (Имперцы, видящие проявление в пределах дальности+сектора обзора токена — геометрическое приближение без стен) механизирован отдельной записью kind:\"script\" (wdbc-1rno, throttle 1/бой): W+0 у каждого видящего, провал — system.inRage. Capability покрывает ТОЛЬКО остаток: канал «засекли Пси-чутьём/Ноосферным Сканированием» (нет надёжного способа опросить, у кого сейчас активна такая проверка) и «жертва Ярости считает чемпиона единственным врагом» (поведение ИИ цели, не состояние актора) — оба без числа, только чат-заметка/на усмотрение ГМа",
    source: "Мутация: Icon of Blasphemy (Общие мутации)",
    reader: "module/apps/icon-of-blasphemy.mjs iconOfBlasphemyButtonHtml()/activateIconOfBlasphemy()"
  },
  "mutation.sentientCyst": {
    label: "+3 Провала при провале социального теста механизировано отдельной записью kind:\"failDegMod\" (wdbc-1rno, новый вид записи — считается ПОСЛЕ броска, не галочка) на этом же предмете. Capability покрывает ТОЛЬКО остаток: разум цисты перехватывает контроль на несколько мгновений при ослабевшей концентрации персонажа — по решению ГМа, без числа",
    source: "Мутация: Sentient Cyst (Общие мутации)",
    reader: ""
  },
  "mutation.fruitOfFlesh": {
    label: "Не чаще раза в сутки: втягивает конкретную опасность (урон/ЭМИ/дым/пламя/Оглушение/яд/психоатака/осколки — по субмутации) в плод-предмет с отложенным эффектом; 12 субмутаций не автоматизированы (см. текст)",
    source: "Мутация: Fruit of Flesh (Общие мутации)",
    reader: ""
  },
  "mutation.armourOfTheGods": {
    label: "Даёт элитный Архетип «Броненосец» (стр. 156) без траты опыта, Божественные Латы сливаются с текущей бронёй по лучшим характеристикам; недоступно Астартес/Механикум — выдача элитного архетипа вне полей Конструктора",
    source: "Мутация: Armour of the Gods (Общие мутации)",
    reader: ""
  },
  "mutation.dullahan": {
    label: "Размер −2 (SPD как у Размера 0), все попадания — в голову, волосы-щупальца = Multiple Arms(6) c платой 2 конечности на стойку/4 на ходьбу, регенерируют мгновенно — составной эффект, не кодируется частично (см. память)",
    source: "Мутация: Dullahan (Общие мутации)",
    reader: ""
  },

  // ── Общие мутации, партия 2 (wdbc-1rno) — заглушка данными, reader пуст сознательно ──
  "mutation.boneless": {
    label: "+10 A механизировано отдельной записью kind:\"characteristic\" на этом же предмете — capability покрывает ТОЛЬКО остаток: ½ I(Cr) Dmg (окр.▲) до Поглощения, иммунитет к Критическим Эффектам переломов; без опоры в жёстком доспехе — Athletics+0 или Amorphous+Crawler (−20 S, −2 Unnatural S, +30 Карабканье); опционально Quadruped(1) с модифицированной бронёй — не смоделированы",
    source: "Мутация: Boneless (Общие мутации)",
    reader: ""
  },
  "mutation.breeze": {
    label: "Пузырь 2м: игнор штрафов от ветра/жары/холода, воздушный пузырь в вакууме, игнор сопротивления воздуха (без предела терминальной скорости, без урона трения при входе в атмосферу)",
    source: "Мутация: Breeze (Общие мутации)",
    reader: ""
  },
  "mutation.burnedSenses": {
    label: "2 броска по таблице чувств (d10): перманентная потеря первого выпавшего чувства, +20 и переброс провалов на второе — случайный парный выбор при получении, не кодируется текущими полями",
    source: "Мутация: Burned Senses (Общие мутации)",
    reader: ""
  },
  "mutation.feelsNoPain": {
    label: "Не получает штраф −10 от Усталости (module/sheets/tabs/conditions.mjs::fatiguePenalty), иммунен к Искусной Пытке (module/apps/skillful-torture.mjs — единственная реализованная в системе пытка болью). «Риск пропустить опасные ранения мимо внимания» — на усмотрение ГМа, не смоделировано (нет механики скрытых от игрока тестов).",
    source: "Мутация: Feels No Pain (Общие мутации)",
    reader: "module/sheets/tabs/conditions.mjs::fatiguePenalty, module/apps/skillful-torture.mjs::showSkillfulTortureDialog"
  },
  "mutation.majesticHorns": {
    label: "+20 социальные тесты с Хаоситами/Орками механизировано отдельной записью kind:\"testMod\" на этом же предмете — галочка диалога броска, игрок сам решает, применимо ли к конкретной цели. Capability покрывает ТОЛЬКО остаток: 10 субмутаций (щиты/AP/природное оружие с формулой/god-гейтнутые бонусы) не автоматизированы — см. текст",
    source: "Мутация: Majestic Horns (Общие мутации)",
    reader: ""
  },
  "mutation.miasma": {
    label: "+40 Выживание (выслеживание по запаху) без герметичной брони механизировано отдельной записью kind:\"testMod\" под новым гейтом when.requireSealedArmour+negateSealedArmour (wdbc-1rno, PREDICATES.wearsSealedArmour — ARMOR_PROPERTIES.sealed) на этом же предмете. Capability покрывает ТОЛЬКО остаток: штрафы на соц. взаимодействие/Stealth без гермодоспеха — книга не даёт конкретного числа («это может давать штрафы»), не смоделированы",
    source: "Мутация: Miasma (Общие мутации)",
    reader: ""
  },
  "mutation.polymath": {
    label: "+10 на тесты Крафта и Исследований — двумя путями: Мастерская Крафта (свой пакетный расчёт, не общий конвейер теста) берёт его напрямую (module/rules/craft-advantage.mjs::polymathBonus, читает module/apps/craft-workshop.mjs::_rollShift); обычный ручной бросок Навыка (Ремесло/Запретные Знания вне Мастерской) — отдельными записями kind:\"testMod\" (skillKey:trade/forbiddenLore) на этом же предмете. Крит на таком тесте — 1d5 Усталости + доп. тест немедленно — смоделирован ТОЛЬКО для ручного пути (по одной записи kind:\"script\" со scriptTrigger:critSuccess на каждую из двух групп, wdbc-1rno); Мастерская Крафта свой бросок такому крюку не подвергает — крит там не даёт доп. теста. Capability покрывает только нарративный остаток без чисел: определение дистанций/пропорций на глаз, точное воспроизведение чертежей по разобранному механизму",
    source: "Мутация: Polymath (Общие мутации)",
    reader: "module/rules/craft-advantage.mjs::polymathBonus, module/apps/craft-workshop.mjs (Мастерская); packs-src testMod/script записи (ручной бросок Ремесла/Запретных Знаний)"
  },
  "mutation.soulSeer": {
    label: "Видит души/духов машин/демонов на 10м сквозь преграды, наслаивается на обычное зрение (мешает читать мимику/детали у ярких псайкеров)",
    source: "Мутация: Soul-Seer (Общие мутации)",
    reader: ""
  },

  // ── Общие мутации, партия 3 (wdbc-1rno) — заглушка данными, reader пуст сознательно ──
  "mutation.illusionOfNormality": {
    label: "Игнорируется наблюдателями как мутант, оружие/броня не привлекают внимания; активная поддерживаемая иллюзия, засекается Пси-чутьём (+5 за каждую прочую мутацию), псайкеры видят сквозь неё тестом W+0 (раз за бой/сцену)",
    source: "Мутация: Illusion of Normality (Общие мутации)",
    reader: "module/apps/illusion-of-normality.mjs illusionOfNormalityHtml()/attemptNoticeIllusion()/attemptSeeThroughIllusion()"
  },

  // ── Общие мутации, партия 4 (wdbc-1rno, ревизия по запросу координатора) —
  // заглушка данными, reader пуст сознательно ──
  // wdbc-5inv: штраф −10 к тестам Навыков автоматизирован (rules/addiction.mjs,
  // трекер утоления на вкладке ТЕЛО/Эффекты) — эта запись теперь только маркер
  // «мутация есть», сам штраф читает предмет напрямую, не capability-реестр.
  "mutation.addiction": {
    label: "Штраф −10 к тестам Навыков (не Характеристик), пока Зависимость не утолена — автоматизировано трекером на листе (system.dependency, rules/addiction.mjs; галочка «Зависимость» в общем конвейере теста, resolve-test.mjs scope anySkill). 13 субмутаций определяют предмет зависимости (еда/яд/кровь врага и т.п.) — сам акт утоления остаётся отыгрышем, не автоматизирован",
    source: "Мутация: Addiction (Общие мутации)",
    reader: "module/rules/addiction.mjs (addictionPenaltyRules/rules/sources.mjs — общий конвейер теста), module/sheets/sheet-helpers.mjs+tabs/body.mjs (трекер и кнопка «Утолить» на вкладке ТЕЛО); apps/addiction.mjs — панель и кнопка «Утолить» на листе самой Мутации"
  },
  "mutation.addiction.xenosLore": {
    label: "Субмутация 4 (Прах ксеноса): если ГМ решит, что персонаж незнаком с этим видом ксеносов — Навык Forbidden Lore (Xenos), конкретный вид ксеноса определяет ГМ каждый раз заново — не автоматизировано (переменная специализация)",
    source: "Мутация: Addiction, субмутация 4 (Общие мутации)",
    reader: ""
  },
  "mutation.addiction.radioactive": {
    label: "Субмутация 11 (Радиоактивное): иммунитет к радиации, безопасная работа с раскалённым/радиоактивным, определение радиоактивных материалов на глаз",
    source: "Мутация: Addiction, субмутация 11 (Общие мутации)",
    reader: ""
  },
  "mutation.addiction.soulStone": {
    label: "Субмутация 12 (Камень Душ): утоление восстанавливает 1d5 потраченных ОБ и держит зависимость утолённой год — событийное восстановление ресурса, не статичный бонус",
    source: "Мутация: Addiction, субмутация 12 (Общие мутации)",
    reader: ""
  },
  "mutation.beastman": {
    label: "Все Трейты расы Зверолюда кроме 4 названных, Навыки Lore/Trade на ступень ниже (мин. +0), становится полноценным Зверолюдом — комплексная замена расы, вне полей Конструктора",
    source: "Мутация: Beastman (Общие мутации)",
    reader: ""
  },
  "mutation.blessedFits": {
    label: "Переброшенный на Очко Бесчестия тест, оказавшийся провалом — Оглушение на 1 Раунд; полный Раунд в Оглушении возвращает потраченное Очко Бесчестия",
    source: "Мутация: Blessed Fits (Общие мутации)",
    reader: ""
  },
  "mutation.bloodReplacement": {
    label: "Иммунитет к смерти от Кровотечения/Обескровливания; 11 субмутаций определяют тип крови и эффект при ранении (I/R/X урон), не автоматизированы",
    source: "Мутация: Blood Replacement (Общие мутации)",
    reader: ""
  },
  "mutation.burningBody": {
    label: "Иммунитет к экстремальным температурам/Горению (подавляемо тестом W+0 на 1 час); рукопашные атакующие в Rng 0-1/Захвате — A+0 или 1d10 E(Fl) Dmg; 10 субмутаций варьируют профиль пламени. Иммунитет к Горению от Flame теперь реализован отдельной записью (weaponPropertyImmunity.flame, wdbc-plsf); экстремальные температуры/подавление тестом/атака в Захвате/субмутации остаются неавтоматизированы (эта запись — оставшаяся заглушка)",
    source: "Мутация: Burning Body (Общие мутации)",
    reader: ""
  },
  "mutation.centaur": {
    label: "Нижняя половина тела заменяется телом животного по субмутации (10 вариантов — Multiple Arms/Quadruped/Natural Weapons/Таланты и др.), сама база не даёт эффекта без субмутации — не автоматизировано",
    source: "Мутация: Centaur (Общие мутации)",
    reader: ""
  },
  "mutation.cyclops": {
    label: "−5 тесты зрения механизировано отдельной записью kind:\"testMod\" (skillKey:awareness) на этом же предмете — единственный подходящий навык в списке, косвенно подтверждён прецедентом Eyes of Chaos (тоже Awareness для глазного эффекта). Capability покрывает ТОЛЬКО остаток: автопровал измерения дистанции на глаз; доп. шанс Избегания от атак, способных опустить Раны до −7 и ниже (даже от внезапных, дважды при известной атаке); по решению ГМа W-тест на потерю полудействия от видений — не смоделированы",
    source: "Мутация: Cyclops (Общие мутации)",
    reader: ""
  },
  "mutation.desiccated": {
    label: "Штраф от Усталости −20 вместо −10 — смоделировано (module/sheets/tabs/conditions.mjs::fatiguePenalty). Соц./ментальный штраф «в присутствии еды» не смоделирован — «присутствие еды» не детектируется программно.",
    source: "Мутация: Desiccated (Общие мутации)",
    reader: "module/sheets/tabs/conditions.mjs::fatiguePenalty"
  },
  "mutation.giftOfTongues": {
    label: "+20 все социальные тесты механизировано отдельной записью kind:\"testMod\" (modScope:social) на этом же предмете — book-текст: «получает +20 на все тесты социального взаимодействия» (без сужения до провокации, это лишь цель по тексту). Capability покрывает ТОЛЬКО остаток: понимает любую речь/язык жестов душ-носителей, отвечает только оскорблениями на их языке — не смоделировано",
    source: "Мутация: Gift of Tongues (Общие мутации)",
    reader: ""
  },
  "mutation.handOfDeath": {
    label: "Генерация боеприпасов из метаболизма (Rld×2 для нестандартных), одной рукой даже с двуручным, только Стандартный Хват в рукопашной — не автоматизировано: система хватов/расходуемых ресурсов не даёт точки входа под конкретный предмет (wdbc-hftn). Сама капабилити НЕ читается кодом — реализация идёт кнопкой на листе Мутации, не через движок правил.",
    source: "Мутация: Hand of Death (Общие мутации)",
    reader: "module/apps/hand-of-death.mjs — кнопка на листе Мутации (+10 WS/BS и Reinforced оружию, Баланс до 0, +10 AP выбранной руке)"
  },
  "mutation.headless": {
    label: "Угол обзора 120°, попадания в голову = попадания в торс (−2 Инициатива вынесена отдельной записью kind:characteristic/charKey:initiative, wdbc-v9a7) — обзора/facing в системе нет вовсе, редиректа попаданий в локацию тоже, гейтить нечем",
    source: "Мутация: Headless (Общие мутации)",
    reader: ""
  },
  "mutation.heartOfSteel": {
    label: "4 god-гейтнутые субмутации (доп. −1 против конкретных типов целей) не реализованы — тесту Страха неоткуда взять категорию источника (wdbc-tsz6)",
    source: "Мутация: Heart of Steel (Общие мутации)",
    reader: "module/combat/fear.mjs — _executeFearRoll (базовый эффект: все воспринимаемые рейтинги Страха на 1 меньше, игнорируются на 0 или пределе Бесчестия)"
  },
  "mutation.infernalWill": {
    label: "Иммунитет к Страху (упирается в архитектурный пробел wdbc-plsf), но провал теста Навыка на 4+ (не Крит) — бросок по таблице Шока; Неделимость/Покровительство снижают результат",
    source: "Мутация: Infernal Will (Общие мутации)",
    reader: ""
  },
  // «Любой Навык до +10 + Талант Mastery» (первая половина правила) закрыта
  // wdbc-2n5t БЕЗ этой capability — отдельной декларативной записью
  // kind:"skill", specKey:"__choice_any__" + grantsMastery:true (см.
  // module/apps/mechanics.mjs::resolveEntrySpecChoice/applyMechEntry). Эта
  // запись держит только ВТОРУЮ, ещё не мехнизированную половину.
  "mutation.knowledgeOfAges": {
    label: "Усиление/Успех/Переброс для добытого Навыка — переброс 1d10 (9-10: бесплатно, 1: Ступор)",
    source: "Мутация: Knowledge of Ages (Общие мутации)",
    reader: ""
  },
  "mutation.livingMirror": {
    label: "Иммунитет к E(Ls) Dmg (снаряжение зеркалится через 5 минут ношения); штрафы Stealth по решению ГМа — упирается в архитектурный пробел иммунитета к типу урона (готовой Черты под это в паке нет, проверено grep)",
    source: "Мутация: Living Mirror (Общие мутации)",
    reader: ""
  },
  "mutation.multipleEyes": {
    label: "10 субмутаций дают разные доп. глаза с разными эффектами (Navigate(Warp) пилотирование, +20 Awareness, круговой обзор, Independent Targeting и др.) — база сама не даёт эффекта без субмутации, не автоматизировано",
    source: "Мутация: Multiple Eyes (Общие мутации)",
    reader: ""
  },
  "mutation.organOfChaos": {
    label: "Трейт Unnatural Characteristic(+1) на характеристику по выбору ГМа (случайный демон/орган) + малая способность по решению ГМа — характеристика определяется на месте выдачи, вне фиксированных полей Конструктора",
    source: "Мутация: Organ of Chaos (Общие мутации)",
    reader: ""
  },
  "mutation.shieldOfPurity": {
    label: "Иммунитет к Горению и свойству Corrosive — полностью реализован двумя отдельными записями (weaponPropertyImmunity.flame + weaponPropertyImmunity.corrosive, wdbc-plsf); эта запись — оставшаяся историческая заглушка, ничего сверх них не читает",
    source: "Мутация: Shield of Purity (Общие мутации)",
    reader: ""
  },
  "mutation.strangeInvulnerability": {
    label: "Целиком в субмутациях (12 вариантов неуязвимости к типам атак — тупое/клинковое/стрелковое/взрывы/множественные цели и др.), база сама не даёт эффекта — не автоматизировано",
    source: "Мутация: Strange Invulnerability (Общие мутации)",
    reader: ""
  },
  "mutation.strangeTongue": {
    label: "10 субмутаций дают разные способности языка (Parasite, нюх +20, метательный захват, укус, огнемётная атака и др.) — база не даёт эффекта без субмутации, не автоматизировано",
    source: "Мутация: Strange Tongue (Общие мутации)",
    reader: ""
  },
  "mutation.synesthesia": {
    label: "−20 его соц. взаимодействия/Командование — kind:\"testMod\", modScope:\"social\". −20 Scrutiny ПРОТИВ персонажа — теперь тоже смоделировано (wdbc-1rno, module/rules/library/synesthesia.mjs, источник \"synesthesia\") — ctx.targetActor доехал до обычных тестов Навыка (module/sheets/actor-sheet.mjs::_showSkillRollDialog). −10 доп. на Избирательные атаки по персонажу — НЕ смоделировано: Избирательная атака выбирается в attack-dialog.mjs уже ПОСЛЕ отрисовки галочек правил (аим-дропдаун читается на кнопке «Бросок»), общий реестр туда не успевает — нужна отдельная точка внутри attack-dialog.mjs. Штраф Stealth — на усмотрение ГМа, книга не даёт числа.",
    source: "Мутация: Synesthesia (Общие мутации)",
    reader: "packs-src/mutations/Общие_мутации/Synesthesia..., kind:\"testMod\"; module/rules/library/synesthesia.mjs"
  },
  "mutation.tentacle": {
    label: "+20 на приём Захват, на 5 тестов Борьбы (Заломить/Пересилить/Вырваться/Выкрутиться/Перехватить Контроль) и на Укус (тоже настоящий тест WS/BS); Сжать/Хруст броска не делают вовсе (первое — штраф без теста, второе — автопопадание по книге); Метнуть/Замахнуться не реализовано роллом вообще (отдельный пробел); растяжение до 4м/узкие места — флейвор. Из 8 строк таблицы (не 10 — «d10» даёт диапазоны 2-3/4-5, реальных строк 8, см. doombc-submutations) субмутации 2-3 (Natural Armour 3) и 8 (+10 S, Unnatural S+2) заведены Механикой самого предмета (packs-src); 1 (растяжение до 15м + подъём союзника) получила флаг-заглушку про запас (mutation.tentacle.longReach, wdbc-nc8q) — числового бонуса нет, действие целиком за ГМом; 4-5 «С Присосками» (wdbc-egll) — «нельзя выбить/вырвать» через переиспользуемую capability combat.cannotBeDisarmed (см. эту запись отдельно), «+30 Карабканье» через новый scopeTarget «climbing» (item-rules.mjs/resolve-test.mjs), подхватывается module/combat/movement-actions.mjs::showClimbDialog — тот же scope пригоден и для идентичных бонусов Wings/Крылья и Tail/Хвост, их субмутации им пока не заведены; 9 «Изменчивое» (wdbc-2ynk) — форма руки/щупальца переключается кнопкой на листе предмета (не через capabilityKey — своя пара флаг+UI, module/apps/tentacle-hand-form.mjs), цена спишет module/combat/capability-cost.mjs, бонус +20 на приём Захват гасится, пока предмет в форме руки; 10 (Отделяемое, wdbc-1f5j) реализована напрямую в grapple.mjs (асимметричный выход из Захвата + информационный таймер регенерации 3ч через rules/cooldown.mjs) — без записи в этом реестре, читает item.system.submutation.label напрямую, не hasRuleFlag. Субмутации 6 (Ловкое) и 7 (Токсичное) частично: безоружная атака щупальцем выдаётся отдельным предметом kind:\"integralAttack\" (Flexible Tentacle/Toxic Tentacle, packs-src/weapons/Интегральные_атаки), when.submutations гейтит по броску; charm/interrogate +20 субмутации 6 механизированы полностью (wdbc-1j2h). Заломить (grapple.mjs) с wdbc-tj0p умеет наносить реальный урон (ignoreArmour), но Corrosive/Toxic щупальца к нему не подключены — нет способа отличить программно «использовал именно щупальце» от «использовал обычную руку» в общем приёме Борьбы. Все 8 строк таблицы теперь так или иначе заведены.",
    source: "Мутация: Tentacle (Общие мутации)",
    reader: "module/sheets/attack-dialog.mjs — resolveSelection (+20 на приём Захват, maneuverKey===\"grapple\", гасится tentacleBonusSuppressed при субмутации 9 в форме руки); module/combat/grapple.mjs — tentacleTechDef (+20 на 5 тестов Борьбы), _doBite (+20 на Укус), detachableTentacle/isDetachedGrapple (субмутация 10); субмутация 4-5 — combat.cannotBeDisarmed + scopeTarget climbing (см. отдельные записи)"
  },
  "mutation.tentacle.longReach": {
    label: "Субмутация 1 «Длинное» — щупальце растягивается до 15 м и полным действием может поднять персонажа на свою длину, если тот найдёт за что зацепиться; чисто ситуативное действие ГМа, числового эффекта нет — флаг заведён про запас для будущего читателя",
    source: "Мутация: Tentacle, субмутация 1 (Общие мутации)",
    reader: ""
  },
  "mutation.vampiricDependency": {
    label: "10 субмутаций определяют способ утоления и сопутствующий бонус (сердце/печень/кровь и т.п.) — сам акт утоления остаётся отыгрышем, не автоматизирован (нет bd)",
    source: "Мутация: Vampiric Dependency (Общие мутации)",
    reader: "module/rules/vampiric-dependency.mjs — тест T+0 (−10 за предыдущий месяц воздержания), провал даёт 1 Порчи; apps/vampiric-dependency.mjs::useVampiricTest, кнопка «Утолить»"
  },
  "mutation.warpEater": {
    label: "Раз в месяц тест Cor+10 или 1 Порча, избегается 4 уникальными по субмутации эмоциональными триггерами в месяц — ранее ошибочно классифицирована как чисто нарративная",
    source: "Мутация: Warp Eater (Общие мутации)",
    reader: ""
  },
  "mutation.warpTouched": {
    label: "10 субмутаций дают психологические W-тесты/эффекты (ложь/правдивость/клептомания/вспыльчивость и др.) — база не даёт эффекта без субмутации, не автоматизировано",
    source: "Мутация: Warp-Touched (Общие мутации)",
    reader: ""
  },
  "mutation.wrappedInChaos": {
    label: "10 субмутаций дают разные эффекты дыма (телепорт в тени, фантомные копии, дымовая завеса, штрафы на попадание и др.) — база не даёт эффекта без субмутации, не автоматизировано",
    source: "Мутация: Wrapped in Chaos (Общие мутации)",
    reader: ""
  },

  // ── Рунические Вязи (корбук стр. 433-434) — уникальный мистический эффект
  // на каждую вязь, вне полей Конструктора, заглушка данными, reader пуст ──
  "runicWeave.handOfTheRingbearer": {
    label: "Замыкает Ритуальные Круги полудействием, +5 на ритуалы с кругами. На броню/одежду с перчатками — нет действия/поля «Ритуальный Круг» в rituals.mjs, не автоматизировано",
    source: "Руническая Вязь «Длань Кольценосца» (Core, стр. 433)",
    reader: ""
  },
  "runicWeave.goldenWall": {
    label: "Мешает Бестелесным, использующим Варп, проходить сквозь позолоченную поверхность — Трейт «Бестелесный» нигде не читается кодом (заглушка), не автоматизировано",
    source: "Руническая Вязь «Золотая Стена» (Core, стр. 433)",
    reader: ""
  },
  "runicWeave.ashesOfThePhoenix": {
    label: "Чудесное Спасение тратит только 1d5 Бесчестия/Порчи вместо обычного",
    source: "Руническая Вязь «Прах Феникса» (Core, стр. 433)",
    reader: "module/sheets/tabs/death.mjs — doMiraculousSave/showDeathSaveDialog, corDie сужен до 1d5"
  },
  "runicWeave.owlFeather": {
    label: "Несёт личную руну псайкера: +15 манифестации сил на носителя, +30 Пси-чутью на определение сил против носителя — нет условия «против носителя» в testMod-области power/skill, не автоматизировано",
    source: "Руническая Вязь «Совиное Перо» (Core, стр. 433)",
    reader: ""
  },
  "runicWeave.shieldOfRevulsion": {
    label: "−5 к штрафу W от демонического присутствия — самого расчёта штрафа W от демонического присутствия нигде в коде нет (Трейт-заглушка), не автоматизировано",
    source: "Руническая Вязь «Щит Отвращения» (Core, стр. 433)",
    reader: ""
  },
  "runicWeave.twins": {
    label: "Оглушение на 1 Раунд не развеивает силы, манифестированные через Медитацию — нет кода, снимающего поддерживаемые силы при Оглушении, некуда встраивать исключение, не автоматизировано",
    source: "Руническая Вязь «Близнецы» (Core, стр. 433)",
    reader: ""
  },
  "runicWeave.stillWater": {
    label: "Скрывает от Света Разума/Эмпата/Выслеживания Разума и подобного; раз/Ход прерывает на себе Чтение Разума/Посылание Мыслей — эти силы не имеют механики обнаружения/прерывания в коде, не автоматизировано",
    source: "Руническая Вязь «Водная Гладь» (Core, стр. 433)",
    reader: ""
  },
  "runicWeave.breakwater": {
    label: "Раз/Раунд заставляет психайкера развеять/отменить на себе Телекинез или принудительное перемещение — Телекинез не выделен отдельной проверяемой силой в коде, не автоматизировано",
    source: "Руническая Вязь «Волнолом» (Core, стр. 433)",
    reader: ""
  },
  "runicWeave.secondSkin": {
    label: "Броня функционально становится частью тела для психосил (Касание Плоти, Огненная Форма и т.п.) — нет различия «часть тела vs надетый предмет» в схеме психосил-касания, не автоматизировано",
    source: "Руническая Вязь «Вторая Кожа» (Core, стр. 433)",
    reader: ""
  },
  "runicWeave.goldenBlade": {
    label: "Оружие бьёт Бестелесных, использующих Варп, как примитивное того же типа без свойства Primitive — Трейт «Бестелесный» нигде не читается кодом (заглушка), не автоматизировано",
    source: "Руническая Вязь «Золотой Клинок» (Core, стр. 433)",
    reader: ""
  },
  "runicWeave.bloodScript": {
    label: "Манифестация силы в помещении наносит эPR непоглощаемого R Dmg в голову + Кровотечение; исписаны все стены/пол/потолок — нет триггера «манифестация в этом помещении» (Region), не автоматизировано",
    source: "Руническая Вязь «Письмена Крови» (Core, стр. 433)",
    reader: ""
  },
  "runicWeave.fleshOfFlesh": {
    label: "Оружие — фокус +60 для Проклятий на последнее раненное им живое существо с душой — нет авто-слежения «последняя раненная этим оружием цель», не автоматизировано",
    source: "Руническая Вязь «Плоть от Плоти» (Core, стр. 433)",
    reader: ""
  },
  "runicWeave.brokenMirror": {
    label: "Скрытая вязь показывает Прорицанию только размытое пятно без слов/действий — Прорицание (Divination) не имеет кода-обнаружителя, не автоматизировано",
    source: "Руническая Вязь «Разбитое Зеркало» (Core, стр. 433)",
    reader: ""
  },
  "runicWeave.bannerOfTheLeader": {
    label: "+10 Демоническому Владычеству над низшими демонами/зверями, если те видят вязь — «Демоническое Владычество» не оформлено отдельным проверяемым тестом в коде, не автоматизировано",
    source: "Руническая Вязь «Стяг Предводителя» (Core, стр. 433)",
    reader: ""
  },
  "runicWeave.shieldOfSerenity": {
    label: "−10 к штрафу W от демонического присутствия — тот же пробел, что у «Щита Отвращения»: расчёта штрафа нет вообще, не автоматизировано",
    source: "Руническая Вязь «Щит Безмятежности» (Core, стр. 433)",
    reader: ""
  },
  "runicWeave.whiteNoise": {
    label: "Излучает хаотичный Варп — пси-чутьё видит факт манифестации, но не природу сил и не поддерживаемые — нет уровней детализации у Пси-чутья в коде, не автоматизировано",
    source: "Руническая Вязь «Белый Шум» (Core, стр. 434)",
    reader: ""
  },
  "runicWeave.handOfTheLordOfRings": {
    label: "Замыкает Ритуальные Круги свободным действием, +10 на ритуалы с кругами — тот же пробел, что у «Длани Кольценосца»: нет поля «Ритуальный Круг», не автоматизировано",
    source: "Руническая Вязь «Длань Владыки Колец» (Core, стр. 434)",
    reader: ""
  },
  "runicWeave.sipOfReality": {
    label: "Провал против Hallucinogenic даёт повторный тест W+0 — свойство Hallucinogenic не хранит состояние «провален ли тест» для последующего переброса, не автоматизировано",
    source: "Руническая Вязь «Глоток Реальности» (Core, стр. 434)",
    reader: ""
  },
  "runicWeave.reaper": {
    label: "Выжигание Души на ×2 максимума Ран восстанавливает W.b Ран/урона цели психайкеру; выгорает после 3 применений — Выжигание Души (hooks.mjs _resolveSoulBurn) не ведёт счётчик применений/лечение кастера, не автоматизировано",
    source: "Руническая Вязь «Жнец» (Core, стр. 434)",
    reader: ""
  },
  "runicWeave.scapegoat": {
    label: "Пара вязей на двух носителях: урон от психосил/варп-оружия по первому переходит второму в 90м — нет механики переноса урона между предметами/акторами, не автоматизировано",
    source: "Руническая Вязь «Козел Отпущения» (Core, стр. 434)",
    reader: ""
  },
  "runicWeave.crownOfThorns": {
    label: "1d10 непогл. X Dmg в голову атакующему психосилой/демонич. даром/одержимостью при проигрыше встречного W — встречный W-тест против атаки психосилой не оформлен переиспользуемой функцией, не автоматизировано",
    source: "Руническая Вязь «Корона Шипов» (Core, стр. 434)",
    reader: ""
  },
  "runicWeave.labyrinthOfCracks": {
    label: "Аннулирует Феномен/Прорыв ценой психического урона и призыва враждебного демона; выгорает после 9 применений — таблица Феноменов (psyker-tables.mjs) не имеет исхода «аннулирован», не автоматизировано",
    source: "Руническая Вязь «Лабиринт Трещин» (Core, стр. 434)",
    reader: ""
  },
  "runicWeave.shieldOfInevitability": {
    label: "Полностью нивелирует штраф W от демонического присутствия — тот же пробел, что у «Щита Отвращения»/«Безмятежности»: расчёта штрафа нет вообще, не автоматизировано",
    source: "Руническая Вязь «Щит Неизбежности» (Core, стр. 434)",
    reader: ""
  },
  "runicWeave.aegisOfGnelle": {
    label: "½AP брони (окр.▼) действует против Варп-оружия. На технику (по вязи на сторону) — не автоматизировано: урон технике идёт через combat/vehicle.mjs, не через эту точку",
    source: "Руническая Вязь «Эгида Г’Нелле» (Core, стр. 434)",
    reader: "module/combat/damage.mjs — ветка warpSoak в applyDamageToActor, armorAP = ⌊absorption/2⌋"
  },
  "runicWeave.steelGrimoire": {
    label: "Снимает штраф −1 эPR за поддержание одной психосилы (какая именно «вписана» — схема не различает, прощается 1 очко суммарной стоимости поддержания)",
    source: "Руническая Вязь «Стальной Гриммуар» (Core, стр. 434)",
    reader: "module/rules/character.mjs — prepareCharacterDerived(), sustainedCost −1 перед currentRating"
  },
  "runicWeave.cobaltFlame": {
    label: "Непоглощённый урон по заражённому — тест T на исцеление болезни, урон Нурглову покровительствуемому — предметы типа disease не имеют тестовой функции лечения (чистый текстовый StringField), не автоматизировано",
    source: "Руническая Вязь «Кобальтовое Пламя» (Core, стр. 434)",
    reader: ""
  },
  "runicWeave.brand": {
    label: "Рана от оружия считается личной руной для Пути Силы Нечестивые Символы — требование «своя руна» у Нечестивых Символов не проверяется кодом (текстовое поле), не автоматизировано",
    source: "Руническая Вязь «Клеймо» (Core, стр. 434)",
    reader: ""
  },
  "runicWeave.fireOfPower": {
    label: "Встроенный психофокус в древко — манифестация через оружие без занятой руки — требование «свободная рука» у Психофокуса не проверяется кодом (текстовое поле), не автоматизировано",
    source: "Руническая Вязь «Огонь Власти» (Core, стр. 434)",
    reader: ""
  },
  "runicWeave.churningStream": {
    label: "Манифестация/Выжигание Души рядом с носителем автоматически вызывает Феномен (+30, если он и так случился бы) — нет триггера «манифестация ДРУГОГО актора рядом», не автоматизировано",
    source: "Руническая Вязь «Бурлящий Поток» (Core, стр. 434)",
    reader: ""
  },
  "runicWeave.mirrorOfRsuleira": {
    label: "Раз в 9 дней аннулирует подействовавшую психосилу Реакцией, можно вернуть её манифестанту за Бесчестие — нет механики «отменить силу постфактум» и счётчика «раз в N дней» на предмете, не автоматизировано",
    source: "Руническая Вязь «Зеркало Р’Сулейра» (Core, стр. 434)",
    reader: ""
  },
  "runicWeave.trapOfHazofet": {
    label: "Провал демона по Одержимости — тест W-30 или вселение в оружие носителя Демоническим оружием — Одержимость решается вручную ГМом (нет авто-триггера провала), не автоматизировано",
    source: "Руническая Вязь «Ловушка Хазофета» (Core, стр. 434)",
    reader: ""
  },
  "runicWeave.runicArmourOfFenris": {
    label: "Не перегружающийся щит-дефлектор 1-65 против психосил/Варп-оружия/Выжигания Души — существующий forcefield-щит (combat/damage.mjs _rollActiveShield) явно обходится Варп-оружием (ignoreShield) и не вызывается Выжиганием Души; завести отдельный тип щита не входит в объём этого прохода, не автоматизировано",
    source: "Руническая Вязь «Рунная Броня Фенриса» (Core, стр. 434)",
    reader: ""
  },

};

/** Известно ли имя. Неизвестное — почти наверняка опечатка в записи. */
export function isKnownCapability(key) {
  return Object.hasOwn(CAPABILITIES, String(key ?? ""));
}

/** Список для дропдауна в Конструкторе: [ключ, подпись]. */
export const CAPABILITY_OPTIONS = Object.entries(CAPABILITIES)
  .map(([key, def]) => [key, def.label]);
