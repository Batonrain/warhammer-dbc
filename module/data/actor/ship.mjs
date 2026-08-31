// module/data/actor/ship.mjs
// ════════════════════════════════════════════════════════════════════════════
//  КОРАБЛЬ — корпус, характеристики и экипаж; всё оборудование лежит
//  предметами типа component, а `hull`/`chars` здесь — уже сведённый итог,
//  который пересчитывает documents/actor.mjs по установленным компонентам.
//
//  `distortions` — журнал искажений Осквернения (по записи на бросок),
//  `officers` — ростер должностей с прикреплёнными персонажами.
// ════════════════════════════════════════════════════════════════════════════

export class ShipData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, HTMLField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    const num = (initial, label) => new NumberField({ initial, nullable: false, label });
    const str = (initial, label) => new StringField({ initial, label });
    return {
      shipType:         str("transport", "Тип"),
      shipRelation:     str("neutral", "Отношение"),
      voidShieldsDown:  new BooleanField({ initial: false, label: "Пустотные щиты сбиты" }),
      origin:           str("", "Происхождение"),
      captain:          str("", "Капитан"),
      influence:        num(0, "Влияние"),
      spMax:            num(0, "Очки корабля"),
      passengersAboard: num(0, "Пассажиров на борту"),
      // Припасы: 6 — полный запас, дальше убывает по одному за переход.
      supplies:         new SchemaField({ value: num(6, "Запас") }, { label: "Припасы" }),
      defilement:       num(0, "Осквернение"),
      crewIsChaos:      new BooleanField({ initial: false, label: "Экипаж служит Хаосу" }),
      distortions:      new ArrayField(new ObjectField(), { label: "Журнал искажений" }),
      hull: new SchemaField({
        spaceMax:       num(0, "Пространство"),
        powerGen:       num(0, "Генерация Мощности"),
        sp:             num(0, "Очки корабля"),
        turnArc:        str("90°", "Угол разворота"),
        weaponCapacity: str("", "Оружейные слоты")
      }, { label: "Корпус" }),
      chars: new SchemaField({
        speed:           num(0, "Скорость"),
        manoeuvrability: num(0, "Манёвренность"),
        detection:       num(0, "Обнаружение"),
        voidShields:     num(0, "Пустотные щиты"),
        armour:          num(0, "Броня"),
        turretRating:    num(0, "Рейтинг турелей")
      }, { label: "Характеристики" }),
      hullIntegrity: new SchemaField({
        value: num(0, "Текущая"), max: num(0, "Максимум")
      }, { label: "Прочность корпуса" }),
      crew: new SchemaField({
        population: num(100, "Численность"),
        morale:     num(100, "Мораль"),
        moraleMax:  num(100, "Максимум морали"),
        rating:     str("", "Выучка")
      }, { label: "Экипаж" }),
      officers: new ArrayField(new ObjectField(), { label: "Должности" }),
      notes:    new HTMLField({ initial: "", label: "Заметки" })
    };
  }

  /**
   * @override — свободная заметка «Класс корпуса» (shipClass) снята со схемы
   * (wdbc-zuf4). У кораблей живых миров текст ещё лежит в _source и при
   * первом же update() ушёл бы как неизвестный ключ — дописываем его в
   * Заметки, если его там ещё нет. Идемпотентно.
   */
  static migrateData(source) {
    const cls = String(source?.shipClass || "").trim();
    if (cls) {
      const notes = String(source.notes || "");
      if (!notes.includes(cls)) source.notes = `<p>Класс корпуса: ${cls}</p>${notes}`;
    }
    delete source?.shipClass;
    return source;
  }
}
