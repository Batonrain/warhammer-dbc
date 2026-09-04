// module/combat/imperative-bonuses.mjs
// ════════════════════════════════════════════════════════════════════════
//  Точки входа для конкретных Императивов Пастыря Императивов (wdbc-yu32) —
//  Уклонение/Отскок в укрытие читают активный Императив цели отсюда, числа
//  живут в module/constants/tech-imperatives.mjs, срок и правило замещения —
//  в module/rules/imperative.mjs. Тот же принцип разделения, что recoil-
//  item-bonuses.mjs/recoil-pool.mjs.
// ════════════════════════════════════════════════════════════════════════

import { activeImperativeBonuses } from "../rules/imperative.mjs";

/**
 * Плоский бонус/штраф активного Императива цели к тесту Избегания.
 *
 * planningRecoil=true (wdbc-hdxj) берёт вместо обычного значения
 * recoil-специфичный книжный знак («кроме Отскока в укрытие», Evasion −20/
 * Fortress +20, evasionRecoilBonus в tech-imperatives.mjs) — читается ТОЛЬКО
 * когда защищающийся отметил декларацию «планирую Отскочить в укрытие?» ДО
 * броска Уклонения (module/combat/attack-card.mjs::defenseSection, чекбокс
 * .wh-recoil-plan-checkbox, гейт клика в module/hooks.mjs). Без декларации —
 * прежнее поведение, обычное значение.
 */
export function evasionImperativeBonus(actor, { planningRecoil = false } = {}) {
  const bonuses = activeImperativeBonuses(actor);
  if (planningRecoil && typeof bonuses?.evasionRecoilBonus === "number") {
    return Number(bonuses.evasionRecoilBonus) || 0;
  }
  return Number(bonuses?.evasionBonus) || 0;
}

/**
 * Признак: у актора активен Императив, который переворачивает знак бонуса
 * специально для Отскока в укрытие (Evasion/Fortress Imperative, wdbc-hdxj)
 * — используется, чтобы решить, показывать ли в диалоге Уклонения условную
 * декларацию «планирую Отскочить в укрытие?» (module/combat/attack-
 * card.mjs::defenseSection). false для всех прочих Императивов/без Императива
 * — тогда чекбокс не рендерится вовсе, UX для них не меняется.
 */
export function hasEvasionRecoilImperative(actor) {
  return typeof activeImperativeBonuses(actor)?.evasionRecoilBonus === "number";
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
