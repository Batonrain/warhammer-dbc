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

export class ImplantData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    return {
      description:   new StringField({ initial: "", label: "Описание" }),
      notes:         new StringField({ initial: "", label: "Заметки" }),
      category:      new StringField({ initial: "mechanicus", label: "Категория" }),
      quality:       new StringField({ initial: "common", label: "Качество" }),
      effect:        new StringField({ initial: "", label: "Эффект" }),
      installed:     new StringField({ initial: "", label: "Куда установлен" }),
      geneSeedOrder: new NumberField({ initial: 0, integer: true, nullable: false, label: "Порядок вживления" }),
      linkedWeapon:  new StringField({ initial: "", label: "Связанное оружие" }),
      bookSource:    new StringField({ initial: "", label: "Книга-источник" }),
      effects:       new ObjectField({ initial: emptyEffects, label: "Механика" }),
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
