// module/rules/flight-speed.mjs
// ════════════════════════════════════════════════════════════════════════
//  Скорость в полёте — Черты Flyer (X) / Hoverer (X) (core.json, «Трейты»):
//  «Персонаж способен полноценно летать, используя SPD X вместо своей
//  обычной скорости, игнорируя модификаторы Размера». Сама механика полёта
//  (высоты, Смена Высоты, падение) — combat/movement-actions.mjs; здесь
//  только число X, которое подменяет базовый SPD, пока персонаж в воздухе
//  (rules/character/movement.mjs).
//
//  X бывает формулой («Flyer (A.b×2)» Гарпии, Крылья): тогда на Черте лежит
//  флаг ratingFormula (rules/trait-grant.mjs), и X считается от текущих
//  Бонусов, а не от числа, записанного при выдаче.
//
//  Без Foundry: предметы — простые объекты, имя — через rules/predicates.mjs.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { mechFormulaTotalSafe } from "./mech-formula.mjs";

export const RATING_FORMULA_FLAG = "ratingFormula";

/** Те же имена, что у гейта полёта (combat/movement-actions.mjs). */
const FLIGHT_SPEED_TRAIT_NAMES = ["Flyer", "Летун", "Летающий", "Hoverer", "Парящий"];
const FLIGHT_ITEM_TYPES = new Set(["trait", "vehicleTrait"]);

/** Рейтинг Черты «сейчас»: формула из флага — по rollData, иначе system.rating. */
export function liveTraitRating(item, rollData = {}) {
  const formula = item?.flags?.["warhammer-dbc"]?.[RATING_FORMULA_FLAG];
  if (formula) return mechFormulaTotalSafe(formula, rollData);
  return Number(item?.system?.rating) || 0;
}

/**
 * SPD в полёте: наибольший X среди Черт Flyer/Hoverer актора, или null, если
 * таких Черт нет (или ни у одной нет рейтинга — тогда подменять нечем).
 * @param {Iterable<object>} items
 * @param {object} rollData — mechRollData(actor)
 */
export function flightSpeedOf(items, rollData = {}) {
  let best = null;
  for (const item of items ?? []) {
    if (!FLIGHT_ITEM_TYPES.has(item?.type)) continue;
    if (!FLIGHT_SPEED_TRAIT_NAMES.some(n => itemHasName(item, n))) continue;
    const x = liveTraitRating(item, rollData);
    if (x > 0 && (best === null || x > best)) best = x;
  }
  return best;
}

// ── Рытьё: Burrower / Бурильщик (X) (корбук, «Трейты», 19.11.2026) ──────────
//  «Прокапывает тоннели сквозь землю/камень со скоростью SPD×X, игнорируя
//  модификаторы Размера». Отдельного режима движения под землёй в системе
//  нет — лист показывает скорость рытья рядом с Полётом, считает её сам:
//  SPD без Размера (Ag.b, не ниже 0.5) × X.
/** Наибольший X Черт Burrower актора; null — Черты нет (или без рейтинга). */
export function burrowRatingOf(items, rollData = {}) {
  let best = null;
  for (const item of items ?? []) {
    if (!FLIGHT_ITEM_TYPES.has(item?.type)) continue;
    // Имена литералами — так их видит замер (tools/capability-reachability.mjs).
    if (!itemHasName(item, "Burrower") && !itemHasName(item, "Бурильщик")) continue;
    const x = liveTraitRating(item, rollData);
    if (x > 0 && (best === null || x > best)) best = x;
  }
  return best;
}

/** SPD рытья: (Ag.b без Размера, минимум 0.5) × X; null — Черты нет. */
export function burrowSpeedOf(items, agBonus, rollData = {}) {
  const x = burrowRatingOf(items, rollData);
  if (x === null) return null;
  const spd = (Number(agBonus) || 0) <= 0 ? 0.5 : Number(agBonus);
  return spd * x;
}
