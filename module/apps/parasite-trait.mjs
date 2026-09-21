// module/apps/parasite-trait.mjs
// ════════════════════════════════════════════════════════════════════════
//  Parasite/Паразит (Трейт — общий, wdbc-ux8a) — слой Foundry-действий:
//  установление контакта (1d5 Ходов + ручная поправка на броню/Pen — стол
//  вводит число, автоматического скана брони «в точке контакта» нет),
//  срыв (кнопка «Сорвать паразита», 1d5 непоглощ. Rending в торс),
//  завершение заражения (по счётчику Состояния parasiticContact, тикает
//  сам — combat/condition-ticks.mjs) с маршрутизацией: Опарыш-Паразит/
//  Maggot Parasite (wdbc-1rno) получает ПОЛНОЕ поглощение тела (module/
//  apps/maggot-parasite.mjs::captureNewHost, своя находка переопределяет
//  финал), любой другой носитель Трейта — фьюжн-флаг possessedByParasiteUuid
//  (числовая часть — module/rules/character.mjs/sheets/tabs/psychic.mjs).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { itemHasKey } from "../rules/item-marker.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { conditionApplyFields, conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import {
  PARASITE_TRAIT_CAPABILITY, PARASITIC_CONTACT_SOURCE_FLAG, POSSESSED_BY_PARASITE_FLAG,
  TORN_OFF_DAMAGE_FORMULA, parasiticContactSourceUuid
} from "../rules/parasite-trait.mjs";
import { MAGGOT_PARASITE_CAPABILITY } from "../rules/maggot-parasite.mjs";
import { captureNewHost } from "./maggot-parasite.mjs";

const SCOPE = "warhammer-dbc";

async function _card(actor, title, bodyHtml, { rolls = [] } = {}) {
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("spark","#8a9a4e")}${esc(title)} — ${esc(actor.name)}</div>
      ${bodyHtml}
    </div>`,
    rolls, sound: rolls.length ? CONFIG.sounds.dice : null
  }, game.settings.get("core", "rollMode")));
}

/** Кнопка на предмете-Трейте «Parasite» — пусто у остальных предметов. */
export function beginParasiticContactButtonHtml(item, actor) {
  if (!itemHasKey(item, PARASITE_TRAIT_CAPABILITY) || !actor) return "";
  return `<div class="hand-of-death-panel">
    <button type="button" class="parasite-begin-contact-btn" data-actor-uuid="${esc(actor.uuid)}">
      ${rollIcon("spark","#8a9a4e")}Начать заражение (цель — game.user.targets)</button>
  </div>`;
}

/**
 * Установить контакт: цель — game.user.targets. armorRounds — ручная
 * поправка «+1 Ход за уровень брони в точке контакта минус Pen оружия»
 * (стол вводит число — нет автоматического скана брони именно ТОЧКИ
 * контакта; естественное оружие может выбрать любую).
 */
export async function beginParasiticContact(parasiteActor, { armorRounds = 0 } = {}) {
  const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  if (!target) {
    ui.notifications?.warn("Нет выбранной цели — контакт не установлен.");
    return;
  }

  const roll = await new Roll("1d5").evaluate();
  const bonus = Math.max(0, Number(armorRounds) || 0);
  const total = roll.total + bonus;

  await target.update({
    ...conditionApplyFields("parasiticContact", total, target),
    [`flags.${SCOPE}.${PARASITIC_CONTACT_SOURCE_FLAG}`]: parasiteActor.uuid
  });

  await _card(target, "Паразитический контакт установлен", `
    <div class="roll-threshold">1d5 (<b>${roll.total}</b>)${bonus ? ` + ${bonus} (броня в точке контакта, введено вручную)` : ""} = <b>${total}</b> Ходов до завершения заражения.</div>
    <div class="roll-threshold">Жертва/союзники могут сопротивляться — атаковать ${esc(parasiteActor.name)} или сорвать его.</div>
    <div class="wh-crit-pills">
      <button type="button" class="wh-parasite-tear-off-btn" data-actor-uuid="${esc(target.uuid)}"
        title="1d5 непоглощаемого Rending в торс жертве">
        ${rollIcon("run","#ffb84d")}Сорвать паразита</button>
    </div>`, { rolls: [roll] });
}

/** Сорвать паразита — снимает контакт, 1d5 непоглощаемого Rending в торс жертве. */
export async function tearOffParasite(victimActor) {
  const before = Number(victimActor.system?.wounds?.value) || 0;
  await victimActor.update({
    ...conditionRemoveFields("parasiticContact"),
    [`flags.${SCOPE}.-=${PARASITIC_CONTACT_SOURCE_FLAG}`]: null
  });
  const roll = await new Roll(TORN_OFF_DAMAGE_FORMULA).evaluate();
  const after = Math.max(0, before - roll.total);
  await victimActor.update({ "system.wounds.value": after });

  await _card(victimActor, "Паразит сорван", `
    <div class="roll-threshold">${TORN_OFF_DAMAGE_FORMULA} непоглощаемого Rending в торс: <b>${roll.total}</b> — Раны ${before} → <b>${after}</b>.</div>`, { rolls: [roll] });
}

/** Заражение завершено (Состояние parasiticContact дошло до 0) — маршрутизирует по типу паразита. Hooks.on в condition-ticks.mjs. */
export async function completeInfection(victimActor) {
  const sourceUuid = parasiticContactSourceUuid(victimActor);
  await victimActor.update({
    ...conditionRemoveFields("parasiticContact"),
    [`flags.${SCOPE}.-=${PARASITIC_CONTACT_SOURCE_FLAG}`]: null
  });
  const parasiteActor = sourceUuid ? await fromUuid(sourceUuid).catch(() => null) : null;
  if (!parasiteActor) return;

  if (hasRuleFlag(parasiteActor, MAGGOT_PARASITE_CAPABILITY)) {
    await captureNewHost(parasiteActor, victimActor);
    return;
  }

  await victimActor.setFlag(SCOPE, POSSESSED_BY_PARASITE_FLAG, parasiteActor.uuid);
  await _card(victimActor, "Заражение завершено", `
    <div class="roll-threshold">${esc(parasiteActor.name)} получил полный контроль над телом и разумом.</div>`);
}

/** Паразит добровольно покидает хоста (Полное действие) — характеристики хоста возвращаются сами (живой пересчёт в character.mjs). */
export async function endParasiticPossession(victimActor) {
  await victimActor.unsetFlag(SCOPE, POSSESSED_BY_PARASITE_FLAG);
  await _card(victimActor, "Паразит покинул хоста", `<div class="roll-threshold">Контроль снят, характеристики хоста вернулись.</div>`);
}
