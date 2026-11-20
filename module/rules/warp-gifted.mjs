// module/rules/warp-gifted.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Warp Gifted / Одарённый Варпом (X) (Черта, основная книга; Разобрать 9c9iu).
//  Книга: «Знает одну психосилу (любую, если не требует PR6 или выше) и может
//  использовать её, даже не будучи псайкером, проводя тест W+5×X … Эта
//  психосила не вызывает Феноменов или Прорывов и манифестируется с PR X.»
//
//  Кнопка Черты (combat/warp-gifted.mjs) запускает обычный психотест
//  (sheets/tabs/psychic.mjs::executePsychotest) с mPR = X в Обычном режиме:
//  порог там и так «Характеристика + 5×эPR», то есть W+5×X. Флаг warpGifted
//  отключает Феномены и потолок тPR (у не-псайкера тPR 0).
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

/** Предельный PR силы, которую может знать Одарённый Варпом: «не требует PR6 или выше». */
export const WARP_GIFTED_MAX_POWER_PR = 5;

export function warpGiftedTrait(actor) {
  return [...(actor?.items ?? [])].find(i => i?.type === "trait"
    && (itemHasName(i, "Warp Gifted") || itemHasName(i, "Одарённый Варпом"))) ?? null;
}

/** X Черты (0 — не задан). */
export function warpGiftedRating(actor) {
  return Math.max(0, Number(warpGiftedTrait(actor)?.system?.rating) || 0);
}

/** Требуемый PR психосилы (system.prRequired). */
export function powerRequiredPr(power) {
  const s = power?.system ?? {};
  return Number(s.prRequired) || 0;
}

/** Психосилы актора, доступные Черте. */
export function warpGiftedPowers(actor) {
  return [...(actor?.items ?? [])].filter(i => i?.type === "psychicPower"
    && powerRequiredPr(i) <= WARP_GIFTED_MAX_POWER_PR);
}

/** Опции психотеста для Черты: PR X, Обычный режим, без Феноменов. */
export function warpGiftedCastOpts(x) {
  return { mPR: x, prMod: 0, mode: "normal", path: "", warpGifted: true };
}
