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
 * «Обратить бросок» (Ветеран Долгой Войны, корбук, Элитные архетипы): поменять
 * местами десятки и единицы d100. 73 → 37, 7 («07») → 70, 100 («00») → 100.
 * @param {number} value результат d100 (1–100)
 * @returns {number}
 */
export function reverseD100(value) {
  const v = Number(value);
  if (!Number.isFinite(v) || v < 1 || v >= 100) return v;
  const tens = Math.floor(v / 10), units = v % 10;
  const out = units * 10 + tens;
  return out === 0 ? 100 : out;
}

/**
 * Обращение поверх уже выбранного броска: берётся обращённый, если он лучше
 * (на d100 лучше — меньше). Книга говорит «может обращать», а игрок всегда
 * возьмёт меньшее, поэтому система выбирает сама.
 * @param {{value:number, index:number, dropped:number[]}} picked
 * @returns {{value:number, index:number, dropped:number[], reversed:boolean, original:number}}
 */
export function applyReverse(picked) {
  if (!picked) return picked;
  const alt = reverseD100(picked.value);
  if (alt < picked.value) {
    return { ...picked, value: alt, dropped: [...picked.dropped, picked.value], reversed: true, original: picked.value };
  }
  return { ...picked, reversed: false, original: picked.value };
}

/**
 * @param {number[]} values броски в порядке выпадения
 * @param {"keepBest"|"keepWorst"|"reverse"} mode — "reverse" берёт ПЕРВЫЙ
 *   бросок и обращает его, если так лучше (остальные броски, если вызывающий
 *   по привычке бросил два, просто отброшены)
 * @returns {?{value:number, index:number, dropped:number[]}} null на пустом списке
 */
export function pickReroll(values, mode = "keepBest") {
  const list = Array.isArray(values) ? values.map(Number).filter(Number.isFinite) : [];
  if (!list.length) return null;
  if (mode === "reverse") {
    return applyReverse({ value: list[0], index: 0, dropped: list.slice(1) });
  }

  const better = mode === "keepWorst"
    ? (a, b) => a > b     // худший — больший бросок
    : (a, b) => a < b;    // лучший — меньший

  let index = 0;
  // Строгое сравнение оставляет первый из равных: иначе одинаковые броски
  // выбирались бы по-разному от запуска к запуску.
  for (let i = 1; i < list.length; i++) if (better(list[i], list[index])) index = i;

  return { value: list[index], index, dropped: list.filter((_, i) => i !== index) };
}
