// module/rules/horde-geometry.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ГЕОМЕТРИЯ ТОКЕНОВ ОРДЫ — чистый счёт по клеткам сетки, без Foundry.
//
//  Орда занимает большую площадь, и два её правила упираются в клетки:
//   • «Прячась в Орде» — персонаж стоит ВНУТРИ орды (токены накладываются);
//   • «Орда против Орды» — в рукопашной чужая Орда считается за столько
//     персонажей, сколько клеток у них базового контакта.
//
//  Прямоугольник задаётся в клетках: { x, y, w, h }, где x/y — левая верхняя
//  клетка. Перевод токена Foundry в такой прямоугольник — combat/horde-tokens.mjs.
// ════════════════════════════════════════════════════════════════════════════

/** Приводит что угодно к целочисленному прямоугольнику клеток. */
function norm(rect) {
  return {
    x: Math.round(Number(rect?.x) || 0),
    y: Math.round(Number(rect?.y) || 0),
    w: Math.max(1, Math.round(Number(rect?.w) || 1)),
    h: Math.max(1, Math.round(Number(rect?.h) || 1))
  };
}

/** Список клеток прямоугольника: [{x,y}, …]. */
export function rectCells(rect) {
  const r = norm(rect);
  const cells = [];
  for (let dy = 0; dy < r.h; dy++)
    for (let dx = 0; dx < r.w; dx++) cells.push({ x: r.x + dx, y: r.y + dy });
  return cells;
}

/** Лежит ли клетка внутри прямоугольника. */
export function cellInRect(cell, rect) {
  const r = norm(rect);
  return cell.x >= r.x && cell.x < r.x + r.w && cell.y >= r.y && cell.y < r.y + r.h;
}

/** Сколько клеток у двух прямоугольников общие. */
export function overlapCells(a, b) {
  const ra = norm(a), rb = norm(b);
  const w = Math.min(ra.x + ra.w, rb.x + rb.w) - Math.max(ra.x, rb.x);
  const h = Math.min(ra.y + ra.h, rb.y + rb.h) - Math.max(ra.y, rb.y);
  return (w > 0 && h > 0) ? w * h : 0;
}

/** Накладываются ли прямоугольники хотя бы одной клеткой. */
export function rectsOverlap(a, b) {
  return overlapCells(a, b) > 0;
}

// Соседи клетки. По умолчанию считаем и диагональные: в квадратной сетке
// Foundry диагональный шаг такой же, как прямой, и боец в углу дотягивается
// до соседа наискось ровно так же, как до соседа сбоку.
const NEIGHBOURS_8 = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0],          [1,  0],
  [-1,  1], [0,  1], [1,  1]
];
const NEIGHBOURS_4 = [[0, -1], [-1, 0], [1, 0], [0, 1]];

/**
 * Клетки базового контакта двух прямоугольников.
 *
 * Считается по каждой стороне отдельно: у прямоугольников разной ширины число
 * соприкасающихся клеток у них разное, и «за скольких персонажей считать» —
 * вопрос про ту сторону, по которой бьют. Наложение контактом не считается:
 * клетка либо занята обоими (это «внутри»), либо соприкасается.
 *
 * @returns {{a:number, b:number, cells:{a:Array,b:Array}}}
 */
export function contactCells(rectA, rectB, { diagonal = true } = {}) {
  const offsets = diagonal ? NEIGHBOURS_8 : NEIGHBOURS_4;
  const ra = norm(rectA), rb = norm(rectB);

  const touching = (from, to) => rectCells(from).filter(cell =>
    !cellInRect(cell, to) &&
    offsets.some(([dx, dy]) => cellInRect({ x: cell.x + dx, y: cell.y + dy }, to)));

  const aCells = touching(ra, rb);
  const bCells = touching(rb, ra);
  return { a: aCells.length, b: bCells.length, cells: { a: aCells, b: bCells } };
}

/** Соприкасаются ли прямоугольники (есть хоть одна клетка контакта). */
export function rectsInContact(a, b, opts) {
  return contactCells(a, b, opts).a > 0;
}

/**
 * За сколько персонажей Орда-защитник считается для атакующей Орды.
 *
 * «Орда в рукопашной считает другую Орду как количество персонажей, равное
 * клеткам их базового контакта» — берём клетки со стороны защитника: именно
 * столько его бойцов достаёт до строя атакующего. Минимум 1, если Орды
 * вообще соприкоснулись, — иначе рукопашной бы не было.
 */
export function hordeVsHordeTargets(attackerRect, defenderRect, opts) {
  const { b } = contactCells(attackerRect, defenderRect, opts);
  return b > 0 ? b : (rectsOverlap(attackerRect, defenderRect) ? 1 : 0);
}
