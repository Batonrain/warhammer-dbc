// module/documents/combatant.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Бросок «с Преимуществом» на боевую Инициативу (Серый Человек/Oteshii,
//  wdbc-0tzr) — ДРУГОЙ механизм, чем Inf-Преимущество Эльданара
//  (apps/creation.mjs::rollFormulaAdvantage): это не разовый бросок Мастера
//  создания, а сам боевой трекер, каждый бой заново.
//
//  Реализация — не «кинуть формулу N раз и выбрать больший ИТОГ» (как у Inf),
//  а подмена кубика инициативы на Foundry-модификатор «kh» (keep highest):
//  "1d10 + @initiative + @initiativeMod" → "3d10kh1 + @initiative + @initiativeMod".
//  Математически это ровно то же самое — модификаторы после кубика константны
//  для всех N бросков одной формулы, поэтому какой из N бросков даст больший
//  ИТОГ не зависит от того, прибавлены модификаторы к каждому броску отдельно
//  или один раз к уже выбранному лучшему кубику. Проще и надёжнее собственного
//  цикла с N отдельными Roll: не нужно вручную собирать чат-карточку и
//  переиспользуется штатный Combat#rollInitiative целиком (сама evaluate() и
//  чат — уже его код, не наш).
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";

export const INITIATIVE_ADVANTAGE_CAPABILITY = "combat.initiativeAdvantage";
const INITIATIVE_ADVANTAGE_ROLLS = 3;

/** Первый кубик формулы (`NdX`) — заменяет N на N*rolls и добавляет `kh1`. */
export function applyInitiativeAdvantage(formula, rolls = INITIATIVE_ADVANTAGE_ROLLS) {
  return String(formula).replace(/(\d*)d(\d+)/, (_, count, faces) => {
    const n = Math.max(1, Number(count) || 1) * rolls;
    return `${n}d${faces}kh1`;
  });
}

export class WarhammerCombatant extends Combatant {
  /** @override */
  getInitiativeRoll(formula) {
    formula = formula || this._getInitiativeFormula();
    if (this.actor && hasRuleFlag(this.actor, INITIATIVE_ADVANTAGE_CAPABILITY)) {
      formula = applyInitiativeAdvantage(formula);
    }
    const rollData = this.actor?.getRollData() || {};
    return foundry.dice.Roll.create(formula, rollData);
  }
}
