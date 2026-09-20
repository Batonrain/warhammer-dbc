// module/combat/attack-limit.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Лимит Атак за Ход (стр. 12, wdbc-x1nz.2.30): «Персонаж может совершать
//  только одну Атаку в свой Ход». Экономика действий (action-economy.mjs)
//  сама по себе не мешала бы взять два Полудействия «Стандартная Атака»
//  подряд одним Ходом, пока хватает ОД — только этот отдельный счётчик и
//  мешает.
//
//  Хранится flags.warhammer-dbc.attackActionsThisTurn (число — НЕ путать с
//  attackedThisTurn, rules/turn-flags.mjs: тот список ОРУЖИЯ для вопроса
//  Мэн-Гош «чем бил в прошлый Ход», этот — счётчик самих действий-Атак).
//  Сбрасывается тем же тактом, что и остальные счётчики «до начала следующего
//  своего Хода» (TURN_SCOPED_FLAGS, action-economy.mjs::resetActionEconomy).
//
//  Определение «Атака» здесь — ровно клик кнопки «Бросок!» диалога атаки
//  (sheets/attack/dialog.mjs): пара Обеих Рук считается ОДНИМ таким кликом
//  (книга: «одно действие на две атаки», wdbc-3jlm), поэтому дуал-вилд не
//  задваивает счётчик сам по себе — canTakeAttackAction/takeAttackAction
//  вызываются диалогом один раз на подтверждение, до развилки на вторую руку.
//  Пересчёты уже брошенной атаки (сдвиг места попадания, Горжет, переброс за
//  Очко Судьбы — кнопки на уже готовой карточке, hooks.mjs) идут в обход
//  этого диалога и лимит не трогают: это не новая Атака, а правка исхода
//  прежней. Свободная Атака (Реакция вне своего Хода) и атаки Техники/HUD
//  тоже не проходят через этот диалог — те книга явно выводит из-под лимита
//  («некоторые способности позволяют... атаковать вне своего Хода»).
// ════════════════════════════════════════════════════════════════════════════

import { isEncounterActive, hasActionEconomy } from "./action-economy.mjs";
import { determinationToFightExtraAttack } from "../rules/determination-to-fight.mjs";

const FLAG_SCOPE = "warhammer-dbc";
const FLAG_KEY = "attackActionsThisTurn";

/** Лимит Атак за Ход — 1, Решительность Сражаться при отрицательных Ранах поднимает до 2 (стр. 62). */
export function attackActionLimit(actor) {
  return 1 + (determinationToFightExtraAttack(actor) ? 1 : 0);
}

/** Хватит ли лимита ещё на одну Атаку в этом Ходу — вне боя лимит не считается вовсе. */
export function canTakeAttackAction(actor) {
  if (!isEncounterActive() || !hasActionEconomy(actor)) return true;
  const used = Number(actor.getFlag(FLAG_SCOPE, FLAG_KEY)) || 0;
  return used < attackActionLimit(actor);
}

/** Засчитать Атаку в счётчик Хода — вызывать РОВНО ОДИН раз на подтверждённый клик «Бросок!». */
export async function takeAttackAction(actor) {
  if (!isEncounterActive() || !hasActionEconomy(actor)) return;
  const used = Number(actor.getFlag(FLAG_SCOPE, FLAG_KEY)) || 0;
  await actor.setFlag(FLAG_SCOPE, FLAG_KEY, used + 1);
}
