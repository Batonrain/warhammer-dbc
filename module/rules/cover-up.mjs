// module/rules/cover-up.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Cover Up / Работа под Прикрытием — ведомость ячеек тайных агентов
//  (решение владельца 26.10.2026, Sahara whatever-you-want-cover-up-best-q).
//
//  Книга (DoomBC — Основная книга, Социальные Таланты): «Персонаж может
//  потратить следующее число Inf (Характеристики, не Очков), чтобы организовать
//  небольшое планетарное предприятие или группу тайных агентов с сетью
//  информаторов, что будут выполнять его приказы». Таблица:
//    Inf 1 → средние Х-ки агентов 25, Уровень Реквизиции 0;  Inf 2 → 30 / 1;
//    Inf 3 → 35 / 1;                                          Inf 4 → 40 / 2.
//
//  Что здесь считается и чего НЕТ:
//    • Ячейка — {name, inf}: название и потраченный Inf (1–4). Средние Х-ки
//      агентов и Уровень Реквизиции берутся из таблицы сами.
//    • «Уровень Реквизиции» — СПРАВОЧНЫЙ: книга не говорит, что именно он
//      меняет в тесте Реквизиции, и в тест (rules/requisition*.mjs) НЕ
//      подмешивается — решение владельца.
//    • Сам Inf персонажа здесь не трогается и «свободный Inf» не считается:
//      книга пишет «потратить Inf», но не говорит, снижается ли Характеристика
//      на листе, а часть ячеек выдаётся БЕЗ траты (Архетип «Отступник»:
//      «Cover Up (суммарно на 10 Inf без траты Inf)»; Происхождение Аэльдари
//      «Три Разговора, Один Нож»: ячейка 2 Inf без платы). Показывается только
//      вложенное в ячейки число.
//    • Требование Таланта «Сеть Контактов» («Cover Up, 5 и больше ячеек») —
//      условие получения, здесь не проверяется (rules/requisition-talents.mjs
//      про него молчит ровно так же).
//
//  Хранение — флаг актора `flags.warhammer-dbc.coverUpCells` (список {name,
//  inf}); схема актора НЕ тронута, поэтому ловушки «поле, забытое в схеме,
//  пропадает» нет. Флаг переживает продажу Таланта (ячейки не стираются), но
//  панель показывается только носителю Таланта.
//
//  Чистая логика без Foundry. Файл НЕ источник правил (sources.mjs его не
//  импортирует).
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

/** Ключ флага актора (`flags.warhammer-dbc.<ключ>`). */
export const COVER_UP_FLAG = "coverUpCells";

export const COVER_UP_INF_MIN = 1;
export const COVER_UP_INF_MAX = 4;

/** Таблица книги: потраченный Inf → средние Х-ки агентов и Уровень Реквизиции. */
export const COVER_UP_TABLE = Object.freeze({
  1: Object.freeze({ agents: 25, requisition: 0 }),
  2: Object.freeze({ agents: 30, requisition: 1 }),
  3: Object.freeze({ agents: 35, requisition: 1 }),
  4: Object.freeze({ agents: 40, requisition: 2 })
});

/** Целое в 1…4; мусор — нижняя граница. */
export function clampInf(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return COVER_UP_INF_MIN;
  return Math.min(COVER_UP_INF_MAX, Math.max(COVER_UP_INF_MIN, n));
}

/** Числа ячейки по таблице книги; Inf вне таблицы — null. */
export function cellStats(inf) {
  const row = COVER_UP_TABLE[Math.round(Number(inf))];
  return row ? { agents: row.agents, requisition: row.requisition } : null;
}

/** Носитель Таланта «Cover Up» — только ему панель имеет смысл. */
export function hasCoverUp(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, "Cover Up"));
}

/** Ячейки из флага актора, приведённые к {name, inf}; не список — пусто. */
export function readCells(actor) {
  const raw = actor?.flags?.["warhammer-dbc"]?.[COVER_UP_FLAG];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(c => c && typeof c === "object")
    .map(c => ({ name: String(c.name ?? ""), inf: clampInf(c.inf) }));
}

/** Список с новой ячейкой в конце (исходный не меняется). */
export function withAddedCell(cells, { name = "", inf = COVER_UP_INF_MIN } = {}) {
  return [...cells, { name: String(name ?? ""), inf: clampInf(inf) }];
}

/** Список с правкой ячейки `index`; чужой индекс — тот же список. */
export function withChangedCell(cells, index, patch = {}) {
  if (!Number.isInteger(index) || index < 0 || index >= cells.length) return cells;
  return cells.map((c, i) => {
    if (i !== index) return c;
    const next = { ...c };
    if (patch.name !== undefined) next.name = String(patch.name ?? "");
    if (patch.inf !== undefined) next.inf = clampInf(patch.inf);
    return next;
  });
}

/** Список без ячейки `index`; чужой индекс — тот же список. */
export function withoutCell(cells, index) {
  if (!Number.isInteger(index) || index < 0 || index >= cells.length) return cells;
  return cells.filter((_, i) => i !== index);
}

/** Сводка для шапки блока: сколько ячеек, сколько Inf в них вложено, высший Уровень Реквизиции. */
export function coverUpSummary(cells) {
  let totalInf = 0, maxRequisition = 0;
  for (const c of cells) {
    totalInf += clampInf(c.inf);
    maxRequisition = Math.max(maxRequisition, cellStats(c.inf)?.requisition ?? 0);
  }
  return { count: cells.length, totalInf, maxRequisition };
}
