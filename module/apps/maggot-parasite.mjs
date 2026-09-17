// module/apps/maggot-parasite.mjs
// ════════════════════════════════════════════════════════════════════════
//  Maggot Parasite/Опарыш-Паразит (wdbc-ux8a) — слой Foundry-действий:
//  превращение тела в носителя (S/T/A→10, Раны.max→7 — Размер(−2) едет
//  вместе с самим предметом Опарыша, не отдельным кодом здесь) и полная
//  миграция «какой Actor — чей лист» при захвате нового тела: предмет
//  Опарыша переносится (createEmbeddedDocuments/deleteEmbeddedDocuments),
//  Foundry-владение — через уже готовый relay (module/apps/actor-control.mjs
//  ::requestControlOwnership/requestRevokeControlOwnership, тот же, что
//  Volunteer Actor), активный лист игрока (game.user.character) — САМ
//  игрок или ГМ (Foundry v13: User#character не GM-only, в отличие от
//  Actor.ownership — self-update проходит без relay).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { itemHasKey } from "../rules/item-marker.mjs";
import {
  MAGGOT_PARASITE_CAPABILITY, parasiteHostUpdate,
  scheduleAbandonedHostDeath, isAbandonedHostDeathReady, ABANDONED_HOST_DEATH_FLAG
} from "../rules/maggot-parasite.mjs";
import { requestControlOwnership, requestRevokeControlOwnership } from "./actor-control.mjs";
import { setDeceased } from "../sheets/tabs/body.mjs";

const SCOPE = "warhammer-dbc";

async function _card(actor, title, bodyHtml) {
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("spark","#8a9a4e")}${esc(title)} — ${esc(actor.name)}</div>
      ${bodyHtml}
    </div>`
  }, game.settings.get("core", "rollMode")));
}

const TRANSFORMED_FLAG = "maggotParasiteTransformed";

/** Кнопка на предмете «Опарыш-Паразит» — пусто у остальных Даров. */
export function becomeParasiteHostButtonHtml(item) {
  if (!itemHasKey(item, MAGGOT_PARASITE_CAPABILITY)) return "";
  const done = !!item.getFlag?.(SCOPE, TRANSFORMED_FLAG);
  return `<div class="hand-of-death-panel">
    <div class="hand-of-death-status">${done
      ? `${rollIcon("spark","#8a9a4e")}Тело уже превращено (S/T/A 10, максимум Ран 7)`
      : "Тело ещё не превращено."}</div>
    <button type="button" class="maggot-parasite-become-btn" data-item-id="${item.id}" ${done ? "disabled" : ""}>
      ${rollIcon("spark","#8a9a4e")}Опарыш поглощает тело
    </button>
  </div>`;
}

/** Разовое превращение ЭТОГО тела (исходного при получении Дара) в носителя Опарыша. */
export async function becomeParasiteHost(actor, item) {
  await actor.update(parasiteHostUpdate());
  await item?.setFlag(SCOPE, TRANSFORMED_FLAG, true);
  await _card(actor, "Опарыш поглощает тело", `
    <div class="roll-threshold">S/T/A → 10, максимум Ран → 7. Размер (−2) уже даёт сам предмет «Опарыш-Паразит».</div>`);
}

/** ГМ или сам игрок-носитель — иначе честное предупреждение (нет relay для этого поля, User#character не GM-only). */
async function _reassignActiveCharacter(oldHostActor, newHostActor) {
  const userId = game.users?.find(u => u.character?.uuid === oldHostActor.uuid)?.id;
  if (!userId) {
    ui.notifications?.warn("Не найден игрок-владелец прежнего тела — активный лист не переключён, сделайте это вручную.");
    return { ok: false };
  }
  if (game.user?.isGM || game.user?.id === userId) {
    await game.users.get(userId).update({ character: newHostActor.id });
    return { ok: true };
  }
  ui.notifications?.warn("Сменить активный лист может ГМ или сам игрок-носитель — сделайте это вручную (Настройки пользователя).");
  return { ok: false };
}

/**
 * Захват нового тела: target уже известен — заражение завершено Трейтом
 * Parasite (module/apps/parasite-trait.mjs::completeInfection маршрутизирует
 * сюда именно Опарыша, переопределяя финал Трейта на полное поглощение).
 */
export async function captureNewHost(oldHostActor, target) {
  if (!target) return;

  const giftItem = [...(oldHostActor.items ?? [])].find(i => itemHasKey(i, MAGGOT_PARASITE_CAPABILITY));
  if (giftItem) {
    const data = giftItem.toObject ? giftItem.toObject() : { ...giftItem };
    delete data._id;
    await target.createEmbeddedDocuments("Item", [data]);
    await oldHostActor.deleteEmbeddedDocuments("Item", [giftItem.id]);
  }

  // Владение и активный лист резолвятся ДО переключения — оба читают
  // текущего владельца oldHostActor (после переключения искать было бы
  // уже нечего, character указывает на target).
  await requestControlOwnership(target, oldHostActor);
  await requestRevokeControlOwnership(oldHostActor, oldHostActor);
  await _reassignActiveCharacter(oldHostActor, target);

  await target.update(parasiteHostUpdate());
  await oldHostActor.setFlag(SCOPE, ABANDONED_HOST_DEATH_FLAG, scheduleAbandonedHostDeath(game.time?.worldTime ?? 0));

  await _card(target, "Опарыш захватил новое тело", `
    <div class="roll-threshold">Прежнее тело (${esc(oldHostActor.name)}) покинуто живым — умрёт через 7ч, если не вмешаться.</div>`);
}

/** Тик по игровому времени (Hooks.on("updateWorldTime")) — покинутый живой хост умирает через 7ч. */
export async function checkAbandonedHostDeath(actor, worldTime) {
  const deadline = actor.getFlag?.(SCOPE, ABANDONED_HOST_DEATH_FLAG) ?? null;
  if (!isAbandonedHostDeathReady(deadline, worldTime)) return;
  await actor.unsetFlag(SCOPE, ABANDONED_HOST_DEATH_FLAG);
  await setDeceased(actor, true);
  await _card(actor, "Покинутое тело угасло", `<div class="roll-threshold">7ч без Опарыша — тело умерло.</div>`);
}
