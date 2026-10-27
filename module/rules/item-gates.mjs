// module/rules/item-gates.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ВОРОТА ПРЕДМЕТА — два вопроса «действует ли эта запись предмета», на которые
//  отвечают и сборка правил (apps/effects.mjs, rules/mech-when.mjs), и прямой
//  скан Возможностей в rules/predicates.mjs.
//
//  Файл — ЛИСТ графа импортов: ни одного import. Прямой скан в predicates.mjs
//  живёт именно потому, что hasRuleFlag оттуда замкнул бы круг (collect.mjs →
//  sources.mjs → rage.mjs → predicates.mjs; AGENTS.md, «Источники правил»), а
//  значит спросить у apps/effects.mjs::isItemActive или mech-when.mjs::
//  entryWhenOk он не может. Раньше скан не знал ни «установлен ли имплант», ни
//  «какого он Качества»: Талант действует всегда, и вопрос не стоял. Когда
//  Талант Cold Fury пришёл от Модуля Агрессии (имплант, Качество Good и выше),
//  скан стал бы выдавать его Common-копии и копии из сумки. Одно правило —
//  одно место: оба вызывающих берут ответ отсюда, а не переписывают его.
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
