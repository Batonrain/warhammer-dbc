// module/rules/warp-instability.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Варп-Нестабильность (Warp Instability, dbc-114, 14.11.2026) — чистая логика без Foundry.
//
//  «Если с конца своего предыдущего Хода получал урон, и до конца текущего Хода сам не нанёс
//  никакого урона, должен пройти тест W+0, или получить 1d5+Провалы непоглощаемого Energy-урона.
//  Если его Раны опускаются ниже 0, вместо обычных Отрицательных Ран персонаж сразу изгоняется
//  в Варп.»
//
//  Не реализован вариант Завесы («при отрицательном Истончении — тесты при любом действии»).
// ════════════════════════════════════════════════════════════════════════════

export const WARP_INSTABILITY_CAP = "wounds.warpInstability";
/** Получал урон с конца прошлого Хода. */
export const WARP_INSTAB_HURT_FLAG = "warpInstabHurt";
/** Нанёс урон в текущем Ходу. */
export const WARP_INSTAB_DEALT_FLAG = "warpInstabDealt";
export const WARP_BANISHED_FLAG = "bannedToWarp";

/** Нужен ли тест в конце Хода: урон получен и в этом Ходу своего урона не нанесено. */
export function instabilityTestNeeded({ hurt, dealt }) {
  return !!hurt && !dealt;
}

/** Формула урона при провале: 1d5 + число Провалов (степени неудачи). */
export function instabilityDamageFormula(failDegrees) {
  const n = Math.max(0, Math.trunc(Number(failDegrees) || 0));
  return n > 0 ? `1d5 + ${n}` : "1d5";
}

/** Изгнание: Раны опустились ниже 0 (в этой системе — переполнение в Критические). */
export function shouldBanish(lossResult) {
  return !!lossResult?.overflow || !!lossResult?.gotCritical;
}
