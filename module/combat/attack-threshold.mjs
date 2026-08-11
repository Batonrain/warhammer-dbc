// module/combat/attack-threshold.mjs
//
// Фаза 4 конвейера (docs/architecture-plan.md, этап 2) со стороны атаки: что
// диалог делает с отмеченными галочками, прежде чем бросить кубик.
//
// Тот же порядок, что у диалога броска навыка
// ([actor-sheet.mjs](../sheets/actor-sheet.mjs), `_showSkillRollDialog`):
// модификаторы складываются, и только потом итоговый штраф ополовинивается.
// Разойдись эти два места — одно и то же правило («Закалка» Схолы Прогениум)
// считалось бы в атаке иначе, чем в тесте навыка.

/**
 * Итоговый порог теста атаки.
 *
 * @param {number}   base          порог до ситуативных модификаторов
 * @param {number[]} mods          всё отмеченное: режим, прицел, обстановка, правила
 * @param {boolean}  halvePenalty  ополовинить итоговый штраф
 */
export function attackThreshold({ base, mods = [], halvePenalty = false }) {
  let sum = mods.reduce((acc, m) => acc + (Number(m) || 0), 0);
  // Округление в пользу игрока: −25 даёт −12, а не −13.
  if (halvePenalty && sum < 0) sum = -Math.floor(Math.abs(sum) / 2);
  return base + sum;
}
