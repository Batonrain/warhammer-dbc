// module/data/item/ability.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СПОСОБНОСТЬ — свободная запись «что персонаж умеет»: ни цены, ни рейтинга,
//  ни механики. Заводит её ГМ вручную, в паках таких предметов нет.
// ════════════════════════════════════════════════════════════════════════════

export class AbilityData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, HTMLField } = foundry.data.fields;
    return {
      description: new HTMLField({ initial: "", label: "Описание" }),
      notes:       new HTMLField({ initial: "", label: "Заметки" }),
      // Лист рисуется talent.hbs, где строка «Источник» есть давно; без поля
      // в схеме Foundry молча выбрасывал введённое (wdbc-fl3).
      bookSource:  new StringField({ initial: "", label: "Книга-источник" }),
      benefit:     new StringField({ initial: "", label: "Действие" })
    };
  }
}
