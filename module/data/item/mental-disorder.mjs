// module/data/item/mental-disorder.mjs
// ════════════════════════════════════════════════════════════════════════════
//  РАССТРОЙСТВО — след безумия. Тест на преодоление задаётся характеристикой и
//  модификатором. Заводит его ГМ вручную, в паках таких предметов нет.
// ════════════════════════════════════════════════════════════════════════════

export class MentalDisorderData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, NumberField } = foundry.data.fields;
    return {
      description: new StringField({ initial: "", label: "Описание" }),
      notes:       new StringField({ initial: "", label: "Заметки" }),
      // Лист рисуется talent.hbs, где строка «Источник» есть давно; без поля
      // в схеме Foundry молча выбрасывал введённое (wdbc-fl3).
      bookSource:  new StringField({ initial: "", label: "Книга-источник" }),
      testChar:    new StringField({ initial: "wp", label: "Характеристика теста" }),
      testMod:     new NumberField({ initial: 0, integer: true, nullable: false, label: "Модификатор теста" })
    };
  }
}
