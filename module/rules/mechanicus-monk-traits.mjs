// module/rules/mechanicus-monk-traits.mjs
// Структурный Анализ (Секутор) и Отвергни Пламя (Чумной Монах) — dbc-114, 14.11.2026, чистая логика без Foundry.
//
//  Структурный Анализ: «Проводя одиночную Избирательную атаку, увеличивает Dmg атаки на I.b.»
//  Отвергни Пламя: «Не может использовать оружие, наносящее E Dmg — его руки буквально не слушаются.»

export const STRUCTURAL_ANALYSIS_CAP = "damage.structuralAnalysis";
export const NO_ENERGY_WEAPON_CAP = "weapon.noEnergy";

/** Бонус к Dmg: I.b при одиночной (рукопашной или одиночный выстрел) Избирательной атаке; иначе 0. */
export function structuralAnalysisBonus({ selective, single, intBonus }) {
  return selective && single ? Math.max(0, Number(intBonus) || 0) : 0;
}

/** Оружие наносит E Dmg (тип урона «energy»). */
export function isEnergyWeapon(weapon) {
  return String(weapon?.system?.damageType ?? "").toLowerCase() === "energy";
}
