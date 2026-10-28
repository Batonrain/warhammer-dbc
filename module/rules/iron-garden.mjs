// module/rules/iron-garden.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Железный Сад / Iron Garden (Талант Механикума, Sahara 3-cc96 п.10; DoomBC —
//  Основная книга): «Если у персонажа несколько одноимённых мехадендритов, он
//  может атаковать ими в рукопашной как одним оружием со свойством Multi-strike
//  (X), где X — количество дендритов, тратя только 1 Реакцию (или считая их
//  атакой с 1 руки). При разном качестве для бросков используется наименьшее.»
//
//  Реализовано (решение владельца 26.10.2026):
//   • свойство Multi-strike (X) к рукопашной атаке мехадендритом, у которого на
//     актёре надето X ≥ 2 одноимённых (учитывается количество предмета);
//   • «1 Реакция» — группа бьёт ОДНИМ броском по одному оружию (окно атаки берёт
//     один выбранный дендрит, остальные идут как Multi-strike), поэтому атака
//     за Реакцию (Свободная Атака, Контратака…) списывает ровно одну Реакцию, а
//     не по Реакции на дендрит;
//   • «атака с 1 руки» — надетые одноимённые дендриты группы занимают в бюджете
//     рук одну руку (rules/hands.mjs::handsOccupied → ironGardenHandsDiscount);
//   • «наименьшее Качество» — для броска атаки и урона берётся наименьшее
//     Качество среди дендритов группы (ironGardenQuality → qualityEffects).
//
//  Чистый модуль без Foundry; зовёт combat/attack.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { ITEM_QUALITY_LIST, normQuality } from "../constants/quality.mjs";

export const hasIronGarden = actor =>
  [...(actor?.items ?? [])].some(i => i?.type === "talent"
    && (itemHasName(i, "Iron Garden") || itemHasName(i, "Железный Сад")));

/** Мехадендрит: ярлык профиля «Мехадендрит» (так подписан весь раздел оружия-дендритов) либо имя. */
export function isMechadendriteWeapon(item) {
  if (item?.type !== "weapon") return false;
  if (String(item.system?.profileLabel ?? "").trim() === "Мехадендрит") return true;
  return /mechadendrite|мехадендрит/i.test(String(item.name ?? ""));
}

const norm = name => String(name ?? "").trim().toLowerCase();
const countOf = item => Math.max(1, Math.trunc(Number(item.system?.quantity) || 1));

/**
 * Рейтинг Multi-strike от Железного Сада для атаки этим мехадендритом: число
 * надетых одноимённых мехадендритов на актёре (с учётом количества). 0 — Таланта нет,
 * оружие не мехадендрит или он один (Multi-strike (1) — не свойство).
 */
export function ironGardenRating(actor, weapon) {
  if (!hasIronGarden(actor) || !isMechadendriteWeapon(weapon) || !weapon.system?.equipped) return 0;
  const total = gardenGroup(actor, weapon).reduce((s, i) => s + countOf(i), 0);
  return total >= 2 ? total : 0;
}

/**
 * Надетые одноимённые мехадендриты актёра — группа, которую Железный Сад сводит в одну атаку.
 * Снятые и сданные на склад не бьют — тот же отбор, что у скидки по рукам (ironGardenHandsDiscount).
 */
function gardenGroup(actor, weapon) {
  const name = norm(weapon?.name);
  return [...(actor?.items ?? [])].filter(i => isMechadendriteWeapon(i) && i.system?.equipped && norm(i.name) === name);
}

/**
 * Наименьшее Качество группы, если атака этим дендритом идёт как группа Железного
 * Сада; иначе null (обычное Качество самого предмета). «Если эти дендриты имеют
 * разное качество, для бросков атаки и урона используется наименьшее.»
 * @returns {?string} ключ Качества (poor/common/good/best)
 */
export function ironGardenQuality(actor, weapon) {
  if (!ironGardenRating(actor, weapon)) return null;
  const ranks = gardenGroup(actor, weapon).map(i => ITEM_QUALITY_LIST.indexOf(normQuality(i.system?.quality)));
  const lowest = Math.min(...ranks.map(r => (r < 0 ? ITEM_QUALITY_LIST.indexOf("common") : r)));
  return ITEM_QUALITY_LIST[lowest] ?? null;
}

/**
 * Встаёт ли дендрит в уже надетую группу: Железный Сад есть и одноимённый
 * дендрит уже надет — новый руки не добавляет (см. ironGardenHandsDiscount).
 */
export function ironGardenSharesHand(actor, item) {
  if (!hasIronGarden(actor) || !isMechadendriteWeapon(item)) return false;
  return gardenGroup(actor, item).some(i => i.id !== item.id && i.system?.equipped);
}

/**
 * Сколько рук группа дендритов «не занимает» сверх одной: надетые одноимённые
 * дендриты с Железным Садом считаются атакой с 1 руки (сумма их рук заменяется
 * наибольшим из одного). Скидка = сумма − наибольшее по каждой группе из ≥ 2
 * ЭКИПИРОВАННЫХ предметов (`handsOf` — сколько рук занимает предмет).
 */
export function ironGardenHandsDiscount(actor, handsOf, { exclude = null } = {}) {
  if (!hasIronGarden(actor)) return 0;
  const groups = new Map();   // имя → { total: руки всех копий, widest: руки одной копии }
  for (const i of actor.items ?? []) {
    if (!isMechadendriteWeapon(i) || !i.system?.equipped || (exclude && i.id === exclude)) continue;
    const one = handsOf(i);
    const key = norm(i.name);
    // По предметам, не по quantity: так же бюджет рук считает handHeldItems.
    const g = groups.get(key) ?? { total: 0, widest: 0, copies: 0 };
    g.total += one;
    g.widest = Math.max(g.widest, one);
    g.copies += 1;
    groups.set(key, g);
  }
  let discount = 0;
  for (const g of groups.values()) if (g.copies >= 2) discount += g.total - g.widest;
  return discount;
}
