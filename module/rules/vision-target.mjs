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
//  ВАЖНО: конвенция rotation Foundry 14 — 0° токен смотрит ВНИЗ экрана (юг),
//  растёт ПО ЧАСОВОЙ: 90° запад, 180° север, 270° восток (token.mjs: автоповорот
//  rotation = toDegrees(ray.angle) − 90; limited-angle-polygon.mjs: сектор
//  начинается с rotation + 90 − angle/2). Перевод rotation → пеленг — единый
//  rules/facing.mjs::facingBearing. Конвенция подтверждена исходниками и
//  замером канваса (Sahara 180-rotation-0), но сам модуль целиком (дальность +
//  сектор поверх live-токенов) на живом канвасе после правки не проверен.
//
//  Переиспользует ЧИСТУЮ функцию замера module/regions/auras.mjs::
//  tokenDocDistance — второй копии той же формулы дистанции в проекте по
//  возможности быть не должно.
// ════════════════════════════════════════════════════════════════════════

import { tokenDocDistance } from "../regions/auras.mjs";
import { isWithinArc, bearingDegrees, facingBearing } from "./facing.mjs";

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

  return isWithinArc(facingBearing(observerToken?.rotation), bearingDegrees(oc, tc), angle);
}

/** Подмножество candidateTokens, которым виден targetToken (см. isTokenInSight). */
export function tokensThatCanSee(targetToken, candidateTokens, grid) {
  return (candidateTokens ?? []).filter(t => t.id !== targetToken?.id && isTokenInSight(t, targetToken, grid));
}
