// module/rules/trophy-points.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ОЧКИ ТРОФЕЕВ (Sahara task-bbe1, решение владельца 27.10.2026) — пул Мастера Казней
//  (Элитный Архетип, Космодесантник): `system.trophyPoints = { value, max }`, по образцу
//  Рун Сигиллитов (rules/sigillite-runes.mjs) и Мёртвого Могущества.
//
//  Что говорит книга (packs-src Собиратель Трофеев / Трофеи Приговора / Трофеи Триумфа):
//   • Собиратель Трофеев (Черта): убив вражеского офицера, чемпиона или чудовище (по усмотрению
//     ГМа), получает 1 очко Трофеев; максимум — P.b. Может тратить их как Очки Бесчестия, но
//     только на тесты выслеживания, преследования и боя с офицерами/чемпионами/чудовищами;
//   • Трофеи Приговора (Талант): исполнив приговор нарушителю законов, восстанавливает очко —
//     по усмотрению ГМа, в перерывах между миссиями;
//   • Трофеи Триумфа (Талант): убивая достойную трофея цель с Inf 30–59 — 2 очка, 60–79 — 3, 80+ — 4;
//   • тратят: Туманный Прыжок (очко за прыжок), Окончательная Казнь (очко за усиленную атаку).
//  Автоначисления в системе НЕТ: «офицер/чемпион/чудовище» и «достойная трофея цель» решает
//  ГМ, приговор — тоже. Начисление — вручную (поле на листе); трата — Туманным Прыжком
//  (combat/talent-move.mjs). Что можно автоматизировать позже: кнопка «Трофей» на карточке
//  констатации смерти цели (sheets/tabs/body.mjs::setDeceased) с очками по Inf цели (30/60/80 → 2/3/4).
//
//  Модуль чистый и намеренно НЕ импортирует hasRuleFlag/collect: его зовёт rules/character.mjs
//  (пересчёт листа), а круг через rules/sources.mjs вешает загрузку (AGENTS.md).
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

/** Носители пула: Черта Мастера Казней и Таланты, которые очки тратят. */
const HOLDERS = [
  { types: ["trait"],  names: ["Trophy Taker", "Собиратель Трофеев"] },
  { types: ["talent"], names: ["Mist Leap", "Туманный Прыжок", "Final Execution", "Окончательная Казнь"] }
];

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Положены ли актору Очки Трофеев (есть Черта/Талант, связанные с пулом). */
export function hasTrophyPoints(actor) {
  const items = actor?.items ?? [];
  return HOLDERS.some(h => items.some(i => h.types.includes(i?.type) && h.names.some(n => itemHasName(i, n))));
}

/** Максимум — Бонус Восприятия (P.b, «макс. P.b»); 0, если пул актору не положен. */
export function trophyMax(actor) {
  return hasTrophyPoints(actor) ? Math.max(0, num(actor?.system?.characteristics?.per?.bonus)) : 0;
}

/** Текущее число Очков Трофеев. */
export function trophyValue(actor) {
  return Math.max(0, num(actor?.system?.trophyPoints?.value));
}

/**
 * Обновление пула после начисления/траты, с зажимом в 0…max. `null` — менять нечего
 * (или пул актору не положен).
 */
export function trophyUpdate(actor, delta) {
  if (!hasTrophyPoints(actor)) return null;
  const cur = trophyValue(actor);
  const next = Math.max(0, Math.min(trophyMax(actor), cur + num(delta)));
  return next === cur ? null : { "system.trophyPoints.value": next };
}
