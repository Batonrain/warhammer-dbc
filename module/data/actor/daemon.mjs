// module/data/actor/daemon.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ДЕМОН — существо с общей «человеческой» механикой плюс своё: принадлежность
//  Богу, ранг, форма, Рейтинг Нестабильности и истинное имя (знание которого
//  даёт власть над демоном).
// ════════════════════════════════════════════════════════════════════════════

import { creatureSchema } from "./_creature.mjs";

export class DaemonData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField } = foundry.data.fields;
    return {
      ...creatureSchema(),
      // Демон еретичен по умолчанию, у остальных существ — «лоялист».
      alignment:         new StringField({ initial: "heretic", label: "Мировоззрение" }),
      allegiance:        new StringField({ initial: "undivided", label: "Принадлежность" }),
      rank:              new StringField({ initial: "lesser", label: "Ранг" }),
      form:              new StringField({ initial: "trueForm", label: "Форма" }),
      instabilityRating: new NumberField({ initial: 1, nullable: false, label: "Рейтинг Нестабильности" }),
      trueName:          new StringField({ initial: "", label: "Истинное имя" }),
      trueNameKnown:     new BooleanField({ initial: false, label: "Истинное имя известно" }),
      portfolio:         new StringField({ initial: "", label: "Сфера влияния" }),
      isDaemon:          new BooleanField({ initial: true, label: "Демон" })
    };
  }

  /**
   * @override — «псайкер ли» когда-то писалось списком по числу профилей
   * (isPsyker: [true, true]). Пустого списка не бывает, поэтому любое такое
   * значение было бы правдой: [false, false] сделал бы псайкером не-псайкера.
   */
  static migrateData(source) {
    if (Array.isArray(source?.isPsyker)) source.isPsyker = source.isPsyker.some(Boolean);
    return source;
  }
}
