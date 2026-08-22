// module/data/actor/vehicle.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТЕХНИКА — машина как актор: броня по трём проекциям (лоб, борт, корма),
//  Структура вместо ран, места экипажа (`stations`) и лестница состояний
//  повреждений (`damageStates`).
//
//  Черты техники лежат предметами типа vehicleTrait, их флаги сводит
//  documents/actor.mjs (_prepareVehicleData).
// ════════════════════════════════════════════════════════════════════════════

export class VehicleData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, HTMLField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    const num = (initial, label) => new NumberField({ initial, nullable: false, label });
    const str = (initial, label) => new StringField({ initial, label });
    return {
      vehicleClass:    str("", "Класс"),
      vehicleType:     str("tank", "Тип"),
      origin:          str("", "Происхождение"),
      commander:       str("", "Командир"),
      manoeuvrability: num(0, "Манёвренность"),
      operate:         num(0, "Управление"),
      size:            num(4, "Размер"),
      chassis: new SchemaField({
        type:            str("tracked", "Ходовая"),
        spd:             num(4, "SPD"),
        spdDamage:       num(0, "Урон SPD"),
        manoeuvreDamage: num(0, "Урон манёвренности"),
        strength:        num(0, "Сила"),
        unnaturalS:      num(0, "Сверхъестественная Сила")
      }, { label: "Ходовая часть" }),
      armour: new SchemaField({
        front: num(0, "Лоб"), side: num(0, "Борт"), rear: num(0, "Корма")
      }, { label: "Броня" }),
      structure: new SchemaField({
        value: num(0, "Текущая"), max: num(0, "Максимум"), critical: num(0, "Критические")
      }, { label: "Структура" }),
      ammoReloads:  num(10, "Боекомплект"),
      openTopped:   new BooleanField({ initial: false, label: "Открытый верх" }),
      traits:       str("", "Черты"),
      stations:     new ArrayField(new ObjectField(), { label: "Места экипажа" }),
      damageStates: new ArrayField(new ObjectField(), { label: "Состояния повреждений" }),
      notes:        new HTMLField({ initial: "", label: "Заметки" }),
      gmNotes:      new HTMLField({ initial: "", label: "Заметки ГМ" }),
      // Доступность машины: в template.json объявлена не была, но лежит у всех
      // 56 машин пака.
      availability: num(0, "Доступность")
    };
  }

  /**
   * @override — ростер экипажа когда-то лежал списком `crew`, теперь это
   * `stations` (место со своей ролью, занятое или пустое). Разбор был в листе
   * техники и требовал открыть машину; в схеме он срабатывает при загрузке.
   */
  static migrateData(source) {
    const old = source?.crew;
    if (Array.isArray(old) && old.length && !(source.stations?.length)) {
      source.stations = old.map(c => ({
        id: foundry.utils.randomID(), role: c.role || "passenger",
        uuid: c.uuid || "", name: c.name || "", img: c.img || ""
      }));
    }
    delete source?.crew;
    return source;
  }
}
