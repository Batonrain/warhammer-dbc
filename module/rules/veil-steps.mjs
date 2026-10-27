// module/rules/veil-steps.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СТУПЕНИ ИСТОНЧЕНИЯ ЗАВЕСЫ, КОТОРЫЕ ВИДИТ КОНКРЕТНЫЙ ПЕРСОНАЖ (Sahara 3-28, пачка I4,
//  решение владельца 27.10.2026).
//
//  Завеса сцены общая (окно «Завеса и Мистика», constants/scene-nexus.mjs: сначала группа сцен,
//  иначе флаг сцены). Но «Истончение Завесы в ауре» Таланта «Рана в Реальности» (+1 за каждые
//  три бесплатные силы псайкера) действует только на тех, кто стоит в ауре, — её несёт служебная
//  Черта-метка на самом акторе (rules/wound-in-reality.mjs::woundAuraVeil). Поэтому ступени, от
//  которых зависят демоны, считаются как «Завеса сцены + аура персонажа» — и считаются ОДНИМ
//  местом: лист Демона-Принца (длительность Манифестации) и Призыв демона (срок дестабилизации
//  Рыцаря Бога, apps/demon-summon.mjs) читают отсюда, а не каждый свою копию.
//
//  Не входит в реестр источников правил (sources.mjs): файл тянет constants/scene-nexus.mjs,
//  который читает глобалы Foundry в момент вызова, — AGENTS.md, wdbc-795h.
// ════════════════════════════════════════════════════════════════════════════

import { veilTotal } from "../constants/veil.mjs";
import { currentScene, readVeilForScene } from "../constants/scene-nexus.mjs";
import { woundAuraVeil } from "./wound-in-reality.mjs";

/**
 * Истончение Завесы сцены (с учётом общей Завесы группы сцен). Сцены нет или она ещё не готова — 0.
 * @param {?object} [scene] по умолчанию — текущая сцена холста
 */
export function sceneVeilSteps(scene = currentScene()) {
  if (!scene) return 0;
  try { return veilTotal(readVeilForScene(scene)); } catch { return 0; }
}

/**
 * Ступени Завесы для персонажа: Завеса сцены + аура Раны в Реальности, накрывающая его.
 * @param {?object} actor персонаж (его метки ауры); null — только Завеса сцены
 * @param {{scene?: ?object, resolve?: function}} [opts] scene — по умолчанию текущая;
 *   resolve — uuid источника ауры → Талант (в игре — fromUuidSync, тестам — свой)
 * @returns {{scene:number, aura:number, total:number}}
 */
export function veilStepsFor(actor, { scene = currentScene(), resolve } = {}) {
  const sceneSteps = sceneVeilSteps(scene);
  const aura = actor ? woundAuraVeil(actor, resolve) : 0;
  return { scene: sceneSteps, aura, total: sceneSteps + aura };
}
