// module/rules/sustained-action.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Длительное и Расширенное действие (стр. 12, wdbc-x1nz.2.27): оба тратят
//  2 ОД в течение НЕСКОЛЬКИХ Ходов подряд, а не одним Ходом, как Полное
//  действие. Прогресс копится тем же банком, что Расширенный тест
//  (module/rules/extended-test.mjs::applyGain) — только копится не Степень
//  Успеха с брошенного теста, а сам факт «Ход продолжен, 2 ОД заплачены».
//
//  ДЛИТЕЛЬНОЕ — банк «Ходы до единственного теста в конце» (turnsNeeded).
//  Тест проводится один раз, на ПОСЛЕДНЕМ Ходу (readyForFinalTest снизу).
//  Прервали (сами оборвали ИЛИ обстоятельства помешали) — банк ВЕСЬ сгорает,
//  начинать заново.
//
//  РАСШИРЕННОЕ — банк «Ходы до ближайшей контрольной точки» (testInterval),
//  таких точек за одно действие может быть несколько; на каждой — тест.
//  Прервали — сгорает только то, что накопилось С ПОСЛЕДНЕЙ пройденной
//  точки; число уже пройденных точек (checkpointsPassed) не трогается.
//  «В зависимости от контекста персонаж может восстановить прерванное
//  Расширенное действие» — книга явно отдаёт решение ГМу, поэтому здесь
//  этого нет: interruptSustainedAction всегда обнуляет счётчик с точки, а
//  оставлять действие «на паузе» вместо удаления или продолжать его —
//  решает вызывающая сторона (combat/sustained-action.mjs), не эта функция.
// ════════════════════════════════════════════════════════════════════════════

import { applyGain, extendedTestKey } from "./extended-test.mjs";

/** Ключ действия по названию — тот же слаг, что у банка Расширенного теста. */
export const sustainedActionKey = extendedTestKey;

export const SUSTAINED_ACTION_KINDS = { LONG: "long", EXTENDED: "extended" };

/** Стоимость в ОД за продолженный Ход — обе разновидности всегда 2 (стр. 12). */
export const SUSTAINED_ACTION_AP_COST = 2;

/**
 * Продолжить действие ещё на один Ход (2 ОД уже списаны вызывающей
 * стороной). `threshold` — turnsNeeded (Длительное) или testInterval
 * (Расширенное между точками).
 *
 * @param {?object} state     текущее состояние банка (null — начало действия)
 * @param {number}  threshold сколько Ходов нужно набрать до теста
 * @returns {{turnsSinceCheck:number, testDue:boolean}} прибавка к состоянию
 */
export function advanceSustainedAction(state, threshold) {
  const { accumulated, done } = applyGain(state?.turnsSinceCheck, 1, threshold);
  return { turnsSinceCheck: accumulated, testDue: done };
}

/**
 * Контрольная точка Расширенного действия пройдена (тест сдан своим путём,
 * вне этого модуля) — счётчик пройденных точек растёт, банк с последней
 * точки обнуляется для следующего интервала.
 */
export function passCheckpoint(state) {
  return {
    checkpointsPassed: (Number(state?.checkpointsPassed) || 0) + 1,
    turnsSinceCheck: 0,
    testDue: false
  };
}

/**
 * Действие прервано — сами оборвали или помешали (стр. 12). Длительное
 * (kind:"long") возвращает null: запись целиком удаляется, банка больше нет.
 * Расширенное — обнуляет только банк с последней точки; сколько точек уже
 * пройдено (checkpointsPassed) остаётся как было.
 *
 * @returns {?{turnsSinceCheck:number, testDue:boolean}} null — удалить запись целиком
 */
export function interruptSustainedAction(kind) {
  if (kind === SUSTAINED_ACTION_KINDS.LONG) return null;
  return { turnsSinceCheck: 0, testDue: false };
}

/**
 * Список действий для панели (тот же приём, что extendedTestRows) —
 * `flagsObj` — `actor.getFlag("warhammer-dbc", "sustainedActions")`.
 */
export function sustainedActionRows(flagsObj) {
  return Object.entries(flagsObj || {})
    .map(([key, v]) => {
      const kind = v?.kind === SUSTAINED_ACTION_KINDS.EXTENDED
        ? SUSTAINED_ACTION_KINDS.EXTENDED : SUSTAINED_ACTION_KINDS.LONG;
      const threshold = Number(v?.threshold) || 0;
      const turnsSinceCheck = Number(v?.turnsSinceCheck) || 0;
      return {
        key, kind, label: v?.label || key, threshold, turnsSinceCheck,
        checkpointsPassed: Number(v?.checkpointsPassed) || 0,
        testDue: !!v?.testDue,
        ready: threshold > 0 && turnsSinceCheck >= threshold
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));
}
