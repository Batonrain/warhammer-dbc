// module/rules/fire-point.mjs
// ════════════════════════════════════════════════════════════════════════
//  Fire Point / Огневая Точка — Черта Архетипа Хавок (Архетипы Космодесанта).
//  Книга: «Когда Хавок тратит Очко Бесчестия на переброс стрелковой атаки
//  или он использовал действие Закрепление, он может перебрасывать все
//  стрелковые атаки, пока не сдвинется с места (кроме Отскоком), заляжет,
//  или будет сбит с ног. Он может перебрасывать стрельбу из тяжелого оружия
//  даже с покровительством Нургла.»
//
//  Чистая часть (без Foundry). Состояние «точка занята» — флаг на акторе
//  {active, recoil}; включает его combat/fire-point.mjs (из переброса за
//  Очко в меню карточки атаки — hooks.mjs, и из Закрепления —
//  combat/brace-weapon.mjs), гасят хуки движения токена и Повален.
//
//  Почему флаг, а не геометрия, как у Закрепления: Закрепление слетает и от
//  поворота оружия, Огневая Точка — только от сдвига. И Отскок (стр. 12)
//  токен сам не двигает — игрок передвигает фишку после карточки Отскока, и
//  отличить этот сдвиг от обычного по координатам нельзя. Поэтому Отскок
//  ставит recoil:true, и ближайший сдвиг токена точку не гасит.
// ════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";

export const FIRE_POINT = "trait.firePoint";
export const FIRE_POINT_FLAG = "firePoint";
const NS = "warhammer-dbc";

/** Есть ли у актора Черта (возможность из записи Конструктора Черты). */
export function hasFirePoint(actor) {
  return !!actor && hasRuleFlag(actor, FIRE_POINT);
}

/** Сохранённое состояние точки или null. */
export function firePointState(actor) {
  return actor?.getFlag?.(NS, FIRE_POINT_FLAG) ?? actor?.flags?.[NS]?.[FIRE_POINT_FLAG] ?? null;
}

/**
 * Точка занята прямо сейчас: Черта есть, состояние включено, и персонаж не
 * Повален («заляжет или будет сбит с ног» — обе ветки книги кончаются
 * Состоянием «Повален»). Повален гасит точку и само по себе, даже если хук
 * снятия не успел отработать: вставший на том же месте точку не возвращает —
 * это делает хук (combat/fire-point.mjs), здесь — только чтение.
 */
export function firePointActive(actor) {
  return hasFirePoint(actor) && !!firePointState(actor)?.active && !actor?.system?.conditions?.prone;
}

/**
 * Бесплатный переброс этой атаки: стрелковая, ещё не переброшенная (переброс
 * переброса книга не даёт ни за Очко, ни здесь), точка занята.
 * @param {object} actor
 * @param {{isMelee:boolean, rerolled:boolean}} attack
 */
export function firePointFreeReroll(actor, { isMelee = false, rerolled = false } = {}) {
  return !isMelee && !rerolled && firePointActive(actor);
}

/** Переброс за Очко Бесчестия стрелковой атаки занимает точку (если ещё не занята). */
export function firePointActivatesOnPaidReroll(actor, { isMelee = false } = {}) {
  return !isMelee && hasFirePoint(actor) && !firePointActive(actor);
}

/**
 * Что делать с точкой после сдвига токена: "keep" — не сдвигался или точки
 * нет; "reanchor" — это был Отскок, точка остаётся (метка Отскока снимается);
 * "break" — сдвинулся сам, точка потеряна.
 */
export function firePointAfterMove(state, moved) {
  if (!state?.active || !moved) return "keep";
  return state.recoil ? "reanchor" : "break";
}

/** Лёг/сбит с ног — точка потеряна (вставание её не возвращает). */
export function firePointBreaksOnProne(state, proneNow) {
  return !!state?.active && !!proneNow;
}
