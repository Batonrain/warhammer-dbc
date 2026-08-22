// module/data/item/tech-power.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТЕХНОЧУДО — сила техножреца: проверка навыка (обычно Техпользование),
//  расход Когнитивности и энергии, «скомпилированные» чудеса держатся сами.
// ════════════════════════════════════════════════════════════════════════════

/** Умолчание `effects`: те же нули, что раздавал template.json. */
function emptyEffects() {
  // Пара charBonusStat/charBonusValue — см. psychic-power.mjs: не заполнена
  // нигде, но её читает legacyEffectsToChanges, поэтому оставлена как была.
  return { charBonusStat: "", charBonusValue: 0, charBonuses: [] };
}

export class TechPowerData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, BooleanField, NumberField, ObjectField, ArrayField } = foundry.data.fields;
    const num  = (initial, label) => new NumberField({ initial, nullable: false, label });
    const list = label => new ArrayField(new ObjectField(), { label });
    return {
      description:   new HTMLField({ initial: "", label: "Описание" }),
      notes:         new HTMLField({ initial: "", label: "Заметки" }),
      discipline:    new StringField({ initial: "", label: "Дисциплина" }),
      subtype:       new StringField({ initial: "", label: "Подтип" }),
      miracleType:   new StringField({ initial: "imperative", label: "Тип чуда" }),
      extraTypes:    new ArrayField(new ObjectField(), { label: "Дополнительные типы" }),
      iron:          new StringField({ initial: "", label: "Железо" }),
      cost:          num(0, "Стоимость" ),
      rating:        num(1, "Рейтинг"),
      cognitionCost: num(1, "Расход Когнитивности"),
      energyCost:    num(0, "Расход энергии"),
      sustainCost:   num(0, "Стоимость поддержания"),
      sustainAction: new StringField({ initial: "free", label: "Действие поддержания" }),
      testSkill:     new StringField({ initial: "techUse", label: "Навык проверки" }),
      testMod:       num(0, "Модификатор проверки"),
      action:        new StringField({ initial: "full", label: "Действие" }),
      sustained:     new BooleanField({ initial: false, label: "Поддерживается сейчас" }),
      compiled:      new BooleanField({ initial: false, label: "Скомпилировано" }),
      range:         new StringField({ initial: "", label: "Дальность" }),
      damage:        new StringField({ initial: "", label: "Урон" }),
      damageType:    new StringField({ initial: "energy", label: "Тип урона" }),
      penetration:   num(0, "Пробитие"),
      // Свойства атаки Техночуда (тот же реестр, что у оружия и психосил, стр.
      // 166-170): раньше их негде было завести, и Экстремальный урон, Рвущее
      // и подобное для техночудес не считались вовсе — только текстом в «Эффекте».
      weaponProps:   list("Свойства атаки"),
      effect:        new StringField({ initial: "", label: "Эффект" }),
      effects:       new ObjectField({ initial: emptyEffects, label: "Механика" })
    };
  }
}
