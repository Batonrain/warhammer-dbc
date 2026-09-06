// module/rules/eternal-war.mjs
//
// Талант «The Eternal War / Вечная Война» (Элитный архетип: Принц Кхейна,
// wdbc-173l): «Сражаясь против Кровожада или Хранителя Секретов, персонаж
// ... получает +3×T.b аблативных ран до конца битвы с ним ...».
//
// Условие («сражается именно против Кровожада/Хранителя Секретов») не имеет
// в системе программной проверки — нет ни трейта «это Кровожад», ни списка
// типов демонов-принцев по имени, надёжного для сверки. GM/игрок подтверждает
// момент кнопкой (тот же приём, что «Активация щита Робы Чемпиона» —
// wdbc-bxw6), код считает только магнитуду и снятие по «конец битвы».
//
// Не смоделировано (честно): подъём одной Unnatural Characteristic до
// значения трейта противника, T.b невосстанавливаемых Очков Судьбы, изгнание
// души в варп смертельным ударом — компаунд-бонусы вне объёма прохода.

import { itemHasName } from "./predicates.mjs";
import { itemIs } from "./item-marker.mjs";
import { replaceAblativeContribution, shrinkAblativeContributionToFit } from "./wounds.mjs";

const NAME = "The Eternal War";
export const ETERNAL_WAR_FLAG = "eternalWarAblative";

/** Это Талант «The Eternal War / Вечная Война»? */
export function isEternalWarItem(item) {
  return itemIs(item, "talent", "talent.eternalWar", NAME);
}

/**
 * Начало дуэли с Кровожадом/ХС: контрибуция = 3×T.b (одноразовая величина,
 * не складывается с прошлыми — RAW описывает ОДНУ дуэль за раз).
 */
export function eternalWarGrant(system, prevContribution, tBonus) {
  const next = Math.max(0, 3 * (Number(tBonus) || 0));
  const { ablative, ablativeMax, contribution } = replaceAblativeContribution(system, prevContribution, next);
  return { ablative, ablativeMax, contribution };
}

/** Конец битвы с этим противником — «до конца битвы с ним» истекло. */
export function eternalWarClear(system, prevContribution) {
  const prev = Math.max(0, Number(prevContribution) || 0);
  if (prev <= 0) return null;
  const { ablative, ablativeMax, contribution } = replaceAblativeContribution(system, prev, 0);
  return { ablative, ablativeMax, contribution };
}

/**
 * Ресинк ПОСЛЕ того, как общий ablative пул уменьшился по другой причине
 * (поглощение урона) — см. module/rules/wounds.mjs::shrinkAblativeContributionToFit.
 */
export function eternalWarShrinkToFit(system, prevContribution) {
  return shrinkAblativeContributionToFit(system, prevContribution);
}
