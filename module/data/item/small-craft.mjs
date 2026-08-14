// module/data/item/small-craft.mjs
// ════════════════════════════════════════════════════════════════════════════
//  МАЛОЕ СУДНО — эскадрилья истребителей, бомбардировщиков или десантных
//  катеров в ангаре корабля. `state` — где эскадрилья (в ангаре, в полёте),
//  `turnsOut` — сколько ходов она уже вне корабля.
// ════════════════════════════════════════════════════════════════════════════

export class SmallCraftData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, NumberField } = foundry.data.fields;
    const num = (initial, label) => new NumberField({ initial, nullable: false, label });
    const str = (initial, label) => new StringField({ initial, label });
    return {
      description:  str("", "Описание"),
      notes:        str("", "Заметки"),
      craftKind:    str("fighter", "Класс судна"),
      faction:      str("", "Фракция"),
      cr:           num(0, "Боевой рейтинг"),
      crAlt:        num(0, "Боевой рейтинг (альт.)"),
      spd:          num(0, "Скорость"),
      squadronSize: num(0, "Размер эскадрильи"),
      props:        str("", "Свойства"),
      rarity:       num(0, "Редкость"),
      qty:          num(1, "Количество"),
      state:        str("stored", "Где эскадрилья"),
      strength:     str("full", "Состав"),
      turnsOut:     num(0, "Ходов вне корабля"),
      role:         str("independent", "Роль")
    };
  }
}
