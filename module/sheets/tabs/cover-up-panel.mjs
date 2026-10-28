// module/sheets/tabs/cover-up-panel.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Блок «ЯЧЕЙКИ АГЕНТОВ» на вкладке СОЦИУМ — ведомость Таланта Cover Up / Работа
//  под Прикрытием (решение владельца 26.10.2026). Правила, таблица книги и
//  причины, почему Inf персонажа здесь не списывается, — rules/cover-up.mjs.
//
//  Блок видит только носитель Таланта. Ячейки лежат флагом актора
//  `flags.warhammer-dbc.coverUpCells`, а не полем схемы: список коротких
//  записей без собственных правил расчёта, схема не нужна. setFlag заменяет
//  массив целиком, поэтому каждая правка читает текущий список, меняет его
//  чистой функцией из rules/cover-up.mjs и пишет обратно.
// ════════════════════════════════════════════════════════════════════════════

import {
  COVER_UP_FLAG, COVER_UP_INF_MIN, COVER_UP_INF_MAX,
  hasCoverUp, readCells, cellStats, coverUpSummary,
  withAddedCell, withChangedCell, withoutCell
} from "../../rules/cover-up.mjs";
import { rootEl } from "../v2-helpers.mjs";

const NS = "warhammer-dbc";

const INF_VALUES = Array.from({ length: COVER_UP_INF_MAX - COVER_UP_INF_MIN + 1 }, (_, i) => COVER_UP_INF_MIN + i);

/** Контекст блока; без Таланта — только `hasCoverUp: false` (панель в шаблоне скрыта). */
export function coverUpPanelContext(actor) {
  if (!hasCoverUp(actor)) return { hasCoverUp: false };
  const cells = readCells(actor);
  const sum = coverUpSummary(cells);
  return {
    hasCoverUp: true,
    coverUpCells: cells.map((c, idx) => {
      const stats = cellStats(c.inf);
      return {
        idx, name: c.name, inf: c.inf,
        agents: stats?.agents ?? "—", requisition: stats?.requisition ?? "—",
        infOptions: INF_VALUES.map(value => ({ value, label: String(value), selected: value === c.inf }))
      };
    }),
    coverUpCount: sum.count,
    coverUpTotalInf: sum.totalInf,
    coverUpMaxRequisition: sum.maxRequisition
  };
}

// ── Запись ──────────────────────────────────────────────────────────────────

const save = (actor, cells) => actor.setFlag(NS, COVER_UP_FLAG, cells);

// Правки идут по одной. Каждая читает флаг, меняет список и пишет его целиком,
// а `actor.flags` обновляется лишь после ответа сервера: вписал название и тут
// же нажал «+» — вторая запись прочитала бы ещё старый список и затёрла
// переименование (находка ревью 26.10.2026). Очередь на актора: следующая
// правка начинается после предыдущей и читает уже свежий флаг.
const QUEUES = new WeakMap();
function enqueue(actor, task) {
  const run = (QUEUES.get(actor) ?? Promise.resolve()).then(task);
  QUEUES.set(actor, run.catch(() => {}));   // сбой одной правки не должен глушить следующие
  return run;
}

/** Новая ячейка в конец списка (Inf 1, без названия — впишет игрок). */
export function addCoverUpCell(actor) {
  return enqueue(actor, () => save(actor, withAddedCell(readCells(actor))));
}

/** Правка названия и/или Inf ячейки `index`. Чужой индекс — ничего не пишет. */
export function changeCoverUpCell(actor, index, patch) {
  return enqueue(actor, async () => {
    const cells = readCells(actor);
    const next = withChangedCell(cells, index, patch);
    if (next !== cells) await save(actor, next);
  });
}

/** Убрать ячейку `index`. Чужой индекс — ничего не пишет. */
export function removeCoverUpCell(actor, index) {
  return enqueue(actor, async () => {
    const cells = readCells(actor);
    const next = withoutCell(cells, index);
    if (next !== cells) await save(actor, next);
  });
}

// ── Слушатели ───────────────────────────────────────────────────────────────

export function activateCoverUpPanelListeners(root, actor, { editable = true } = {}) {
  const el = rootEl(root);
  if (!el?.querySelector || !editable) return;

  el.querySelectorAll(".cover-up-add").forEach(btn =>
    btn.addEventListener("click", () => addCoverUpCell(actor)));

  el.querySelectorAll(".cover-up-name").forEach(input =>
    input.addEventListener("change", ev =>
      changeCoverUpCell(actor, Number(ev.currentTarget.dataset.index), { name: ev.currentTarget.value })));

  el.querySelectorAll(".cover-up-inf").forEach(select =>
    select.addEventListener("change", ev =>
      changeCoverUpCell(actor, Number(ev.currentTarget.dataset.index), { inf: ev.currentTarget.value })));

  el.querySelectorAll(".cover-up-remove").forEach(btn =>
    btn.addEventListener("click", ev =>
      removeCoverUpCell(actor, Number(ev.currentTarget.dataset.index))));
}
