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
  // ── Роли ──────────────────────────────────────────────────────────────────
  "pilot.dreadnought": {
    label: "Заключён в саркофаг Дредноута",
    source: "Книга Машин, «Дредноуты» (стр. 57-58)",
    reader: "module/rules/sources.mjs — источник «dreadnought»; Требования Талантов Дредноутов"
  },

  // ── Саркофаг Дредноута (Книга Машин, стр. 57) ─────────────────────────────
  // Пункты книги, которые не выражаются числом. Раздаются, пока актор назначен
  // пилотом; читатели — там, где книга их применяет.
  "sarcophagus.autoPassFear": {
    label: "Автоматически проходит тесты Страха, Подавления и Запугивания",
    source: "Саркофаг Дредноута (стр. 57)", reader: ""
  },
  "sarcophagus.immuneBleedingFatigue": {
    label: "Иммунен к Кровотечению и Усталости",
    source: "Саркофаг Дредноута (стр. 57)", reader: ""
  },
  "sarcophagus.noPsychicPowers": {
    label: "Не может манифестировать и поддерживать психосилы",
    source: "Саркофаг Дредноута (стр. 57); снимается Матрицей Осирис", reader: ""
  },
  "sarcophagus.helpless": {
    label: "Без конечностей: Беспомощен, когда не подключён к машине",
    source: "Саркофаг Дредноута (стр. 57)", reader: ""
  },
  "sarcophagus.noFoodWaterAir": {
    label: "Не нуждается в воде, еде и воздухе",
    source: "Саркофаг Дредноута (стр. 57)", reader: ""
  },
  "sarcophagus.autoWakeFromStun": {
    label: "Электрошок в конце Хода снимает Оглушение (кроме Галлюцинаций)",
    source: "Саркофаг Дредноута (стр. 57)", reader: ""
  },
  "sarcophagus.autoSenses": {
    label: "Видит только авточувствами саркофага; лишён обоняния и вкуса",
    source: "Саркофаг Дредноута (стр. 57)", reader: ""
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
    reader: ""
  },
  "calledShot.notMental": {
    label: "Избирательные атаки не считаются ментальными",
    source: "Локус Подношения (стр. 31)",
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
    reader: ""
  },
  "action.bonusHalfMove": {
    label: "Бонусное полудействие, только на Движение",
    source: "Локус Стремительности (стр. 29)",
    reader: ""
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
    reader: ""
  },
  "horror.splitsIntoThree": {
    label: "Ужасы при смерти делятся на 3, а не на 2",
    source: "Локус Трансмогрификации (стр. 32)",
    reader: ""
  },
  "ignore.lingerTemplates": {
    label: "Игнорирует шаблоны со свойством Linger",
    source: "Локус Упорства (стр. 30)",
    reader: ""   // Трудный Ландшафт закрыт записью terrainIgnore; шаблоны Linger — нет
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
  }
};

/** Известно ли имя. Неизвестное — почти наверняка опечатка в записи. */
export function isKnownCapability(key) {
  return Object.hasOwn(CAPABILITIES, String(key ?? ""));
}

/** Список для дропдауна в Конструкторе: [ключ, подпись]. */
export const CAPABILITY_OPTIONS = Object.entries(CAPABILITIES)
  .map(([key, def]) => [key, def.label]);
