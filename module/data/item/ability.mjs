// module/data/item/ability.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СПОСОБНОСТЬ — свободная запись «что персонаж умеет»: ни цены, ни рейтинга,
//  ни механики. Заводит её ГМ вручную, в паках таких предметов нет.
// ════════════════════════════════════════════════════════════════════════════

export class AbilityData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField } = foundry.data.fields;
    return {
      description: new StringField({ initial: "", label: "Описание" }),
      notes:       new StringField({ initial: "", label: "Заметки" }),
      benefit:     new StringField({ initial: "", label: "Действие" })
    };
  }
}
