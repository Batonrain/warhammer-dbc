// module/rules/die-swap.mjs
//
// «Кубик → Успехи» (стр. 34, wdbc-x1nz.2.49): атакующий может заменить
// результат ОДНОГО кубика броска урона числом Успехов на попадание. Кнопка —
// combat/attack-card.mjs, правка итога — hooks.mjs (.wh-dmg-swap-btn).
//
// Sky Predator / Хищник Небес — Черта архетипа Раптор (Космодесант, корбук,
// «Архетипы Космодесантников», стр. 15):
//
//   «В Ход, когда Раптор совершает Натиск с полета, он может заменять до 2-х
//   кубиков урона от атак Успехами на попадание.»
//
// «С полёта» — персонаж в воздухе (system.movement.altitude из
// combat/movement-actions.mjs::IN_FLIGHT_ALTITUDES) в момент атаки Натиском.
//
// Кубик для замены — только ОСТАВЛЕННЫЙ в броске (active): у Рвущего/
// Легионера-Виртуоза отброшенный кубик в итоге урона не участвует, и
// подменять его значит вычитать из итога то, чего в нём нет.

/** Имя возможности (module/constants/capabilities.mjs), выдаёт документ Черты. */
export const SKY_PREDATOR = "trait.skyPredator";

/** Сколько кубиков заменяет Хищник Небес. */
export const SKY_PREDATOR_DICE = 2;

/**
 * Результаты оставленных (active) кубиков броска урона — по порядку терминов.
 * @param {{terms?:Array}} roll
 * @returns {number[]}
 */
export function activeDieResults(roll) {
  const out = [];
  for (const term of roll?.terms ?? []) {
    if (!term?.faces || !Array.isArray(term.results)) continue;
    for (const r of term.results) if (r?.active !== false && Number.isFinite(Number(r?.result))) out.push(Number(r.result));
  }
  return out;
}

/**
 * Натиск с полёта: База атаки «Натиск» (opts.baseKey диалога атаки — у
 * рукопашной rofMode всегда "melee") и персонаж в воздухе.
 */
export function isChargeFromFlight({ charge, altitude, inFlightAltitudes = [] } = {}) {
  return !!charge && inFlightAltitudes.includes(altitude);
}

/**
 * Какие кубики попадания предложить на замену: обычно один (первый
 * оставленный), у Хищника Небес на Натиске с полёта — до двух.
 * @param {number[]} activeResults
 * @param {{skyPredator?:boolean}} [opts]
 * @returns {number[]}
 */
export function swapDiceFor(activeResults, { skyPredator = false } = {}) {
  const n = skyPredator ? SKY_PREDATOR_DICE : 1;
  return (activeResults ?? []).slice(0, n);
}
