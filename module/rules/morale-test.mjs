// module/rules/morale-test.mjs
// ════════════════════════════════════════════════════════════════════════
//  Тесты Морали БЕЗ диалога (Подавление, выход из Шока, Паника от Горения —
//  все три катаются одной кнопкой в чате, без формы с галочками). Бонусы
//  (rollBonus) и переброс (rollMode) из реестра правил с областью "morale"
//  (module/rules/resolve-test.mjs::effectAppliesTo) применяются здесь
//  автоматически: спросить игрока негде, в отличие от Страха/общего диалога
//  Навыка, где те же правила показываются галочками (roll-mods.mjs).
// ════════════════════════════════════════════════════════════════════════

import { resolveTest } from "./resolve-test.mjs";
import { rollD100WithReroll } from "./test-kind-widget.mjs";
import { testOutcome } from "./roll-outcome.mjs";

/**
 * @param {Actor} actor
 * @param {number} baseThreshold порог ДО бонусов реестра правил (напр. W+0)
 * @returns {Promise<{eff:number, bonus:number, roll:Roll, rv:number, rolls:Roll[],
 *   rerollNote:string, success:boolean, dof:number, usedReroll:boolean}>}
 *   dof — степень провала (0 при успехе); usedReroll — был ли доступен и
 *   применён переброс из реестра правил (для applyLordOfExoditesFailPenalty).
 */
export async function rollMoraleTest(actor, baseThreshold) {
  const resolved = resolveTest({ actor, kind: "skill", char: "wp", morale: true });
  const bonus = resolved.mods.reduce((sum, m) => sum + (Number(m.value) || 0), 0);
  const eff = baseThreshold + bonus;
  const ruleReroll = resolved.rerolls.find(r => r.who !== "target");
  const reroll = ruleReroll ? { mode: ruleReroll.mode, rolls: ruleReroll.rolls, label: ruleReroll.label } : null;
  const { roll, rv, rolls, rerollNote } = await rollD100WithReroll(reroll);
  const { success, deg } = testOutcome(rv, eff);
  return { eff, bonus, roll, rv, rolls, rerollNote, success, dof: success ? 0 : deg, usedReroll: !!reroll };
}
