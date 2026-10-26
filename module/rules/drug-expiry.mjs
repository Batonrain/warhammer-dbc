// module/rules/drug-expiry.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Срок действия препарата по игровому времени (Sahara task-3ab7, п.5).
//
//  Книга меряет действие препаратов то Раундами, то минутами и часами, а
//  текстовое поле `duration` одной строкой («60», «1d5», «2*Per.b») не говорит,
//  чем именно. Поэтому автоматически считается только то, что задано явно —
//  числовым полем `gameMinutes` (минуты игрового времени; Струп — «в течение
//  1 часа», стр. 284). Остальные препараты остаются на ручной кнопке «Эффект
//  завершён», как раньше.
//
//  Момент конца — worldTime в секундах — пишется при приёме в
//  `activeEffect.expiresAt` (поле существовало в схеме, но не заполнялось), а
//  часы Календаря (combat/drug-expiry.mjs, список CONDITION_CLOCK_HANDLERS)
//  снимают препарат, когда отметка достигнута. Чистая арифметика — здесь, без
//  Foundry.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Отметка конца действия: worldTime приёма + срок. null — срока по часам нет
 * (поле не задано, ноль, мусор или отрицательное): ноль нельзя возвращать как
 * «нет», нулевая отметка времени мира — настоящий момент.
 * @param {{gameMinutes?: *}} system  system препарата
 * @param {number} now  worldTime приёма, секунды
 */
export function expiryAtFor(system, now) {
  const minutes = Number(system?.gameMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return (Number(now) || 0) + Math.round(minutes * 60);
}

/**
 * Препараты, чей срок вышел к моменту `to`: действуют (не пост-эффект), отметка
 * стоит и достигнута. Идущий пост-эффект и снятые не берутся — второй раз
 * препарат закончиться не может.
 * @param {Iterable<object>} items
 * @param {number} to  worldTime, секунды
 */
export function dueDrugs(items, to) {
  const now = Number(to);
  return [...(items ?? [])].filter(i => {
    if (i?.type !== "drug") return false;
    const fx = i.system?.activeEffect;
    if (!fx?.isActive || fx.isAfterEffect) return false;
    const at = fx.expiresAt;
    return at != null && Number.isFinite(Number(at)) && now >= Number(at);
  });
}
