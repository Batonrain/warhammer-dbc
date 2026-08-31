// module/apps/armour-history-trance.mjs
// ════════════════════════════════════════════════════════════════════════
//  Транс «Дух героя» (Особенность истории силовой брони, таблица "legend",
//  8-9): владелец брони раз в бой выбирает один из нескольких дискретных
//  бонусов на время боя, а после боя платит 1к10 Порчи.
//
//  Разбор wdbc-vyua (30.08.2026): это НЕ toggle-abilities (module/rules/
//  toggle-abilities.mjs) — там подспособности живут как заранее заведённые
//  embedded-предметы, включаемые кнопкой сколько угодно раз, без отката и
//  без последствия. Здесь ровно наоборот: разовый выбор без готового
//  предмета-варианта, ограниченная длительность («до конца боя») и
//  обязательное последствие по её истечении. Пытаться протащить это в
//  planToggle/toggleAbility означало бы либо городить фиктивные embedded-
//  предметы на каждого носителя каждой такой Особенности, либо тащить
//  знание о жизненном цикле Combat в чистый расчётный модуль, который сам
//  заявляет, что живёт без Foundry (module/rules/toggle-abilities.mjs,
//  шапка файла). Ни то ни другое не стоит того ради одной брони.
//
//  Не общий вид Механики (kind) Конструктора — тем же приёмом и по той же
//  причине, что и Сус-ан Мембрана (apps/sus-an-heal.mjs): расчёт слишком
//  книжно-специфичен (разовый выбор + откат по концу боя + Порча), чтобы
//  обобщать его ради одной Особенности одной таблицы.
//
//  Устройство: выбор создаёт на акторе ОДИН embedded-предмет-носитель,
//  помеченный flags.warhammer-dbc.tranceOf/tranceCombatId/tranceCorruptionRoll.
//  Для характеристики это пустая Черта с одним ActiveEffect (system.changes,
//  тот же формат, что у любой другой перенесённой Механики предмета); для
//  Fearless — клон настоящего Таланта из компендиума (капабилити «courage.
//  core.fearless» отрабатывает сама, читатель её уже знает). Конец боя
//  (deleteCombat, hooks.mjs) резолвит: удаляет носитель и бросает Порчу —
//  ровно тот же hook, которым Сус-ан Мембрана доносит отложенное лечение,
//  если бой кончился раньше срока.
// ════════════════════════════════════════════════════════════════════════

import { PA_TABLES } from "../constants/power-armour-lore.mjs";
import { isFeatureEnabled } from "../constants/features.mjs";
import { supportsHistory } from "./armour-history.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const FLAG = "warhammer-dbc";
const TALENTS_PACK = "warhammer-dbc.talents";

/** Конфигурация транса у активной Особенности истории брони, или null. */
export function currentTrance(item) {
  if (!isFeatureEnabled("armourHistories") || !supportsHistory(item)) return null;
  const h = item.system?.history || {};
  if (!h.table || !h.name) return null;
  const def = PA_TABLES[h.table]?.entries.find(e => e.name === h.name);
  return def?.trance || null;
}

/** Вариант транса по ключу, или null. */
export function findTranceOption(trance, key) {
  return (trance?.options || []).find(o => o.key === key) || null;
}

/**
 * Активный носитель транса этой брони на акторе — {itemId, optionLabel,
 * combatId} или null. Носитель ровно один: повторный вход в транс запрещён
 * до конца текущего.
 */
export function activeTrance(actor, armorItemId) {
  const item = [...(actor?.items || [])].find(i => i.getFlag?.(FLAG, "tranceOf") === armorItemId);
  if (!item) return null;
  return {
    itemId: item.id,
    optionLabel: item.getFlag(FLAG, "tranceOptionLabel") || item.name,
    combatId: item.getFlag(FLAG, "tranceCombatId") || ""
  };
}

/** Комбатант этого актора в текущем бою, или null (нет боя / актор не в нём). */
function actorCombatant(actor) {
  if (!game.combat || !actor) return null;
  return game.combat.combatants.find(c => c.actor?.id === actor.id) || null;
}

/** Кнопка на листе брони — пусто, если у истории брони нет транса. */
export function tranceButtonHtml(item, actor) {
  const trance = currentTrance(item);
  if (!trance || !actor) return "";
  const active = activeTrance(actor, item.id);
  if (active) {
    return `<div class="pa-trance">
      <div class="pa-trance-status">${rollIcon("bolt", "#ffd24d")}В трансе: <b>${esc(active.optionLabel)}</b> — до конца боя</div>
    </div>`;
  }
  return `<div class="pa-trance">
    <button type="button" class="pa-trance-btn" data-item-id="${item.id}">
      ${rollIcon("bolt", "#ffd24d")}${esc(trance.label)}
    </button>
  </div>`;
}

/** Талант по имени из библиотеки — тем же поиском, что грант Механики (apps/mechanics.mjs). */
async function resolveTalentByName(name) {
  const pack = game.packs.get(TALENTS_PACK);
  if (!pack) return null;
  const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const index = await pack.getIndex();
  const hit = index.find(e => norm(e.name) === norm(name)
    || norm(e.name.split("/")[0]) === norm(String(name).split("/")[0]));
  return hit ? pack.getDocument(hit._id) : null;
}

/** Данные embedded-предмета-носителя для выбранного варианта, или null (Талант не нашёлся). */
async function buildTranceCarrierData(option, armorItem, combat, trance) {
  const flags = {
    [FLAG]: {
      tranceOf: armorItem.id,
      tranceCombatId: combat.id,
      tranceCorruptionRoll: trance.corruptionRoll || "1d10",
      tranceOptionLabel: option.label
    }
  };

  if (option.talentName) {
    const src = await resolveTalentByName(option.talentName);
    if (!src) return null;
    const data = src.toObject();
    delete data._id;
    data.flags = { ...(data.flags || {}), ...flags, [FLAG]: { ...(data.flags?.[FLAG] || {}), ...flags[FLAG] } };
    return data;
  }

  return {
    name: `Дух героя: ${option.label}`, type: "trait",
    img: armorItem.img,
    system: { rating: "" },
    effects: [{
      name: `Дух героя: ${option.label}`, type: "base",
      system: { changes: [{ key: `system.characteristics.${option.charKey}.totalFx`, type: "add", value: option.value, phase: "initial", priority: 0 }] },
      disabled: false, transfer: true
    }],
    flags
  };
}

/** Диалог выбора варианта — ключ выбранного, или null (закрыли без выбора). */
function promptTranceChoice(trance) {
  return new Promise(resolve => {
    let done = false;
    const buttons = {};
    for (const opt of trance.options) {
      buttons[opt.key] = {
        label: opt.label,
        callback: () => { if (!done) { done = true; resolve(opt.key); } }
      };
    }
    new Dialog({
      title: trance.label,
      content: `<form class="hw-choice-form">
        <div class="hw-choice-desc">${esc(trance.aftermathLabel || "")}</div>
      </form>`,
      buttons,
      close: () => { if (!done) { done = true; resolve(null); } }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "hw-choice-dialog"], width: 380 }).render(true);
  });
}

/** Нажатие кнопки «Впасть в транс». Требует идущего боя, где актор — комбатант. */
export async function useTrance(actor, item) {
  const trance = currentTrance(item);
  if (!trance) return;

  if (activeTrance(actor, item.id)) {
    return ui.notifications.warn("Уже в трансе — дождитесь конца боя.");
  }
  if (!actorCombatant(actor)) {
    return ui.notifications.warn("Впасть в транс можно только во время боя.");
  }

  const key = await promptTranceChoice(trance);
  if (!key) return;
  const option = findTranceOption(trance, key);
  if (!option) return;

  const data = await buildTranceCarrierData(option, item, game.combat, trance);
  if (!data) return ui.notifications.warn(`Талант «${option.talentName}» не найден в компендиуме.`);
  await actor.createEmbeddedDocuments("Item", [data]);
  // Кнопка живёт на листе БРОНИ, а носитель создан на АКТОРЕ — сам по себе
  // лист брони не перерисуется, и кнопка застревает в состоянии «Впасть».
  item.sheet?.rendered && item.sheet.render(false);

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("bolt", "#ffd24d")}${esc(trance.label)} — ${esc(actor.name)}</div>
      <div class="roll-outcome"><span class="roll-success">${esc(option.label)}</span></div>
      <div class="roll-threshold" style="font-size:.85em;opacity:.8;">${esc(trance.aftermathLabel || "")}</div>
    </div>`
  }, game.settings.get("core", "rollMode")));
}

/**
 * Резолвер конца боя — вызывается из hooks.mjs на deleteCombat. Удаляет
 * носитель(и) транса каждого комбатанта этого боя и бросает Порчу по
 * формуле, записанной в носителе (не пересматривает текущую историю брони —
 * носитель самодостаточен, тем же приёмом, что susAnHealPending).
 */
export async function resolveTrancesForCombat(combat) {
  if (!game.user.isGM) return;
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor;
    if (!actor) continue;
    const carriers = [...(actor.items || [])].filter(i => i.getFlag?.(FLAG, "tranceCombatId") === combat.id);
    if (!carriers.length) continue;

    for (const carrier of carriers) {
      const formula = carrier.getFlag(FLAG, "tranceCorruptionRoll") || "1d10";
      const roll = await new Roll(formula).evaluate();
      const cur = Number(actor.system.corruption?.value) || 0;
      await actor.update({ "system.corruption.value": Math.min(100, cur + roll.total) });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="wh-roll-result">
          <div class="roll-header">${rollIcon("bolt", "#ffd24d")}Дух героя — ${esc(actor.name)}</div>
          <div class="roll-outcome"><span class="roll-failure">Транс кончился — ${roll.total} Порчи</span></div>
        </div>`,
        rolls: [roll]
      });
    }
    await actor.deleteEmbeddedDocuments("Item", carriers.map(i => i.id));
    // Открытые листы брони этого актора всё ещё показывают «В трансе».
    for (const it of actor.items) {
      if (it.type === "armor" && it.sheet?.rendered) it.sheet.render(false);
    }
  }
}
