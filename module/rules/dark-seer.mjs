// module/rules/dark-seer.mjs
// ════════════════════════════════════════════════════════════════════════
//  Dark Seer / Ведун Тьмы — Черта Демонолога (корбук, глава I, Архетипы
//  Людей). [книга] «Демонолог может использовать I вместо W или W вместо I в
//  тестах ритуалов, а если использует „правильную“ Характеристику, он
//  получает Преимущество на этот тест».
//
//  Здесь только чистая логика над путями проведения ритуала
//  (constants/rituals.mjs::ritualPathOptions): у каждого пути с I или W
//  появляется путь-двойник на другой Характеристике, а тест по исходному
//  («правильному») пути идёт с Преимуществом. Диалог — sheets/
//  ritual-cast-dialog.mjs, бросок — apps/ritual-cast.mjs::castRitual.
// ════════════════════════════════════════════════════════════════════════

/** Возможность, которую выдаёт Черта (kind:"capability" на её записи Конструктора). */
export const DARK_SEER_FLAG = "trait.darkSeer";

const SWAP = { int: "wp", wp: "int" };
const ABBR = { int: "I", wp: "W" };

/** Характеристика-замена по Ведуну Тьмы: I↔W; у прочих замены нет (null). */
export function darkSeerSwapChar(char) {
  return SWAP[char] ?? null;
}

/**
 * Пути проведения с добавленными двойниками. Двойник помечен `darkSeerSwap`
 * — по нему castRitual понимает, что Характеристика заменена и Преимущества
 * нет. Путь без I/W двойника не получает.
 *
 * @param {object[]} paths  результат ritualPathOptions
 * @param {boolean}  has    есть ли у ритуалиста Черта
 */
export function darkSeerPaths(paths, has) {
  const list = Array.isArray(paths) ? paths : [];
  if (!has) return list;
  const out = [];
  for (const p of list) {
    out.push(p);
    const swapped = darkSeerSwapChar(p.testChar);
    if (!swapped) continue;
    out.push({
      ...p,
      key: `${p.key}:darkSeer`,
      testChar: swapped,
      darkSeerSwap: true,
      label: `${p.label} → ${ABBR[swapped]} вместо ${ABBR[p.testChar]} (Ведун Тьмы, без Преимущества)`
    });
  }
  return out;
}

/**
 * Преимущество от Ведуна Тьмы на этот бросок ритуала: Черта есть, тест идёт
 * на I или W и Характеристика не заменена.
 *
 * [допущение] «Правильная» — Характеристика, которую назначил сам путь
 * проведения ритуала (книга или ГМ). Ритуал на P/F/прочем Характеристиках
 * под I↔W не подпадает, и Преимущества за него нет: Черта говорит именно о
 * паре I/W.
 *
 * @param {boolean} has
 * @param {{testChar?:string, darkSeerSwap?:boolean}} R состояние броска
 */
export function darkSeerAdvantage(has, R = {}) {
  return !!has && !R?.darkSeerSwap && !!SWAP[R?.testChar];
}
