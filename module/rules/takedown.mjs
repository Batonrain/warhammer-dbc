// module/rules/takedown.mjs
// ════════════════════════════════════════════════════════════════════════════
//  TAKEDOWN / ВЫРУБАНИЕ (Талант Рукопашных, глава 3, S/Off) и
//  THAT'S NOT ALL / ЕЩЁ НЕ ВСЁ (Талант Друкхари, I/Fin, требует Takedown) —
//  чистая логика, без Foundry.
//
//  Книга, Takedown: «Персонаж может совершать приём Оглушить с любым оружием
//  и не-Избирательной атакой. При успешном Оглушении он может выбрать также
//  сбить цель с ног.»
//  Книга, That's Not All: «Цель успешного Оглушения при сбивании с ног не
//  может использовать талант Вскочить, а если его нет, то поднятие на ноги
//  стоит +1 ОД.»
//
//  Что сделано (решение владельца 23.10.2026):
//   • приём Оглушить с Takedown доступен с любым оружием (MELEE_MANEUVERS.stun
//     ограничен категориями) и без обязательной Избирательной атаки в голову
//     (окно не запирает прицел) — stunUnrestricted / stunForcedAim;
//   • при успешном Оглушении (урон дошёл до Оглушения) в карточке урона
//     появляется кнопка «Сбить с ног» (combat/takedown.mjs); носитель
//     That's Not All ставит на сбитого метку LEAP_UP_DENIED_FLAG;
//   • метку читает «Встать» (combat/movement-actions.mjs): помеченному Вскочить
//     не помогает, и любое вставание стоит на 1 ОД больше обычного. Читается
//     так: «если его нет, то +1 ОД» — +1 ОД ВСЕМ помеченным сверх обычной цены
//     (толкование владельца; без Вскочить обычная цена 1 ОД → 2 ОД, с
//     Вскочить цена 0 → его отменяют, обычная 1 ОД → те же 2 ОД);
//   • метка снимается вместе с Состоянием «Повален» (conditionRemoveFields).
//
//  Модуль НЕ импортирует ничего, что ведёт к sources.mjs (круг загрузки,
//  AGENTS.md → «Источники правил»): только ability-by-key, как speed-talents.
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";

/** Ключ Возможности и имя Таланта «Вырубание» (запись Конструктора на Таланте в паке). */
export const TAKEDOWN = { key: "meleeCore.core.takedown", name: "Takedown" };
/** Ключ Возможности и имя Таланта «Ещё Не Всё». */
export const THATS_NOT_ALL = { key: "condition.denyLeapUp.afterStunProne", name: "That's Not All" };

/** Флаг актора-цели: сбита Вырубанием носителя «Ещё Не Всё», Вскочить ей запрещён. */
export const LEAP_UP_DENIED_FLAG = "leapUpDenied";

/** Есть ли у актора Талант Вырубание (по имени ИЛИ по ключу Возможности). */
export function hasTakedown(actor) {
  return hasAbility(actor, TAKEDOWN.key, TAKEDOWN.name, "talent");
}

/** Есть ли у актора Талант Ещё Не Всё. */
export function hasThatsNotAll(actor) {
  return hasAbility(actor, THATS_NOT_ALL.key, THATS_NOT_ALL.name, "talent");
}

/** «С любым оружием» — снимает ограничение приёма Оглушить по категории оружия. */
export function stunUnrestricted(actor) {
  return hasTakedown(actor);
}

/**
 * Что окно атаки форсирует в прицеле при приёме Оглушить: без Вырубания —
 * Голову (Избирательная атака, стр. 14), с ним — ничего (null: «не-Избирательная
 * атака», игрок прицеливается сам или не прицеливается вовсе).
 */
export function stunForcedAim(actor) {
  return hasTakedown(actor) ? null : "head";
}

/** Помечен ли актор запретом Вскочить: метка стоит и он действительно лежит. */
export function leapUpDenied(actor) {
  if (!actor?.system?.conditions?.prone) return false;
  return !!actor.getFlag?.("warhammer-dbc", LEAP_UP_DENIED_FLAG);
}

/** Добавка к цене Встать: +1 ОД помеченному (сверх обычной цены любого способа). */
export function standUpExtraApCost(actor) {
  return leapUpDenied(actor) ? 1 : 0;
}
