// module/rules/cover-up.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Cover Up / Работа под Прикрытием — ведомость ячеек тайных агентов
//  (решение владельца 26.10.2026, Sahara whatever-you-want-cover-up-best-q;
//  показ остатка Inf и галочка «бесплатная ячейка» — решение 07.11.2026,
//  wdbc-f06dv).
//
//  Книга (DoomBC — Основная книга, Социальные Таланты): «Персонаж может
//  потратить следующее число Inf (Характеристики, не Очков), чтобы организовать
//  небольшое планетарное предприятие или группу тайных агентов с сетью
//  информаторов, что будут выполнять его приказы». Таблица:
//    Inf 1 → средние Х-ки агентов 25, Уровень Реквизиции 0;  Inf 2 → 30 / 1;
//    Inf 3 → 35 / 1;                                          Inf 4 → 40 / 2.
//
//  Что здесь считается и чего НЕТ:
//    • Ячейка — {name, inf, free}: название, потраченный Inf (1–4) и галочка
//      «бесплатная ячейка». Средние Х-ки агентов и Уровень Реквизиции берутся
//      из таблицы сами.
//    • «Уровень Реквизиции» — СПРАВОЧНЫЙ: книга не говорит, что именно он
//      меняет в тесте Реквизиции, и в тест (rules/requisition*.mjs) НЕ
//      подмешивается — решение владельца.
//    • Сам Inf персонажа НЕ списывается: книга пишет «потратить Inf», но не
//      говорит, снижается ли Характеристика на листе (решение владельца
//      26.10.2026). С 07.11.2026 остаток ПОКАЗЫВАЕТСЯ вычислением — «Inf на
//      листе минус вложено в ячейки» (infRemaining), в актор ничего не пишется.
//      В «вложено» не входят ячейки с галочкой «бесплатная»: часть ячеек
//      выдаётся БЕЗ траты (Архетип «Отступник»: «Cover Up (суммарно на 10 Inf
//      без траты Inf)»; Происхождение Аэльдари «Три Разговора, Один Нож»:
//      ячейка 2 Inf, «персонаж не платит за ее создание»). Галочку ставит
//      игрок сам, но только у персонажа с Архетипом «Отступник» (ключ
//      renegade) или бандой корсаров «Агенты Тишины Миян» (system.band =
//      miyanAgents; решение владельца 08.11.2026, freeCellAllowed): у остальных колонки нет, а ячейка с флагом free,
//      оставшимся от прежней версии, считается платной (effectiveCells).
//      Лимит «суммарно на 10 Inf» Отступника не проверяется.
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

const RENEGADE_ARCHETYPES = ["renegade", "ренегат", "отступник"];
const FREE_CELL_BAND = "miyanAgents";

/**
 * Можно ли актору отмечать ячейки бесплатными: Архетип «Отступник» (ключ или имя
 * в system.archetype — как у isSkitariiActor) или Происхождение Аэльдари — банда
 * корсаров «Агенты Тишины Миян» (system.band), единственное с бесплатной ячейкой.
 */
export function freeCellAllowed(actor) {
  const arch = String(actor?.system?.archetype ?? "").trim().toLowerCase();
  if (RENEGADE_ARCHETYPES.includes(arch)) return true;
  return actor?.system?.band === FREE_CELL_BAND;
}

/** Ячейки так, как они считаются: без права на бесплатные free сбрасывается. */
export function effectiveCells(actor, cells) {
  return freeCellAllowed(actor) ? cells : cells.map(c => (c.free === true ? { ...c, free: false } : c));
}

/** Ячейки из флага актора, приведённые к {name, inf, free}; не список — пусто. */
export function readCells(actor) {
  const raw = actor?.flags?.["warhammer-dbc"]?.[COVER_UP_FLAG];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(c => c && typeof c === "object")
    .map(c => ({ name: String(c.name ?? ""), inf: clampInf(c.inf), free: c.free === true }));
}

/** Список с новой ячейкой в конце (исходный не меняется). */
export function withAddedCell(cells, { name = "", inf = COVER_UP_INF_MIN, free = false } = {}) {
  return [...cells, { name: String(name ?? ""), inf: clampInf(inf), free: free === true }];
}

/** Список с правкой ячейки `index`; чужой индекс — тот же список. */
export function withChangedCell(cells, index, patch = {}) {
  if (!Number.isInteger(index) || index < 0 || index >= cells.length) return cells;
  return cells.map((c, i) => {
    if (i !== index) return c;
    const next = { ...c };
    if (patch.name !== undefined) next.name = String(patch.name ?? "");
    if (patch.inf !== undefined) next.inf = clampInf(patch.inf);
    if (patch.free !== undefined) next.free = patch.free === true;
    return next;
  });
}

/** Список без ячейки `index`; чужой индекс — тот же список. */
export function withoutCell(cells, index) {
  if (!Number.isInteger(index) || index < 0 || index >= cells.length) return cells;
  return cells.filter((_, i) => i !== index);
}

/**
 * Сводка для шапки блока: сколько ячеек, сколько Inf в них вложено (всего,
 * платного и бесплатного), высший Уровень Реквизиции.
 */
export function coverUpSummary(cells) {
  let totalInf = 0, paidInf = 0, freeInf = 0, maxRequisition = 0;
  for (const c of cells) {
    const inf = clampInf(c.inf);
    totalInf += inf;
    if (c.free === true) freeInf += inf; else paidInf += inf;
    maxRequisition = Math.max(maxRequisition, cellStats(c.inf)?.requisition ?? 0);
  }
  return { count: cells.length, totalInf, paidInf, freeInf, maxRequisition };
}

/** Итог Inf с листа персонажа (то, что показывает лист); нет данных — 0. */
export function infOnSheet(actor) {
  return Math.round(Number(actor?.system?.characteristics?.inf?.total)) || 0;
}

/**
 * Inf на листе минус вложенное в платные ячейки. Только вычисление для показа:
 * Inf актора не меняется. over — вложено больше, чем есть на листе.
 */
export function infRemaining(actor, cells) {
  const onSheet = infOnSheet(actor);
  const { paidInf } = coverUpSummary(effectiveCells(actor, cells));
  const left = onSheet - paidInf;
  return { onSheet, paid: paidInf, left, over: left < 0 };
}
