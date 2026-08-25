// module/combat/cover.mjs
// ════════════════════════════════════════════════════════════════════════════
//  УКРЫТИЯ (wdbc-8k0i) — авто-детект бонуса зоны Укрытия (regions/cover.mjs)
//  для диалога атаки. Два условия сразу:
//   (а) цель СТОИТ в зоне Укрытия — читаем готовый, уже посчитанный Foundry
//       `targetToken.document.regions` (тот же приём, что у Трудного
//       Ландшафта, regions/difficult-terrain.mjs:getTerrainInfoForToken) —
//       это проверка по НАСТОЯЩЕЙ форме токена/региона, а не по прямоугольнику;
//   (б) Укрытие «на линии огня» — отрезок атакующий-центр→цель-центр обязан
//       пересекать ТУ ЖЕ зону. Прямого API «луч пересекает регион» в Foundry
//       нет, поэтому отрезок сэмплируется точками через region.testPoint()
//       (тот же метод, что уже применяется для Шаблонов поражения,
//       combat/templates.mjs:tokensInRegion).
//  Только диалог атаки подставляет найденный бонус — он всегда остаётся
//  редактируемым полем, ГМ/игрок могут поправить руками.
// ════════════════════════════════════════════════════════════════════════════

import { COVER_TYPE } from "../regions/cover.mjs";

const LINE_SAMPLES = 8;

/**
 * Наибольший подходящий модификатор Укрытия для этого выстрела/удара, или 0.
 * @param {Token} attackerToken
 * @param {Token} targetToken
 * @returns {number}
 */
export function coverBonusForShot(attackerToken, targetToken) {
  const regions = targetToken?.document?.regions;
  if (!regions || !regions.size) return 0;
  const ac = attackerToken?.center, tc = targetToken?.center;
  if (!ac || !tc) return 0;
  const elevation = targetToken.document.elevation ?? 0;

  let best = 0;
  for (const region of regions) {
    for (const behavior of region.behaviors ?? []) {
      if (behavior.type !== COVER_TYPE || behavior.disabled) continue;
      const mod = Number(behavior.system?.coverMod) || 0;
      if (!mod) continue;
      const onLine = _segmentHitsRegion(region, ac, tc, elevation);
      if (onLine && Math.abs(mod) > Math.abs(best)) best = mod;
    }
  }
  return best;
}

/** Сэмплирует отрезок между двумя точками (без концов) на попадание в регион. */
function _segmentHitsRegion(region, from, to, elevation) {
  for (let i = 1; i <= LINE_SAMPLES; i++) {
    const t = i / (LINE_SAMPLES + 1);
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    if (region.testPoint({ x, y, elevation })) return true;
  }
  return false;
}
