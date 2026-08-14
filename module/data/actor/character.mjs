// module/data/actor/character.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПЕРСОНАЖ — основной тип актора. Общая часть с Демоном вынесена в
//  _creature.mjs; здесь только своё:
//   - `granted`-поля в характеристиках и навыках (что выдано архетипом, а не
//     куплено за опыт) — их нет ни у Демона, ни у Принца;
//   - покровитель и его благосклонность по четырём Богам;
//   - гемункул (друкхари): ступень, вложения Плоти и Варпа;
//   - `vitals` — голод, жажда, сон;
//   - `helmetOff` — снятый шлем (правило отключаемое, см. combat/armor-mods.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { creatureSchema } from "./_creature.mjs";

export class CharacterData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    const num = (initial, label) => new NumberField({ initial, nullable: false, label });
    const favor = label => num(0, label);
    return {
      ...creatureSchema({ granted: true }),
      bodyType:    new StringField({ initial: "male", label: "Телосложение" }),
      patronGod:   new StringField({ initial: "undivided", label: "Покровитель" }),
      patronFavor: new SchemaField({
        undivided: favor("Неделимый"),
        khorne:    favor("Кхорн"),
        nurgle:    favor("Нургл"),
        slaanesh:  favor("Слаанеш"),
        tzeentch:  favor("Тзинч")
      }, { label: "Благосклонность" }),
      haemonculus: new SchemaField({
        stage:      num(0, "Ступень"),
        flesh:      new ArrayField(new ObjectField(), { label: "Плоть" }),
        warp:       new ArrayField(new ObjectField(), { label: "Варп" }),
        splitPools: new BooleanField({ initial: false, label: "Раздельные запасы" }),
        notes:      new StringField({ initial: "", label: "Заметки" })
      }, { label: "Гемункул" }),
      vitals: new SchemaField({
        hunger: num(0, "Голод"),
        thirst: num(0, "Жажда"),
        sleep:  num(0, "Сон")
      }, { label: "Потребности" }),
      helmetOff: new BooleanField({ initial: false, label: "Шлем снят" })
    };
  }
}
