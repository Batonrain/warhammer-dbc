// module/rules/parry-size.mjs
//
// Парирование атаки более крупного противника (стр. 12 корбука): «Парирование
// атаки персонажа, который на 1 Размер больше, требует Навык Parry,
// продвинутый на +10, на 2 Размера – +20, на 3 Размера – +30, на 4+ Размера –
// вообще невозможно.» Раньше в системе этого расчёта не было вовсе — у
// Крестового Блока (module/combat/defense.mjs, стр. 62) оставалась только
// текстовая пометка «предел Размера при Парировании книга поднимает на
// ступень, но самого предела в системе нет — напоминание столу, не расчёт».
// wdbc-1rno (Длань Кхорна) даёт этому расчёту первого настоящего потребителя
// на СТОРОНЕ АТАКУЮЩЕГО (+2 эффективного Размера этой рукой).

/**
 * @param {number} attackerSize
 * @param {number} defenderSize
 * @param {number} [extraAllowedSteps=0] — Крестовой Блок и подобное, поднимающее предел «невозможно» на ступень
 * @returns {{steps: number, mod: number, impossible: boolean}}
 *   steps — на сколько атакующий крупнее (0, если не крупнее вовсе);
 *   mod — штраф к порогу Парирования (0 или отрицательное число, кратное 10);
 *   impossible — true, если разница ступеней достигла предела «вообще невозможно».
 */
export function parrySizePenalty(attackerSize, defenderSize, extraAllowedSteps = 0) {
  const steps = Math.max(0, (Number(attackerSize) || 0) - (Number(defenderSize) || 0));
  const impossibleAt = 4 + Math.max(0, Number(extraAllowedSteps) || 0);
  if (steps >= impossibleAt) return { steps, mod: 0, impossible: true };
  return { steps, mod: steps ? -10 * steps : 0, impossible: false };
}
