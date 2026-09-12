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
      drukhari:          new BooleanField({ initial: false, label: "Друкхари" }),
      // Укрытие по подвиду урона, пока поле активно (Mistshield/Туманный Щит,
      // wdbc-q0q8) — не срабатывание самого щита (см. combat/damage.mjs
      // _rollActiveShield), а отдельная плоская добавка к AP локации, как
      // обычное Укрытие, читается rules/character/armour.mjs только пока
      // status==="active". Пустая строка coverVsSubtype — поле такого укрытия
      // не даёт (подавляющее большинство щитов).
      coverVsSubtype:    new StringField({ initial: "", label: "Укрытие: подвид урона" }),
      coverVsSubtypeAP:  new NumberField({ initial: 0, integer: true, nullable: false, label: "Укрытие: AP против подвида" }),
      // Особая перегрузка (Морозное Сердце, wdbc-q0q8) — вместо/вместе с обычным
      // «выключился, нужен ремонт» дополнительно бьёт по актору напрямую и
      // требует особого теста для повторной активации. Пусто — обычная
      // перегрузка без доп. эффектов (подавляющее большинство щитов). Формулы —
      // как у оружия (1d5, 1d5-1 и т.п.), считает combat/damage.mjs. Тест на
      // ремонт — ТОЛЬКО текст для чата/подсказки, не проверяется кодом (тот же
      // уровень строгости, что у текстового поля "Требование" в модах брони).
      overloadDamageFormula:  new StringField({ initial: "", label: "Перегрузка: доп. урон (формула)" }),
      overloadFatigueFormula: new StringField({ initial: "", label: "Перегрузка: доп. усталость (формула)" }),
      overloadRepairTest:     new StringField({ initial: "", label: "Ремонт: требуемый тест" })
    };
  }
}
