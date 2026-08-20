// module/data/item/component.mjs
// ════════════════════════════════════════════════════════════════════════════
//  КОМПОНЕНТ КОРАБЛЯ — самый многочисленный тип пака (полтысячи записей).
//  Один тип покрывает три роли, у каждой свой блок:
//   - корпус (hull): запас Пространства, генерация Мощности, ходовые качества;
//   - надстройка (chars): плюсы к характеристикам корабля;
//   - орудие (weapon): батарея, лэнс, ангар.
//  Роль задаётся полем `kind`, лишние блоки просто остаются в нулях.
// ════════════════════════════════════════════════════════════════════════════

export class ComponentData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, HTMLField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    const num  = (initial, label) => new NumberField({ initial, nullable: false, label });
    const str  = (initial, label) => new StringField({ initial, label });
    const html = (initial, label) => new HTMLField({ initial, label });
    const list = label => new ArrayField(new ObjectField(), { label });
    return {
      kind:          str("supplemental", "Вид компонента"),
      power:         num(0, "Мощность"),
      space:         num(0, "Пространство"),
      sp:            num(0, "Стоимость (SP)"),
      rarity:        num(0, "Редкость"),
      quality:       str("common", "Качество"),
      qualityPicks:  list("Выбранные качества"),
      qualityCustom: new BooleanField({ initial: false, label: "Своё качество" }),
      hulls:         str("", "Корпуса"),
      aspects:       str("", "Аспекты"),
      description:   html("", "Описание"),
      notes:         html("", "Заметки"),
      essential:     new BooleanField({ initial: false, label: "Основной" }),
      external:      new BooleanField({ initial: false, label: "Внешний" }),
      damaged:       new BooleanField({ initial: false, label: "Повреждён" }),
      status:        str("intact", "Состояние"),
      lcBonus:       num(0, "Бонус Вместимости"),
      pcBonus:       num(0, "Бонус Мощности"),
      modChar:       str("", "Изменяемая характеристика"),
      modValue:      num(0, "Изменение характеристики"),
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
      }, { label: "Характеристики корабля" }),
      weapon: new SchemaField({
        wType:    str("macrobattery", "Тип орудия"),
        strength: num(0, "Сила"),
        damage:   str("", "Урон"),
        crit:     num(0, "Крит"),
        range:    num(0, "Дальность"),
        arc:      str("", "Сектор обстрела")
      }, { label: "Орудие" })
    };
  }
}
