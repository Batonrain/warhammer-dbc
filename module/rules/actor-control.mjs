// module/rules/actor-control.mjs
// ════════════════════════════════════════════════════════════════════════
//  Контроль чужого токена — общий примитив (wdbc-ux8a, по прямому запросу
//  пользователя 15.09.2026, на основе трёх находок книги: "Volunteer Actor"/
//  "Доброволец Актёр" — марионетка через мононить (первый подключённый
//  случай), "Maggot Parasite"/"Опарыш-Паразит" — полное переселение
//  сознания, "Exarch of the Eagle Pilots" — управление постами СВОЕГО
//  экипажа [этот случай сюда НЕ входит — не адверсариальный захват чужого].
//
//  Флаг живёт НА КОНТРОЛИРУЕМОМ акторе (flags.warhammer-dbc.controlledBy) —
//  тот же принцип единственного источника истины, что у tempGrant/Condition:
//  снять контроль значит снять один этот флаг.
//
//  Длительность — той же формой поля, что уже даёт rules/temp-grant.mjs
//  (unit: "worldTime"|"round", expiresAt/expiresAtRound/combatId) —
//  isControlExpired ПЕРЕИСПОЛЬЗУЕТ isTempGrantExpired напрямую для этих двух
//  unit'ов, не копирует логику. "battle" — третий unit, но не через
//  сравнение (round/worldTime сравнивают текущее значение с дедлайном) — до
//  конца боя снимается Hooks.on("deleteCombat") (releaseControlOnCombatEnd),
//  тот же приём, что уже даёт combat/wrapped-in-chaos.mjs::
//  clearTaintedBladeBuffs. "permanent" — не имеет unit вовсе, снимается
//  только явным releaseControl() (обрыв нити, смерть цели и т.п. — решает
//  вызывающая находка).
//
//  Чистый модуль: ни одного обращения к Foundry на верхнем уровне (актор и
//  combat приходят аргументами, как у temp-grant.mjs/cooldown.mjs).
// ════════════════════════════════════════════════════════════════════════

import { isTempGrantExpired } from "./temp-grant.mjs";

const SCOPE = "warhammer-dbc";
const FLAG = "controlledBy";

/** Сырой флаг контроля этого актора (controllerUuid/sourceItemUuid/permanent/unit/...) или null. */
export function controlOf(actor) {
  return actor?.getFlag?.(SCOPE, FLAG) ?? actor?.flags?.[SCOPE]?.[FLAG] ?? null;
}

/**
 * Истёк ли ЭТОТ флаг контроля прямо сейчас.
 * @param {?object} control  controlOf(actor)
 * @param {{worldTime?: number, combat?: ?{id: string, round: number}}} ctx
 */
export function isControlExpired(control, ctx = {}) {
  if (!control) return true;
  if (control.permanent) return false;
  // "battle" снимается ЦЕЛИКОМ хуком deleteCombat (releaseControlOnCombatEnd),
  // не сравнением здесь — если флаг ещё жив, для него бой не кончался.
  if (control.unit === "battle") return false;
  return isTempGrantExpired(control, ctx);
}

/** Контролируется ли actor кем-то ПРЯМО СЕЙЧАС (истёкший контроль не считается). */
export function isControlled(actor, ctx = {}) {
  return !isControlExpired(controlOf(actor), ctx);
}

/** UUID контролирующего актора — null, если контроль истёк/отсутствует. */
export function controllerUuidOf(actor, ctx = {}) {
  const control = controlOf(actor);
  return isControlExpired(control, ctx) ? null : (control?.controllerUuid ?? null);
}

/**
 * Собрать флаг контроля. unit игнорируется при permanent:true.
 * @param {string} controllerUuid
 * @param {object} opts
 * @param {string} [opts.sourceItemUuid]  предмет/находка, давшая контроль (для releaseControlBySource)
 * @param {boolean} [opts.permanent]
 * @param {"worldTime"|"round"|"battle"|""} [opts.unit]
 * @param {number} [opts.durationValue]  секунды (worldTime) или Раунды (round)
 * @param {number} [opts.worldTime]      game.time.worldTime на момент установления
 * @param {?{id: string, round: number}} [opts.combat]
 */
export function buildControlFlag(controllerUuid, {
  sourceItemUuid = "", permanent = false, unit = "", durationValue = 0,
  worldTime = 0, combat = null
} = {}) {
  const flag = { controllerUuid, sourceItemUuid, permanent: !!permanent, unit: permanent ? "" : unit };
  if (!permanent) {
    if (unit === "worldTime") {
      flag.expiresAt = Number(worldTime) + Number(durationValue);
    } else if (unit === "round") {
      flag.combatId = combat?.id ?? null;
      flag.expiresAtRound = (Number(combat?.round) || 0) + Number(durationValue);
    } else if (unit === "battle") {
      flag.combatId = combat?.id ?? null;
    }
  }
  return flag;
}

/** Установить контроль над targetActor. */
export async function establishControl(targetActor, controllerUuid, opts = {}) {
  await targetActor.setFlag(SCOPE, FLAG, buildControlFlag(controllerUuid, opts));
  // Контроль разума над бойцом отряда: он сам и видевшие сослуживцы проходят
  // W ± Слаженность (глава «Командование»). Импорт ленивый — command-state
  // тянет источники правил.
  if (typeof game !== "undefined") {
    try { await (await import("../combat/command-state.mjs")).offerMindControlTests(targetActor); }
    catch (e) { console.warn("Warhammer DBC | контроль разума в отряде:", e); }
  }
}

/** Снять контроль (независимо от причины — вызывающая находка решает, что это значит для цели). */
export async function releaseControl(targetActor) {
  await targetActor.unsetFlag(SCOPE, FLAG);
}

/** Снять контроль со всех комбатантов боя, у кого unit "battle" привязан к ЭТОМУ бою. Hooks.on("deleteCombat"). */
export async function releaseControlOnCombatEnd(combat) {
  for (const c of combat?.combatants ?? []) {
    const control = controlOf(c.actor);
    if (control?.unit === "battle" && control.combatId === combat.id) {
      await releaseControl(c.actor);
    }
  }
}

/** Снять ИСТЁКШИЙ (round/worldTime) контроль на этом акторе. Hooks.on("updateWorldTime"/"updateCombat"). */
export async function sweepExpiredControl(actor, ctx) {
  const control = controlOf(actor);
  if (!control || control.permanent || control.unit === "battle") return;
  if (isControlExpired(control, ctx)) await releaseControl(actor);
}
