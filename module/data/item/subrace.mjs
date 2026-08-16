// module/data/item/subrace.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СУБРАСА — ветвь расы: стоит опыта, меняет характеристики, добавляет свои
//  Черты и иногда ОТМЕНЯЕТ расовые (субрасы друкхари). Привязка к родителю —
//  поле `parentKey` с ключом расы: субрасу нельзя выдать чужой расе. Имя НЕ
//  `parent` — так называется собственное свойство DataModel (документ-
//  владелец), и поле схемы с таким именем до кода не доходит вовсе.
//
//  Черты, как и у расы, живут в Конструкторе Механики, а не в схеме.
// ════════════════════════════════════════════════════════════════════════════

export class SubraceData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, NumberField, ObjectField, ArrayField } = foundry.data.fields;
    return {
      key:           new StringField({ initial: "", label: "Ключ" }),
      parentKey:     new StringField({ initial: "", label: "Раса-родитель" }),
      cost:          new NumberField({ initial: 0, integer: true, label: "Стоимость в опыте" }),
      effect:        new StringField({ initial: "", label: "Действие" }),
      god:           new StringField({ initial: "", label: "Бог" }),
      charMods:      new ObjectField({ label: "Изменения характеристик" }),
      talents:       new StringField({ initial: "", label: "Стартовые таланты" }),
      // Имена расовых Черт, которые субраса снимает.
      removesTraits: new ArrayField(new StringField(), { label: "Снимает Черты" }),
      description:   new StringField({ initial: "", label: "Описание" }),
      notes:         new StringField({ initial: "", label: "Заметки" }),
      bookSource:    new StringField({ initial: "", label: "Книга-источник" })
    };
  }
}
