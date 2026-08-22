// module/data/item/torpedo.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТОРПЕДА — боеголовка и система наведения; сколько штук в пусковой, хранит
//  сам предмет. Пусковая установка — отдельный компонент корабля.
// ════════════════════════════════════════════════════════════════════════════

export class TorpedoData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, NumberField } = foundry.data.fields;
    return {
      warhead:     new StringField({ initial: "plasma", label: "Боеголовка" }),
      navSystem:   new StringField({ initial: "standard", label: "Система наведения" }),
      quantity:    new NumberField({ initial: 0, nullable: false, label: "Количество" }),
      description: new HTMLField({ initial: "", label: "Описание" }),
      notes:       new HTMLField({ initial: "", label: "Заметки" })
    };
  }
}
