// module/rules/squeeze.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Стены и Двери (wdbc-x1nz.2, стр. 31) — чистая геометрия, без Foundry.
//  «Он может без замедления двигаться через проходы шириной до половины
//  его Базы. Когда персонаж... вжимается и протискивается... ГМ МОЖЕТ
//  давать штрафы на тесты, связанные с движением или уклонением от атак...
//  применимы штрафы от длинного рукопашного оружия на атаку. Ключевое
//  слово здесь «может»: ... условности можно и опустить».
//
//  Книга сознательно не даёт числа — только ДЕТЕКЦИЯ факта протискивания
//  (проём уже половины Базы), сам штраф решает ГМ (combat/squeeze.mjs).
//  Только двери (WALL_DOOR_TYPES.DOOR/SECRET) — обычный проём между двумя
//  концами стен без формальной двери геометрически не выделить надёжно
//  (нет единого сегмента, чью длину можно было бы измерить), это
//  заведомое ограничение.
// ═══════════════════════════════════════════════════════════════════════════

/** Знак площади треугольника ABC (ориентация) — тот же приём, что orient2dFast Foundry. */
function orient(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Пересекает ли отрезок AB отрезок CD. */
export function segmentsIntersect(a, b, c, d) {
  const xa = orient(a, b, c), xb = orient(a, b, d);
  if (!xa && !xb) return false;
  const xab = xa * xb <= 0;
  const xcd = orient(c, d, a) * orient(c, d, b) <= 0;
  return xab && xcd;
}

/** Длина отрезка в клетках сетки. */
function segmentLengthCells(c, d, cellPx) {
  return Math.hypot(d.x - c.x, d.y - c.y) / (cellPx || 100);
}

/**
 * Самый узкий дверной проём, который пересекло движение — или null, если
 * движение ни одну дверь не пересекло.
 * @param {{x:number,y:number}} moveFrom  старая позиция ЦЕНТРА токена, px
 * @param {{x:number,y:number}} moveTo    новая позиция ЦЕНТРА токена, px
 * @param {Array<{c:[number,number,number,number]}>} doorWalls  стены-двери сцены (WallDocument.c)
 * @param {number} cellPx  пикселей на клетку сетки
 * @returns {number|null}  ширина проёма в клетках
 */
export function narrowestDoorCrossed(moveFrom, moveTo, doorWalls, cellPx) {
  let narrowest = null;
  for (const wall of doorWalls ?? []) {
    const coords = wall?.c;
    if (!Array.isArray(coords) || coords.length !== 4) continue;
    const c = { x: coords[0], y: coords[1] }, d = { x: coords[2], y: coords[3] };
    if (!segmentsIntersect(moveFrom, moveTo, c, d)) continue;
    const width = segmentLengthCells(c, d, cellPx);
    if (narrowest === null || width < narrowest) narrowest = width;
  }
  return narrowest;
}

/**
 * Протискивание ли это — проём уже половины Базы (стр. 31: «без замедления...
 * до половины его Базы», т.е. РОВНО половина ещё без замедления, уже
 * половины — теснота).
 * @param {number} doorWidthCells
 * @param {number} baseSizeCells  2 или 3 (rules/tactical-map.mjs::baseSizeCells)
 */
export function isSqueeze(doorWidthCells, baseSizeCells) {
  return Number(doorWidthCells) < Number(baseSizeCells) / 2;
}
