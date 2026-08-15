// module/sheets/v2-helpers.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Обвязка листов на ApplicationV2 (этап 6, эпик wdbc-ff4.10).
//
//  ApplicationV2 зовёт обработчик [data-action] с this = лист и элементом-
//  источником вторым аргументом. Всё, что при этом получается одинаковым у
//  всех листов, живёт здесь: до выделения whenEditable была скопирована в
//  четыре листа, onTab — в четыре, filePicker — в два (wdbc-7vt).
// ════════════════════════════════════════════════════════════════════════════

/**
 * Правящее действие — только для того, кто может править лист.
 * Права на конкретный документ проверяет уже само действие.
 */
export const whenEditable = fn => function (event, target) {
  if (this.isEditable) return fn.call(this, event, target);
};

/** Переключение вкладки: id и группа лежат на самой кнопке навигации. */
export function onTab(event, target) {
  this.changeTab(target.dataset.tab, target.dataset.group);
}

/** В v13 FilePicker переехал в namespace, глобальный помечен устаревшим. */
export const filePicker = () =>
  foundry.applications?.apps?.FilePicker?.implementation || globalThis.FilePicker;
