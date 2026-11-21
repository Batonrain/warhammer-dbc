// module/rules/psychic-locus.mjs
// Psychic Locus / Психический Локус (Талант Псайканы; Разобрать o2964). Книга: «Изучая потоки
// Варпа 8 часов, персонаж проходит Psyniscience+0 и при Успехе запоминает местность (запишите
// Успехи). Не дальше P.b×100 м от неё он может уменьшить любой бросок на Феномен на Успехи×5, но
// уменьшает Успехи места на 1. Только один локус одновременно.»
// Метка на акторе: {sceneId, x, y, successes}. Чистая часть; бросок и окно — combat/psychic-locus.mjs
// и sheets/tabs/psychic.mjs.

import { itemHasName } from "./predicates.mjs";

export const PSYCHIC_LOCUS_FLAG = "psychicLocus";
const NS = "warhammer-dbc";

export function hasPsychicLocus(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, "Psychic Locus"));
}

export function locusOf(actor) {
  return actor?.flags?.[NS]?.[PSYCHIC_LOCUS_FLAG] ?? actor?.getFlag?.(NS, PSYCHIC_LOCUS_FLAG) ?? null;
}

/** Радиус действия в метрах: P.b×100. */
export function locusRangeM(actor) {
  return Math.max(0, Number(actor?.system?.characteristics?.per?.bonus) || 0) * 100;
}

/**
 * Можно ли опереться на локус сейчас.
 * @param {{sceneId:string, distanceM:number}} here  где стоит псайкер (distanceM — до точки локуса)
 * @returns {{ok:boolean, reduction:number, reason:string}}
 */
export function locusUsable(actor, here = {}) {
  const loc = locusOf(actor);
  if (!hasPsychicLocus(actor) || !loc) return { ok: false, reduction: 0, reason: "" };
  const succ = Math.max(0, Number(loc.successes) || 0);
  if (!succ) return { ok: false, reduction: 0, reason: "Психический Локус исчерпан — изучите новое место." };
  if (here.sceneId !== loc.sceneId) return { ok: false, reduction: 0, reason: "Психический Локус на другой сцене." };
  const range = locusRangeM(actor);
  if (!(Number(here.distanceM) <= range)) return { ok: false, reduction: 0, reason: `Психический Локус дальше ${range} м.` };
  return { ok: true, reduction: succ * 5, reason: "" };
}
