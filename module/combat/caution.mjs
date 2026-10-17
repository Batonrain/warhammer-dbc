// module/combat/caution.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Caution / Осторожность (Талант Избегания, глава 3): «Он может раз в Ход за
//  ментальное полудействие, считающееся Концентрацией, получить 1 Реакцию.»
//
//  Кнопка на вкладке БОЙ: 1 ОД (ментальное — physical:false), засчитывается
//  как Концентрация (лимит Концентраций за Ход, concentration-limit.mjs), раз
//  в Ход (флаг гасится в начале следующего своего Хода, rules/turn-flags.mjs),
//  +1 универсальная Реакция. Реакция попадает в общий пул и может уйти на
//  любое Избегание или иную Реакцию; книга срока и «только на Избегание» не
//  называет (в отличие от Шага в Сторону).
// ════════════════════════════════════════════════════════════════════════════

import { spendActionPoints, isEncounterActive, hasActionEconomy } from "./action-economy.mjs";
import { canTakeConcentrationAction, takeConcentrationAction } from "./concentration-limit.mjs";
import { hasDodgeTalent } from "../rules/dodge-talents.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";
export const CAUTION_FLAG = "cautionThisTurn";

export function hasCaution(actor) {
  return hasDodgeTalent(actor, "caution");
}

/** Можно ли применить Осторожность сейчас (бой, Талант, не использована в этом Ходу, лимит Концентраций). */
export function cautionBlockReason(actor) {
  if (!hasCaution(actor)) return "Нужен Талант Caution/Осторожность.";
  if (!isEncounterActive() || !hasActionEconomy(actor)) return "Осторожность работает только в бою.";
  if (actor.getFlag(NS, CAUTION_FLAG)) return "Осторожность уже использована в этом Ходу.";
  if (!canTakeConcentrationAction(actor)) return "В этом Ходу уже была Концентрация.";
  return "";
}

export async function applyCaution(actor) {
  const why = cautionBlockReason(actor);
  if (why) return ui.notifications.warn(`⚠️ ${why}`);
  // Ментальное полудействие: physical:false (BONE-Head со сбитым имплантом платит вдвое).
  if (!await spendActionPoints(actor, 1, { physical: false })) return;
  await takeConcentrationAction(actor);
  const reactions = Number(actor.system.reactions?.value) || 0;
  await actor.update({ "system.reactions.value": reactions + 1, [`flags.${NS}.${CAUTION_FLAG}`]: true });
  await postTestCard(actor, {
    icon: rollIcon("shield", "#8fd0ff"), title: `Осторожность — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Ментальное полудействие (1 ОД), Концентрация. +1 Реакция (теперь ${reactions + 1}).</div>`]
  }, { sound: false });
}
