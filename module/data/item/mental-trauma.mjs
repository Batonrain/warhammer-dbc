// module/data/item/mental-trauma.mjs
// ════════════════════════════════════════════════════════════════════════════
//  МЕНТАЛЬНАЯ ТРАВМА (корбук, стр. 473) — след проваленного теста Травмы.
//
//  Раньше провал просто падал в чат и бесследно исчезал: «активной Травмы» в
//  системе не существовало, и подавлять было нечего. Теперь провал заводит
//  запись, а «Подавление Травмы» на вкладке Показатели знает, что тестировать.
//
//  Поля те же, что у Расстройства (data/item/mental-disorder.mjs), и тест обоим
//  катает одна функция — rollDisorderTest в sheets/tabs/disorders.mjs. Разница
//  только в источнике: у Травмы своего модификатора теста в таблице нет, всегда
//  W+0, поэтому testMod при заведении остаётся нулём.
// ════════════════════════════════════════════════════════════════════════════

export class MentalTraumaData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, NumberField } = foundry.data.fields;
    return {
      description: new StringField({ initial: "", label: "Описание" }),
      notes:       new StringField({ initial: "", label: "Заметки" }),
      testChar:    new StringField({ initial: "wp", label: "Характеристика теста" }),
      testMod:     new NumberField({ initial: 0, integer: true, nullable: false, label: "Модификатор теста" })
    };
  }
}
