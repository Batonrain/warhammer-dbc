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

// ── Выгорающие вязи (Жнец — 3 применения; стр. 434) ──────────────────────────
// «С каждым применением вязь частично выгорает и после N использований теряет
// все мистические свойства». Счётчик — флаг на самой вязи; выгоревшая вязь
// перестаёт быть активной (apps/effects.mjs::isItemActive), то есть её ключ
// Возможности пропадает сам.
export const RUNE_USES_FLAG = "runeUses";
export const RUNE_BURNED_FLAG = "runeBurnedOut";
export const REAPER_KEY = "runicWeave.reaper";
export const REAPER_USES = 3;

const NS = "warhammer-dbc";

/** Вязь выгорела. */
export const isRuneBurnedOut = item => !!item?.flags?.[NS]?.[RUNE_BURNED_FLAG];

/** Первая невыгоревшая вязь актора, несущая этот ключ Возможности. */
export function weaveItemWithKey(actor, key) {
  return [...(actor?.items ?? [])].find(i => i?.type === "runicWeave" && !isRuneBurnedOut(i)
    && (i.flags?.[NS]?.mechanics ?? []).some(g => (g?.entries ?? [])
      .some(e => e?.kind === "capability" && e.capabilityKey === key))) ?? null;
}

/** После применения: новый счётчик и выгорела ли. */
export function weaveAfterUse(item, maxUses) {
  const used = (Number(item?.flags?.[NS]?.[RUNE_USES_FLAG]) || 0) + 1;
  return { used, burnedOut: used >= maxUses, left: Math.max(0, maxUses - used) };
}

/** Жнец: Выжигание Души нанесло вдвое больше максимума Ран цели. */
export function reaperTriggers(damage, targetMaxWounds) {
  const max = Number(targetMaxWounds) || 0;
  return max > 0 && (Number(damage) || 0) >= 2 * max;
}
