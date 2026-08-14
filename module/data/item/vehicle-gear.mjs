// module/data/item/vehicle-gear.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СНАРЯЖЕНИЕ ТЕХНИКИ — довесок к машине (дымовые гранаты, лебёдка, прожектор).
//  Механики у типа нет: правила лежат в описании, `active` только показывает,
//  включено ли устройство сейчас.
// ════════════════════════════════════════════════════════════════════════════

export class VehicleGearData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField } = foundry.data.fields;
    return {
      description:  new StringField({ initial: "", label: "Описание" }),
      notes:        new StringField({ initial: "", label: "Заметки" }),
      availability: new NumberField({ initial: 0, nullable: false, label: "Доступность" }),
      quality:      new StringField({ initial: "common", label: "Качество" }),
      active:       new BooleanField({ initial: true, label: "Включено" })
    };
  }
}
