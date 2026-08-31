// module/rules/death-save.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Смерть (стр. 232-233 книги, глава «СМЕРТЬ» книги Core): Чудесное Спасение,
//  Божественная Защита, Замедленная Анимация Астартес. Чистые функции — что
//  доступно актору и во что обходится попытка; сам бросок и запись на актора —
//  module/sheets/tabs/death.mjs (там же Foundry-зависимые части).
//
//  «Игрушка Богов» (принуждение использовать Спасение/Защиту, если это не
//  Cor до 100) и «Воскрешение» — не сюда: первое чисто ГМ-отыгрыш (см.
//  напоминание в диалоге death.mjs), второе — кнопка «Воскресить» без
//  формулы вовсе (по прямому решению пользователя — последствия на ГМа).
// ════════════════════════════════════════════════════════════════════════════

import { isSusAnMembraneItem } from "./predicates.mjs";

/** Пул очков, которым персонаж расплачивается — Судьба у лоялиста, Бесчестье у хаосита. */
export function fatePoolLabel(actor) {
  return actor?.system?.alignment === "heretic" ? "Бесчестья" : "Судьбы";
}

/** Чудесное Спасение: 1d10+10 очков пула, 1d10 Порчи (стр. 232). */
export const MIRACULOUS_SAVE = { fateDie: "1d10", fateFlat: 10, corDie: "1d10" };

/** Божественная Защита (Талант hYcsqWMLl57P8wq1): 1d5+5 очков пула, 1d5 Порчи. */
export const DIVINE_PROTECTION = { fateDie: "1d5", fateFlat: 5, corDie: "1d5" };

/** Замедленная Анимация Астартес (Сус-ан Мембрана): тест W+30. */
export const SUS_AN_TEST_MOD = 30;
/** Раны не должны быть ниже −15, иначе десантника уже не спасти этим способом. */
export const SUS_AN_MIN_CRITICAL = 15;

/** Есть ли у актора Талант «Божественная Защита» (по имени, как импланты Геносемени). */
export function hasDivineProtectionTalent(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && /Божественная Защита/i.test(i.name || ""));
}

/** Установленная Сус-ан Мембрана (флаг installed — как у остальных имплантов Хирургеона). */
export function hasSusAnMembrane(actor) {
  return !!actor?.items?.some(i => isSusAnMembraneItem(i) && !!i.getFlag?.("warhammer-dbc", "installed"));
}

/** Раны ещё не ушли ниже -15 — Замедленная Анимация всё ещё доступна. */
export function susAnEligible(actor) {
  const crit = Number(actor?.system?.wounds?.critical) || 0;
  return crit <= SUS_AN_MIN_CRITICAL;
}

/** Провалилось ли Спасение/Защита: пул опустился бы до 0 или ниже. */
export function fateSaveFails(currentFate, loss) {
  return (Number(currentFate) || 0) - loss <= 0;
}

/** Хаосит с Покровительством — «Игрушка Богов» (стр. 233): напоминание, не гейт. */
export function toyOfGodsApplies(actor) {
  return actor?.system?.alignment === "heretic";
}
