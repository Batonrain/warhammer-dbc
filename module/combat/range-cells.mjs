// module/combat/range-cells.mjs
// ════════════════════════════════════════════════════════════════════════
//  Подсветка КЛЕТОК сетки сцены в пределах атаки (wdbc-arqo) — заменяет
//  собой концентрические кольца range-rings.mjs::showWeaponRangeRing/
//  showMeleeReachRing на клетчатых/гексагональных сценах, по образцу уже
//  сделанной подсветки достижимости движения (reachable-cells.mjs). Круги
//  (range-rings.mjs) остаются резервным вариантом на Gridless — там
//  клеточная подсветка не имеет смысла, тот же принцип, что и у движения.
//
//  В ОТЛИЧИЕ от reachable-cells.mjs — НЕ Dijkstra-обход, а геометрический
//  радиус (по прямой дистанции от токена): дальность атаки не зависит от
//  Трудного Ландшафта (в отличие от движения), «докуда докидывает оружие»
//  проверяется по прямой видимости/расстоянию, а не по стоимости клеток.
//
//  ОДИН цвет (красный) на весь предел дальности — не банды по полосам (В
//  упор/Короткая/Боевая/Длинная/Предельная). Полосы дальности остаются
//  только в диалоге атаки (attack-dialog.mjs) и в живой подсказке у курсора
//  (aim.mjs), клетка на карте просто говорит «докидывает или нет», по
//  аналогии с уже принятым в проекте решением для движения
//  (reachable-cells.mjs — один цвет на весь достижимый радиус, не банды по
//  стоимости клетки).
//
//  Свой highlight-слой (wh-range-cells), ОТДЕЛЬНЫЙ от подсветки достижимости
//  движения (wh-reach-cells, reachable-cells.mjs) — обе подсветки гасятся
//  независимо, не задевая друг друга: при начале прицеливания (aim.mjs)
//  движение уже гасится через endTargeting/clearReachableCells, а при показе
//  достижимости движения (movement-actions.mjs) явно гасится и эта
//  подсветка (тот же принцип «один активный оверлей своего вида», что и у
//  clearRangeRings).
// ════════════════════════════════════════════════════════════════════════

import { rangeBandBoundaries } from "../rules/tactical-map.mjs";

const SAFETY_TIMEOUT_MS = 20_000;
// Предохранитель на случай экзотической сетки/огромной дальности — та же
// логика, что и MAX_CELLS в reachable-cells.mjs.
const MAX_CELLS = 4000;
const HIGHLIGHT_NAME = "wh-range-cells";
const FILL_COLOR = 0xff5555;
const FILL_ALPHA = 0.35;

let _active = null;   // { tokenId, offHooks: Function[], timeoutId }

/** Убрать активную подсветку дальности атаки, если есть. */
export function clearRangeCells() {
  if (!_active) return;
  for (const off of _active.offHooks) off();
  if (_active.timeoutId) clearTimeout(_active.timeoutId);
  canvas.interface?.grid?.destroyHighlightLayer(HIGHLIGHT_NAME);
  _active = null;
}

/**
 * Клетки сетки сцены, чей центр лежит в пределах геометрического радиуса
 * (по прямой, Евклидово — тот же приём упрощения, что у facing.mjs::
 * tokenDistance) от центра токена. Исток (клетка самого стрелка/бойца) в
 * список не входит — как и у computeReachableCells.
 * @param {Token} token
 * @param {number} radiusMeters
 * @returns {{i:number,j:number}[]|null}  null — сцена Gridless, клеточная
 *   подсветка не применима (вызывающий берёт кольцо, range-rings.mjs).
 */
export function computeRangeCells(token, radiusMeters) {
  if (!token?.center || !canvas?.ready) return [];
  if (canvas.grid.type === CONST.GRID_TYPES.GRIDLESS) return null;
  if (!(Number(radiusMeters) > 0)) return [];

  const c = token.center;
  const gridSize = canvas?.grid?.size || 100;
  const unitDistance = canvas?.scene?.grid?.distance ?? canvas?.grid?.distance ?? 1;
  const origin = canvas.grid.getOffset(c);
  const radiusCells = radiusMeters / (unitDistance || 1);
  // +1 клетка запаса: центр угловой клетки квадрата span×span чуть дальше
  // radiusCells по прямой (диагональ), не обрезаем её раньше фильтра дистанции.
  const span = Math.ceil(radiusCells) + 1;

  const cells = [];
  for (let di = -span; di <= span; di++) {
    for (let dj = -span; dj <= span; dj++) {
      if (di === 0 && dj === 0) continue;   // исток не входит
      const offset = { i: origin.i + di, j: origin.j + dj };
      const p = canvas.grid.getCenterPoint(offset);
      const distM = (Math.hypot(p.x - c.x, p.y - c.y) / gridSize) * unitDistance;
      if (distM > radiusMeters + 1e-6) continue;
      cells.push(offset);
      if (cells.length >= MAX_CELLS) return cells;
    }
  }
  return cells;
}

/**
 * Нарисовать подсветку клеток в пределах геометрического радиуса вокруг
 * токена — общий движок для showWeaponRangeCells/showMeleeRangeCells ниже.
 * @param {Token} token
 * @param {number} radiusMeters
 * @returns {boolean}  true — подсветка нарисована; false — сцена Gridless,
 *   вызывающему стоит нарисовать кольцо (range-rings.mjs) вместо этого.
 */
export function showRangeCells(token, radiusMeters) {
  clearRangeCells();
  if (!token?.center || !canvas?.ready) return false;
  const cells = computeRangeCells(token, radiusMeters);
  if (cells === null) return false;

  canvas.interface.grid.addHighlightLayer(HIGHLIGHT_NAME);
  for (const offset of cells) {
    const p = canvas.grid.getTopLeftPoint(offset);
    canvas.interface.grid.highlightPosition(HIGHLIGHT_NAME, { x: p.x, y: p.y, color: FILL_COLOR, alpha: FILL_ALPHA });
  }

  const tokenId = token.document.id;
  const onUpdateToken = (doc, changes) => {
    if (doc.id !== tokenId) return;
    if ("x" in changes || "y" in changes || "elevation" in changes) clearRangeCells();
  };
  const onDeleteToken = (doc) => { if (doc.id === tokenId) clearRangeCells(); };
  const onCanvasReady = () => clearRangeCells();

  Hooks.on("updateToken", onUpdateToken);
  Hooks.on("deleteToken", onDeleteToken);
  Hooks.on("canvasReady", onCanvasReady);

  const timeoutId = setTimeout(clearRangeCells, SAFETY_TIMEOUT_MS);

  _active = {
    tokenId, timeoutId,
    offHooks: [
      () => Hooks.off("updateToken", onUpdateToken),
      () => Hooks.off("deleteToken", onDeleteToken),
      () => Hooks.off("canvasReady", onCanvasReady)
    ]
  };
  return true;
}

/**
 * Подсветка клеток в пределах максимальной дальности стрелкового оружия
 * (граница Экстремальной полосы, Rng×3 с учётом clamp вырожденных полос —
 * rangeBandBoundaries, rules/tactical-map.mjs) — рисуется при начале
 * прицеливания (aim.mjs::beginTargeting), чтобы сразу было видно, куда
 * докидывает оружие, ещё до клика по цели. Один красный цвет на весь предел
 * дальности — деление на полосы (В упор/Короткая/Боевая/Длинная/
 * Предельная) остаётся только в диалоге атаки и в живой подсказке у курсора.
 * @param {Token} token   токен стрелка
 * @param {number} rng    эффективный Rng оружия, м
 * @returns {boolean}  true — подсветка нарисована; false — нет Rng либо
 *   сцена Gridless (вызывающему стоит нарисовать кольцо).
 */
export function showWeaponRangeCells(token, rng) {
  if (!(Number(rng) > 0)) return false;
  const { extreme } = rangeBandBoundaries(Number(rng));
  return showRangeCells(token, extreme);
}

/**
 * Подсветка клеток «кто рядом» для рукопашной — радиус клетки сетки сцены
 * ×1.5 (накрывает и диагональных соседей, не только ортогональных), без
 * привязки к system.range оружия — тот же принцип «без прикладывания
 * линейки», что и у showMeleeReachRing (range-rings.mjs).
 * @param {Token} token
 * @returns {boolean}  true — подсветка нарисована; false — сцена Gridless.
 */
export function showMeleeRangeCells(token) {
  const gridUnit = canvas?.scene?.grid?.distance ?? canvas?.grid?.distance ?? 1;
  return showRangeCells(token, gridUnit * 1.5);
}
