// module/rules/demon-destabilize.mjs
// ════════════════════════════════════════════════════════════════════════
//  Дестабилизация формы демона (корбук, «VI. МИСТИКА → РИТУАЛЫ → ФОРМЫ
//  ПРИЗЫВА», wdbc-1rno шаг для Рыцаря Бога): «По умолчанию демон в Истинной
//  Форме дестабилизируется и изгоняется в Варп через 1d10+2×W.b−Inf.b
//  (мин. 2) демона Раундов после призыва. За каждый уровень истончения
//  Завесы длительность призыва увеличивается в порядке Раунды > Минуты >
//  Часы > Дни > Месяцы > Неограниченно.»
//
//  «Уровень истончения Завесы» — это каждая ЦЕЛАЯ единица текущего total
//  Завесы (constants/veil.mjs::veilTotal), не категория veilLevelInfo
//  (тех всего 6 грубых категорий, а ступеней ровно 6 — но нулевая ступень
//  «Раунды» покрывает и total=0, и всё отрицательное: книга не даёт
//  ступени «короче Раунда», поэтому отрицательный total просто не опускает
//  ниже пола).
//
//  Только чистая арифметика — ни Foundry, ни worldTime здесь: превращение в
//  реальный тикающий срок (флаг на акторе, тик по updateWorldTime, пауза при
//  верховой езде, карточка ГМу) — в module/combat/demon-destabilize.mjs.
// ════════════════════════════════════════════════════════════════════════

import { SECONDS_PER_ROUND } from "./condition-duration.mjs";
import { SECONDS_PER_HOUR, SECONDS_PER_DAY, SECONDS_PER_MONTH } from "../constants/imperial-calendar.mjs";

const SECONDS_PER_MINUTE = 60;

// Раунды(0) > Минуты(1) > Часы(2) > Дни(3) > Месяцы(4) > Неограниченно(5, null).
const RUNG_SECONDS = [SECONDS_PER_ROUND, SECONDS_PER_MINUTE, SECONDS_PER_HOUR, SECONDS_PER_DAY, SECONDS_PER_MONTH, null];

/**
 * Длина одной единицы срока на этой ступени истончения Завесы, в секундах.
 * null — «Неограниченно»: демон не дестабилизируется вовсе.
 */
export function destabilizeRungSeconds(veilTotal) {
  const idx = Math.max(0, Math.min(RUNG_SECONDS.length - 1, Math.floor(Number(veilTotal) || 0)));
  return RUNG_SECONDS[idx];
}

/**
 * Полный срок до дестабилизации, в секундах. `rollTotal` — уже брошенный
 * 1d10+2×W.b−Inf.b (или 1d5+... для Вселения) демона, минимум применяется
 * здесь же (книга: «мин. 2», у Хоста «мин. 1» — параметризовано).
 * @returns {?number} null — «Неограниченно» (не дестабилизируется)
 */
export function destabilizeDurationSeconds(rollTotal, veilTotal, { minRoll = 2 } = {}) {
  const unitSec = destabilizeRungSeconds(veilTotal);
  if (unitSec == null) return null;
  return Math.max(minRoll, Math.round(Number(rollTotal) || 0)) * unitSec;
}
