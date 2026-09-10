// module/data/item/implant.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ИМПЛАНТ — орган Геносемени, кибернетика Механикум, вживлённая система.
//  Действует, только когда хирургически установлен и не повреждён: это флаги
//  документа (installed/disabled), а не поля схемы — см. apps/surgeon.mjs.
//
//  Поле `effects` — свободный объект, как и у Черты, и по той же причине: его
//  механика переезжает в ActiveEffect (migrations/item-effects.mjs), и
//  перечислять ключи схемой значило бы закреплять уходящий формат.
// ════════════════════════════════════════════════════════════════════════════

/** Умолчание `effects`: те же нули, что раздавал template.json. */
function emptyEffects() {
  return {
    charBonuses: [], charValueBonuses: [], armourAll: 0,
    apHead: 0, apBody: 0, apArms: 0, apLegs: 0,
    fearRating: 0, sizeMod: 0, initMod: 0, speedMod: 0
  };
}

import { migrateCharBonusPair } from "./_legacy-char-bonus.mjs";

/** {poor,common,good,best} — общая форма для энергоMax/Компенсатора: значение может зависеть от Качества. */
function qualityBonusField(label) {
  const { NumberField, SchemaField } = foundry.data.fields;
  const tier = () => new NumberField({ initial: 0, integer: true, nullable: false });
  return new SchemaField({ poor: tier(), common: tier(), good: tier(), best: tier() }, { label });
}

export class ImplantData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    return {
      description:   new HTMLField({ initial: "", label: "Описание" }),
      notes:         new HTMLField({ initial: "", label: "Заметки" }),
      category:      new StringField({ initial: "mechanicus", label: "Категория" }),
      quality:       new StringField({ initial: "common", label: "Качество" }),
      effect:        new StringField({ initial: "", label: "Эффект" }),
      installed:     new StringField({ initial: "", label: "Куда установлен" }),
      linkedWeapon:  new StringField({ initial: "", label: "Связанное оружие" }),
      bookSource:    new StringField({ initial: "", label: "Книга-источник" }),
      // Редкость (wdbc-ukpu, шаг 1б — решение владельца 07.09.2026): у Best.Q
      // биоимпланта каждый дополнительный эффект сверх первого поднимает её
      // на 1 (книга: «Редкость Best.Q-<импланта> повышается на 1 за каждый
      // дополнительный эффект»). Без этого поля «+1 к Редкости» было нечему
      // прибавлять — то же поле и тот же общий .availability-select
      // обработчик (item-sheet.mjs), что уже несёт weapon/armor/ammunition.
      // nullable/initial:null, а не 0 (wdbc-wc3): 0 — это КНИЖНОЕ значение
      // «Дефицит», а не «не заполнено». Книга даёт Доступность 79 биоимплантам
      // Друкхари (двум из них — ровно 0), а у остальных 224 имплантов —
      // кибернетики Механикум, органов Геносемени и прочих — её нет вовсе.
      // С initial:0 лист утверждал у них «0 Дефицит»: не книжное значение, а
      // заглушка, по которой игрок не должен ориентироваться при закупке.
      availability:  new NumberField({ initial: null, integer: true, nullable: true, label: "Доступность" }),
      effects:       new ObjectField({ initial: emptyEffects, label: "Механика" }),
      // Варианты бонусного эффекта качества Best.Q (wdbc-ukpu). Книга Аэльдари:
      // Ответвления, «АРСЕНАЛ ДРУКХАРИ»: Best.Q-биоимплант даёт один эффект на
      // выбор, каждый следующий поднимает Редкость на 1. До этого поля список
      // лежал сплошным текстом внутри system.effect — выбирать было не из
      // чего, и ни показать список, ни спросить выбор было нечем.
      //
      // Заполняется разбором того же текста (tools/bestq-implant-options.mjs),
      // а не руками: текст остаётся источником правды, поле — его структурой.
      bestQualityEffects: new ArrayField(new SchemaField({
        label: new StringField({ initial: "", label: "Название" }),
        note:  new StringField({ initial: "", label: "Пояснение" })
      }), { label: "Варианты эффекта Best.Q" }),
      // Итог выбора игрока (wdbc-ukpu, шаг 3): какие варианты bestQualityEffects
      // фактически взяты на ЭТОМ экземпляре — включая повторы одного и того же
      // варианта (книга у руки-хищника прямо разрешает взять один тип дважды,
      // правило распространено на весь Best.Q арсенал). Пусто — значит выбор
      // ещё не сделан; это же поле служит идемпотентностью диалога выбора
      // (apps/implant-bestq-choice.mjs::needsBestQChoice) — отдельного флага
      // "уже применено" не заводится, чтобы не разойтись с ним по смыслу
      // (см. диагностику migratedEffect в mechanics-skill).
      chosenEffects: new ArrayField(new SchemaField({
        label: new StringField({ initial: "", label: "Название" }),
        note:  new StringField({ initial: "", label: "Пояснение" })
      }), { label: "Выбранные эффекты Best.Q" }),
      // Директивы автоматизации Техночудес (Кибернетика Механикум). Раньше жили
      // ТОЛЬКО в таблице по имени (constants/implant-mechanics.mjs) — переименование
      // импланта в паке молча обнуляло Энергию/Компенсатор/Технофокус (wdbc-9bzv).
      // Таблица остаётся фоллбэком для немигрированных легаси-копий — см. character.mjs.
      energyMax:     qualityBonusField("Прибавка к максимуму Энергии по Качеству"),
      compensator:   qualityBonusField("Бонус к тесту Компенсатора по Качеству"),
      ironFocus:     new BooleanField({ initial: false, label: "Технофокус (Железо для Техночудес)" }),
      // Встроенное защитное поле (Рефрактор Механикум и т.п.) — та же механика,
      // что у отдельного forcefield, но включается вместе с имплантом.
      shield: new SchemaField({
        enabled:           new BooleanField({ initial: false, label: "Есть поле" }),
        shieldNature:      new StringField({ initial: "technological", label: "Природа" }),
        shieldType:        new StringField({ initial: "deflector", label: "Тип" }),
        ratingMin:         new NumberField({ initial: 1, integer: true, nullable: false, label: "Рейтинг от" }),
        ratingMax:         new NumberField({ initial: 10, integer: true, nullable: false, label: "Рейтинг до" }),
        overloadThreshold: new NumberField({ initial: 0, integer: true, nullable: false, label: "Порог перегрузки" }),
        isSpecialRating:   new BooleanField({ initial: false, label: "Особый рейтинг" }),
        currentRating:     new NumberField({ initial: 0, integer: true, nullable: false, label: "Текущий рейтинг" }),
        equipped:          new BooleanField({ initial: false, label: "Надето" }),
        status:            new StringField({ initial: "inactive", label: "Состояние" })
      }, { label: "Защитное поле" }),
      // Свойства встроенного оружия импланта — правятся на листе предмета
      // (item-sheet.mjs), а в template.json объявлены не были.
      weaponProps:   new ArrayField(new ObjectField(), { label: "Свойства встроенного оружия" })
    };
  }

  /** @override — общий разбор пары charBonusStat/charBonusValue. */
  static migrateData(source) { return migrateCharBonusPair(source); }
}
