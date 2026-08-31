// module/rules/psy-range.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Числовая дальность психосилы (wdbc-iy0c) — парсер книжного текста поля
//  `system.range` в метры, для автовердикта «в пределах / вне» по измеренной
//  дистанции до цели. Чистая логика, без Foundry.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Дальность психосилы в метрах — из текста вида «30м», «PR×10м», «PR×1км».
 * Декоративный суффикс «(Аура)» игнорируется. Составные дальности через «/»
 * («Касание / PR×10м», «PR×5/20/50м») намеренно НЕ разбираются — какая из
 * альтернатив актуальна, решает игрок по описанию силы, автовердикт по
 * произвольно выбранной половине был бы просто гаданием. Текстовые дальности
 * («Касание», «Сам», «Особая», «Неогранич.», «В системе», «Ближний бой») —
 * возвращают null, вызывающий код не показывает вердикт вовсе.
 * @param {string} rangeText
 * @param {number} [prValue]  текущий Пси-Рейтинг (тPR) — множитель для «PR×N»
 * @returns {number|null}
 */
export function parseRangeMeters(rangeText, prValue = 0) {
  if (!rangeText) return null;
  const text = String(rangeText).replace(/\([^)]*\)/g, "").trim();
  if (!text || text.includes("/")) return null;
  const m = text.match(/^(PR\s*[×x]\s*)?(\d+(?:[.,]\d+)?)\s*(км|м)$/i);
  if (!m) return null;
  const num = parseFloat(m[2].replace(",", "."));
  const meters = /^км$/i.test(m[3]) ? num * 1000 : num;
  return m[1] ? meters * (Number(prValue) || 0) : meters;
}

/**
 * Вердикт «до цели: X м — в пределах/вне» по измеренной дистанции и дальности
 * силы. Возвращает null, если считать нечего (нет измерения или дальность не
 * числовая) — вызывающий код тогда ничего не показывает, как раньше.
 * @param {number|null} edgeM      измеренная дистанция до цели, метры
 * @param {number|null} rangeMeters  дальность силы, метры (см. parseRangeMeters)
 * @returns {{inBounds:boolean, edgeM:number, rangeMeters:number}|null}
 */
export function rangeVerdict(edgeM, rangeMeters) {
  if (!Number.isFinite(edgeM) || !Number.isFinite(rangeMeters)) return null;
  return { inBounds: edgeM <= rangeMeters, edgeM, rangeMeters };
}
