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
//
//  Читают отсюда ещё двое (Sahara task-df48, решение владельца 27.10.2026): тест Навигации
//  (apps/veil.mjs::_rollNavigation — navigationVeil: модификатор турбулентности по Завесе с аурой
//  навигатора) и проведение ритуала (apps/ritual-cast.mjs::castRitual — ritualVeilGate: книжное
//  «ритуал проводится только при Истончении Завесы +N или выше», N лежит на предмете-ритуале в
//  system.veilMin). Феномен провала ритуала Завесу по-прежнему не читает.
// ════════════════════════════════════════════════════════════════════════════

import { veilTotal, veilNavMod } from "../constants/veil.mjs";
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

/** Ступень Завесы словами листа: «+2», «0», «-1». */
export const veilStepText = n => (n > 0 ? `+${n}` : String(n));

/**
 * Завеса для теста Навигации: ступени Завесы навигатора (сцена + его аура) и модификатор
 * турбулентности по ним (constants/veil.mjs::veilNavMod).
 * @returns {{scene:number, aura:number, total:number, mod:number}}
 */
export function navigationVeil(actor, opts) {
  const steps = veilStepsFor(actor, opts);
  return { ...steps, mod: veilNavMod(steps.total) };
}

/**
 * Книжное условие ритуала «проводится только в месте с Истончением Завесы +N или выше»: хватает ли
 * ступеней там, где стоит ритуалист (Завеса сцены + аура Раны в Реальности). Число N лежит на самом
 * предмете-ритуале — system.veilMin (0 — условия нет, Завесу тогда не читаем вовсе).
 * @param {?object} item предмет-ритуал
 * @param {?object} actor ритуалист
 * @param {{scene?: ?object, resolve?: function}} [opts] как у veilStepsFor
 * @returns {{required:number, scene:number, aura:number, steps:number, ok:boolean}}
 */
export function ritualVeilGate(item, actor, opts) {
  const required = Math.max(0, Math.trunc(Number(item?.system?.veilMin) || 0));
  if (!required) return { required: 0, scene: 0, aura: 0, steps: 0, ok: true };
  const s = veilStepsFor(actor, opts);
  return { required, scene: s.scene, aura: s.aura, steps: s.total, ok: s.total >= required };
}

/** Текст для ГМа/игрока: Завеса слишком плотна, чего требует ритуал и из чего сложилась Завеса. */
export function ritualVeilMessage(gate, ritualName = "") {
  const named = ritualName ? ` «${ritualName}»` : "";
  const parts = gate.aura ? ` Завеса сцены ${veilStepText(gate.scene)}, аура Раны в Реальности ${veilStepText(gate.aura)}.` : "";
  return `Завеса слишком плотна (${veilStepText(gate.steps)}): ритуал${named} требует Истончения Завесы ${veilStepText(gate.required)} или выше.${parts}`;
}
