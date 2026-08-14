// module/data/item/armour-history-entry.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЗАПИСЬ ИСТОРИИ КОМПЛЕКТА силовой брони — строка таблицы: диапазон броска,
//  что случилось и нужен ли выбор. Бросок по таблице делает
//  apps/armour-history.mjs, результат ложится в armor.system.history.
// ════════════════════════════════════════════════════════════════════════════

export class ArmourHistoryEntryData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField } = foundry.data.fields;
    const num = label => new NumberField({ initial: 0, integer: true, nullable: false, label });
    return {
      table:             new StringField({ initial: "", label: "Таблица" }),
      rollMin:           num("Бросок от"),
      rollMax:           num("Бросок до"),
      description:       new StringField({ initial: "", label: "Описание" }),
      notes:             new StringField({ initial: "", label: "Заметки" }),
      effect:            new StringField({ initial: "", label: "Эффект" }),
      hasChoice:         new BooleanField({ initial: false, label: "Требует выбора" }),
      choiceLabel:       new StringField({ initial: "", label: "Подпись выбора" }),
      choicePlaceholder: new StringField({ initial: "", label: "Подсказка выбора" }),
      // «Уничтоженный и восстановленный»: последствия бросаются по зонам.
      zoneRoll:          new BooleanField({ initial: false, label: "Бросок по зонам" }),
      bookSource:        new StringField({ initial: "", label: "Книга-источник" })
    };
  }
}
