// module/rules/full-fire.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Full Fire / Полный Огонь (core.json, «Стрелок», Sahara 3-5fbf).
//
//  Книга: «Персонаж может стрелять из всех стволов своего оружия одновременно,
//  наплевав на собственную безопасность. Он может потратить Реакцию, чтобы
//  одновременно стрелять из: винтовки и ее комби-подствольника, оружия в ладони
//  и оружия на запястье этой руки, или тяжелого оружия и встроенной в него через
//  Талант Tandem винтовки или пистолета (выберите только одно), но все такие
//  атаки получают штраф –10».
//
//  Решение владельца 24.10.2026 (трактовка А): ОД платится за выстрел из ОСНОВНОГО
//  ствола (винтовка, ладонь, тяжёлое), РЕАКЦИЯ — за выстрел из второго (комби-
//  подствольник = второй профиль того же предмета со своим стволом; встроенная
//  Тандемом винтовка/пистолет = профиль-тандем; оружие на запястье = другой
//  предмет). Оба выстрела −10.
//
//  Что считается второй стороной пары (три сценария книги):
//    «combi»      — основной предмет Винтовка (не длинная), второй — профиль со
//                   своим стволом (ownFire), не тандем;
//    «tandem»     — основной предмет Тяжёлое, второй — профиль-тандем (его заводит
//                   Тандем, rules/tandem.mjs);
//    «palmWrist»  — основной предмет в ладони, второй — другое стрелковое оружие
//                   на запястье (Wrist); если у обоих известна рука — одна и та же.
//
//  Чистые функции: Foundry, сцены и бросков здесь нет. Поток — sheets/attack/dialog.mjs.
//  Модуль не импортируется из rules/sources.mjs — круга через source-registry нет.
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";
import { isWristMounted, getHeldHand } from "./hands.mjs";

export const FULL_FIRE = Object.freeze({ key: "rangedCore.core.fullFire", name: "Full Fire" });

/** Штраф каждой атаки пары. */
export const FULL_FIRE_PENALTY = -10;

export const hasFullFire = actor => hasAbility(actor, FULL_FIRE.key, FULL_FIRE.name, "talent");

const hasProp = (sys, key) => (sys?.weaponProps || []).some(p => (p?.key ?? p) === key);
const hasRof = s => (Number(s?.rof_single) || 0) > 0 || (Number(s?.rof_semi) || 0) > 0 || (Number(s?.rof_full) || 0) > 0;

/** Бонус режима огня второй стороны к порогу (без модификаций и Импульса — упрощение, см. шапку dialog.mjs). */
export const FULL_FIRE_ROF_BONUS = Object.freeze({ single: 10, semi: 0, full: -10 });

/**
 * Бонус режима огня ВТОРОЙ стороны пары (вторая рука «Обе руки», task-f67c): режим из таблицы выше плюс
 * «Попадание» её собственных модификаций (Целеуказатель, getModEffects(actor, второе оружие)). Рукопашному
 * ("melee") и незнакомому режиму — 0. Бонус режима огня ОСНОВНОГО оружия сюда не входит.
 *
 * @param {string} mode  "single" | "semi" | "full" | "melee"
 * @param {object} modFx getModEffects(actor, второе оружие) — читаются rofSingle/Semi/FullAttackMod
 */
export function secondRofBonus(mode, modFx = {}) {
  const base = FULL_FIRE_ROF_BONUS[mode];
  if (base === undefined) return 0;
  const mod = { single: modFx.rofSingleAttackMod, semi: modFx.rofSemiAttackMod, full: modFx.rofFullAttackMod }[mode];
  return base + (Number(mod) || 0);
}

/** Стволы-профили предмета (свой магазин и скорострельность, стрелковые). */
export function ownBarrels(item) {
  const list = Array.isArray(item?.system?.profiles) ? item.system.profiles : [];
  return list.map((profile, idx) => ({ profile, idx }))
    .filter(({ profile }) => profile?.ownFire && !profile?.melee && hasRof(profile));
}

/**
 * Режимы огня второй стороны по её собственным цифрам скорострельности.
 * @param {object} fireSys  system с полями rof_single/rof_semi/rof_full
 */
export function fullFireRofOptions(fireSys) {
  const opts = [];
  if ((Number(fireSys?.rof_single) || 0) > 0) opts.push({ value: "single", label: "Одиночный" });
  if ((Number(fireSys?.rof_semi) || 0) > 0) opts.push({ value: "semi", label: `Короткая очередь (${fireSys.rof_semi})` });
  if ((Number(fireSys?.rof_full) || 0) > 0) opts.push({ value: "full", label: `Длинная очередь (${fireSys.rof_full})` });
  return opts;
}

/**
 * Что можно выстрелить вместе с основным стволом этого окна атаки.
 *
 * @param {object} actor
 * @param {object} item            оружие окна атаки
 * @param {object} [o]
 * @param {object} [o.startProfile] профиль, с которым открыто окно (ствол-профиль или «Ударить оружием» — не основной ствол)
 * @param {boolean}[o.isMelee]
 * @returns {Array<{value:string, scenario:string, kind:"profile"|"item", profileIdx?:number, itemId?:string, label:string, rof:object[]}>}
 */
export function fullFireOptions(actor, item, { startProfile = null, isMelee = false } = {}) {
  if (!hasFullFire(actor) || !item || item.type !== "weapon" || isMelee) return [];
  const sys = item.system ?? {};
  if (sys.weaponClass === "melee") return [];
  // Окно открыто на втором стволе или на «Ударить оружием» — основным стволом оно не является:
  // ОД платит основной выстрел, поэтому пару предлагаем только от основного ствола.
  if (startProfile && (startProfile.ownFire || startProfile.melee)) return [];

  const out = [];
  const isRifle = sys.weaponClass === "basic" && !hasProp(sys, "longRifle");
  const isHeavy = sys.weaponClass === "heavy";
  for (const { profile, idx } of ownBarrels(item)) {
    const label = profile.label || `ствол ${idx + 1}`;
    if (profile.tandem && isHeavy) {
      out.push({ value: `p:${idx}`, scenario: "tandem", kind: "profile", profileIdx: idx,
        label: `Тандем: ${label}`, rof: fullFireRofOptions(profile) });
    } else if (!profile.tandem && isRifle) {
      out.push({ value: `p:${idx}`, scenario: "combi", kind: "profile", profileIdx: idx,
        label: `Комби-подствольник: ${label}`, rof: fullFireRofOptions(profile) });
    }
  }

  // Комби-подствольник как ОТДЕЛЬНЫЙ предмет: в паке комби-оружие (Комби-Мельта, Вспомогательный Гранатомёт…) — самостоятельные
  // предметы со свойством Combi («устанавливаются на другие винтовки»). Они не занимают руку (висят на винтовке),
  // поэтому «снаряжено» не требуется — достаточно, чтобы лежали при персонаже, не на складе.
  if (isRifle && !hasProp(sys, "combi")) {
    for (const other of actor?.items ?? []) {
      if (other.type !== "weapon" || other.id === item.id || other.system?.stored) continue;
      if (!hasProp(other.system, "combi") || other.system?.weaponClass === "melee" || !hasRof(other.system)) continue;
      out.push({ value: `i:${other.id}`, scenario: "combi", kind: "item", itemId: other.id,
        label: `Комби-подствольник: ${other.name}`, rof: fullFireRofOptions(other.system) });
    }
  }

  // «Ладонь + запястье этой руки»: основное оружие не на запястье, второе — на запястье.
  if (item.system?.equipped && !isWristMounted(item, actor)) {
    const mainHand = getHeldHand(item);
    for (const other of actor?.items ?? []) {
      if (other.type !== "weapon" || other.id === item.id || !other.system?.equipped) continue;
      if (other.system?.weaponClass === "melee" || !hasRof(other.system)) continue;
      if (!isWristMounted(other, actor)) continue;
      const otherHand = getHeldHand(other);
      if (mainHand && otherHand && mainHand !== otherHand) continue;
      out.push({ value: `i:${other.id}`, scenario: "palmWrist", kind: "item", itemId: other.id,
        label: `На запястье: ${other.name}`, rof: fullFireRofOptions(other.system) });
    }
  }
  return out;
}

/**
 * Почему второй ствол пары стрелять не может ("" — может): оружие сломано или заклинило, магазин пуст.
 * Те же запреты основному оружию ставит кнопка «Атака» листа; у второго ствола кнопки нет, поэтому проверка здесь.
 * @param {object|null} secondItem  предмет второго ствола (тот же, что основной, для профиля)
 * @param {object|null} profile     профиль-ствол (если вторая сторона — профиль)
 */
export function fullFireSecondBlockReason(secondItem, profile = null) {
  const sys = secondItem?.system ?? {};
  if (sys.destroyed) return `«${secondItem.name}» сломано`;
  if (sys.jammed) return `«${secondItem.name}» заклинило`;
  const src = profile ?? sys;
  if ((Number(src.magazineMax) || 0) > 0 && !((Number(src.magazineCur) || 0) > 0)) {
    return `магазин «${profile?.label || secondItem?.name || "второго ствола"}» пуст`;
  }
  return "";
}

/** Найти вариант по значению селекта окна. */
export function fullFireOptionByValue(options, value) {
  return (options || []).find(o => o.value === value) ?? null;
}

/**
 * Порог второй стороны пары: порог окна (он уже несёт −10, режим огня и Прицеливание основного ствола)
 * с заменой режима огня, оружейной части и Прицеливания на свои.
 *
 * @param {object} p
 * @param {number} p.mainThreshold  thresholdOf(f) — порог основного выстрела
 * @param {number} p.mainRofBonus   бонус режима огня основного выстрела (f.rofBonus)
 * @param {string} p.secondRof      режим огня второго выстрела
 * @param {number} p.weaponDelta    оружейная часть второй стороны минус оружейная часть основной
 * @param {number} p.aimAdjust      Прицеливание, учтённое в пороге основного выстрела (второй выстрел его не получает)
 */
export function fullFireSecondThreshold({ mainThreshold, mainRofBonus = 0, secondRof = "single", weaponDelta = 0, aimAdjust = 0 }) {
  const rof = FULL_FIRE_ROF_BONUS[secondRof] ?? 0;
  return mainThreshold - (Number(mainRofBonus) || 0) + rof + (Number(weaponDelta) || 0) - (Number(aimAdjust) || 0);
}
