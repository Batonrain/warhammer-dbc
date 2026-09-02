// module/data/item/mutation.mjs
// ════════════════════════════════════════════════════════════════════════════
//  МУТАЦИЯ — след порчи: бросок по таблице своего бога, часто с требованием.
//  `effects` — свободный объект, как у Черты: механика переезжает в
//  ActiveEffect (migrations/item-effects.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { migrateCharBonusPair } from "./_legacy-char-bonus.mjs";

/** Умолчание `effects`: те же нули, что раздавал template.json. */
function emptyEffects() {
  return {
    charBonuses: [], charValueBonuses: [], armourAll: 0,
    fearRating: 0, sizeMod: 0, initMod: 0, speedMod: 0
  };
}

export class MutationData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, NumberField, ObjectField, SchemaField } = foundry.data.fields;
    return {
      description: new HTMLField({ initial: "", label: "Описание" }),
      notes:       new HTMLField({ initial: "", label: "Заметки" }),
      benefit:     new StringField({ initial: "", label: "Действие" }),
      source:      new StringField({ initial: "", label: "Откуда получена" }),
      bookSource:  new StringField({ initial: "", label: "Книга-источник" }),
      roll:        new StringField({ initial: "", label: "Бросок по таблице" }),
      god:         new StringField({ initial: "", label: "Бог" }),
      // В template.json объявлено не было, но лежит у трёх мутаций пака и
      // читается общим пикером Талантов, Черт и Мутаций — как у Черты.
      requirement: new StringField({ initial: "", label: "Требование" }),
      effects:     new ObjectField({ initial: emptyEffects, label: "Механика" }),
      // Выпавшая субмутация (стр. 440). Сама таблица субмутаций лежит в тексте
      // `benefit` и разбирается rules/submutations.mjs — здесь только результат
      // броска, чтобы у мутации на листе была ОДНА определённая строка.
      // Пустое `name` — «не определена».
      submutation: new SchemaField({
        name:  new StringField({ initial: "", label: "Субмутация" }),
        label: new StringField({ initial: "", label: "Строка таблицы" }),
        text:  new StringField({ initial: "", label: "Описание субмутации" }),
        god:   new StringField({ initial: "", label: "Цвет Бога" }),
        roll:  new NumberField({ initial: 0, integer: true, label: "Бросок d10" }),
        shift: new NumberField({ initial: 0, integer: true, label: "Сдвиг (⅓Inf.b)" }),
        total: new NumberField({ initial: 0, integer: true, label: "Итог броска" })
      }, { label: "Субмутация" }),
      // Трекер периодической Зависимости (мутация «Addiction», стр. 440-452;
      // wdbc-5inv) — момент последнего утоления по game.time.worldTime и
      // текст объекта зависимости (авто из submutation.name, если строка её
      // называет однозначно; иначе вписывается вручную — см. rules/addiction.mjs).
      // Поле есть у всех Мутаций (как submutation выше), используется только
      // теми, кто несёт capabilityKey "mutation.addiction".
      dependency: new SchemaField({
        substance:     new StringField({ initial: "", label: "Объект зависимости" }),
        lastSatisfied: new NumberField({ initial: null, nullable: true, integer: true, label: "Последнее утоление (worldTime)" })
      }, { label: "Зависимость" })
    };
  }

  /** @override — общий разбор пары charBonusStat/charBonusValue. */
  static migrateData(source) { return migrateCharBonusPair(source); }
}
