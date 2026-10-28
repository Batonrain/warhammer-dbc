// module/rules/item-gates.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ВОРОТА ПРЕДМЕТА — два вопроса «действует ли эта запись предмета», на которые
//  отвечают и сборка правил (apps/effects.mjs::isItemActive, rules/mech-when.mjs::
//  entryWhenOk), и всё, что обязано отвечать так же, не импортируя их.
//
//  Файл — ЛИСТ графа импортов: ни одного import. Одно правило — одно место:
//  «имплант установлен, не отключён и не подавлен» и «Качество подходит записи»
//  не переписываются в каждом читателе (разошлись бы при первой правке).
// ════════════════════════════════════════════════════════════════════════════

/**
 * Имплант действует: установлен, не отключён и не подавлен полем Дискорданта.
 * nullSuppressed — электроника в поле Дискорданта (rules/null-zones.mjs,
 * apps/mechanics.mjs::syncNullZoneSuppression).
 */
export function isImplantActive(item) {
  return !!item?.getFlag?.("warhammer-dbc", "installed")
    && !item.getFlag("warhammer-dbc", "disabled")
    && !item.getFlag("warhammer-dbc", "nullSuppressed");
}

/**
 * Гейт «Качество предмета» записи Конструктора (entry.when.quality, с
 * отрицанием when.negateQuality). Пустой список — гейта нет, запись проходит.
 * Непроставленное Качество — «Обычное», как в схемах предметов.
 */
export function entryQualityOk(entry, item) {
  const quals = (entry?.when?.quality || []).filter(Boolean);
  if (!quals.length || !item) return true;
  const matches = quals.includes(item.system?.quality || "common");
  return entry.when.negateQuality ? !matches : matches;
}
