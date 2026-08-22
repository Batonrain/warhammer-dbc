// module/data/item/forcefield.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЗАЩИТНОЕ ПОЛЕ — рефрактор, конверсионное, купол. Бросок на срабатывание и
//  перегрузку считает combat/shield.mjs; здесь только профиль поля.
// ════════════════════════════════════════════════════════════════════════════

export class ForcefieldData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, BooleanField, NumberField } = foundry.data.fields;
    return {
      description:       new HTMLField({ initial: "", label: "Описание" }),
      notes:             new HTMLField({ initial: "", label: "Заметки" }),
      shieldNature:      new StringField({ initial: "technological", label: "Природа" }),
      shieldType:        new StringField({ initial: "dome", label: "Тип" }),
      ratingMin:         new NumberField({ initial: 1, integer: true, nullable: false, label: "Рейтинг от" }),
      ratingMax:         new NumberField({ initial: 35, integer: true, nullable: false, label: "Рейтинг до" }),
      overloadThreshold: new NumberField({ initial: 10, integer: true, nullable: false, label: "Порог перегрузки" }),
      currentRating:     new NumberField({ initial: 0, integer: true, nullable: false, label: "Текущий рейтинг" }),
      isSpecialRating:   new BooleanField({ initial: false, label: "Особый рейтинг" }),
      equipped:          new BooleanField({ initial: false, label: "Надето" }),
      status:            new StringField({ initial: "inactive", label: "Состояние" }),
      quality:           new StringField({ initial: "common", label: "Качество" }),
      availability:      new NumberField({ initial: 2, integer: true, nullable: false, label: "Доступность" }),
      weight:            new NumberField({ initial: 0, nullable: false, label: "Вес" }),
      drukhari:          new BooleanField({ initial: false, label: "Друкхари" })
    };
  }
}
