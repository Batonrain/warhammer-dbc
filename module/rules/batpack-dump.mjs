// module/rules/batpack-dump.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Batpack Dump / Выпуск Батареи (core.json, «Оружейник», Sahara 3-9d40, решение
//  владельца 24.10.2026).
//
//  Книга: «Он может провести из лаз-оружия с модификацией Power Setting длинную очередь
//  с RoF 10, также дав оружию +1d10 Dmg и Свойство Storm(2). Эта атака получает штраф –30
//  на атаку со всех дистанций, кроме в упор и в рукопашной. После этой атаки само оружие
//  ломается и бесполезно (починка занимает смену работы). Учтите, что эта атака тратит
//  как минимум 20 зарядов, умножаясь со свойствами вроде Maximal, Surge, или Twin-Linked».
//
//  «Минимум 20» получается сам: RoF 10 × Storm(2) = 20, дальше расход умножают Surge,
//  Twin-Linked и Maximal штатным путём (combat/attack.mjs, ammoSpent).
//  Что есть «Power Setting» — rules/power-setting.mjs.
//
//  Чистые функции без Foundry. Не импортируется из rules/sources.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";
import { hasPowerSetting } from "./power-setting.mjs";

export const BATPACK_DUMP = Object.freeze({ key: "weaponsmith.core.batpackDump", name: "Batpack Dump" });
export const hasBatpackDump = actor => hasAbility(actor, BATPACK_DUMP.key, BATPACK_DUMP.name, "talent");

/** Длинная очередь Выпуска Батареи — RoF 10. */
export const BATPACK_ROF = 10;
/** Лишний куб урона: +1d10 Dmg. */
export const BATPACK_BONUS_DICE = 1;
/** Рейтинг Storm. */
export const BATPACK_STORM = 2;
/** Штраф атаки вне упора и рукопашной. */
export const BATPACK_RANGE_PENALTY = -30;

/** Лаз-оружие: тип «laser» (так записаны таблицы книги) или «las». */
export const isLasWeapon = weapon => ["laser", "las"].includes(String(weapon?.system?.weaponType ?? "").toLowerCase());

/**
 * Можно ли провести Выпуск Батареи этим оружием: Талант, стрелковое лаз-оружие с Power Setting,
 * не сломанное.
 */
export function batpackAvailable(actor, { item, isMelee = false, activeMods = [] } = {}) {
  return hasBatpackDump(actor) && !isMelee && isLasWeapon(item) && !item?.system?.destroyed
    && hasPowerSetting(item, activeMods);
}

/** Рейтинг Storm выстрела: не ниже 2 (если у оружия Storm уже выше — остаётся). */
export function batpackStormRating(existingRating = 0) {
  return Math.max(BATPACK_STORM, Number(existingRating) || 0);
}

/**
 * Штраф дальности Выпуска Батареи: −30, кроме стрельбы в упор и в рукопашной.
 * @param {{batpackOn:boolean, pointBlank:boolean, meleeShot:boolean}} s
 */
export function batpackRangePenalty({ batpackOn, pointBlank = false, meleeShot = false } = {}) {
  return batpackOn && !pointBlank && !meleeShot ? BATPACK_RANGE_PENALTY : 0;
}
