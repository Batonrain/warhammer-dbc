// module/combat/quick-draw.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Quick Draw / Быстрое Выхватывание и Quick Store / Быстрое Складывание
//  (Таланты Скорости, глава 3).
//
//  «Взять» и «Сложить» оружие стоят Полудействие (sheets/tabs/gear.mjs::
//  equipItem, стр. 27). С этими Талантами подходящее оружие берётся и
//  складывается свободным действием. Подходящее — по книге: метательное,
//  пистолет, винтовка (в системе — класс «Ручное»), одноручное рукопашное.
//  Инструменты в системе не занимают Взять/Сложить (их ОД не берутся), так
//  что на них Таланты ничего не меняют.
//
//  Для Выхватывания (не Складывания) есть ещё условие Разгрузки: из неудобной
//  разгрузки или слота Quick Draw не действует (constants/rig.mjs::
//  inAwkwardRigLocation). Складывание книга этим не ограничивает.
// ════════════════════════════════════════════════════════════════════════════

import { hasSpeedTalent, quickDrawWeaponEligible } from "../rules/speed-talents.mjs";
import { weaponHandsRequired } from "../rules/hands.mjs";
import { inAwkwardRigLocation } from "../constants/rig.mjs";

/**
 * Бесплатно ли это Взять / Сложить оружие благодаря Таланту.
 * @param {Actor} actor
 * @param {Item}  item
 * @param {"draw"|"stow"} direction
 */
export function quickDrawFree(actor, item, direction) {
  if (!actor || item?.type !== "weapon") return false;
  if (!hasSpeedTalent(actor, direction === "draw" ? "quickDraw" : "quickStore")) return false;
  if (!quickDrawWeaponEligible(item.system, weaponHandsRequired(item, actor))) return false;
  if (direction === "draw" && inAwkwardRigLocation(actor, item)) return false;
  return true;
}
