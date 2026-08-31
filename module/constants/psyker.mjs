// module/constants/psyker.mjs

// ── Природа Дара ────────────────────────────────────────────────────────────
// Параметры Природы Дара (Усиленный режим = push):
//   pushBonusType: "fixed" → pushBonus; "roll" → pushFormula (бонус к эPR)
//   pushPhenType:  "flat"  → pushPhenValue фикс. к броску Феноменов;
//                  "perPoint" → pushPhenValue × (бонусные пункты PR)
//   normalPhenMod: модификатор к броску Феноменов в Обычном режиме
//   isChaos: Хаосит (Варп-Шок не накладывает на него Порчу)
export const PSY_NATURES = {
  bound: {
    label: "Связанный",
    pushBonusType: "fixed", pushBonus: 3,
    pushPhenType: "flat", pushPhenValue: 10,
    normalPhenMod: 0,
    ignoresOwnPhenomena: false, isChaos: false
  },
  unbound: {
    label: "Несвязанный",
    pushBonusType: "roll", pushFormula: "1d5",
    pushPhenType: "perPoint", pushPhenValue: 5,
    normalPhenMod: 10,
    ignoresOwnPhenomena: false, isChaos: false
  },
  daemonic: {
    label: "Демонический",
    pushBonusType: "roll", pushFormula: "1d5",
    pushPhenType: "perPoint", pushPhenValue: 10,
    normalPhenMod: 10,
    ignoresOwnPhenomena: true, isChaos: true
  },
  // Природа Дара Аэльдари — используется автоматически для рас Аэльдари.
  // Усиленный режим: игрок выбирает бонус +1..+4 к эPR, ценой +15 к броску
  // Феноменов за каждый пункт (т.е. +15..+60).
  ancientMastery: {
    label: "Древнее Мастерство",
    pushBonusType: "choice", pushChoiceMax: 4,
    pushPhenType: "perPoint", pushPhenValue: 15,
    normalPhenMod: 0,
    ignoresOwnPhenomena: false, isChaos: false, isEldar: true
  }
};

// ── Режимы манифестации ─────────────────────────────────────────────────────
export const PSY_MODES = {
  safe: {
    label: "Безопасный",
    desc: "эPR = ½ mPR (окр. вверх). Феномены не вызываются.",
    phenomena: "never"
  },
  normal: {
    label: "Обычный",
    desc: "эPR = mPR. Феномен при любом дубле на успешном психотесте или натуральном 99.",
    phenomena: "double"
  },
  push: {
    label: "Усиленный",
    desc: "эPR = mPR + бонус (зависит от Природы Дара). Феномен вызывается всегда.",
    phenomena: "always"
  }
};

// ── Типы психосил ───────────────────────────────────────────────────────────
export const PSY_POWER_TYPES = {
  attack:       "Атака",
  aura:         "Аура",
  infusion:     "Вливание",
  duration:     "Длительная (X)",
  change:       "Изменение (X)",
  touch:        "Касание",
  indirect:     "Непрямое",
  summon:       "Призыв",
  psychicBlade: "Психический Клинок",
  psychicShoot: "Психострельба",
  concentration:"Концентрация",
  cycle:        "Цикл",
  other:        "Прочее"
};

// ── Действия ────────────────────────────────────────────────────────────────
export const PSY_ACTIONS = {
  free:     "Свободное",
  reaction: "Реакция",
  half:     "Полудействие",
  full:     "Полное действие",
  extended: "Длительное"
};

// ── Пути Силы ───────────────────────────────────────────────────────────────
// testMod — мод. к психотесту; ePR — прибавка к эПР; phenMod — мод. к броску
// Феноменов. note — текст для тех Путей, что не автоматизируются полностью.
export const PSY_PATHS = {
  "":            { label: "— Без Пути —",          req: "",                                          testMod: 0,  ePR: 0, phenMod: 0,  note: "" },
  psychofocus:   { label: "Психофокус",            req: "психофокус в руке/контакте с кожей",         testMod: 0,  ePR: 0, phenMod: 0,  focusTest: true, note: "Свободное действие, тест W+0 (1/ход, в свой Ход): Успех +10, Крит. успех +15, Крит. провал −10 к этому психотесту." },
  incantation:   { label: "Инкантация",            req: "Талант Blasphemous Incantation",             testMod: 0,  ePR: 1, phenMod: 20, note: "Полудействие→полное действие при манифестации." },
  meditation:    { label: "Медитация",             req: "Талант Meditation",                          testMod: 0,  ePR: 3, phenMod: 0,  note: "Требует концентрации; развеивается при Оглушении." },
  corpus:        { label: "Телесная Конверсия",     req: "Талант Corpus Conversion",                   testMod: 0,  ePR: 0, phenMod: 0,  dynamicTestMod: "t", woundCost: 1, note: "Ценой 1 Раны: +T.b к психотесту (или +1d10 урона — вручную)." },
  sacrifice:     { label: "Жертва",                req: "Талант Sacrifice",                           testMod: 0,  ePR: 0, phenMod: 0,  note: "Ритуал 1d5 мин: +1 эПР за каждый нечётный Успех Forbidden Lore (Warp) (вручную)." },
  unholy:        { label: "Нечестивые Символы",     req: "Scholastic Lore (Occult) +0",                testMod: 0,  ePR: 0, phenMod: -20, note: "Символы на объекте/персонаже; штраф к броску Феноменов." },
  familiar:      { label: "Псайбер-Фамильяр",       req: "связанный псайбер-фамильяр",                 testMod: 0,  ePR: 0, phenMod: 0,  note: "Дальность считается от фамильяра." },
  personal:      { label: "Личный Фокус",           req: "Scholastic Lore (Occult) +10",               testMod: 0,  ePR: 0, phenMod: 0,  note: "Личный фокус из материала псайкера; применим только к нему." },
  choir:         { label: "Психический Хор",        req: "Forbidden Lore (Warp) +0",                   testMod: 0,  ePR: 0, phenMod: 0,  note: "Хормейстер: +1 к 6PR за каждого Хориста (см. правила)." },
  runeFate:      { label: "Руна Судьбы",            req: "Руна Судьбы касается кожи (при бPR 6+ — привязана к ауре)", testMod: 0, ePR: 0, phenMod: 0,
                   runeMode: true, phenOnly66: true,
                   note: "Только Безопасный/Обычный режим; Феномен лишь на 66 в Обычном. Нельзя силы из Божественных Дисциплин и силы, манифестируемые броском на Порчу. Снижает цену действия манифестации/поддержания на 1 ступень (Полное→Полудействие→Свободное). Снижение до Свободного — только для первой психосилы в раунде." },
  runeBattle:    { label: "Руна Битвы",             req: "Руна Битвы касается кожи (при бPR 6+ — привязана к ауре)", testMod: 0, ePR: 0, phenMod: 0,
                   runeMode: true, phenOnly66: true,
                   note: "Только Безопасный/Обычный режим; Феномен лишь на 66 в Обычном. Нельзя силы из Божественных Дисциплин и силы, манифестируемые броском на Порчу. Манифестирует вторую психосилу той же стоимостью действия (две одинаковые или разные); поддерживаемые поддерживаются как одна (берётся наименьшее значение) и развеиваются вместе." }
};
