// module/rules/runic-weave.mjs
// ════════════════════════════════════════════════════════════════════════════
//  РУНИЧЕСКИЕ ВЯЗИ (корбук стр. 433-434, книга «VI. МИСТИКА»).
//  На один предмет (броню/оружие) можно нанести не более двух вязей — одну
//  изнутри, одну снаружи. Действует только ОДНА: та, что ближе к телу
//  (внутренняя перекрывает внешнюю). Если нанесена только одна — активна она,
//  независимо от стороны.
// ════════════════════════════════════════════════════════════════════════════

const POSITION_RANK = { inner: 0, outer: 1, "": 1 };

/**
 * Из списка вязей, нанесённых на ОДИН И ТОТ ЖЕ предмет (уже отфильтрованных
 * по installedOn), возвращает id действующей — та, что ближе к телу
 * (wornPosition:"inner" побеждает "outer"/не заданное); при равенстве —
 * первая по порядку (стабильная сортировка).
 * @param {{id:string, wornPosition:string}[]} weaves
 * @returns {string|null}
 */
export function activeRunicWeaveId(weaves) {
  if (!weaves?.length) return null;
  let best = weaves[0];
  for (const w of weaves.slice(1)) {
    if ((POSITION_RANK[w.wornPosition] ?? 1) < (POSITION_RANK[best.wornPosition] ?? 1)) best = w;
  }
  return best.id;
}

/** Все вязи актора, нанесённые на тот же предмет, что и данная (сам предмет включён). */
export function siblingRunicWeaves(actorItems, item) {
  const installedOn = item.system?.installedOn || "";
  if (!installedOn) return [item];
  return (actorItems ?? []).filter(i =>
    i.type === "gear" && i.system?.gearCategory === "runicWeave" && i.system?.installedOn === installedOn);
}
