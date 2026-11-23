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
//
//  Sahara 584-daemonic: «или другую Характеристику, если та лучше подходит —
//  по решению ГМа» — выбор в окне кнопки (castChar → executePsychotest);
//  «Трейт может иметь только персонаж с Трейтом Daemonic» — warpGiftedAllowed,
//  кнопка без Daemonic спрашивает подтверждение. Навык вместо Характеристики
//  окно не предлагает — это ГМ решает за столом.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName, isDaemonActor } from "./predicates.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";

/** Характеристики, которые ГМ может назначить психотесту вместо W (Влияние — не тест). */
export const WARP_GIFTED_CAST_CHARS = Object.keys(CHARACTERISTICS).filter(k => k !== "inf");

/** Черта положена только демону или носителю Daemonic. */
export function warpGiftedAllowed(actor) {
  return isDaemonActor(actor);
}

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

/** Опции психотеста для Черты: PR X, Обычный режим, без Феноменов; Характеристика теста — W, если ГМ не выбрал другую. */
export function warpGiftedCastOpts(x, castChar = "wp") {
  const key = WARP_GIFTED_CAST_CHARS.includes(castChar) ? castChar : "wp";
  return { mPR: x, prMod: 0, mode: "normal", path: "", warpGifted: true, castChar: key };
}
