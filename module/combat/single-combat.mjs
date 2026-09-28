// module/combat/single-combat.mjs
//
// Обвязка Черты «Бой Один На Один» (Палач) над сценой: чистая логика —
// module/rules/single-combat.mjs, контакт токенов — combat/free-attack.mjs
// (enemyContactTokenDocs, та же геометрия Базового/Глубокого контакта, что у
// Свободной Атаки и «Связан в Рукопашной»).
//
// Без токена на сцене (лист открыт вне боя, Vitest) — боя один на один нет:
// прибавки не будет, как и у Дуэлянтского без измеренного контакта.

import { hasRuleFlag } from "../rules/flags.mjs";
import { SINGLE_COMBAT, isSingleCombatEngagement, singleCombatExtraDeg, singleCombatIgnoresUnnaturalTie }
  from "../rules/single-combat.mjs";
import { enemyContactTokenDocs } from "./free-attack.mjs";

function tokenDocOf(actor) {
  const tokens = actor?.getActiveTokens?.(false, true) ?? [];
  return tokens[0] ?? null;
}

/**
 * Палач сейчас в бою один на один: у него есть Черта, на сцене ровно один
 * враг в контакте, и у того врага нет в контакте никого, кроме Палача.
 * @param {Actor} actor
 * @param {object} [deps]  подмена для тестов: { hasFlag, tokenOf, enemiesOf }
 */
export function singleCombatEngaged(actor, deps = {}) {
  const hasFlag = deps.hasFlag ?? hasRuleFlag;
  const tokenOf = deps.tokenOf ?? tokenDocOf;
  const enemiesOf = deps.enemiesOf ?? enemyContactTokenDocs;
  if (!actor || !hasFlag(actor, SINGLE_COMBAT)) return false;
  const token = tokenOf(actor);
  if (!token) return false;
  const enemies = enemiesOf(token) ?? [];
  if (enemies.length !== 1) return false;
  const foeEnemies = enemiesOf(enemies[0]) ?? [];
  return isSingleCombatEngagement({ enemiesInContact: enemies.length, foeEnemiesInContact: foeEnemies.length });
}

/** +1 к степени успешного теста WS/S/A в бою один на один (0 — иначе). */
export function singleCombatBonus(actor, { success, charKey }, deps) {
  if (!success) return 0;
  return singleCombatExtraDeg({ engaged: singleCombatEngaged(actor, deps), success, charKey });
}

/** Во встречном WS/A «ничья» Сверхъестественной Характеристики соперника не действует. */
export function singleCombatNoUnnaturalTie(actor, charKey, deps) {
  if (!singleCombatIgnoresUnnaturalTie({ engaged: true, charKey })) return false;
  return singleCombatEngaged(actor, deps);
}

/** Строка карточки теста. */
export const SINGLE_COMBAT_LINE = `<div class="roll-threshold">⚔ Бой Один На Один: +1 Успех</div>`;
