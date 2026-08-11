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

/** Непоглощаемый урон в Раны: уменьшает текущие, переполнение → критический урон. */
export function computeWoundDamage(system, amount) {
  let value = system.wounds?.value ?? 0;
  let critical = system.wounds?.critical ?? 0;
  const dmg = Math.max(0, amount);
  if (value >= dmg) {
    value -= dmg;
  } else {
    critical += dmg - value;
    value = 0;
  }
  const out = {
    "system.wounds.value": value,
    "system.wounds.critical": critical
  };
  // Новый урон → снова можно оказать Первую Помощь.
  if (dmg > 0) out["system.wounds.firstAidUsed"] = false;
  return out;
}
