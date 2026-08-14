// module/sheets/tabs/rituals.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Раздел «Ритуалы» на вкладке Способности (корбук стр. 393-425).
//
//  Показывает ритуалы, лежащие на акторе: раздел книги, Запись, вилку
//  ассистентов, и раскрывает прозу по клику. Сам бросок ведёт движок Завесы
//  (`module/constants/rituals.mjs`) — здесь только список и его правка.
//
//  Функция контекста принимает актора, а не лист, поэтому проверяется без
//  Foundry.
// ════════════════════════════════════════════════════════════════════════════

import { RITUAL_ITEM_TYPES_MAP } from "../../constants/rituals.mjs";
import { openCompendiumBrowser } from "../../apps/compendium-browser.mjs";

/** Строки раздела: по ритуалу на строку. */
export function ritualsContext(actor) {
  return actor.items.filter(i => i.type === "ritual").map(i => {
    const s = i.system || {};
    const min = Number(s.assistMin) || 0;
    const max = Number(s.assistMax) || 0;
    return {
      id: i.id,
      name: i.name,
      typeLabel: RITUAL_ITEM_TYPES_MAP[s.ritualType]?.label || s.ritualType || "—",
      record: Number(s.record) || 0,
      // Вилка «0—0» значит «в одиночку», а не «данных нет» — рисуем прочерк.
      assistLabel: (min || max) ? `${min}—${max}` : "—",
      procedure:   s.procedure   || "",
      result:      s.result      || "",
      cost:        s.cost        || "",
      failureCost: s.failureCost || "",
      // У ритуалов из пресетов проза пустая: в книге она есть, а в пресетах
      // нет. Без этого признака строка раскрывалась бы в пустой блок вместо
      // честного «описание не заполнено».
      hasAnyText: !!(s.procedure || s.result || s.cost || s.failureCost)
    };
  });
}

export function activateRitualListeners(html, actor) {
  // «＋» открывает Обозреватель сразу на паке ритуалов. Перетаскивание
  // предмета-ритуала на лист обрабатывает штатный _onDropItem — своего
  // обработчика дропа разделу не нужно.
  html.find(".ritual-add-btn").on("click", async ev => {
    ev.preventDefault();
    const uuid = await openCompendiumBrowser(false, { pack: "rituals" });
    if (!uuid) return;
    const src = await fromUuid(uuid).catch(() => null);
    if (!src) return;
    const data = src.toObject();
    delete data._id;
    await actor.createEmbeddedDocuments("Item", [data]);
  });

  html.find(".ritual-name-link").on("click", ev => {
    actor.items.get(ev.currentTarget.dataset.itemId)?.sheet?.render(true);
  });

  html.find(".ritual-remove-btn").on("click", async ev => {
    ev.preventDefault();
    await actor.items.get(ev.currentTarget.dataset.itemId)?.delete();
  });
}
