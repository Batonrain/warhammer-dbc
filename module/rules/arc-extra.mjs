// module/rules/arc-extra.mjs
//
// Дополнения свойства Дуга для Электродуги Best.Q (wdbc-3hgd0): Пробитие дуг
// и цепная дуга. Отдельно от combat/arc.mjs — тот тянет геометрию сцены
// (facing → регионы), а эти помощники нужны и карточке атаки, и тестам без
// Foundry. Чистая логика.

/**
 * Доп. атрибуты кнопки Дуги (wdbc-3hgd0, Электродуга Best.Q): Пробитие дуг и
 * цепная дуга. Пусто, если у атаки их нет — кнопка как раньше.
 */
export function arcExtraAttrs(wp) {
  let out = "";
  if (wp?.arcPen != null) out += ` data-arc-pen="${Number(wp.arcPen) || 0}"`;
  if (wp?.arcChainRating > 0) out += ` data-arc-chain-rating="${wp.arcChainRating}" data-arc-chain-damage="${wp.arcChainDamage}"`;
  return out;
}

/**
 * Сколько новых дуг выпускает бросок урона дуги с цепной Дугой (X/…): по одной
 * на каждый кубик, выбросивший X+ (книга, «Arc (X/Y)»: «если несколько кубиков
 * выбрасывают X+, дуга выпускается за каждый»).
 * @param {number[]} dieResults результаты кубиков броска урона дуги
 */
export function chainArcCount(dieResults, chainRating) {
  const x = Number(chainRating) || 0;
  if (x <= 0) return 0;
  return (dieResults ?? []).filter(v => Number(v) >= x).length;
}

/** Список id уже поражённых дугами этой атаки (из data-атрибута кнопки). */
export function parseArcHitIds(raw) {
  return String(raw ?? "").split(",").map(s => s.trim()).filter(Boolean);
}
