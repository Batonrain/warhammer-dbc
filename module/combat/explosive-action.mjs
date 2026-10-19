// module/combat/explosive-action.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Адаптация Сплайса «Взрывное Действие» / Explosive Action (корбук, Сплайс,
//  wdbc-tkeh1): «Позволяет раз в Ход получить бонусное полудействие, которое
//  нельзя тратить на Ментальные действия, но тогда в конце Хода персонаж
//  получает 1 Усталости и 1d5 урона в S, T, и A».
//
//   useExplosiveAction(actor) — кнопка записи Черты (kind:"script"): +1 ОД
//     (полудействие) в свой Ход, раз в Ход; отметка «расплата в конце Хода»;
//   applyExplosiveActionTurnEnd(actor) — конец Хода (hooks.mjs::updateCombat):
//     1 Усталости и 1d5 урона в S, T, A одним броском (единая точка урона в
//     Характеристики — Нестабильный Геном Сплайса прибавится сам).
//
//  «Нельзя тратить на Ментальные действия» движок не гейтит: бонусное
//  полудействие — обычное ОД, поэтому ограничение напоминается в карточке.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { isOwnTurn, hasActionEconomy, isEncounterActive } from "./action-economy.mjs";
import { addFatigue } from "../sheets/tabs/conditions.mjs";
import { applyCharDamage } from "./char-damage.mjs";

const NS = "warhammer-dbc";
/** Флаг актора: { combatId, round } — Ход, в который взято бонусное полудействие. */
export const EXPLOSIVE_ACTION_FLAG = "explosiveAction";
export const EXPLOSIVE_ACTION_CHARS = ["s", "t", "ag"];

const turnTag = () => ({ combatId: game.combat?.id ?? "", round: game.combat?.round ?? 0 });

/** Бонусное полудействие в свой Ход, раз в Ход. */
export async function useExplosiveAction(actor) {
  if (!actor || !hasActionEconomy(actor)) return ui.notifications?.warn("Взрывное Действие: у этого актора нет экономики действий.");
  if (!isEncounterActive() || !isOwnTurn(actor)) return ui.notifications?.warn("Взрывное Действие: только в свой Ход в бою.");
  const used = actor.getFlag?.(NS, EXPLOSIVE_ACTION_FLAG);
  const tag = turnTag();
  if (used && used.combatId === tag.combatId && used.round === tag.round) {
    return ui.notifications?.warn("Взрывное Действие: уже использовано в этом Ходу.");
  }
  const ap = Number(actor.system?.actionPoints?.value) || 0;
  await actor.update({ "system.actionPoints.value": ap + 1 });
  await actor.setFlag(NS, EXPLOSIVE_ACTION_FLAG, tag);
  await postTestCard(actor, {
    icon: rollIcon("bolt", "#ffb84d"), title: `Взрывное Действие — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Бонусное полудействие (+1 ОД) — не на Ментальные действия. В конце Хода: 1 Усталости и 1d5 урона в S, T, A.</div>`]
  }, { sound: false });
}

/** Расплата в конце Хода, если бонусное полудействие брали именно в этот Ход. */
export async function applyExplosiveActionTurnEnd(actor) {
  const flag = actor?.getFlag?.(NS, EXPLOSIVE_ACTION_FLAG);
  if (!flag) return;
  const tag = turnTag();
  // Отметка старше этого боя — осталась от прежнего, только гасится.
  if (flag.combatId !== tag.combatId) {
    await actor.unsetFlag(NS, EXPLOSIVE_ACTION_FLAG);
    return;
  }
  await actor.unsetFlag(NS, EXPLOSIVE_ACTION_FLAG);
  await addFatigue(actor, 1);
  const roll = await new Roll("1d5").evaluate();
  const lines = [];
  for (const key of EXPLOSIVE_ACTION_CHARS) {
    const r = await applyCharDamage(actor, key, roll.total);
    lines.push(`${key.toUpperCase()}: −${r.applied}${r.genome ? ` (+${r.genome} Нестабильный Геном)` : ""}`);
  }
  await postTestCard(actor, {
    icon: rollIcon("bolt", "#ff8a8a"), title: `Взрывное Действие: расплата — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">1 Усталости; 1d5 = <b>${roll.total}</b> урона в S, T, A (${lines.join(", ")}).</div>`]
  }, { rolls: [roll], sound: false });
}
