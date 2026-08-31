// module/rules/encumbrance.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Общий Перевес инвентаря (wdbc-2l3x, стр. 27, раздел «Максимальный Вес»):
//  «Персонаж, который носит вес больше Ношения, но меньше Подъема страдает
//  от Перевеса. При Перевесе он получает штраф −10 на все движения и атаки
//  и уменьшает SPD на 1.» — ОДИН тир, без эскалации (в отличие от перевеса
//  ВЫКЛЮЧЕННОЙ силовой брони, combat/armor-mods.mjs::disabledArmourOverloadTier,
//  у которой книга отдельно описывает тиры до Беспомощности — стр. 233, другой
//  раздел с другим текстом). Периодический тест Т+0 раз в T.b часов (Усталость,
//  накапливающийся −10) — тем же приёмом СОЗНАТЕЛЬНО не входит: это игровое
//  СОБЫТИЕ (нужны диалог + отслеживание времени), не расчёт, см. комментарий
//  у disabledArmourOverloadTier — тот же принцип разделения.
//  Не смешивать источники: перевес брони и общий перевес инвентаря считаются
//  и применяются независимо, могут действовать одновременно.
// ════════════════════════════════════════════════════════════════════════════

import { PHYSICAL_CHARS, REACTION_SKILLS } from "../combat/armor-mods.mjs";

/**
 * Классификация Перевеса инвентаря — чистая функция по уже посчитанным
 * `system.encumbrance.{effectiveCurrent,carry}` (documents/actor.mjs).
 * @param {Actor} actor
 * @returns {{moveAtkMod:number, spdMod:number}|null}
 */
export function inventoryOverloadTier(actor) {
  const enc = actor?.system?.encumbrance || {};
  const carry = Number(enc.carry ?? enc.max) || 0;
  if (carry <= 0) return null;
  const current = Number(enc.effectiveCurrent ?? enc.current) || 0;
  if (current <= carry) return null;
  return { moveAtkMod: -10, spdMod: -1 };
}

/**
 * Штраф Перевеса инвентаря на конкретный тест — тот же контракт, что у
 * combat/armor-mods.mjs::disabledArmourPenalty (charKey/skillKey), но без
 * отдельной харшер-ставки на Реакции: книжный текст этого раздела не
 * выделяет их отдельно от прочих «движений и атак», в отличие от раздела про
 * выключенную силовую броню.
 * @param {Actor} actor
 * @param {{charKey?:string, skillKey?:string}} [ctx]
 * @returns {number}
 */
export function inventoryOverloadPenalty(actor, { charKey, skillKey } = {}) {
  const tier = inventoryOverloadTier(actor);
  if (!tier) return 0;
  if (skillKey && REACTION_SKILLS.has(skillKey)) return tier.moveAtkMod;
  if (charKey && PHYSICAL_CHARS.has(String(charKey).toLowerCase())) return tier.moveAtkMod;
  return 0;
}
