// module/data/actor/character.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПЕРСОНАЖ — основной тип актора. Общая часть с Демоном вынесена в
//  _creature.mjs; здесь только своё:
//   - `granted`-поля в характеристиках и навыках (что выдано архетипом, а не
//     куплено за опыт) — их нет ни у Демона, ни у Принца;
//   - покровитель и его благосклонность по четырём Богам;
//   - гемункул (друкхари): ступень, вложения Плоти и Варпа;
//   - `vitals` — голод, жажда, сон;
//   - `helmetOff` — снятый шлем (правило отключаемое, см. combat/armor-mods.mjs);
//   - `sanity` — Здравомыслие пилота Дредноута (Книга Машин, стр. 57). Живёт у
//     Персонажа, а не в общей схеме существа (_creature.mjs): в саркофаг Дредноута
//     заключают только персонажей, не Демонов и не Принцев Демонов.
//   - `electrostim` — незавершённый буст Электростимуляторов Дредноута (там же,
//     стр. 58): хранит сумму до ручного отката.
//   - `hibernation` — пилот Дредноута в Гибернации (там же, стр. 57): основной
//     способ восстановить Здравомыслие, недельными бросками, пока флаг стоит.
//   - `sarcophagusInterred` — хирургическое заключение в Саркофаг (стр. 57):
//     необратимый факт «тело ампутировано под машину», не привязан к
//     конкретному Дредноуту и переживает отключение/смену станции — в
//     отличие от isDreadnoughtPilot (module/rules/dreadnought.mjs).
//   - `sarcophagusWarpWounds` — аблативные Раны саркофага ПРОТИВ ВАРП-ОРУЖИЯ
//     (стр. 57): отдельный от общего пула (system.wounds.ablative/ablativeMax,
//     wdbc-smy7) — тот поглощает любой урон, этот только warpSoak-урон.
// ════════════════════════════════════════════════════════════════════════════

import { creatureSchema, migrateReactionsString } from "./_creature.mjs";

export class CharacterData extends foundry.abstract.TypeDataModel {
  /** @override — строковые «Реакции» уезжают памяткой в notes (см. _creature.mjs). */
  static migrateData(source) { return migrateReactionsString(source); }


  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    const num = (initial, label) => new NumberField({ initial, nullable: false, label });
    const favor = label => num(0, label);
    return {
      ...creatureSchema({ granted: true }),
      bodyType:    new StringField({ initial: "male", label: "Телосложение" }),
      // Пусто = Бог не выбран. Умолчанием стоял "undivided", и требование
      // «Покровительство: Неделимый» проходило у любого, кто просто не трогал
      // выбор, — включая имперцев (wdbc-osz). Тему и сигил листа пустое
      // значение не ломает: там своя подстановка Неделимого.
      patronGod:   new StringField({ initial: "", label: "Покровитель" }),
      // Стереотип Покровительства (стр. 24) — определяет союзную/враждебные
      // Характеристики для цены Продвижения в режимах "patronage"/"mixed"
      // (constants/patronage.mjs, CHAR_STEREOTYPES). Пусто, пока не выбран.
      patronStereotype: new StringField({ initial: "", label: "Стереотип Покровителя" }),
      // Своя система цены Продвижения для ЭТОГО персонажа — переопределяет
      // мировую настройку advancePricingMode (Настройки листа). Пусто =
      // наследовать от мира (constants/patronage.mjs, effectivePricingMode()).
      pricingModeOverride: new StringField({ initial: "", label: "Своя система продвижения" }),
      patronFavor: new SchemaField({
        undivided: favor("Неделимый"),
        khorne:    favor("Кхорн"),
        nurgle:    favor("Нургл"),
        slaanesh:  favor("Слаанеш"),
        tzeentch:  favor("Тзинч")
      }, { label: "Благосклонность" }),
      haemonculus: new SchemaField({
        stage:      num(0, "Ступень"),
        flesh:      new ArrayField(new ObjectField(), { label: "Плоть" }),
        warp:       new ArrayField(new ObjectField(), { label: "Варп" }),
        splitPools: new BooleanField({ initial: false, label: "Раздельные запасы" }),
        notes:      new StringField({ initial: "", label: "Заметки" })
      }, { label: "Гемункул" }),
      vitals: new SchemaField({
        hunger: num(0, "Голод"),
        thirst: num(0, "Жажда"),
        sleep:  num(0, "Сон"),
        // Момент (game.time.worldTime) последнего «Поесть/Попить/Поспать» — null,
        // пока автопрогресс по времени (constants/vitals.mjs, wdbc-jnqj) ещё не
        // инициализирован для этого актора (без штрафа задним числом).
        lastFed:   new NumberField({ initial: null, nullable: true, label: "Наелся (время)" }),
        lastDrank: new NumberField({ initial: null, nullable: true, label: "Напился (время)" }),
        lastSlept: new NumberField({ initial: null, nullable: true, label: "Выспался (время)" })
      }, { label: "Потребности" }),
      helmetOff: new BooleanField({ initial: false, label: "Шлем снят" }),
      // Патрон-Демон-Принц (субраса «Наследник»: Трейт Помазанник(X) — races/
      // Наследник). uuid пуст, пока актор Принца не выбран или ещё не
      // существует — тогда name/godKey держат текстовую заглушку. rating —
      // резервная копия X на случай недоступности актора Принца; источник
      // истины — экземпляр дара «Помазанник» в system.dp.gifts самого Принца
      // (targetUuid === uuid этого актора), см. sheets/tabs/patron-panel.mjs.
      anointed: new SchemaField({
        uuid:   new StringField({ initial: "", label: "Демон-Принц" }),
        name:   new StringField({ initial: "", label: "Имя патрона" }),
        godKey: new StringField({ initial: "", label: "Бог патрона" }),
        rating: num(0, "Помазанник (X)")
      }, { label: "Помазанник" }),
      // Максимум и пороги — производные (module/documents/actor.mjs), value
      // и max начинаются с нуля: заключение в саркофаг — событие в игре, а не
      // при создании персонажа, и заполнять его в схеме нечем и незачем.
      sanity: new SchemaField({
        value: num(0, "Здравомыслие"),
        max:   num(0, "Максимум")
      }, { label: "Здравомыслие (Дредноут)" }),
      // Разовый буст Электростимуляторов (стр. 58) до ручного отката: таймера
      // в системе нет, сумму нужно помнить между кликами «Активировать»/«Откат».
      electrostim: new SchemaField({
        active: new BooleanField({ initial: false, label: "Буст активен" }),
        amount: num(0, "Сумма буста")
      }, { label: "Электростимуляторы (Дредноут)" }),
      hibernation: new SchemaField({
        active: new BooleanField({ initial: false, label: "В Гибернации" })
      }, { label: "Гибернация (Дредноут)" }),
      // Ставится один раз вручную (панель Дредноута) и не снимается сама —
      // это факт биографии персонажа, а не текущее состояние.
      sarcophagusInterred: new BooleanField({ initial: false, label: "Заключён в Саркофаг Дредноута" }),
      // max пересчитывается каждый рендер от W.b, пока актор пилот (module/
      // rules/character.mjs) — тем же приёмом, что sanity.max выше.
      sarcophagusWarpWounds: new SchemaField({
        value: num(0, "Аблативные против варп-оружия (текущие)"),
        max:   num(0, "Аблативные против варп-оружия (максимум)")
      }, { label: "Аблативные Раны — варп (Дредноут)" })
    };
  }
}
