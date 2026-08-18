// module/rules/reroll-pick.mjs
//
// Выбор броска из нескольких — вторая половина «Переброса». Первая (какие
// перебросы вообще доступны на этом тесте) живёт в rules/resolve-test.mjs.
//
// Отдельным файлом, а не строчкой в месте броска, по одной причине: на d100
// система «бросок не выше порога», и «лучший» здесь — МЕНЬШИЙ. Написанное
// по привычке Math.max тихо превратило бы переброс в наказание, и заметили бы
// это далеко не сразу. Правило записано один раз и проверено тестом.

/**
 * @param {number[]} values броски в порядке выпадения
 * @param {"keepBest"|"keepWorst"} mode
 * @returns {?{value:number, index:number, dropped:number[]}} null на пустом списке
 */
export function pickReroll(values, mode = "keepBest") {
  const list = Array.isArray(values) ? values.map(Number).filter(Number.isFinite) : [];
  if (!list.length) return null;

  const better = mode === "keepWorst"
    ? (a, b) => a > b     // худший — больший бросок
    : (a, b) => a < b;    // лучший — меньший

  let index = 0;
  // Строгое сравнение оставляет первый из равных: иначе одинаковые броски
  // выбирались бы по-разному от запуска к запуску.
  for (let i = 1; i < list.length; i++) if (better(list[i], list[index])) index = i;

  return { value: list[index], index, dropped: list.filter((_, i) => i !== index) };
}
