// module/rules/blade-binding.mjs
// ════════════════════════════════════════════════════════════════════════════
//  BLADE BINDING / СЦЕПЛЕНИЕ КЛИНКОВ — чистые функции (Таланты «Рукопашные», Sahara 3-8dc5).
//
//  Книга: «Когда противник успешно парирует атаку персонажа, персонаж может пройти
//  тест S+0 vs S+0 и при победе сцепить свое оружие и оружие противника. Ни
//  персонаж, ни цель не могут использовать сцепленные оружия для атак или парирования
//  до начала следующего Хода персонажа, или пока они не разойдутся из рукопашной. Этот
//  Талант не работает против парирования щитом.»
//
//  СОСТОЯНИЕ. Единственный источник правды — флаг на ЦЕПЛЯЮЩЕМ (bladeBindingOwner:
//  {foeUuid, binderWeaponId, foeWeaponId}); он числится в реестре rules/turn-flags.mjs и
//  гаснет сам с началом следующего Хода цепляющего («до начала следующего Хода
//  персонажа»). На противнике лежат два плоских флага-указателя (bladeBindingBy — uuid
//  цепляющего, bladeBindingWeapon — id его сцепленного оружия): плоские, потому что их
//  пишет ГМ-релей (combat/gm-relay.mjs пропускает только строки/числа/булевы). Указатель
//  действует, только пока жив флаг цепляющего и называет этого противника, поэтому
//  устаревший указатель после конца срока ничего не блокирует.
//
//  «Пока не разойдутся из рукопашной» — кнопка «Разойтись» (combat/blade-binding.mjs);
//  автоматического замера разрыва контакта у системы нет.
// ════════════════════════════════════════════════════════════════════════════

import { hasMeleeTalent } from "./melee-talents.mjs";

export const BLADE_OWNER_FLAG = "bladeBindingOwner";
export const BLADE_BY_FLAG = "bladeBindingBy";
export const BLADE_WEAPON_FLAG = "bladeBindingWeapon";

const NS = "warhammer-dbc";
const getFlag = (actor, key) => actor?.getFlag?.(NS, key) ?? actor?.flags?.[NS]?.[key];

/**
 * Предлагается ли Сцепление на карточке успешного Парирования. Против щита — нет (книга),
 * без парирующего или атакующего оружия сцеплять нечего.
 *
 * @param {Actor} attacker  тот, чью атаку парировали
 * @param {boolean} p.parried        Парирование удалось
 * @param {boolean} p.parryIsShield  парировали щитом
 */
export function bladeBindingOffered(attacker, { parried, parryIsShield, hasParryWeapon, hasAttackWeapon }) {
  if (!parried || parryIsShield || !hasParryWeapon || !hasAttackWeapon) return false;
  return hasMeleeTalent(attacker, "bladeBinding");
}

/**
 * Какие оружия актора сейчас сцеплены. `resolve(uuid)` — как достать цепляющего по uuid
 * (в игре — fromUuidSync; в тестах — словарь).
 * @returns {Set<string>} id сцепленных оружий актора
 */
export function boundWeaponIds(actor, resolve = () => null) {
  const out = new Set();
  const own = getFlag(actor, BLADE_OWNER_FLAG);
  if (own?.binderWeaponId) out.add(own.binderWeaponId);
  const by = getFlag(actor, BLADE_BY_FLAG);
  const weaponId = getFlag(actor, BLADE_WEAPON_FLAG);
  if (by && weaponId) {
    const binder = resolve(by);
    const live = getFlag(binder, BLADE_OWNER_FLAG);
    // Указатель действителен, только пока цепляющий держит сцепление именно с этим оружием.
    // …и называет ИМЕННО этого противника: у несвязанных токенов одного прототипа id оружия совпадают.
    if (live?.foeWeaponId === weaponId && (!live.foeUuid || live.foeUuid === actor.uuid)) out.add(weaponId);
  }
  return out;
}

/** Сцеплено ли данное оружие актора (атаковать и парировать им нельзя). */
export function isWeaponBound(actor, weaponId, resolve) {
  return !!weaponId && boundWeaponIds(actor, resolve).has(weaponId);
}

/** Есть ли у актора какое-либо живое сцепление (для кнопки «Разойтись»). */
export function hasBinding(actor, resolve) {
  return boundWeaponIds(actor, resolve).size > 0;
}
