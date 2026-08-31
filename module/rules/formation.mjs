// module/rules/formation.mjs
// ════════════════════════════════════════════════════════════════════════════
//  АГРЕГАЦИЯ ФОРМИРОВАНИЯ («Книга Битв») — итоговая Сила, Оборона, кости
//  урона, скорость по ландшафту, укрытие, истощение и пороги боевого духа.
//  Вызывается из documents/actor.mjs (_prepareFormationData) — вынесена из
//  монолита prepareDerivedData (wdbc-yo4n).
// ════════════════════════════════════════════════════════════════════════════

import { TROOP_TYPES, TRAINING_LEVELS, FORMATION_SIZES, ORDERS, ATTRITION,
         totalStrength, defenceFrom, damageDice, effectiveSpeed, totalCover,
         attritionPenalty, availabilityMod } from "../constants/formation.mjs";

/**
 * Производные данные Формирования. Мутирует system.derived и system.initiative
 * (боевой трекер системы считает «1d10 + @initiative + @initiativeMod» и
 * работает без отдельной логики).
 *
 * Инициатива формирования — 1к10 + бонус характеристики войск (Выучка/10).
 *
 * @param {object} system system актора (мутируется)
 */
export function prepareFormationDerived(system) {
  const troop = TROOP_TYPES[system.troopType] || {};
  const train = TRAINING_LEVELS[system.training] || {};
  const size  = FORMATION_SIZES[system.size] || {};

  const s   = totalStrength(system);
  const def = defenceFrom(s);

  // Ситуативные модификаторы костей урона от текущего приказа и состояния.
  const st = system.status || (system.status = {});
  let diceMod = 0;
  if (system.order?.key === "advance") diceMod -= 1;   // марш: на кость меньше
  if (st.exhausted) diceMod -= 3;                      // после форсированного марша
  const dice = damageDice(system.size, diceMod);

  // Скорость: ландшафт × множитель приказа.
  const orderFx   = ORDERS[system.order?.key]?.effect || {};
  const speedMult = orderFx.speedMult ?? 1;
  const spd = effectiveSpeed({
    troopType: system.troopType, terrain: system.terrain,
    speedMult, speedOverride: system.speedOverride
  });

  const cover = totalCover({
    terrain: system.terrain, dugIn: system.cover?.dugIn,
    aaCover: system.cover?.aa, coverMod: system.cover?.mod
  });

  // Численность и боевой дух.
  const num     = system.numbers || (system.numbers = { value: 0, max: 0 });
  const mor     = system.morale  || (system.morale  = { value: 0, max: 0, gearRoll: 0 });
  const numMax  = Math.max(0, Number(num.max) || 0);
  const numVal  = Math.max(0, Number(num.value) || 0);
  // Предел боевого духа: подготовка + разовый бросок за качество снаряжения.
  const morMax  = Math.max(0, (Number(mor.max) || 0));
  const morVal  = Math.max(0, Number(mor.value) || 0);

  // Титаны не имеют боевого духа и все его тесты проходят автоматически.
  const fearless = !!troop.fearless;

  const numLost = Math.max(0, numMax - numVal);
  const morLost = Math.max(0, morMax - morVal);
  const penalty = fearless ? 0 : attritionPenalty(morMax, morVal);

  const halfMorale    = Math.floor(morMax * ATTRITION.thresholds[0]);
  const quarterMorale = Math.floor(morMax * ATTRITION.thresholds[1]);

  // Инициатива: бонус характеристики войск = Выучка / 10.
  const skill = Number(train.skill) || 0;
  system.initiative = Math.floor(skill / 10);

  system.derived = {
    // Боевые показатели
    strength: s,
    defence:  def,
    dice,
    diceMod,
    damageFormula: dice > 0 ? `${dice}d10 + ${s}` : `${s}`,
    speed: spd,
    baseSpeed: troop.spd ?? 0,
    range: troop.rng ?? null,
    rangeLabel: troop.rng == null ? "С" : `${troop.rng} км`,
    rangeNote: troop.rngNote || "",
    cover,
    rating: troop.r ?? 0,
    category: troop.cat || "",
    isAir: troop.cat === "air",
    isAA:  troop.cat === "aa",
    isArmour: troop.cat === "armour" || troop.cat === "mech",
    aaRadius: troop.aaRadius ?? 0,
    aaGrant:  troop.aaCover ?? 0,
    fearless,

    // Тесты формирования (когда командует не герой, а его офицеры)
    skillValue: skill,
    testValue:  skill + penalty + (Number(st.disorder) || 0),
    moraleBase: Number(train.morale) || 0,

    // Истощение
    numbersLost: numLost,
    numbersPct:  numMax > 0 ? Math.round(numVal / numMax * 100) : 0,
    moraleLost:  morLost,
    moralePct:   morMax > 0 ? Math.round(morVal / morMax * 100) : 0,
    penalty,
    halfMorale, quarterMorale,
    atHalf:    !fearless && morMax > 0 && morVal <= halfMorale,
    atQuarter: !fearless && morMax > 0 && morVal <= quarterMorale,
    broken:    numMax > 0 && numVal <= 0,
    routed:    !fearless && morMax > 0 && morVal <= 0,

    // Организация
    sizeLabel:    size.label || "",
    sizeHeadcount: size.headcount || "",
    isFormation:  size.formation !== false,
    availability: availabilityMod(system.techLevel, system.training),
    attachedCount: Array.isArray(system.attached) ? system.attached.length : 0
  };
}
