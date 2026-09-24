// module/rules/integral-rating.mjs
// ════════════════════════════════════════════════════════════════════════
//  Интегральная атака из Черты с рейтингом (wdbc-o368c).
//
//  Черты «Укус (X)», «Естественное Оружие (X)», «Смертельное Естественное
//  Оружие (X)» (core.json) выдают оружие, чей профиль зависит от X самой
//  Черты: «1d10+X R», у Смертельного ещё и «Pen X». Оружие-образец в паке
//  (packs-src/weapons/Интегральные_атаки) хранит урон буквально с «X», а
//  Пробитие от рейтинга помечает флагом penetrationFromRating — числовое
//  поле penetration букву не удержит. Выданная копия получает конкретные
//  числа и помнит образец (ratingTemplate), чтобы пересчитаться, когда
//  рейтинг Черты поменяют на листе.
//
//  Второе: «по выбору» (entry.equipOptional). Естественное Оружие даёт
//  «один из следующих профилей» НА КАЖДОЕ естественное оружие существа —
//  у Кровопускателя их три (Когти, Укус, Рога). Все записи integralAttack
//  предмета с equipOptional собираются в одно окно с галочками при
//  получении; выбор помнится флагом источника (INTEGRAL_CHOSEN_FLAG), и
//  пересинхронизация выдаёт только выбранное, не переспрашивая.
//
//  Без Foundry: только данные (имя предмета — через rules/predicates.mjs).
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

export const INTEGRAL_CHOSEN_FLAG = "integralChosen";
export const RATING_TEMPLATE_FLAG = "ratingTemplate";

/** Рейтинг источника, если он у него есть (hasRating), иначе null. */
export function sourceRating(sourceSystem) {
  if (!sourceSystem?.hasRating) return null;
  return Number(sourceSystem.rating) || 0;
}

/** Образец профиля из оружия пака — или null, если от рейтинга ничего не зависит. */
export function ratingTemplateOf(weaponSystem, weaponFlags = {}) {
  const damage = String(weaponSystem?.damage ?? "");
  const dmgX = /\bX\b/.test(damage);
  const penX = !!weaponFlags?.penetrationFromRating;
  if (!dmgX && !penX) return null;
  return { damage, penetrationFromRating: penX };
}

/** Профиль копии по образцу и рейтингу: { damage, penetration? }. */
export function applyRatingTemplate(template, rating) {
  if (!template) return {};
  const r = Number(rating) || 0;
  const out = { damage: String(template.damage).replace(/\bX\b/g, String(r)) };
  if (template.penetrationFromRating) out.penetration = r;
  return out;
}

/** Записи integralAttack «по выбору» (включая вложенные И-подгруппы). */
export function optionalIntegralEntries(groups) {
  const out = [];
  const walk = (entries, operator) => {
    if (operator === "OR") return;
    for (const e of entries || []) {
      if (e.kind === "integralAttack" && e.equipOptional && e.equipSourceUuid) out.push(e);
      else if (e.kind === "group" && e.group) walk(e.group.entries, e.group.operator);
    }
  };
  for (const g of groups || []) walk(g.entries, g.operator);
  return out;
}

/**
 * Проходит ли запись integralAttack в выдачу: обычная — всегда, «по выбору» —
 * только отмеченная в окне (chosen — массив id записей или undefined, если
 * вопрос ещё не задавался: тогда не выдаём, окно спросит).
 */
export function integralEntrySelected(entry, chosen) {
  if (!entry?.equipOptional) return true;
  return Array.isArray(chosen) && chosen.includes(entry.id);
}

// ── Укус только в Борьбе ────────────────────────────────────────────────
// Черта «Укус (X)» (core.json): атаку «можно использовать только в Борьбе»;
// «если у него есть атака укусом от другого источника, он может ...
// атаковать укусом как часть обычной атаки». Оружие-образец несёт флаг
// grappleOnly: приём Борьбы «Укус» (combat/grapple.mjs::_doBite) находит его
// по имени как обычно, а HUD и вкладка БОЙ не показывают, пока у персонажа
// нет второго укуса без этого флага (Естественное Оружие: Укус и т.п.).

const NS = "warhammer-dbc";

function isGrappleOnly(item) {
  return !!(item?.getFlag?.(NS, "grappleOnly") ?? item?.flags?.[NS]?.grappleOnly);
}

/** Оружие-укус по имени (обе половины двуязычного имени, как combat/grapple.mjs::isBiteWeapon). */
export function isBiteName(item) {
  return itemHasName(item, "Укус") || itemHasName(item, "Bite");
}

/** Прятать ли оружие из обычных списков атак (HUD, вкладка БОЙ). */
export function grappleOnlyHidden(item, items, isBite) {
  if (!isGrappleOnly(item)) return false;
  return ![...(items ?? [])].some(o => o !== item && o?.type === "weapon" && isBite(o) && !isGrappleOnly(o));
}
