// module/rules/race.mjs
// ════════════════════════════════════════════════════════════════════════
//  «Настоящая» раса персонажа с учётом Прошлого Иннари/Арлекина (wdbc-f4z5).
//  Иннари и Арлекин при создании выбирают «Прошлое» (system.ynnariPast /
//  system.harlequinPast) — расу, чью принадлежность они наследуют для фич,
//  завязанных на расу (Кабал/Культ/Ковен Друкхари, псайкерство Азуриан и
//  т.п.). Эта логика была скопирована минимум в 3-4 местах — здесь она одна.
//
//  Исключение по решению владельца (31.08.2026): пул Очков Боли Друкхари
//  (actor.mjs, painActive) сознательно завязан строго на system.race==="
//  drukhari", Прошлое на него НЕ влияет — там effectiveRace/raceMatches не
//  использовать.
// ════════════════════════════════════════════════════════════════════════

/** Ключ выбранного «Прошлого» (ynnariPast/harlequinPast) — "" если не применимо/не выбрано. */
export function pastRaceKey(system) {
  const race = system?.race;
  if (race === "ynnari") return system?.ynnariPast || "";
  if (race === "harlequin") return system?.harlequinPast || "";
  return "";
}

/** Раса персонажа с учётом Прошлого: само Прошлое, если выбрано, иначе — system.race. */
export function effectiveRace(system) {
  return pastRaceKey(system) || system?.race;
}

/** effectiveRace(system) === key — короткая форма для точечных проверок расы. */
export function raceMatches(system, key) {
  return effectiveRace(system) === key;
}
