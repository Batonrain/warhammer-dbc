// module/data/item/homeworld.mjs
// ════════════════════════════════════════════════════════════════════════════
//  РОДНОЙ МИР — откуда персонаж родом: модификаторы характеристик, особенность
//  мира и его выборы при генерации.
//
//  Механика ведётся Конструктором (flags.warhammer-dbc.mechanics), а
//  `system.effects` — её копия прошлого формата: перенос в ActiveEffect её
//  намеренно не трогает, иначе бонусы удвоились бы (wdbc-43d). Поэтому
//  свободный объект, а не разобранная схема.
// ════════════════════════════════════════════════════════════════════════════

export class HomeworldData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, ObjectField, ArrayField } = foundry.data.fields;
    return {
      key:           new StringField({ initial: "", label: "Ключ" }),
      description:   new HTMLField({ initial: "", label: "Описание" }),
      notes:         new HTMLField({ initial: "", label: "Заметки" }),
      source:        new StringField({ initial: "", label: "Откуда получен" }),
      bookSource:    new StringField({ initial: "", label: "Книга-источник" }),
      featureName:   new StringField({ initial: "", label: "Особенность" }),
      featureDesc:   new StringField({ initial: "", label: "Описание особенности" }),
      charModLabel:  new StringField({ initial: "", label: "Модификаторы характеристик" }),
      // Ключ выбора задаёт сам мир (какую характеристику поднять и т.п.).
      choices:       new ObjectField({ label: "Выборы при генерации" }),
      friendlySpecs: new ArrayField(new StringField(), { label: "Дружественные специальности" }),
      effects:       new ObjectField({ initial: () => ({ charValueBonuses: [] }), label: "Механика" })
    };
  }
}
