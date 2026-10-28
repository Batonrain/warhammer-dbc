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
//  Начисление — карточка «Трофей» после констатации смерти цели убийцей-носителем (combat/trophy-kill.mjs):
//  «офицер/чемпион/чудовище» и «достойна ли цель» решает ГМ диалогом, сумму (1 либо 2/3/4 по Inf цели при
//  Трофеях Триумфа) и зажим по P.b считает система. Трофеи Приговора (возврат очка за приговор) — вручную.
//  Трата: Туманный Прыжок (combat/talent-move.mjs) и Окончательная Казнь (combat/final-execution.mjs).
//
//  Модуль чистый и намеренно НЕ импортирует hasRuleFlag/collect: его зовёт rules/character.mjs
//  (пересчёт листа), а круг через rules/sources.mjs вешает загрузку (AGENTS.md).
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

/**
 * Носители пула: Черта Мастера Казней и Таланты, которые очки тратят или начисляют. `match` — по имени
 * предмета (любая половина «English / Русское»); по нему же носителя находит tools/capability-reachability.mjs.
 */
const HOLDERS = [
  { types: ["trait"],  match: /Trophy Taker|Собиратель Трофеев/i },
  { types: ["talent"], match: /Mist Leap|Туманный Прыжок|Final Execution|Окончательная Казнь|Trophies of Triumph|Трофеи Триумфа/i }
];
/**
 * Носители по ТОЧНОМУ имени (любая половина): у «Marked Prey» есть тёзка по подстроке — Талант Шамана Зверолюдей
 * «Hex-Marked Prey / Проклятая Метка», регулярка без якорей дала бы ему пул Трофеев.
 */
const EXACT_HOLDERS = [
  { types: ["talent"], names: ["Marked Prey", "Отмеченная Добыча", "Trophies of Judgement", "Трофеи Приговора"] }
];
/** «Трофеи Триумфа» (Талант) — сумма за убитую цель по Inf. */
const TRIUMPH = { types: ["talent"], match: /Trophies of Triumph|Трофеи Триумфа/i };

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Положены ли актору Очки Трофеев (есть Черта/Талант, связанные с пулом). */
export function hasTrophyPoints(actor) {
  const items = actor?.items ?? [];
  return HOLDERS.some(h => items.some(i => h.types.includes(i?.type) && h.match.test(String(i.name ?? ""))))
    || EXACT_HOLDERS.some(h => items.some(i => h.types.includes(i?.type) && h.names.some(n => itemHasName(i, n))));
}

/** Есть ли у актора Талант «Трофеи Триумфа» (Талант, не Черта-тёзка). */
export function hasTrophiesOfTriumph(actor) {
  return (actor?.items ?? []).some(i => TRIUMPH.types.includes(i?.type) && TRIUMPH.match.test(String(i.name ?? "")));
}

/**
 * Сколько Очков Трофеев даёт убитая достойная трофея цель. Собиратель Трофеев — 1; Трофеи Триумфа
 * вместо единицы: Inf цели 30–59 — 2, 60–79 — 3, 80+ — 4 (ниже 30 остаётся 1). «Достойна ли цель» решает ГМ.
 */
export function trophyAwardAmount({ triumph = false, inf = 0 } = {}) {
  const n = num(inf);
  if (!triumph) return 1;
  if (n >= 80) return 4;
  if (n >= 60) return 3;
  if (n >= 30) return 2;
  return 1;
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
