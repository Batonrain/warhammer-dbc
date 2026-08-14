// module/data/item/disease.mjs
// ════════════════════════════════════════════════════════════════════════════
//  БОЛЕЗНЬ — варп-зараза или обычная хворь: заразность, инкубация, симптомы и
//  чем лечится. Работает, пока active.
// ════════════════════════════════════════════════════════════════════════════

export class DiseaseData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField } = foundry.data.fields;
    return {
      diseaseType: new StringField({ initial: "warp", label: "Природа" }),
      severity:    new StringField({ initial: "", label: "Тяжесть" }),
      god:         new StringField({ initial: "nurgle", label: "Бог" }),
      contagion:   new StringField({ initial: "", label: "Заразность" }),
      incubation:  new StringField({ initial: "", label: "Инкубация" }),
      symptoms:    new StringField({ initial: "", label: "Симптомы" }),
      vectors:     new StringField({ initial: "", label: "Пути передачи" }),
      cure:        new StringField({ initial: "", label: "Лечение" }),
      active:      new BooleanField({ initial: false, label: "Действует" }),
      description: new StringField({ initial: "", label: "Описание" }),
      notes:       new StringField({ initial: "", label: "Заметки" })
    };
  }
}
