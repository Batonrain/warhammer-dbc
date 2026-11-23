// module/rules/minion-patron.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Покровительство Бога у Миньона (Черта Dedication / Посвящение: «Покровительство
//  Бога и его божественный Трейт демонов»). Поле system.patronGod Миньона —
//  то же, что у Персонажа, поэтому всё, что читает Покровителя актора
//  (требования Талантов, Игрушка Богов, Инфернальная Воля…), видит и Миньона.
//
//  Посвящение выдаёт один из четырёх божественных Трейтов; по нему Бог и
//  ставится сам, если поле ещё пусто (хук createItem, hooks.mjs). Поменять —
//  тем же выбором «Покровитель Хаоса» на вкладке Продвижения, что у Персонажа
//  (лист Миньона его уже рисовал, но поля в схеме Миньона не было — выбор
//  не сохранялся).
//  Чистые функции, test/rules/minion-patron.test.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

/** Божественные Трейты демонов → Бог (корбук, Посвящение). */
export const DIVINE_TRAIT_GOD = Object.freeze([
  { name: "Blood for the Blood God", god: "khorne" },
  { name: "Mockery of Life",         god: "nurgle" },
  { name: "Alluring Presence",       god: "slaanesh" },
  { name: "Sorcerous Barrier",       god: "tzeentch" }
]);

/** Бог по божественному Трейту демонов или "". */
export function patronGodFromTrait(item) {
  if (item?.type !== "trait") return "";
  return DIVINE_TRAIT_GOD.find(d => itemHasName(item, d.name))?.god ?? "";
}

/** Патч Миньона после получения Трейта: { "system.patronGod" } или null. */
export function minionPatronUpdate(actor, item) {
  if (actor?.type !== "minion" || actor.system?.patronGod) return null;
  const god = patronGodFromTrait(item);
  return god ? { "system.patronGod": god } : null;
}
