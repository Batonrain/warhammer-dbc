// module/rules/radiation-combat.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Rad (X), счёт «за один бой» (core.json, Особые Свойства Оружия,
//  wdbc-x1nz.10): «Живые существа, получившие за один бой 10 и более урона в
//  T от радиации, должны после боя пройти тест на T+0, или получить лучевую
//  болезнь».
//
//  Счётчик — флаг на акторе с id боя, а не просто число: флаг переживает бой,
//  если актор не был в трекере (по нему конец боя не пройдёт), и тогда
//  следующий бой обязан начать счёт с нуля, а не дописать к старому.
//  Сюда идёт урон от свойства Rad; окружающая радиация (Состояние «Радиация»,
//  combat/condition-ticks.mjs) считает свою дозу отдельно — у неё в книге
//  свой порог «10/20/30… с учётом лечения», и сложить их значило бы дважды
//  бросать тест за один и тот же урон.
//  Чистые функции, без Foundry: бросок и запись — combat/radiation.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { isDaemonActor } from "./predicates.mjs";

/**
 * Не бросает ли актор тест T+0 после боя. Решение владельца 02.10.2026:
 * Демоны и Демоны-Принцы не бросают — «радиация — не болезнь». Сам урон в T
 * гасит не эта функция, а иммунитет: носитель Черты Daemonic из пака
 * (запись Конструктора condKey:"radiation", задача Sahara «daemonic»,
 * 02.10.2026) урона не получает вовсе; актор-Демон без такой записи (копии
 * Черты в бестиарии) урон получает, и здесь снимается только тест. «Машину» НЕ исключаем
 * (решения владельца по ней нет — вопрос в отчёте задачи wdbc-x1nz.10).
 * Признак «Демон» — тот же, что у предиката isDaemon (тип daemon/demonPrince
 * или Черта Daemonic).
 */
export function radiationTestExempt(actor) {
  return isDaemonActor(actor);
}

/**
 * Уникальные uuid всех, кто сидит на местах Техники (экипаж и пассажиры —
 * book: радиация по Технике бьёт тех, кто внутри). Пустые места пропускаются,
 * один человек на двух местах считается один раз.
 */
export function vehicleOccupantUuids(vehicle) {
  const stations = Array.isArray(vehicle?.system?.stations) ? vehicle.system.stations : [];
  return [...new Set(stations.map(s => String(s?.uuid ?? "").trim()).filter(Boolean))];
}

/** flags.warhammer-dbc.combatRadiation = { combatId, amount }. */
export const COMBAT_RAD_FLAG = "combatRadiation";

/** «10 и более урона в T от радиации» за бой — тест T+0 после боя. */
export const COMBAT_RAD_TEST_THRESHOLD = 10;

/** Счётчик после ещё одного радиационного урона в бою combatId. */
export function combatRadiationAfterHit(prev, combatId, amount) {
  const carried = prev?.combatId === combatId ? (Number(prev.amount) || 0) : 0;
  return { combatId, amount: carried + Math.max(0, Number(amount) || 0) };
}

/** Нужен ли тест T+0 по концу боя combatId. */
export function combatRadiationDue(rec, combatId) {
  return !!rec && rec.combatId === combatId
    && (Number(rec.amount) || 0) >= COMBAT_RAD_TEST_THRESHOLD;
}
