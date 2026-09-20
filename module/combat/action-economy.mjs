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
import { postTestCard } from "../helpers/test-card.mjs";
import { determinationToFightApBonus } from "../rules/determination-to-fight.mjs";
import { isStunnedOrDazed } from "../rules/predicates.mjs";
import { turnStartFlagClears, turnStartAttackCarryOver } from "../rules/turn-flags.mjs";
import { rollLegacyChangeBonus } from "../rules/legacy-weapon.mjs";

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
 * Максимум ОД ДЛЯ ЭТОГО Хода: хранимая надбавка (ActiveEffect) + динамический
 * бонус текущего состояния (Determination To Fight/Решительность Сражаться,
 * wdbc-1rno: +1 ОД при отрицательных Ранах) — тот же приём, что
 * effectiveDefenseReactionMax у Стойки, не запекается в хранимое поле.
 * Подавленный (стр. 33, min 1) применяется ПОВЕРХ этого — см. resetActionEconomy.
 */
export function effectiveActionPointsMax(actor) {
  return (Number(actor.system?.actionPoints?.max) || 0) + determinationToFightApBonus(actor);
}

/**
 * Восполнить ОД/Реакции актора до максимума — вызывается в начале ЕГО Хода
 * (hooks.mjs, updateCombat). Сама надбавка defenseMax от Стойки считается
 * заново каждый раз, а не копится в хранимом поле (см. заголовок файла).
 */
export async function resetActionEconomy(actor) {
  if (!hasActionEconomy(actor)) return;
  const sys = actor.system;
  // Стр. 12, wdbc-x1nz.2.26: Врасплох — «пропускает свой первый Раунд боя и
  // не получает Реакции в этот Раунд». Реакции на этот момент уже обнулены
  // (conditionApplyFields — на случай, если враги действуют раньше носителя в
  // порядке Инициативы), а здесь — тот же абсолютный запрет (0 ОД и 0
  // Реакций), что у Оглушения/Без сознания ниже, ПЛЮС одноразовое снятие
  // самого Состояния: единственный их Ход, пока оно висит, — как раз тот
  // «первый Раунд», который они пропускают.
  const surprised       = !!sys.conditions?.surprised;
  // Стр. 30-31: Оглушение/Ступор и Без сознания (wdbc-r5o7.7: «не может
  // совершать Действия и Реакции», тот же абсолютный запрет, что и у
  // Оглушения — не через isStunnedOrDazed, у Без сознания это СВОЙ пункт
  // книги, не производный от Беспомощности выше) — абсолютный запрет (0),
  // сильнее ограничения Подавленного ниже (min 1).
  const apLocked       = isStunnedOrDazed(actor) || !!sys.conditions?.unconscious || surprised;
  // Стр. 33: Подавленный персонаж в укрытии имеет только 1 ОД в свой Ход
  // («в укрытии» не проверяем — тот же приём, что у штрафа BS в диалоге
  // атаки: считаем по самому факту Подавления).
  const apMax          = apLocked ? 0 : sys.conditions?.pinned
    ? Math.min(1, effectiveActionPointsMax(actor))
    : effectiveActionPointsMax(actor);
  const reactMax       = apLocked ? 0 : (Number(sys.reactions?.max) || 0);
  const defenseMaxBase = Number(sys.reactions?.defenseMax) || 0;
  const defenseBonus   = stanceDefenseReactionBonus(actor);
  // Доп. Реакции «только на Избегание» — тоже Реакции: запрет выше
  // распространяется и на них, не только на универсальный пул.
  const defenseMax     = apLocked ? 0 : defenseMaxBase + defenseBonus;

  // Один update на всё (значения + снятие флагов через -=): каждая отдельная
  // запись — это раунд-трип в базу и полный re-render листов/токенов у всех
  // клиентов; на смене хода их было до трёх. Ничего не изменилось — ноль.
  const upd = {};
  if ((Number(sys.actionPoints?.value) || 0) !== apMax) upd["system.actionPoints.value"] = apMax;
  if ((Number(sys.reactions?.value) || 0) !== reactMax) upd["system.reactions.value"] = reactMax;
  if ((Number(sys.reactions?.defenseValue) || 0) !== defenseMax)
    upd["system.reactions.defenseValue"] = defenseMax;
  // Флаги, живущие «до начала следующего своего Хода», гасятся ОДНИМ циклом по
  // реестру (wdbc-5uae.1, rules/turn-flags.mjs) — раньше каждый был вписан
  // сюда отдельной строкой по имени. Срок жизни метки это её свойство, и
  // хранится он теперь при метке, а не списком в чужом файле: новая метка
  // такого срока добавляется строкой в реестр и здесь ничего дописывать не
  // надо. Патч вливается в общий update — по-прежнему один раунд-трип на всё.
  Object.assign(upd, turnStartFlagClears(actor));
  // Список «чем атаковал» не гасится, а переезжает на Ход назад: Мэн-Гош
  // спрашивает про ПРЕДЫДУЩИЙ Ход (rules/turn-flags.mjs).
  Object.assign(upd, turnStartAttackCarryOver(actor));
  // Врасплох потрачен — это и был тот единственный Ход, который они по книге
  // пропускают (см. комментарий у apLocked выше).
  if (surprised) upd["system.conditions.surprised"] = false;
  // Наследие Перемен, Оружие Наследия (wdbc-1rno.35, История 9, стр. 427):
  // «В начале каждого Хода бросьте 2d5» — свежий бросок каждый раз ЗАМЕНЯЕТ
  // прошлый, поэтому не через общий реестр turn-flags.mjs (та только гасит,
  // см. rules/legacy-weapon.mjs::rollLegacyChangeBonus).
  // Обычная запись, не «-=»: значение ЗАМЕНЯЕТСЯ каждый Ход (свежим броском
  // или null, если подходящего оружия больше нет) — сторож test/rules/
  // turn-flags.test.mjs запрещает ручное «-=» здесь именно потому, что оно
  // для флагов, которые только ГАСНУТ, не переписываются заново.
  const legacyChange = await rollLegacyChangeBonus(actor);
  if (legacyChange || actor.getFlag?.("warhammer-dbc", "legacyChangeBonus")) {
    upd["flags.warhammer-dbc.legacyChangeBonus"] = legacyChange;
  }
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
  await postTestCard(actor, {
    icon: rollIcon("run", "#4dffa6"), title: `${esc(actor.name)} — Начало Хода`,
    lines: [`<div class="roll-threshold">ОД <b>${Number(ap.value) || 0}</b>/${Number(ap.max) || 0} · Реакции <b>${Number(react.value) || 0}</b>/${Number(react.max) || 0}</div>`]
  }, { sound: false });
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

/**
 * Aim Focus/Фокус на Прицеле (wdbc-1rno.5, rules/aim-focus.mjs): «до конца
 * его следующего Хода» — на конце Хода, где было объявлено ("pending"),
 * взводится на один Ход вперёд ("armed"); на конце СЛЕДУЮЩЕГО Хода (уже
 * "armed") снимается вместе с самим Прицеливанием. Тот же такт, что
 * applyTurnEndStanceEffects — hooks.mjs зовёт обе на конце Хода актора.
 */
export async function applyAimFocusTurnEnd(actor) {
  const state = actor?.getFlag?.("warhammer-dbc", "aimFocusExtended");
  if (state === "pending") {
    await actor.setFlag("warhammer-dbc", "aimFocusExtended", "armed");
  } else if (state === "armed") {
    await actor.unsetFlag("warhammer-dbc", "aimFocusExtended");
    if (actor.system?.aiming && actor.system.aiming !== "none") {
      await actor.update({ "system.aiming": "none" });
    }
  }
}

/**
 * ОД костюм действия → стоимость в ОД (стр. 12: Полудействие/Полное
 * действие/Свободное — и Длительное/Расширенное, книжно тоже 2 ОД за Ход,
 * см. combat/sustained-action.mjs).
 */
export function apCostForActionType(actionType) {
  if (actionType === "Полное действие")      return 2;
  if (actionType === "Полудействие")         return 1;
  if (actionType === "Длительное действие")  return 2;
  if (actionType === "Расширенное действие") return 2;
  return 0; // Свободное действие и всё непризнанное — бесплатно
}

/** Хватит ли ОД на действие — вне Encounter экономика не проверяется вовсе. */
export function canSpendActionPoints(actor, cost) {
  if (!cost || !isEncounterActive() || !hasActionEconomy(actor)) return true;
  return (Number(actor.system.actionPoints?.value) || 0) >= cost;
}

/**
 * Калечащее (стр. 168, Крит. свойство оружия «Crippling/Калечащее»,
 * wdbc-r5o7.5): рана хранится в system.crippledWounds (combat/damage.mjs::
 * _applyCrippling) и наносит непоглощаемый урон, «когда оба ОД в этот Ход
 * ушли на физические действия» — раньше только кнопкой в чате
 * (wh-crippling-trigger-btn, жать вручную «когда вспомнили»), здесь —
 * автоматически, по факту накопления physicalApSpentThisTurn до максимума
 * ОД актора (effectiveActionPointsMax — та же цифра, что видит игрок в
 * счётчике ОД, с учётом Решительности Сражаться/Подавленного).
 *
 * «Физическое действие» книга не определяет списком — вызывающая сторона
 * помечает это сама через spendActionPoints(actor, cost, {physical:true}).
 * Помечены однозначно телесные действия — Движение (Полудействие/Натиск/
 * Бег/Отход, movement-actions.mjs) и сама атака (attack-dialog.mjs).
 * НЕ помечены как физические (решение зафиксировано здесь, не молча):
 * Поклон Публике (bow-to-audience.mjs) и Духовный Разговор (spirit-talk.mjs)
 * — оба тратят ОД на тест Восприятия/психический ритуал, а не на телесное
 * усилие раненой конечностью; общая кнопка «потратить ОД без своей кнопки»
 * (.ae-spend-btn, sheets/tabs/combat.mjs) и Отскок (.ae-recoil-bonus-btn,
 * там же) не помечены, потому что представляют произвольное действие игрока
 * без уточнения его природы — угадывать «физическое оно или нет» значило
 * бы либо занижать, либо задваивать урон без основания в тексте.
 */
async function _maybeTriggerCrippling(actor, cost) {
  const wounds = actor.system?.crippledWounds;
  if (!wounds?.length) return;
  if (actor.getFlag("warhammer-dbc", "cripplingTriggeredThisTurn")) return;
  const spent = (Number(actor.getFlag("warhammer-dbc", "physicalApSpentThisTurn")) || 0) + cost;
  if (spent < effectiveActionPointsMax(actor)) {
    await actor.setFlag("warhammer-dbc", "physicalApSpentThisTurn", spent);
    return;
  }
  await actor.update({
    "flags.warhammer-dbc.physicalApSpentThisTurn": spent,
    "flags.warhammer-dbc.cripplingTriggeredThisTurn": true
  });
  const { applyCripplingTrigger } = await import("./damage.mjs");
  for (const w of wounds) {
    await applyCripplingTrigger(actor, Number(w.rating) || 0, w.locationLabel || w.location || "");
  }
}

/**
 * Прицеливание (wdbc-1rno.5, module/rules/aiming.mjs): бонус тратится
 * впустую любым действием актора, кроме самого объявления Прицеливания
 * (combat/aiming-action.mjs ставит system.aiming ПОСЛЕ своего же спенда
 * ниже по стеку — на момент этого вызова оно ещё старое/"none", очистка тут
 * не задваивает). Условие «cost» — только реальный (ненулевой) расход;
 * формальные вызовы с cost=0 в других местах кодовой базы не должны молча
 * стирать чужое активное Прицеливание.
 */
async function _maybeClearAiming(actor) {
  if (actor?.system?.aiming && actor.system.aiming !== "none") {
    await actor.update({ "system.aiming": "none" });
  }
  // Tracking Aim/Прицел на Упреждение (wdbc-1rno.5, rules/tracking-aim.mjs):
  // тот же «любое действие тратит впустую», что у самого Прицеливания.
  if (actor?.getFlag?.("warhammer-dbc", "trackingAimActive")) {
    await actor.unsetFlag("warhammer-dbc", "trackingAimActive");
  }
}

/**
 * Списать ОД, если возможно. Возвращает false, если ОД не хватило (действие
 * не проведено). physical:true — это трата ОД на физическое действие (см.
 * _maybeTriggerCrippling выше) — считается к авто-триггеру Калечащего.
 */
export async function spendActionPoints(actor, cost, { physical = false } = {}) {
  if (!canSpendActionPoints(actor, cost)) return false;
  if (cost && isEncounterActive() && hasActionEconomy(actor)) {
    const value = Number(actor.system.actionPoints?.value) || 0;
    await actor.update({ "system.actionPoints.value": Math.max(0, value - cost) });
    if (physical) await _maybeTriggerCrippling(actor, cost);
    await _maybeClearAiming(actor);
  }
  return true;
}

/**
 * Стр. 12, wdbc-x1nz.2.28: «Одно Действие может вызвать только одну
 * Реакцию» — уже отвечали Реакцией на ЭТО конкретное Действие (attackId,
 * общий у всех кнопок Избегания одной карточки — attack-card.mjs::
 * defenseSection генерирует его один раз на карточку)? Без attackId (вызов
 * не относится к конкретной атаке — например общая кнопка «потратить
 * Реакцию» на листе) гейт не применяется вовсе.
 */
function hasReactedToAttack(actor, attackId) {
  if (!attackId) return false;
  const ids = actor.getFlag("warhammer-dbc", "reactedAttackIds");
  return Array.isArray(ids) && ids.includes(attackId);
}

/** Пометить attackId как «уже обслужен» — список гасится turn-flags.mjs на начале следующего своего Хода. */
async function markReactedToAttack(actor, attackId) {
  if (!attackId) return;
  const ids = actor.getFlag("warhammer-dbc", "reactedAttackIds");
  const list = Array.isArray(ids) ? ids : [];
  if (!list.includes(attackId)) await actor.setFlag("warhammer-dbc", "reactedAttackIds", [...list, attackId]);
}

/**
 * Хватит ли Реакции. forDefense — эта Реакция тратится на Избегание
 * (Уклонение/Парирование), поэтому в первую очередь считается доп. пул
 * defenseValue Защитной Стойки, а не только универсальный. attackId — см.
 * hasReactedToAttack выше.
 */
export function canSpendReaction(actor, { forDefense = false, attackId = "" } = {}) {
  if (!isEncounterActive() || !hasActionEconomy(actor)) return true;
  // Бег (стр. 32): до начала следующего Хода бегущий не может Реакции.
  if (actor.getFlag("warhammer-dbc", "running")) return false;
  if (hasReactedToAttack(actor, attackId)) return false;
  const universal = Number(actor.system.reactions?.value) || 0;
  const defense    = forDefense ? (Number(actor.system.reactions?.defenseValue) || 0) : 0;
  return (universal + defense) > 0;
}

/** Списать Реакцию: сперва ограниченный пул на Избегание (если applicable), потом универсальный. */
export async function spendReaction(actor, { forDefense = false, attackId = "" } = {}) {
  if (!canSpendReaction(actor, { forDefense, attackId })) return false;
  if (!isEncounterActive() || !hasActionEconomy(actor)) return true;

  const defenseValue  = Number(actor.system.reactions?.defenseValue) || 0;
  if (forDefense && defenseValue > 0) {
    await actor.update({ "system.reactions.defenseValue": defenseValue - 1 });
  } else {
    const universal = Number(actor.system.reactions?.value) || 0;
    await actor.update({ "system.reactions.value": Math.max(0, universal - 1) });
  }
  if (attackId) await markReactedToAttack(actor, attackId);
  // Уклонение/Парирование — тоже «действие», тратящее Прицеливание впустую
  // (wdbc-1rno.5, см. _maybeClearAiming выше).
  await _maybeClearAiming(actor);
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
