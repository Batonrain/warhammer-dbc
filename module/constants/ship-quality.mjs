// ─────────────────────────────────────────────────────────────────────────────
//  КАЧЕСТВО УЗЛОВ КОРАБЛЯ (корбук, «Качество узлов»).
//
//  Качество меняет свойства узла в зависимости от его типа. Для лэнсов и
//  макробатарей игрок ВЫБИРАЕТ модификаторы из списка, для прочих узлов часть
//  эффектов фиксирована, а часть — на выбор. Изменение цены в SP — всегда.
//
//  Два правила книги, которые легко потерять:
//    • «Эти модификаторы не могут довести любое из значений до 0» — значение,
//      которое было положительным, не опускается ниже 1.
//    • «Если у узла указаны собственные зависимости от качества, то их эффекты
//      заменяют указанные здесь (кроме изменения цены в SP)» — флаг
//      system.qualityCustom.
// ─────────────────────────────────────────────────────────────────────────────

/** Цена в SP меняется всегда, даже у узлов со своими зависимостями. */
export const QUALITY_SP = { poor: -1, common: 0, good: 1, best: 2 };

export const QUALITY_LABELS = { poor: "Poor.Q", common: "Comm.Q", good: "Good.Q", best: "Best.Q" };

// Модификаторы-кандидаты. delta применяется к полю узла.
//   power  : >0 потребляет больше / вырабатывает меньше
//   space  : занимаемое Пространство
//   s / dmg / crit / rng : профиль орудия (dmg — бонус к формуле урона)
const M = (key, label, field, delta) => ({ key, label, field, delta });

const W_POOR = [
  M("e+1",    "Энергия +1",   "power",  1),
  M("spc+1",  "Простр. +1",   "space",  1),
  M("s-1",    "Сила −1",      "s",     -1),
  M("dmg-1",  "Урон −1",      "dmg",   -1),
  M("crit+1", "Крит +1",      "crit",   1),
  M("rng-1",  "Дальность −1", "rng",   -1)
];
const W_GOOD = [
  M("e-1",    "Энергия −1",   "power", -1),
  M("spc-1",  "Простр. −1",   "space", -1),
  M("dmg+1",  "Урон +1",      "dmg",    1),
  M("rng+1",  "Дальность +1", "rng",    1)
];
const W_BEST = [
  M("e-1",    "Энергия −1",   "power", -1),
  M("spc-1",  "Простр. −1",   "space", -1),
  M("s+1",    "Сила +1",      "s",      1),
  M("dmg+1",  "Урон +1",      "dmg",    1),
  M("crit-1", "Крит −1",      "crit",  -1),
  M("rng+1",  "Дальность +1", "rng",    1)
];

// Прочие узлы. «Генерирует −2 или потребляет +1» — это одно и то же поле power
// с разным знаком: у генераторов power отрицательный (см. _prepareShipData),
// поэтому ухудшение всегда сдвигает power в плюс.
const O_GOOD = [
  M("e-1",   "Энергия −1 (или +1 к выработке)", "power", -1),
  M("spc-1", "Простр. −1",                      "space", -1)
];

/**
 * Реестр по качеству: сколько модификаторов выбирать, из чего, и что
 * применяется без выбора.
 */
export const SHIP_QUALITY = {
  weapon: {
    poor:   { pick: 2, options: W_POOR, fixed: [] },
    common: { pick: 0, options: [],     fixed: [] },
    good:   { pick: 1, options: W_GOOD, fixed: [] },
    best:   { pick: 2, options: W_BEST, fixed: [] }
  },
  other: {
    // Poor: генерирует −2 ИЛИ потребляет +1 — выбор игрока; SPC +1 всегда.
    poor:   { pick: 1, fixed: [M("spc+1", "Простр. +1", "space", 1)],
              options: [ M("gen-2", "Выработка −2", "power", 2),
                         M("e+1",   "Потребление +1", "power", 1) ] },
    common: { pick: 0, options: [], fixed: [] },
    // Good: одно из — энергия или пространство.
    good:   { pick: 1, options: O_GOOD, fixed: [] },
    // Best: и энергия, и пространство.
    best:   { pick: 0, options: [],
              fixed: [ M("e-1",   "Энергия −1 (или +1 к выработке)", "power", -1),
                       M("spc-1", "Простр. −1",                      "space", -1) ] }
  }
};

// Таблица качества «Лэнсы и макробатареи» относится ИМЕННО к ним. Торпедные
// аппараты, ангары и нова-орудия своего профиля Урона/Крита/Дальности в этом
// смысле не имеют, поэтому идут по правилам прочих узлов.
const QUALITY_WEAPON_TYPES = new Set(["macrobattery", "lance"]);

/** Орудие ли это для целей качества: только лэнсы и макробатареи. */
export function qualityClass(system) {
  return (system?.kind === "weapon" && QUALITY_WEAPON_TYPES.has(system?.weapon?.wType))
    ? "weapon" : "other";
}

/** Набор доступных вариантов для узла — для интерфейса выбора. */
export function qualityOptionsFor(system) {
  const q = system?.quality || "common";
  return SHIP_QUALITY[qualityClass(system)][q] || SHIP_QUALITY.other.common;
}

/**
 * Итоговые модификаторы узла от качества.
 * Возвращает { power, space, sp, s, dmg, crit, rng, picks, need, custom }.
 * Выбранные варианты берутся из system.qualityPicks; лишние отбрасываются,
 * недостающие просто не применяются (в листе это видно как «выберите ещё N»).
 */
export function shipQualityMods(system) {
  const q    = system?.quality || "common";
  const def  = qualityOptionsFor(system);
  const out  = { power: 0, space: 0, sp: QUALITY_SP[q] ?? 0,
                 s: 0, dmg: 0, crit: 0, rng: 0,
                 need: def.pick || 0, picks: [], custom: !!system?.qualityCustom };

  // Свои зависимости от качества заменяют общие — кроме цены в SP.
  if (out.custom) return out;

  const apply = (m) => { if (m && out[m.field] !== undefined) out[m.field] += m.delta; };
  for (const m of (def.fixed || [])) apply(m);

  const chosen = Array.isArray(system?.qualityPicks) ? system.qualityPicks : [];
  const seen = new Set();
  for (const key of chosen) {
    if (seen.size >= (def.pick || 0)) break;
    if (seen.has(key)) continue;                       // один вариант — один раз
    const m = (def.options || []).find(o => o.key === key);
    if (!m) continue;
    seen.add(key);
    out.picks.push(m);
    apply(m);
  }
  out.need = Math.max(0, (def.pick || 0) - seen.size);
  return out;
}

/**
 * Применение модификатора к значению с правилом книги: модификаторы не могут
 * довести значение до 0. Изначально нулевое значение так и остаётся нулём —
 * иначе качество «дарило» бы узлу энергопотребление или пространство из ниоткуда.
 */
export function clampQuality(base, mod) {
  const b = Number(base) || 0;
  if (!mod) return b;
  const v = b + mod;
  if (b === 0) return 0;
  if (b > 0 && v <= 0) return 1;
  if (b < 0 && v >= 0) return -1;
  return v;
}

/**
 * Профиль орудия с учётом качества. Урон приходит формулой («1d10+6»), поэтому
 * бонус качества правит слагаемое, а не кубик.
 */
export function effectiveWeapon(system) {
  const w  = system?.weapon || {};
  const qm = shipQualityMods(system);
  const dmg = String(w.damage || "");
  let damage = dmg;
  if (qm.dmg && dmg) {
    const m = dmg.match(/^(.*?)([+-]\s*\d+)?\s*$/);
    const base = (m?.[1] || dmg).trim();
    const add  = (parseInt((m?.[2] || "0").replace(/\s+/g, ""), 10) || 0) + qm.dmg;
    damage = add === 0 ? base : `${base}${add > 0 ? "+" : ""}${add}`;
  }
  return {
    ...w, damage,
    strength:   clampQuality(w.strength, qm.s),
    crit:       clampQuality(w.crit,     qm.crit),
    range:      clampQuality(w.range,    qm.rng),
    qualityMods: qm
  };
}
