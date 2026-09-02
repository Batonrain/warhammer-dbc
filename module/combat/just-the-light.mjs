// module/combat/just-the-light.mjs
// ════════════════════════════════════════════════════════════════════════
//  Just the Light / Лишь Свет (wdbc-1rno, harlequin.solitaire.justTheLight):
//  «Если персонаж потратил весь прошлый ход на движение (или совершил хотя
//  бы одно движение и сжёг остальные ОД), он получает неперегружаемый
//  колдовской щит-дефлектор A.b×3/− (складывается с технологическими, но не
//  колдовскими щитами)» — прочитано как ОДНО условие («потратил весь Ход на
//  движение» ≡ «подвигался и сжёг остальные ОД до нуля» — обе формулировки
//  книги сводятся к «movedThisTurn && actionPoints.value===0 на конец Хода»),
//  не два разных триггера.
//
//  Флаг justTheLightActive ставится в конце Хода (processJustTheLightTurnEnd,
//  hooks.mjs::updateCombat — тот же такт, что и Snapshot/snapshot.mjs) и живёт
//  ДО начала следующего Хода этого актора (снимается в action-economy.mjs::
//  resetActionEconomy — тот же приём, что у running/exposedAggressive: щит
//  защищает именно в промежутке между Ходами, когда персонаж уязвим сразу
//  после манёвра). justTheLightReduction(actor) — та же точка расширения
//  incomingDamageReduction, что уже читает module/rules/determination-to-
//  fight.mjs (wdbc-ls9d, module/combat/damage.mjs::applyDamageToActor).
//
//  НЕ смоделировано: «складывается с технологическими, но не колдовскими
//  щитами» — incomingDamageReduction плоское число без разметки по природе
//  источника (та же честная граница, что у Категории C wdbc-niv7: Cruel
//  Desire/Strange Technique/Shared Defense — ограничение на честном слове ГМ).
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { hasActionEconomy } from "./action-economy.mjs";

const FLAG = "justTheLightActive";

export function hasJustTheLight(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Just the Light"));
}

/** Конец Хода актора: если весь Ход ушёл на движение (двигался и дожёг ОД до 0) — ставит щит до начала следующего Хода. */
export async function processJustTheLightTurnEnd(actor) {
  if (!actor || !hasActionEconomy(actor) || !hasJustTheLight(actor)) return;
  const moved = actor.getFlag("warhammer-dbc", "movedThisTurn");
  const apLeft = Number(actor.system.actionPoints?.value) || 0;
  if (moved && apLeft <= 0) await actor.setFlag("warhammer-dbc", FLAG, true);
}

/** Доп. снижение входящего урона (A.b×3, минимум 0), пока активен щит Лишь Свет. */
export function justTheLightReduction(actor) {
  if (!actor?.getFlag?.("warhammer-dbc", FLAG)) return 0;
  const agBonus = Number(actor?.system?.characteristics?.ag?.bonus) || 0;
  return agBonus * 3;
}
