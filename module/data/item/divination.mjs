// module/data/item/divination.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПРЕДСКАЗАНИЕ — строка таблицы Императорского Таро: бросок, текст и
//  модификатор. Как и у Родного мира, механику ведёт Конструктор, а
//  `system.effects` — её копия прошлого формата (wdbc-43d).
// ════════════════════════════════════════════════════════════════════════════

export class DivinationData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, NumberField, ObjectField } = foundry.data.fields;
    const num = label => new NumberField({ initial: 0, integer: true, nullable: false, label });
    return {
      key:          new StringField({ initial: "", label: "Ключ" }),
      roll:         new StringField({ initial: "", label: "Бросок" }),
      rollMin:      num("Бросок от"),
      rollMax:      num("Бросок до"),
      text:         new StringField({ initial: "", label: "Текст" }),
      effect:       new StringField({ initial: "", label: "Эффект" }),
      source:       new StringField({ initial: "", label: "Откуда получено" }),
      bookSource:   new StringField({ initial: "", label: "Книга-источник" }),
      charModLabel: new StringField({ initial: "", label: "Модификаторы характеристик" }),
      choices:      new ObjectField({ label: "Выборы при генерации" }),
      description:  new StringField({ initial: "", label: "Описание" }),
      notes:        new StringField({ initial: "", label: "Заметки" }),
      effects:      new ObjectField({ initial: () => ({ charValueBonuses: [] }), label: "Механика" })
    };
  }
}
