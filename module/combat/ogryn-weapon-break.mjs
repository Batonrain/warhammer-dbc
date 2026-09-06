// module/combat/ogryn-weapon-break.mjs
//
// «Огрин при рукопашной атаке оружием без свойства Ogrynized бросает 1d10: на
// 1-3 оно ломается до починки за ½ смены» (constants/weapon-properties.mjs,
// свойство ogryned; Черта расы «Brute Physiology / Физиология Громилы»).
//
// Почему это не живёт в rules/ogryn-fit.mjs рядом со штрафами: там —
// МОДИФИКАТОР теста, он считается ДО броска и входит в порог. Здесь — бросок
// ПОСЛЕ атаки, со своим кубом и своим последствием на предмете. Смешивать их
// в одном расчёте значило бы, что «сколько к попаданию» и «сломалось ли»
// считаются одним числом, а это разные вопросы.
//
// Ломается ли оружие, НЕ зависит от того, попал Огрин или промахнулся: он
// ломает рукоять просто тем, что бьёт человеческим оружием.
//
// Состояние — то же system.destroyed, что ставит Reformation Song
// (combat/reformation-song.mjs): отдельного «сломано, чинится ½ смены» в схеме
// нет, а заводить второе поле под то же самое («предметом нельзя пользоваться,
// пока не починят») — плодить состояния. Время починки живёт в тексте карточки:
// система не считает смены, их отыгрывает ГМ.

import { OGRYN_FIT_FLAG } from "../rules/ogryn-fit.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";

/** Грани 1d10, на которых оружие ломается. */
export const OGRYN_BREAK_FACES = [1, 2, 3];

/** Сколько времени занимает починка — только для текста, система смены не считает. */
export const OGRYN_BREAK_REPAIR = "½ смены";

/**
 * Ломается ли оружие в этой атаке — чистая проверка, без Foundry.
 *
 * @param {object}  o
 * @param {boolean} o.fitsOgryn     носитель сложен под огринское оружие
 * @param {boolean} o.hasOgrynized  у оружия есть свойство Ogrynized
 * @param {boolean} o.isMelee       атака рукопашная (стрелковая не ломает)
 * @param {number}  o.d10           выпавшее на 1d10
 */
export function ogrynBreaksWeapon({ fitsOgryn = false, hasOgrynized = false,
                                    isMelee = false, d10 = 0 } = {}) {
  if (!fitsOgryn || hasOgrynized || !isMelee) return false;
  return OGRYN_BREAK_FACES.includes(Number(d10));
}

/** Нужен ли вообще бросок — чтобы не катать куб там, где он ничего не решает. */
export function ogrynBreakApplies({ actor, item, isMelee, hasOgrynized } = {}) {
  return !!isMelee && !hasOgrynized && hasRuleFlag(actor, OGRYN_FIT_FLAG);
}

/**
 * Катит 1d10 и, если выпало 1-3, помечает оружие сломанным.
 * Возвращает { roll, broken } либо null, когда бросок не требуется.
 */
export async function rollOgrynWeaponBreak({ actor, item, isMelee, hasOgrynized } = {}) {
  if (!ogrynBreakApplies({ actor, item, isMelee, hasOgrynized })) return null;
  // Уже сломанным оружием и так бить нечем — второй раз не ломаем.
  if (item?.system?.destroyed) return null;

  const roll = await new Roll("1d10").evaluate();
  const broken = ogrynBreaksWeapon({
    fitsOgryn: true, hasOgrynized: false, isMelee: true, d10: roll.total
  });
  if (broken) await item.update({ "system.destroyed": true });
  return { roll, broken };
}

/** Строка для карточки атаки — что именно произошло с оружием. */
export function ogrynBreakNote(result, weaponName = "") {
  if (!result) return "";
  const name = weaponName || "Оружие";
  return result.broken
    ? `🪨 ${name}: не выдержало огринской хватки — <b>1d10 = ${result.roll.total}</b> (1-3). Сломано до починки (${OGRYN_BREAK_REPAIR}).`
    : `🪨 ${name}: огринская хватка на этот раз пощадила — <b>1d10 = ${result.roll.total}</b> (ломается на 1-3).`;
}
