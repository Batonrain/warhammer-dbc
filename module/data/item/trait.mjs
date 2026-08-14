// module/data/item/trait.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЧЕРТА — свойство существа из бестиария или расы (корбук, «Черты существ»).
//  Рейтинги (X) и (X/Y) хранятся отдельно от текста: Черта «Сверхъест. Сила (4)»
//  несёт rating 4, а не число внутри названия.
//
//  Поле `effects` — свободный объект, а не разобранная схема, и это осознанно:
//  оно доживает свой век. Механика Черт переезжает в ActiveEffect
//  (migrations/item-effects.mjs), и перечислять его ключи схемой
//  значило бы закреплять формат, который снимается. Свободный объект хранит их
//  ровно так же, как хранил template.json.
// ════════════════════════════════════════════════════════════════════════════

/** Умолчание `effects`: те же нули, что раздавал template.json. */
function emptyEffects() {
  return {
    charBonuses: [], charValueBonuses: [],
    armourAll: 0, fearRating: 0, sizeMod: 0, initMod: 0, speedMod: 0
  };
}

export class TraitData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField, ObjectField } = foundry.data.fields;
    return {
      description: new StringField({ initial: "", label: "Описание" }),
      notes:       new StringField({ initial: "", label: "Заметки" }),
      benefit:     new StringField({ initial: "", label: "Действие" }),
      source:      new StringField({ initial: "", label: "Откуда получена" }),
      bookSource:  new StringField({ initial: "", label: "Книга-источник" }),
      // Требование — в template.json объявлено не было, но поле лежит в данных
      // пака и читается пикером Черт (_openItemPicker в sheets/actor-sheet.mjs:
      // пикер общий для Талантов, Черт и Мутаций и подсвечивает невыполненное).
      requirement: new StringField({ initial: "", label: "Требование" }),
      hasRating:   new BooleanField({ initial: false, label: "Принимает рейтинг (X)" }),
      rating:      new NumberField({ initial: 0, integer: true, nullable: false, label: "Рейтинг" }),
      hasRating2:  new BooleanField({ initial: false, label: "Принимает второй рейтинг (X/Y)" }),
      rating2:     new NumberField({ initial: 0, integer: true, nullable: false, label: "Второй рейтинг" }),
      effects:     new ObjectField({ initial: emptyEffects, label: "Механика" })
    };
  }

  /**
   * Данные прошлого формата: одиночный бонус к Бонусу характеристики лежал
   * двумя полями (`charBonusStat` + `charBonusValue`), а поздние Черты пишут
   * тот же бонус списком `charBonuses`. Два пути чтения тянутся через весь
   * расчёт актора (documents/actor.mjs) и через перенос в ActiveEffect
   * (constants/effect-keys.mjs); миграция оставляет один — список.
   *
   * @override
   */
  static migrateData(source) {
    const fx = source?.effects;
    if (fx && typeof fx === "object") {
      const { charBonusStat, charBonusValue } = fx;
      if (charBonusStat && charBonusValue) {
        fx.charBonuses = [...(fx.charBonuses ?? []), { stat: charBonusStat, value: charBonusValue }];
      }
      delete fx.charBonusStat;
      delete fx.charBonusValue;
    }
    return source;
  }
}
