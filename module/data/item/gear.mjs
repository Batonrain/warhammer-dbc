// module/data/item/gear.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СНАРЯЖЕНИЕ — всё носимое, что не оружие, не броня и не инструмент.
//  Отдельная ветка — «сбруя» (isRig): разгрузка с ячейками под оружие и
//  маг-замками, её описывает вложенная схема rig.
// ════════════════════════════════════════════════════════════════════════════

/** Подсказки по качеству предмета: три текста, по одному на ступень. */
export function qualityEffectsField() {
  const { HTMLField, StringField, SchemaField } = foundry.data.fields;
  return new SchemaField({
    poor: new StringField({ initial: "", label: "Низкое" }),
    good: new StringField({ initial: "", label: "Хорошее" }),
    best: new StringField({ initial: "", label: "Лучшее" })
  }, { label: "Эффекты качества" });
}

import { infoguardField } from "./infoguard.mjs";

export class GearData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    return {
      description:  new HTMLField({ initial: "", label: "Описание" }),
      notes:        new HTMLField({ initial: "", label: "Заметки" }),
      infoguard:    infoguardField(),
      quantity:     new NumberField({ initial: 1, integer: true, nullable: false, label: "Количество" }),
      weight:       new NumberField({ initial: 0, nullable: false, label: "Вес" }),
      availability: new NumberField({ initial: 0, integer: true, nullable: false, label: "Доступность" }),
      quality:      new StringField({ initial: "common", label: "Качество" }),
      gearCategory: new StringField({ initial: "misc", label: "Категория" }),
      linkedWeapon: new StringField({ initial: "", label: "Связанное оружие" }),
      worn:         new StringField({ initial: "", label: "Как носится" }),
      // НАДЕТО ЛИ СЕЙЧАС (wdbc-9h7g) — в отличие от worn выше, который
      // описательный («куда», а не «сейчас ли»). Тот же тумблер, что
      // weapon/armor.equipped, и читает его тот же isItemActive
      // (module/apps/effects.mjs): без него Механика предмета действовала,
      // пока он просто лежит в рюкзаке — противогаз защищал от газа из
      // заплечного мешка. Спрашивается НЕ у всякого снаряжения, а только у
      // того, про которое книга сказала, КУДА оно надевается (worn заполнено,
      // см. gearRequiresWearing): хим-лаборатории и анализатору «надеть» не
      // предлагается — они работают фактом применения, а не ношением.
      equipped:     new BooleanField({ initial: false, label: "Надето" }),
      // Мелочь, жёстко закреплённая на другом предмете (визор на шлеме,
      // крепление на броне, штык-нож на цевье) — не лежит в разгрузке сама
      // по себе и не занимает в ней слот, пока указан носитель. Та же форма
      // выбора, что у armorMod.installedOn (см. item-sheet.mjs), но подпись
      // и цель другие — здесь просто «надето на», бонусов не даёт.
      wornOn:       new StringField({ initial: "", label: "Надето на" }),
      effect:       new StringField({ initial: "", label: "Эффект" }),
      reminder:     new StringField({ initial: "", label: "Напоминание" }),
      qualityEffects: qualityEffectsField(),
      isRig:        new BooleanField({ initial: false, label: "Сбруя" }),
      rig: new SchemaField({
        comfort:  new StringField({ initial: "normal", label: "Удобство" }),
        backSlot: new BooleanField({ initial: false, label: "Заспинная ячейка" }),
        slots:    new ArrayField(new ObjectField(), { label: "Ячейки" }),
        magLocks: new ArrayField(new ObjectField(), { label: "Маг-замки" })
      }, { label: "Сбруя" }),
      itemSize:     new StringField({ initial: "", label: "Размер" }),
      bonuses:      new ArrayField(new ObjectField(), { label: "Бонусы" }),
      drukhari:     new BooleanField({ initial: false, label: "Друкхари" }),
      bookSource:   new StringField({ initial: "", label: "Книга-источник" }),
      // В template.json объявлено не было, но лежит у 20 предметов пака — след
      // раскладки по папкам компендиума при импорте. Кодом не читается;
      // объявлено, чтобы правка предмета в игре его не стирала.
      folderPath:   new ArrayField(new StringField(), { label: "Путь папки при импорте" }),
      // Не работает (wdbc-vwfk, Reformation Song/Песня Изменений: «Разрушение»
      // блокирует работу на раунд). Чистая метка состояния — тот же приём,
      // что armor.mjs::breached/weapon.mjs::destroyed; снимается движком
      // (module/combat/reformation-song.mjs::clearExpiredGearMalfunction) в
      // начале следующего Хода владельца — «раунд» здесь читается как «до
      // твоего следующего Хода», тем же идиоматическим допущением, что и
      // прочие «до начала следующего Хода» эффекты этого файла (Грозный
      // Вопль/Поклон Публике в hooks.mjs), без отдельного счётчика раунда.
      malfunctioning: new BooleanField({ initial: false, label: "Не работает" }),
      // Психокостяное / иммунно к Reformation Song (wdbc-vwfk) — та же пара
      // полей, что weapon.mjs::wraithbone/wraithboneImmune. В каталоге
      // Снаряжения не нашлось ни одного однозначно психокостяного предмета
      // (только оружие/броня) — оба поля заведены для полноты фильтра
      // диалога и будущего авторинга, засеянных значений true пока нет.
      wraithbone:       new BooleanField({ initial: false, label: "Психокостяное" }),
      wraithboneImmune: new BooleanField({ initial: false, label: "Иммунно к Reformation Song" })
    };
  }
}
