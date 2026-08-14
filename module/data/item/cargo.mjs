// module/data/item/cargo.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ГРУЗ — товар в трюме: Вместимость (lc), редкость, происхождение и получатель.
//  `shipSupply` отделяет корабельные припасы от товара на продажу.
// ════════════════════════════════════════════════════════════════════════════

export class CargoData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField } = foundry.data.fields;
    const num  = (initial, label) => new NumberField({ initial, nullable: false, label });
    const bool = label => new BooleanField({ initial: false, label });
    return {
      cargoType:    new StringField({ initial: "minerals", label: "Вид груза" }),
      lc:           num(1, "Вместимость"),
      quantity:     num(1, "Количество"),
      quality:      new StringField({ initial: "common", label: "Качество" }),
      rarity:       num(0, "Редкость"),
      baseRarity:   new StringField({ initial: "", label: "Базовая редкость" }),
      shipSupply:   bool("Корабельные припасы"),
      rarityManual: bool("Редкость вручную"),
      xenos:        bool("Ксеносское"),
      astartes:     bool("Астартес"),
      inHold:       bool("В трюме"),
      price:        num(0, "Цена"),
      origin:       new StringField({ initial: "", label: "Происхождение" }),
      consignee:    new StringField({ initial: "", label: "Получатель" }),
      description:  new StringField({ initial: "", label: "Описание" }),
      // В template.json объявлено не было, но лежит у четырёх грузов пака —
      // лист предмета показывает «Заметки» всем типам.
      notes:        new StringField({ initial: "", label: "Заметки" })
    };
  }
}
