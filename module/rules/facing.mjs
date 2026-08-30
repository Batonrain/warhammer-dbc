// module/rules/facing.mjs
// ════════════════════════════════════════════════════════════════════════════
//  FACING / УГОЛ ОБЗОРА (wdbc-p5el) — чистая геометрия, без Foundry.
//
//  Книга формализует направление в нескольких местах (core.json): «Обычный
//  персонаж имеет угол обзора в 210°», Cloak «не защищает от атак с передней
//  арки 90°», сектор обстрела в Карауле (90°/180°/±15° в зависимости от
//  снаряжения), угол обзора пилота Дредноута (65°-210°), сектора обстрела
//  корабельных орудий (нос/борт/корма, void.json). Первая реализация —
//  Cloak (сама механика уже готова, wdbc-sg57); тот же примитив годится и
//  для Blinders, и для арок техники/корабля позже (wdbc-m38e/wdbc-jr93).
//
//  Соглашение по углам — как у Foundry TokenDocument.rotation: 0° — «на
//  север» (вверх по экрану, отрицательный Y в канвасных координатах),
//  положительные градусы — по часовой стрелке. Канвасные координаты сами по
//  себе с Y вниз, поэтому пеленг считается atan2(dx, -dy), а не привычным
//  atan2(dy, dx) — иначе направления вышли бы зеркальными.
//
//  Foundry-обвязка (чтение x/y/rotation живого токена, canvas) —
//  combat/facing.mjs.
// ════════════════════════════════════════════════════════════════════════════

/** Нормализует угол в градусах к диапазону [0, 360). */
export function normalizeAngle360(deg) {
  const a = deg % 360;
  return a < 0 ? a + 360 : a;
}

/** Нормализует угол в градусах к диапазону (-180, 180] — удобно для «насколько левее/правее». */
export function normalizeAngle180(deg) {
  const a = normalizeAngle360(deg);
  return a > 180 ? a - 360 : a;
}

/**
 * Пеленг из точки A в точку B, в градусах: 0° — на север, по часовой.
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @returns {number} [0, 360)
 */
export function bearingDegrees(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return 0; // токены в одной точке — направление не определено, «прямо по курсу»
  return normalizeAngle360(Math.atan2(dx, -dy) * (180 / Math.PI));
}

/**
 * Насколько пеленг отклоняется от текущего разворота наблюдателя: 0 — прямо
 * по курсу, ±90 — строго сбоку, ±180/-180 — строго сзади. Знак — по часовой
 * (положительный = правее курса), но большинству вызывающих нужен только
 * модуль (ширина дуги симметрична).
 * @param {number} observerRotation  токена-наблюдателя, градусы (0-360)
 * @param {number} bearing           пеленг до другой точки, градусы (0-360)
 * @returns {number} (-180, 180]
 */
export function relativeBearing(observerRotation, bearing) {
  return normalizeAngle180(bearing - observerRotation);
}

/**
 * Попадает ли пеленг в симметричную дугу заданной ширины, отсчитанную от
 * разворота наблюдателя. Ширина 90 — «передняя арка 90°» Плаща (по 45° на
 * сторону от курса); ширина 210 — базовый угол обзора персонажа (стр. …).
 * @param {number} observerRotation
 * @param {number} bearing
 * @param {number} arcWidthDegrees  полная ширина дуги (не половина)
 */
export function isWithinArc(observerRotation, bearing, arcWidthDegrees) {
  return Math.abs(relativeBearing(observerRotation, bearing)) <= arcWidthDegrees / 2;
}

/**
 * Была ли атака на observer нанесена из его передней дуги — то, что нужно
 * Cloak/Плащу («не защищает от атак с передней арки 90°»). Считает пеленг
 * ОТ защищающегося К атакующему и сравнивает с разворотом защищающегося.
 * @param {{x:number,y:number}} defenderPos
 * @param {number}               defenderRotation
 * @param {{x:number,y:number}} attackerPos
 * @param {number}               [arcWidthDegrees] по умолчанию 90 — как у Cloak
 */
export function isFrontArcHit(defenderPos, defenderRotation, attackerPos, arcWidthDegrees = 90) {
  return isWithinArc(defenderRotation, bearingDegrees(defenderPos, attackerPos), arcWidthDegrees);
}
