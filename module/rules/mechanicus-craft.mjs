// module/rules/mechanicus-craft.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Черты и Таланты элитных архетипов Механикум, которые вплетаются в смену
//  Крафта Мастерской (apps/craft-workshop.mjs) — чистые функции:
//
//   • Masterpiece Frame / Фрейм Шедевра (Архимагос): «может получать +30 для
//     тестов Крафта кибернетики и бионики и уменьшить вдвое нужный банк
//     Успехов, но тогда конечный продукт совместим только с его фреймом» —
//     выбор игрока на проект (proj.masterpieceFrame: null — ещё не спрошен);
//   • Chains of Production / Цепи Производства (Лакрималлус): «может
//     перебросить тест Крафта» — тот же переброс «лучший из двух», что у
//     Прототипирования (rules/craft-advantage.mjs::effectiveDiceMode).
// ════════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";

export const MASTERPIECE_CRAFT_BONUS = 30;
/** Категория Мастерской «Бионика и Мехадендриты» (constants/craft.mjs). */
export const BIONICS_CATEGORY = "bionics";

export const hasMasterpieceFrameTrait = a => hasItemNamed(a, "Masterpiece Frame", ["trait"]);
export const hasChainsOfProduction = a => hasItemNamed(a, "Chains of Production", ["talent"]);

/** Можно ли предложить Фрейм Шедевра этому проекту. */
export function masterpieceEligible(crafter, proj) {
  return !!crafter && proj?.mode === "craft" && !proj?.repair && proj?.categoryKey === BIONICS_CATEGORY
    && hasMasterpieceFrameTrait(crafter);
}

/** Выбран ли Фрейм Шедевра для проекта (и он к нему применим). */
export function masterpieceActive(crafter, proj) {
  return masterpieceEligible(crafter, proj) && proj.masterpieceFrame === true;
}

/** Банк с учётом Фрейма Шедевра: вдвое, с округлением вверх. */
export function masterpieceBank(bank, crafter, proj) {
  if (bank == null || !masterpieceActive(crafter, proj)) return bank;
  return Math.ceil(Number(bank) / 2);
}

/**
 * Надбавки смены от Черт/Талантов Механикум.
 * @returns {{bonus:number, reroll:boolean, lines:string[]}}
 */
export function mechanicusCraftShift(crafter, proj) {
  const lines = [];
  let bonus = 0;
  if (masterpieceActive(crafter, proj)) {
    bonus += MASTERPIECE_CRAFT_BONUS;
    lines.push(`Фрейм Шедевра: +${MASTERPIECE_CRAFT_BONUS} к тесту, Банк вдвое — изделие совместимо только с фреймом мастера.`);
  }
  const reroll = proj?.mode === "craft" && hasChainsOfProduction(crafter);
  if (reroll) lines.push("Цепи Производства: переброс теста Крафта (лучший из двух кубиков).");
  return { bonus, reroll, lines };
}
