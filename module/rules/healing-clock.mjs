// module/rules/healing-clock.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Естественное лечение по книге (раздел «Лечение»: Пассивное Лечение, Отдых,
//  Постельный Режим, Медицинский Уход, Физиология Астартес) — чистая
//  арифметика без Foundry. Её читают и ручная кнопка диалога Лечения
//  (sheets/tabs/healing.mjs), и часы Календаря (combat/healing-clock.mjs,
//  wdbc-x1nz.2.104): одна таблица на оба пути.
//
//  Режим — system.healing.regimen: "active" (занят делом — только Пассивное
//  лечение), "rest" (Отдых), "bedRest" (Постельный режим).
// ════════════════════════════════════════════════════════════════════════════

import { SECONDS_PER_DAY } from "../constants/imperial-calendar.mjs";

export const SECONDS_PER_HOUR = 3600;

export const REGIMEN_LABELS = { active: "Активен", rest: "Отдых", bedRest: "Постельный режим" };

/** Подписи режима в карточках — по тому, как книга называет лечение. */
export const REGIMEN_HEAL_LABELS = { active: "Пассивное лечение", rest: "Отдых", bedRest: "Постельный режим" };

/**
 * Физиология Астартес: «всегда считается отдыхающим, даже если занимается
 * тяжелой работой. Если действительно отдыхает, это считается постельным
 * режимом. Полноценный постельный режим никак не ускоряет восстановление».
 */
export function astartesRegimen(regimen, astartes) {
  if (!astartes) return regimen;
  return regimen === "active" ? "rest" : "bedRest";
}

/**
 * Сколько Ран за период восстанавливает режим при уровне ранения `key`
 * ("light" | "heavy" | "critical"). needT — вместо числа тест T+0 на 1 Рану.
 * ½T.b у Отдыха (лёгкое) — вниз: книга отмечает «окр.▲» только у
 * Постельного режима (тяжёлое).
 */
export function regimenHeal(regimen, key, tb) {
  const b = Math.max(0, Number(tb) || 0);
  const table = {
    active:  { light: { amount: 1 },                  heavy: { needT: true },  critical: {} },
    rest:    { light: { amount: Math.floor(b / 2) },  heavy: { amount: 1 },    critical: { needT: true } },
    bedRest: { light: { amount: b },                  heavy: { amount: Math.ceil(b / 2) }, critical: { amount: 1 } }
  };
  const row = table[regimen]?.[key] ?? {};
  return { amount: row.amount ?? 0, needT: !!row.needT };
}

/** Модификатор теста Медицинского Ухода: +0 лёгкому/тяжёлому, −10 критическому. */
export function careTestMod(key) {
  return key === "critical" ? -10 : 0;
}

/**
 * Длина периода лечения: успешный уход лёгкому/тяжёлому — 8 часов, иначе
 * сутки (критическому уход даёт лечение «как тяжёлому, но раз в сутки»).
 */
export function healPeriodSeconds(key, careOk) {
  return careOk && key !== "critical" ? 8 * SECONDS_PER_HOUR : SECONDS_PER_DAY;
}

/** Уровень, по которому лечит период: успешный уход поднимает критическое до тяжёлого. */
export function effectiveHealKey(key, careOk) {
  return careOk && key === "critical" ? "heavy" : key;
}

/** Ранен ли вообще (есть что лечить): потеряны Раны или они в минусе. */
export function isWounded(wounds) {
  const max = Number(wounds?.effectiveMax ?? wounds?.max) || 0;
  return (Number(wounds?.critical) || 0) > 0 || (Number(wounds?.value) || 0) < max;
}
