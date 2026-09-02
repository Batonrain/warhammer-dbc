// module/combat/last-actor.mjs
// ════════════════════════════════════════════════════════════════════════
//  Last Actor / Последний Актёр (Черта Солитера, wdbc-1rno): «...бросает
//  трижды на инициативу (три хода в раунде)...» — только эта часть находки
//  смоделирована здесь, через module/combat/extra-turn.mjs (два ДОП.
//  Combatant того же актора при старте боя, тег "lastActor" — 1 обычный
//  Combatant + 2 доп. = 3 хода за раунд).
//
//  Каждый доп. Combatant получает СВОЙ бросок Инициативы (initiative:null
//  → Foundry сам катает при rollAll/rollNPC, как для обычного участника) —
//  «бросает трижды» книги буквально про три независимых броска, не про
//  один результат трижды.
//
//  НЕ смоделировано (см. capabilities.mjs) — остальные семь пунктов
//  находки (доп. Реакции/ОД, Парирование Flexible/любого размера,
//  безлимитный контроль в рукопашной, авто-контратака/избегание свободных
//  атак, бонус от разницы Ловкости, урон = разница инициатив, любые
//  рукопашные таланты на любые атаки) — каждый требует своей точки
//  интеграции в разных местах боевого конвейера, не входит в эту находку.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { extraTurnCount, grantExtraTurn } from "./extra-turn.mjs";

const LAST_ACTOR_SOURCE = "lastActor";
const LAST_ACTOR_EXTRA_TURNS = 2; // +2 доп. Хода = 3 хода в раунде вместе с обычным.

export function hasLastActor(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Last Actor"));
}

/**
 * Старт боя: выдаёт по 2 доп. Хода каждому «реальному» Combatant, чей актор
 * владеет Талантом — сами доп. Combatant Талант не несут (это Combatant,
 * не Item), поэтому фильтр по source исключает их из повторной выдачи.
 */
export async function processLastActorCombatStart(combat) {
  if (!combat) return;
  const real = [...(combat.combatants ?? [])].filter(c => !c.getFlag?.("warhammer-dbc", "extraTurnSource"));
  for (const combatant of real) {
    const actor = combatant.actor;
    if (!hasLastActor(actor)) continue;
    const already = extraTurnCount(combat, combatant.actorId, LAST_ACTOR_SOURCE);
    for (let i = already; i < LAST_ACTOR_EXTRA_TURNS; i++) {
      await grantExtraTurn(combat, {
        actorId: combatant.actorId, tokenId: combatant.tokenId, source: LAST_ACTOR_SOURCE
      });
    }
  }
}
