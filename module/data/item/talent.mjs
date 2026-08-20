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
    const { HTMLField, StringField, BooleanField, NumberField, ObjectField, ArrayField, SchemaField } = foundry.data.fields;
    return {
      description:    new HTMLField({ initial: "", label: "Описание" }),
      notes:          new HTMLField({ initial: "", label: "Заметки" }),
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
      // Уровень таланта, который берут несколько раз: Enemy (Враг) — 1-3, и
      // штраф считается за уровень. Пара hasRating/rating повторяет Черту
      // (data/item/trait.mjs): признак отдельно от значения, чтобы лист не
      // показывал поле там, где рейтинга не бывает.
      hasRating: new BooleanField({ initial: false, label: "Принимает уровень" }),
      rating:    new NumberField({ initial: 0, integer: true, nullable: false, label: "Уровень" }),
      // Против кого действует талант: Hatred, Peer, Enemy, Good Reputation.
      // Список, а не одна ссылка, потому что книга требует именно списка —
      // «Hatred (Dark Mechanicum, Adeptus Mechanicus, Vehicles)» это ОДИН
      // талант с тремя целями, и цели разной природы.
      //
      //   kind:"faction"   — фракция и всё, что ниже неё в дереве (ref = ключ
      //                      фракции, см. data/item/faction.mjs);
      //   kind:"actorType" — тип актора (value = "vehicle" и т.п.): техника
      //                      фракцией не является и деревом не описывается;
      //   kind:"all"       — «Все!», вариант Hatred без разбора.
      //
      // name/img — подпись и значок на момент выбора: лист показывает их, не
      // загружая предмет фракции. Тот же приём, что у драг-н-дропа в
      // Конструкторе (apps/mechanics.mjs, sourceName/sourceImg).
      targets: new ArrayField(new SchemaField({
        kind:  new StringField({ initial: "faction", label: "Вид цели" }),
        ref:   new StringField({ initial: "", label: "Ключ фракции" }),
        value: new StringField({ initial: "", label: "Тип актора" }),
        name:  new StringField({ initial: "", label: "Подпись" }),
        img:   new StringField({ initial: "", label: "Значок" })
      }), { label: "Цели" }),
      cost:           new NumberField({ initial: 0, integer: true, nullable: false, label: "Цена в опыте" }),
      purchased:      new BooleanField({ initial: false, label: "Куплен" }),
      granted:        new BooleanField({ initial: false, label: "Выдан генерацией" }),
      effects:        new ObjectField({ initial: emptyEffects, label: "Механика" })
    };
  }

  /** @override — общий разбор пары charBonusStat/charBonusValue. */
  static migrateData(source) { return migrateCharBonusPair(source); }
}
