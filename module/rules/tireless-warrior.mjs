// module/rules/tireless-warrior.mjs
//
// Дар Кхорн «Tireless Warrior / Неутомимый Воин» (wdbc-1rno): «Когда чемпион
// убивает другого персонажа рукопашной атакой в бою, он снимает 1 Усталости,
// восстанавливает 1d5−1 Ран или урона в Характеристику (по своему выбору) и
// считается получившим 1 час здорового сна.»
//
// Момент «убил рукопашной» система не детектит автоматически (тот же честный
// предел, что у Blood Shield — module/rules/blood-shield.mjs, wdbc-173l):
// игрок/ГМ подтверждает факт кнопкой, код только считает математику снятия
// Усталости и лечения. «1 час здорового сна» — чисто нарративная бухгалтерия
// (в системе нет счётчика часов сна) — честно НЕ смоделировано, остаётся
// строкой в чат-карточке.
//
// Чистые функции, Foundry не нужен — проверяются test/rules/tireless-warrior.test.mjs.

import { itemHasName } from "./predicates.mjs";
import { itemIs } from "./item-marker.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";

const NAME = "Tireless Warrior";

/** Это Дар «Tireless Warrior / Неутомимый Воин»? */
export function isTirelessWarriorItem(item) {
  return itemIs(item, "mutation", "mutation.tirelessWarrior", NAME);
}

/** −1 Усталость, не ниже 0. */
export function tirelessWarriorFatigueRelief(system) {
  const cur = Math.max(0, Number(system?.fatigue?.value) || 0);
  return Math.max(0, cur - 1);
}

/**
 * Характеристики, реально несущие урон (system.charDamage[key] < 0) — тот же
 * знаковый «Мод.» на листе, что показывает урон в Характеристику (module/
 * rules/character.mjs). Только они предлагаются на выбор лечения — плюс
 * всегда доступный вариант «Раны».
 * @returns {{key:string, label:string, current:number}[]}
 */
export function tirelessWarriorDamagedCharacteristics(system) {
  const charDamage = system?.charDamage || {};
  const out = [];
  for (const [key, def] of Object.entries(CHARACTERISTICS)) {
    const cur = Number(charDamage[key]) || 0;
    if (cur < 0) out.push({ key, label: def.label, current: cur });
  }
  return out;
}

/** Новое значение Ран после лечения healAmount (клэмп до максимума). */
export function tirelessWarriorHealWounds(system, healAmount) {
  const heal = Math.max(0, Number(healAmount) || 0);
  const cur = Number(system?.wounds?.value) || 0;
  const max = Number(system?.wounds?.max) || 0;
  return Math.min(max, cur + heal);
}

/** Новое значение system.charDamage[key] после лечения (не выше 0 — не превращается в бонус). */
export function tirelessWarriorHealCharacteristic(system, key, healAmount) {
  const heal = Math.max(0, Number(healAmount) || 0);
  const cur = Number(system?.charDamage?.[key]) || 0;
  return Math.min(0, cur + heal);
}
