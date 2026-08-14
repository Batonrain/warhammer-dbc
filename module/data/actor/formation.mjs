// module/data/actor/formation.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ФОРМИРОВАНИЕ — войсковая часть в массовом бою: Численность и Мораль вместо
//  ран, укрытие, приказ и набор состояний боя (окружено, бежит, вымотано).
//  `attached` — приданные части, `posts.commander` — кто ею командует.
// ════════════════════════════════════════════════════════════════════════════

export class FormationData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    const num  = (initial, label) => new NumberField({ initial, nullable: false, label });
    const str  = (initial, label) => new StringField({ initial, label });
    const bool = label => new BooleanField({ initial: false, label });
    return {
      troopType:        str("mediumInfantry", "Род войск"),
      size:             str("battalion", "Размер"),
      techLevel:        str("advanced", "Технический уровень"),
      training:         str("tithe", "Подготовка"),
      gearQuality:      str("standard", "Качество снаряжения"),
      terrain:          str("open", "Местность"),
      homeworld:        str("", "Родной мир"),
      allegiance:       str("", "Принадлежность"),
      commanderName:    str("", "Командир"),
      headcount:        num(0, "Личный состав"),
      astartes:         bool("Астартес"),
      strengthMod:      num(0, "Модификатор Силы"),
      strengthOverride: str("", "Сила вручную"),
      speedOverride:    str("", "Скорость вручную"),
      numbers: new SchemaField({
        value: num(0, "Текущая"), max: num(0, "Максимум")
      }, { label: "Численность" }),
      morale: new SchemaField({
        value: num(0, "Текущая"), max: num(0, "Максимум"), gearRoll: num(0, "Бросок снаряжения")
      }, { label: "Мораль" }),
      cover: new SchemaField({
        dugIn: num(0, "Окопано"), aa: num(0, "ПВО"), mod: num(0, "Модификатор")
      }, { label: "Укрытие" }),
      order: new SchemaField({
        key: str("", "Приказ"), note: str("", "Пометка")
      }, { label: "Приказ" }),
      status: new SchemaField({
        surprised:     bool("Застигнуто врасплох"),
        engaged:       bool("В бою"),
        fled:          bool("Бежит"),
        exhausted:     bool("Вымотано"),
        disorder:      num(0, "Расстройство"),
        flankRounds:   num(0, "Ходов во фланге"),
        feintRounds:   num(0, "Ходов ложной атаки"),
        reconRounds:   num(0, "Ходов разведки"),
        keyEventBonus: bool("Бонус ключевого события")
      }, { label: "Состояние" }),
      posts: new SchemaField({
        commander: new SchemaField({
          uuid: str("", "Персонаж"), name: str("", "Имя"), img: str("", "Портрет")
        }, { label: "Командир" })
      }, { label: "Посты" }),
      attached:      new ArrayField(new ObjectField(), { label: "Приданные части" }),
      initiativeMod: num(0, "Модификатор Инициативы"),
      notes:         str("", "Заметки"),
      gmNotes:       str("", "Заметки ГМ")
    };
  }
}
