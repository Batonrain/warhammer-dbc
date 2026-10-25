// module/data/item/disease.mjs
// ════════════════════════════════════════════════════════════════════════════
//  БОЛЕЗНЬ — варп-зараза или обычная хворь: заразность, инкубация, симптомы и
//  чем лечится. Работает, пока active.
// ════════════════════════════════════════════════════════════════════════════

export class DiseaseData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, BooleanField, NumberField, ArrayField, SchemaField } = foundry.data.fields;
    return {
      diseaseType: new StringField({ initial: "warp", label: "Природа" }),
      severity:    new StringField({ initial: "", label: "Тяжесть" }),
      god:         new StringField({ initial: "nurgle", label: "Бог" }),
      contagion:   new StringField({ initial: "", label: "Заразность" }),
      incubation:  new StringField({ initial: "", label: "Инкубация" }),
      symptoms:    new StringField({ initial: "", label: "Симптомы" }),
      vectors:     new StringField({ initial: "", label: "Пути передачи" }),
      // Те же пути передачи, но структурно: каждому — свой тест заражения T±N
      // (кнопка «Заражение» на болезни, combat/disease-infection.mjs). Текст
      // выше остаётся словом книги; пусто — книга Порога не даёт («на усмотрение
      // МИ», авто-заражение), заражает ГМ. Сверка с текстом —
      // test/data/disease-vectors-vs-book.test.mjs.
      vectorTests: new ArrayField(new SchemaField({
        label: new StringField({ initial: "", label: "Путь передачи" }),
        char:  new StringField({ initial: "t", label: "Характеристика теста" }),
        mod:   new NumberField({ initial: 0, integer: true, nullable: false, label: "Модификатор" })
      }), { label: "Тесты заражения" }),
      cure:        new StringField({ initial: "", label: "Лечение" }),
      active:      new BooleanField({ initial: false, label: "Действует" }),
      description: new HTMLField({ initial: "", label: "Описание" }),
      notes:       new HTMLField({ initial: "", label: "Заметки" }),
      bookSource:  new StringField({ initial: "", label: "Книга-источник" })
    };
  }
}
