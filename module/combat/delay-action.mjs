// module/combat/delay-action.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Задержка (стр. 12, wdbc-x1nz.2.42): «Полудействие. Персонаж заканчивает
//  свой Ход, но сохраняет одно ОД. До начала своего следующего Хода он может
//  в любой момент потратить его, чтобы совершить любое полудействие или
//  свободное действие. Если он совершал Атаку в свой Ход, действие Задержки
//  не может быть атакой.»
//
//  Банк — не отдельный пул: это буквально system.actionPoints.value, урезанное
//  до 1. canSpendActionPoints/spendActionPoints (action-economy.mjs) уже
//  проверяют это поле БЕЗ учёта «чей сейчас Ход» — любая существующая кнопка
//  (Полудвижение, generic ae-spend-btn и т.п.) уже умеет потратить этот 1 ОД
//  в любой момент, ничего заводить не нужно. Единственное, чего не было —
//  само объявление Задержки (переход «конец Хода + урезка до 1») и запрет
//  тратить этот банк на Атаку, если персонаж уже атаковал в свой Ход
//  (delayNoAttack, гасится тем же тактом, что и остальные turn-scoped флаги —
//  начало следующего своего Хода, ровно книжный срок действия банка).
//
//  Одновременные Действия (стр. 12, wdbc-x1nz.2.43, rules/simultaneous-
//  action.mjs) — когда банк тратится КАК РЕАКЦИЯ на чужое действие (не по
//  собственной инициативе игрока в свободный момент), очерёдность считает
//  тот же примитив, что уже даёт Караул (combat/overwatch.mjs): выше A,
//  тай-брейк Инициатива. Что именно означает победа/проигрыш для конкретной
//  ситуации — по-прежнему решает стол (та же честная граница, что и у
//  Караула: карточка называет победителя, не разыгрывает прерывание за игрока).
// ════════════════════════════════════════════════════════════════════════════

import { hasActionEconomy, isEncounterActive } from "./action-economy.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { attackedThisTurn } from "../rules/turn-flags.mjs";
import { simultaneousActionWinner } from "../rules/simultaneous-action.mjs";

/** Сейчас Ход именно этого актора в трекере боя? */
export function isActorsOwnTurn(actor) {
  const combatant = game.combat?.combatant;
  return !!(combatant?.actor && actor && combatant.actor.uuid === actor.uuid);
}

/**
 * Объявить Задержку. Требует ≥1 ОД (иначе банковать нечего) и активный Encounter
 * (вне боя понятие «Ход» не применимо). Урезает ОД до ровно 1 (книга: «сохраняет
 * ОДНО», не «оставшиеся») и заканчивает Ход актора, если Задержка объявлена в
 * его собственный Ход — combat.nextTurn() зовётся, только если сейчас реально
 * его очередь (вызов с чужого Хода не имеет смысла двигать трекер).
 */
export async function declareDelay(actor) {
  if (!actor) return;
  if (!isEncounterActive() || !hasActionEconomy(actor)) {
    return ui.notifications.warn("⚠️ Задержка имеет смысл только в активном бою.");
  }
  const ap = Number(actor.system.actionPoints?.value) || 0;
  if (ap < 1) return ui.notifications.warn("⚠️ Нет ОД — Задерживать нечего.");
  const noAttack = attackedThisTurn(actor).length > 0;
  await actor.update({
    "system.actionPoints.value": 1,
    "flags.warhammer-dbc.delayNoAttack": noAttack
  });
  await postTestCard(actor, {
    icon: rollIcon("run", "#9fe8b0"), title: `${esc(actor.name)} — Задержка`,
    lines: [`<div class="roll-threshold">Полудействие. Ход закончен, сохранено 1 ОД — можно потратить в любой момент до начала следующего своего Хода на полудействие/свободное действие${
      noAttack ? " (кроме Атаки — уже атаковал в этот Ход)" : ""}.</div>`]
  }, { sound: false });
  if (isActorsOwnTurn(actor) && game.combat) await game.combat.nextTurn();
}

/** Задержанное 1 ОД сейчас нельзя тратить на Атаку — актор уже атаковал в тот Ход, когда объявил Задержку. */
export function delayBlocksAttack(actor) {
  return !!actor?.getFlag?.("warhammer-dbc", "delayNoAttack");
}

/**
 * Очерёдность, когда Задержанное ОД тратится КАК РЕАКЦИЯ на чужое действие
 * (стр. 12, wdbc-x1nz.2.43) — та же карточка-стиль, что у Караула
 * (combat/overwatch.mjs::offerOverwatchShot), без розыгрыша самого
 * прерывания (решает стол).
 */
export async function postDelaySimultaneousCard(delayingActor, actingActor) {
  const winner = simultaneousActionWinner({
    actingCharTotal: Number(actingActor?.system?.characteristics?.ag?.total) || 0,
    reactingCharTotal: Number(delayingActor?.system?.characteristics?.ag?.total) || 0,
    actingInitiative: game.combat?.combatants?.find(c => c.actorId === actingActor?.id)?.initiative ?? 0,
    reactingInitiative: game.combat?.combatants?.find(c => c.actorId === delayingActor?.id)?.initiative ?? 0
  });
  await postTestCard(delayingActor, {
    icon: rollIcon("run", "#9fe8b0"), title: `Одновременные Действия — Задержка ${esc(delayingActor.name)}`,
    lines: [`<div class="roll-threshold">Очерёдность (A, тай-брейк Инициатива): первым действует <b>${
      winner === "reacting" ? esc(delayingActor.name) : esc(actingActor?.name ?? "?")
    }</b> — что это значит для конкретной ситуации, решает стол (стр. 12).</div>`]
  }, { sound: false });
}
