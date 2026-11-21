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
//      (apps/game-session.mjs); срочные (seconds) не трогает.
//    clearExpiredActivations(worldTime)         — updateWorldTime (hooks.mjs):
//      снять срочные активации, чей срок вышел.
// ════════════════════════════════════════════════════════════════════════

import { ACTIVATED_FLAG, activationState, activationData, endsWithCombat, endsWithScene, activationExpired } from "../rules/item-activation.mjs";
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
export async function activateItemUntil(item, { label = "", text = "", sceneOnly = false, seconds = 0 } = {}) {
  const actor = item?.actor ?? item?.parent ?? null;
  const name = label || item?.name || "Способность";
  if (!actor) return ui.notifications?.warn(`«${name}»: нет персонажа-владельца.`) || "нет владельца";
  if (activationState(item)) {
    return ui.notifications?.warn(`«${name}» уже действует.`) || "уже включено";
  }
  // seconds — срок по «Летоисчислению» (Боевая форма Вампира: Cor.b×10 минут):
  // ни конец боя, ни «Новая сцена» такую активацию не снимают, только срок.
  const dur = Math.max(0, Math.round(Number(seconds) || 0));
  const now = Number(game.time?.worldTime) || 0;
  // sceneOnly — «до конца сцены» (Атраментар): конец боя активацию не снимает.
  const combat = sceneOnly || dur ? null : combatOfActor(actor);
  await item.setFlag(NS, ACTIVATED_FLAG, activationData({
    combatId: combat?.started ? combat.id : "", at: now, until: dur ? now + dur : 0
  }));
  const term = dur
    ? `Действует ${Math.round(dur / 60)} мин. игрового времени (снимется само, когда «Летоисчисление» дойдёт до срока) или до возврата кнопкой.`
    : `Действует до конца ${combat?.started ? "боя или сцены" : "сцены"}.`;
  await postCard(actor, `${name} — ${actor.name}`, `${text ? `${text} ` : ""}${term}`);
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

/** Конец сцены: выключить всё, кроме срочного (его снимает срок). */
export async function clearActivationsOnSceneEnd() {
  for (const actor of worldAndTokenActors()) {
    for (const item of activatedItems(actor)) {
      if (endsWithScene(activationState(item))) await deactivateItem(item, { silent: true });
    }
  }
}

/**
 * Ход «Летоисчисления» (updateWorldTime, hooks.mjs): снять срочные активации,
 * чей срок вышел. Карточка «Действие закончилось» — от deactivateItem.
 */
export async function clearExpiredActivations(worldTime) {
  for (const actor of worldAndTokenActors()) {
    for (const item of activatedItems(actor)) {
      if (activationExpired(activationState(item), worldTime)) await deactivateItem(item);
    }
  }
}
