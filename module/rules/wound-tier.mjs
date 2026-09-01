// module/rules/wound-tier.mjs
//
// Уровень Ранения (корбук, раздел «Уровни Ранения»): определяет скорость
// лечения — module/sheets/tabs/healing.mjs переключает формулы по `key` —
// и подпись/цвет блока РАНЫ на листе (documents/actor.mjs кладёт результат в
// system.wounds.tier/tierLabel, rules/predicates.mjs даёт `woundTier` условие
// для будущих правил). Чистая функция, поэтому живёт в module/rules/, а не в
// sheets/ — иначе документ актора (documents/actor.mjs) зависел бы от кода
// листа, а предикат не мог бы остаться без Foundry.
//
// key — три мехнически значимых значения книги, ими же переключаются формулы
// лечения: "light" (потеряно ≤ T.b×2 Ран — включая 0), "heavy" (потеряно
// больше), "critical" (Раны в минусе, т.е. system.wounds.critical > 0).
// displayKey/displayLabel — то же самое для читателя листа, только "light"
// с lost=0 показывается отдельным «Здоров»: на лечение это не влияет
// (формулы «Лёгкого» уже верны и для полного здоровья), только на подпись.
export const TIER_LABELS = { healthy: "Здоров", light: "Легко ранен", heavy: "Тяжело ранен", dying: "При смерти" };

export function woundLevel(system) {
  const value = system.wounds?.value ?? 0;
  const max = system.wounds?.max ?? 0;
  const crit = system.wounds?.critical ?? 0;
  const tb = system.characteristics?.t?.bonus ?? 0;
  const lost = Math.max(0, max - value);
  let key = "light";
  if (crit > 0) key = "critical";
  else if (lost > tb * 2) key = "heavy";
  const displayKey = key === "critical" ? "dying" : (lost <= 0 ? "healthy" : key);
  return {
    key,
    label: { light: "Лёгкое", heavy: "Тяжёлое", critical: "Критическое" }[key],
    displayKey,
    displayLabel: TIER_LABELS[displayKey],
    lost, tb, crit
  };
}
