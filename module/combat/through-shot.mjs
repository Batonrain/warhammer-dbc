// module/combat/through-shot.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  ВЫСТРЕЛ НАСКВОЗЬ / THROUGH SHOT (стр. 74 Книги Аэльдари): пробивает
//  укрытие/цель, если AP+T.b < Pen×2, и бьёт следующую цель по линии огня со
//  сниженным уроном (−1d10, затем −1d5, затем флэт −1). Дальше Pen падает на
//  Поглощение пробитой цели, и цепочка продолжается, пока Pen не уйдёт в 0.
//
//  Автоматизировано (wdbc-wlwf): тест «пробивает ли» (damage.mjs, кнопка
//  .wh-through-shot-btn при пробитии) и поиск «следующей цели по линии огня»
//  (findThroughShotTarget — луч стрелок→цель, продолжение за целью, ближайший
//  токен в узком коридоре, module/rules/facing.mjs::nearestPointBehindOnRay).
//  Сам бросок урона по найденной цели (со снижением по throughShotReductionDie)
//  и продолжение цепочки при повторном пробитии — остаются в руках ГМ через
//  обычную кнопку «Применить урон», как и раньше.
// ─────────────────────────────────────────────────────────────────────────────

import { tokenCenter } from "./facing.mjs";
import { nearestPointBehindOnRay } from "../rules/facing.mjs";

/**
 * Пробивает ли выстрел цель насквозь: AP+T.b цели < Pen×2 (стр. 74).
 * @param {number} targetArmorAP AP брони/укрытия цели в месте попадания
 * @param {number} targetTb      Т.b цели (0 для неживого укрытия)
 * @param {number} pen           Пробитие выстрела
 */
export function throughShotPierces(targetArmorAP, targetTb, pen) {
  return (Number(targetArmorAP) || 0) + (Number(targetTb) || 0) < (Number(pen) || 0) * 2;
}

/** Дайс, вычитаемый из урона по следующей цели на данном шаге цепочки (1 = первое пробитие). */
export function throughShotReductionDie(step) {
  if (step <= 1) return "1d10";
  if (step === 2) return "1d5";
  return null; // 3-й шаг и далее — флэт −1, без броска
}

/**
 * Следующая цель «по линии огня» позади уже пробитой — ближайший токен
 * дальше targetToken на луче attackerToken→targetToken, в пределах узкого
 * коридора (canvas.grid.size px — примерно ширина клетки; снаряд не идеальная
 * геометрическая линия). Кандидаты без известной позиции просто не найдутся —
 * не бросают.
 * @param {Token} attackerToken
 * @param {Token} targetToken     Уже пробитая цель.
 * @param {Token[]} candidateTokens
 * @param {number} [corridorPx]   По умолчанию — размер клетки текущей сцены.
 * @returns {Token|null}
 */
export function findThroughShotTarget(attackerToken, targetToken, candidateTokens, corridorPx) {
  const originPos  = tokenCenter(attackerToken);
  const throughPos = tokenCenter(targetToken);
  if (!originPos || !throughPos) return null;
  const corridor = corridorPx ?? (canvas?.grid?.size || 100);

  const points = (candidateTokens ?? [])
    .filter(t => t?.actor && t !== attackerToken && t !== targetToken)
    .map(t => ({ ...tokenCenter(t), ref: t }))
    .filter(p => p.x != null && p.y != null);

  const hit = nearestPointBehindOnRay(originPos, throughPos, points, corridor);
  return hit?.ref ?? null;
}
