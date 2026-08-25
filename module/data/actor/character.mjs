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
        sleep:  num(0, "Сон")
      }, { label: "Потребности" }),
      helmetOff: new BooleanField({ initial: false, label: "Шлем снят" }),
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
      }, { label: "Гибернация (Дредноут)" })
    };
  }
}
