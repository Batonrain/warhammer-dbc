// module/rules/scrounge.mjs
// ════════════════════════════════════════════════════════════════════════
//  Scrounge / Наскрести — Черта Архетипа Изгой. Книга: «Изгой может
//  потратить смену работы и Очко Бесчестия, чтобы добыть где-то 2d10
//  расходных материалов (магазинов боеприпасов, гранат, химии и т.п.) до
//  R2, украв, выбив силой у кого-то, или найдя клад. Когда у него есть
//  излишки расходников, ГМ может потребовать, чтобы Изгой время от времени
//  прятал часть в клады «на черный день».»
//
//  Чистая часть: бросок, потолок Редкости и категории, из которых Обозреватель
//  компендиумов отдаёт добычу (apps/scrounge.mjs). «И т.п.» книги — три
//  названные категории; прочее ГМ добавит руками. «Клады на черный день» —
//  решение ГМа, остаётся текстом.
// ════════════════════════════════════════════════════════════════════════

export const SCROUNGE_DICE = "2d10";

/** «до R2» — тот же потолок maxAvailability, что у выдачи Архетипов (R1 → 1). */
export const SCROUNGE_MAX_AVAILABILITY = 2;

/**
 * Категории расходников. folderIds — папки пака weapons (Имперское →
 * Стрелковое → Гранаты / Бомбы), те же, что у выдачи Изгоя «8 Гранат или Бомб».
 */
export const SCROUNGE_CATEGORIES = [
  { key: "ammo",     label: "Магазины боеприпасов", pack: "ammunition" },
  { key: "grenades", label: "Гранаты и бомбы",      pack: "weapons", folderIds: ["CiKyTXQv7N6C3J3A", "1F41DWSJB405tFwp"] },
  { key: "chem",     label: "Химия",                pack: "chemistry" }
];

/** Остаток добычи после очередного выбора (не ниже нуля). */
export function scroungeRemaining(total, taken) {
  return Math.max(0, (Number(total) || 0) - (Number(taken) || 0));
}

/** Фильтры Обозревателя для категории. */
export function scroungeFilters(category) {
  const filters = { maxAvailability: SCROUNGE_MAX_AVAILABILITY };
  if (category?.folderIds?.length) filters.folderId = [...category.folderIds];
  return filters;
}
