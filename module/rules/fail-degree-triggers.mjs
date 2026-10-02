// module/rules/fail-degree-triggers.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Общий триггер «провалил тест на N+ Провала» (wdbc-1rno.22).
//
//  Книга пишет это правило много раз с разными N и разными последствиями:
//  Инфернальная Воля (4+ Провала теста Навыка, кроме Крит. Провала — бросок по
//  таблице Шока), «2+ Провала — 1 Усталость» при подъёме и толкании, «3+
//  Провала» у Пыток, 4+/5+/6+ у разных Даров и Черт. Порог, область теста и
//  исключение Крит. Провала — поля записи реестра ниже, а не своя арифметика
//  в каждом месте; последствие — обработчик по имени (`handler`), который
//  исполняет конвейер исхода теста (rules/kind-outcome.mjs::
//  FAIL_DEGREE_HANDLERS), — здесь его нет, потому что последствию почти
//  всегда нужен Foundry (бросок, правка актора), а этот файл — чистые данные
//  и чистый отбор.
//
//  Срабатывает только на тестах, идущих через общий исход
//  (resolveKindOutcome): лист персонажа (Навыки и Характеристики), Страх и
//  Травма, Верховая езда, тесты Демона, Командование Отряда. Область теста
//  («anyskill», «skill:…») видна только там, где вызывающий кладёт в контекст
//  skill/group: тесты верхом (combat/mount.mjs — Operate/Survival) их не
//  кладут, и для области "anyskill" выглядят как тест Характеристики.
//
//  Запись реестра:
//    id                 — уникальный, для подписи ошибок;
//    capability         — имя Возможности (hasRuleFlag); пусто — правило книги
//                         действует на всех;
//    minDeg             — N из «N+ Провала»;
//    scope              — область теста в нотации эффектов правил
//                         (resolve-test.mjs::effectAppliesTo: "all", "anyskill",
//                         "skill:athletics", "char:s", "morale"…);
//    excludeCritFailure — Крит. Провал (96–100 или сдвинутый Предел) не считается;
//    handler            — имя последствия в kind-outcome.mjs::FAIL_DEGREE_HANDLERS.
// ════════════════════════════════════════════════════════════════════════════

import { effectAppliesTo } from "./resolve-test.mjs";

export const FAIL_DEGREE_TRIGGERS = [
  // Инфернальная Воля (Общие мутации, d100 44): «когда он проваливает любой
  // тест Навыка на 4+ Провала, кроме Критических Провалов, он должен бросить
  // по таблице Шока». Тест Характеристики не считается — отсюда "anyskill".
  { id: "mutation.infernalWill.shock", capability: "mutation.infernalWill", minDeg: 4,
    scope: "anyskill", excludeCritFailure: true, handler: "infernalWillShock" }
];

/**
 * Провален ли тест на N+ Провала.
 *
 * @param {{success:boolean, deg:number, crit?:{failure?:boolean}}} outcome итог
 *   resolveKindOutcome: `deg` на провале — уже число Провалов (с доп. Провалами
 *   failDegMod внутри — книга считает итоговое число).
 * @param {number} minDeg N
 * @param {{excludeCritFailure?:boolean}} [opts]
 */
export function failDegreesReached(outcome, minDeg, { excludeCritFailure = false } = {}) {
  if (!outcome || outcome.success) return false;
  if (excludeCritFailure && outcome.crit?.failure) return false;
  return (Number(outcome.deg) || 0) >= (Number(minDeg) || 1);
}

/**
 * Записи реестра, сработавшие на этом исходе.
 *
 * @param {object} outcome   см. failDegreesReached
 * @param {object} ctx       контекст теста (skill/group/char/morale…)
 * @param {(flag:string)=>boolean} hasFlag есть ли у бросающего Возможность
 * @param {object[]} [triggers] реестр (по умолчанию FAIL_DEGREE_TRIGGERS)
 * @returns {object[]}
 */
export function matchFailDegreeTriggers(outcome, ctx, hasFlag, triggers = FAIL_DEGREE_TRIGGERS) {
  return (triggers ?? []).filter(t =>
    failDegreesReached(outcome, t.minDeg, { excludeCritFailure: !!t.excludeCritFailure })
    && effectAppliesTo(t.scope ?? "all", ctx ?? {})
    && (!t.capability || !!hasFlag?.(t.capability)));
}
