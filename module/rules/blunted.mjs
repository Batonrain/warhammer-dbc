// module/rules/blunted.mjs
// ════════════════════════════════════════════════════════════════════════
//  «Blunted (X) / Затупленный» (Основная книга, Трейты) — на карточке
//  манифестации (wdbc-j8cn).
//
//  Книга: «Когда он подвергается действию психосилы… источник этого эффекта
//  должен пройти тест Psyniscience−10×X (или Awareness+20−10×X, если у него
//  есть Трейт Warp Sight), и при Провале персонаж полностью игнорирует
//  эффект… Этот эффект не действует на психострельбу, если только у нее нет
//  свойства Warp Weapon».
//
//  Два источника X: сама Черта Blunted на цели и Подавляющее поле
//  друкхарийской брони (constants/drukhari-armor-fields.mjs → system.
//  fieldBlunted, rules/character/armour.mjs). Поле пишет «трейт Blunted (0)/(1)»
//  — то есть ДАЁТ Черту с этим рейтингом, а не прибавляет к имеющейся, поэтому
//  берётся максимум, как у Рассеивающего поля и Nimble (resolve-test.mjs::
//  traitRatingSum). Рейтинг 0 — полноценный Затупленный (тест Psyniscience+0),
//  поэтому «нет Черты» — null, а не 0.
//
//  Чистая логика без Foundry: вызывает sheets/tabs/psychic.mjs.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

/** Рейтинг X Затупленного у актора, либо null — Черты нет и поле не активно. */
export function bluntedRating(actor) {
  if (!actor) return null;
  let found = false;
  let best = 0;
  for (const i of actor.items ?? []) {
    if (i?.type !== "trait" || !itemHasName(i, "Blunted")) continue;
    found = true;
    if (i.system?.hasRating) best = Math.max(best, Number(i.system.rating) || 0);
  }
  const field = actor.system?.fieldBlunted;
  if (field != null && field !== "") {
    found = true;
    best = Math.max(best, Number(field) || 0);
  }
  return found ? best : null;
}

/**
 * Проходит ли Затупленность против этой силы: психострельба без Warp Weapon
 * её не замечает (книга, та же статья).
 * @param {object} power  предмет психосилы
 * @param {string[]} propKeys ключи её свойств оружия (weaponProps[].key)
 */
export function bluntedAppliesToPower(power, propKeys = []) {
  if (power?.system?.powerType !== "psychicShoot") return true;
  return propKeys.includes("warpWeapon");
}

/**
 * Что показать кастеру: навык и модификатор его теста. Warp Sight меняет тест
 * на Awareness+20−10×X.
 * @returns {?{skill: string, label: string, mod: number, rating: number}}
 */
export function bluntedCasterTest(caster, target, power, propKeys = []) {
  const x = bluntedRating(target);
  if (x == null || !bluntedAppliesToPower(power, propKeys)) return null;
  const warpSight = [...(caster?.items ?? [])].some(i => i?.type === "trait" && itemHasName(i, "Warp Sight"));
  return warpSight
    ? { skill: "awareness",    label: "Awareness",   mod: 20 - 10 * x, rating: x }
    : { skill: "psyniscience", label: "Psyniscience", mod: -10 * x,   rating: x };
}
