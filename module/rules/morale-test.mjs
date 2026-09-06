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
 *   применён переброс из реестра правил (для applyLordOfExoditesFailPenalty);
 *   parts — подписи применённых модификаторов для карточки.
 */
export async function rollMoraleTest(actor, baseThreshold) {
  const resolved = resolveTest({ actor, kind: "skill", char: "wp", morale: true });
  // autoMods наравне с mods (wdbc-ct65.1): Усталость и прочие штрафы состояния
  // тела — такие же правила реестра, просто без галочки. Спрашивать всё равно
  // негде: тест катается одной кнопкой.
  const applied = [...resolved.autoMods, ...resolved.mods];
  const bonus = applied.reduce((sum, m) => sum + (Number(m.value) || 0), 0);
  const parts = applied.map(m => `${m.label} ${m.value > 0 ? "+" : ""}${m.value}`);
  const eff = baseThreshold + bonus;
  const ruleReroll = resolved.rerolls.find(r => r.who !== "target");
  const reroll = ruleReroll ? { mode: ruleReroll.mode, rolls: ruleReroll.rolls, label: ruleReroll.label } : null;
  const { roll, rv, rolls, rerollNote } = await rollD100WithReroll(reroll);
  const { success, deg } = testOutcome(rv, eff);
  return { eff, bonus, parts, roll, rv, rolls, rerollNote, success, dof: success ? 0 : deg, usedReroll: !!reroll };
}
