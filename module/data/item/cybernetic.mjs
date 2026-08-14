// module/data/item/cybernetic.mjs
// ════════════════════════════════════════════════════════════════════════════
//  КИБЕРНЕТИКА — простая замена части тела. Механику несут импланты (implant),
//  здесь только описание, качество и куда установлено.
// ════════════════════════════════════════════════════════════════════════════

export class CyberneticData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, NumberField } = foundry.data.fields;
    return {
      description:  new StringField({ initial: "", label: "Описание" }),
      notes:        new StringField({ initial: "", label: "Заметки" }),
      installed:    new StringField({ initial: "", label: "Куда установлено" }),
      linkedWeapon: new StringField({ initial: "", label: "Связанное оружие" }),
      quality:      new StringField({ initial: "common", label: "Качество" }),
      availability: new NumberField({ initial: 0, integer: true, nullable: false, label: "Доступность" }),
      weight:       new NumberField({ initial: 0, nullable: false, label: "Вес" })
    };
  }
}
