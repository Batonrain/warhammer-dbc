// module/combat/tank-hunter.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Tank Hunter / Охотник на Танки — поток (правила и числа — rules/tank-hunter.mjs).
//
//  • tankHunterForAttack — для combat/attack.mjs: +2×I.b к Pen против опознанной
//    модели и данные кнопки «Опознать модель» для карточки атаки по технике;
//  • resolveTankHunterClick — клик по кнопке: Common Lore (War)−10, исход пишется
//    флагом на актора-стрелка (память боя), «пытался в этом Ходу» — метка Хода;
//  • clearTankHunterMemory — конец боя (hooks.mjs, deleteCombat).
//
//  Опознавать можно только в бою: «раз в Ход» и «до конца боя» вне боя нечем
//  мерить. Попытка тратится независимо от исхода — «может раз в Ход пройти тест».
// ════════════════════════════════════════════════════════════════════════════

import { findGroupEntry } from "../constants/skill-specializations.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import {
  TANK_HUNTER_FLAG, TANK_HUNTER_TURN_FLAG, TANK_HUNTER_TEST_MOD, hasTankHunter, tankHunterModelId,
  tankHunterOutcome, tankHunterRemember, tankHunterOffer, tankHunterPenBonus
} from "../rules/tank-hunter.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";
import { combatOfActor } from "./actor-combat.mjs";

const NS = "warhammer-dbc";

const memoryOf = actor => actor?.getFlag?.(NS, TANK_HUNTER_FLAG) ?? null;

/**
 * Для атаки: прибавка к Pen и предложение кнопки.
 * @returns {{penBonus:number, offer:null|{modelId:string, targetName:string, targetUuid:string}}}
 */
export function tankHunterForAttack(actor, { isMelee, targetActor }) {
  const none = { penBonus: 0, offer: null };
  if (isMelee || !targetActor || !hasTankHunter(actor)) return none;
  const combatId = combatOfActor(actor)?.id ?? "";
  const memory = memoryOf(actor);
  const penBonus = tankHunterPenBonus(actor, {
    isMelee, targetActor, combatId, memory, intBonus: actor.system?.characteristics?.int?.bonus });
  const offer = tankHunterOffer(actor, {
    isMelee, targetActor, combatId, memory, triedThisTurn: !!actor.getFlag?.(NS, TANK_HUNTER_TURN_FLAG) });
  return { penBonus, offer: offer ? { ...offer, targetName: targetActor.name ?? "", targetUuid: targetActor.uuid ?? "" } : null };
}

/** Порог Common Lore (War): запись специализации, иначе Int−20 как нетренированный. */
function loreThreshold(actor) {
  const entry = findGroupEntry(actor, "commonLore", "War");
  const int = Number(actor?.system?.characteristics?.int?.total) || 20;
  return Number.isFinite(entry?.total) ? entry.total : int - 20;
}

/**
 * Клик «Опознать модель». Гейты повторяют предложение карточки: чужой клик по
 * старой карточке не должен дать второй попытки в Ход или переписать исход.
 */
export async function resolveTankHunterClick(attackerUuid, targetUuid) {
  const actor = await fromUuid(attackerUuid).catch(() => null);
  const target = await fromUuid(targetUuid).catch(() => null);
  if (!actor) return ui.notifications.warn("⚠️ Стрелок не найден.");
  if (!actor.isOwner) return ui.notifications.warn("⚠️ Нет прав на этого актора.");
  const targetActor = target?.actor ?? target;
  const modelId = tankHunterModelId(targetActor);
  if (!modelId) return ui.notifications.warn("⚠️ Цель — не техника.");
  const combat = combatOfActor(actor);
  if (!combat) return ui.notifications.warn("⚠️ Охотник на Танки: опознать модель можно только в бою.");

  const { offer } = tankHunterForAttack(actor, { isMelee: false, targetActor });
  if (!offer) return ui.notifications.warn(`⚠️ ${actor.name}: эту модель уже опознали или потеряли в этом бою, либо попытка этого Хода потрачена.`);

  // Попытка тратится сразу: повторный клик по той же карточке до броска ничего не даст.
  await actor.setFlag(NS, TANK_HUNTER_TURN_FLAG, true);

  const base = loreThreshold(actor);
  const ruleMods = collectTestMods(actor, { kind: "skill", skill: "commonLore", char: "int" });
  const threshold = base + TANK_HUNTER_TEST_MOD + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const { success, deg } = testOutcome(rv, threshold);
  const state = tankHunterOutcome({ success, failureDegrees: deg });
  if (state === "known" || state === "lost") {
    const prev = memoryOf(actor);
    // setFlag в Foundry СЛИВАЕТ вложенные объекты: память прошлого боя, оставшаяся под другим combatId,
    // иначе пережила бы запись нового боя. Поэтому при смене боя флаг сперва снимается.
    if (prev && prev.combatId !== combat.id) await actor.unsetFlag(NS, TANK_HUNTER_FLAG);
    await actor.setFlag(NS, TANK_HUNTER_FLAG, tankHunterRemember(prev, { combatId: combat.id, modelId, state }));
  }

  const bonus = 2 * Math.max(0, Number(actor.system?.characteristics?.int?.bonus) || 0);
  const outcome = state === "known"
    ? `<span class="roll-success">Успех — слабые места модели «${esc(targetActor.name)}» опознаны: +${bonus} к Pen стрелкового оружия против неё до конца боя (2×I.b).</span>`
    : state === "retry"
      ? `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}: не вспомнил, но можно попробовать в следующий Ход.</span>`
      : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}: слабые места этой модели до конца боя не вспомнить.</span>`;
  await postTestCard(actor, {
    icon: "🎯", title: `Охотник на Танки — ${esc(actor.name)} → ${esc(targetActor.name)}`,
    threshold: rollStatLine({ label: "Common Lore (War)−10", base, parts: [`Охотник на Танки ${TANK_HUNTER_TEST_MOD}`, ...ruleMods.parts], threshold, rv }),
    outcome
  }, { rolls: [roll] });
  return state;
}

/** Конец боя: память опознанных моделей не переживает бой (hooks.mjs, deleteCombat). */
export async function clearTankHunterMemory(combat) {
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor;
    if (actor?.getFlag?.(NS, TANK_HUNTER_FLAG)) await actor.unsetFlag(NS, TANK_HUNTER_FLAG);
  }
}
