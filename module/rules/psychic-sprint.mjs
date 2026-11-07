export const PSYCHIC_SPRINT_KEY = "talent.psychicSprint";
export const PSYCHIC_SPRINT_EFFECT_KEY = "psychicSprint";
export const PSYCHIC_SPRINT_TEST_BASE = -30;
export const PSYCHIC_SPRINT_TEST_PER_EPR = 3;
export const PSYCHIC_SPRINT_EXTRA_ROUNDS = 1;
export const PSYCHIC_SPRINT_AP_DISCOUNT = 1;
export const PSYCHIC_SPRINT_SPD_KEY = "system.movement.spdBonus";

export function psychicSprintEpr(actor) {
  return Math.max(0, Math.trunc(Number(actor?.system?.psyker?.currentRating) || 0));
}

export function psychicSprintTestMod(epr) {
  return PSYCHIC_SPRINT_TEST_BASE + PSYCHIC_SPRINT_TEST_PER_EPR * Math.max(0, Math.trunc(Number(epr) || 0));
}

export function psychicSprintThreshold(wp, epr, modsTotal = 0) {
  return (Number(wp) || 0) + psychicSprintTestMod(epr) + (Number(modsTotal) || 0);
}

export function psychicSprintSpeedBonus(epr) {
  return Math.max(0, Math.trunc(Number(epr) || 0));
}

export function discountedMovementAp(cost, active) {
  const base = Math.max(0, Number(cost) || 0);
  return active ? Math.max(0, base - PSYCHIC_SPRINT_AP_DISCOUNT) : base;
}
