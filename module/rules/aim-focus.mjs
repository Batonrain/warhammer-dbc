// module/rules/aim-focus.mjs
//
// Aim Focus / Фокус на Прицеле (Талант, wdbc-1rno.5): «Когда он совершает
// любое прицеливание, он может потратить 1 Реакцию, чтобы бонус прицеливания
// действовал на все его стрелковые атаки до конца его следующего Хода, или
// до следующего прицеливания, а не только одну следующую атаку как обычно.»
//
// Решения пользователя (16.09.2026): (а) выбор — отдельная HUD-галочка ДО
// клика по кнопке Прицеливания, не модальное подтверждение после клика.
// (б) продление защищает ТОЛЬКО «атака тратит бонус» — Движение/Уклонение/
// Парирование/получение урона по-прежнему сбрасывают Прицеливание как обычно
// (находка 1, action-economy.mjs::_maybeClearAiming/damage.mjs — не тронуты).
//
// Состояние — flags.warhammer-dbc.aimFocusExtended, три значения:
//   отсутствует — обычное Прицеливание (как без Таланта)
//   "pending"   — только что объявлено с Фокусом, ещё не пережило конец Хода
//   "armed"     — пережило один конец Хода (текущего объявления), защищает
//                 весь следующий Ход целиком, снимается на его конце
// (module/combat/action-economy.mjs::applyAimFocusTurnEnd — тот же такт, что
// applyTurnEndStanceEffects, вызывается из hooks.mjs::updateCombat).
//
// «Все его стрелковые атаки» — рукопашные атаки Фокус не продлевает: только
// дальнобойные (attack/dialog.mjs проверяет isMelee при сбросе).

import { hasAbility } from "./ability-by-key.mjs";

export const AIM_FOCUS_CAPABILITY = "rangedCore.core.aimFocus";
export const AIM_FOCUS_PENDING_FLAG = "aimFocusPending";     // HUD-галочка до клика
export const AIM_FOCUS_EXTENDED_FLAG = "aimFocusExtended";   // состояние после объявления

export function hasAimFocus(actor) {
  return hasAbility(actor, AIM_FOCUS_CAPABILITY, "Aim Focus", "talent");
}
