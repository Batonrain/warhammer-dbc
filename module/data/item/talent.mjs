// module/data/item/talent.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАЛАНТ — покупается за опыт либо выдаётся генерацией. Цена зависит от
//  ступени и склонностей персонажа (constants/advancement.mjs), поэтому
//  хранится посчитанной: `cost` пересчитывает вкладка «Развитие» при смене
//  ★ (granted/purchased).
//
//  `effects` — свободный объект, как у Черты и по той же причине: механика
//  переезжает в ActiveEffect (migrations/item-effects.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { migrateCharBonusPair } from "./_legacy-char-bonus.mjs";

/** Умолчание `effects`: те же нули, что раздавал template.json. */
function emptyEffects() {
  return { initMod: 0, fearRating: 0, speedMod: 0 };
}

export class TalentData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField, ObjectField, ArrayField } = foundry.data.fields;
    return {
      description:    new StringField({ initial: "", label: "Описание" }),
      notes:          new StringField({ initial: "", label: "Заметки" }),
      benefit:        new StringField({ initial: "", label: "Действие" }),
      bookSource:     new StringField({ initial: "", label: "Книга-источник" }),
      tier:           new NumberField({ initial: 1, integer: true, nullable: false, label: "Ступень" }),
      requirement:    new StringField({ initial: "", label: "Требование" }),
      aptitudes:      new ArrayField(new StringField(), { label: "Склонности" }),
      // Откуда брать склонности, если они зависят от выбора (навык, оружие).
      aptSource:      new StringField({ initial: "", label: "Источник склонностей" }),
      aspirations:    new ArrayField(new StringField(), { label: "Устремления" }),
      god:            new StringField({ initial: "", label: "Бог" }),
      specialization: new StringField({ initial: "", label: "Специализация" }),
      cost:           new NumberField({ initial: 0, integer: true, nullable: false, label: "Цена в опыте" }),
      purchased:      new BooleanField({ initial: false, label: "Куплен" }),
      granted:        new BooleanField({ initial: false, label: "Выдан генерацией" }),
      effects:        new ObjectField({ initial: emptyEffects, label: "Механика" })
    };
  }

  /** @override — общий разбор пары charBonusStat/charBonusValue. */
  static migrateData(source) { return migrateCharBonusPair(source); }
}
