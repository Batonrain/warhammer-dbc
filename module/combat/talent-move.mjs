// module/combat/talent-move.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ДВИЖЕНИЕ ПО ТАЛАНТУ — пункт меню Движения (Sahara task-bbe1, решение владельца 27.10.2026).
//
//  Таланты и Черты с Движением, у которых своей механики нет (rules/talent-moves.mjs —
//  таблица: что, сколько метров, чем платится, как часто). Игрок выбирает пункт, система:
//   • проверяет условие по Раунду/Реакциям/ОД и «раз в Раунд/бой»;
//   • walk — списывает цену, пишет дистанцию в бюджет пути (grantMoveAllowance), ставит
//     «двигался в этом Ходу» и, если по тексту Таланта это не провоцирует Свободную Атаку,
//     флаг Выхода из Боя; токен игрок тянет сам;
//   • teleport — выбор точки и перенос токена (token-teleport.mjs: blink, стены учитываются;
//     бюджет пути не трогается), цена списывается после успешного переноса.
//  Условие «не двигался» (Скорость Сокола) система сверяет по флагу «двигался» (movedThisTurn), ГМ его
//  обходит; прочие условия из текста («5+ Успехов») подтверждает игрок — они показаны в диалоге.
//  Очки Трофеев (Туманный Прыжок) списываются с пула system.trophyPoints (rules/trophy-points.mjs).
//  Множители Черт (Почитатели Танца и др.) здесь не живут — дистанции считает лист
//  (rules/speed-multipliers.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { grantMoveAllowance } from "../rules/movement-path.mjs";
import {
  talentMoveDefsFor, resolveTalentMoveMeters, talentMoveGate, talentMoveCostLabel, talentMoveDegree,
  talentMoveLimitKey
} from "../rules/talent-moves.mjs";
import { isCapabilityAvailable, markCapabilityUsed } from "../rules/cooldown.mjs";
import { trophyValue, trophyUpdate } from "../rules/trophy-points.mjs";
import {
  isEncounterActive, hasActionEconomy, canSpendActionPoints, spendActionPoints, spendReaction, canSpendReaction
} from "./action-economy.mjs";
import {
  markMovedThisTurn, markMoveDegreeThisTurn, blockedByGrapple, showReachRing, bothLegsLost
} from "./movement-actions.mjs";
import { pickTeleportPoint, teleportToken } from "./token-teleport.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

const NS = "warhammer-dbc";

/** Контекст актора для чистых функций таблицы. */
function contextOf(actor) {
  const combat = globalThis.game?.combat;
  const inCombat = isEncounterActive() && hasActionEconomy(actor);
  return {
    movement: actor.system?.movement ?? {},
    pb: Number(actor.system?.characteristics?.per?.bonus) || 0,
    // «Двигался» — turn-флаг (rules/turn-flags.mjs): ставят Действия Движения и реальное перемещение токена
    // (movement-actions.mjs::initMovedFlagTracking, принудительные сдвиги не считаются), гасит начало
    // следующего Хода владельца — то есть до него флаг говорит, двигался ли персонаж на своём последнем Ходу.
    moved: !!actor.getFlag?.(NS, "movedThisTurn"),
    isGM: !!globalThis.game?.user?.isGM,
    inCombat,
    round: Number(combat?.round) || 0,
    reactions: Number(actor.system?.reactions?.value) || 0,
    ap: Number(actor.system?.actionPoints?.value) || 0,
    trophy: trophyValue(actor)
  };
}

/** Все Движения по Таланту актора с вердиктом «можно ли сейчас» — для диалога и тестов. */
export function talentMoveRows(actor) {
  const ctx = contextOf(actor);
  const rows = [];
  for (const def of talentMoveDefsFor(actor)) {
    for (const move of def.moves) {
      const limitReady = move.limit ? isCapabilityAvailable(actor, talentMoveLimitKey(def.id, move.id), move.limit.unit) : true;
      let gate = talentMoveGate(move, { ...ctx, limitReady });
      const meters = resolveTalentMoveMeters(move, ctx);
      if (gate.ok && !meters.ok) gate = { ok: false, reason: meters.reason };
      rows.push({ def, move, gate, meters, cost: talentMoveCostLabel(move) });
    }
  }
  return rows;
}

/** Хватит ли цены прямо сейчас — с учётом Состояний, блокирующих действия (без списания). */
function canPay(actor, move) {
  const reactions = move.cost?.reactions ?? 0;
  const ap = move.cost?.ap ?? 0;
  if (ap && !canSpendActionPoints(actor, ap, { physical: true })) {
    ui.notifications.warn("⚠️ Не хватает ОД (или Состояние не даёт действовать).");
    return false;
  }
  if (reactions && (!canSpendReaction(actor, { physical: true })
    || (isEncounterActive() && hasActionEconomy(actor) && (Number(actor.system?.reactions?.value) || 0) < reactions))) {
    ui.notifications.warn("⚠️ Не хватает Реакций (или Состояние не даёт действовать).");
    return false;
  }
  return true;
}

/** Списать цену Движения: Реакции и ОД. false — не вышло (ничего лишнего не списано). */
async function payCost(actor, move) {
  const reactions = move.cost?.reactions ?? 0;
  const ap = move.cost?.ap ?? 0;
  if (ap && !canSpendActionPoints(actor, ap, { physical: true })) {
    ui.notifications.warn("⚠️ Не хватает ОД.");
    return false;
  }
  for (let i = 0; i < reactions; i++) {
    if (!await spendReaction(actor, { physical: true })) {
      ui.notifications.warn("⚠️ Не хватает Реакций.");
      return false;
    }
  }
  if (ap && !await spendActionPoints(actor, ap, { physical: true })) return false;
  const trophy = move.cost?.trophy ?? 0;
  if (trophy) {
    const patch = trophyUpdate(actor, -trophy);
    if (!patch) { ui.notifications.warn("⚠️ Не хватает Очков Трофеев."); return false; }
    await actor.update(patch);
  }
  return true;
}

const tokenDocOf = actor => actor.token ?? actor.getActiveTokens?.(false, true)?.[0] ?? null;

/**
 * Совершить Движение по Таланту.
 * @param {Actor} actor
 * @param {string} defId   id записи таблицы (rules/talent-moves.mjs)
 * @param {string} moveId  id Движения внутри записи
 * @returns {Promise<boolean>} true — Движение состоялось
 */
export async function declareTalentMove(actor, defId, moveId) {
  if (!actor) return false;
  const row = talentMoveRows(actor).find(r => r.def.id === defId && r.move.id === moveId);
  if (!row) { ui.notifications.warn("⚠️ У персонажа нет этого Таланта."); return false; }
  const { def, move, meters } = row;
  if (!row.gate.ok) { ui.notifications.warn(`⚠️ ${def.label}: ${row.gate.reason}`); return false; }
  // Цену проверяем ДО переноса/записи бюджета: блокирующее Состояние (Оглушён, Ступор, без сознания) видит
  // только canSpendActionPoints/canSpendReaction, а списываем по-прежнему после успеха.
  if (!canPay(actor, move)) return false;
  if (move.mode !== "teleport") {
    if (blockedByGrapple(actor, { move: true })) return false;
    if (bothLegsLost(actor)) { ui.notifications.warn("⚠️ Нет обеих ног (или они бесполезны) — Движение недоступно."); return false; }
  }

  const limitKey = talentMoveLimitKey(def.id, move.id);
  let lines;
  if (move.mode === "teleport") {
    const point = await pickTeleportPoint();
    if (!point) return false; // отменено — ничего не потрачено
    const tokenDoc = tokenDocOf(actor);
    if (!tokenDoc?.parent) { ui.notifications.warn(`${def.label}: нет токена на сцене — переносить некого.`); return false; }
    const res = await teleportToken(tokenDoc, point, { maxMeters: meters.unlimited ? Infinity : meters.meters });
    if (res.reason === "farther") {
      ui.notifications.warn(`⚠️ ${def.label}: точка дальше ${Math.round(meters.meters)} м.`);
      return false;
    }
    if (!res.ok) { // ядро отклонило — цена и «раз в…» не тратятся
      ui.notifications.warn(`⚠️ ${def.label}: перемещение отклонено — стена вплотную или край сцены.`);
      return false;
    }
    if (!await payCost(actor, move)) return false;
    if (move.limit) await markCapabilityUsed(actor, limitKey, move.limit.unit);
    await markMovedThisTurn(actor);
    lines = [`Телепорт на ${Math.round(res.movedMeters)} м${res.stopped ? ` из ${Math.round(res.requestedMeters)} — путь перегородила стена, остановился у неё` : ""}. Лимит пути не тратится.`];
  } else {
    if (!await payCost(actor, move)) return false;
    if (move.limit) await markCapabilityUsed(actor, limitKey, move.limit.unit);
    await markMovedThisTurn(actor);
    // Категория Хода для Выстрела Навскидку по дистанции этого Движения.
    const degree = talentMoveDegree(meters.meters, actor.system?.movement?.halfMove);
    if (degree) await markMoveDegreeThisTurn(actor, degree);
    if (move.noFreeAttack) await actor.setFlag(NS, "disengageActive", true);
    await grantMoveAllowance(actor, def.label, meters.meters);
    showReachRing(actor, meters.meters);
    lines = [`Перемещение до ${Math.round(meters.meters * 10) / 10} м — тяните токен.`];
    if (move.noFreeAttack) lines.push("Свободную Атаку это Движение не провоцирует.");
  }
  await postTestCard(actor, {
    icon: rollIcon("run", "#b0a080"),
    title: `${esc(actor.name)} — ${esc(def.label)}: ${esc(move.label)}`,
    lines: [
      ...lines.map(l => `<div class="roll-threshold">${esc(l)}</div>`),
      `<div class="roll-threshold" style="font-size:.85em;opacity:.8;">Условие: ${esc(move.condition)}${move.note ? ` ${esc(move.note)}` : ""}</div>`
    ]
  }, { sound: false });
  return true;
}

/** Диалог выбора: список Движений по Таланту с ценой, условием и причиной отказа. */
export async function showTalentMoveDialog(actor) {
  if (!actor) return;
  const rows = talentMoveRows(actor);
  if (!rows.length) return ui.notifications.info("У персонажа нет Талантов Движения без своей механики.");
  const content = `<div style="font-size:.85em;padding:4px 2px;">`
    + rows.map(r => `<p style="margin:3px 0;"><b>${esc(r.def.label)}: ${esc(r.move.label)}</b> — ${esc(r.cost)}`
      + `<br><span style="opacity:.8;">${esc(r.move.condition)}</span>`
      + (r.gate.ok ? "" : `<br><span style="color:#c66;">Недоступно: ${esc(r.gate.reason)}</span>`) + `</p>`).join("")
    + `<p style="opacity:.7;margin-top:6px;">Условие из текста подтверждаете вы — система его не меряет.</p></div>`;
  const buttons = rows.filter(r => r.gate.ok).map(r => ({
    action: `${r.def.id}:${r.move.id}`,
    label: `${r.def.label}: ${r.move.label}`,
    callback: () => `${r.def.id}:${r.move.id}`
  }));
  if (!buttons.length) {
    await foundry.applications.api.DialogV2.prompt({ window: { title: "Движение по Таланту" }, content, rejectClose: false, ok: { label: "Закрыть" } });
    return;
  }
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: "Движение по Таланту" }, classes: ["warhammer-dbc", "wh-holo"], content, rejectClose: false, buttons
  });
  if (!choice) return;
  const [defId, moveId] = String(choice).split(":");
  await declareTalentMove(actor, defId, moveId);
}
