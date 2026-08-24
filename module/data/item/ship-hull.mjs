// module/data/item/ship-hull.mjs
// ════════════════════════════════════════════════════════════════════════════
//  КОРПУС КОРАБЛЯ — отдельный тип предмета (не "component"/"узел"). Выбирается
//  через пикер в шапке листа корабля (sheets/hull-picker.mjs), как раса у
//  персонажа. На корабле всегда не больше одного — apps/ship-hull.mjs следит
//  за заменой при выборе нового.
//
//  hullClass — класс корпуса из Книги Пустоты ("Фрегаты", "Крейсеры", ...),
//  нужен только для группировки в пикере/компендиуме.
// ════════════════════════════════════════════════════════════════════════════

export class ShipHullData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, HTMLField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    const num  = (initial, label) => new NumberField({ initial, nullable: false, label });
    const str  = (initial, label) => new StringField({ initial, label });
    const html = (initial, label) => new HTMLField({ initial, label });
    const list = label => new ArrayField(new ObjectField(), { label });
    return {
      hullClass:     str("", "Класс корпуса"),
      sp:            num(0, "Стоимость (SP)"),
      rarity:        num(0, "Редкость"),
      quality:       str("common", "Качество"),
      qualityPicks:  list("Выбранные качества"),
      qualityCustom: new BooleanField({ initial: false, label: "Своё качество" }),
      aspects:       str("", "Аспекты"),
      description:   html("", "Описание"),
      notes:         html("", "Заметки"),
      shipProps:     list("Свойства"),
      hull: new SchemaField({
        spaceMax:       num(0, "Пространство корпуса"),
        powerGen:       num(0, "Генерация Мощности"),
        turnArc:        str("90°", "Угол разворота"),
        weaponCapacity: str("", "Оружейные слоты"),
        hullIntegrity:  num(0, "Прочность корпуса")
      }, { label: "Корпус" }),
      chars: new SchemaField({
        speed:           num(0, "Скорость"),
        manoeuvrability: num(0, "Манёвренность"),
        detection:       num(0, "Обнаружение"),
        voidShields:     num(0, "Пустотные щиты"),
        armour:          num(0, "Броня"),
        turretRating:    num(0, "Рейтинг турелей")
      }, { label: "Характеристики корабля" })
    };
  }
}
