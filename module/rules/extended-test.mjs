// module/rules/extended-test.mjs
//
// Расширенный тест (корбук, стр. 25): Успехи копятся в Банк через отдельные
// броски, пока не наберётся нужное число. Здесь — чистая арифметика; само
// хранение банка (флаг актора `flags.warhammer-dbc.extendedTests.<key>`) —
// Foundry-обвязка в module/sheets/actor-sheet.mjs, как и с ассистентами
// (module/rules/assists.mjs даёт правила, чипы — дело листа).
//
// Критические Провалы «отнимают от 5 до 15 по решению ГМа» — книга явно отдаёт
// число на откуп мастеру, поэтому здесь этого нет: automation бы придумывала
// то, чего в правиле нет. applyGain просто не даёт банку уйти в минус, каким бы
// отрицательным ни было вручную введённое ГМом число.

/**
 * Название расширенного теста → безопасный ключ флага. Foundry разбирает точки
 * в имени поля как путь (`setProperty`), поэтому они, как и пробелы с прочими
 * не-буквенно-цифровыми символами, схлопываются в подчёркивание.
 */
export function extendedTestKey(label) {
  return String(label ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "") || "test";
}

/**
 * Применить прибавку к банку. `gain` — обычно степень успеха последнего броска
 * (0 или отрицательное на провале, кроме ручной пометки ГМа при Критическом
 * Провале — книга явно оставляет число ему).
 *
 * @param {number} accumulated текущий банк
 * @param {number} gain        прибавка (может быть отрицательной)
 * @param {number} target      сколько нужно набрать
 * @returns {{accumulated:number, done:boolean}}
 */
export function applyGain(accumulated, gain, target) {
  const next = Math.max(0, (Number(accumulated) || 0) + (Number(gain) || 0));
  return { accumulated: next, done: next >= (Number(target) || 0) };
}

/**
 * Список банков актора для панели «Расширенные тесты» (вкладка ПОКАЗАТЕЛИ).
 * Чистое преобразование объекта флагов в отображаемые строки — сама панель
 * (module/sheets/sheet-helpers.mjs) добавляет к каждой строке список
 * Навыков/Характеристик для селекта повторного броска.
 *
 * @param {?object} flagsObj  `actor.getFlag("warhammer-dbc", "extendedTests")`
 * @returns {Array<{key:string, label:string, accumulated:number, target:number,
 *   testKey:?string, done:boolean}>} по алфавиту названия
 */
export function extendedTestRows(flagsObj) {
  return Object.entries(flagsObj || {})
    .map(([key, v]) => {
      const accumulated = Number(v?.accumulated) || 0;
      const target = Number(v?.target) || 0;
      return {
        key, label: v?.label || key, accumulated, target,
        testKey: v?.testKey || null,
        done: target > 0 && accumulated >= target
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));
}
