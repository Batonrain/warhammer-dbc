// module/rules/terminator-armour.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Терминаторская броня (корбук, стр. 235) и Черта Чемпиона-Терминатора
//  «Изящный Гигант» (Graceful Giant, корбук, Элитные Архетипы):
//
//    Броня: «Дает Штраф к A, указанный в профиле брони. … Не позволяет
//    Прыгать, Уклоняться и совершать любые тесты Acrobatics.»
//    Профили: Сатурнин A −30 / Max.A 25, Катафракт −25 / 35, Индоминус
//    −20 / 45, Тартарос −15 / –, Эгида −15 / –.
//
//    Черта: «Он уменьшает штраф к A на 10, увеличивает Max.A на 10, может
//    совершать Уклонение со штрафом –10, и может использовать любое оружие,
//    а не ограниченный набор совместимого.»
//
//  Штраф к A хранится в самой броне (armor.mjs::agilityPenalty, положительное
//  число — сколько вычитается), вычитает его rules/character.mjs; Max.A —
//  armor.mjs::maxAgility, читает combat/armor-mods.mjs::armorAgilityCap. Здесь
//  только то, что зависит от Черты, и запрет Уклонения.
//
//  Тесты Acrobatics в такой броне проваливаются без броска — правило
//  core.terminatorNoAcrobatics (rules/library/core.mjs).
//  Честно НЕ покрыто: запрет Прыжка (у Прыжка нет своей кнопки) и
//  ограничение набора оружия в руках (его система не проверяет вовсе, поэтому
//  и «любое оружие» Черты снимать нечего).
//
//  Черта опознаётся по имени ИЛИ по записи Конструктора kind:"capability"
//  прямо на предмете — без hasRuleFlag: эти функции зовёт пересчёт листа, а
//  сбор правил актора внутри пересчёта означал бы круг.
//  Чистые функции, test/rules/terminator-armour.test.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

export const GRACEFUL_GIANT_KEY = "trait.elitnyeArhetipy.chempionTerminator.gracefulGiant";
export const GRACEFUL_GIANT_PENALTY_REDUCTION = 10;
export const GRACEFUL_GIANT_MAX_AGILITY_BONUS = 10;
export const GRACEFUL_GIANT_DODGE_PENALTY = -10;

// Те же пять книжных образцов, что у predicates.mjs::wearsTerminatorArmour
// (отдельного признака у брони нет).
const TERMINATOR_ARMOUR_RE = /saturnyne|cataphractii|indom[ie]nus|tartaros|terminator aegis|терминатор|катафракт|тартарос|сатурнин|индомитус|индоминус/i;

/** Предмет — Терминаторская броня (Мк I–IV, Эгида). */
export function isTerminatorArmour(item) {
  return item?.type === "armor" && TERMINATOR_ARMOUR_RE.test(String(item?.name ?? ""));
}

/** Надетая Терминаторская броня актора (первая) или null. */
export function equippedTerminatorArmour(actor) {
  for (const i of actor?.items ?? []) if (isTerminatorArmour(i) && i.system?.equipped) return i;
  return null;
}

function carriesKey(item, key) {
  const groups = item?.flags?.["warhammer-dbc"]?.mechanics ?? [];
  return groups.some(g => (g?.entries ?? []).some(e => e?.kind === "capability" && e?.capabilityKey === key));
}

/** Есть ли у актора Черта «Изящный Гигант». */
export function hasGracefulGiant(actor) {
  for (const i of actor?.items ?? []) {
    if (i?.type !== "trait") continue;
    if (itemHasName(i, "Graceful Giant") || carriesKey(i, GRACEFUL_GIANT_KEY)) return true;
  }
  return false;
}

/** На сколько Черта уменьшает штраф к A ЭТОЙ брони (0 — не терминаторская или Черты нет). */
export function gracefulGiantPenaltyReduction(actor, item) {
  return isTerminatorArmour(item) && hasGracefulGiant(actor) ? GRACEFUL_GIANT_PENALTY_REDUCTION : 0;
}

/**
 * На сколько Черта поднимает Max.A ЭТОЙ брони. Только там, где потолок есть
 * (в данных 100 = потолка нет: у Тартароса и Эгиды поднимать нечего).
 */
export function gracefulGiantAgilityBonus(actor, item) {
  if (!isTerminatorArmour(item) || !hasGracefulGiant(actor)) return 0;
  const cap = Number(item.system?.maxAgility);
  return Number.isFinite(cap) && cap < 100 ? GRACEFUL_GIANT_MAX_AGILITY_BONUS : 0;
}

/**
 * Можно ли Уклоняться в надетой броне.
 * @returns {{blocked:boolean, reason?:string, penalty:number, note?:string}}
 *   blocked — Уклонение недоступно (Реакция не тратится);
 *   penalty/note — штраф к порогу и подпись, когда Изящный Гигант разрешает.
 */
export function terminatorDodgeVerdict(actor) {
  const armour = equippedTerminatorArmour(actor);
  if (!armour) return { blocked: false, penalty: 0 };
  if (hasGracefulGiant(actor)) {
    return { blocked: false, penalty: GRACEFUL_GIANT_DODGE_PENALTY, note: "Изящный Гигант −10" };
  }
  return { blocked: true, penalty: 0, reason: "Терминаторская броня не позволяет Уклоняться" };
}
