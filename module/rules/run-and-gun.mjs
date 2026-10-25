// module/rules/run-and-gun.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Run and Gun / Стрельба на Бегу (core.json, «Стрелок», Sahara 3-5fbf) и
//  Bayonet Charge / Штыковая Атака (core.json, «Рукопашные», Sahara 3-8dc5) —
//  один общий замок оружия, поэтому в одном модуле.
//
//  Run and Gun: «Когда он совершает Натиск, он может из любой точки пути Натиска
//  за свободное действие стрелять из не-тяжелого оружия, после чего может сложить
//  это оружие и достать рукопашное. Эта стрельба не может быть Избирательной. Если
//  он не сложил оружие, из которого он стрелял, он не может стрелять из него в
//  рукопашной в этот Ход (в т.ч. Талантом Bayonet Charge)».
//
//  Bayonet Charge: Приём (База: любая; Оружие: штык) — базовая рукопашная атака со
//  штрафом −10; «в случае успешного попадания он может за свободное действие
//  провести стрелковую атаку из оружия по противнику, как если бы это был выстрел в
//  упор (+30 за расстояние, невзирая на то что персонаж связан в ближнем бою)».
//
//  Решения владельца 24.10.2026: Run and Gun — выстрел в любой момент Натиска без
//  привязки к позиции на пути (образец — combat/free-shot.mjs); стрелявшее оружие
//  помечается «в рукопашной в этот Ход не стрелять», пока его не сложили
//  (Quick Store / Сложить — sheets/tabs/gear.mjs::equipItem).
//
//  Чистые функции: Foundry, сцены и бросков здесь нет. Поток — combat/free-shot.mjs.
//  Модуль не импортируется из rules/sources.mjs — круга через source-registry нет.
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";

export const RUN_AND_GUN = Object.freeze({ key: "rangedCore.core.runAndGun", name: "Run and Gun" });
export const BAYONET_CHARGE = Object.freeze({ key: "meleeCore.core.bayonetCharge", name: "Bayonet Charge" });

/** Натиск объявлен — бесплатный выстрел ещё не сделан (turn-scoped, rules/turn-flags.mjs). */
export const RUN_AND_GUN_PENDING_FLAG = "runAndGunPending";
/** Id оружия, из которого стреляли на Натиске и которое не сложили (turn-scoped). */
export const RUN_AND_GUN_FIRED_FLAG = "runAndGunFired";
/** Штыковая Атака попала — свободный выстрел ещё не сделан (turn-scoped). */
export const BAYONET_SHOT_PENDING_FLAG = "bayonetChargePending";

export const hasRunAndGun = actor => hasAbility(actor, RUN_AND_GUN.key, RUN_AND_GUN.name, "talent");
export const hasBayonetCharge = actor => hasAbility(actor, BAYONET_CHARGE.key, BAYONET_CHARGE.name, "talent");

const hasRof = sys => (Number(sys?.rof_single) || 0) > 0 || (Number(sys?.rof_semi) || 0) > 0 || (Number(sys?.rof_full) || 0) > 0;

/** «Не-тяжёлое» стрелковое оружие: Пистолет, Ручное, Метательное (не Тяжёлое/Пусковое/Стационарное). */
export const runAndGunEligibleWeapon = item => item?.type === "weapon"
  && ["pistol", "basic", "thrown"].includes(item.system?.weaponClass) && hasRof(item.system);

/** Штыковая Атака: выстрел из огнестрела — Пистолет или Ручное. */
export const bayonetShotEligibleWeapon = item => item?.type === "weapon"
  && ["pistol", "basic"].includes(item.system?.weaponClass) && hasRof(item.system);

/** Экипированное оружие, подходящее под предикат (порядок инвентаря). */
export const equippedWeaponsWhere = (actor, pred) => [...(actor?.items ?? [])].filter(i => i.system?.equipped && pred(i));

/**
 * Почему из этого оружия нельзя стрелять сейчас ("" — можно): им стреляли на
 * Натиске и не сложили, а персонаж в рукопашной.
 * @param {{isMelee:boolean, inMelee:boolean}} ctx
 */
export function runAndGunLockReason(actor, item, { isMelee, inMelee }) {
  if (isMelee || !inMelee || !item?.id) return "";
  const firedId = actor?.getFlag?.("warhammer-dbc", RUN_AND_GUN_FIRED_FLAG);
  if (!firedId || firedId !== item.id) return "";
  return `Стрельба на Бегу: из ${item.name} стреляли на Натиске и не сложили — в рукопашной в этот Ход им стрелять нельзя (в т.ч. Штыковой Атакой). Сложите оружие или стреляйте другим`;
}

/** Бесплатные выстрелы Талантов, не запирающие «Без прицела» (остальные — не Избирательные). */
export const freeShotLocksAim = kind => !!kind && kind !== "coveringFire" && kind !== "bayonetCharge";

/** Бесплатный выстрел считается Атакой Хода (лимит Атак): только обычная атака и Стрельба от Бедра. */
export const freeShotCountsAsAttack = kind => !kind || kind === "hipShooting";

/** Режимы огня окна атаки для бесплатного выстрела. */
export function freeShotRofModes(kind) {
  if (kind === "coveringFire") return ["semi", "full"];
  if (kind === "runAndGun" || kind === "bayonetCharge") return ["single", "semi", "full"];
  return ["single"];
}
