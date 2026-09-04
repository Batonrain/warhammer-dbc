// module/data/item/ritual.mjs
// ════════════════════════════════════════════════════════════════════════════
//  РИТУАЛ — запись из раздела Ритуалов (корбук стр. 393-425). Предмет несёт
//  числа проведения и прозу книги; сам бросок ведёт движок Завесы
//  (`module/constants/rituals.mjs`).
//
//  Два разных «типа» ритуала легко перепутать:
//  `ritualType` — КОНТЕНТНЫЙ раздел книги (RITUAL_ITEM_TYPES): куда ритуал
//  подшит в компендиуме/на листе (Призыв/Круг/Проклятье/...).
//  `failureType` — ДВИЖКОВЫЙ тип (RITUAL_TYPES): какой вид Цены Ошибки при
//  провале (Отвращение Варпа/Феномен/Проклятье/ничего). Один контентный
//  раздел книги смешивает разные движковые типы (напр. «Призыв» содержит и
//  summon, и dominion, и gate), поэтому это отдельное поле, не производное.
//
//  Поля теста (testSkillScope/testSkillKey/testSpecialty/testChar/testMod)
//  описывают путь проведения по умолчанию: каким Навыком и от какой
//  характеристики ритуал кидается. Книга часто даёт несколько равноценных
//  путей («...тест на X −20 или Y −30 или Z −30...») — остальные лежат в
//  `rollPaths` (дополнительно к основному, не дублируя его), диалог
//  проведения (module/sheets/ritual-cast-dialog.mjs) даёт выбрать любой.
//
//  Требования к ритуалисту и к ассистентам полем НЕ хранятся: они
//  механические и лежат во флагах `warhammer-dbc.req` / `.assistReq`
//  (см. checkRequirements в `module/apps/mechanics.mjs`).
// ════════════════════════════════════════════════════════════════════════════

export class RitualData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, NumberField, ArrayField, SchemaField } = foundry.data.fields;
    const num = label => new NumberField({ initial: 0, integer: true, nullable: false, label });
    return {
      description:    new HTMLField({ initial: "", label: "Описание" }),
      notes:          new HTMLField({ initial: "", label: "Заметки" }),
      source:         new StringField({ initial: "", label: "Откуда получено" }),
      bookSource:     new StringField({ initial: "", label: "Книга-источник" }),

      ritualType:     new StringField({ initial: "summon", label: "Тип ритуала" }),
      // failureType — движковый тип (RITUAL_TYPES): summon/dominion/binding/
      // exorcism/curse/circle/gate/blessing/other. Пустое — не заполнено.
      failureType:    new StringField({ initial: "", label: "Тип провала" }),
      // «Запись (N)» из книжной строки «Требования:» — номер конкретной
      // ВАРИАЦИИ ритуала (стр. «Определение вариации», core.json: «нужно
      // накладывать именно ту же вариацию Записи»), НЕ игровой порог, который
      // должен набрать персонаж. У актора нет поля «Запись» вовсе — сравнивать
      // не с чем. Используется только офлайн-сверкой конвейера книги
      // (tools/ritual-reqs.mjs — подтверждает, что распознанный текст
      // требований достался своему, а не соседнему по развороту ритуалу) и в
      // игровой расчёт требований (checkRequirements, apps/mechanics.mjs) не
      // входит и не должно (см. wdbc-c63 — закрыт как недоразумение).
      record:         num("Запись"),
      assistMin:      num("Ассистентов минимум"),
      assistMax:      num("Ассистентов максимум"),
      // Модификатор Отвращения Варпа «+N за каждый Провал после первого»
      // (стр. 393-425: у большинства ритуалов +5, но встречаются +10/+20).
      aversionPerFail: new NumberField({ initial: 5, integer: true, nullable: false, label: "Отвращение/Провал" }),

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
      testMod:        num("Модификатор теста"),

      // Альтернативные пути проведения (стр. 393-425: «...тест на X (I) −20
      // или Y (W) −30 или Z (I) −30...») — ТОЛЬКО дополнительные к основному
      // пути (testSkillScope/Key/Specialty/Char/Mod выше); пусто — путь один.
      // scope: "group"|"plain" (см. templates/item/parts/ritual.hbs).
      rollPaths: new ArrayField(new SchemaField({
        scope:     new StringField({ initial: "group", label: "Вид навыка" }),
        key:       new StringField({ initial: "", label: "Навык" }),
        specialty: new StringField({ initial: "", label: "Специализация" }),
        char:      new StringField({ initial: "int", label: "Характеристика" }),
        mod:       num("Модификатор"),
        label:     new StringField({ initial: "", label: "Подпись (необязательно)" })
      }), { label: "Альтернативные пути проведения" }),

      // Ситуативные модификаторы, специфичные ЭТОМУ ритуалу (из его же прозы
      // Ритуал/Результат/Цена/Цена ошибки), поверх общих списков движка
      // (Модификаторы Призыва/Симпатия Проклятья) — не дублируют их, а
      // добавляются сверху в диалоге проведения.
      extraMods: new ArrayField(new SchemaField({
        label: new StringField({ initial: "", label: "Подпись" }),
        value: num("Модификатор")
      }), { label: "Доп. модификаторы ритуала" }),

      // Состояния (CONDITIONS_DEF, module/constants/conditions.mjs), которые
      // ЭТОТ ритуал накладывает при успехе — не применяются автоматически
      // (у ритуала часто нет фиксированной цели на листе): карточка в чате
      // (module/apps/ritual-cast.mjs) показывает их перетаскиваемыми
      // пилюлями, ГМ сам тащит на лист актора, который их получает.
      conditionsGranted: new ArrayField(new SchemaField({
        key:   new StringField({ initial: "", label: "Состояние (ключ CONDITIONS_DEF)" }),
        // Только для состояний со счётчиком (Оглушение, Ослепление и т.п.) —
        // фиксированное число из книги; 0 — уровень не задан книгой (ГМ сам
        // впишет на листе актора после переноса).
        level: num("Уровень"),
        note:  new StringField({ initial: "", label: "Примечание (напр. «на 1 час»)" })
      }), { label: "Накладываемые состояния" })
    };
  }
}
