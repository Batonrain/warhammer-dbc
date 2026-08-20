// module/data/item/weapon-property.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СВОЙСТВО ОРУЖИЯ — справочная запись библиотеки «Свойства оружия» (корбук,
//  IV. Арсенал, стр. 166). Сам расчёт движок ведёт по ключу autoKey из кода
//  (module/combat/weapon-properties.mjs), предмет только описывает свойство
//  игроку и отвечает за подсказку в чат.
//
//  Схема заменяет запись типа в template.json: там поля объявлялись без типов
//  и без проверок, и опечатка в имени поля оборачивалась тихим undefined.
// ════════════════════════════════════════════════════════════════════════════

/** Где свойство применимо — подписи повторяют дропдаун листа предмета. */
export const WEAPON_PROPERTY_CATEGORIES = {
  ranged: "Дальнобойное",
  melee:  "Рукопашное",
  both:   "Любое"
};

export class WeaponPropertyData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, BooleanField } = foundry.data.fields;
    return {
      description: new HTMLField({ initial: "", label: "Описание" }),
      notes:       new HTMLField({ initial: "", label: "Заметки" }),
      reminder:    new StringField({ initial: "", label: "Напоминание в чат" }),
      category:    new StringField({
        initial: "both", choices: WEAPON_PROPERTY_CATEGORIES, label: "Применимо"
      }),
      hasRating:   new BooleanField({ initial: false, label: "Принимает рейтинг (X)" }),
      hasRating2:  new BooleanField({ initial: false, label: "Принимает второй рейтинг (X/Y)" }),
      autoKey:     new StringField({ initial: "", label: "Ключ движка" }),
      bookSource:  new StringField({ initial: "", label: "Книга-источник" })
    };
  }
}
