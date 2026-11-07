export const WIDE_BURST_RATING_CUT = 2;
export const CAGE_FIRING_RATING_CUT = 3;

export function wideBurstSummary({ mode, rofSemi = 0, rofFull = 0, cageFiring = false } = {}) {
  const base = mode === "semi" ? Number(rofSemi) || 0 : mode === "full" ? Number(rofFull) || 0 : 0;
  if (mode !== "semi" && mode !== "full") {
    return { applies: false, base: 0, result: 0, text: "действует только на Короткую и Длинную очередь" };
  }
  if (base < 3) {
    return { applies: false, base, result: base, text: `у этого режима RoF ${base} — Широкая Очередь не сработает (нужен RoF 3+)` };
  }
  const cut = WIDE_BURST_RATING_CUT + (cageFiring ? CAGE_FIRING_RATING_CUT : 0);
  const result = Math.max(0, base - cut);
  const hitWord = result === 1 ? "попадание" : (result >= 2 && result <= 4) ? "попадания" : "попаданий";
  return {
    applies: true,
    base,
    result,
    text: `RoF ${base} → ${result}: не больше ${result} ${hitWord}, патроны спишутся по RoF ${base}, Уклонение цели −20`,
  };
}
