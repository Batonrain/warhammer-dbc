// module/data/item/gear.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СНАРЯЖЕНИЕ — всё носимое, что не оружие, не броня и не инструмент.
//  Отдельная ветка — «сбруя» (isRig): разгрузка с ячейками под оружие и
//  маг-замками, её описывает вложенная схема rig.
// ════════════════════════════════════════════════════════════════════════════

/** Подсказки по качеству предмета: три текста, по одному на ступень. */
export function qualityEffectsField() {
  const { StringField, SchemaField } = foundry.data.fields;
  return new SchemaField({
    poor: new StringField({ initial: "", label: "Низкое" }),
    good: new StringField({ initial: "", label: "Хорошее" }),
    best: new StringField({ initial: "", label: "Лучшее" })
  }, { label: "Эффекты качества" });
}

import { infoguardField } from "./infoguard.mjs";

export class GearData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    return {
      description:  new StringField({ initial: "", label: "Описание" }),
      notes:        new StringField({ initial: "", label: "Заметки" }),
      infoguard:    infoguardField(),
      quantity:     new NumberField({ initial: 1, integer: true, nullable: false, label: "Количество" }),
      weight:       new NumberField({ initial: 0, nullable: false, label: "Вес" }),
      availability: new NumberField({ initial: 0, integer: true, nullable: false, label: "Доступность" }),
      quality:      new StringField({ initial: "common", label: "Качество" }),
      gearCategory: new StringField({ initial: "misc", label: "Категория" }),
      linkedWeapon: new StringField({ initial: "", label: "Связанное оружие" }),
      worn:         new StringField({ initial: "", label: "Как носится" }),
      effect:       new StringField({ initial: "", label: "Эффект" }),
      reminder:     new StringField({ initial: "", label: "Напоминание" }),
      qualityEffects: qualityEffectsField(),
      isRig:        new BooleanField({ initial: false, label: "Сбруя" }),
      rig: new SchemaField({
        comfort:  new StringField({ initial: "normal", label: "Удобство" }),
        backSlot: new BooleanField({ initial: false, label: "Заспинная ячейка" }),
        slots:    new ArrayField(new ObjectField(), { label: "Ячейки" }),
        magLocks: new ArrayField(new ObjectField(), { label: "Маг-замки" })
      }, { label: "Сбруя" }),
      itemSize:     new StringField({ initial: "", label: "Размер" }),
      bonuses:      new ArrayField(new ObjectField(), { label: "Бонусы" }),
      drukhari:     new BooleanField({ initial: false, label: "Друкхари" }),
      bookSource:   new StringField({ initial: "", label: "Книга-источник" }),
      // В template.json объявлено не было, но лежит у 20 предметов пака — след
      // раскладки по папкам компендиума при импорте. Кодом не читается;
      // объявлено, чтобы правка предмета в игре его не стирала.
      folderPath:   new ArrayField(new StringField(), { label: "Путь папки при импорте" })
    };
  }
}
