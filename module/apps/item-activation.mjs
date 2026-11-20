// module/apps/item-activation.mjs
// ════════════════════════════════════════════════════════════════════════
//  Активация «до конца боя или сцены» — Foundry-сторона
//  rules/item-activation.mjs (там — смысл флага и где он читается).
//
//    activateItemUntil(item, { label, text })  — включить; зовётся из кода
//      записи kind:"script" с ценой. Уже включено — вернёт строку отказа:
//      runMechScriptEntry тогда цену не списывает.
//    deactivateItem(item)                       — выключить (кнопкой или
//      концом боя/сцены).
//    clearActivationsOnCombatEnd(combat)        — deleteCombat (hooks.mjs).
//    clearActivationsOnSceneEnd()               — «🎬 Новая сцена»/«⏻ Сессия»
//      (apps/game-session.mjs).
// ════════════════════════════════════════════════════════════════════════

import { ACTIVATED_FLAG, activationState, activationData, endsWithCombat } from "../rules/item-activation.mjs";
import { combatOfActor } from "../combat/actor-combat.mjs";
import { worldAndTokenActors } from "../migrations/unlinked-tokens.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

async function postCard(actor, title, text) {
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${esc(title)}</div>
      ${text ? `<div class="roll-threshold">${esc(text)}</div>` : ""}
    </div>`
  }, game.settings.get("core", "rollMode")));
}

/**
 * Включить предмет до конца боя или сцены.
 * @returns {Promise<string|undefined>} строка — отказ (цена не списывается)
 */
export async function activateItemUntil(item, { label = "", text = "" } = {}) {
  const actor = item?.actor ?? item?.parent ?? null;
  const name = label || item?.name || "Способность";
  if (!actor) return ui.notifications?.warn(`«${name}»: нет персонажа-владельца.`) || "нет владельца";
  if (activationState(item)) {
    return ui.notifications?.warn(`«${name}» уже действует до конца боя или сцены.`) || "уже включено";
  }
  const combat = combatOfActor(actor);
  await item.setFlag(NS, ACTIVATED_FLAG, activationData({
    combatId: combat?.started ? combat.id : "", at: game.time?.worldTime ?? 0
  }));
  await postCard(actor, `${name} — ${actor.name}`, `${text ? `${text} ` : ""}Действует до конца ${combat?.started ? "боя или сцены" : "сцены"}.`);
  return undefined;
}

/** Выключить предмет (конец боя/сцены или вручную). */
export async function deactivateItem(item, { silent = false } = {}) {
  if (!activationState(item)) return false;
  await item.unsetFlag(NS, ACTIVATED_FLAG);
  const actor = item.actor ?? item.parent;
  if (!silent && actor) await postCard(actor, `${item.name} — ${actor.name}`, "Действие закончилось.");
  return true;
}

/** Предметы актора с включённой активацией. */
const activatedItems = actor => [...(actor?.items ?? [])].filter(i => activationState(i));

/** Конец боя: выключить всё, что включили В ЭТОМ бою. */
export async function clearActivationsOnCombatEnd(combat) {
  if (!combat) return;
  const actors = new Set();
  for (const c of combat.combatants ?? []) if (c?.actor) actors.add(c.actor);
  for (const actor of actors) {
    for (const item of activatedItems(actor)) {
      if (endsWithCombat(activationState(item), combat.id)) await deactivateItem(item, { silent: true });
    }
  }
}

/** Конец сцены: выключить всё. */
export async function clearActivationsOnSceneEnd() {
  for (const actor of worldAndTokenActors()) {
    for (const item of activatedItems(actor)) await deactivateItem(item, { silent: true });
  }
}
