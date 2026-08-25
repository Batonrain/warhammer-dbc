// module/combat/armor-properties.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  ДВИЖОК АВТОМАТИЗАЦИИ ОСОБЫХ СВОЙСТВ БРОНИ
//  Читает system.properties[] брони (плоский массив строк-ключей, в отличие от
//  оружия — у свойств брони в данных нет рейтинга), сопоставляет с реестром
//  ARMOR_PROPERTIES (module/constants/items.mjs) и сворачивает directives auto.*
//  одной брони в плоский набор флагов. Дальше:
//  - module/documents/actor.mjs собирает флаги ВСЕХ надетых предметов брони по
//    локациям в system.absorption.propFlags[loc] (см. комментарий там же);
//  - module/combat/damage.mjs читает propFlags[armorKey] при поглощении урона.
// ─────────────────────────────────────────────────────────────────────────────

import { ARMOR_PROPERTIES } from "../constants/items.mjs";

/** Разрешает system.properties[] (массив строк-ключей) брони в список с .def. */
export function resolveArmorProps(item) {
  const keys = item?.system?.properties;
  if (!Array.isArray(keys)) return [];
  return keys
    .map(key => ({ key, def: ARMOR_PROPERTIES[key] }))
    .filter(p => p.def);
}

/**
 * Сворачивает auto.* директивы свойств ОДНОГО предмета брони в плоский набор
 * флагов, который actor.mjs распределяет по локациям (см. armorLocPropFlags).
 */
export function aggregateArmorAuto(props) {
  const a = {
    noEnergy: false, noImpact: false, doubleBlast: false,
    noRanged: false, noJointCalled: false, noEyeCalled: false,
    blocksPrimitiveDouble: false
  };
  for (const p of props) {
    const au = p.def.auto;
    if (!au) continue;
    if (au.noApVsType === "energy")   a.noEnergy = true;
    if (au.noApVsType === "impact")   a.noImpact = true;
    if (au.doubleApVsType === "blast") a.doubleBlast = true;
    if (au.noApRanged)      a.noRanged = true;
    if (au.noApJointCalled) a.noJointCalled = true;
    if (au.noApEyeCalled)   a.noEyeCalled = true;
    if (au.blocksPrimitiveDouble) a.blocksPrimitiveDouble = true;
  }
  return a;
}

/** OR флагов нескольких предметов брони, покрывающих одну и ту же локацию. */
export function mergeArmorLocFlags(a, b) {
  return {
    noEnergy:              a.noEnergy || b.noEnergy,
    noImpact:               a.noImpact || b.noImpact,
    doubleBlast:            a.doubleBlast || b.doubleBlast,
    noRanged:                a.noRanged || b.noRanged,
    noJointCalled:           a.noJointCalled || b.noJointCalled,
    noEyeCalled:             a.noEyeCalled || b.noEyeCalled,
    blocksPrimitiveDouble:   a.blocksPrimitiveDouble || b.blocksPrimitiveDouble
  };
}

const EMPTY_FLAGS = Object.freeze({
  noEnergy: false, noImpact: false, doubleBlast: false,
  noRanged: false, noJointCalled: false, noEyeCalled: false,
  blocksPrimitiveDouble: false
});

export function emptyArmorLocFlags() {
  return { ...EMPTY_FLAGS };
}

/**
 * Считает итоговый AP брони одной локации против одного попадания, применяя
 * флаги её свойств (см. mergeArmorLocFlags). Чистая функция — не знает про
 * пробитие/T.b/Копьё, это делает вызывающая сторона (module/combat/damage.mjs)
 * до и после.
 *
 * @param {number}  baseArmorAP  AP брони этой локации до бонусов/свойств
 * @param {number}  vsTypeBonus  доп. AP против damageType (моды брони)
 * @param {string}  damageType   "energy"|"impact"|"rending"|"blast"|"chemical"
 * @param {boolean} melee        атака была рукопашной (не стрелковой)
 * @param {string}  hitLocation  метка попадания (для Сочленения/Глаза)
 * @param {boolean} primitive    атакующее оружие имеет свойство Primitive
 * @param {object}  flags        propFlagsByLoc[armorKey] (mergeArmorLocFlags/emptyArmorLocFlags)
 */
export function resolveArmorAbsorptionAP({
  baseArmorAP, vsTypeBonus = 0, damageType, melee = false, hitLocation = "",
  primitive = false, flags = null
}) {
  const pf = flags || emptyArmorLocFlags();
  const armorNulled = (pf.noEnergy && damageType === "energy")
                    || (pf.noImpact && damageType === "impact")
                    || (pf.noRanged && !melee)
                    || (pf.noJointCalled && hitLocation === "Сочленение / Шея")
                    || (pf.noEyeCalled  && hitLocation === "Глаз (Голова)");
  if (armorNulled) return 0;

  let ap = baseArmorAP + vsTypeBonus;
  if (pf.doubleBlast && damageType === "blast") ap *= 2;
  if (primitive && !pf.blocksPrimitiveDouble && ap > 0) ap += Math.min(ap, 6);
  return ap;
}
