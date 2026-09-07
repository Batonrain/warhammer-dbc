// module/helpers/blank-zero.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Поля-модификаторы («+N к Итогу Характеристики», «+N к Инициативе»,
//  постоянный модификатор Навыка) показываются ПУСТЫМИ, пока модификатора
//  нет, а ноль стоит подсказкой (placeholder).
//
//  Почему так, а не value="0": напечатанный в поле ноль никуда не девается
//  при вводе — курсор встаёт после него, и набранное число к нему прилипает.
//  Игрок вписывал 12 и получал 120, вписывал 5 — получал 50 (wdbc-mgh6), и
//  каждый раз сначала должен был выделить и стереть чужой ноль.
//
//  Обратная сторона пустого поля: пустой <input type="number"> приходит из
//  формы как null (Foundry, applications/ux/form-data-extended.mjs:200), а
//  схема этих полей — NumberField({ nullable: false }). Foundry такой null
//  при чистке заменит на initial, но это её обработка НЕВЕРНОГО значения, а
//  здесь значение верное: игрок сознательно очистил поле, и это «ноль».
//  Поэтому лист возвращает ноль сам — zeroBlankNumbers по метке
//  data-blank-zero (см. actor-sheet.mjs, _processFormData).
// ════════════════════════════════════════════════════════════════════════════

/**
 * Значение для value= поля-модификатора: ноль (в любом виде) — пустая строка,
 * всё остальное — как есть, включая отрицательные модификаторы.
 */
export function blankZero(value) {
  if (value === null || value === undefined || value === "") return "";
  return Number(value) === 0 ? "" : value;
}

/**
 * Возвращает нуль полям-модификаторам, которые игрок очистил: пустое числовое
 * поле приходит из формы как null, а схема ждёт число.
 * Мутирует переданный объект отправки и возвращает его же.
 *
 * @param {object}   formObject  плоский объект отправки формы (name → значение)
 * @param {string[]} names       имена полей, отмеченных data-blank-zero
 */
export function zeroBlankNumbers(formObject, names) {
  if (!formObject) return formObject;
  for (const name of names || []) {
    if (!Object.prototype.hasOwnProperty.call(formObject, name)) continue;
    const value = formObject[name];
    if (value === null || value === undefined || value === "") formObject[name] = 0;
  }
  return formObject;
}
