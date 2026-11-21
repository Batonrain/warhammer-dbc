// module/rules/secutor-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Таланты и Черты Секутора (Элитные архетипы) — чистая часть без Foundry.
//  Кнопки — combat/secutor.mjs; читатели:
//    • Деструктор — combat/attack.mjs (Pen, пока работает Структурный Анализ);
//    • Берсерк-Стрелок и Непрерывный Натиск — источник «eliteMech2»
//      (rules/mech2-sources.mjs → secutorRules);
//    • Мирмидон — окно атаки (sheets/attack/mods.mjs) и бонус Уклонения цели
//      (combat/attack.mjs) через meleeShotClass;
//    • Ординатор — наложение «Сбит с ног» (rules/condition-guards.mjs,
//      combat/status-resist.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";
import { hatredTargetsOf, sizeOf } from "./predicates.mjs";
import { anyTargetMatches } from "./talent-targets.mjs";

const NS = "warhammer-dbc";
export const DESTRUCTOR_FLAG = "destructorCombat";
export const GUNZERKER_FLAG = "gunzerkerRound";
export const SUSTAINED_FLAG = "sustainedAssault";
/** Непрерывный Натиск: +3 за каждую предыдущую подряд атаку по той же цели. */
export const SUSTAINED_STEP = 3;

const flagOf = (actor, key) => actor?.flags?.[NS]?.[key] ?? actor?.getFlag?.(NS, key) ?? null;

export const hasDestructor = actor => hasItemNamed(actor, "Destructor", ["talent"]);
export const hasGunzerker = actor => hasItemNamed(actor, "Gunzerker", ["talent"]);
export const hasMyrmidon = actor => hasItemNamed(actor, "Myrmidon", ["talent"]);
export const hasOrdinator = actor => hasItemNamed(actor, "Ordinator", ["talent"]);
export const hasSustainedAssault = actor => hasItemNamed(actor, "Sustained Assault", ["talent"]);

// ── Деструктор ───────────────────────────────────────────────────────────────

/**
 * Цель с высокотехнологичной (не примитивной) бронёй, машина или здание:
 * техника, Черта Machine, либо надета броня без свойства Primitive.
 */
export function highTechTarget(target) {
  if (!target) return false;
  if (target.type === "vehicle") return true;
  if (hasItemNamed(target, "Machine", ["trait"])) return true;
  const worn = [...(target.items ?? [])].filter(i => i?.type === "armor" && i.system?.equipped);
  return worn.length > 0 && worn.some(a => !(a.system?.properties ?? []).some(p => /primitive|примитив/i.test(String(p))));
}

/**
 * Деструктор: «до конца боя при Структурном Анализе добавлять ещё +½I.b
 * (окр.▲) к Pen оружия при атаках по целям с высокотехнологичной бронёй,
 * машинам и зданиям». structural — бонус Структурного Анализа к этой атаке
 * уже ненулевой (одиночная Избирательная).
 */
export function destructorPenBonus(actor, { structural = false, targetActor = null, combatId = "", intBonus = 0 } = {}) {
  if (!structural || !combatId || !hasDestructor(actor)) return 0;
  if (flagOf(actor, DESTRUCTOR_FLAG) !== combatId) return 0;
  if (!highTechTarget(targetActor)) return 0;
  return Math.ceil(Math.max(0, Number(intBonus) || 0) / 2);
}

// ── Берсерк-Стрелок ──────────────────────────────────────────────────────────

/** Тест W+0 в начале Хода пройден в этом Раунде этого боя. */
export function gunzerkerActive(actor, { combatId = "", round = 0 } = {}) {
  const f = flagOf(actor, GUNZERKER_FLAG);
  return !!f && !!combatId && f.combatId === combatId && Number(f.round) === Number(round) && hasGunzerker(actor);
}

// ── Мирмидон ─────────────────────────────────────────────────────────────────

/**
 * Класс оружия «в расчёте стрельбы в рукопашной»: Мирмидон считает винтовки
 * пистолетами, а тяжёлое и длинные винтовки — винтовками.
 * @returns {{cls:string, noMeleeFire:boolean, myrmidon:boolean}}
 */
export function meleeShotClass(actor, weapon, { noMeleeFire = false } = {}) {
  const cls = String(weapon?.system?.weaponClass ?? "");
  if (!hasMyrmidon(actor)) return { cls, noMeleeFire: cls === "heavy" || !!noMeleeFire, myrmidon: false };
  if (cls === "basic" && !noMeleeFire) return { cls: "pistol", noMeleeFire: false, myrmidon: true };
  if (cls === "heavy" || noMeleeFire) return { cls: "basic", noMeleeFire: false, myrmidon: true };
  return { cls, noMeleeFire: false, myrmidon: false };
}

// ── Ординатор ────────────────────────────────────────────────────────────────

/**
 * «Не может быть сбит с ног, кроме как рукопашным приёмом персонажа больше
 * него Размером». true — устоял (Состояние не накладывается).
 */
export function ordinatorStands(actor, { attacker = null, melee = false } = {}) {
  if (!hasOrdinator(actor)) return false;
  return !(melee && attacker && sizeOf(attacker) > sizeOf(actor));
}

/** Оружие техники в руках персонажа (предмет из компендиума орудий: vehicleMount.isMounted). */
export const isVehicleWeaponInHand = (actor, weapon) =>
  actor?.type !== "vehicle" && weapon?.type === "weapon" && !!weapon.system?.vehicleMount?.isMounted;

/**
 * «Главное орудие танка» — в данных такой метки нет; главным считаем орудие
 * техники со свойством Ordnance (Боевая Пушка, Разрушитель, Сотрясатель…).
 */
export const isMainVehicleGun = weapon =>
  (weapon?.system?.weaponProps ?? []).some(p => p?.key === "ordnance");

/** Конечность: установленный имплант или предмет-оружие с таким именем. */
const hasLimb = (actor, re) =>
  [...(actor?.items ?? [])].some(i => (i.type === "implant" || i.type === "weapon") && re.test(String(i.name ?? "")));
const SERVO_ARM_RE = /servo[- ]arm|серво[- ]рук/i;
const TECH_DENDRITE_RE = /technical mechadendrite|технический мех/i;
const MANIP_DENDRITE_RE = /manipulator mechadendrite|манипулятор/i;

/** Ординатор с оружием техники в руках: гироскопы работают как Гиро-стабилизация (решение 21.11.2026). */
export const ordinatorVehicleGun = (actor, weapon) => hasOrdinator(actor) && isVehicleWeaponInHand(actor, weapon);

/**
 * Отказ в выстреле из оружия техники для Ординатора: главное орудие в корпусе —
 * нельзя; главное орудие танка в башне/спонсоне — нужны 3 конечности, одна из
 * них Серво-Рука. "" — стрелять можно.
 */
export function ordinatorGunRefusal(actor, weapon) {
  if (!ordinatorVehicleGun(actor, weapon) || !isMainVehicleGun(weapon)) return "";
  if (String(weapon.system?.vehicleMount?.mount ?? "") === "hull")
    return `Ординатор: ${weapon.name} — главное орудие в корпусе, с рук не стреляет.`;
  if (!hasLimb(actor, SERVO_ARM_RE))
    return `Ординатор: ${weapon.name} — главное орудие танка, нужны 3 конечности, одна из них Серво-Рука.`;
  return "";
}

/** Заряжающий: технический и манипулирующий мехадендриты у Ординатора. */
export const ordinatorLoader = actor =>
  hasOrdinator(actor) && hasLimb(actor, TECH_DENDRITE_RE) && hasLimb(actor, MANIP_DENDRITE_RE);

/**
 * Rld −1 в ОД: 2·N → 2·(N−1), Полное (2) → ½ (1), ½ (1) → свободно (0).
 */
export function ordinatorLoaderCost(baseCost) {
  const b = Number(baseCost) || 0;
  if (b <= 0) return 0;
  if (b <= 2) return b - 1;
  return b - 2;
}

// ── Непрерывный Натиск ───────────────────────────────────────────────────────

const targetKey = t => String(t?.uuid ?? t?.id ?? "");

/** Счётчик после этой атаки: та же цель — +1, другая — с нуля. */
export function sustainedNext(prev, targetActor, combatId = "") {
  const key = targetKey(targetActor);
  if (!key) return null;
  const same = prev && prev.combatId === combatId && prev.target === key;
  return { combatId, target: key, count: same ? (Number(prev.count) || 0) + 1 : 1 };
}

/** +3 × предыдущие подряд атаки по этой цели (Орда — одна цель, как и любой актор). */
export function sustainedAssaultBonus(actor, targetActor, combatId = "") {
  if (!hasSustainedAssault(actor) || !targetActor) return 0;
  const f = flagOf(actor, SUSTAINED_FLAG);
  if (!f || f.combatId !== combatId || f.target !== targetKey(targetActor)) return 0;
  return SUSTAINED_STEP * Math.max(0, Number(f.count) || 0);
}

// ── Источник правил ──────────────────────────────────────────────────────────

/** Правила Секутора для броска (источник eliteMech2). */
export function secutorRules(actor, ctx = {}) {
  const combat = globalThis.game?.combat ?? null;
  const combatId = combat?.id ?? "";
  const out = [];
  const target = ctx?.targetActor ?? null;
  const bonus = sustainedAssaultBonus(actor, target, combatId);
  if (bonus) out.push({
    id: "secutor.sustainedAssault", label: "Непрерывный Натиск",
    when: {},
    effects: [{ kind: "rollBonus", target: "attack", value: bonus, auto: true, label: `⚙️ Непрерывный Натиск +${bonus}` }]
  });
  if (target && gunzerkerActive(actor, { combatId, round: combat?.round ?? 0 })) {
    const targets = hatredTargetsOf(actor);
    if (targets.length && anyTargetMatches(targets, ctx)) out.push({
      id: "secutor.gunzerker", label: "Берсерк-Стрелок: Ненависть в стрельбе",
      when: {},
      effects: [{ kind: "rollBonus", target: "weapon:ranged", value: 10, auto: true, label: "⚙️ Берсерк-Стрелок: Ненависть +10" }]
    });
  }
  return out;
}
