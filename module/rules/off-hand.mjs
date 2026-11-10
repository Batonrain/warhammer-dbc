// module/rules/off-hand.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Штраф за неосновную руку при Парировании (книга, свойство Defensive:
//  «Тесты на Парирование с ним получают бонус +15 и не получают штрафа −20 за
//  неосновную руку»). Парирование оружием в неосновной руке — −20.
//
//  Основная рука — system.mainHand ("right" по умолчанию, "left" у левшей),
//  выбирается на листе (вкладка боя, панель «Стойка»). Рука оружия — heldHand
//  (rules/hands.mjs). Штрафа нет, если:
//    • рука оружия не назначена (одиночное оружие руку не форсирует);
//    • оружие двуручное (занимает обе руки);
//    • оружие в основной руке;
//    • у оружия свойство Defensive (в т.ч. ручные щиты — это Defensive-оружие);
//    • у персонажа Талант Амбидекстр (снимает штраф неосновной руки целиком).
//  Тот же штраф −20 действует на все тесты атаки WS/BS оружием в неосновной руке
//  (offHandAttackPenalty; Defensive его не снимает). Штраф второй руки при паре
//  оружий считает rules/dual-wield.mjs — в парной атаке он не задваивается.
// ════════════════════════════════════════════════════════════════════════════

import { getHeldHand, weaponHandsRequired } from "./hands.mjs";
import { hasRuleFlag } from "./flags.mjs";
import { CAP_AMBIDEXTROUS, OFF_HAND_PENALTY } from "./dual-wield.mjs";

/** Основная рука актора: "left" | "right" (по умолчанию правая). */
export function mainHandOf(actor) {
  return actor?.system?.mainHand === "left" ? "left" : "right";
}

/** Штраф неосновной руки вообще применим к этому оружию (без учёта Defensive — тот касается только Парирования). */
function offHandApplies(actor, weapon) {
  const hand = getHeldHand(weapon);
  if (hand !== "left" && hand !== "right") return false;
  if (weaponHandsRequired(weapon, actor) >= 2) return false;
  if (hand === mainHandOf(actor)) return false;
  if (hasRuleFlag(actor, CAP_AMBIDEXTROUS)) return false;
  return true;
}

/**
 * Штраф к тестам атаки (WS/BS) оружием в неосновной руке: −20, если нет Амбидекстра и оружие
 * не двуручное. Свойство Defensive его НЕ снимает (оно снимает только штраф Парирования).
 * Парная атака двумя оружиями считает этот штраф сама для второй руки (rules/dual-wield.mjs).
 * @returns {{value:number, label:string}}
 */
export function offHandAttackPenalty(actor, weapon) {
  return offHandApplies(actor, weapon) ? { value: OFF_HAND_PENALTY, label: "неосновная рука" } : { value: 0, label: "" };
}

/**
 * Поправка к порогу Парирования за неосновную руку.
 * @param {object} actor      парирующий
 * @param {object} weapon     парирующее оружие
 * @param {object} [pwp]      агрегат свойств этого оружия (aggregateAuto) — нужен Defensive
 * @returns {{value:number, label:string}} value 0 — штрафа нет
 */
export function offHandParryPenalty(actor, weapon, pwp = {}) {
  if (pwp?.defensive || !offHandApplies(actor, weapon)) return { value: 0, label: "" };
  return { value: OFF_HAND_PENALTY, label: "неосновная рука" };
}
