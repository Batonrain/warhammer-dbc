// module/rules/iron-garden.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Железный Сад / Iron Garden (Талант Механикума, Sahara 3-cc96 п.10; DoomBC —
//  Основная книга): «Если у персонажа несколько одноимённых мехадендритов, он
//  может атаковать ими в рукопашной как одним оружием со свойством Multi-strike
//  (X), где X — количество дендритов, тратя только 1 Реакцию (или считая их
//  атакой с 1 руки). При разном качестве для бросков используется наименьшее.»
//
//  Реализовано: свойство Multi-strike (X) к рукопашной атаке мехадендритом, у
//  которого на актёре есть X ≥ 2 одноимённых (учитывается количество предмета).
//  Не реализовано: «1 Реакция / 1 рука» и «наименьшее Качество» — окно атаки
//  берёт одно выбранное оружие, объединять несколько в один бросок оно не умеет.
//
//  Чистый модуль без Foundry; зовёт combat/attack.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

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
 * одноимённых мехадендритов на актёре (с учётом количества). 0 — Таланта нет,
 * оружие не мехадендрит или он один (Multi-strike (1) — не свойство).
 */
export function ironGardenRating(actor, weapon) {
  if (!hasIronGarden(actor) || !isMechadendriteWeapon(weapon)) return 0;
  const name = norm(weapon.name);
  const total = [...(actor?.items ?? [])]
    .filter(i => isMechadendriteWeapon(i) && norm(i.name) === name)
    .reduce((s, i) => s + countOf(i), 0);
  return total >= 2 ? total : 0;
}
