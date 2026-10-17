// module/combat/combat-formation.mjs
// ════════════════════════════════════════════════════════════════════════
//  Боевое Построение: раздача соратникам (стр. 62) — Foundry-обвязка к
//  module/rules/combat-formation.mjs. Кнопка Таланта (kind:"script" записи
//  пака) зовёт shareCombatFormation: выбранным токенам (клавиша T)
//  ставится отметка на лист, активный ГМ — если у игрока нет прав на чужой
//  лист (combat/command-state.mjs::updateOrRelay). Конец боя снимает отметку
//  со всех участников (hooks.mjs, deleteCombat).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { updateOrRelay } from "./command-state.mjs";
import { COMBAT_FORMATION_FLAG, formationRecipients } from "../rules/combat-formation.mjs";

const NS = "warhammer-dbc";

/**
 * Поделиться планом с выбранными токенами.
 * @param {Actor} actor носитель Таланта
 * @returns {Promise<number>} сколько соратников получили отметку
 */
export async function shareCombatFormation(actor) {
  const targets = [...(game.user?.targets ?? [])].map(t => t.actor).filter(Boolean);
  if (!targets.length) {
    ui.notifications?.warn("Боевое Построение: наведите на соратников, с кем делитесь планом (клавиша T).");
    return 0;
  }
  const recipients = formationRecipients(actor, targets);
  if (!recipients.length) {
    ui.notifications?.warn("Боевое Построение: выбранные соратники уже знают ваш план.");
    return 0;
  }
  for (const ally of recipients) {
    await updateOrRelay(ally, { [`flags.${NS}.${COMBAT_FORMATION_FLAG}`]: { from: actor.uuid, name: actor.name } });
  }
  await postTestCard(actor, {
    icon: rollIcon("spark", "#4dffa6"),
    title: `Боевое Построение — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">План разделён с: <b>${recipients.map(a => esc(a.name)).join(", ")}</b>. До конца боя им +1 к Инициативе и I.b вместо A.b при броске на неё.</div>`],
    outcome: `<span class="roll-success">Построение готово</span>`
  }, { sound: false });
  return recipients.length;
}

/** Конец боя: отметка снимается со всех участников (hooks.mjs, deleteCombat). */
export async function clearCombatFormationOnCombatEnd(combat) {
  for (const c of combat?.combatants ?? []) {
    const a = c.actor;
    if (a?.getFlag?.(NS, COMBAT_FORMATION_FLAG)) await a.unsetFlag(NS, COMBAT_FORMATION_FLAG);
  }
}
