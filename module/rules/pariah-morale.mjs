// module/rules/pariah-morale.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Пустота Парии и тесты Морали (корбук, Субрасы Людей — Пария; task-1452):
//  «Все, кроме Парий, должны перебрасывать успешные тесты Морали».
//
//  Переброс навязанный (не выбор игрока) и идёт ПОСЛЕ обычного броска с его
//  Преимуществом/Помехой: если итог — Успех, бросается новый d100, и остаётся
//  он, какой бы ни выпал. Кто обязан — решает rules/null-zones.mjs::
//  voidRerollsMorale; здесь только сам бросок. Отдельный файл, а не
//  null-zones.mjs, потому что тут бросается кубик (глобальный Roll), а
//  null-zones.mjs — чистая логика.
//  Зовут: rules/morale-test.mjs (Подавление, Шок, Паника) и combat/fear.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { testOutcome } from "./roll-outcome.mjs";

export const PARIAH_MORALE_REROLL_LABEL = "🕳 Пустота Парии: успешный тест Морали перебрасывается";

/**
 * @param {{roll:Roll, rv:number, rolls:Roll[], rerollNote:string}} first итог обычного броска
 * @param {number} eff Порог теста
 * @param {boolean} active обязан ли актор перебрасывать (voidRerollsMorale)
 * @returns {Promise<{roll:Roll, rv:number, rolls:Roll[], rerollNote:string, voidRerolled:boolean}>}
 */
export async function pariahVoidMoraleReroll(first, eff, active) {
  if (!active || !testOutcome(first.rv, eff).success) return { ...first, voidRerolled: false };
  const again = await new Roll("1d100").evaluate();
  const note = `<div class="roll-reroll-note">${PARIAH_MORALE_REROLL_LABEL}: отброшено ${first.rv}</div>`;
  return {
    roll: again, rv: again.total,
    rolls: [...(first.rolls ?? [first.roll]), again],
    rerollNote: (first.rerollNote || "") + note,
    voidRerolled: true
  };
}
