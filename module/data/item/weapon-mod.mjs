// module/data/item/weapon-mod.mjs
// ════════════════════════════════════════════════════════════════════════════
//  МОДИФИКАЦИЯ ОРУЖИЯ — прицел, глушитель, удлинённый ствол и т.п.
//  Действует, пока установлена на носитель (installedOn = id оружия).
//
//  `effects` здесь, в отличие от Черт и имплантов, — НЕ уходящий формат:
//  правки профиля оружия (меткость, урон, дальность, ёмкость) в ActiveEffect
//  не переезжают, их считает разбор оружия. Поэтому ключи перечислены схемой:
//  опечатка в пути дала бы тихий ноль.
// ════════════════════════════════════════════════════════════════════════════

import { migrateCharBonusPair } from "./_legacy-char-bonus.mjs";

export class WeaponModData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    const props = label => new ArrayField(new ObjectField(), { label });
    return {
      description:  new HTMLField({ initial: "", label: "Описание" }),
      notes:        new HTMLField({ initial: "", label: "Заметки" }),
      category:     new StringField({ initial: "ranged", label: "Категория" }),
      modGroup:     new StringField({ initial: "other", label: "Группа" }),
      requirement:  new StringField({ initial: "", label: "Требование" }),
      installedOn:  new StringField({ initial: "", label: "Установлена на" }),
      weight:       new NumberField({ initial: 0, nullable: false, label: "Вес" }),
      availability: new NumberField({ initial: 0, integer: true, nullable: false, label: "Доступность" }),
      quality:      new StringField({ initial: "common", label: "Качество" }),
      effects: new SchemaField({
        attackMod:      new NumberField({ initial: 0, nullable: false, label: "Меткость" }),
        damageMod:      new NumberField({ initial: 0, nullable: false, label: "Урон" }),
        penMod:         new NumberField({ initial: 0, nullable: false, label: "Пробитие" }),
        rangeMod:       new NumberField({ initial: 0, nullable: false, label: "Дальность" }),
        rangeMult:      new NumberField({ initial: 1, nullable: false, label: "Дальность, множитель" }),
        clipMod:        new NumberField({ initial: 0, nullable: false, label: "Ёмкость" }),
        clipMult:       new NumberField({ initial: 1, nullable: false, label: "Ёмкость, множитель" }),
        rofSemiMod:     new NumberField({ initial: 0, nullable: false, label: "Очередь, короткая" }),
        rofFullMod:     new NumberField({ initial: 0, nullable: false, label: "Очередь, полная" }),
        reliabilityMod: new NumberField({ initial: 0, nullable: false, label: "Надёжность" }),
        balanceMod:     new NumberField({ initial: 0, nullable: false, label: "Баланс" }),
        weightPct:      new NumberField({ initial: 0, nullable: false, label: "Вес, %" }),
        // Хват (wdbc-8vp1, Pistol Grip): мод даёт оружию НОВЫЙ вариант хвата
        // (напр. винтовке — "1р"), которого нет в собственном sys.grips
        // предмета — attack-dialog.mjs добавляет его в список пилюль. gripRangeMult
        // — множитель Дальности, действующий ТОЛЬКО пока выбран именно этот
        // хват (в отличие от безусловного rangeMult выше).
        grantsGrip:     new StringField({ initial: "", label: "Даёт Хват" }),
        gripRangeMult:  new NumberField({ initial: 1, nullable: false, label: "Дальность на этом Хвате, множитель" }),
        // Стрельба от бедра без Прицеливания (wdbc-aj6t, Secondary Grip) —
        // отдельные от безусловных rofSemiMod/rofFullMod поля, применяются
        // только пока Прицеливание не взято И хват не "1р" (см. attack-dialog.mjs).
        hipFireSemiMod:       new NumberField({ initial: 0, nullable: false, label: "От бедра: короткая очередь" }),
        hipFireFullMod:       new NumberField({ initial: 0, nullable: false, label: "От бедра: длинная очередь" }),
        hipFireSuppressionMod: new NumberField({ initial: 0, nullable: false, label: "От бедра: подавление" }),
        addProps:        props("Добавляет свойства"),
        removeProps:     props("Снимает свойства"),
        mechAddProps:    props("Добавляет свойства (механикум)"),
        mechRemoveProps: props("Снимает свойства (механикум)")
      }, { label: "Механика" }),
      drukhari:     new BooleanField({ initial: false, label: "Друкхари" })
    };
  }

  /** @override — общий разбор пары charBonusStat/charBonusValue. */
  static migrateData(source) { return migrateCharBonusPair(source); }
}
