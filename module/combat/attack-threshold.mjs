// module/combat/attack-threshold.mjs
//
// Фаза 4 конвейера (docs/architecture-plan.md, этап 2) со стороны атаки: что
// диалог делает с отмеченными галочками, прежде чем бросить кубик.
//
// Тот же порядок, что у диалога броска навыка
// ([actor-sheet.mjs](../sheets/actor-sheet.mjs), `_showSkillRollDialog`):
// модификаторы складываются, и только потом итоговый штраф ополовинивается.
// Разойдись эти два места — одно и то же правило («Закалка» Схолы Прогениум)
// считалось бы в атаке иначе, чем в тесте навыка.

import { resolveWeaponPropsList, aggregateAuto } from "./weapon-properties.mjs";
import { getModEffects, mergeWeaponPropEntries }  from "./weapon-mods.mjs";
import { qualityEffects }                         from "../constants/quality.mjs";
import { weaponTrainingPenalty }                  from "../rules/weapon-training.mjs";

/**
 * Итоговый порог теста атаки.
 *
 * @param {number}   base          порог до ситуативных модификаторов
 * @param {number[]} mods          всё отмеченное: режим, прицел, обстановка, правила
 * @param {boolean}  halvePenalty  ополовинить итоговый штраф
 */
export function attackThreshold({ base, mods = [], halvePenalty = false }) {
  let sum = mods.reduce((acc, m) => acc + (Number(m) || 0), 0);
  // Округление в пользу игрока: −25 даёт −12, а не −13.
  if (halvePenalty && sum < 0) sum = -Math.floor(Math.abs(sum) / 2);
  return base + sum;
}

/**
 * «Оружейная» часть порога: всё, что зависит от КОНКРЕТНОГО оружия и от
 * характеристики, которой оно бьёт. Обстановка (укрытие, стойка цели, приём,
 * прицеливание) сюда не входит — она относится к атаке целиком.
 *
 * Нужна для второй руки (wdbc-rhr): её бросок уходил против порога ПЕРВОГО
 * оружия — то есть меч в левой руке катился по навыку стрельбы и с бонусами
 * пистолета. Считать обе руки одной функцией — единственный способ не дать им
 * разъехаться снова.
 *
 * @param {Actor}  actor
 * @param {Item}   item     оружие
 * @param {string} charKey  характеристика броска ("ws"/"bs")
 * @returns {number}
 */
export function weaponThresholdPart(actor, item, charKey) {
  const sys   = item?.system ?? {};
  const modFx = getModEffects(actor, item);
  const wp    = aggregateAuto(resolveWeaponPropsList(mergeWeaponPropEntries(item, modFx)));
  const melee = sys.weaponClass === "melee";
  return (actor?.system?.characteristics?.[charKey]?.total ?? 0)
       + (sys.attackBonus  || 0)
       + (wp.attackMod     || 0)
       + (modFx.attackMod  || 0)
       // Качество даёт мод теста только рукопашному — так же, как в диалоге.
       + (melee ? (qualityEffects(item).auto.testMod || 0) : 0)
       + weaponTrainingPenalty({ actor, weaponType: sys.weaponType,
                                 weaponClass: sys.weaponClass,
                                 isGrenade: sys.weaponType === "grenade" }).total;
}
