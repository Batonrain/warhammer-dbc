// module/data/item/armor.mjs
// ════════════════════════════════════════════════════════════════════════════
//  БРОНЯ — AP по шести зонам плюс надстройки: режим поля друкхарийской брони,
//  история комплекта силовой брони (две записи, каждая со своими зонами).
//
//  propRatings и apSecond хранятся свободными: ключ там — свойство или зона
//  конкретного предмета, схемой их не перечислить.
// ════════════════════════════════════════════════════════════════════════════

export class ArmorData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    const num = (initial, label) => new NumberField({ initial, nullable: false, label });
    /** Запись истории комплекта: таблица, бросок и его последствия. */
    const historyEntry = () => ({
      table:  new StringField({ initial: "", label: "Таблица" }),
      key:    new StringField({ initial: "", label: "Ключ" }),
      roll:   num(0, "Бросок"),
      name:   new StringField({ initial: "", label: "Название" }),
      desc:   new StringField({ initial: "", label: "Описание" }),
      effect: new StringField({ initial: "", label: "Эффект" }),
      choice: new StringField({ initial: "", label: "Выбор" })
    });
    return {
      description:  new StringField({ initial: "", label: "Описание" }),
      notes:        new StringField({ initial: "", label: "Заметки" }),
      armorType:    new StringField({ initial: "simple", label: "Тип брони" }),
      stacks:       new BooleanField({ initial: false, label: "Складывается" }),
      maxAgility:   num(100, "Потолок Ловкости"),
      // Рейтинги свойств и второй профиль AP: ключи задаёт сам предмет.
      propRatings:  new ObjectField({ label: "Рейтинги свойств" }),
      apSecond:     new ObjectField({ label: "Второй профиль AP" }),
      equipped:     new BooleanField({ initial: false, label: "Надета" }),
      head:         num(0, "AP: голова"),
      body:         num(0, "AP: тело"),
      leftArm:      num(0, "AP: левая рука"),
      rightArm:     num(0, "AP: правая рука"),
      leftLeg:      num(0, "AP: левая нога"),
      rightLeg:     num(0, "AP: правая нога"),
      quality:      new StringField({ initial: "common", label: "Качество" }),
      availability: num(0, "Доступность"),
      weight:       num(0, "Вес"),
      properties:   new ArrayField(new ObjectField(), { label: "Свойства" }),
      strengthBonus: num(0, "Бонус Силы"),
      wpBonus:      num(0, "Бонус Силы Воли"),
      drukhari:     new BooleanField({ initial: false, label: "Друкхари" }),
      fieldMode:    new StringField({ initial: "", label: "Режим поля" }),
      history: new SchemaField({
        ...historyEntry(),
        // Зоны правит бросок «Уничтоженный и восстановленный»: ключ — локация.
        zones:  new ObjectField({ label: "Правки по зонам" }),
        second: new SchemaField(historyEntry(), { label: "Вторая запись" })
      }, { label: "История комплекта" }),
      // Текст особенностей комплекта — заполнен у 65 предметов пака, а в
      // template.json объявлен не был.
      special:      new StringField({ initial: "", label: "Особенности" }),
      // «Нейтрализует собственный вес в расчёте переносимого веса» (стр. 233,
      // Лёгкая Силовая Броня) — свойство КОНКРЕТНОЙ модели, а не всей силовой
      // брони: у корбука это единственное место, где вес надетой брони не
      // считается в Ношении. Раньше расчёт актора исключал весь armorType
      // power/aspect разом — Астартес в Мк II (280 кг) не платил за неё вовсе.
      weightless:   new BooleanField({ initial: false, label: "Не учитывается в весе Ношения" })
    };
  }
}
