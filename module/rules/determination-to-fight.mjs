// module/rules/determination-to-fight.mjs
// ════════════════════════════════════════════════════════════════════════
//  Determination To Fight / Решительность Сражаться (wdbc-niv7/wdbc-1rno,
//  Книга Аэльдари: Ответвления, Элитный архетип «Воин Троп»): «Имея
//  отрицательные раны, персонаж снижает весь получаемый урон на WP.b
//  (после поглощения, минимум 1) и получает +1 ОД, а лимит атак за ход
//  увеличивается до двух. Если в прошлом раунде находился в Защитной
//  Стойке, также снижает урон на WS.b (минимум 1) и получает бонус +30 к
//  тестам Парирования.»
//
//  «Отрицательные раны» = Тир Ран "dying" (module/rules/wound-tier.mjs,
//  displayKey критического уровня). WP.b-снижение — точка расширения
//  incomingDamageReduction, что уже читает module/combat/
//  damage.mjs::applyDamageToActor (wdbc-ls9d) — плоское снижение ПОСЛЕ
//  поглощения, отдельно от AP/T.b.
//
//  «Прошлый раунд в Защитной Стойке» — снимок system.meleeStance каждого
//  комбатанта на СМЕНЕ раунда (snapshotStanceForRoundStart, hooks.mjs::
//  updateCombat, тот же такт, что Middle of the Hunt/сброс Орд): к моменту
//  этого хука актор ещё не менял Стойку в новом раунде, поэтому текущее
//  значение — это ровно то, что было «в прошлом раунде». Флаг
//  flags.warhammer-dbc.stanceLastRound живёт на акторе (не на Combatant —
//  читатели ниже принимают actor, как justTheLightReduction), общий
//  примитив: любой будущий Талант с похожей формулировкой может читать тот
//  же флаг, не заводя свой хук. WS.b-снижение читает та же точка
//  incomingDamageReduction, +30 Парирование — module/combat/
//  defense.mjs::_performParry (единственное место, считающее порог теста
//  Парирования).
//
//  Оба клауза второго предложения читаются КАК ДОБАВКА к первому — «также»
//  подразумевает то же состояние «отрицательные раны», не независимый
//  триггер (иначе тир-3 элитный Талант с двумя Virtuoso-требованиями давал
//  бы игроку +30 Парирование почти всегда, просто стоя в Защитной Стойке —
//  не сочетается с темой «дерётся из последних сил, истекая кровью»).
//
//  «+1 ОД» — determinationToFightApBonus, читает module/combat/action-
//  economy.mjs::resetActionEconomy/effectiveActionPointsMax (тот же приём,
//  что effectiveDefenseReactionMax у Стойки: динамический бонус СВЕРХ
//  хранимой надбавки ActiveEffect, не запекается в поле).
//
//  НЕ смоделировано: «лимит атак за Ход увеличивается до двух» — стр. 32
//  книги («Персонаж может совершать только одну Атаку в свой Ход») этот
//  базовый лимит в системе НИГДЕ не проверяется вовсе (не только для этого
//  Таланта — attack-dialog.mjs пускает вторую отдельную Атаку за тот же Ход,
//  если хватает ОД, любому актору). Заводить счётчик атак и включать
//  проверку «раз в Ход» СРАЗУ для ВСЕХ акторов системы — отдельная и
//  гораздо более рискованная правка (меняет наблюдаемое поведение боя
//  живых столов, а не только этого одного Таланта), не делается молча в
//  рамках находки одного Таланта — см. bd wdbc-1rno, обсуждение с
//  пользователем.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

const STANCE_LAST_ROUND_FLAG = "stanceLastRound";

export function hasDeterminationToFight(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Determination To Fight"));
}

/** Доп. снижение входящего урона (WP.b, минимум 1) при отрицательных Ранах. */
export function determinationToFightReduction(actor) {
  if (actor?.system?.wounds?.tier !== "dying") return 0;
  if (!hasDeterminationToFight(actor)) return 0;
  return Math.max(1, Number(actor?.system?.characteristics?.wp?.bonus) || 0);
}

/** Смена Раунда: снимок Стойки каждого комбатанта — читается до конца следующего Раунда. */
export async function snapshotStanceForRoundStart(combat) {
  if (!combat) return;
  for (const combatant of combat.combatants ?? []) {
    const actor = combatant.actor;
    if (!actor?.system?.meleeStance) continue;
    await actor.setFlag("warhammer-dbc", STANCE_LAST_ROUND_FLAG, actor.system.meleeStance);
  }
}

function wasInDefensiveStanceLastRound(actor) {
  return actor?.getFlag?.("warhammer-dbc", STANCE_LAST_ROUND_FLAG) === "defensive";
}

/** Доп. снижение входящего урона (WS.b, минимум 1) при отрицательных Ранах + прошлый раунд в Защитной Стойке. */
export function determinationToFightWsReduction(actor) {
  if (actor?.system?.wounds?.tier !== "dying") return 0;
  if (!hasDeterminationToFight(actor)) return 0;
  if (!wasInDefensiveStanceLastRound(actor)) return 0;
  return Math.max(1, Number(actor?.system?.characteristics?.ws?.bonus) || 0);
}

/** Бонус +30 к тестам Парирования при отрицательных Ранах + прошлый раунд в Защитной Стойке. */
export function determinationToFightParryBonus(actor) {
  if (actor?.system?.wounds?.tier !== "dying") return 0;
  if (!hasDeterminationToFight(actor)) return 0;
  if (!wasInDefensiveStanceLastRound(actor)) return 0;
  return 30;
}

/** Доп. +1 ОД за Ход при отрицательных Ранах. */
export function determinationToFightApBonus(actor) {
  if (actor?.system?.wounds?.tier !== "dying") return 0;
  return hasDeterminationToFight(actor) ? 1 : 0;
}
