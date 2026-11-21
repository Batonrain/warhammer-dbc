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
    i.type === "runicWeave" && i.system?.installedOn === installedOn);
}

// ── Длань Кольценосца / Длань Владыки Колец (стр. 433–434, Sahara runic-weaves-29) ──
// «+5 (+10) на ритуалы с кругами». Читается ритуалами движкового или книжного
// типа «Ритуальный круг» (constants/rituals.mjs, apps/ritual-cast.mjs::ritualThreshold).
// Две вязи на одном носителе не складываются — берётся большая (обе описывают
// одно умение замыкать круг, вторая лучше первой). Действие «замкнуть круг
// полудействием / свободным» не моделируется: отдельного действия у Круга нет.
export const RING_WEAVES = [
  { key: "runicWeave.handOfTheLordOfRings", label: "Длань Владыки Колец", bonus: 10 },
  { key: "runicWeave.handOfTheRingbearer", label: "Длань Кольценосца", bonus: 5 }
];

/** Ритуал — с кругом (движковый тип или книжный тип предмета). */
export function isCircleRitual(R, item) {
  return R?.type === "circle" || item?.system?.ritualType === "circle";
}

/**
 * Бонус вязи к ритуалу с кругом: { label, bonus } или null.
 * @param {(key:string)=>boolean} has  есть ли у ритуалиста ключ Возможности
 */
export function ringWeaveBonus(has, R, item) {
  if (!isCircleRitual(R, item)) return null;
  return RING_WEAVES.find(w => has(w.key)) ?? null;
}
