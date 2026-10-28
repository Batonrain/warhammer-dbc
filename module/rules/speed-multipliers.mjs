// module/rules/speed-multipliers.mjs
// ════════════════════════════════════════════════════════════════════════════
//  МНОЖИТЕЛИ ДАЛЬНОСТИ ДВИЖЕНИЯ ОТ ЧЕРТ (Sahara task-bbe1, решение владельца 27.10.2026).
//
//  Три Черты Элитных Архетипов Эльдар/Друкхари задают дальность Движения не надбавкой к SPD, а
//  СВОИМИ множителями (текст Черты): Почитатели Танца — Полудвижение SPD×2, Полное ×3, Натиск ×6,
//  Бег ×12; Акробатическое Мастерство — ×2/×4/×8/×14 (со Спринтом Бег ×28 — удвоение самого Бега,
//  его даёт speed-talents.mjs::speedTalentDistances на уже умноженном Беге); Разящее Представление —
//  Полное ×3, Натиск ×6, Бег ×12 (Полудвижение в тексте не названо — остаётся SPD).
//  Лист (rules/character/movement.mjs) берёт отсюда множители и ставит дальность
//  `max(по таблице SPD×1/2/3/6, SPD × множитель)`: у нескольких Черт сразу выигрывает лучший
//  множитель каждой дистанции, а не сумма. SPD — текущий, после Размера, Перевеса, Стойки,
//  Поваленного и потери ног (ноль остаётся нулём).
//
//  Модуль чистый и опознаёт Черту ТОЛЬКО по имени предмета (`match:` — по нему же носителя
//  находит tools/capability-reachability.mjs): его зовёт пересчёт листа, а круг через
//  rules/sources.mjs вешает загрузку (AGENTS.md), поэтому hasRuleFlag здесь не используется.
// ════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {object} SpeedMultiplierTrait
 * @property {string} id
 * @property {string} label
 * @property {RegExp} match   по имени предмета (любая половина «English / Русское»)
 * @property {{half?:number, move?:number, charge?:number, run?:number}} mult  SPD × N
 */

/** @type {readonly SpeedMultiplierTrait[]} */
export const SPEED_MULTIPLIER_TRAITS = Object.freeze([
  { id: "worshippersOfDance", label: "Почитатели Танца", match: /Worshippers of Dance|Почитатели Танца/i,
    mult: { half: 2, move: 3, charge: 6, run: 12 } },
  { id: "acrobaticMastery", label: "Акробатическое Мастерство", match: /Acrobatic Mastery|Акробатическое Мастерство/i,
    mult: { half: 2, move: 4, charge: 8, run: 14 } },
  { id: "strikingPerformance", label: "Разящее Представление", match: /Striking Performance|Разящее Представление/i,
    mult: { move: 3, charge: 6, run: 12 } }
]);

/**
 * Текущий SPD персонажа: system.movement.spdNow (без множителей Черт), а нет его (старые данные,
 * существо без пересчёта листа) — halfMove. Всё, что в книге считается от SPD (пул Отскока, Полушаг,
 * Вольт, Карабканье, Перебежка, Давление, Пересилить), читает ЭТО, а не halfMove: у носителя
 * Почитателей Танца и Акробатического Мастерства halfMove — уже SPD×2.
 */
export function spdOfMovement(movement) {
  return Number(movement?.spdNow ?? movement?.halfMove) || 0;
}

/**
 * Какие Черты-множители есть у актора (тип предмета — Черта).
 * @returns {SpeedMultiplierTrait[]}
 */
export function speedMultiplierTraitsOf(actor) {
  const items = actor?.items ?? [];
  return SPEED_MULTIPLIER_TRAITS.filter(def => items.some(i => i?.type === "trait" && def.match.test(String(i.name ?? ""))));
}

/**
 * Лучший множитель каждой дистанции у актора: { half?, move?, charge?, run? } (пусто — нет Черт).
 */
export function speedMultipliersFor(actor) {
  const best = {};
  for (const def of speedMultiplierTraitsOf(actor)) {
    for (const [k, v] of Object.entries(def.mult)) best[k] = Math.max(best[k] ?? 0, v);
  }
  return best;
}
