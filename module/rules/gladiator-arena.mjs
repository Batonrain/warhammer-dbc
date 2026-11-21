// module/rules/gladiator-arena.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Гладиатор — Таланты и Черта поверх Момента, которым нужен источник правил
//  или защита. Чистая часть без Foundry; в отличие от rules/gladiator-
//  talents.mjs (Димахер, тянет dual-wield-talents → flags) этот файл
//  подключён к rules/sources.mjs, поэтому импортирует только predicates и
//  momentum.
//
//   • Bestiarius / Бестиарий — удвоенный бонус Момента на атаки по
//     противникам и Избегания от противников «только с естественным оружием,
//     когтями и укусами»: ещё +5 за очко (источник правил gladiatorRules для
//     атаки; rules/duelist-evasion.mjs для Уклонения/Парирования).
//   • Secutorius / Секуторий — со щитом и рукопашным оружием Rng ≤ 3: Момент
//     ×2 на Парирование рукопашных, ×3 на Парирование метательного щитом;
//     3 Успеха Парирования оружия Rng 4+ или метательного — прижать его щитом.
//   • Bloody Performance / Кровавое Представление — тест F+0: +10 за каждое
//     очко Момента, набранное за Ход, +5 за каждую часть тела без брони
//     (combat/gladiator.mjs).
//   • Retiarius / Ретиарий и Militarius / Милитарий — кнопки (combat/gladiator.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { momentumPoints, MOMENTUM_PER_POINT } from "./momentum.mjs";

const NS = "warhammer-dbc";
const hasNamed = (actor, type, name) => [...(actor?.items ?? [])].some(i => i?.type === type && itemHasName(i, name));
export const hasBestiarius = a => hasNamed(a, "talent", "Bestiarius");
export const hasSecutorius = a => hasNamed(a, "talent", "Secutorius");
export const hasRetiarius  = a => hasNamed(a, "talent", "Retiarius");
export const hasMilitarius = a => hasNamed(a, "talent", "Militarius");
export const hasBloodyPerformance = a => hasNamed(a, "trait", "Bloody Performance");

const isIntegral = w => !!(w?.flags?.[NS]?.integralAttack ?? w?.getFlag?.(NS, "integralAttack"));

/** Противник «только с естественным оружием»: ни одного надетого оружия, кроме интегральных атак (когти, укусы, кулаки). */
export function naturalWeaponsOnly(actor) {
  if (!actor) return false;
  return ![...(actor.items ?? [])].some(i => i?.type === "weapon" && i.system?.equipped && !isIntegral(i));
}

/** Лишняя прибавка Бестиария (второй бонус Момента) против этого противника. */
export function bestiariusExtra(actor, foe) {
  if (!hasBestiarius(actor) || !naturalWeaponsOnly(foe)) return 0;
  return momentumPoints(actor) * MOMENTUM_PER_POINT;
}

const isShield = w => w?.type === "weapon" && w.system?.shieldAP != null;

/** Секуторий вооружён: щит и рукопашное оружие с Rng не больше 3 в руках. */
export function secutoriusArmed(actor) {
  if (!hasSecutorius(actor)) return false;
  const eq = [...(actor?.items ?? [])].filter(i => i?.type === "weapon" && i.system?.equipped);
  return eq.some(isShield) && eq.some(w => !isShield(w) && w.system?.weaponClass === "melee" && (Number(w.system?.range) || 0) <= 3);
}

/**
 * Лишняя прибавка Секутория к Парированию: рукопашная атака — +1 бонус
 * Момента (итого ×2), метательное оружие, парированное щитом, — +2 (×3).
 */
export function secutoriusParryExtra(actor, { attackerWeaponClass = "", parryWeapon = null, isMelee = true } = {}) {
  if (!secutoriusArmed(actor)) return 0;
  const per = momentumPoints(actor) * MOMENTUM_PER_POINT;
  if (attackerWeaponClass === "thrown" && isShield(parryWeapon)) return 2 * per;
  if (isMelee && attackerWeaponClass !== "thrown") return per;
  return 0;
}

/** Секуторий: можно прижать оружие щитом — 3 Успеха, оружие Rng 4+ или метательное. */
export function secutoriusPinOffered(actor, { passed = false, deg = 0, attackerWeapon = null } = {}) {
  if (!passed || deg < 3 || !secutoriusArmed(actor) || !attackerWeapon) return false;
  return attackerWeapon.system?.weaponClass === "thrown" || (Number(attackerWeapon.system?.range) || 0) >= 4;
}

const LOCS = ["head", "body", "leftArm", "rightArm", "leftLeg", "rightLeg"];

/** Сколько частей тела не закрыто надетой бронёй (0–6). */
export function unarmouredParts(actor) {
  const worn = [...(actor?.items ?? [])].filter(i => i?.type === "armor" && i.system?.equipped);
  return LOCS.filter(l => !worn.some(a => (Number(a.system?.[l]) || 0) > 0)).length;
}

/** Кровавое Представление: Порог F+0 +10 за набранное очко, +5 за открытую часть тела. */
export function bloodyPerformanceBonus(gained, bare) {
  return Math.max(0, Number(gained) || 0) * 10 + Math.max(0, Number(bare) || 0) * 5;
}

/** Ретиарий: длина цепи — A.b×2 м (наибольшая дальность метания). */
export function retiariusChainLength(actor) {
  return Math.floor((Number(actor?.system?.characteristics?.ag?.total) || 0) / 10) * 2;
}

/** Источник правил «gladiator»: Бестиарий — второй бонус Момента к атакам WS/S/A по «зверю». */
export function gladiatorRules(actor, ctx = {}) {
  const extra = bestiariusExtra(actor, ctx?.targetActor);
  if (!extra || !["ws", "s", "ag"].includes(ctx?.char)) return [];
  return [{
    id: "gladiator.bestiarius", label: "Бестиарий", when: {},
    effects: [{ kind: "rollBonus", target: "attack", value: extra, auto: true, label: "Бестиарий: Момент ×2 против естественного оружия" }]
  }];
}
