// module/rules/monarch-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  МОНАРХ (Элитный архетип) — чистая арифметика вассалов Короны Полентии:
//
//   • Corona Polentia / Корона Полентия — у активного вассала свой запас ОД:
//     пул «ОД вассала» (resourcePool vassalAp, максимум 4), +1 в начале Хода
//     Монарха; психосила стоит 1 (свободное), 2 (полудействие/реакция) или
//     4 (полное действие); смена контейнера — новый стартует с 1 ОД;
//   • Dragon Monarch / Монарх Дракон — ещё один активный вассал: свой пул
//     vassalApDragon с тем же тактом;
//   • Awakening / Пробуждение — вассал восстанавливает 4 ОД вместо 1;
//   • Cerebral Channeling / Церебральный Поток — поддержание психосил стоит
//     вдвое меньше ОД (окр.▼);
//   • Brain Harvesting / Извлечение Мозга — 20 Успехов на подготовку
//     контейнера, извлечение Medicae−30, 4+ Провала — мозг погиб.
//  Кнопки и такт начала Хода — combat/monarch.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";

const num = v => Number(v) || 0;

export const hasCoronaPolentia = a => hasItemNamed(a, "Corona Polentia", ["trait"]);
export const hasBrainHarvesting = a => hasItemNamed(a, "Brain Harvesting", ["trait"]);
export const hasAwakening = a => hasItemNamed(a, "Awakening", ["talent"]);
export const hasCerebralChanneling = a => hasItemNamed(a, "Cerebral Channeling", ["talent"]);
export const hasDragonMonarch = a => hasItemNamed(a, "Dragon Monarch", ["talent"]);
export const hasNeuronist = a => hasItemNamed(a, "Neuronist", ["talent"]);

export const VASSAL_POOL = "vassalAp";
export const DRAGON_POOL = "vassalApDragon";
export const VASSAL_POOLS = [VASSAL_POOL, DRAGON_POOL];
export const VASSAL_AP_MAX = 4;
export const VASSAL_REGEN = 1;
export const VASSAL_SWAP_START = 1;
/** «Восстанавливает 4 ОД вместо 1». */
export const AWAKENING_REGEN = 4;

/** Цена психосилы в ОД вассала по виду действия. */
export const VASSAL_ACTION_COST = { free: 1, half: 2, full: 4 };

/**
 * Сколько ОД вассала уходит.
 * @param {number} base цена по виду действия
 * @param {{sustain?:boolean, cerebral?:boolean}} o поддержание и Церебральный Поток
 */
export function vassalApCost(base, { sustain = false, cerebral = false } = {}) {
  const b = Math.max(0, Math.trunc(num(base)));
  return sustain && cerebral ? Math.floor(b / 2) : b;
}

/** +N ОД вассала, не выше максимума: сколько прибавить. */
export function vassalRegen(have, max = VASSAL_AP_MAX, amount = VASSAL_REGEN) {
  return Math.max(0, Math.min(num(amount), num(max) - num(have)));
}

/** Пробуждение после обычного +1: добрать до 4 восстановленных (ещё +3), не выше максимума. */
export function awakeningExtra(have, max = VASSAL_AP_MAX) {
  return vassalRegen(have, max, AWAKENING_REGEN - VASSAL_REGEN);
}

// ── Извлечение Мозга ────────────────────────────────────────────────────────

export const BRAIN_PREP_FLAG = "brainContainerPrep";
export const BRAIN_PREP_GOAL = 20;
export const BRAIN_PREP_MOD = -20;
export const BRAIN_EXTRACT_MOD = -30;
export const BRAIN_DAMAGE_FAILS = 4;

/** Итог извлечения по тесту: мозг извлечён / можно повторить / погиб. */
export function brainExtractOutcome({ success, deg }) {
  if (success) return "extracted";
  return num(deg) >= BRAIN_DAMAGE_FAILS ? "destroyed" : "retry";
}

/** Накопление Успехов подготовки контейнера (Провал ничего не даёт). */
export function brainPrepProgress(before, { success, deg }) {
  const after = Math.max(0, num(before)) + (success ? Math.max(1, num(deg)) : 0);
  return { after, done: after >= BRAIN_PREP_GOAL };
}
