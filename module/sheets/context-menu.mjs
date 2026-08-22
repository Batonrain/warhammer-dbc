// module/sheets/context-menu.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Контекстное меню по правой кнопке: общий конструктор и меню строки предмета.
//  Меню живёт в <body>, а не внутри листа: строки таблиц скроллятся и обрезаются
//  по overflow, и вложенное меню срезало бы нижним пунктом.
//  Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { WarhammerItemSheet } from "./item-sheet.mjs";
import { esc } from "../helpers/utils.mjs";

/** Убрать открытые меню и отвязать одноразовый обработчик закрытия. */
export function closeContextMenus(jq = globalThis.$) {
  jq(".wh-context-menu").remove();
  jq(globalThis.document).off("click.wh-ctx");
}

/**
 * Показать меню у курсора.
 *
 * @param {object} ev      событие contextmenu (нужны clientX/clientY)
 * @param {Array}  entries пункты: { cls, label, onClick } (обычный) либо
 *                         { cls, label, checkbox: true, checked, onClick }
 *                         (переключатель — та же семантика клика, чекбокс
 *                         только рисует текущее состояние; сам onClick сам
 *                         решает, на что переключить) либо разделитель { sep: true }
 * @param {Function} jq    jQuery (подменяется в тестах)
 */
export function openContextMenu(ev, entries, jq = globalThis.$) {
  jq(".wh-context-menu").remove();

  const items = entries
    .map(e => {
      if (e.sep) return `<div class="wh-ctx-sep"></div>`;
      if (e.checkbox) return `<label class="wh-ctx-item wh-ctx-checkbox ${e.cls}">`
        + `<input type="checkbox" ${e.checked ? "checked" : ""}/> <span>${e.label}</span></label>`;
      return `<div class="wh-ctx-item ${e.cls}">${e.label}</div>`;
    })
    .join("");
  const menu = jq(`<div class="wh-context-menu">${items}</div>`)
    .css({ top: ev.clientY + "px", left: ev.clientX + "px", position: "fixed" });

  jq("body").append(menu);
  // Задержка: клик, открывший меню, ещё всплывает — без неё меню закрылось бы
  // тем же событием, которым открылось.
  setTimeout(() => { jq(globalThis.document).one("click.wh-ctx", () => menu.remove()); }, 50);

  for (const entry of entries) {
    if (entry.sep) continue;
    menu.find(`.${entry.cls}`).on("click", ev2 => {
      ev2.stopPropagation();
      menu.remove();
      jq(globalThis.document).off("click.wh-ctx");
      // Результат возвращаем: пункт меню бывает асинхронным (спросить
      // подтверждение, потом удалить), и без этого его никто не дожидается.
      // jQuery возвращённым промисом не пользуется, а вызывающему он нужен.
      return entry.onClick(ev2);
    });
  }

  return menu;
}

/**
 * Пункты меню строки предмета: открыть лист и удалить с подтверждением.
 * Отдельно от activateItemContextMenu, потому что листы на ApplicationV2
 * вешают contextmenu сами (jQuery у них нет), а меню нужно то же самое —
 * со своей копией лист техники удалял орудие молча (wdbc-ff4.10.4).
 */
export function itemContextEntries(item) {
  return [
    {
      cls: "wh-ctx-edit",
      label: "✏️ Редактировать",
      onClick: () => {
        const sheet = item.sheet;
        if (sheet) sheet.render(true);
        else new WarhammerItemSheet(item).render(true);
      }
    },
    {
      cls: "wh-ctx-delete",
      label: "🗑️ Удалить",
      // Меню открывается по ПКМ прямо под курсором, и «Удалить» стоит вплотную
      // к «Редактировать»: без вопроса промах стирал предмет молча, откатить
      // его нечем (wdbc-9z9).
      onClick: async () => {
        // Имя экранируем: его задаёт игрок на своём акторе, а content диалога
        // разбирается как HTML — «<img src=x onerror=…>» в названии предмета
        // исполнился бы у того, кто это удаление подтверждает.
        const ok = await foundry.applications.api.DialogV2.confirm({
          window: { title: "Удалить предмет" },
          content: `<p>Удалить «${esc(item.name)}»? Вернуть его будет нечем.</p>`
        }).catch(() => false);
        if (ok) await item.delete();
      }
    }
  ];
}

/** ПКМ по строке предмета: открыть лист предмета или удалить его. */
export function activateItemContextMenu(html, actor, jq = globalThis.$) {
  html.find(".item-row").on("contextmenu", ev => {
    ev.preventDefault(); ev.stopPropagation();
    // Прежнее меню снимается даже когда предмета уже нет: строка могла остаться
    // от ре-рендера, и висящее меню указывало бы на удалённый предмет.
    jq(".wh-context-menu").remove();
    const item = actor.items.get(jq(ev.currentTarget).data("item-id"));
    if (!item) return;
    openContextMenu(ev, itemContextEntries(item), jq);
  });
}
