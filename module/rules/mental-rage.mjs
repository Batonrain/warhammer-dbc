// module/rules/mental-rage.mjs
// ════════════════════════════════════════════════════════════════════════════
//  МЕНТАЛЬНЫЙ ГНЕВ / MENTAL RAGE (Талант «Берсерк», Sahara 3-861e).
//
//  Книга: «Когда персонаж в Ярости, любой псайкер или демон, решивший
//  воздействовать на его разум, получает Ступор на 1 Раунд, а эффект
//  воздействия игнорируется.»
//
//  «Воздействие на разум» — признак самой силы: system.mindEffect у
//  психосилы (data/item/psychic-power.mjs), ставится по книжному тексту, а не
//  по Дисциплине. Чистые правила; Состояние и карточка — combat/mental-rage.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";
import { isInRage } from "./rage.mjs";

export const hasMentalRage = actor => hasAbility(actor, "berserker.core.mentalRage", "Mental Rage", "talent");

/** Воздействует ли психосила на разум цели (признак предмета). */
export const isMindEffectPower = power => !!power?.system?.mindEffect;

/**
 * Цели, которые ответят на силу Ментальным Гневом: не сам кастер, в Ярости, с Талантом.
 * @param {Actor} caster
 * @param {Item} power
 * @param {Actor[]} targetActors
 * @returns {Actor[]}
 */
export function mentalRageTargets(caster, power, targetActors) {
  if (!isMindEffectPower(power)) return [];
  const seen = new Set();
  return (targetActors ?? []).filter(t => {
    if (!t || t === caster || (t.uuid && t.uuid === caster?.uuid)) return false;
    const id = t.uuid ?? t.id;
    if (id != null) { if (seen.has(id)) return false; seen.add(id); }
    return isInRage(t) && hasMentalRage(t);
  });
}
