// module/combat/imperative-bonuses.mjs
// ════════════════════════════════════════════════════════════════════════
//  Точки входа для конкретных Императивов Пастыря Императивов (wdbc-yu32) —
//  Уклонение/Отскок в укрытие читают активный Императив цели отсюда, числа
//  живут в module/constants/tech-imperatives.mjs, срок и правило замещения —
//  в module/rules/imperative.mjs. Тот же принцип разделения, что recoil-
//  item-bonuses.mjs/recoil-pool.mjs.
// ════════════════════════════════════════════════════════════════════════

import { activeImperativeBonuses } from "../rules/imperative.mjs";

/** Плоский бонус/штраф активного Императива цели к тесту Избегания (не различает Отскок в укрытие — см. tech-imperatives.mjs::evasionRecoilNote). */
export function evasionImperativeBonus(actor) {
  return Number(activeImperativeBonuses(actor)?.evasionBonus) || 0;
}

/**
 * Скорректированный AP укрытия для Отскока в укрытие с учётом активного
 * Императива цели — клапан «не более чем вдвое/не более ×2» считается от
 * БАЗОВОГО (до Императива) AP, не от уже применённого.
 */
export function coverApImperativeAdjust(actor, baseAp) {
  const bonuses = activeImperativeBonuses(actor);
  const delta = Number(bonuses?.coverApDelta) || 0;
  if (!delta) return Number(baseAp) || 0;
  const base = Number(baseAp) || 0;
  const raw  = base + delta;
  if (delta < 0) return Math.max(raw, base * (Number(bonuses.coverApFloorRatio) || 0));
  const ceilRatio = Number(bonuses.coverApCeilRatio);
  return Number.isFinite(ceilRatio) ? Math.min(raw, base * ceilRatio) : raw;
}
