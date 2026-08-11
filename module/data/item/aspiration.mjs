// module/data/item/aspiration.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СТРЕМЛЕНИЕ (Black Crusade, стр. 22) — строка одной из трёх таблиц d10,
//  из которых собирается дропдаун «Стремления» на вкладке ЗАПИСИ. Модификаторы
//  (`mods`) — подсказка игроку: движок их не считает, они применяются к Базе
//  характеристик руками при выборе.
//
//  Схема заменяет запись типа в template.json.
// ════════════════════════════════════════════════════════════════════════════

/** Три таблицы Стремлений — подписи повторяют дропдаун листа предмета. */
export const ASPIRATION_TABLES = {
  pride:      "Гордость",
  motivation: "Мотивация",
  disgrace:   "Позор"
};

export class AspirationData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, NumberField } = foundry.data.fields;
    return {
      // Ключ «таблица:номер» — по нему запись находит вкладка ЗАПИСИ.
      key:         new StringField({ initial: "", label: "Ключ" }),
      table:       new StringField({
        initial: "pride", choices: ASPIRATION_TABLES, label: "Таблица"
      }),
      n:           new NumberField({ initial: 0, integer: true, nullable: false, label: "Номер в таблице" }),
      mods:        new StringField({ initial: "", label: "Модификаторы" }),
      description: new StringField({ initial: "", label: "Описание" }),
      bookSource:  new StringField({ initial: "", label: "Книга-источник" })
    };
  }
}
