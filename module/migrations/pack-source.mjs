// module/migrations/pack-source.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Что об этом предмете актора говорит пак» — общее для миграций, которые
//  догоняют уже выданные копии до поправленной записи пака (rad-rating.mjs,
//  retinal-display-mark.mjs).
//
//  Сопоставление то же, что у «Обновить мир» (apps/content-sync.mjs): сперва
//  uuid источника (_stats.compendiumSource, у старых копий flags.core.sourceId),
//  затем имя того же типа — целиком и любой половиной двуязычного «A / Б».
//
//  Отличие от content-sync — НЕОДНОЗНАЧНОСТЬ. Там совпадение половины имени у
//  двух документов молча решает последний (byTypeName.set поверх). Миграции
//  ГМ не видит и не подтверждает, поэтому здесь половина имени, под которой в
//  паке лежат РАЗНЫЕ ответы, не решает ничего: граната «Rad / Рад» (Рад 2d10)
//  и ракета «Rad / Ракета: Рад» (Рад 4d10) обе отзываются на «Rad», и копия с
//  именем просто «Rad» осталась бы с чужим рейтингом. Одинаковый ответ —
//  не помеха (Радиевая Джезайл лежит и в weapons, и в vehicle-weapons с тем же
//  1d10).
// ════════════════════════════════════════════════════════════════════════════

import { nameKeys, sameValue } from "../apps/content-sync.mjs";

/** Метка «под этим именем в паке разные ответы» — не решает ничего. */
const AMBIGUOUS = Symbol("ambiguous");

/** uuid компендиума-источника копии, если он известен. */
export function sourceUuidOf(item) {
  return item?._stats?.compendiumSource || item?.flags?.core?.sourceId || "";
}

/**
 * Индекс ответов пака: «тип::uuid» → ответ и «тип::имя» → ответ (или AMBIGUOUS).
 * `valueOf(doc)` — что миграции нужно знать о документе; документы, которые
 * её не касаются, тоже идут в индекс (со своим ответом, обычно null): иначе
 * половина имени, общая у нужного и постороннего документа, выглядела бы
 * однозначной.
 */
export function buildSourceIndex(docs, valueOf) {
  const byUuid = new Map();
  const byName = new Map();
  for (const doc of docs ?? []) {
    const value = valueOf(doc);
    // Тип и в ключе uuid: копия, сменившая тип относительно источника, — уже
    // не тот предмет, и ответ его записи к ней не относится.
    if (doc?.uuid) byUuid.set(`${doc.type}::${doc.uuid}`, value);
    for (const k of nameKeys(doc?.name)) {
      const key = `${doc.type}::${k}`;
      if (!byName.has(key)) byName.set(key, value);
      else if (byName.get(key) !== AMBIGUOUS && !sameValue(byName.get(key), value)) byName.set(key, AMBIGUOUS);
    }
  }
  return { byUuid, byName };
}

/**
 * Ответ пака для копии: по uuid источника, иначе по имени того же типа
 * (сперва целиком, потом половинами). Неоднозначная половина пропускается —
 * может решить другая. Не нашлось — undefined.
 */
export function packValueFor(item, index) {
  const src = sourceUuidOf(item);
  if (src && index.byUuid.has(`${item.type}::${src}`)) return index.byUuid.get(`${item.type}::${src}`);
  for (const k of nameKeys(item?.name)) {
    const key = `${item.type}::${k}`;
    if (!index.byName.has(key)) continue;
    const value = index.byName.get(key);
    if (value !== AMBIGUOUS) return value;
  }
  return undefined;
}
