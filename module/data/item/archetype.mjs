// module/data/item/archetype.mjs
// ════════════════════════════════════════════════════════════════════════════
//  АРХЕТИП — роль персонажа: бонусы характеристик, стартовые навыки, таланты и
//  снаряжение. Читают мастер создания (apps/creation) и пикер элитных
//  архетипов. Текстовые поля (skills/talents/gear) намеренно строки: мастер
//  разбирает их сам, формат описан там же.
// ════════════════════════════════════════════════════════════════════════════

export class ArchetypeData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, ObjectField, SchemaField } = foundry.data.fields;
    return {
      key:             new StringField({ initial: "", label: "Ключ" }),
      race:            new StringField({ initial: "", label: "Раса" }),
      group:           new StringField({ initial: "", label: "Группа" }),
      // Ключ — характеристика, значение — прибавка; набор задаёт сам архетип.
      charBonus:       new ObjectField({ label: "Бонусы характеристик" }),
      charChoice:      new StringField({ initial: "", label: "Выбор характеристики" }),
      skills:          new StringField({ initial: "", label: "Навыки" }),
      talents:         new StringField({ initial: "", label: "Таланты" }),
      gear:            new StringField({ initial: "", label: "Снаряжение" }),
      wounds:          new StringField({ initial: "", label: "Раны" }),
      infRoll:         new StringField({ initial: "", label: "Бросок Влияния" }),
      requiredPath:    new StringField({ initial: "", label: "Требуемый путь" }),
      isPsyker:        new BooleanField({ initial: false, label: "Псайкер" }),
      isTechpriest:    new BooleanField({ initial: false, label: "Техножрец" }),
      psykerClass:     new StringField({ initial: "", label: "Класс псайкера" }),
      grantsWarPlate:  new BooleanField({ initial: false, label: "Выдаёт силовую броню" }),
      grantsImplants:  new BooleanField({ initial: false, label: "Выдаёт импланты" }),
      description:     new StringField({ initial: "", label: "Описание" }),
      notes:           new StringField({ initial: "", label: "Заметки" }),
      trait: new SchemaField({
        name:    new StringField({ initial: "", label: "Название" }),
        benefit: new StringField({ initial: "", label: "Действие" })
      }, { label: "Черта архетипа" }),
      bookSource:      new StringField({ initial: "", label: "Книга-источник" })
    };
  }
}
