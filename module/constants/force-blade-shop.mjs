// module/constants/force-blade-shop.mjs
// ════════════════════════════════════════════════════════════════════════
//  Прайс-лист Force Blade / Психосиловой Клинок (wdbc-vxgd) — книга (Книга
//  Аэльдари, Путь Варлока, «Отточенное Мастерство»): «Он может тратить
//  Успехи психотеста, чтобы добавлять психосиловому оружию следующие
//  свойства, каждое из которых стоит...» — 5 ценовых ступеней, 1-5 Успехов
//  за штуку.
//
//  УПРОЩЕНИЕ (сознательное, не забытое): книга также разрешает «улучшать»
//  уже взятое свойство при ПОВТОРНОЙ манифестации за 1 Успех вместо полной
//  цены ступени (кроме отдельно оговорённых случаев вроде Flame, где сама
//  верхняя ступень — это просто более сильная дайс-формула). Здесь это НЕ
//  смоделировано — каждая манифестация даёт свежий бюджет Успехов, покупки
//  не переносятся и не дешевеют между кастами. Причина: правило экономии
//  «между кастами» требует отдельного постоянного состояния (что уже куплено
//  и по какой цене) и вносит совсем другой уровень сложности, чем сам факт
//  «выбрать свойства сейчас, на эту манифестацию» — если владелец решит, что
//  экономия между кастами важна, это отдельный заход.
//
//  Ключи — module/constants/weapon-properties.mjs (все уже существуют в
//  реестре, включая эльдарские варианты eldarAccurate/eldarPrecise/
//  eldarRazorSharp/duelingWeapon/stepByShep/vibro/witchsEdge).
//
//  rating/rating2 — НАЧАЛЬНОЕ значение при первой покупке (число или строка-
//  формула для дайс-рейтингов вроде Flame). Свойства без rating/rating2 в
//  реестре (rating:false) просто добавляются без числа.
//
//  ОСОБЫЙ СЛУЧАЙ — "balance": это не запись system.weaponProps вообще, а
//  прямое числовое поле оружия system.balance (combat/defense.mjs), поэтому
//  у записи стоит balanceStat:true — module/apps/force-blade-choice.mjs
//  обрабатывает её отдельно, пишет в system.effects.weaponBuff.balanceMod,
//  не в addProps.
//
//  НЕОДНОЗНАЧНОСТЬ КНИГИ, требует сверки (не додумано, а прямо отмечено):
//  запись «Arc (8/–1/2d10)» — три числа через слэш, а реестр Arc знает
//  только rating (порог крита) + rating2 (дайс-формула второй цели), без
//  третьего слота. Здесь взяты крайние значения (rating:8, rating2:"2d10"),
//  средняя «–1» отброшена как неясная (похоже на модификатор Pen второй
//  цели или на шаг «улучшения» — ни то ни другое не подтверждено). Сверить
//  с книгой при случае — это единственная запись каталога, где я не уверена.
// ════════════════════════════════════════════════════════════════════════

export const FORCE_BLADE_SHOP = [
  // ── 1 Успех ──────────────────────────────────────────────────────────
  { id: "balance",        tier: 1, label: "Balance +1",             balanceStat: true, rating: 1 },
  { id: "blinding",       tier: 1, label: "Blinding (+1)",          key: "blinding",       rating: 1 },
  { id: "defensive",      tier: 1, label: "Defensive",              key: "defensive" },
  { id: "eldarRazorSharp",tier: 1, label: "Eldar Razor Sharp",      key: "eldarRazorSharp" },
  { id: "flame1",         tier: 1, label: "Flame",                  key: "flame",          rating: "1d10" },
  { id: "powerField",     tier: 1, label: "Power Field",            key: "powerField" },
  { id: "tearing",        tier: 1, label: "Tearing",                key: "tearing" },

  // ── 2 Успеха ─────────────────────────────────────────────────────────
  { id: "arc",            tier: 2, label: "Arc (8/2d10)",           key: "arc",            rating: 8, rating2: "2d10" },
  { id: "crippling",      tier: 2, label: "Crippling (2)",          key: "crippling",      rating: 2 },
  { id: "eldarPrecise",   tier: 2, label: "Eldar Precise",          key: "eldarPrecise" },
  { id: "devastating",    tier: 2, label: "Devastating (+1)",       key: "devastating",    rating: 1 },
  { id: "duelingWeapon",  tier: 2, label: "Dueling Weapon",         key: "duelingWeapon" },
  { id: "felling",        tier: 2, label: "Felling (2)",            key: "felling",        rating: 2 },
  { id: "proven",         tier: 2, label: "Proven (3)",             key: "proven",         rating: 3 },
  { id: "rad",            tier: 2, label: "Rad (+2)",               key: "rad",            rating: 2 },
  { id: "shocking",       tier: 2, label: "Shocking",               key: "shocking" },
  { id: "toxic",          tier: 2, label: "Toxic (1)",              key: "toxic",          rating: 1 },

  // ── 3 Успеха ─────────────────────────────────────────────────────────
  { id: "concussive",     tier: 3, label: "Concussive (0)",         key: "concussive",     rating: 0 },
  { id: "extreme",        tier: 3, label: "Extreme (9/-1)",         key: "extreme",        rating: 9, rating2: -1 },
  { id: "eldarAccurate",  tier: 3, label: "Eldar Accurate",         key: "eldarAccurate" },
  { id: "flame2",         tier: 3, label: "Flame (2d10)",           key: "flame",          rating: "2d10" },
  { id: "lance",          tier: 3, label: "Lance",                  key: "lance" },
  { id: "stepByStep",     tier: 3, label: "Step by Step",           key: "stepByStep" },
  { id: "vibro",          tier: 3, label: "Vibro (+1)",             key: "vibro",          rating: 1 },
  { id: "warpWeapon",     tier: 3, label: "Warp Weapon",            key: "warpWeapon" },
  { id: "wrecker",        tier: 3, label: "Wrecker (1)",            key: "wrecker",        rating: 1 },

  // ── 4 Успеха ─────────────────────────────────────────────────────────
  { id: "corrosive",      tier: 4, label: "Corrosive (3)",          key: "corrosive",      rating: 3 },
  { id: "grav",           tier: 4, label: "Grav",                   key: "grav" },
  { id: "hallucinogenic", tier: 4, label: "Hallucinogenic (0)",     key: "hallucinogenic", rating: 0 },
  { id: "haywire",        tier: 4, label: "Haywire (0)",            key: "haywire",        rating: 0 },
  { id: "resonant",       tier: 4, label: "Resonant",               key: "resonant" },

  // ── 5 Успехов ────────────────────────────────────────────────────────
  { id: "flame3",         tier: 5, label: "Flame (3d10)",           key: "flame",          rating: "3d10" },
  { id: "flexible",       tier: 5, label: "Flexible",               key: "flexible" },
  { id: "mighty",         tier: 5, label: "Mighty",                 key: "mighty" },
  { id: "sanctified",     tier: 5, label: "Sanctified",             key: "sanctified" },
  { id: "witchsEdge",     tier: 5, label: "Witch's Edge",           key: "witchsEdge" }
];
