// module/rules/daemonic-dread.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Демонический Ужас — штраф к W, который аура «Демоническое Присутствие X/Y»
//  выдаёт врагам в радиусе Y (dbc-114 / 55-15, 13.11.2026).
//
//  Штраф в системе живёт ступенями: четыре предмета-Черты «Daemonic Dread
//  (−5/−10/−15/−20 W)» в паке traits. Аура клонирует такой предмет на цель
//  (regions/auras.mjs), а rescaleTraitByRating их не масштабирует (знак: рейтинг
//  шаблона положительный, эффект отрицательный). Поэтому Присутствие «X/Y»,
//  заведённое с любым X, выбирает НУЖНУЮ ступень: ближайшая кратная 5, не меньше
//  5 и не больше 20. Книжные Присутствия — 5/10/15 и +5 ступенями (minion-traits).
//  Больше −20 не бывает: X больше 20 даёт −20, не молча ничего.
// ═══════════════════════════════════════════════════════════════════════════

const PACK = "Compendium.warhammer-dbc.traits.Item.";

/** Ступень штрафа → _id предмета «Daemonic Dread (−N W)» в паке traits. */
export const DREAD_ITEM_IDS = {
  5:  "SxSFc0ZvfPcEDRou",
  10: "Pf64LnfXpbWfQ8Xb",
  15: "k1iY8B9KJDsNm46k",
  20: "0EJlhdTiTNo5DRqs"
};

const DREAD_UUIDS = new Set(Object.values(DREAD_ITEM_IDS).map(id => PACK + id));

/** Это uuid одного из предметов «Daemonic Dread»? */
export const isDreadUuid = uuid => DREAD_UUIDS.has(String(uuid ?? ""));

/** Ближайшая ступень штрафа (5/10/15/20) для X; 0 и нечисло — null (штрафа нет). */
export function dreadTier(x) {
  const n = Math.round(Number(x));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(20, Math.max(5, Math.round(n / 5) * 5));
}

/**
 * Какой предмет Ужаса выдавать: uuid записи заменяется на ступень по X, но
 * только если запись и так указывает на один из Ужасов, а X задан (> 0).
 * Любой другой uuid или пустой X — как есть: готовые существа бестиария с
 * фиксированным Ужасом остаются нетронутыми.
 */
export function dreadUuidForRating(sourceUuid, x) {
  if (!isDreadUuid(sourceUuid)) return sourceUuid;
  const tier = dreadTier(x);
  return tier ? PACK + DREAD_ITEM_IDS[tier] : sourceUuid;
}
