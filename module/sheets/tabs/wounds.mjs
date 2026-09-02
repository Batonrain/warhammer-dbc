// module/sheets/tabs/wounds.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Общие расчёты Ран для вынесенных действий листа.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Лечение ран. В этой системе wounds.value — текущее здоровье (убывает при
 * уроне), wounds.critical — критический урон сверх нуля (растёт).
 */
export function computeWoundHealing(system, amount) {
  let value = system.wounds?.value ?? 0;
  let critical = system.wounds?.critical ?? 0;
  const max = system.wounds?.max ?? 0;
  let heal = Math.max(0, amount);

  if (critical > 0) {
    const h = Math.min(critical, heal);
    critical -= h;
    heal -= h;
  }
  if (heal > 0) {
    value = max > 0 ? Math.min(max, value + heal) : value + heal;
  }

  return {
    "system.wounds.value": value,
    "system.wounds.critical": critical
  };
}
