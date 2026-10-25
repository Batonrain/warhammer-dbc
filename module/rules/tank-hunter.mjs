// module/rules/tank-hunter.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Tank Hunter / Охотник на Танки (core.json, «Стрелок», Sahara 3-5fbf):
//  «Он может раз в Ход свободным действием пройти тест на Common Lore (War)−10,
//  чтобы получить +2×I.b к Pen своего стрелкового оружия против этой модели
//  техники до конца боя. На 1-3 Провала он может попытаться на следующий Ход,
//  но на 4+ Провала он не может вспомнить слабые места этой модели до конца боя».
//
//  Решения владельца 24.10.2026: «модель техники» = актор-источник (все токены
//  одного актора — одна модель); кнопка «Опознать модель» в карточке атаки по
//  технике; память на акторе стрелка, чистится по концу боя (образец —
//  combat/hellish-resilience.mjs).
//
//  Чистые функции: бросков, Foundry и листа здесь нет. Поток (кнопка, бросок,
//  запись флага) — combat/tank-hunter.mjs.
//
//  Модуль не импортируется из rules/sources.mjs — круга через source-registry
//  нет (AGENTS.md, «Источники правил»).
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";

export const TANK_HUNTER = Object.freeze({ key: "rangedCore.core.tankHunter", name: "Tank Hunter" });

/** Флаг актора-стрелка: { combatId, models: { [modelId]: "known" | "lost" } }. */
export const TANK_HUNTER_FLAG = "tankHunterModels";
/** Метка «пытался в этом Ходу» (живёт до начала своего следующего Хода — rules/turn-flags.mjs). */
export const TANK_HUNTER_TURN_FLAG = "tankHunterThisTurn";
/** Штраф теста Common Lore (War). */
export const TANK_HUNTER_TEST_MOD = -10;

export const hasTankHunter = actor => hasAbility(actor, TANK_HUNTER.key, TANK_HUNTER.name, "talent");

/** Модель техники — актор-источник; «модели» есть только у техники. */
export function tankHunterModelId(targetActor) {
  return targetActor?.type === "vehicle" ? String(targetActor.id ?? "") || null : null;
}

/** Состояние модели в памяти стрелка ("known" | "lost" | "") — только текущего боя. */
export function tankHunterModelState(memory, { combatId, modelId }) {
  if (!memory || !modelId || !combatId || memory.combatId !== combatId) return "";
  return memory.models?.[modelId] ?? "";
}

/**
 * Исход теста. Успех — модель опознана; 1–3 Провала — можно попробовать в
 * следующий Ход (состояние не пишется, трата попытки — метка Хода); 4+ — до
 * конца боя эту модель не вспомнить.
 * @returns {"known"|"retry"|"lost"}
 */
export function tankHunterOutcome({ success, failureDegrees }) {
  if (success) return "known";
  return (Number(failureDegrees) || 0) >= 4 ? "lost" : "retry";
}

/** Новая память после исхода (нового объекта — старый не мутируется). */
export function tankHunterRemember(memory, { combatId, modelId, state }) {
  const same = memory?.combatId === combatId;
  const models = { ...(same ? memory.models : {}) };
  if (state === "known" || state === "lost") models[modelId] = state;
  return { combatId, models };
}

/**
 * Показывать ли кнопку «Опознать модель» на карточке: Талант, стрелковая атака
 * по технике, идёт бой, модель ещё не опознана и не потеряна, в этом Ходу не
 * пытались.
 */
export function tankHunterOffer(actor, { isMelee, targetActor, combatId, memory, triedThisTurn }) {
  if (isMelee || !hasTankHunter(actor)) return null;
  const modelId = tankHunterModelId(targetActor);
  if (!modelId || !combatId) return null;
  const state = tankHunterModelState(memory, { combatId, modelId });
  if (state === "known" || state === "lost" || triedThisTurn) return null;
  return { modelId };
}

/**
 * +2×I.b к Pen стрелкового оружия против опознанной модели.
 * @returns {number} 0, если Таланта нет, оружие рукопашное, цель не техника
 *   или модель не опознана в этом бою.
 */
export function tankHunterPenBonus(actor, { isMelee, targetActor, combatId, memory, intBonus }) {
  if (isMelee || !hasTankHunter(actor)) return 0;
  const modelId = tankHunterModelId(targetActor);
  if (!modelId) return 0;
  if (tankHunterModelState(memory, { combatId, modelId }) !== "known") return 0;
  return 2 * Math.max(0, Number(intBonus) || 0);
}
