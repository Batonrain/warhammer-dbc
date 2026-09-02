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
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

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
  // Стр. 33: Подавленный персонаж в укрытии имеет только 1 ОД в свой Ход
  // («в укрытии» не проверяем — тот же приём, что у штрафа BS в диалоге
  // атаки: считаем по самому факту Подавления).
  const apMax          = sys.conditions?.pinned
    ? Math.min(1, Number(sys.actionPoints?.max) || 0)
    : (Number(sys.actionPoints?.max) || 0);
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
  // Just the Light/Лишь Свет (wdbc-1rno, combat/just-the-light.mjs): щит
  // живёт «до начала следующего Хода» — тот же такт, что running/exposedAggressive.
  if (actor.getFlag("warhammer-dbc", "justTheLightActive")) upd["flags.warhammer-dbc.-=justTheLightActive"] = null;
  // Локус Неизбежности (wdbc-smc): штраф −10 живёт до начала СВОЕГО следующего
  // Хода — снимается здесь же, тем же приёмом, что exposedAggressive/running.
  if (actor.getFlag("warhammer-dbc", "inevitabilityPenalty")) upd["flags.warhammer-dbc.-=inevitabilityPenalty"] = null;
  // Импульсное (movement-actions.mjs, markMovedThisTurn): «не двигался с
  // прошлого раунда» начинается заново с каждым Ходом этого актора.
  if (actor.getFlag("warhammer-dbc", "movedThisTurn"))     upd["flags.warhammer-dbc.-=movedThisTurn"] = null;
  // Snapshot/Выстрел Навскидку (wdbc-1rno) читает эту категорию на выходе
  // из Хода (processSnapshotTurnEnd, до сброса ниже) — сбрасывается здесь
  // тем же тактом, что и movedThisTurn, следующий Ход начинается заново.
  if (actor.getFlag("warhammer-dbc", "moveDegreeThisTurn")) upd["flags.warhammer-dbc.-=moveDegreeThisTurn"] = null;
  if (Object.keys(upd).length) await actor.update(upd);
}

/**
 * Карточка начала Хода (wdbc-qjnk): игрок сейчас узнаёт «сколько у меня ОД»
 * только зайдя на вкладку листа посреди боя — эта карточка говорит прямо в
 * чат сразу после resetActionEconomy (hooks.mjs, updateCombat), пока данные
 * уже свежие (actor.update мутирует документ синхронно до персиста).
 */
export async function postTurnStartCard(actor) {
  if (!hasActionEconomy(actor)) return;
  const ap    = actor.system.actionPoints ?? {};
  const react = actor.system.reactions ?? {};
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("run", "#4dffa6")}${esc(actor.name)} — Начало Хода</div>
      <div class="roll-threshold">ОД <b>${Number(ap.value) || 0}</b>/${Number(ap.max) || 0} · Реакции <b>${Number(react.value) || 0}</b>/${Number(react.max) || 0}</div>
    </div>`
  }, game.settings.get("core", "rollMode")));
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

/**
 * {disabled, title} для кнопки, тратящей ОД — образец disabled-armour-
 * periodic-test-btn (templates/actor/parts/tab-combat.hbs): гейт виден ДО
 * клика, а не тостом после клика. Вне активного Encounter
 * canSpendActionPoints сама всегда true — кнопки остаются активны, как и
 * раньше; cost 0 (напр. Натиск, ОД которого списываются позже, на броске
 * атаки) тоже всегда проходит.
 */
export function apSpendGate(actor, cost) {
  const ok = canSpendActionPoints(actor, cost);
  return {
    disabled: !ok,
    title: ok ? "" : `Не хватает ОД: нужно ${cost}, есть ${Number(actor.system.actionPoints?.value) || 0}`
  };
}

/** То же для Реакции (forDefense не гейтится здесь — Уклонение/Парирование сами проверяют свой доп. пул). */
export function reactionSpendGate(actor) {
  const ok = canSpendReaction(actor);
  return {
    disabled: !ok,
    title: ok ? "" : "Не хватает Реакций"
  };
}
