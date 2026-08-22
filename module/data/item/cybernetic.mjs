// module/data/item/cybernetic.mjs
// ════════════════════════════════════════════════════════════════════════════
//  КИБЕРНЕТИКА — простая замена части тела. Механику несут импланты (implant),
//  здесь только описание, качество и куда установлено.
// ════════════════════════════════════════════════════════════════════════════

export class CyberneticData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, NumberField } = foundry.data.fields;
    return {
      description:  new HTMLField({ initial: "", label: "Описание" }),
      notes:        new HTMLField({ initial: "", label: "Заметки" }),
      // Кибернетика рисуется тем же gear.hbs, что и Снаряжение (wdbc-fl3).
      bookSource:   new StringField({ initial: "", label: "Книга-источник" }),
      installed:    new StringField({ initial: "", label: "Куда установлено" }),
      linkedWeapon: new StringField({ initial: "", label: "Связанное оружие" }),
      quality:      new StringField({ initial: "common", label: "Качество" }),
      availability: new NumberField({ initial: 0, integer: true, nullable: false, label: "Доступность" }),
      weight:       new NumberField({ initial: 0, nullable: false, label: "Вес" })
    };
  }
}
