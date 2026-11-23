// module/rules/vitkis-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Виткис (Элитный архетип Кхорна) — Провидец Войны и Таланты поверх него.
//  Чистая часть без Foundry; подключена источником правил «vitkis»
//  (rules/sources.mjs) — поэтому импортирует только predicates/talent-targets.
//
//  War Seer / Провидец Войны: раз в Ход тест Common Lore(War)(I)+10 по одной
//  цели; при Успехе — один эффект до начала следующего Хода Виткиса. Итог
//  кнопки (combat/vitkis.mjs) — флаг warSeer на Виткисе:
//    { combatId, entries: [{ targetUuid, targetId, targetName, effect, deg,
//                            persistent, book }] }
//  Кто что читает:
//    hit      — +3×Успехи к рукопашным атакам по цели (правило ниже, авто);
//    opposed  — +5×Успехи к встречным тестам WS/S/A против цели (приёмы);
//    orders   — +5×Успехи к Командованию (галочка: приказ атаковать цель/
//               защищаться от неё — система не знает, о чём приказ);
//    dmg      — +Успехи к урону рукопашных атак по цели (combat/attack.mjs);
//    evade    — −3×Успехи к Избеганиям цели от атак Виткиса (combat/defense.mjs);
//    deceive  — побеждает во всех тестах цели обмануть его (строка карточки).
//  Таланты:
//    Blood Feud — против Ненавистного врага эффект до конца боя (persistent);
//      такой же эффект по той же цели заменяется, только если Успехов больше;
//    Book of Battle — к dmg/hit: цель −3×Успехи на атаки по Виткису (правило
//      источника для ЦЕЛИ) и +1 Реакция Виткису только на Парирование;
//    Brothers at Arms — Успехи идут и на Команды, и на другой эффект;
//    Harder They Fall — по цели Размером больше 1 Успехи ×Размер;
//    Split Vision — Успехи делятся на до P.b целей/эффектов;
//    Witchslayer — 1 Очко Бесчестия: атаке под dmg/hit свойство Sanctified.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName, sizeOf, hatredTargetsOf } from "./predicates.mjs";
import { anyTargetMatches } from "./talent-targets.mjs";

const NS = "warhammer-dbc";
export const WAR_SEER_FLAG = "warSeer";
export const WITCHSLAYER_FLAG = "witchslayerNext";
export const WAR_SEER_BONUS = 10;

export const WAR_SEER_EFFECTS = Object.freeze({
  deceive: { label: "Не обмануть", text: "побеждает во всех тестах цели обмануть его (в т.ч. Финтом)" },
  dmg:     { label: "Урон", text: "+Успехи к урону рукопашных атак по цели" },
  hit:     { label: "Попадание", text: "+3×Успехи на рукопашные атаки по цели" },
  evade:   { label: "Избегание цели", text: "−3×Успехи цели на Избегания от его атак" },
  orders:  { label: "Приказы", text: "+5×Успехи на приказы атаковать цель или защищаться от неё" },
  opposed: { label: "Встречные", text: "+5×Успехи на встречные тесты WS, S и A против цели" }
});

const hasNamed = (actor, type, name) =>
  [...(actor?.items ?? [])].some(i => i?.type === type && itemHasName(i, name));
export const hasWarSeer        = a => hasNamed(a, "trait", "War Seer");
export const hasAllKnowing     = a => hasNamed(a, "trait", "All-Knowing");
export const hasBloodFather    = a => hasNamed(a, "trait", "Blood Father");
export const hasBloodFeud      = a => hasNamed(a, "talent", "Blood Feud");
export const hasBookOfBattle   = a => hasNamed(a, "talent", "Book of Battle");
export const hasBrothersAtArms = a => hasNamed(a, "talent", "Brothers at Arms");
export const hasHarderTheyFall = a => hasNamed(a, "talent", "Harder They Fall");
export const hasSplitVision    = a => hasNamed(a, "talent", "Split Vision");
export const hasWitchslayer    = a => hasNamed(a, "talent", "Witchslayer");

/**
 * Книга Битвы: «+1 Реакция только на Парирование атак цели» — метка для combat/action-economy.mjs::
 * PARRY_ONLY_REACTION_FLAG по записям Провидца Войны с book. null — Книга не сработала.
 */
export function bookParryReactionFlag(entries) {
  const targets = (entries ?? []).filter(e => e?.book).map(e => ({ targetUuid: e.targetUuid, targetId: e.targetId ?? "" }));
  return targets.length ? { value: 1, targets } : null;
}

/** Сколько целей/эффектов можно взять: 1, с Разделённым Видением — P.b. */
export function warSeerMaxSplits(actor) {
  if (!hasSplitVision(actor)) return 1;
  return Math.max(1, Math.floor((Number(actor?.system?.characteristics?.per?.total) || 0) / 10));
}

/** Тем Больнее Им Падать: Успехи ×Размер цели, если Размер больше 1. */
export function harderTheyFallDeg(actor, deg, target) {
  const size = sizeOf(target);
  return (hasHarderTheyFall(actor) && size > 1) ? deg * size : deg;
}

/** Кровная Вражда: цель — Ненавистный враг (Талант Hatred) → эффект до конца боя. */
export function bloodFeudPersistent(actor, target) {
  if (!hasBloodFeud(actor) || !target) return false;
  return anyTargetMatches(hatredTargetsOf(actor), { targetActor: target });
}

const sameActor = (entry, a) => !!a && (entry.targetUuid === a.uuid || (!!entry.targetId && entry.targetId === a.id));

/**
 * Провидец Войны «Не обмануть»: «побеждает во всех тестах цели обмануть его (в т.ч. Финтом)» — у защищающегося
 * Виткиса живая запись deceive против этого инициатора (Sahara 586-961c).
 */
export function warSeerUndeceivable(defender, initiator, combatId = "") {
  return !!initiator && warSeerEntries(defender, combatId).some(e => e.effect === "deceive" && sameActor(e, initiator));
}

/** Живые записи флага (того же боя; вне боя — флаг вне боя). */
export function warSeerEntries(actor, combatId = "") {
  const f = actor?.flags?.[NS]?.[WAR_SEER_FLAG] ?? actor?.getFlag?.(NS, WAR_SEER_FLAG);
  if (!f || !Array.isArray(f.entries)) return [];
  if ((f.combatId || "") !== (combatId || "")) return [];
  return f.entries;
}

/** Успехи эффекта Виткиса против этой цели (наибольшие из подходящих записей). */
export function warSeerDeg(actor, target, effect, combatId = "") {
  let best = 0;
  for (const e of warSeerEntries(actor, combatId)) if (e.effect === effect && sameActor(e, target)) best = Math.max(best, Number(e.deg) || 0);
  return best;
}

/**
 * Новые записи поверх прежних: временные прежние уходят (новый тест — новый
 * эффект), постоянные (Кровная Вражда) остаются; однотипный постоянный по той
 * же цели заменяется, только если у нового больше Успехов.
 */
export function mergeWarSeer(prev = [], next = []) {
  const kept = prev.filter(p => p.persistent);
  const out = [...kept];
  for (const n of next) {
    const i = out.findIndex(p => p.effect === n.effect && p.targetUuid === n.targetUuid);
    if (i < 0) out.push(n);
    else if ((Number(n.deg) || 0) > (Number(out[i].deg) || 0)) out[i] = n;
  }
  return out;
}

/** Начало Хода Виткиса: остаются только постоянные записи. */
export function warSeerAtTurnStart(flag) {
  if (!flag?.entries) return null;
  const entries = flag.entries.filter(e => e.persistent);
  return entries.length ? { ...flag, entries } : null;
}

/** Прибавка к урону рукопашной атаки Виткиса по цели. */
export function warSeerDamage(actor, target, { isMelee = false, combatId = "" } = {}) {
  return isMelee ? warSeerDeg(actor, target, "dmg", combatId) : 0;
}

/** Модификатор Избегания защищающегося от атаки этого атакующего (Виткиса). */
export function warSeerEvasionMod(defender, attacker, combatId = "") {
  return -3 * warSeerDeg(attacker, defender, "evade", combatId);
}

/** Убийца Ведьм: эта рукопашная атака получает Sanctified (метка ставится кнопкой за Очко). */
export function witchslayerArmed(actor, { isMelee = false } = {}) {
  return isMelee && !!(actor?.flags?.[NS]?.[WITCHSLAYER_FLAG] ?? actor?.getFlag?.(NS, WITCHSLAYER_FLAG));
}

/**
 * Источник правил «vitkis»: бонусы Провидца Войны к броскам самого Виткиса и
 * штраф Книги Битвы к атакам цели по Виткису.
 */
export function vitkisRules(actor, ctx = {}, combatId = "") {
  const rules = [];
  const t = ctx?.targetActor ?? null;
  if (t && hasWarSeer(actor)) {
    const hit = warSeerDeg(actor, t, "hit", combatId);
    if (hit > 0 && ctx.isMelee) rules.push({
      id: "vitkis.warSeer.hit", label: "Провидец Войны", when: {},
      effects: [{ kind: "rollBonus", target: "weapon:melee", value: 3 * hit, auto: true, label: `Провидец Войны: +3×${hit} по цели` }]
    });
    const opp = warSeerDeg(actor, t, "opposed", combatId);
    if (opp > 0 && ctx.contest && ["ws", "s", "ag"].includes(ctx.char)) rules.push({
      id: "vitkis.warSeer.opposed", label: "Провидец Войны", when: {},
      effects: [{ kind: "rollBonus", target: "all", value: 5 * opp, auto: true, label: `Провидец Войны: +5×${opp} во встречном тесте` }]
    });
  }
  if (hasWarSeer(actor)) {
    const orders = warSeerEntries(actor, combatId).filter(e => e.effect === "orders");
    for (const e of orders) rules.push({
      id: `vitkis.warSeer.orders.${e.targetUuid}`, label: "Провидец Войны", when: {},
      effects: [{ kind: "rollBonus", target: "skill:command", value: 5 * (Number(e.deg) || 0),
        label: `Провидец Войны: приказ атаковать ${e.targetName} или защищаться от него` }]
    });
  }
  // Книга Битвы — правило ЦЕЛИ: атакует Виткиса, который «прочёл» её.
  if (t && hasBookOfBattle(t)) {
    let pen = 0;
    for (const e of warSeerEntries(t, combatId)) if (e.book && sameActor(e, actor)) pen = Math.max(pen, Number(e.deg) || 0);
    if (pen > 0) rules.push({
      id: "vitkis.bookOfBattle", label: "Книга Битвы", when: {},
      effects: [{ kind: "rollBonus", target: "attack", value: -3 * pen, auto: true, label: `Книга Битвы (${t.name}): −3×${pen}` }]
    });
  }
  return rules;
}
