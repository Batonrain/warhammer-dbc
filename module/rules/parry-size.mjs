// module/rules/parry-size.mjs
//
// Парирование атаки более крупного противника (стр. 12 корбука): «Парирование
// атаки персонажа, который на 1 Размер больше, требует Навык Parry,
// продвинутый на +10, на 2 Размера – +20, на 3 Размера – +30, на 4+ Размера –
// вообще невозможно.» Это НЕ штраф к порогу броска — это условие, допускающее
// сам тест: недостаточно продвинутый Навык не даёт даже ПОПЫТАТЬСЯ парировать
// (тест не предпринимается вовсе), а не парирует с трудом на пониженном
// пороге. Раньше в системе этого расчёта не было вовсе — у Крестового Блока
// (module/combat/defense.mjs, стр. 62) оставалась только текстовая пометка
// «предел Размера при Парировании книга поднимает на ступень, но самого
// предела в системе нет — напоминание столу, не расчёт».
// wdbc-1rno (Длань Кхорна) даёт этому расчёту первого настоящего потребителя
// на СТОРОНЕ АТАКУЮЩЕГО (+2 эффективного Размера этой рукой).

/**
 * @param {number} attackerSize
 * @param {number} defenderSize
 * @param {number} rankBonus — бонус ТЕКУЩЕГО Ранга Навыка Parry защищающегося
 *   (SKILL_RANKS[...].bonus: −20 нетренированное … +30 эксперт, module/
 *   constants/characteristics.mjs) — требование книги сверяется с уже
 *   вложенным опытом, а не с самим тестом.
 * @param {number} [extraAllowedSteps=0] — Крестовой Блок и подобное, поднимающее книжный предел «вообще невозможно» на ступень
 * @returns {{steps: number, requiredBonus: ?number, allowed: boolean, impossible: boolean}}
 *   steps — на сколько атакующий крупнее (0, если не крупнее вовсе);
 *   requiredBonus — минимальный бонус Ранга Parry, который требует книга для
 *     этой разницы (null, если разница 0 или разница уже за пределом «вообще
 *     невозможно» — там Ранг не помогает совсем);
 *   allowed — можно ли ВООБЩЕ предпринимать тест Парирования при текущем
 *     Ранге (false и когда Ранг не дотягивает, и когда impossible);
 *   impossible — true, если разница ступеней достигла книжного предела «вообще
 *     невозможно» — это НЕ лечится никаким Рангом, в отличие от allowed:false
 *     при недостающем Ранге.
 */
export function parrySizeGate(attackerSize, defenderSize, rankBonus, extraAllowedSteps = 0) {
  const steps = Math.max(0, (Number(attackerSize) || 0) - (Number(defenderSize) || 0));
  const impossibleAt = 4 + Math.max(0, Number(extraAllowedSteps) || 0);
  if (steps >= impossibleAt) return { steps, requiredBonus: null, allowed: false, impossible: true };
  if (steps === 0) return { steps, requiredBonus: null, allowed: true, impossible: false };
  const requiredBonus = steps * 10;
  const allowed = (Number(rankBonus) ?? -20) >= requiredBonus;
  return { steps, requiredBonus, allowed, impossible: false };
}
