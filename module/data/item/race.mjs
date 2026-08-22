// module/data/item/race.mjs
// ════════════════════════════════════════════════════════════════════════════
//  РАСА — происхождение персонажа: стартовые характеристики, текстовые пакеты
//  навыков и снаряжения, справка из книги. Расовые Черты здесь НЕ живут: их
//  выдаёт Конструктор Механики ссылками на библиотеку Черт, и второе описание
//  того же в схеме разъехалось бы с первым.
//
//  `chars` — не бонусы, а стартовые ЗНАЧЕНИЯ (25/30): применение кладёт их в
//  пустые поля характеристик и не трогает заполненные.
// ════════════════════════════════════════════════════════════════════════════

export class RaceData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, NumberField, BooleanField, ObjectField, ArrayField } = foundry.data.fields;
    return {
      key:         new StringField({ initial: "", label: "Ключ" }),
      // Группа задаёт и optgroup в списках, и признак аэльдари: набор рас
      // группы «Аэльдари» совпадает с прежней константой AELDARI_RACES.
      group:       new StringField({ initial: "", label: "Группа" }),
      chars:       new ObjectField({ label: "Стартовые характеристики" }),
      bonusRolls:  new NumberField({ initial: 0, integer: true, label: "Бонусные броски" }),
      skills:      new StringField({ initial: "", label: "Навыки" }),
      gear:        new StringField({ initial: "", label: "Снаряжение" }),
      talents:     new StringField({ initial: "", label: "Стартовые таланты" }),
      description: new HTMLField({ initial: "", label: "Описание" }),
      notes:       new HTMLField({ initial: "", label: "Заметки" }),
      hasGeneSeed: new BooleanField({ initial: false, label: "Геносемя" }),
      pastRaces:   new ArrayField(new StringField(), { label: "Возможное Прошлое" }),
      // Ниже — книжная справка: система по ней ничего не считает, но текст из
      // книги терять нельзя, поэтому он виден на листе расы.
      size:        new NumberField({ initial: 0, integer: true, label: "Размер" }),
      bonusPoints: new NumberField({ initial: 0, integer: true, label: "Очки распределения" }),
      charShift:   new NumberField({ initial: 0, integer: true, label: "Сдвиг характеристик" }),
      fateRoll:    new StringField({ initial: "", label: "Бросок Судьбы" }),
      skillsNote:  new StringField({ initial: "", label: "Примечание к навыкам" }),
      adaptations: new StringField({ initial: "", label: "Адаптации" }),
      bookSource:  new StringField({ initial: "", label: "Книга-источник" })
    };
  }
}
