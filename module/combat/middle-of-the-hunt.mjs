// module/combat/middle-of-the-hunt.mjs
// ════════════════════════════════════════════════════════════════════════
//  The Middle of the Hunt / Середина Охоты (wdbc-1rno): «В начале 3-го и
//  4-го раундов персонаж поднимает значение своей инициативы на 10.» —
//  книжный текст оказался ПРОЩЕ раннего пересказа этой находки («доп.
//  Ход») — это плоский +10 к УЖЕ БРОШЕННОЙ Инициативе на конкретных
//  раундах, не лишний Ход и не Combatant.
//
//  Идемпотентно: если бонус этого раунда уже применён (тег на Combatant),
//  повторный вызов (напр. случайный второй updateCombat той же смены
//  раунда) не прибавит его снова.
//
//  НЕ смоделировано: «может выбрать до F.b союзников, чтобы увеличить их
//  инициативу на +2» — нужен выбор игрока (диалог), вне рамок авто-крюка
//  на смену раунда.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";

const BOOST_ROUNDS = new Set([3, 4]);
const BOOST_FLAG = "middleOfTheHuntRound";

export function hasMiddleOfTheHunt(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "The Middle of the Hunt"));
}

/** Смена Раунда: +10 к Инициативе каждого владельца Таланта на раундах 3 и 4, один раз за раунд. */
export async function processMiddleOfTheHuntRoundStart(combat) {
  if (!combat || !BOOST_ROUNDS.has(combat.round)) return;
  for (const combatant of combat.combatants ?? []) {
    if (!hasMiddleOfTheHunt(combatant.actor)) continue;
    if (combatant.getFlag?.("warhammer-dbc", BOOST_FLAG) === combat.round) continue;
    const current = Number(combatant.initiative) || 0;
    await combatant.update({ initiative: current + 10 });
    await combatant.setFlag("warhammer-dbc", BOOST_FLAG, combat.round);
  }
}
