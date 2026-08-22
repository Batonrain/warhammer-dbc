// module/data/item/vehicle-trait.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЧЕРТА ТЕХНИКИ — Открытый Верх, Автозарядник, Щит-дефлектор и прочее.
//  До трёх рейтингов: у «Автопилота», например, это Operate/BS/Awareness.
//
//  `effects` — свободный объект автоматизируемых флагов; их сводит
//  documents/actor.mjs (_prepareVehicleData). Умолчание берётся из DEF_FX
//  библиотеки Черт: набор флагов там уже разъезжался с template.json на пять
//  полей, и второй копии этого списка быть не должно.
// ════════════════════════════════════════════════════════════════════════════

import { VEHICLE_TRAIT_EFFECTS } from "../../constants/vehicle-traits.mjs";

export class VehicleTraitData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, BooleanField, NumberField, ObjectField } = foundry.data.fields;
    const num = (initial, label) => new NumberField({ initial, nullable: false, label });
    return {
      description:  new HTMLField({ initial: "", label: "Описание" }),
      notes:        new HTMLField({ initial: "", label: "Заметки" }),
      benefit:      new StringField({ initial: "", label: "Действие" }),
      availability: num(0, "Доступность"),
      hasRating:    new BooleanField({ initial: false, label: "Есть рейтинг" }),
      rating:       num(0, "Рейтинг"),
      hasRating2:   new BooleanField({ initial: false, label: "Есть второй рейтинг" }),
      rating2:      num(0, "Второй рейтинг"),
      hasRating3:   new BooleanField({ initial: false, label: "Есть третий рейтинг" }),
      rating3:      num(0, "Третий рейтинг"),
      effects:      new ObjectField({ initial: () => ({ ...VEHICLE_TRAIT_EFFECTS }), label: "Механика" })
    };
  }
}
