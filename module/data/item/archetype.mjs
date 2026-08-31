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
    const { HTMLField, StringField, BooleanField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    return {
      key:             new StringField({ initial: "", label: "Ключ" }),
      race:            new StringField({ initial: "", label: "Раса" }),
      group:           new StringField({ initial: "", label: "Группа" }),
      // Таблица доступа Друкхари/Сслит (Книга Аэльдари: Ответвления, wdbc-t9ei) —
      // раньше списки ключей в module/apps/archetypes.mjs (DRUKHARI_SUBRACE_
      // ARCHETYPES/SSLYTH_ARCHETYPES). "" в subraces — доступ Недорождённому
      // (у Друкхари субраса не выбрана). Значимо только для race:"drukhari".
      drukhariSubraces: new ArrayField(new StringField(), { initial: [], label: "Субрасы Друкхари с доступом" }),
      sslythAccess:    new BooleanField({ initial: false, label: "Доступен Сслит" }),
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
      description:     new HTMLField({ initial: "", label: "Описание" }),
      notes:           new HTMLField({ initial: "", label: "Заметки" }),
      trait: new SchemaField({
        name:    new StringField({ initial: "", label: "Название" }),
        benefit: new StringField({ initial: "", label: "Действие" })
      }, { label: "Черта архетипа" }),
      bookSource:      new StringField({ initial: "", label: "Книга-источник" })
    };
  }
}
