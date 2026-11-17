// module/rules/fate-abilities.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Короткие способности за Очко Судьбы (dbc-114, 14.11.2026): Кровь Героев и Выступление —
//  чистая логика без Foundry.
//
//  Кровь Героев: «Раз за битву за Свободное действие тест W+10: при успехе — Unnatural Characteristic
//  (+1) на выбор до конца битвы. Можно сменить раз за битву за Свободное действие тестом W−10.»
//  Выступление: «Раз в раунд — Реакция + Очко Судьбы: +A.b к поглощению урона до начала следующего хода.»
// ════════════════════════════════════════════════════════════════════════════

export const BLOOD_HEROES_CAP = "fate.bloodOfHeroes";
export const PERFORMANCE_CAP = "fate.performance";
export const BLOOD_HEROES_USED_FLAG = "bloodHeroesBattle";
export const BLOOD_HEROES_CHANGED_FLAG = "bloodHeroesChanged";
export const PERFORMANCE_ROUND_FLAG = "performanceRound";
/** Характеристики, на которые можно повесить Unnatural (без Бесчестья и Порчи). */
export const UNNATURAL_CHARS = ["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel"];
export const AP_ZONES = ["head", "body", "leftArm", "rightArm", "leftLeg", "rightLeg"];

/** Ключ боя; вне боя — пустая строка (ограничений «за битву» нет). */
export const battleKey = combat => (combat?.id ? String(combat.id) : "");

/** Можно ли начать (первый раз) или сменить Кровь Героев в этой битве. */
export function bloodHeroesAvailable({ used, changed, hasEffect }, combat) {
  const key = battleKey(combat);
  if (!key) return { mode: hasEffect ? "change" : "start" };
  if (!hasEffect) return used === key ? { mode: null } : { mode: "start" };
  return changed === key ? { mode: null } : { mode: "change" };
}

/** Порог теста: W+10 для начала, W−10 для смены. */
export function bloodHeroesThreshold(wpTotal, mode) {
  return (Number(wpTotal) || 0) + (mode === "change" ? -10 : 10);
}

/** Изменения ActiveEffect: +1 к Unnatural выбранной Характеристики. */
export function bloodHeroesChanges(charKey) {
  if (!UNNATURAL_CHARS.includes(charKey)) return [];
  return [{ key: `system.characteristics.${charKey}.bonusFx`, type: "add", value: 1, phase: "initial", priority: 0 }];
}

/** Выступление раз в Раунд боя; вне боя — без ограничения. */
export function performanceAvailable(usedKey, combat) {
  if (!combat?.id) return true;
  return usedKey !== `${combat.id}:${Number(combat.round) || 0}`;
}
export const performanceRoundKey = combat => (combat?.id ? `${combat.id}:${Number(combat.round) || 0}` : "");

/** Изменения ActiveEffect: +A.b к AP во всех шести зонах (поглощение). */
export function performanceChanges(agBonus) {
  const n = Math.max(0, Math.trunc(Number(agBonus) || 0));
  return n ? AP_ZONES.map(z => ({ key: `system.armorBonus.${z}`, type: "add", value: n, phase: "initial", priority: 0 })) : [];
}
