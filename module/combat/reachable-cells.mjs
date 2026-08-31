// module/combat/reachable-cells.mjs
// ════════════════════════════════════════════════════════════════════════
//  Подсветка клеток, ЧЕСТНО достижимых в пределах бюджета движения SPD×N
//  (wdbc-rgi8, L-ступень тикета wdbc-fb2d) — заменяет собой showMovementRing
//  (M-ступень, простой круг радиуса SPD×N без учёта Трудного Ландшафта) на
//  клетчатых/гексагональных сценах. Круг остаётся резервным вариантом на
//  Gridless — там достижимость клетками не имеет смысла.
//
//  Dijkstra flood-fill по клеткам сетки от токена. Стоимость ребра между
//  соседними клетками = canvas.grid.measurePath (уважает диагональные правила
//  сцены — 5-5-5/5-10-5/точные и т.п., см. книгу «ДВИЖЕНИЕ», стр. 28-30),
//  удвоенная, если клетка-НАЗНАЧЕНИЕ внутри активного (не выключенного)
//  поведения «Трудный ландшафт» (regions/difficult-terrain.mjs) — тот же
//  x0.5 SPD по правилу, что и _getTerrainEffects() для одиночного токена,
//  только проверяется по каждой клетке сетки в радиусе бюджета, а не только
//  под одним токеном. Проверка «клетка внутри зоны» — region.testPoint()
//  (тот же приём, что и в combat/templates.mjs, combat/cover.mjs).
//
//  Обход БЕЗ учёта истории пути (не считаем «которая по счёту диагональ») —
//  то же сознательное упрощение, что и facing.mjs::tokenDistance (Евклидово
//  вместо точных диагоналей сцены): на 5-10-5-сетке чередующаяся диагональ
//  теоретически может обойтись на 1 клетку дешевле честного per-path счёта
//  Foundry. Бюджет сам ограничивает область обхода (стоимость от истока
//  растёт монотонно), MAX_CELLS — чисто предохранитель на случай экзотической
//  сетки/огромного бюджета.
// ════════════════════════════════════════════════════════════════════════

import { DIFFICULT_TERRAIN_TYPE } from "../regions/difficult-terrain.mjs";

const SAFETY_TIMEOUT_MS = 20_000;
const MAX_CELLS = 600;
const HIGHLIGHT_NAME = "wh-reach-cells";
const FILL_COLOR = 0x6fe6ff;
const FILL_ALPHA = 0.35;

let _active = null;   // { tokenId, offHooks: Function[], timeoutId }

/** Убрать активную подсветку, если есть. */
export function clearReachableCells() {
  if (!_active) return;
  for (const off of _active.offHooks) off();
  if (_active.timeoutId) clearTimeout(_active.timeoutId);
  canvas.interface?.grid?.destroyHighlightLayer(HIGHLIGHT_NAME);
  _active = null;
}

/** Активные (не выключенные) зоны Трудного Ландшафта на сцене. */
function _activeDifficultTerrainRegions() {
  return Array.from(canvas.scene?.regions ?? []).filter(region =>
    Array.from(region.behaviors ?? []).some(b => b.type === DIFFICULT_TERRAIN_TYPE && !b.disabled));
}

function _isDifficultAt(x, y, elevation, regions) {
  return regions.some(region => region.testPoint({ x, y, elevation }));
}

/**
 * Dijkstra flood-fill клеток сетки, достижимых от токена в пределах бюджета.
 * @param {Token} token
 * @param {number} budgetMeters
 * @returns {{i:number,j:number}[]|null}  null — сцена Gridless, клеточная
 *   подсветка не применима (вызывающий берёт круг showMovementRing).
 */
export function computeReachableCells(token, budgetMeters) {
  if (!token?.center || !canvas?.ready) return [];
  if (canvas.grid.type === CONST.GRID_TYPES.GRIDLESS) return null;
  if (!(Number(budgetMeters) > 0)) return [];

  const elevation = token.document?.elevation ?? 0;
  const terrainRegions = _activeDifficultTerrainRegions();
  const origin = canvas.grid.getOffset(token.center);
  const originKey = `${origin.i},${origin.j}`;

  const best = new Map([[originKey, 0]]);
  const frontier = [{ offset: origin, cost: 0 }];
  const reached = [];
  let explored = 0;

  while (frontier.length && explored < MAX_CELLS) {
    let minIdx = 0;
    for (let i = 1; i < frontier.length; i++) if (frontier[i].cost < frontier[minIdx].cost) minIdx = i;
    const { offset, cost } = frontier.splice(minIdx, 1)[0];
    const key = `${offset.i},${offset.j}`;
    if (cost > (best.get(key) ?? Infinity) + 1e-9) continue;   // устаревшая запись — дешевле уже нашли
    explored++;
    if (key !== originKey) reached.push({ i: offset.i, j: offset.j });

    for (const next of canvas.grid.getAdjacentOffsets(offset)) {
      const a = canvas.grid.getCenterPoint(offset);
      const b = canvas.grid.getCenterPoint(next);
      const stepDist = canvas.grid.measurePath([a, b]).distance;
      const mult = _isDifficultAt(b.x, b.y, elevation, terrainRegions) ? 2 : 1;
      const nextCost = cost + stepDist * mult;
      if (nextCost > budgetMeters + 1e-6) continue;

      const nKey = `${next.i},${next.j}`;
      if (!(nextCost < (best.get(nKey) ?? Infinity) - 1e-9)) continue;
      best.set(nKey, nextCost);
      frontier.push({ offset: next, cost: nextCost });
    }
  }
  return reached;
}

/**
 * Нарисовать подсветку достижимых клеток вокруг токена — по клику типа
 * движения (module/combat/movement-actions.mjs).
 * @param {Token} token
 * @param {number} meters
 * @returns {boolean}  true — подсветка нарисована; false — сцена Gridless,
 *   вызывающему стоит нарисовать круг (showMovementRing) вместо этого.
 */
export function showReachableCells(token, meters) {
  clearReachableCells();
  if (!token?.center || !canvas?.ready) return false;
  const cells = computeReachableCells(token, meters);
  if (cells === null) return false;

  canvas.interface.grid.addHighlightLayer(HIGHLIGHT_NAME);
  for (const offset of cells) {
    const p = canvas.grid.getTopLeftPoint(offset);
    canvas.interface.grid.highlightPosition(HIGHLIGHT_NAME, { x: p.x, y: p.y, color: FILL_COLOR, alpha: FILL_ALPHA });
  }

  const tokenId = token.document.id;
  const onUpdateToken = (doc, changes) => {
    if (doc.id !== tokenId) return;
    if ("x" in changes || "y" in changes || "elevation" in changes) clearReachableCells();
  };
  const onDeleteToken = (doc) => { if (doc.id === tokenId) clearReachableCells(); };
  const onCanvasReady = () => clearReachableCells();

  Hooks.on("updateToken", onUpdateToken);
  Hooks.on("deleteToken", onDeleteToken);
  Hooks.on("canvasReady", onCanvasReady);

  const timeoutId = setTimeout(clearReachableCells, SAFETY_TIMEOUT_MS);

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
