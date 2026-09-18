// module/rules/improvised-weapon.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Импровизированное оружие / Метание (стр. 27-28): персонаж может
//  использовать предметы И ПЕРСОНАЖЕЙ как рукопашное оружие (Дубина) или
//  метательный снаряд (Метание). Это ОБЩЕЕ правило книги — здесь только
//  чистая классификация по весу/размеру, без бросков и без Foundry (тот же
//  принцип, что у predicates.mjs). Единственный сегодняшний потребитель —
//  module/combat/grapple.mjs (партнёр по Захвату как снаряд/дубина), но
//  сами функции не завязаны на Борьбу — годятся для любого другого «метни
//  предмет», если он появится.
// ════════════════════════════════════════════════════════════════════════════

import { sizeOf } from "./predicates.mjs";

/** Собственный вес тела (Записи → Вес, system.bio.weight), кг. Без снаряжения. */
export function bodyWeightOf(actor) {
  return Number(actor?.system?.bio?.weight) || 0;
}

/** Полный вес актора как снаряда/дубины: тело + всё надетое/носимое (Ношение), кг. */
export function totalWeightOf(actor) {
  return bodyWeightOf(actor) + (Number(actor?.system?.encumbrance?.current) || 0);
}

/**
 * Тир Метания (стр. 28) по полному весу снаряда относительно Веса Ношения
 * БРОСАЮЩЕГО (не Подъёма/Толкания — книга сравнивает именно с Ношением):
 *   "light"  — до ¼ Ношения: BS+0, дальность S.b×3м.
 *   "medium" — ¼-½ Ношения: Athletics(S)+0, дальность 1d10+S.b+2×Успехи, направление приблизительное.
 *   "heavy"  — ½-полного Ношения: то же самое, но Athletics(S)−30.
 *   null     — тяжелее полного Ношения, метать нельзя вовсе.
 * @param {number} throwerCarry  system.encumbrance.carry бросающего, кг
 * @param {number} payloadWeight totalWeightOf() снаряда, кг
 */
export function throwTier(throwerCarry, payloadWeight) {
  const carry = Number(throwerCarry) || 0;
  if (carry <= 0) return null;
  if (payloadWeight <= carry / 4) return "light";
  if (payloadWeight <= carry / 2) return "medium";
  if (payloadWeight <= carry) return "heavy";
  return null;
}

/**
 * Годится ли payload на роль рукопашной Дубины (стр. 27): вес до ¼ Веса
 * Ношения владельца И Размер payload'а не больше Размера самого владельца.
 * Отдельный, более узкий гейт, чем throwTier выше — книга не даёт более
 * тяжёлых тиров для рукопашного использования, только для броска.
 */
export function canWieldAsCudgel(wielder, payload) {
  const carry = Number(wielder?.system?.encumbrance?.carry) || 0;
  if (carry <= 0) return false;
  return totalWeightOf(payload) <= carry / 4 && sizeOf(payload) <= sizeOf(wielder);
}

/**
 * Вес ОБЫЧНОГО ПРЕДМЕТА (не персонажа-партнёра по Захвату) как снаряда/
 * дубины — вес самого предмета (по умолчанию 1 штука; количество на
 * разгрузке не считается, берётся один экземпляр).
 */
export function itemWeightOf(item) {
  return Number(item?.system?.weight) || 0;
}

/**
 * Годится ли ОБЫЧНЫЙ ПРЕДМЕТ на роль рукопашной Дубины (стр. 27) — вес до
 * ¼ Веса Ношения владельца. Размер здесь НЕ проверяется отдельно: в системе
 * у предметов нет поля «Размер» (оно есть только у акторов, sizeOf выше) —
 * почти любой предмет из инвентаря компактнее самого владельца, поэтому
 * критерий «Размером не более себя» не даёт содержательного отказа для
 * заурядного реквизита; для КРУПНЫХ предметов (Размером с актора и больше)
 * книга уже отдельно накрывает случай «Массивные Предметы» (стр. 27,
 * combat/force-move.mjs), а не эту ветку.
 */
export function canWieldItemAsCudgel(wielder, item) {
  const carry = Number(wielder?.system?.encumbrance?.carry) || 0;
  if (carry <= 0) return false;
  return itemWeightOf(item) <= carry / 4;
}

/**
 * Нужна ли надёжная опора при Метании (стр. 28) — сравнение веса снаряда с
 * СОБСТВЕННЫМ весом ТЕЛА бросающего (bodyWeightOf, БЕЗ снаряжения) — это
 * отдельная ось от throwTier выше (тот сравнивает с Ношением):
 *   "none"       — обычный бросок, опора роли не играет (<0.5× тела).
 *   "check"      — опора нужна (0.5-1.5× тела): без неё — совмещённый тест
 *                  Athletics(S)−30 И Acrobatics(A)−30, иначе сбитие с ног
 *                  и вдвое меньше дальность/урон броска.
 *   "harsh"      — 1.5-3× тела: без опоры метать нельзя вовсе; даже с опорой
 *                  тест на неё — как будто её нет (тот же совмещённый тест).
 *   "impossible" — 3× тела и больше: только магия.
 * Вес тела бросающего не заполнен (0) — не блокируем бросок вовсе (нет
 * данных для сравнения, а не «опора не нужна» в буквальном смысле книги).
 */
export function footingRequirement(throwerBodyWeight, payloadWeight) {
  const body = Number(throwerBodyWeight) || 0;
  if (body <= 0) return "none";
  const ratio = payloadWeight / body;
  if (ratio < 0.5) return "none";
  if (ratio < 1.5) return "check";
  if (ratio < 3)   return "harsh";
  return "impossible";
}
