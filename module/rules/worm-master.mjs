// module/rules/worm-master.mjs
// Worm Master / Повелитель Червей (Черта Короля Червей; Разобрать lg5r8). Чистая часть.
// Книга: «За полное действие может тестом W−10 при Успехе призвать рядом Извивающийся Рой,
// действующий в его Инициативу под прямым контролем (за каждый Успех после первого Рой получает
// +10 стартовых Ран). Может контролировать до Cor.b Роёв; каждый Ход в бою, пока хотя бы один Рой
// активен, должен либо тратить полудействие, либо получать 1d5 непоглощаемого R урона. Может
// рассеять любое число Роёв за свободное действие.»

import { itemHasName } from "./predicates.mjs";

export const WORM_SWARM_NAME = "Writhing Swarm / Извивающийся Рой";
export const WORM_SWARM_FLAG = "wormMasterUuid";
export const WORM_MASTER_MOD = -10;
/** Потолок бонусных Ран, принимаемых ГМом по сокету (9 Успехов сверх первого). */
export const WORM_BONUS_WOUNDS_MAX = 90;

export function hasWormMaster(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "trait"
    && (itemHasName(i, "Worm Master") || itemHasName(i, "Повелитель Червей")));
}

export function wormSwarmCap(actor) {
  return Math.max(0, Number(actor?.system?.corruptionBonus) || 0);
}

/** +10 Ран за каждый Успех после первого. */
export function wormSwarmBonusWounds(deg) {
  return Math.max(0, (Number(deg) || 0) - 1) * 10;
}

/** Бонус Ран, присланный по сокету: целое, кратное 10, в пределах потолка. */
export function sanitizeWormBonus(n) {
  const v = Math.floor(Number(n) || 0);
  if (v <= 0) return 0;
  return Math.min(WORM_BONUS_WOUNDS_MAX, v - (v % 10));
}
