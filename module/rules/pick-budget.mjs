// module/rules/pick-budget.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Бюджет выбора из компендиума — общий счётчик для всего, что книга пишет
//  как «возьми столько-то отсюда».
//
//  Три записи корбука выглядят по-разному, а устроены одинаково: фильтр по
//  компендиуму плюс счётчик, который надо израсходовать.
//
//    «7 талантов 1 уровня»     → фильтр: Таланты, ступень 1;   бюджет: 7 штук
//    «500хр на Психосилы»      → фильтр: Психосилы;            бюджет: 500 опыта
//    «4 магазина болтов (R2)»  → фильтр: Боеприпасы, Редкость ≤ 2; бюджет: 4 штуки
//
//  Отсюда и единый принцип: запись Конструктора описывает ЧТО можно брать
//  (фильтры) и СКОЛЬКО (бюджет), а Обозреватель показывает остаток и не даёт
//  выйти за него. Разница между «штуками» и «опытом» — только в том, чем
//  меряется одна взятая запись.
//
//  Цена в опыте зависит от того, КОМУ выдают (Склонности, культура легиона),
//  поэтому сюда она приходит функцией. Модуль остаётся чистым: ни Foundry, ни
//  актора, ни компендиумов — и проверяется без запуска мира.
// ════════════════════════════════════════════════════════════════════════════

/** Чем меряется бюджет. */
export const BUDGET_COUNT = "count";
export const BUDGET_XP    = "xp";

export const BUDGET_MODES = [
  { key: BUDGET_COUNT, label: "Штуками" },
  { key: BUDGET_XP,    label: "Опытом"  }
];

const num = v => Number(v) || 0;

/** Бюджет в рабочем виде. Пустой/битый — «одна штука», а не «сколько угодно». */
export function normalizeBudget(budget) {
  const mode = budget?.mode === BUDGET_XP ? BUDGET_XP : BUDGET_COUNT;
  const value = Math.max(mode === BUDGET_XP ? 0 : 1, num(budget?.value) || (mode === BUDGET_XP ? 0 : 1));
  return { mode, value };
}

/**
 * Сколько «стоит» одна взятая запись.
 * @param {object} item    узел дерева Обозревателя
 * @param {object} budget  бюджет
 * @param {(item:object)=>number} xpCost  цена в опыте для конкретного актора
 */
export function entryWeight(item, budget, xpCost) {
  const b = normalizeBudget(budget);
  if (b.mode === BUDGET_COUNT) return 1;
  return Math.max(0, num(xpCost ? xpCost(item) : item?.cost));
}

/**
 * Состояние счётчика по уже выбранному.
 * @returns {{spent, left, over, done, mode, value}}
 *   over — вышли за бюджет (в опыте это возможно: цены разные);
 *   done — бюджет израсходован ровно.
 */
export function budgetState(chosen, budget, xpCost) {
  const b = normalizeBudget(budget);
  const spent = (chosen || []).reduce((n, it) => n + entryWeight(it, b, xpCost), 0);
  return {
    ...b,
    spent,
    left: b.value - spent,
    over: spent > b.value,
    done: spent === b.value
  };
}

/**
 * Можно ли взять ещё одну запись, не выйдя за бюджет.
 * Штуки считаются жёстко, опыт — тоже: выйти за 500 значит потратить чужое.
 */
export function budgetFits(chosen, item, budget, xpCost) {
  const st = budgetState(chosen, budget, xpCost);
  return st.spent + entryWeight(item, budget, xpCost) <= st.value;
}

/** Подпись счётчика для шапки Обозревателя. */
export function budgetLabel(chosen, budget, xpCost) {
  const st = budgetState(chosen, budget, xpCost);
  return st.mode === BUDGET_XP
    ? `Потрачено ${st.spent} из ${st.value} опыта`
    : `Выбрано ${st.spent} из ${st.value}`;
}

/**
 * Готов ли выбор к подтверждению.
 *
 * Штуки — ровно столько, сколько велено: недобор съел бы слоты, перебор выдал
 * бы лишнее. Опыт — не больше бюджета, но и меньше можно: цены разные, и
 * потратить 500 в ноль удаётся не всегда, а запрещать из-за этого выбор нельзя.
 */
export function budgetReady(chosen, budget, xpCost) {
  const st = budgetState(chosen, budget, xpCost);
  if (st.mode === BUDGET_XP) return !st.over && st.spent > 0;
  return st.done;
}
