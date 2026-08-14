// module/data/item/tool.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ИНСТРУМЕНТ — снаряжение, дающее бонус к тестам (набор медика, ауспик и др.).
//  От gear отличается категорией и тем, что сбруи у него не бывает.
// ════════════════════════════════════════════════════════════════════════════

import { qualityEffectsField } from "./gear.mjs";

export class ToolData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField, ObjectField, ArrayField } = foundry.data.fields;
    return {
      description:  new StringField({ initial: "", label: "Описание" }),
      notes:        new StringField({ initial: "", label: "Заметки" }),
      quantity:     new NumberField({ initial: 1, integer: true, nullable: false, label: "Количество" }),
      weight:       new NumberField({ initial: 0, nullable: false, label: "Вес" }),
      availability: new NumberField({ initial: 0, integer: true, nullable: false, label: "Доступность" }),
      quality:      new StringField({ initial: "common", label: "Качество" }),
      toolCategory: new StringField({ initial: "general", label: "Категория" }),
      linkedWeapon: new StringField({ initial: "", label: "Связанное оружие" }),
      effect:       new StringField({ initial: "", label: "Эффект" }),
      reminder:     new StringField({ initial: "", label: "Напоминание" }),
      qualityEffects: qualityEffectsField(),
      bonuses:      new ArrayField(new ObjectField(), { label: "Бонусы" }),
      drukhari:     new BooleanField({ initial: false, label: "Друкхари" })
    };
  }
}
