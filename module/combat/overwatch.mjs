// module/combat/overwatch.mjs
// ════════════════════════════════════════════════════════════════════════
//  КАРАУЛ / OVERWATCH (core.json, wdbc-1rno.27/.37) — Foundry-обвязка поверх
//  чистой логики rules/overwatch.mjs (бюджет выстрелов) и rules/
//  simultaneous-action.mjs (очерёдность). Состояние — актёрский флаг,
//  живёт до начала следующего Хода носителя (тот же такт, что Ноосферное
//  Сканирование/Blindside — module/hooks.mjs::updateCombat, rules/
//  unseen-attack.mjs, rules/unseen-talents.mjs).
//
//  ДЕТЕКЦИЯ УСЛОВИЯ ОГНЯ (решение пользователя 16.09.2026, wdbc-1rno.27):
//  автоматическая по движению (Hooks.on("updateToken"), тот же приём, что
//  Свободная Атака — module/combat/free-attack.mjs) + ручная кнопка в HUD
//  для произвольных текстовых условий, которые движок не детектирует.
//  Оба пути ведут в offerOverwatchShot — общая карточка с кнопками режима
//  очереди.
//
//  ОЧЕРЁДНОСТЬ (Vigilance/Бдительность, Hair Trigger/Палец на Спуске,
//  wdbc-1rno.37) — победитель rules/simultaneous-action.mjs
//  выводится в карточке ИНФОРМАЦИОННО (кто действует первым по книжному
//  правилу «Одновременные Действия»): что именно значит «прервать
//  действие» — решает стол, книга сама даёт только пример, движок не
//  блокирует ввод по этому исходу.
//
//  ПОДАВЛЕНИЕ+20 — не новый тест, тот же rollSuppressionTest (module/
//  combat/suppression.mjs), которым уже пользуется Стрельба на Подавление.
//
//  ЧЕСТНО НЕ СДЕЛАНО: сам выстрел (Одиночный/Короткая/Длинная Очередь)
//  игрок делает как обычно — кликом по оружию на листе, тем же путём, что
//  Свободная Атака оставляет реагирующему (free-attack.mjs). Карточка
//  списывает бюджет и назначает цель, но не открывает диалог атаки сама —
//  такого автоматического моста между «клик по кнопке в чате» и «диалог
//  атаки конкретного оружия» в системе нет ни у одной реактивной механики.
// ════════════════════════════════════════════════════════════════════════

import { isWithinArc, bearingDegrees } from "../rules/facing.mjs";
import { tokenCenter, tokenRotation } from "./facing.mjs";
import { tokenRelationship } from "../regions/auras.mjs";
import { hasActionEconomy, isEncounterActive, spendActionPoints } from "./action-economy.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { isRoundCapabilityAvailable, markRoundCapabilityUsed } from "../apps/game-session.mjs";
import { markMovedThisTurn } from "./movement-actions.mjs";
import { overwatchSingleShotBudget, applyOverwatchShot, overwatchMaxArc } from "../rules/overwatch.mjs";
import { simultaneousActionWinner, reactingOrderCharTotal } from "../rules/simultaneous-action.mjs";
import {
  markHairTriggerUnseenPending, hairTriggerAllowedWeapon, HAIR_TRIGGER_CAPABILITY
} from "../rules/hair-trigger.mjs";
import { aggregateAuto, resolveWeaponProps } from "./weapon-properties.mjs";
import { rollSuppressionTest } from "./suppression.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const NS = "warhammer-dbc";
const FLAG_KEY = "overwatch";
const HAIR_TRIGGER_ROUND_CAPABILITY = "hairTriggerOverwatch";

export const VIGILANCE_CAPABILITY = "rangedCore.core.vigilance";
export const SCANNING_ADVANCE_CAPABILITY = "rangedCore.core.scanningAdvance";

/* ── Состояние ────────────────────────────────────────────────────────── */

export function overwatchState(actor) {
  return actor?.getFlag?.(NS, FLAG_KEY) ?? null;
}

export function isOverwatchActive(actor) {
  return !!overwatchState(actor);
}

/** Начало следующего Хода носителя (module/hooks.mjs::updateCombat) — снимает Караул. */
export async function clearOverwatch(actor) {
  if (actor?.getFlag?.(NS, FLAG_KEY)) await actor.unsetFlag(NS, FLAG_KEY);
}

function actorToken(actor) {
  return actor?.getActiveTokens?.(false, true)?.[0] ?? null;
}

/** Экипированное дальнобойное оружие — варианты для диалога объявления Караула. */
export function overwatchWeaponOptions(actor) {
  return (actor?.items ?? []).filter(i =>
    i.type === "weapon" && i.system?.equipped && i.system?.weaponClass !== "melee");
}

/* ── HUD-пункты (тот же паттерн, что aimMenuItems/movementMenuItems) ────── */

export function overwatchMenuItems(actor) {
  if (!hasActionEconomy(actor) || !isEncounterActive()) return [];
  if (isOverwatchActive(actor)) return [];
  if (!overwatchWeaponOptions(actor).length) return [];
  const items = [{ key: "overwatch", label: "Караул", cost: "2 ОД",
    action: () => showOverwatchDialog(actor, { scanningAdvance: false }) }];
  if (hasRuleFlag(actor, SCANNING_ADVANCE_CAPABILITY)) {
    items.push({ key: "scanningAdvance", label: "Сканирующее Продвижение", cost: "2 ОД",
      action: () => showOverwatchDialog(actor, { scanningAdvance: true }) });
  }
  return items;
}

/** «Стрелять из Караула» вручную — по текущей цели (game.user.targets), для условий, которые движок не детектирует. */
export function overwatchManualFireItem(actor) {
  if (!isOverwatchActive(actor)) return null;
  return { key: "overwatchFire", label: "Стрелять из Караула", cost: "",
    action: () => manualOverwatchFire(actor) };
}

/* ── Объявление ───────────────────────────────────────────────────────── */

function overwatchDialogContent(actor, maxArc, weapons) {
  const weaponOpts = weapons.map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join("");
  return `
    <form class="wh-vehicle-dialog" style="padding:6px;">
      ${weapons.length > 1 ? `<div class="atk-dlg-row"><label>Оружие:</label><select id="ow-weapon">${weaponOpts}</select></div>` : ""}
      <div class="atk-dlg-row"><label>Сектор (°, до ${maxArc}):</label>
        <input id="ow-arc" type="number" min="1" max="${maxArc}" value="${maxArc}"/></div>
      <div class="atk-dlg-row"><label>Условие огня:</label>
        <input id="ow-cond" type="text" placeholder="напр. «войдёт в сектор»" style="width:220px;"/></div>
      <div class="atk-range-info" style="font-size:0.82em;">Полное действие (2 ОД). Сектор фиксируется по текущему развороту токена — прежде чем объявлять, довернитесь в нужную сторону.</div>
    </form>`;
}

export function showOverwatchDialog(actor, { scanningAdvance = false } = {}) {
  if (!actor) return;
  const weapons = overwatchWeaponOptions(actor);
  if (!weapons.length) return ui.notifications.warn("⚠️ Нет экипированного дальнобойного оружия для Караула.");
  const hasScanning = scanningAdvance && hasRuleFlag(actor, SCANNING_ADVANCE_CAPABILITY);
  // Потеря глаза (wdbc-1rno.6): угол Караула уменьшен до 30° независимо от Scanning Advance.
  const maxArc = overwatchMaxArc(hasScanning, !!actor.system.conditions?.lostEyes);

  new Dialog({
    title: hasScanning ? "Сканирующее Продвижение" : "Караул",
    content: overwatchDialogContent(actor, maxArc, weapons),
    buttons: {
      declare: {
        icon: '<i class="fas fa-crosshairs"></i>', label: "Объявить",
        callback: async html => {
          const weaponId = weapons.length > 1 ? html.find("#ow-weapon").val() : weapons[0].id;
          const arcWidth = Math.min(maxArc, Math.max(1, parseInt(html.find("#ow-arc").val()) || maxArc));
          const condition = String(html.find("#ow-cond").val() || "").trim();
          await declareOverwatch(actor, { weaponId, arcWidth, condition, scanningAdvance: hasScanning });
        }
      },
      cancel: { label: "Отмена" }
    },
    default: "declare"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 380 }).render(true);
}

export async function declareOverwatch(actor, { weaponId, arcWidth, condition = "", scanningAdvance = false } = {}) {
  const weapon = actor.items.get(weaponId);
  if (!weapon) return ui.notifications.warn("⚠️ Оружие Караула не найдено.");
  const token = actorToken(actor);
  if (!token) return ui.notifications.warn("⚠️ Нет токена на сцене — сектор не от чего отмерить.");
  if (!await spendActionPoints(actor, 2, { physical: true })) return ui.notifications.warn("⚠️ Не хватает ОД.");

  if (scanningAdvance) await markMovedThisTurn(actor);

  const budget = overwatchSingleShotBudget(actor.system.characteristics, weapon.system);
  const state = {
    sectorCenter: tokenRotation(token),
    arcWidth,
    condition,
    weaponId,
    shotsRemaining: budget,
    maxBudget: budget,
    triggeredUuids: []
  };
  await actor.setFlag(NS, FLAG_KEY, state);

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("target", "#ff9d4d")}${esc(actor.name)} — ${scanningAdvance ? "Сканирующее Продвижение" : "Караул"}</div>
      <div class="roll-threshold">Оружие: <b>${esc(weapon.name)}</b>. Сектор ${arcWidth}°${condition ? `, условие: «${esc(condition)}»` : ""}.</div>
      <div class="roll-threshold">До ${budget} Одиночных выстрелов (по разным целям) ИЛИ одна Очередь — до начала следующего Хода.</div>
    </div>`,
    sound: null
  }, rollMode));
}

/* ── Ручной триггер (HUD) ────────────────────────────────────────────── */

async function manualOverwatchFire(actor) {
  const target = [...(game.user?.targets ?? [])][0];
  if (!target) return ui.notifications.warn("⚠️ Сначала наведите цель (клавиша T).");
  await offerOverwatchShot(actor, target.document, { auto: false });
}

/* ── Хук: движение вражеского токена в сектор ────────────────────────── */

function enemyToken(shooterActor, moverTokenDoc) {
  // actorToken() зовёт getActiveTokens(false, true) — «true» отдаёт уже
  // TokenDocument, не обёртку Token (см. Actor#getActiveTokens, foundry-stub/
  // client/documents/actor.mjs) — .disposition читается прямо с него.
  const shooterToken = actorToken(shooterActor);
  if (!shooterToken) return false;
  const shooterDoc = shooterToken.document ?? shooterToken;
  if (tokenRelationship(shooterDoc.disposition, moverTokenDoc.disposition) !== "enemy") return false;
  return shooterToken;
}

function isMoverInSector(shooterToken, state, moverTokenDoc) {
  const shooterPos = tokenCenter(shooterToken);
  const moverPos = tokenCenter(moverTokenDoc);
  if (!shooterPos || !moverPos) return false;
  return isWithinArc(state.sectorCenter, bearingDegrees(shooterPos, moverPos), state.arcWidth);
}

export function initOverwatchHooks() {
  Hooks.on("updateToken", async (tokenDoc, changes) => {
    if (!game.combat?.started) return;
    if (!("x" in changes) && !("y" in changes)) return;
    for (const combatant of game.combat.combatants) {
      const shooter = combatant.actor;
      const state = overwatchState(shooter);
      if (!state || state.shotsRemaining <= 0) continue;
      if (state.triggeredUuids.includes(tokenDoc.uuid)) continue;
      const shooterToken = enemyToken(shooter, tokenDoc);
      if (!shooterToken) continue;
      if (!isMoverInSector(shooterToken, state, tokenDoc)) continue;
      await offerOverwatchShot(shooter, tokenDoc, { auto: true });
    }
  });
}

/* ── Карточка предложения выстрела ───────────────────────────────────── */

export async function offerOverwatchShot(shooterActor, moverTokenDoc, { auto = true } = {}) {
  const state = overwatchState(shooterActor);
  if (!state || state.shotsRemaining <= 0) return;
  const weapon = shooterActor.items.get(state.weaponId);
  if (!weapon) return;

  await shooterActor.setFlag(NS, FLAG_KEY, {
    ...state, triggeredUuids: [...state.triggeredUuids, moverTokenDoc.uuid]
  });

  const wp = aggregateAuto(resolveWeaponProps(weapon));
  const hasVigilance = hasRuleFlag(shooterActor, VIGILANCE_CAPABILITY);
  const shooterChars = shooterActor.system.characteristics || {};
  const moverActor = moverTokenDoc.actor;
  const winner = simultaneousActionWinner({
    actingCharTotal: Number(moverActor?.system?.characteristics?.ag?.total) || 0,
    reactingCharTotal: reactingOrderCharTotal(shooterChars, hasVigilance, true),
    actingInitiative: game.combat?.combatants?.find(c => c.actorId === moverActor?.id)?.initiative ?? 0,
    reactingInitiative: game.combat?.combatants?.find(c => c.actorId === shooterActor.id)?.initiative ?? 0
  });

  const canHairTrigger = hasRuleFlag(shooterActor, HAIR_TRIGGER_CAPABILITY)
    && hairTriggerAllowedWeapon(weapon.system, wp)
    && isRoundCapabilityAvailable(shooterActor, HAIR_TRIGGER_ROUND_CAPABILITY);

  const modeBtn = (mode, label) => `
    <button class="wh-overwatch-fire-btn" type="button" data-mode="${mode}"
      data-shooter-uuid="${shooterActor.uuid}" data-mover-uuid="${moverTokenDoc.uuid}">${label}</button>`;

  const buttons = [
    modeBtn("single", `Одиночный (осталось ${state.shotsRemaining}/${state.maxBudget})`),
    weapon.system.rof_semi > 0 ? modeBtn("semi", "Короткая Очередь (расходует Караул)") : "",
    weapon.system.rof_full > 0 ? modeBtn("full", "Длинная Очередь (расходует Караул)") : ""
  ].filter(Boolean).join("");

  const hairTriggerBtn = canHairTrigger ? `
    <button class="wh-overwatch-hair-trigger-btn" type="button"
      data-shooter-uuid="${shooterActor.uuid}">Выиграл встречный тест (Палец на Спуске)</button>` : "";

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: shooterActor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("target", "#ff9d4d")}Караул — ${esc(moverTokenDoc.name)} ${auto ? "входит в сектор" : "в секторе"} ${esc(shooterActor.name)}</div>
      <div class="roll-threshold">Очерёдность (A${hasVigilance ? "/P" : ""}, тай-брейк Инициатива): первым действует <b>${winner === "reacting" ? esc(shooterActor.name) : esc(moverTokenDoc.name)}</b> — что это значит для конкретной ситуации, решает стол.</div>
      ${canHairTrigger ? `<div class="roll-threshold">Есть Hair Trigger — можно разыграть встречный тест Awareness(P)+0 vs Awareness(P)+0 за столом; победа даёт действие первым независимо от Ag и Незримый выстрел.</div>` : ""}
      <div class="roll-defense-btns">${hairTriggerBtn}${buttons}</div>
    </div>`,
    sound: null
  }, rollMode));
}

/* ── Клики по кнопкам карточки ───────────────────────────────────────── */

export async function resolveOverwatchHairTriggerClick(shooterUuid) {
  const shooter = await fromUuid(shooterUuid).catch(() => null);
  if (!shooter) return ui.notifications.warn("⚠️ Актор стрелка не найден.");
  if (!isRoundCapabilityAvailable(shooter, HAIR_TRIGGER_ROUND_CAPABILITY)) {
    return ui.notifications.warn(`⚠️ ${shooter.name}: Hair Trigger уже разыгран в этом Раунде.`);
  }
  await markRoundCapabilityUsed(shooter, HAIR_TRIGGER_ROUND_CAPABILITY);
  await markHairTriggerUnseenPending(shooter);
  ui.notifications.info(`${shooter.name}: Hair Trigger — следующий выстрел действует первым и считается Незримым.`);
}

export async function resolveOverwatchFireClick(shooterUuid, moverUuid, mode) {
  const shooter = await fromUuid(shooterUuid).catch(() => null);
  if (!shooter) return ui.notifications.warn("⚠️ Актор стрелка не найден.");
  const state = overwatchState(shooter);
  if (!state) return ui.notifications.warn(`⚠️ ${shooter.name}: Караул уже не активен.`);

  const { shotsRemaining, exhausted } = applyOverwatchShot(mode, state.shotsRemaining);
  if (exhausted) await clearOverwatch(shooter);
  else await shooter.setFlag(NS, FLAG_KEY, { ...state, shotsRemaining });

  const moverTokenDoc = await fromUuid(moverUuid).catch(() => null);
  const moverToken = moverTokenDoc?.object;
  if (moverToken && canvas?.ready) moverToken.setTarget(true, { user: game.user, releaseOthers: true });

  const moverActor = moverTokenDoc?.actor;
  if (moverActor) {
    await rollSuppressionTest(moverActor, { mod: 20, sourceLabel: "Караул", sourceActor: shooter });
  }

  const modeLabel = { single: "Одиночный Выстрел", semi: "Короткую Очередь", full: "Длинную Очередь" }[mode] || mode;
  ui.notifications.info(`${shooter.name}: нажмите на ${shooter.items.get(state.weaponId)?.name ?? "оружие"} на своём листе и выберите «${modeLabel}» по ${moverTokenDoc?.name ?? "цели"}.`);
}
