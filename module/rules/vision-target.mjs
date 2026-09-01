// module/rules/vision-target.mjs
// ════════════════════════════════════════════════════════════════════════
//  «Кто меня видит» — дальность + сектор обзора токена-наблюдателя
//  (TokenDocument.sight.range/angle + rotation), БЕЗ стен/темноты/
//  невидимости. Полный учёт этого дал бы canvas.visibility.testVisibility,
//  но тот работает только на отрендеренном canvas (недоступен в Vitest и не
//  звучит здесь) — здесь честная геометрическая ПРИБЛИЖЁННАЯ замена,
//  достаточная для «Икона Богохульства» (wdbc-1rno: «Имперцы видящие...»),
//  не полноценная система LoS.
//
//  ВАЖНО: конвенция rotation Foundry (0° = «на север»/вверх экрана, растёт
//  ПО ЧАСОВОЙ) взята из документированного поведения ядра — этот модуль НЕ
//  проверен на живом Foundry-канвасе (см. doombc-gm-login в памяти проекта).
//  Перед боевым применением стоит живьём повернуть токен и свериться.
//
//  Переиспользует ЧИСТУЮ функцию замера module/regions/auras.mjs::
//  tokenDocDistance — второй копии той же формулы дистанции в проекте по
//  возможности быть не должно.
// ════════════════════════════════════════════════════════════════════════

import { tokenDocDistance } from "../regions/auras.mjs";

/** Центр токена в пикселях сцены (та же формула, что tokenDocDistance внутри). */
function tokenCenter(t, gridSize) {
  return {
    x: (Number(t.x) || 0) + (Number(t.width) || 1) * gridSize / 2,
    y: (Number(t.y) || 0) + (Number(t.height) || 1) * gridSize / 2
  };
}

/**
 * Дальность обзора наблюдателя в метрах сцены — sight.range, если задана
 * (>0), иначе запасное значение (wdbc-1rno): множество NPC-токенов в
 * реальных мирах вообще не имеют настроенного sight (Foundry не рендерит
 * им зрение, это не значит «слеп») — 0 здесь читается как «не настроено»,
 * не как «ничего не видит», и подставляется разумное приближение обычного
 * человеческого зрения.
 */
const FALLBACK_SIGHT_RANGE_M = 30;
export function sightRangeOf(observerToken) {
  const range = Number(observerToken?.sight?.range) || 0;
  return range > 0 ? range : FALLBACK_SIGHT_RANGE_M;
}

/**
 * В поле зрения ли targetToken у observerToken — по дальности и сектору
 * обзора (rotation ± sight.angle/2). sight.angle не задан или ≥360° —
 * круговой обзор, сектор не сужает.
 *
 * @param {object} observerToken  TokenDocument-подобный: x,y,width,height,
 *   rotation, sight:{range,angle}, elevation
 * @param {object} targetToken    то же самое
 * @param {{size:number, distance:number}} grid  scene.grid
 */
export function isTokenInSight(observerToken, targetToken, grid) {
  if (!observerToken || !targetToken) return false;
  const range = sightRangeOf(observerToken);
  const distance = tokenDocDistance(observerToken, targetToken, grid);
  if (distance > range) return false;

  const angle = Number(observerToken?.sight?.angle);
  if (!angle || angle >= 360) return true;

  const size = Number(grid?.size) || 100;
  const oc = tokenCenter(observerToken, size);
  const tc = tokenCenter(targetToken, size);
  if (oc.x === tc.x && oc.y === tc.y) return true; // та же клетка — сектор ни при чём

  // atan2 в экранных координатах (Y вниз) даёт 0°=вправо, растёт по часовой;
  // rotation Foundry 0°=вверх, тоже по часовой — сдвиг на −90° переводит
  // rotation в ту же систему отсчёта, что и atan2 (см. шапку файла).
  const toTargetDeg = (Math.atan2(tc.y - oc.y, tc.x - oc.x) * 180 / Math.PI + 360) % 360;
  const facingDeg = (((Number(observerToken?.rotation) || 0) - 90) % 360 + 360) % 360;
  let diff = Math.abs(toTargetDeg - facingDeg);
  if (diff > 180) diff = 360 - diff;
  return diff <= angle / 2;
}

/** Подмножество candidateTokens, которым виден targetToken (см. isTokenInSight). */
export function tokensThatCanSee(targetToken, candidateTokens, grid) {
  return (candidateTokens ?? []).filter(t => t.id !== targetToken?.id && isTokenInSight(t, targetToken, grid));
}
