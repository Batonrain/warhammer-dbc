// module/rules/psalm-unseen-fortress.mjs
//
// Техночудо «Psalm of the Unseen Fortress / Псалом Незримой Крепости»
// (Киберпсалмы, wdbc-173l): «Купол Рефрактора +2 аблативные Раны за Успех».
// Тип «Компенсатор» — не держится через system.sustained (см. notes самого
// предмета), активируется тестом Tech-Use как любое другое Техночудо
// (module/sheets/tabs/tech.mjs::activateTechMiracle) — на Успехе контрибуция
// ПЕРЕОФОРМЛЯЕТСЯ под степень успеха ЭТОЙ активации (не складывается между
// активациями — каждый цикл каста — новый Купол).
//
// «Атака, которую мог бы отразить Рефрактор, при непоглощ. уроне — урон до
// 1, остальное в аблативные Раны (нехватка — разница вместо 1)» — не
// смоделировано (нужен отдельный крюк в конвейере урона на «это удар,
// который отразил бы Рефрактор», вне объёма этого прохода).

import { itemHasName } from "./predicates.mjs";
import { itemIs } from "./item-marker.mjs";
import { replaceAblativeContribution, shrinkAblativeContributionToFit } from "./wounds.mjs";

const NAME = "Psalm of the Unseen Fortress";
export const PSALM_UNSEEN_FORTRESS_FLAG = "psalmUnseenFortressAblative";

/** Это Техночудо «Psalm of the Unseen Fortress / Псалом Незримой Крепости»? */
export function isPsalmUnseenFortressItem(item) {
  return itemIs(item, "techPower", "techPower.psalmUnseenFortress", NAME);
}

/** Успешная активация: контрибуция = 2×Успех (переоформляет прошлую). */
export function psalmUnseenFortressGrant(system, prevContribution, degreesOfSuccess) {
  const next = Math.max(0, 2 * (Number(degreesOfSuccess) || 0));
  const { ablative, ablativeMax, contribution } = replaceAblativeContribution(system, prevContribution, next);
  return { ablative, ablativeMax, contribution };
}

/**
 * Ресинк ПОСЛЕ того, как общий ablative пул уменьшился по другой причине
 * (поглощение урона) — см. module/rules/wounds.mjs::shrinkAblativeContributionToFit.
 */
export function psalmUnseenFortressShrinkToFit(system, prevContribution) {
  return shrinkAblativeContributionToFit(system, prevContribution);
}
