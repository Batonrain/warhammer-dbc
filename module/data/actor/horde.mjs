// module/data/actor/horde.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ОРДА — толпа как один актор: вместо ран у неё Численность (magnitude),
//  вместо брони — общее Поглощение. Характеристики упрощённые: продвижений и
//  улучшений у орды нет, только база и итог.
// ════════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../../constants/characteristics.mjs";

export class HordeData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField, SchemaField } = foundry.data.fields;
    const num = (initial, label) => new NumberField({ initial, nullable: false, label });
    const str = label => new StringField({ initial: "", label });

    const charFields = {};
    for (const [key, def] of Object.entries(CHARACTERISTICS)) {
      // Влияние — характеристика персонажа, у орды его нет.
      if (key === "inf") continue;
      charFields[key] = new SchemaField({
        base:    num(0, "База"),
        advance: num(0, "Продвижение"),
        total:   num(0, "Значение"),
        bonus:   num(0, "Бонус")
      }, { label: def.label });
    }

    return {
      speciesName: str("Вид"),
      faction:     str("Фракция"),
      descriptor:  str("Описание"),
      characteristics: new SchemaField(charFields, { label: "Характеристики" }),
      magnitude: new SchemaField({
        value: num(0, "Текущая"), start: num(0, "Начальная")
      }, { label: "Численность" }),
      psychDamage:    num(0, "Психический урон"),
      absorption:     num(0, "Поглощение"),
      sizeMod:        num(0, "Модификатор Размера"),
      movement: new SchemaField({
        halfMove: num(0, "Полуход"), move: num(0, "Ход"),
        charge:   num(0, "Натиск"),  run:  num(0, "Бег")
      }, { label: "Перемещение" }),
      enemiesInMelee: num(0, "Врагов в ближнем бою"),
      immuneFear:     new BooleanField({ initial: false, label: "Иммунитет к Страху" }),
      traits:  str("Черты"),
      notes:   str("Заметки"),
      gmNotes: str("Заметки ГМ")
    };
  }
}
