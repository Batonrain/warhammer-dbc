// module/documents/combatant.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Бросок «с Преимуществом» на боевую Инициативу — ДРУГОЙ механизм, чем
//  Inf-Преимущество Эльданара (apps/creation.mjs::rollFormulaAdvantage): это не
//  разовый бросок Мастера создания, а сам боевой трекер, каждый бой заново.
//
//  СКОЛЬКО РАЗ КИДАТЬ — не «да/нет», а число, и оно СКЛАДЫВАЕТСЯ из
//  возможностей актора (wdbc-7zzr, module/rules/initiative.mjs::initiativeRolls):
//  база 1 бросок, Серый Человек/Отеший и Эльдарское Тело дают +2, Талант
//  «Молниеносные Рефлексы» +1. Отсюда 2 броска у одного Таланта, 3 у расы и 4 у
//  эльдара с Молниеносными Рефлексами — ровно как в Книге Аэльдари. Прежняя
//  константа «всегда трижды» (wdbc-0tzr) осталась только умолчанием аргумента.
//
//  Реализация — не «кинуть формулу N раз и выбрать больший ИТОГ» (как у Inf),
//  а подмена кубика инициативы на Foundry-модификатор «kh» (keep highest):
//  "1d10 + @initiative + @initiativeMod" → "4d10kh1 + @initiative + @initiativeMod".
//  Математически это ровно то же самое — модификаторы после кубика константны
//  для всех N бросков одной формулы, поэтому какой из N бросков даст больший
//  ИТОГ не зависит от того, прибавлены модификаторы к каждому броску отдельно
//  или один раз к уже выбранному лучшему кубику. Проще и надёжнее собственного
//  цикла с N отдельными Roll: не нужно вручную собирать чат-карточку и
//  переиспользуется штатный Combat#rollInitiative целиком (сама evaluate() и
//  чат — уже его код, не наш).
// ════════════════════════════════════════════════════════════════════════════

import { initiativeRolls, INITIATIVE_ADVANTAGE_CAPABILITY } from "../rules/initiative.mjs";

export { INITIATIVE_ADVANTAGE_CAPABILITY };
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
    // Сколько раз кидать — не «да/нет», а число: возможности складываются
    // (Эльдарское Тело 3 + Молниеносные Рефлексы = 4, как в Книге Аэльдари).
    // Считает rules/initiative.mjs, здесь только подмена кубика на kh1.
    const rolls = this.actor ? initiativeRolls(this.actor) : 1;
    if (rolls > 1) formula = applyInitiativeAdvantage(formula, rolls);
    const rollData = this.actor?.getRollData() || {};
    return foundry.dice.Roll.create(formula, rollData);
  }
}
