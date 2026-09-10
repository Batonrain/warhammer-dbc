// module/rules/hand-of-khorne.mjs
//
// Дар «Hand of Khorne / Длань Кхорна» (wdbc-1rno, Кхорн): «Основная рука
// персонажа вздувается... +8 AP в этой руке, удваивает S.b в расчёте всех
// атак ею, +2 Размера при Парировании атак с этой руки, стрелковые атаки ею
// автоматически проваливаются.»
//
// «Основная рука» персонажа как отдельное понятие (правша/левша) в системе
// не существует — по решению пользователя источник истины: сам Дар хранит,
// ПРАВУЮ или ЛЕВУЮ руку выбрали при взятии (диалог, module/apps/
// hand-of-khorne.mjs — тот же приём выбора, что у Hand of Death, только
// выбирают руку, не оружие). Дальше бонусы цепляются к ТЕКУЩЕМУ оружию,
// которое занимает эту руку ПРЯМО СЕЙЧАС (module/rules/hands.mjs::
// getHeldHand) — или к обеим рукам разом, если оно двуручное
// (weaponHandsRequired() === 2): какое оружие взяли в бронзовую руку, то и
// получает бонусы. Смена оружия в этой руке переносит бонус вместе с ним —
// рука остаётся бронзовой, а не привязана к конкретному стволу.

import { itemIs } from "./item-marker.mjs";
import { getHeldHand, weaponHandsRequired } from "./hands.mjs";

const NAME = "Hand of Khorne";
const FLAG = "warhammer-dbc";
/** "left" | "right" — на самом предмете-Даре, не на акторе. */
export const HAND_FLAG = "handOfKhorneHand";

/** Это предмет-Дар «Длань Кхорна»? */
export function isHandOfKhorneItem(item) {
  return itemIs(item, "mutation", "gift.khorne.handOfKhorne", NAME);
}

/** Дар «Длань Кхорна» этого актора, если взят. */
export function handOfKhorneItemOf(actor) {
  return [...(actor?.items || [])].find(isHandOfKhorneItem) || null;
}

/** Выбранная рука ("left"/"right"), null — Дара нет или рука ещё не выбрана. */
export function handOfKhorneHand(actor) {
  return handOfKhorneItemOf(actor)?.getFlag?.(FLAG, HAND_FLAG) || null;
}

/**
 * Бьёт ли эта АТАКА бронзовой рукой её носителя — занимает ли предмет прямо
 * сейчас руку, помеченную Даром (module/rules/hands.mjs::getHeldHand), или
 * весь предмет двуручный (тогда бронзовая рука занята им в любом случае).
 */
export function isHandOfKhorneWeapon(weapon) {
  if (!weapon || weapon.type !== "weapon") return false;
  const owner = weapon.actor ?? weapon.parent;
  const hand = handOfKhorneHand(owner);
  if (!hand) return false;
  if (weaponHandsRequired(weapon, owner) >= 2) return true;
  return getHeldHand(weapon) === hand;
}

/** ×2 S.b в расчёте атак этой рукой (иначе ×1 — не эффект, а множитель "нет надбавки"). */
export function handOfKhorneStrengthMultiplier(weapon) {
  return isHandOfKhorneWeapon(weapon) ? 2 : 1;
}

/** +2 эффективного Размера атакующего при Парировании его атак этой рукой (module/combat/defense.mjs). */
export function handOfKhorneAttackSizeBonus(weapon) {
  return isHandOfKhorneWeapon(weapon) ? 2 : 0;
}

/** Стрелковые атаки этой рукой автоматически проваливаются — гейт для module/combat/attack.mjs. */
export function handOfKhorneBlocksRangedAttack(weapon) {
  return isHandOfKhorneWeapon(weapon) && weapon?.system?.weaponClass !== "melee" && weapon?.system?.weaponClass !== "thrown";
}
