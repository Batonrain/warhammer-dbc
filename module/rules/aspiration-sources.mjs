// module/rules/aspiration-sources.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Откуда берутся Стремления для выбора на листе (Black Crusade, стр. 22).
//
//  Источников три, и все равноправны:
//    компендиум warhammer-dbc.aspirations — библиотека системы;
//    предметы-Стремления, заведённые в самом мире — то, что ГМ придумал за
//    столом и создал кнопкой «Создать предмет», не полезая в компендиум;
//    константы — запасной путь, когда компендиум ещё не прочитан.
//
//  Мир читался мимо: список собирался только из компендиума, и своё Стремление
//  просто не появлялось в выпадающем списке — ни ошибки, ни подсказки.
//
//  У предмета мира ключа обычно нет: ключи вида «pride:3» проставляет
//  библиотека, а руками их никто не пишет. Поэтому ключ достраивается из id —
//  он уникален и переживает переименование, а выбор на листе хранится именно
//  ключом.
//
//  Функции принимают готовые списки, а не лезут в game, — поэтому проверяются
//  без запуска Foundry.
// ════════════════════════════════════════════════════════════════════════════

/** Ключ Стремления, заведённого в мире: свой, если задан, иначе от id. */
export const WORLD_KEY_PREFIX = "world:";

export function worldAspirationKey(item) {
  const own = String(item?.system?.key || "").trim();
  return own || `${WORLD_KEY_PREFIX}${item?.id || item?._id || ""}`;
}

/** Предмет мира → запись списка, в том же виде, что даёт компендиум. */
export function worldAspirationEntry(item) {
  const s = item?.system ?? {};
  return {
    key:   worldAspirationKey(item),
    name:  item?.name || "",
    table: s.table || "",
    n:     s.n ?? null,
    mods:  s.mods || "",
    description: s.description || "",
    // Признак нужен листу: своё Стремление стоит отличать от книжного.
    world: true
  };
}

/**
 * Сводный список Стремлений таблицы. Библиотека идёт первой, за ней — своё:
 * привычный порядок книги не должен разъезжаться от того, что ГМ добавил
 * запись. Одинаковые ключи не задваиваются — побеждает библиотека.
 */
export function aspirationChoices(packEntries = [], worldItems = [], table = "") {
  const seen = new Set();
  const out = [];

  for (const entry of packEntries) {
    if (table && entry?.table !== table) continue;
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    out.push(entry);
  }

  for (const item of worldItems) {
    if (item?.type && item.type !== "aspiration") continue;
    const entry = worldAspirationEntry(item);
    if (table && entry.table !== table) continue;
    if (!entry.name || seen.has(entry.key)) continue;
    seen.add(entry.key);
    out.push(entry);
  }

  return out;
}

/** Поиск записи по ключу среди обоих источников — для показа выбранного. */
export function findAspiration(packEntries = [], worldItems = [], key = "") {
  if (!key) return null;
  return aspirationChoices(packEntries, worldItems).find(e => e.key === key) || null;
}
