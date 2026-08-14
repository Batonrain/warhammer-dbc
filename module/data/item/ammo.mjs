// module/data/item/ammo.mjs
// ════════════════════════════════════════════════════════════════════════════
//  БОЕПРИПАС — правит профиль оружия, в которое заряжен (combat/attack.mjs
//  берёт его через weapon.system.loadedAmmoId). Подходящие типы оружия
//  перечислены в weaponTypes.
// ════════════════════════════════════════════════════════════════════════════

export class AmmoData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField, ObjectField, ArrayField } = foundry.data.fields;
    const num = (initial, label) => new NumberField({ initial, nullable: false, label });
    return {
      description:        new StringField({ initial: "", label: "Описание" }),
      notes:              new StringField({ initial: "", label: "Заметки" }),
      weaponTypes:        new ArrayField(new StringField(), { label: "Подходит к типам оружия" }),
      ammoCategory:       new StringField({ initial: "bullets", label: "Категория" }),
      rarity:             num(0, "Редкость"),
      quantity:           num(0, "Количество"),
      weight:             num(0, "Вес"),
      availability:       num(0, "Доступность"),
      attackMod:          num(0, "Меткость"),
      damageMod:          num(0, "Урон"),
      damageDiceMod:      num(0, "Кубы урона"),
      damageTypeOverride: new StringField({ initial: "", label: "Тип урона взамен" }),
      penetrationMod:     num(0, "Пробитие"),
      rangeMod:           num(0, "Дальность"),
      rangeMultiplier:    num(1, "Дальность, множитель"),
      special:            new StringField({ initial: "", label: "Особенности" }),
      properties:         new ArrayField(new ObjectField(), { label: "Свойства" }),
      condMods:           new ArrayField(new ObjectField(), { label: "Условные модификаторы" }),
      drukhari:           new BooleanField({ initial: false, label: "Друкхари" })
    };
  }
}
