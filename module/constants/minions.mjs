// module/constants/minions.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Таблицы Миньонов (корбук стр. 111-113) как данные.
//
//  Две оси: ГРУППА (Человек, Зверь, Машина, Демон) и СИЛА (Низший, Обычный,
//  Высший, Превосходящий, Орда Миньонов). Группа отвечает на вопрос «чем этот
//  слуга думает» и задаёт характеристику Хозяина, от которой идут Лояльность и
//  максимум Миньонов, а также Навык в требовании Таланта. Сила задаёт уровень
//  Таланта, порог характеристики Хозяина, бюджеты создания и Редкость
//  снаряжения.
//
//  Превосходящий и Орда своих бюджетов не имеют: книга говорит «генерируется
//  как Высший» и «как Низший». Здесь это записано полем `buildsAs`, а не
//  копией чисел — иначе правка таблицы разъезжалась бы по двум местам.
//
//  Здесь только цифры и подписи. Расчёты — в module/rules/minion-build.mjs,
//  Foundry — в module/apps/minions.mjs.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Группы Миньонов. `masterChar` — характеристика Хозяина: от неё Лояльность
 * (стр. 113) и максимум Миньонов (стр. 111, по бонусу). `reqSkill` — Навык в
 * требовании Таланта, свой у каждой группы.
 */
export const MINION_GROUPS = {
  human:   { label: "Человек", masterChar: "fel", reqSkill: "Command",
             hint: "Любой носитель человеческого или близкого разума — ксенос, Астартес, слуга." },
  beast:   { label: "Зверь",   masterChar: "per", reqSkill: "Survival",
             hint: "Дикое или домашнее животное: высшего сознания и речи нет." },
  machine: { label: "Машина",  masterChar: "int", reqSkill: "Tech-Use",
             hint: "Сервиторы, роботы и дроны: разум возможен, свободы воли нет." },
  daemon:  { label: "Демон",   masterChar: "wp",  reqSkill: "Forbidden Lore (Daemons)",
             hint: "Существо Варпа: призванный демон, одержимый, демонхост, фамилиар." }
};

/**
 * Потолки и полы Характеристик по группам (стр. 111). Ключи — характеристики
 * листа, значения — предел. Зверь туп и неловок в человеческом смысле, машина
 * безвольна, у демона воли не бывает мало.
 */
export const GROUP_CHAR_LIMITS = {
  human:   {},
  beast:   { max: { int: 10, fel: 10 } },
  machine: { max: { wp: 10 } },
  daemon:  { min: { wp: 25 } }
};

/**
 * Уровни силы. Для каждого: уровень Таланта, требования к Хозяину (значение
 * характеристики группы, Бесчестие и надбавка Навыка группы) и бюджеты
 * создания. У Превосходящего и Орды бюджет берётся у другого уровня —
 * `buildsAs`.
 *
 * chars.points/cap — очки Характеристик и потолок одной для Зверя, Машины и
 * Демона; chars.roll — бросок Человека: `count` бросков `15+2d10`, из которых
 * отбрасывается `drop` наименьших, остальные девять раскидываются по
 * Характеристикам, кроме Бесчестия и Порчи.
 *
 * skills: `points` очков; `at` — уровень, на котором Навык берётся сразу;
 * `upTo` — до какого можно поднять за `upCost` очков и сколько таких подъёмов
 * разрешено (`upLimit`).
 *
 * talents: очки и потолок уровня Таланта (null — без потолка).
 * traits: очки. gear: Редкость брони, число прочих предметов и их Редкость.
 */
export const MINION_TIERS = {
  lesser: {
    label: "Низший", talentTier: 1, order: 1,
    req: { char: 35, infamy: 0, skill: 0 },
    chars:   { points: 120, cap: 30, roll: { base: 15, count: 9, drop: 0 } },
    skills:  { points: 4, at: 0,  upTo: 10, upCost: 2, upLimit: 1 },
    talents: { points: 5, maxTier: 1 },
    traits:  { points: 3 },
    gear:    { armourRarity: 0, items: 1, itemRarity: 0 }
  },
  standard: {
    label: "Обычный", talentTier: 2, order: 2,
    req: { char: 45, infamy: 30, skill: 10 },
    chars:   { points: 175, cap: 35, roll: { base: 20, count: 10, drop: 1 } },
    skills:  { points: 6, at: 10, upTo: 20, upCost: 2, upLimit: 2 },
    talents: { points: 7, maxTier: 2 },
    traits:  { points: 5 },
    gear:    { armourRarity: 1, items: 2, itemRarity: 1 }
  },
  greater: {
    label: "Высший", talentTier: 3, order: 3,
    req: { char: 50, infamy: 50, skill: 20 },
    chars:   { points: 250, cap: 40, roll: { base: 25, count: 11, drop: 2 } },
    skills:  { points: 9, at: 20, upTo: 30, upCost: 2, upLimit: 3 },
    talents: { points: 11, maxTier: null },
    traits:  { points: 7 },
    gear:    { armourRarity: 3, items: 4, itemRarity: 2 }
  },
  superior: {
    label: "Превосходящий Миньон", talentTier: 3, order: 4,
    req: { char: 55, infamy: 60, skill: 30 },
    buildsAs: "greater",
    // Правая рука, телохранитель или ученик: такой Миньон один, получает треть
    // опыта за сессию, копит Порчу и Бесчестие (до 2/3 хозяйского) и наносит
    // Экстремальный Урон. Потеря стоит Хозяину 1d5 Бесчестия.
    unique: true, infamyShare: 2 / 3, extremeDamage: true
  },
  horde: {
    label: "Орда Миньонов", talentTier: 3, order: 5,
    req: { char: 50, infamy: 45, skill: 20 },
    buildsAs: "lesser",
    // Ран у Орды нет вовсе — вместо них Магнитуда от Бесчестия Хозяина.
    isHorde: true, magnitudePerInfBonus: 5
  }
};

/** Бесчестие Миньона — половина хозяйского, но не выше этого потолка. */
export const MINION_INFAMY_CAP = 30;

/** Обмен «+5 одной Характеристике за −5 другой» — не больше двух раз. */
export const MINION_SWAP = { step: 5, limit: 2 };

/** Раны: T.b × 2 + 2 × Уровень; Swarm и Warp Instability дают +5 (не складывая). */
export const MINION_WOUNDS = { toughnessMult: 2, perTier: 2, fragileBonus: 5 };

/** Трейты, за которые идёт бонус к Ранам вместо смерти на нуле. */
export const FRAGILE_TRAITS = ["Swarm", "Warp Instability"];

/** Порча Миньона-демона задана книгой и обсуждению не подлежит. */
export const DAEMON_CORRUPTION = 100;

/** Талант, которым Миньон покупается. Ищем по флагу, имя — на крайний случай. */
export const MINION_TALENT_FLAG = "minionSlot";
export const MINION_TALENT_NAMES = ["Minion of Chaos", "Миньон Хаоса"];

/** Порядок показа — как в книге, а не по алфавиту ключей. */
export const MINION_TIER_ORDER = Object.entries(MINION_TIERS)
  .sort((a, b) => a[1].order - b[1].order).map(([key]) => key);

/** Бюджеты уровня с учётом «генерируется как …». */
export function tierBudget(tierKey) {
  const tier = MINION_TIERS[tierKey];
  if (!tier) return null;
  const base = tier.buildsAs ? MINION_TIERS[tier.buildsAs] : tier;
  return {
    chars:   base.chars,
    skills:  base.skills,
    talents: base.talents,
    traits:  base.traits,
    gear:    base.gear,
    // Уровень Таланта берём у самого уровня силы, а не у того, «как» он
    // строится: Орда стоит как третий уровень, хотя лепится как Низший.
    talentTier: tier.talentTier
  };
}
