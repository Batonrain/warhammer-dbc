// module/rules/roll-outcome.mjs
//
// Фаза 5b конвейера теста (docs/architecture-plan.md, этап 2): исход уже
// брошенного d100 против уже посчитанного порога. Одна и та же формула книги
// была переписана вручную минимум в 25 файлах — здесь она живёт один раз.
//
// Сам бросок (new Roll("1d100")) и выбор переброса (rules/reroll-pick.mjs)
// остаются на месте вызова: это объект Foundry, нужный карточке чата для
// анимации кубиков, и его централизация — отдельная задача.

/**
 * Исход теста: успех/провал и степень.
 *
 * @param {number}  rv           результат d100
 * @param {number}  threshold    итоговый порог теста
 * @param {object}  [opts]
 * @param {boolean} [opts.autoSuccess] тест засчитан успешным независимо от
 *   броска (Беспомощная цель, Infamy ≥ рейтинг Страха и т.п.). Степень всё
 *   равно считается от порога, но не может уйти ниже 1, даже если сам бросок
 *   формально был бы провалом.
 * @returns {{success: boolean, deg: number}}
 */
export function testOutcome(rv, threshold, { autoSuccess = false } = {}) {
  const success = autoSuccess || rv <= threshold;
  const deg = success
    ? Math.max(1, Math.floor((threshold - rv) / 10) + 1)
    : Math.floor((rv - threshold) / 10) + 1;
  return { success, deg };
}
