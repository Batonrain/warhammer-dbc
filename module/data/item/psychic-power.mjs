// module/data/item/psychic-power.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПСИХОСИЛА — бросок Психической Дисциплины, стоимость в ПР, поддержание.
//  Атакующая сила несёт ещё и профиль оружия (урон, пробитие, свойства).
//
//  `effects` — свободный объект, как у Черты и Таланта: механика поддерживаемой
//  силы переезжает в ActiveEffect (migrations/item-effects.mjs), а усиление
//  оружия (weaponBuff) читает combat/weapon-mods.mjs.
// ════════════════════════════════════════════════════════════════════════════

/** Умолчание `effects`: те же нули, что раздавал template.json. */
function emptyEffects() {
  return {
    // Пара charBonusStat/charBonusValue у сил не заполнена ни в одном предмете
    // пака и на лист не выведена, но её всё ещё читает legacyEffectsToChanges —
    // оставлена как была, чтобы перевод типа ничего не менял в механике.
    charBonusStat: "", charBonusValue: 0, charBonuses: [],
    armourAll: 0, fearRating: 0, sizeMod: 0, grantedTraits: "",
    weaponBuff: {
      enabled: false, scope: "equipped",
      damageMod: 0, penMod: 0, rangeMod: 0, addProps: []
    }
  };
}

export class PsychicPowerData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField, ObjectField, ArrayField } = foundry.data.fields;
    const num  = (initial, label) => new NumberField({ initial, nullable: false, label });
    const list = label => new ArrayField(new ObjectField(), { label });
    return {
      description:   new StringField({ initial: "", label: "Описание" }),
      notes:         new StringField({ initial: "", label: "Заметки" }),
      cost:          num(0, "Стоимость в ПР"),
      discipline:    new StringField({ initial: "", label: "Дисциплина" }),
      subtype:       new StringField({ initial: "", label: "Подтип" }),
      powerType:     new StringField({ initial: "attack", label: "Тип силы" }),
      extraTypes:    list("Дополнительные типы"),
      shootSubtype:  new StringField({ initial: "", label: "Подтип стрельбы" }),
      prRequired:    num(1, "Требуемый ПР"),
      testChar:      new StringField({ initial: "wp", label: "Характеристика проверки" }),
      testMod:       num(0, "Модификатор проверки"),
      action:        new StringField({ initial: "half", label: "Действие" }),
      // Дальность — строка: в книге это и «10 м», и «Бонус Воли × 5 м».
      range:         new StringField({ initial: "", label: "Дальность" }),
      sustainable:   new BooleanField({ initial: false, label: "Поддерживаемая" }),
      sustainCost:   num(1, "Стоимость поддержания"),
      sustainAction: new StringField({ initial: "free", label: "Действие поддержания" }),
      damage:        new StringField({ initial: "", label: "Урон" }),
      damageType:    new StringField({ initial: "energy", label: "Тип урона" }),
      penetration:   num(0, "Пробитие"),
      weaponProps:   list("Свойства оружия"),
      charDamageStat:    new StringField({ initial: "", label: "Урон по характеристике" }),
      charDamageFormula: new StringField({ initial: "", label: "Формула урона по характеристике" }),
      profiles:      list("Дополнительные профили"),
      variants:      list("Вариации броска"),
      effect:        new StringField({ initial: "", label: "Эффект" }),
      isSustained:   new BooleanField({ initial: false, label: "Поддерживается сейчас" }),
      effects:       new ObjectField({ initial: emptyEffects, label: "Механика" })
    };
  }
}
