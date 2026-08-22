// module/data/item/tool.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ИНСТРУМЕНТ — снаряжение, дающее бонус к тестам (набор медика, ауспик и др.).
//  От gear отличается категорией и тем, что сбруи у него не бывает.
// ════════════════════════════════════════════════════════════════════════════

import { qualityEffectsField } from "./gear.mjs";
import { infoguardField } from "./infoguard.mjs";

export class ToolData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, BooleanField, NumberField, ObjectField, ArrayField } = foundry.data.fields;
    return {
      description:  new HTMLField({ initial: "", label: "Описание" }),
      notes:        new HTMLField({ initial: "", label: "Заметки" }),
      infoguard:    infoguardField(),
      // Инструмент рисуется тем же gear.hbs, что и Снаряжение (wdbc-fl3).
      bookSource:   new StringField({ initial: "", label: "Книга-источник" }),
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
