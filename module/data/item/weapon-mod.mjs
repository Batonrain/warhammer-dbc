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

import { stringList, repairStringListAt } from "../string-list.mjs";
import { migrateCharBonusPair } from "./_legacy-char-bonus.mjs";
import { infoguardField } from "./infoguard.mjs";

export class WeaponModData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    const props = label => new ArrayField(new ObjectField(), { label });
    return {
      description:  new HTMLField({ initial: "", label: "Описание" }),
      notes:        new HTMLField({ initial: "", label: "Заметки" }),
      category:     new StringField({ initial: "ranged", label: "Категория" }),
      infoguard:    infoguardField(),
      modGroup:     new StringField({ initial: "other", label: "Группа" }),
      requirement:  new StringField({ initial: "", label: "Требование" }),
      installedOn:  new StringField({ initial: "", label: "Установлена на" }),
      weight:       new NumberField({ initial: 0, nullable: false, label: "Вес" }),
      availability: new NumberField({ initial: 0, integer: true, nullable: false, label: "Доступность" }),
      quality:      new StringField({ initial: "common", label: "Качество" }),
      bookSource:   new StringField({ initial: "", label: "Книга-источник" }),
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
        // Прицелы с меткой «прицеливание» (wdbc-1rno.5, находка 12/12, стр.
        // 198): «дают эффект только для атаки с использованием Полу-/Полного
        // Прицеливания» — зеркало hipFire* выше (тот бонус ТОЛЬКО БЕЗ
        // Прицеливания, этот ТОЛЬКО С НИМ), читаются отдельно от безусловных
        // attackMod и runningMod в attack-dialog.mjs.
        aimAttackMod:    new NumberField({ initial: 0, nullable: false, label: "Пока Прицеливаюсь: попадание" }),
        aimIgnoresRunning: new BooleanField({ initial: false, label: "Пока Прицеливаюсь: игнорирует штраф за Бег цели" }),
        // Подстройка под конкретного персонажа (wdbc-1rno, Custom Grip):
        // fittedToId — id актора, под которого подстроена модификация;
        // fittedBonus — ± к Атаке (attackMod) для него, зеркальный штраф всем
        // остальным. Пусто по умолчанию — до подстройки бонус не действует
        // ни для кого (модификация просто установлена, ещё не подогнана).
        fittedToId:     new StringField({ initial: "", label: "Подстроена под" }),
        fittedBonus:    new NumberField({ initial: 0, nullable: false, label: "Бонус подстройки (±)" }),
        addProps:        props("Добавляет свойства"),
        // Снимаемые свойства — ключи-строки (data/string-list.mjs).
        removeProps:     stringList("Снимает свойства"),
        mechAddProps:    props("Добавляет свойства (механикум)"),
        mechRemoveProps: stringList("Снимает свойства (механикум)")
      }, { label: "Механика" }),
      drukhari:     new BooleanField({ initial: false, label: "Друкхари" })
    };
  }

  /**
   * Общий разбор пары charBonusStat/charBonusValue; снимаемые свойства,
   * испорченные прежней схемой в {}, — в метку для мировой миграции
   * (data/string-list.mjs).
   * @override
   */
  static migrateData(source) {
    repairStringListAt(source, "effects.removeProps");
    repairStringListAt(source, "effects.mechRemoveProps");
    return migrateCharBonusPair(source);
  }
}
