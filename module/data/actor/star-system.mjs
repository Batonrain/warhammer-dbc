// module/data/actor/star-system.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЗВЁЗДНАЯ СИСТЕМА — контейнер: сами планеты, станции и пояса лежат в ней
//  предметами типа celestialBody. Здесь только общесистемное — сектор,
//  варп-маршруты, обитатели и что об этом известно игрокам.
// ════════════════════════════════════════════════════════════════════════════

export class StarSystemData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, HTMLField, BooleanField, ObjectField, ArrayField } = foundry.data.fields;
    const str = label => new StringField({ initial: "", label });
    const html = label => new HTMLField({ initial: "", label });
    return {
      description:    html("Описание"),
      sector:         str("Сектор"),
      region:         str("Регион"),
      warpRoutes:     html("Варп-маршруты"),
      dominantStar:   str("Главная звезда"),
      starConfig:     str("Конфигурация звёзд"),
      systemFeatures: new ArrayField(new StringField(), { label: "Особенности системы" }),
      inhabitants:    new ArrayField(new StringField(), { label: "Обитатели" }),
      xenosSpecies:   str("Ксеносы"),
      gmNotes:        html("Заметки ГМ"),
      journalUuid:    str("Журнал"),
      discovered:     new BooleanField({ initial: false, label: "Открыта" }),
      inProtectorate: new BooleanField({ initial: false, label: "В протекторате" }),
      // Сводка по телам системы: пересчитывается в prepareDerivedData каждый
      // цикл (documents/actor.mjs), хранится же с самого начала — лист читает
      // её до первого пересчёта.
      derived:        new ObjectField({ label: "Сводка" })
    };
  }
}
