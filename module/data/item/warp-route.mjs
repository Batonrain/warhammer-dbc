// module/data/item/warp-route.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ВАРП-МАРШРУТ (Книга Пустоты v.2, гл. «Варп-странствия», wdbc-r0w9).
//
//  Мировой предмет — НЕ вложен ни в одну Звёздную систему (в отличие от
//  celestial-body.mjs, где связь тела с системой 1:1). Маршрут соединяет
//  РОВНО две системы, поэтому связь 1:2 и хранится двумя ссылками по UUID
//  (systemAUuid/systemBUuid), тем же приёмом, что «Хозяин» у Миньонов
//  (system.masterUuid, data/actor/_creature.mjs) и «Помазанник» у
//  Демона-Принца (sheets/tabs/patron-panel.mjs) — однонаправленная ссылка,
//  резолвится живьём через fromUuid, без embedDocuments. Заполняются два
//  слота НЕЗАВИСИМО (module/apps/warp-route.mjs::attachRouteToSystem) — с
//  листа Системы (первый свободный слот) или с листа самого Маршрута (слот
//  выбирается явно, по образцу двух drop-зон).
//
//  Пять «книжных» признаков маршрута — каждый бьёт в свой бросок Navigation
//  (Warp) или в столкновения (см. описание тикета), каждый роллится по
//  таблице d10 (кроме Особенностей — d100, их может быть сколько угодно).
//  Точные таблицы переносятся отдельным шагом из обновлённого источника
//  книги; здесь — форма схемы под них (rating — номер по таблице, label —
//  подпись для карточки броска).
//
//  НЕ путать `lore` (Изученность маршрута — общее свойство самого маршрута,
//  одно из пяти признаков) со знанием КОНКРЕТНОГО Проводника о нём — то
//  живёт на акторе Проводника (`system.knownRoutes`, data/actor/_creature.mjs),
//  потому что у одного маршрута Знание разное у разных Проводников.
// ════════════════════════════════════════════════════════════════════════════

export class WarpRouteData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, HTMLField, NumberField, BooleanField, SchemaField, ArrayField } = foundry.data.fields;
    const str  = label => new StringField({ initial: "", label });
    const html = label => new HTMLField({ initial: "", label });
    const num  = (initial, label) => new NumberField({ initial, nullable: false, label });
    const bool = (initial, label) => new BooleanField({ initial, label });
    // Признак-таблица d10: номер броска + подпись результата.
    const trait = label => new SchemaField({
      rating: num(0, `${label} (номер по таблице)`),
      label:  str(`${label} (подпись)`)
    }, { label });

    return {
      description: html("Описание"),
      gmNotes:     html("Заметки ГМ"),

      // Две связанные Звёздные системы (мировые акторы starSystem). Слот
      // может быть пуст (маршрут проложен, но второй конец пока не известен).
      systemAUuid: str("Система А"),
      systemBUuid: str("Система Б"),

      // Признаки (стр. «Создание варп-маршрута»):
      category:     trait("Категория"),      // бывшая «Стабильность маршрута» — множитель длительности
      routeType:    trait("Тип"),
      lore:         trait("Изученность"),     // общая изученность маршрута, не знание конкретного Проводника
      illumination: trait("Освещённость"),
      stability:    trait("Стабильность"),    // модификатор Варп-столкновений

      // Особенности — d100, сколько угодно записей, каждая со своим эффектом.
      features: new ArrayField(new SchemaField({
        roll:   num(0, "Бросок d100"),
        name:   str("Название"),
        effect: str("Эффект")
      }), { label: "Особенности" }),

      // Прокладка нового маршрута (раздел «Прокладка новых маршрутов»,
      // wdbc-r0w9.1) — очки копятся ЗА НЕСКОЛЬКО отдельных странствий, поэтому
      // живут на самом предмете, а не в одноразовом состоянии окна «Навигация»
      // (module/apps/veil.mjs::journey сбрасывается каждым «сброс»).
      // threshold фиксируется при первом рейсе (module/rules/warp-route-
      // charting.mjs::plottingThresholdFor) и не пересчитывается заново —
      // «При повторном прохождении Проводник добирает НЕДОСТАЮЩИЕ очки».
      plotting: new SchemaField({
        active:    bool(false, "В процессе прокладки"),
        points:    num(0, "Накоплено Очков Маршрута"),
        threshold: num(0, "Порог Очков Маршрута"),
        attempts:  num(0, "Завершённых рейсов прокладки"),
        complete:  bool(false, "Проложен")
      }, { label: "Прокладка" })
    };
  }
}
