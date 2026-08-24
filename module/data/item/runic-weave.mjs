// module/data/item/runic-weave.mjs
// ════════════════════════════════════════════════════════════════════════════
//  РУНИЧЕСКАЯ ВЯЗЬ (корбук, книга «VI. МИСТИКА», стр. 433-434) — узор,
//  запирающий энергии Варпа, наносимый на броню/одежду/оружие/стены.
//  Крафтится Scholastic Lore (Occult): craftDiff/craftBank — сложность и
//  банк Успехов ИЗ КНИГИ для конкретной вязи (не общая таблица Крафта —
//  каждая вязь имеет собственную фиксированную стоимость).
//
//  На один предмет можно нанести не более двух вязей (одну изнутри, одну
//  снаружи) — installedOn/wornPosition; действует только ближайшая к телу,
//  см. module/rules/runic-weave.mjs (activeRunicWeaveId).
// ════════════════════════════════════════════════════════════════════════════

export class RunicWeaveData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, NumberField, BooleanField, ArrayField } = foundry.data.fields;
    return {
      description:  new HTMLField({ initial: "", label: "Описание" }),
      notes:        new HTMLField({ initial: "", label: "Заметки" }),
      availability: new NumberField({ initial: 0, integer: true, nullable: false, label: "Редкость (R)" }),
      craftDiff:    new NumberField({ initial: 0, integer: true, nullable: false, label: "Сложность крафта" }),
      craftBank:    new NumberField({ initial: 0, integer: true, nullable: false, label: "Банк Успехов" }),
      surface:      new StringField({ initial: "", label: "Наносится на" }),
      // Допустимые носители по тексту книги: "armor" (броня/одежда),
      // "weapon" (оружие), "vehicle" (бронетехника), "region" (стены/
      // помещение) — подсказка пикеру носителя, не жёсткая проверка.
      surfaceKinds: new ArrayField(new StringField(), { label: "Виды поверхности" }),
      // Какого рода носитель занят: "carrier" — предмет (броня/оружие) на
      // акторе (installedOn — id этого предмета на том же акторе, как у
      // armorMod), "vehicle" — сама вязь лежит embedded-предметом на акторе
      // техники (installedOn не используется), "region" — Region-документ на
      // сцене (installedOn — UUID Region, см. module/regions/runic-weave-zone.mjs).
      installedOnType: new StringField({ initial: "", label: "Тип носителя" }),
      installedOn:  new StringField({ initial: "", label: "Установлена на" }),
      // Прямое нанесение (на броню/оружие) решает, какая вязь ближе к телу,
      // положением (см. module/rules/runic-weave.mjs); держатель (Загадка
      // Маата и подобные — installedOn на armorMod с runicWeaveSlots>0)
      // решает ручным переключением этого флага свободным действием.
      wornPosition: new StringField({ initial: "", label: "Положение" }),
      active:       new BooleanField({ initial: false, label: "Активна (в держателе)" }),
      bookSource:   new StringField({ initial: "", label: "Книга-источник" })
    };
  }
}
