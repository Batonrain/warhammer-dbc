// module/apps/flayed.mjs
//
// UI/действие Мутации «Flayed / Освежёванный» (wdbc-w8ws) — см.
// module/rules/flayed.mjs про арифметику. Кнопка на листе Мутации: берёт
// текущую цель (game.user.targets, тот же приём, что Bone Song/Первая
// Помощь) как «донора», минута работы отыгрывается флейвором в чате, не
// отдельным тайм-трекером.

import { isFlayedItem, flayedGrant, flayedVisualNote, flayedShrinkToFit, FLAYED_FLAG } from "../rules/flayed.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

export { isFlayedItem };

const FLAG = "warhammer-dbc";

/**
 * Ресинк ПОСЛЕ того, как общий ablative пул владельца кожи уменьшился по
 * другой причине (поглощение урона) — вызывать из хука updateActor при
 * изменении system.wounds.ablative ЛЮБОГО актора (см. cancerous-healing.mjs
 * про ту же причину — клэмп #291 в rules/character.mjs).
 */
export async function reconcileFlayedToFit(actor) {
  const prev = Number(actor.getFlag(FLAG, FLAYED_FLAG)) || 0;
  if (prev <= 0) return;
  const result = flayedShrinkToFit(actor.system, prev);
  if (!result) return;
  await actor.update({
    "system.wounds.ablativeMax": result.ablativeMax,
    [`flags.${FLAG}.${FLAYED_FLAG}`]: result.contribution
  });
}

/** Нажатие кнопки на листе Мутации: содрать кожу с текущей цели. */
export async function useFlayed(actor, item) {
  if (!isFlayedItem(item) || !actor) return;
  const donor = [...(game.user.targets ?? [])][0]?.actor || null;
  if (!donor) {
    ui.notifications?.warn("Нет цели — наведите инструмент «Target» на существо, с которого сдирается кожа.");
    return;
  }
  if (donor.uuid === actor.uuid) {
    ui.notifications?.warn("Нельзя содрать кожу с самого себя.");
    return;
  }

  const prevContribution = Number(actor.getFlag(FLAG, FLAYED_FLAG)) || 0;
  const { newAblative, newAblativeMax, contribution, granted, cap, add, donorSize } =
    flayedGrant(actor.system, prevContribution, donor);
  if (granted <= 0) {
    ui.notifications?.info(`Аблативный пул уже на потолке (3×Cor.b = ${cap}) — кожа «${donor.name}» не налезет.`);
    return;
  }
  await actor.update({
    "system.wounds.ablative": newAblative,
    "system.wounds.ablativeMax": newAblativeMax,
    [`flags.${FLAG}.${FLAYED_FLAG}`]: contribution
  });

  const note = flayedVisualNote(newAblative);
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("skull","#c9b37a")}Освежёванный — кожа «${esc(donor.name)}»</div>
      <div class="roll-threshold">3 + Размер донора (${donorSize}) = <b>+${add}</b> → аблативные Раны <b>${newAblative}</b>${granted < add ? ` (срезано потолком 3×Cor.b = ${cap})` : ""}</div>
      ${note ? `<div class="roll-threshold" style="opacity:.8;">${esc(note)}</div>` : ""}
    </div>`,
    sound: null
  }, game.settings.get("core", "rollMode")));
}

/** Кнопка/статус для листа предмета — пусто, если это не «Освежёванный» или нет актора. */
export function flayedButtonHtml(item, actor) {
  if (!isFlayedItem(item) || !actor) return "";
  const ablative = Number(actor.system?.wounds?.ablative) || 0;
  const corBonus = Number(actor.system?.corruptionBonus) || 0;
  return `<div class="flayed-panel">
    <div class="flayed-status">Аблативные Раны от кожи: <b>${ablative}</b> (потолок 3×Cor.b = ${3 * corBonus})</div>
    <button type="button" class="flayed-btn" data-item-id="${item.id}">
      ${rollIcon("skull","#c9b37a")}Содрать кожу с цели
    </button>
  </div>`;
}
