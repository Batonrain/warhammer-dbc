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
//   • тратят: Туманный Прыжок (очко за прыжок), Окончательная Казнь (очко за усиленную атаку), Отмеченная Добыча (очко за отметку цели).
//  Начисление — карточка «Трофей» после констатации смерти цели убийцей-носителем (combat/trophy-kill.mjs):
//  «офицер/чемпион/чудовище» и «достойна ли цель» решает ГМ диалогом, сумму (1 либо 2/3/4 по Inf цели при
//  Трофеях Триумфа) и зажим по P.b считает система. Трофеи Приговора (возврат очка за приговор) — кнопка ГМа (combat/trophy-kill.mjs::restoreJudgementTrophy);
//  Отмеченная Добыча — combat/marked-prey.mjs (Sahara fear-2, 30.10.2026).
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

/** Inf цели — характеристика «Влияние» (system.characteristics.inf); для «аналога» не-Хаоситов ГМ правит число в диалоге. */
export const actorInf = actor => num(actor?.system?.characteristics?.inf?.total);

/** Есть ли у актора Талант «Трофеи Приговора» (Талант Мастера Казней). */
export function hasTrophiesOfJudgement(actor) {
  return (actor?.items ?? []).some(i => i?.type === "talent" && (itemHasName(i, "Trophies of Judgement") || itemHasName(i, "Трофеи Приговора")));
}

/** Есть ли у актора Талант «Отмеченная Добыча» (не Hex-Marked Prey Шамана Зверолюдей — точное имя). */
export function hasMarkedPrey(actor) {
  return (actor?.items ?? []).some(i => i?.type === "talent" && (itemHasName(i, "Marked Prey") || itemHasName(i, "Отмеченная Добыча")));
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

// ── Очки Трофеев как Очки Бесчестия (Собиратель Трофеев, Sahara task-0b3a) ──
// «Может тратить их как Очки Бесчестия, но только в тестах на выслеживание,
// преследование, или бой с вражескими офицерами, чемпионами, или чудовищами».
// Вид теста система знает по флагу карточки, а «офицер ли цель» — нет: это
// решение игрока и ГМа, подпись в окне «Чем заплатить?» (как у Мести
// Ревенанта — asInfamyNote, rules/resource-pools.mjs).
//   выслеживание  — Survival (книга: «тесты Survival … чтобы выслеживать
//                   цель»), Awareness (след, нюх);
//   преследование — Athletics, Acrobatics (погоня пешком), Stealth (книга:
//                   «преследовать цель в толпе»), Operate (погоня на машине);
//   бой           — атака (флаг attack карточки), Dodge, Parry.
const TROPHY_INFAMY_SKILLS = new Set(["survival", "awareness", "athletics", "acrobatics", "stealth", "dodge", "parry"]);
const TROPHY_INFAMY_GROUPS = new Set(["operate"]);

/** Подходит ли тест под трату Очка Трофеев как Очка Бесчестия. */
export function trophyInfamyTestEligible(test) {
  if (!test) return false;
  if (test.attack) return true;
  return TROPHY_INFAMY_SKILLS.has(String(test.skill || "")) || TROPHY_INFAMY_GROUPS.has(String(test.group || ""));
}

/** Тест карточки чата для трат «как Бесчестие»: { skill, group, attack } или null. */
export function infamyTestContext(message) {
  const f = message?.flags?.["warhammer-dbc"] ?? {};
  if (f.skillTest) return { skill: String(f.skillTest.skill || ""), group: String(f.skillTest.group || ""), attack: false };
  if (f.attack) return { skill: "", group: "", attack: true };
  return null;
}

export const TROPHY_INFAMY_NOTE = "только выслеживание, преследование или бой с вражеским офицером, чемпионом или чудовищем — решают игрок и ГМ";

/**
 * Вариант оплаты Очком Трофеев для окна «Чем заплатить?» — в форме записи пула
 * ресурса (key/label/asInfamyCor/asInfamyCap/asInfamyNote), или null.
 */
export function trophyInfamyOption(actor, test) {
  if (!trophyInfamyTestEligible(test) || !hasTrophyPoints(actor) || trophyValue(actor) < 1) return null;
  return { key: "trophy", label: "Очки Трофеев", asInfamy: true, asInfamyCap: 0, asInfamyCor: null, asInfamyNote: TROPHY_INFAMY_NOTE };
}
