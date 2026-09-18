// module/data/actor/star-system.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЗВЁЗДНАЯ СИСТЕМА — контейнер: сами планеты, станции и пояса лежат в ней
//  предметами типа celestialBody. Здесь только общесистемное — сектор,
//  варп-маршруты, обитатели и что об этом известно игрокам.
// ════════════════════════════════════════════════════════════════════════════

/**
 * `warpRoutes` было свободным HTML-текстом ГМа. Стало структурными предметами
 * типа `warpRoute` (мировыми, не вложенными — module/apps/warp-route.mjs), но
 * старый текст мог нести реальные заметки ГМа, поэтому не выбрасывается, а
 * переезжает в `gmNotes` — тот же приём, что `migrateReactionsString`
 * (data/actor/_creature.mjs) для system.reactions.
 */
export function migrateWarpRoutesString(source) {
  if (typeof source?.warpRoutes === "string" && source.warpRoutes.trim()) {
    const note = `<p><b>Варп-маршруты (старое поле, до перехода на предметы «Маршрут»):</b></p>${source.warpRoutes}`;
    source.gmNotes = source.gmNotes ? `${source.gmNotes}${note}` : note;
  }
  delete source.warpRoutes;
  return source;
}

export class StarSystemData extends foundry.abstract.TypeDataModel {

  /** @override */
  static migrateData(source) {
    migrateWarpRoutesString(source);
    return super.migrateData(source);
  }

  /** @override */
  static defineSchema() {
    const { StringField, HTMLField, BooleanField, ObjectField, ArrayField } = foundry.data.fields;
    const str = label => new StringField({ initial: "", label });
    const html = label => new HTMLField({ initial: "", label });
    return {
      description:    html("Описание"),
      sector:         str("Сектор"),
      region:         str("Регион"),
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
