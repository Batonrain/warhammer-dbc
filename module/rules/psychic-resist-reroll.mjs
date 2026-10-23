// module/rules/psychic-resist-reroll.mjs
//
// Переброс «лучший из двух» на тесте Воли против психосилы/Выжигания Души,
// который бросается БЕЗ диалога с галочками (Sahara 3-defiance, решение
// владельца 23.10.2026). Defiance / Неповиновение («Преимущество на все
// встречные тесты против психосил, выжигания души… от Ненавистных врагов»)
// для теста Сопротивления психосиле уже даёт правило hatred.defiance (область
// psychicThreat, rules/hatred.mjs) — игрок ставит радиокнопку в окне. Выжигание
// Души диалога не имеет (hooks.mjs::_executeSoulBurn), спросить некого, поэтому
// переброс берётся сам — так же, как Трудный Ландшафт берёт свой
// (combat/movement-terrain.mjs::terrainReroll): «лучший из двух» по вероятности
// успеха равен «перебросить провал».
//
// Механику «лучшего из двух» этот файл не изобретает: правило и его выбор те же —
// resolveTest → rerolls (rules/resolve-test.mjs), rollD100WithReroll →
// pickReroll (rules/test-kind-widget.mjs, rules/reroll-pick.mjs).
//
// Файл отдельный, а не в rules/hatred.mjs: тот импортируется из sources.mjs, и
// resolveTest оттуда замкнул бы круг (AGENTS.md → «Источники правил»).

import { resolveTest } from "./resolve-test.mjs";

/**
 * Переброс, который цель берёт сама на тесте Воли против данного кастера.
 *
 * Только область psychicThreat и только безусловные: переброс «раз в Раунд»
 * (limit) расходуемый — тратить его без спроса нельзя, а «любой тест» (all) от
 * другого источника не про психосилы — выбрать его за игрока значило бы
 * потратить чужое (тот же отбор, что в terrainReroll).
 *
 * @param {Actor} target  кто сопротивляется
 * @param {Actor} caster  псайкер — ctx.targetActor (по нему Hatred решает «Ненавистный ли»)
 * @param {object} [extraCtx]  дополнительные теги теста (psychicIndirect и т.п.)
 * @returns {?{label:string, mode:string, rolls:number}} null — переброса нет
 */
export function psychicResistReroll(target, caster, extraCtx = {}) {
  const ctx = { kind: "skill", char: "wp", psychicThreat: true, targetActor: caster, ...extraCtx };
  const found = (resolveTest({ actor: target, ...ctx }).rerolls || [])
    .find(r => r.who === "self" && r.target === "psychicThreat" && !r.limit);
  return found ? { label: found.label, mode: found.mode, rolls: found.rolls } : null;
}
