// module/rules/testudo.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Тестудо (Талант Механикус; Разобрать tfgq9). Книга: «За смену работы (без
//  теста) персонаж может модифицировать щит для установки на мехадендрите.
//  Щит на дендрите прикрывает персонажа как на руке (но им нельзя атаковать/
//  Парировать). Можно активно использовать щиты на до ½WS.b (окр.▲)
//  мехадендритов одновременно.»
//
//  Щит на дендрите — флаг dendriteMounted на самом щите. Такой щит не занимает
//  руку (rules/hands.mjs::weaponHandsRequired), не годится для Парирования
//  (combat/equipped-melee.mjs) и атаки (sheets/attack/dialog.mjs), а AP даёт
//  как обычно (combat/hand-shield.mjs читает только equipped).
//  Сектор прикрытия при Смене Стойки система не моделирует — щиты без
//  секторов, это осталось в «Разобрать».
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

export const DENDRITE_SHIELD_FLAG = "dendriteMounted";

const isShield = item => item?.type === "weapon" && item.system?.shieldAP != null;

/** Щит установлен на мехадендрит. */
export function isDendriteShield(item) {
  if (!isShield(item)) return false;
  return !!(item.flags?.["warhammer-dbc"]?.[DENDRITE_SHIELD_FLAG] ?? item.getFlag?.("warhammer-dbc", DENDRITE_SHIELD_FLAG));
}

/** Есть ли у персонажа Талант Тестудо. */
export function hasTestudo(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, "Testudo"));
}

/** Сколько щитов на дендритах можно держать активными: ½WS.b с округлением вверх. */
export function testudoShieldCap(actor) {
  const wsb = Math.max(0, Number(actor?.system?.characteristics?.ws?.bonus) || 0);
  return Math.ceil(wsb / 2);
}

/**
 * Почему щит нельзя поставить на дендрит ("" — можно). Снимать можно всегда.
 * Нужны Тестудо и свободный «слот» до ½WS.b среди экипированных щитов на дендритах.
 */
export function testudoMountBlock(actor, item) {
  if (!isShield(item)) return "это не щит";
  if (isDendriteShield(item)) return "";
  if (!hasTestudo(actor)) return "нужен Талант Testudo";
  const cap = testudoShieldCap(actor);
  const mounted = [...(actor?.items ?? [])].filter(i => i !== item && isDendriteShield(i) && i.system?.equipped).length;
  if (item.system?.equipped && mounted + 1 > cap) return `щитов на мехадендритах не больше ½WS.b (${cap})`;
  return "";
}

/** Экипированных щитов на дендритах больше предела — подсветка на листе. */
export function testudoOverCap(actor) {
  const mounted = [...(actor?.items ?? [])].filter(i => isDendriteShield(i) && i.system?.equipped).length;
  return mounted > testudoShieldCap(actor);
}
