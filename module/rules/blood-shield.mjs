// module/rules/blood-shield.mjs
//
// Талант «Blood Shield / Кровавый Щит» (Элитный архетип: Кузнец Крови,
// wdbc-173l): «Убивая врага рукопашной атакой демонического оружия с
// порабощённым демоном, получает W.b демона аблативных Ран (складываются до
// максимума W.b×2)».
//
// Демон-оружие уже несёт нужные поля (module/data/item/weapon.mjs):
// system.daemonWeapon.bound — демон связан вообще, .subdued — «порабощён»
// (RAW-условие), .demonWb — его Бонус Силы Воли — искать источник W.b не
// нужно, он уже лежит на оружии.
//
// НЕ смоделировано (честно, тем же приёмом, что Reactive Plates/Reformation
// Song — wdbc-bxw6): тест W+0 в конце Хода без убийства (иначе теряет ВСЕ
// эти аблативные Раны), складывающийся штраф −10/−20/−30 за подряд идущие
// Ходы без убийств. В системе нет «слежения за убийствами в этом Ходу» и
// нет крюка «конец Хода этого актора» вообще (в отличие от «конец Раунда»,
// которым живёт декей щита Робы Чемпиона) — GM-адъюдикация: кнопка только
// считает магнитуду гранта на killed-событие, тест на сохранение — за столом.

import { itemHasName } from "./predicates.mjs";
import { replaceAblativeContribution, shrinkAblativeContributionToFit } from "./wounds.mjs";

const NAME = "Blood Shield";
export const BLOOD_SHIELD_FLAG = "bloodShieldAblative";

/** Это Талант «Blood Shield / Кровавый Щит»? */
export function isBloodShieldItem(item) {
  return item?.type === "talent" && itemHasName(item, NAME);
}

/** Демон-оружие с порабощённым (subdued) демоном — RAW-условие триггера. */
export function isSubduedDaemonWeapon(item) {
  const dw = item?.system?.daemonWeapon;
  return !!(dw?.bound && dw?.subdued);
}

/**
 * Убийство рукопашной демон-оружием: += W.b демона, срез потолком W.b×2
 * (потолок берётся от W.b оружия, которым добыто именно ЭТО убийство —
 * несколько разных демон-оружий копили бы к разным потолкам, книга такой
 * случай не разбирает; берём последний использованный).
 *
 * @param {object} system            actor.system получателя (ДО применения)
 * @param {number} prevContribution  флаг BLOOD_SHIELD_FLAG получателя
 * @param {number} demonWb           W.b демона оружия, которым добыто убийство
 * @returns {{ablative:number, ablativeMax:number, contribution:number, granted:number, cap:number}|null}
 *   null — demonWb ≤ 0 или уже на потолке
 */
export function bloodShieldGrant(system, prevContribution, demonWb) {
  const wb = Math.max(0, Number(demonWb) || 0);
  if (wb <= 0) return null;
  const prev = Math.max(0, Number(prevContribution) || 0);
  const cap = wb * 2;
  const next = Math.min(cap, prev + wb);
  if (next <= prev) return null;
  const { ablative, ablativeMax, contribution } = replaceAblativeContribution(system, prev, next);
  return { ablative, ablativeMax, contribution, granted: next - prev, cap };
}

/**
 * Провал теста сохранения (или прошёл Ход без убийства и решено за столом,
 * что щит спадает) — теряет ВСЕ аблативные Раны от Blood Shield разом
 * (RAW: «теряет все эти аблативные Раны», не постепенно).
 */
export function bloodShieldLoseAll(system, prevContribution) {
  const prev = Math.max(0, Number(prevContribution) || 0);
  if (prev <= 0) return null;
  const { ablative, ablativeMax, contribution } = replaceAblativeContribution(system, prev, 0);
  return { ablative, ablativeMax, contribution };
}

/**
 * Ресинк ПОСЛЕ того, как общий ablative пул уменьшился по другой причине
 * (поглощение урона) — см. module/rules/wounds.mjs::shrinkAblativeContributionToFit.
 */
export function bloodShieldShrinkToFit(system, prevContribution) {
  return shrinkAblativeContributionToFit(system, prevContribution);
}
