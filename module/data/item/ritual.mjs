// module/data/item/ritual.mjs
// ════════════════════════════════════════════════════════════════════════════
//  РИТУАЛ — запись из раздела Ритуалов (корбук стр. 393-425). Предмет несёт
//  числа проведения и прозу книги; сам бросок ведёт движок Завесы
//  (`module/constants/rituals.mjs`).
//
//  Два разных «типа» ритуала легко перепутать, поэтому здесь только один:
//  `ritualType` — КОНТЕНТНЫЙ раздел книги (RITUAL_ITEM_TYPES). Движковый тип,
//  от которого зависит вид Цены Ошибки при провале, живёт в RITUAL_TYPES и
//  предметом не хранится — его подставляет пресет проведения.
//
//  Поля теста (testSkillScope/testSkillKey/testSpecialty/testChar/testMod)
//  описывают путь проведения по умолчанию: каким Навыком и от какой
//  характеристики ритуал кидается. Ритуалист вправе выбрать другой путь —
//  остальные варианты остаются в пресетах, предмету хватает основного.
//
//  Требования к ритуалисту и к ассистентам полем НЕ хранятся: они
//  механические и лежат во флагах `warhammer-dbc.req` / `.assistReq`
//  (см. checkRequirements в `module/apps/mechanics.mjs`).
// ════════════════════════════════════════════════════════════════════════════

export class RitualData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, NumberField } = foundry.data.fields;
    const num = label => new NumberField({ initial: 0, integer: true, nullable: false, label });
    return {
      description:    new HTMLField({ initial: "", label: "Описание" }),
      notes:          new HTMLField({ initial: "", label: "Заметки" }),
      source:         new StringField({ initial: "", label: "Откуда получено" }),
      bookSource:     new StringField({ initial: "", label: "Книга-источник" }),

      ritualType:     new StringField({ initial: "summon", label: "Тип ритуала" }),
      record:         num("Запись"),
      assistMin:      num("Ассистентов минимум"),
      assistMax:      num("Ассистентов максимум"),

      // Проза книги. У ритуалов, разложенных из пресетов, поля пустые: в
      // пресетах прозы нет, она дописывается в packs-src по мере вычитки PDF.
      procedure:      new StringField({ initial: "", label: "Ритуал" }),
      result:         new StringField({ initial: "", label: "Результат" }),
      cost:           new StringField({ initial: "", label: "Цена" }),
      failureCost:    new StringField({ initial: "", label: "Цена ошибки" }),

      // Путь проведения по умолчанию.
      testSkillScope: new StringField({ initial: "", label: "Вид навыка теста" }),
      testSkillKey:   new StringField({ initial: "", label: "Навык теста" }),
      testSpecialty:  new StringField({ initial: "", label: "Специализация теста" }),
      testChar:       new StringField({ initial: "int", label: "Характеристика теста" }),
      // Модификатор теста бывает отрицательным — ритуалы книги идут и в минус.
      testMod:        num("Модификатор теста")
    };
  }
}
