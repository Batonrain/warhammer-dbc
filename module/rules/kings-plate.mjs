// module/rules/kings-plate.mjs
//
// Талант «King's Plate / Латы Короля» (Элитный архетип: Король Червей,
// wdbc-173l): «поглощает один Рой в базовом контакте: рой уничтожается,
// персонаж получает ... аблативные Раны, равные Ранам поглощённого Роя».
//
// В этой системе у Орды (module/data/actor/horde.mjs) НЕТ поля Wounds вообще
// — вместо Ран у неё Магнитуда (system.magnitude.value, «сколько существ
// осталось»). Домашний Талант (bookSource: не из официальной книги) читаем
// как «Магнитуда поглощённого Роя» — ближайший аналог «его Ран» в этой
// модели данных. Складывается с прошлыми поглощениями (в тексте нет ни слова
// про потолок/замену, в отличие от Blood Shield) — используется тот же
// replaceAblativeContribution, что и везде, просто со ЗНАЧЕНИЕМ
// prev+добавка, не пересчитанным с нуля.

import { itemHasName } from "./predicates.mjs";
import { replaceAblativeContribution, shrinkAblativeContributionToFit } from "./wounds.mjs";

const NAME = "King's Plate";
export const KINGS_PLATE_FLAG = "kingsPlateAblative";

/** Это Талант «King's Plate / Латы Короля»? */
export function isKingsPlateItem(item) {
  return item?.type === "talent" && itemHasName(item, NAME);
}

/**
 * Поглощение одного Роя: аблатив += Магнитуда Роя (складывается с прошлыми
 * поглощениями, потолка в тексте нет).
 *
 * @param {object} system            actor.system получателя (ДО применения)
 * @param {number} prevContribution  флаг KINGS_PLATE_FLAG получателя
 * @param {number} swarmMagnitude    system.magnitude.value поглощаемого Роя
 * @returns {{ablative:number, ablativeMax:number, contribution:number, granted:number}|null}
 *   null — Магнитуда Роя ≤ 0, поглощать нечего
 */
export function kingsPlateGrant(system, prevContribution, swarmMagnitude) {
  const add = Math.max(0, Number(swarmMagnitude) || 0);
  if (add <= 0) return null;
  const prev = Math.max(0, Number(prevContribution) || 0);
  const { ablative, ablativeMax, contribution } =
    replaceAblativeContribution(system, prev, prev + add);
  return { ablative, ablativeMax, contribution, granted: add };
}

/**
 * Ресинк ПОСЛЕ того, как общий ablative пул уменьшился по другой причине
 * (поглощение урона) — см. module/rules/wounds.mjs::shrinkAblativeContributionToFit.
 */
export function kingsPlateShrinkToFit(system, prevContribution) {
  return shrinkAblativeContributionToFit(system, prevContribution);
}
