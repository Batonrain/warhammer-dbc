// module/data/item/armor-mod.mjs
// ════════════════════════════════════════════════════════════════════════════
//  МОДИФИКАЦИЯ БРОНИ и СИСТЕМА СИЛОВОЙ БРОНИ (category="powerSystem").
//  Действует, пока установлена на надетый носитель, а включаемая — ещё и пока
//  включена (см. combat/armor-mods.mjs и isItemActive в apps/effects.mjs).
//
//  `effects` перечислены схемой, а не свободным объектом: их считает
//  getArmorModEffects, и в ActiveEffect они не переезжают — AP модификации
//  складывается в AP её носителя ДО сравнения броней между собой, а потолок
//  Ловкости не считает пока никто (wdbc-b3m, wdbc-fde). Исключение —
//  apVs*: они уже уехали в эффекты (wdbc-1j8), но поля остаются как легаси
//  у непомеченных предметов.
// ════════════════════════════════════════════════════════════════════════════

import { migrateCharBonusPair } from "./_legacy-char-bonus.mjs";

export class ArmorModData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    const ap = label => new NumberField({ initial: 0, nullable: false, label });
    return {
      description:  new HTMLField({ initial: "", label: "Описание" }),
      notes:        new HTMLField({ initial: "", label: "Заметки" }),
      category:     new StringField({ initial: "armor", label: "Категория" }),
      modGroup:     new StringField({ initial: "general", label: "Группа" }),
      requirement:  new StringField({ initial: "", label: "Требование" }),
      installedOn:  new StringField({ initial: "", label: "Установлена на" }),
      weight:       new NumberField({ initial: 0, nullable: false, label: "Вес" }),
      availability: new NumberField({ initial: 0, integer: true, nullable: false, label: "Доступность" }),
      quality:      new StringField({ initial: "common", label: "Качество" }),
      // Модификация вживлена/встроена в носителя, а не лежит отдельным
      // предметом в Разгрузке (wdbc-e2lt) — itemSizeStr() трактует "0" как
      // «места не занимает» (module/constants/rig.mjs).
      itemSize:     new StringField({ initial: "0", label: "Место (разгрузка)" }),
      activatable:  new BooleanField({ initial: false, label: "Включаемая" }),
      active:       new BooleanField({ initial: false, label: "Включена" }),
      // Держатель Рунических Вязей (напр. «Загадка Маата», корбук стр. 433) —
      // сколько вязей может нести слоями и переключать свободным действием
      // вместо физического «изнутри/снаружи». 0 — обычная модификация, не держатель.
      runicWeaveSlots: new NumberField({ initial: 0, integer: true, nullable: false, label: "Слотов под Вязи" }),
      // wdbc-bxw6: «отламывающийся слой» (напр. мод «Аблативная», стр. 166) —
      // ablativeCharge замещает effects.apAll как ЖИВОЕ текущее значение, пока
      // ablative:true (getArmorModEffects, combat/armor-mods.mjs); теряет 1 за
      // каждое попадание владельца (module/rules/ablative-ap.mjs,
      // combat/damage.mjs), на 0 — модификация бездействует (не удаляется).
      ablative:       new BooleanField({ initial: false, label: "Аблативная (истощается)" }),
      ablativeCharge: new NumberField({ initial: 0, integer: true, nullable: false, label: "Аблативный заряд (текущий)" }),
      effects: new SchemaField({
        apAll:         ap("AP: все зоны"),
        apHead:        ap("AP: голова"),
        apBody:        ap("AP: тело"),
        apArms:        ap("AP: руки"),
        apLegs:        ap("AP: ноги"),
        apVsEnergy:    ap("AP против энергетического"),
        apVsImpact:    ap("AP против ударного"),
        apVsRending:   ap("AP против разрывного"),
        apVsBlast:     ap("AP против взрывного"),
        maxAgilityMod: ap("Потолок Ловкости"),
        addProps:     new ArrayField(new ObjectField(), { label: "Добавляет свойства" }),
        charBonuses:  new ArrayField(new ObjectField(), { label: "Бонусы характеристик" })
      }, { label: "Механика" }),
      drukhari:     new BooleanField({ initial: false, label: "Друкхари" })
    };
  }

  /** @override — общий разбор пары charBonusStat/charBonusValue. */
  static migrateData(source) { return migrateCharBonusPair(source); }
}
