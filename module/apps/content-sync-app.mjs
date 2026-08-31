// module/apps/content-sync-app.mjs
// ════════════════════════════════════════════════════════════════════════
//  Окно «Обновить мир» — превью и применение сверки предметов актёров с
//  паком (движок и правила см. module/apps/content-sync.mjs). Открывается
//  пунктом системных Настроек (warhammer-dbc.mjs, game.settings.registerMenu).
//
//  Единица применения — ЗАПИСЬ (один предмет одного актёра, одно поле), не
//  вся группа: у одноимённого поля разные актёры могут разойтись по-разному
//  (кто-то чисто, кто-то в конфликте). Строка-заголовок группы — просто
//  раскрывашка со сводным чекбоксом «отметить всё в группе» для удобства.
// ════════════════════════════════════════════════════════════════════════

import { buildLiveSyncReport, applySyncReport } from "./content-sync.mjs";

const { FormApplication } = foundry.appv1.api;

function fmtVal(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// FormApplication, не голый Application: game.settings.registerMenu (Foundry
// v14) требует FormApplication/ApplicationV2 у пункта меню и синхронно бросает
// иначе — этот бросок обрывал ВЕСЬ остаток общего Hooks.once("init", ...) в
// warhammer-dbc.mjs, из-за чего все настройки, зарегистрированные ПОСЛЕ этого
// пункта меню (sceneGroups, imperialCalendar/timeFlow и т.д. — десятки штук),
// не регистрировались вовсе на живом мире. Окно не использует настоящую
// сдачу формы (кнопки/чекбоксы уже сами всё обрабатывают в activateListeners),
// поэтому _updateObject — заглушка, а не отсутствующий метод.
export class ContentSyncApp extends FormApplication {
  async _updateObject() {}
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "wh-content-sync",
      classes: ["warhammer-dbc", "wh-holo", "wh-content-sync"],
      title: "Обновить мир",
      template: "systems/warhammer-dbc/templates/apps/content-sync.hbs",
      width: 820, height: 700, resizable: true,
      scrollY: [".wh-cs-body"]
    });
  }

  constructor(...args) {
    super(...args);
    /** @type {{rows: object[], unmatched: object[]} | null} */
    this.report = null;
    this.selected = new Set();   // entryKey = "<itemId>::<path>"
    this.expanded = new Set();   // row.key раскрытых групп
  }

  async _ensureReport() {
    if (this.report) return;
    this.report = await buildLiveSyncReport();
    this.selected = new Set();
    for (const row of this.report.rows) {
      for (const entry of row.entries) {
        if (entry.status === "clean") this.selected.add(entry.entryKey);
      }
    }
  }

  _rowVM(row) {
    const entries = row.entries
      .slice()
      .sort((a, b) => a.actorName.localeCompare(b.actorName, "ru"))
      .map(e => ({
        ...e,
        checked: this.selected.has(e.entryKey),
        baseValStr: fmtVal(e.baseVal),
        actorValStr: fmtVal(e.actorVal)
      }));
    const checkedCount = entries.filter(e => e.checked).length;
    return {
      key: row.key, packName: row.packName, itemTypeLabel: row.itemTypeLabel,
      path: row.path, packValStr: fmtVal(row.packVal),
      count: entries.length, checkedCount,
      allChecked: checkedCount === entries.length,
      noneChecked: checkedCount === 0,
      anyConflict: entries.some(e => e.status === "conflict"),
      // Соло-запись уже полностью показана в строке-заголовке (её же чекбокс) —
      // отдельный список из одного элемента ниже был бы просто дублем.
      expanded: entries.length > 1 && this.expanded.has(row.key),
      soloEntry: entries.length === 1 ? entries[0] : null,
      entries
    };
  }

  async getData() {
    await this._ensureReport();
    const rows = this.report.rows
      .slice()
      .sort((a, b) => a.packName.localeCompare(b.packName, "ru") || a.path.localeCompare(b.path, "ru"))
      .map(r => this._rowVM(r));
    const unmatched = this.report.unmatched
      .slice()
      .sort((a, b) => a.actorName.localeCompare(b.actorName, "ru") || a.itemName.localeCompare(b.itemName, "ru"));
    return {
      isGM: game.user.isGM,
      hasRows: rows.length > 0,
      rows,
      hasUnmatched: unmatched.length > 0,
      unmatchedCount: unmatched.length,
      unmatched,
      selectedCount: this.selected.size
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const el = html[0] ?? html;
    const on = (sel, evt, fn) => el.querySelectorAll(sel).forEach(n => n.addEventListener(evt, fn));

    on("[data-act=toggle-group]", "click", e => {
      const key = e.currentTarget.closest("[data-row]")?.dataset.row;
      if (!key) return;
      if (this.expanded.has(key)) this.expanded.delete(key); else this.expanded.add(key);
      this.render(false);
    });

    on("[data-entry]", "change", e => {
      const key = e.currentTarget.dataset.entry;
      if (e.currentTarget.checked) this.selected.add(key); else this.selected.delete(key);
      this.render(false);
    });

    on("[data-act=toggle-row]", "change", e => {
      const rowKey = e.currentTarget.dataset.row;
      const row = this.report?.rows.find(r => r.key === rowKey);
      if (!row) return;
      for (const entry of row.entries) {
        if (e.currentTarget.checked) this.selected.add(entry.entryKey);
        else this.selected.delete(entry.entryKey);
      }
      this.render(false);
    });

    // Полу-состояние группового чекбокса, когда отмечена только часть записей
    // (например чистые — да, конфликтные — ещё нет): HTML не выразит это
    // атрибутом checked, доставляем свойством после отрисовки.
    el.querySelectorAll("[data-act=toggle-row]").forEach(cb => {
      const row = this.report?.rows.find(r => r.key === cb.dataset.row);
      if (!row) return;
      const checkedCount = row.entries.filter(e => this.selected.has(e.entryKey)).length;
      cb.indeterminate = checkedCount > 0 && checkedCount < row.entries.length;
    });

    el.querySelector("[data-act=refresh]")?.addEventListener("click", () => {
      this.report = null;
      this.render(true);
    });

    el.querySelector("[data-act=apply]")?.addEventListener("click", () => this._applySelected());
  }

  async _applySelected() {
    if (!this.selected.size) { ui.notifications?.info("Ничего не отмечено — нечего применять."); return; }
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Обновить мир" },
      content: `<p>Будет применено полей: <b>${this.selected.size}</b>. Это правит предметы актёров напрямую.</p>
                 <p>Рекомендуем перед этим сделать бэкап мира (Настройки → Управление мирами → Бэкап).</p>`,
      rejectClose: false
    });
    if (!ok) return;

    const { actors, items } = await applySyncReport(this.report, this.selected);
    ui.notifications?.info(`Обновление мира: ${this.selected.size} полей на ${items} предметах, ${actors} актёров.`);
    this.report = null;
    this.render(true);
  }
}

export function openContentSync() {
  if (!game.user.isGM) { ui.notifications?.warn("«Обновить мир» — только для ГМа."); return; }
  new ContentSyncApp().render(true);
}
