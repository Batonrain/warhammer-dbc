/**
 * Константы и библиотека силовых щитов Warhammer FFG.
 */

// ── Природа щита ─────────────────────────────────────────────────────────────
export const SHIELD_NATURES = {
  technological: "Технологический",
  warp:          "Чародейский"
};

// ── Тип щита ──────────────────────────────────────────────────────────────────
export const SHIELD_TYPES = {
  dome:        "Купол",
  deflector:   "Дефлектор",
  penetrating: "Сквозной"
};

// ── Статус щита ───────────────────────────────────────────────────────────────
export const SHIELD_STATUS = {
  inactive:   { label: "Выключен",   icon: "🔴", css: "shield-off"      },
  active:     { label: "Активен",    icon: "🟢", css: "shield-active"   },
  overloaded: { label: "Перегружен", icon: "🟡", css: "shield-overload" },
  damaged:    { label: "Повреждён",  icon: "⚠️", css: "shield-damaged"  }
};

// ── Библиотека щитов ──────────────────────────────────────────────────────────
export const SHIELD_COMPENDIUM = [
  {
    key: "refractor",
    name: "Refractor / Рефрактор",
    shieldNature: "technological", shieldType: "dome",
    ratingMin: 1, ratingMax: 35, overloadThreshold: 10,
    isSpecialRating: false, weight: 2, availability: 2,
    description: "Стандартный технологический купольный щит. Широко распространён среди офицеров и наёмников."
  },
  {
    key: "lorica_kyrophatis",
    name: "Lorica Kyrophatis / Лорика Кирофатис",
    shieldNature: "technological", shieldType: "dome",
    ratingMin: 1, ratingMax: 10, overloadThreshold: 1,
    isSpecialRating: false, weight: 1, availability: 3,
    description: "Лёгкий купольный щит с низким рейтингом — компактный и лёгкий."
  },
  {
    key: "conversion_field",
    name: "Conversion Field / Конверсионное Поле",
    shieldNature: "technological", shieldType: "dome",
    ratingMin: 1, ratingMax: 50, overloadThreshold: 10,
    isSpecialRating: false, weight: 1, availability: 3,
    description: "Мощный технологический купол с высоким рейтингом."
  },
  {
    key: "frozen_heart",
    name: "Frozen Heart / Ледяное Сердце",
    shieldNature: "warp", shieldType: "deflector",
    ratingMin: 1, ratingMax: 25, overloadThreshold: 1,
    isSpecialRating: false, weight: 0.5, availability: 3,
    description: "Чародейский дефлектор. Крайне редкий артефакт варп-природы."
  },
  {
    key: "iron_halo",
    name: "Iron Halo / Железный Нимб",
    shieldNature: "technological", shieldType: "dome",
    ratingMin: 1, ratingMax: 50, overloadThreshold: 5,
    isSpecialRating: false, weight: 2, availability: 3,
    description: "Характерный щит Космодесантников и высших командиров."
  },
  {
    key: "rosarius",
    name: "Rosarius / Розарий",
    shieldNature: "technological", shieldType: "dome",
    ratingMin: 1, ratingMax: 50, overloadThreshold: 10,
    isSpecialRating: false, weight: 0.5, availability: 3,
    description: "Священный символ Экклезиархии, содержащий купольный силовой щит."
  },
  {
    key: "shimmering_robes",
    name: "Shimmering Robes / Мерцающие Робы",
    shieldNature: "warp", shieldType: "penetrating",
    ratingMin: 0, ratingMax: 0, overloadThreshold: 0,
    isSpecialRating: true, weight: 1, availability: 3,
    description: "Чародейский сквозной щит особой природы. Рейтинг определяется индивидуально."
  },
  {
    key: "displacer_field",
    name: "Displacer Field / Поле Заместитель",
    shieldNature: "technological", shieldType: "penetrating",
    ratingMin: 1, ratingMax: 65, overloadThreshold: 10,
    isSpecialRating: false, weight: 2, availability: 4,
    description: "Мощный сквозной щит. При активации переводит персонажа в фазовое состояние."
  },
  {
    key: "heavy_flare_shield",
    name: "Heavy Flare Shield / Тяжёлый Вспышковый Щит",
    shieldNature: "technological", shieldType: "dome",
    ratingMin: 1, ratingMax: 45, overloadThreshold: 10,
    isSpecialRating: false, weight: 90, availability: 4,
    description: "Массивный тяжёлый купольный щит. Очень тяжёлый, но крайне надёжный."
  },
  {
    key: "power_field_generator",
    name: "Power Field Generator / Генератор Силового Поля",
    shieldNature: "technological", shieldType: "dome",
    ratingMin: 1, ratingMax: 80, overloadThreshold: 10,
    isSpecialRating: false, weight: 35, availability: 4,
    description: "Мощный генератор силового поля с наивысшим рейтингом среди куполов."
  },
  {
    key: "crown_of_red_bronze",
    name: "Crown of Red Bronze / Корона Красной Бронзы",
    shieldNature: "warp", shieldType: "deflector",
    ratingMin: 1, ratingMax: 80, overloadThreshold: 8,
    isSpecialRating: false, weight: 3, availability: 4,
    description: "Древний чародейский дефлектор в форме короны."
  },
  {
    key: "prismatic_amulet",
    name: "Prismatic Amulet / Призматический Амулет",
    shieldNature: "technological", shieldType: "penetrating",
    ratingMin: 1, ratingMax: 60, overloadThreshold: 10,
    isSpecialRating: false, weight: 3, availability: 4,
    description: "Технологический сквозной щит в виде амулета."
  },
  {
    key: "runic_gauntlet",
    name: "Runic Gauntlet / Руническая Перчатка",
    shieldNature: "warp", shieldType: "penetrating",
    ratingMin: 1, ratingMax: 80, overloadThreshold: 0,
    isSpecialRating: false, weight: 3, availability: 4,
    description: "Чародейский сквозной щит. Порог перегрузки — «−»."
  },
  {
    key: "stasis_shield",
    name: "Stasis Shield / Стазис Щит",
    shieldNature: "warp", shieldType: "deflector",
    ratingMin: 1, ratingMax: 60, overloadThreshold: 10,
    isSpecialRating: false, weight: 4, availability: 4,
    description: "Чародейский дефлектор стазисной природы."
  },
  {
    key: "archeotech_refractor",
    name: "Archeotech Refractor / Археотехнический Рефрактор",
    shieldNature: "technological", shieldType: "dome",
    ratingMin: 1, ratingMax: 75, overloadThreshold: 10,
    isSpecialRating: false, weight: 5, availability: 5,
    description: "Высокотехнологичный купольный щит архео-происхождения."
  },
  {
    key: "personal_void_shield",
    name: "Personal Void Shield / Личный Пустотный Щит",
    shieldNature: "technological", shieldType: "penetrating",
    ratingMin: 0, ratingMax: 0, overloadThreshold: 0,
    isSpecialRating: true, weight: 5, availability: 5,
    description: "Личная версия пустотного щита. Рейтинг особый."
  },
  {
    key: "phase_shield",
    name: "Phase Shield / Фазовый Щит",
    shieldNature: "technological", shieldType: "penetrating",
    ratingMin: 1, ratingMax: 65, overloadThreshold: 10,
    isSpecialRating: false, weight: 3, availability: 5,
    description: "Технологический сквозной щит высочайшего класса."
  },
  {
    key: "rosarius_pontifex",
    name: "Rosarius Pontifex / Розарий Понтифекса",
    shieldNature: "technological", shieldType: "dome",
    ratingMin: 1, ratingMax: 99, overloadThreshold: 40,
    isSpecialRating: false, weight: 5, availability: 5,
    description: "Высший розарий Экклезиархии с максимальным рейтингом."
  },
  {
    key: "unbreakable_band",
    name: "Unbreakable Band / Нерушимая Лента",
    shieldNature: "technological", shieldType: "deflector",
    ratingMin: 1, ratingMax: 55, overloadThreshold: 0,
    isSpecialRating: false, weight: 2, availability: 5,
    description: "Технологический дефлектор в форме ленты. Порог перегрузки — «−»."
  }
];

// ── Силовые щиты Эльдар (Азуриане) ──────────────────────────────────────────
export const ELDAR_SHIELDS = [
  {
    key: "celestial_shield", name: "Celestial Shield / Небесный Щит",
    shieldNature: "technological", shieldType: "dome",
    ratingMin: 1, ratingMax: 40, overloadThreshold: 10,
    isSpecialRating: false, weight: 3, availability: 1,
    description: "Лёгкий доступный щит обычных и штормовых стражей. Работает куполом 30 м, защищая всех от внешних атак. Рейтинг −1 за каждое дружественное существо в куполе; союзники могут пользоваться им как своим. При активации — купол 2 м на носителе, рейтинг до нового хода −20. Перегрузка: деактивация, восстановление 15 мин (1 мин рядом с Певцом Кости)."
  },
  {
    key: "mistshield", name: "Mistshield / Туманный Щит",
    shieldNature: "technological", shieldType: "dome",
    ratingMin: 1, ratingMax: 50, overloadThreshold: 10,
    isSpecialRating: false, weight: 4, availability: 2,
    description: "Личный щит корсаров. Пока активен — испускает туман, считающийся укрытием 8 AP от E(Ls). Перегрузка: яркая вспышка создаёт область 10 м на 1d10 раундов, укрытие 12 AP против E(Ls)."
  },
  {
    key: "serpent_shield", name: "Serpent Shield / Змеиный Щит",
    shieldNature: "technological", shieldType: "dome",
    ratingMin: 1, ratingMax: 35, overloadThreshold: 0,
    isSpecialRating: false, weight: 25, availability: 2,
    description: "Надёжный купольный щит штормовых стражей (купол 30 м). Из-за габаритов −20 на тесты A и рукопашные приёмы (кроме обычной атаки). Можно ставить на грави-платформу/спину. Перегрузка: чинится 8-часовой сменой при Tech-Use+10 / Forbidden Lore (Bonesinger)+10 / трейте Bonesinger / бPR 4."
  },
  {
    key: "shimmershield", name: "Shimmershield / Мерцающий Щит",
    shieldNature: "technological", shieldType: "dome",
    ratingMin: 1, ratingMax: 50, overloadThreshold: 0,
    isSpecialRating: false, weight: 1, availability: 3,
    description: "Качественный надёжный щит экзархов и варлоков в форме тупого лезвия на руке. Если не защитил от атаки — атака теряет 4 Dmg до Поглощения. Вариация «мерцающий камень» (R4) распространяется на союзников в 10 м."
  },
  {
    key: "forceshield", name: "Forceshield / Психосиловой Щит",
    shieldNature: "warp", shieldType: "dome",
    ratingMin: 1, ratingMax: 50, overloadThreshold: 0,
    isSpecialRating: false, weight: 1, availability: 3,
    description: "Работает на психической мощи владельца (энергия варпа). Те же правила, что у Мерцающего Щита (если не защитил — атака теряет 4 Dmg до Поглощения), но без уникальной вариации."
  },
  {
    key: "force_barrier", name: "Force Barrier / Психосиловой Барьер",
    shieldNature: "warp", shieldType: "dome",
    ratingMin: 1, ratingMax: 80, overloadThreshold: 20,
    isSpecialRating: false, weight: 0, availability: 5,
    description: "Редчайший щит экзодитских миров (карманная версия). Можно сменить принцип работы: на Сквозной −10 к рейтингу активации, на Дефлектор −20. Перегрузка: телепортирует владельца на 1d10 км в безопасное место; затем 12 смен работы + медитация."
  }
];