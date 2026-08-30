// module/combat/action-economy.mjs
// ════════════════════════════════════════════════════════════════════════
//  Экономика действий в бою (стр. 12, «Действия»): 2 Очка Действия (ОД) и
//  1 Реакция в начале своего Хода, тратятся Полудействием (1 ОД)/Полным
//  действием (2 ОД)/Реакцией (1 Реакция), Свободное действие бесплатно.
//  Пул восполняется полностью каждый Ход и не тратится вне активного
//  Encounter (game.combat.started === false — свободная, неограниченная
//  игра "на словах", как во всей остальной системе).
//
//  Хранимые поля — module/data/actor/_creature.mjs:
//    system.actionPoints.{value,max}
//    system.reactions.{value,max,defenseValue,defenseMax}
//  .max — база (2 ОД / 1 Реакция) + надбавка ActiveEffect Таланта (ключи
//  зарегистрированы в constants/effect-keys.mjs, фаза "initial" — Foundry
//  прибавляет их к схемному умолчанию ДО того, как это читает функция ниже).
//  defenseMax — та же надбавка, но для доп. Реакций, тратящихся ТОЛЬКО на
//  Избегание (Уклонение/Парирование) и расходуемых раньше универсальных;
//  Стойка добавляет к ней ситуативно, см. resetActionEconomy.
//
//  Стойка (Агрессивная теряет 1 Реакцию в конце Хода, Защитная даёт +1
//  Реакцию только на Избегание) читается из system.meleeStance при каждом
//  сбросе/окончании Хода — она персистентна на акторе, но может меняться
//  каждый Ход (module/sheets/attack-dialog.mjs), поэтому НЕ запекается в
//  хранимое defenseMax постоянно: это привело бы к накоплению задвоенного
//  бонуса при повторных сбросах. См. MELEE_STANCES.*.reactionRule ниже.
// ════════════════════════════════════════════════════════════════════════

import { MELEE_STANCES } from "../constants/combat.mjs";

/** Типы акторов, несущих экономику действий (общая часть — _creature.mjs). */
export const ACTION_ECONOMY_ACTOR_TYPES = ["character", "daemon", "demonPrince", "minion"];

export function hasActionEconomy(actor) {
  return ACTION_ECONOMY_ACTOR_TYPES.includes(actor?.type);
}

/** Активен ли Encounter — вне него экономика действий не расходуется вовсе. */
export function isEncounterActive() {
  return !!game.combat?.started;
}

/** Стойка актора → доп. Реакция «только на Избегание» в этом Ходу (Защитная, стр. 15). */
function stanceDefenseReactionBonus(actor) {
  const stance = actor.system?.meleeStance || "standard";
  return MELEE_STANCES[stance]?.reactionRule?.grantDefenseReaction ? 1 : 0;
}

/** Стойка актора теряет 1 Реакцию в конце своего Хода (Агрессивная, стр. 15)? */
function stanceLosesReactionAtTurnEnd(actor) {
  const stance = actor.system?.meleeStance || "standard";
  return !!MELEE_STANCES[stance]?.reactionRule?.loseReactionAtTurnEnd;
}

/**
 * Максимум доп. Реакций «только на Избегание» ДЛЯ ЭТОГО Хода: хранимая
 * надбавка (Талант) + ситуативный бонус текущей Стойки. Только для отображения
 * на листе (character-context.mjs) — resetActionEconomy сама пишет это же
 * значение в defenseValue при сбросе, отдельно хранить его не нужно.
 */
export function effectiveDefenseReactionMax(actor) {
  return (Number(actor.system?.reactions?.defenseMax) || 0) + stanceDefenseReactionBonus(actor);
}

/**
 * Восполнить ОД/Реакции актора до максимума — вызывается в начале ЕГО Хода
 * (hooks.mjs, updateCombat). Сама надбавка defenseMax от Стойки считается
 * заново каждый раз, а не копится в хранимом поле (см. заголовок файла).
 */
export async function resetActionEconomy(actor) {
  if (!hasActionEconomy(actor)) return;
  const sys = actor.system;
  const apMax          = Number(sys.actionPoints?.max) || 0;
  const reactMax       = Number(sys.reactions?.max) || 0;
  const defenseMaxBase = Number(sys.reactions?.defenseMax) || 0;
  const defenseBonus   = stanceDefenseReactionBonus(actor);

  // Один update на всё (значения + снятие флагов через -=): каждая отдельная
  // запись — это раунд-трип в базу и полный re-render листов/токенов у всех
  // клиентов; на смене хода их было до трёх. Ничего не изменилось — ноль.
  const upd = {};
  if ((Number(sys.actionPoints?.value) || 0) !== apMax) upd["system.actionPoints.value"] = apMax;
  if ((Number(sys.reactions?.value) || 0) !== reactMax) upd["system.reactions.value"] = reactMax;
  if ((Number(sys.reactions?.defenseValue) || 0) !== defenseMaxBase + defenseBonus)
    upd["system.reactions.defenseValue"] = defenseMaxBase + defenseBonus;
  if (actor.getFlag("warhammer-dbc", "exposedAggressive")) upd["flags.warhammer-dbc.-=exposedAggressive"] = null;
  if (actor.getFlag("warhammer-dbc", "running"))           upd["flags.warhammer-dbc.-=running"] = null;
  if (Object.keys(upd).length) await actor.update(upd);
}

/**
 * Применить конец Хода актора (до перехода к следующему в порядке
 * Инициативы) — сейчас единственный эффект: Агрессивная Стойка теряет
 * 1 Реакцию, а если терять было нечего — актор считается «раскрытым»
 * (attack-dialog.mjs добавляет +20 атакующим по нему до его следующего Хода).
 */
export async function applyTurnEndStanceEffects(actor) {
  if (!hasActionEconomy(actor) || !stanceLosesReactionAtTurnEnd(actor)) return;
  const value = Number(actor.system.reactions?.value) || 0;
  if (value > 0) {
    await actor.update({ "system.reactions.value": value - 1 });
  } else {
    await actor.setFlag("warhammer-dbc", "exposedAggressive", true);
  }
}

/** ОД костюм действия → стоимость в ОД (Полудействие/Полное действие/Свободное). */
export function apCostForActionType(actionType) {
  if (actionType === "Полное действие") return 2;
  if (actionType === "Полудействие")    return 1;
  return 0; // Свободное действие и всё непризнанное — бесплатно
}

/** Хватит ли ОД на действие — вне Encounter экономика не проверяется вовсе. */
export function canSpendActionPoints(actor, cost) {
  if (!cost || !isEncounterActive() || !hasActionEconomy(actor)) return true;
  return (Number(actor.system.actionPoints?.value) || 0) >= cost;
}

/** Списать ОД, если возможно. Возвращает false, если ОД не хватило (действие не проведено). */
export async function spendActionPoints(actor, cost) {
  if (!canSpendActionPoints(actor, cost)) return false;
  if (cost && isEncounterActive() && hasActionEconomy(actor)) {
    const value = Number(actor.system.actionPoints?.value) || 0;
    await actor.update({ "system.actionPoints.value": Math.max(0, value - cost) });
  }
  return true;
}

/**
 * Хватит ли Реакции. forDefense — эта Реакция тратится на Избегание
 * (Уклонение/Парирование), поэтому в первую очередь считается доп. пул
 * defenseValue Защитной Стойки, а не только универсальный.
 */
export function canSpendReaction(actor, { forDefense = false } = {}) {
  if (!isEncounterActive() || !hasActionEconomy(actor)) return true;
  // Бег (стр. 32): до начала следующего Хода бегущий не может Реакции.
  if (actor.getFlag("warhammer-dbc", "running")) return false;
  const universal = Number(actor.system.reactions?.value) || 0;
  const defense    = forDefense ? (Number(actor.system.reactions?.defenseValue) || 0) : 0;
  return (universal + defense) > 0;
}

/** Списать Реакцию: сперва ограниченный пул на Избегание (если applicable), потом универсальный. */
export async function spendReaction(actor, { forDefense = false } = {}) {
  if (!canSpendReaction(actor, { forDefense })) return false;
  if (!isEncounterActive() || !hasActionEconomy(actor)) return true;

  const defenseValue  = Number(actor.system.reactions?.defenseValue) || 0;
  if (forDefense && defenseValue > 0) {
    await actor.update({ "system.reactions.defenseValue": defenseValue - 1 });
  } else {
    const universal = Number(actor.system.reactions?.value) || 0;
    await actor.update({ "system.reactions.value": Math.max(0, universal - 1) });
  }
  return true;
}
