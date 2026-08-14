// module/data/item/celestial-body.mjs
// ════════════════════════════════════════════════════════════════════════════
//  НЕБЕСНОЕ ТЕЛО — планета, звезда, станция или пояс в звёздной системе.
//  Лежит предметом в акторе starSystem, `parentId` связывает спутник с телом.
//
//  Что видит игрок, решают три флага: `signal` (есть отметка на карте),
//  `scouted` (разведано — видны общие данные) и `revealed` (раскрыты тайны).
//  Разбор — sheets/star-system-sheet.mjs и apps/systems-overview.mjs.
// ════════════════════════════════════════════════════════════════════════════

export class CelestialBodyData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    const num  = (initial, label) => new NumberField({ initial, nullable: false, label });
    const str  = label => new StringField({ initial: "", label });
    const bool = label => new BooleanField({ initial: false, label });
    const res  = label => num(0, label);
    return {
      description:        str("Описание"),
      notes:              str("Заметки"),
      bodyType:           new StringField({ initial: "planet", label: "Тип тела" }),
      zone:               str("Зона системы"),
      parentId:           str("Вращается вокруг"),
      starClass:          str("Класс звезды"),
      starGroup:          num(0, "Группа звезды"),
      exotic:             bool("Экзотическое"),
      bodySize:           str("Размер"),
      gravity:            str("Гравитация"),
      atmospherePresence: str("Наличие атмосферы"),
      atmosphereType:     str("Тип атмосферы"),
      climate:            str("Климат"),
      habitability:       str("Пригодность для жизни"),
      worldClass:         str("Класс мира"),
      worldEnv:           str("Среда мира"),
      tithe:              str("Десятина"),
      // Ресурсы, от которых мир освобождён — список ключей блока `resources`.
      titheExempt:        new ArrayField(new StringField(), { label: "Освобождён от десятины" }),
      orbitalFeatures:    str("Орбитальные особенности"),
      territories:        str("Территории"),
      government:         str("Правительство"),
      threat:             str("Угроза"),
      stationType:        str("Тип станции"),
      presence:           str("Присутствие"),
      allegiance:         str("Принадлежность"),
      xenosSpecies:       str("Ксеносы"),
      xenosCustom:        str("Ксеносы (своё)"),
      gmNotes:            str("Заметки ГМ"),
      signal:             bool("Сигнал на карте"),
      scouted:            bool("Разведано"),
      revealed:           bool("Тайны раскрыты"),
      dynasty:            str("Династия"),
      // Установленные экстрактиумы — список ключей ресурсов.
      extractiums:        new ArrayField(new StringField(), { label: "Экстрактиумы" }),
      defense: new SchemaField({
        weapons:  str("Орудия"),
        garrison: str("Гарнизон"),
        patrols:  str("Патрули"),
        strength: str("Сила обороны"),
        notes:    str("Заметки")
      }, { label: "Оборона" }),
      population: new SchemaField({
        species: str("Разумные"),
        size:    str("Численность"),
        notes:   str("Заметки")
      }, { label: "Население" }),
      improvements: new ArrayField(new ObjectField(), { label: "Улучшения" }),
      resources: new SchemaField({
        ore:         res("Руда"),
        promethium:  res("Прометий"),
        adamantium:  res("Адамантий"),
        phlogiston:  res("Флогистон"),
        organics:    res("Органика"),
        plasteel:    res("Пластил"),
        weapons:     res("Оружие"),
        tech:        res("Техника"),
        provisions:  res("Провизия"),
        manpower:    res("Рабочие руки"),
        archeotech:  res("Археотех"),
        xenotech:    res("Ксенотех"),
        heretek:     res("Еретех"),
        notes:       str("Заметки")
      }, { label: "Ресурсы" })
    };
  }
}
