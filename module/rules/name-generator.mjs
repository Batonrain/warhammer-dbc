// module/rules/name-generator.mjs
//
// Генератор случайных имён персонажей по культуре и полу (wdbc-ik5s,
// «Генератор имён»). Чистая функция без побочных эффектов и без Foundry —
// тестируется на голом Node (см. test/rules/name-generator.test.mjs).
// Имя всегда берётся из фиксированного списка (module/constants/
// name-lists.mjs), а не собирается из случайных букв — результат
// предсказуем: он либо есть в списке культуры/пола, либо его там нет.

import { NAME_LISTS } from "../constants/name-lists.mjs";

// Раса Мастера создания (module/constants/races.mjs, поле system.race) →
// культура списка имён. Астартес — отдельная (легионная) культура; ксено-
// расы происхождением от аэльдари/друкхари наследуют их культуру имён;
// у прочих человекоподобных абхуманов Империума собственного книжного
// референса нет — используют общий имперский список (см. name-lists.mjs).
export const RACE_TO_NAME_CULTURE = {
  human: "imperial",
  astartes: "astartes",
  ogryn: "imperial",
  ratling: "imperial",
  squat: "imperial",
  replicant: "imperial",
  yigori: "imperial",
  beastman: "imperial",
  harpy: "imperial",
  naga: "imperial",
  splice: "imperial",
  sslyth: "imperial",
  azuriane: "aeldari",
  halfEldar: "aeldari",
  harlequin: "aeldari",
  exodite: "aeldari",
  ynnari: "aeldari",
  drukhari: "drukhari"
};

/** Ключи культур, для которых есть список имён (для выпадающего списка и т.п.). */
export function nameCultures() {
  return Object.keys(NAME_LISTS);
}

/** Подпись культуры для интерфейса; неизвестный ключ — сама культура как есть. */
export function nameCultureLabel(culture) {
  return NAME_LISTS[culture]?.label || culture;
}

/** Культура имён для расы Мастера создания; без явного соответствия — "imperial". */
export function cultureForRace(raceKey) {
  return RACE_TO_NAME_CULTURE[raceKey] || "imperial";
}

/**
 * Список имён для культуры/пола, с запасными вариантами:
 *  - неизвестная культура → "imperial";
 *  - у культуры нет списка на этот пол (например, Астартес — только
 *    мужской) → список другого пола той же культуры;
 *  - пол "other"/не указан, а у культуры есть оба списка → объединение обоих
 *    (не сводим «другое» молча к мужскому).
 */
function namesFor(culture, gender) {
  const entry = NAME_LISTS[culture] || NAME_LISTS.imperial;
  if (gender === "male" || gender === "female") {
    if (entry[gender]?.length) return entry[gender];
    const other = gender === "male" ? "female" : "male";
    if (entry[other]?.length) return entry[other];
    return NAME_LISTS.imperial[gender] || NAME_LISTS.imperial.male;
  }
  if (entry.male?.length && entry.female?.length) return [...entry.male, ...entry.female];
  return entry.male || entry.female || NAME_LISTS.imperial.male;
}

/**
 * Случайное имя из списка выбранной культуры/пола.
 * @param {string} culture ключ культуры (см. NAME_LISTS); неизвестный ключ → "imperial".
 * @param {string} [gender="male"] "male" | "female" | иное (объединённый список, где есть оба).
 * @returns {string} имя — всегда непустая строка из соответствующего списка.
 */
export function generateName(culture, gender = "male") {
  const list = namesFor(culture, gender);
  return list[Math.floor(Math.random() * list.length)];
}
