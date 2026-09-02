// module/rules/tentacle-hand-form.mjs
//
// Мутация Tentacle/Щупальце, субмутация 9 «Изменчивое» (только Тзинч, wdbc-2ynk):
// «Потратив Очко Бесчестия, персонаж может за полудействие трансформировать
// щупальце обратно в руку, пока он не решит превратить его обратно в щупальце
// за свободное действие или потеряет сознание.» Цена списывается общим
// module/combat/capability-cost.mjs (wdbc-1dc8, уже существовал на момент
// разбора этого тикета) — здесь только состояние («в какой сейчас форме») и
// то, что оно гасит: пока щупальце — рука, бонусу +20 (mutation.tentacle,
// module/sheets/attack-dialog.mjs) нечем помогать приёму Захват.
//
// Состояние — флаг НА ПРЕДМЕТЕ Мутации (тот же приём, что armor.mjs::breached —
// чистый флаг состояния, доступный и без Foundry), не на акторе: переключатель
// принадлежит конкретному предмету-Щупальцу, у актора их теоретически может
// быть больше одного.
//
// НЕ автоматизировано (сознательно, тот же класс, что «неосновная рука держит
// двуручное стрелковое» у самой базовой мутации, wdbc-vkwe): автовозврат «или
// потерял сознание» — нет единой точки «персонаж только что потерял сознание»,
// переключение вручную.
//
// Модуль чистый — Foundry не нужен, проверяется без стенда.

import { itemHasName } from "./predicates.mjs";

const SYSTEM = "warhammer-dbc";
const NAME = "Tentacle";
export const TENTACLE_HAND_FORM_FLAG = "tentacleHandForm";

const flagsOf = (item) => item?.flags?.[SYSTEM] || {};

/** Это предмет-Мутация «Щупальце» (любая субмутация)? */
export function isTentacleItem(item) {
  return item?.type === "mutation" && itemHasName(item, NAME);
}

/** Именно строка «9 — Изменчивое»: только у неё есть форма руки. */
export function isTentacleShiftItem(item) {
  return isTentacleItem(item) && String(item?.system?.submutation?.label ?? "") === "9";
}

/** Сейчас в форме руки (имеет смысл только у isTentacleShiftItem). */
export function tentacleIsHandForm(item) {
  return !!flagsOf(item)[TENTACLE_HAND_FORM_FLAG];
}

/**
 * Гасится ли бонус +20 (mutation.tentacle) прямо сейчас: щупальце ЕСТЬ, но
 * временно в форме руки. У актора обычно один такой предмет — если их
 * несколько, бонус гасится, только когда КАЖДЫЙ сейчас в форме руки (иначе
 * хотя бы одно настоящее щупальце всё ещё способно на приём).
 */
export function tentacleBonusSuppressed(actor) {
  const items = [...(actor?.items ?? [])].filter(isTentacleItem);
  if (!items.length) return false;
  return items.every(tentacleIsHandForm);
}
