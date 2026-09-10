// module/rules/blood-flame.mjs
//
// Дар «Blood Flame / Кровавое Пламя» (Кхорн, wdbc-1rno): «выбери своё
// рукопашное оружие с уроном R» — Конструктор Механики не умеет «выбери свой
// предмет и модифицируй его на месте», поэтому логика живёт здесь и в
// apps/blood-flame.mjs, вне общего движка (тот же принцип, что у Hand of
// Death/Транса Силовой Брони — см. doombc-mutations-mechanics-authoring).
//
// Идентификация по имени предмета (itemHasName) наравне с ключом Возможности:
// та же причина, что у Hand of Death — кнопка на листе предмета должна
// показываться независимо от того, собрал ли движок правил Мутацию уже во
// что-то (система тестируется без запущенного Foundry).

import { itemIs } from "./item-marker.mjs";

const NAME = "Blood Flame";
const FLAG = "warhammer-dbc";
export const ACTIVE_FLAG = "bloodFlameActive";
export const KILLS_FLAG = "bloodFlameKills";
export const ADDED_PROPS_FLAG = "bloodFlameAddedProps";

export const BLOOD_FLAME_KILL_CAP = 4;
export const BLOOD_FLAME_DMG_PER_KILL = 2;

/** Это предмет-Дар «Кровавое Пламя»? */
export function isBloodFlameItem(item) {
  return itemIs(item, "mutation", "gift.khorne.bloodFlame", NAME);
}

/** Горит ли Кровавое Пламя на этом оружии прямо сейчас. */
export function isBloodFlameActive(item) {
  return item?.type === "weapon" && !!item.getFlag?.(FLAG, ACTIVE_FLAG);
}

/**
 * Бонус урона от Кровавого Пламени за это оружие — читается на каждый бросок
 * атаки (module/combat/attack.mjs), не хранится отдельным числом: «+2 Dmg за
 * каждого убитого им с начала этого усиления... до максимума в +8» — 4
 * убийства уже дают предел, дальнейшие ничего не добавляют.
 */
export function bloodFlameDamageBonus(item) {
  if (!isBloodFlameActive(item)) return 0;
  const kills = Number(item.getFlag(FLAG, KILLS_FLAG)) || 0;
  return Math.min(kills, BLOOD_FLAME_KILL_CAP) * BLOOD_FLAME_DMG_PER_KILL;
}
