// module/data/item/navigator-power.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СИЛА НАВИГАТОРА — третий глаз: проверка Воли, часто встречная, иногда
//  поддерживаемая. Механики через `effects` у этого типа нет вовсе.
// ════════════════════════════════════════════════════════════════════════════

export class NavigatorPowerData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField } = foundry.data.fields;
    const num = (initial, label) => new NumberField({ initial, nullable: false, label });
    return {
      description: new StringField({ initial: "", label: "Описание" }),
      notes:       new StringField({ initial: "", label: "Заметки" }),
      xpCost:      num(0, "Стоимость в опыте"),
      requirement: new StringField({ initial: "", label: "Требование" }),
      action:      new StringField({ initial: "half", label: "Действие" }),
      sustainable: new BooleanField({ initial: false, label: "Поддерживаемая" }),
      isSustained: new BooleanField({ initial: false, label: "Поддерживается сейчас" }),
      testChar:    new StringField({ initial: "wp", label: "Характеристика проверки" }),
      testMod:     num(0, "Модификатор проверки"),
      opposed:     new BooleanField({ initial: false, label: "Встречная проверка" }),
      range:       new StringField({ initial: "", label: "Дальность" }),
      powerKind:   new StringField({ initial: "Концентрация, Ментальное", label: "Вид силы" }),
      damage:      new StringField({ initial: "", label: "Урон" }),
      damageType:  new StringField({ initial: "energy", label: "Тип урона" }),
      penetration: num(0, "Пробитие"),
      effect:      new StringField({ initial: "", label: "Эффект" })
    };
  }
}
