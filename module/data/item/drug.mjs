// module/data/item/drug.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ХИМИЯ — лекарства, стимуляторы, наркотики и яды. Самый широкий тип по
//  вложенности: у препарата есть основной эффект и пост-эффект, и у каждого
//  свой набор правок характеристик и особых действий. Применение и отсчёт
//  срока ведёт вкладка «Химия» (sheets/tabs), состояние лежит в activeEffect.
// ════════════════════════════════════════════════════════════════════════════

const CHARS = ["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel"];

import { stringList, repairStringListAt } from "../string-list.mjs";

export class DrugData extends foundry.abstract.TypeDataModel {

  /**
   * Строки-ключи, испорченные прежней схемой в {}, — в метку для мировой
   * миграции (data/string-list.mjs). До очистки полей, поэтому здесь.
   * @override
   */
  static migrateData(source) {
    repairStringListAt(source, "poisonVector");
    return super.migrateData(source);
  }

  /** @override */
  static defineSchema() {
    const { StringField, HTMLField, BooleanField, NumberField, SchemaField } = foundry.data.fields;
    const num  = (initial, label) => new NumberField({ initial, nullable: false, label });
    const text = label => new StringField({ initial: "", label });
    /** Правки всех девяти характеристик — одинаковый набор у эффекта и пост-эффекта. */
    const statMods = label => new SchemaField(
      Object.fromEntries(CHARS.map(c => [c, num(0, c.toUpperCase())])), { label });

    return {
      description:    new HTMLField({ initial: "", label: "Описание" }),
      notes:          new HTMLField({ initial: "", label: "Заметки" }),
      drugCategory:   new StringField({ initial: "medicine", label: "Категория" }),
      deliveryMethod: new StringField({ initial: "injection", label: "Способ приёма" }),
      quantity:       num(1, "Количество"),
      weight:         num(0, "Вес"),
      // Хранится не при себе (wdbc-6rj) — не учитывается в Нагрузке; см.
      // комментарий в data/item/weapon.mjs.
      stored:         new BooleanField({ initial: false, label: "Хранится (не при себе)" }),
      availability:   num(0, "Доступность"),
      quality:        new StringField({ initial: "common", label: "Качество" }),
      duration:       text("Срок действия"),
      // Срок по игровому времени, минуты (0 — вручную, кнопкой «Эффект завершён»):
      // при приёме пишет activeEffect.expiresAt, часы Календаря снимают препарат
      // сами (rules/drug-expiry.mjs, combat/drug-expiry.mjs). Текстовый duration
      // выше книга меряет то Раундами, то минутами — его не считаем.
      gameMinutes:    new NumberField({ initial: 0, integer: true, min: 0, nullable: false, label: "Срок по игровому времени, мин" }),
      effect:         text("Эффект"),
      afterEffect:    text("Пост-эффект"),
      afterEffectDice: text("Кубы пост-эффекта"),
      afterEffectCharDamage: new SchemaField({
        stat:    text("Характеристика"),
        formula: text("Формула")
      }, { label: "Урон характеристике от пост-эффекта" }),
      hasAfterEffect: new BooleanField({ initial: false, label: "Есть пост-эффект" }),
      addiction: new SchemaField({
        hasAddiction: new BooleanField({ initial: false, label: "Вызывает зависимость" }),
        // УСТАРЕЛО (task-9717, 26.10.2026): зависимость персонажа хранится флагом
        // АКТОРА flags.warhammer-dbc.drugWithdrawal (rules/drug-withdrawal.mjs), поле
        // никто не читает и не пишет. Оставлено, чтобы миграция
        // migrations/drug-addiction-flag.mjs увидела старые данные у выданных копий.
        isAddicted:   new BooleanField({ initial: false, label: "Зависимость есть (устарело)" }),
        minDose:      num(0, "Доз до зависимости"),
        testChar:     new StringField({ initial: "t", label: "Характеристика теста" }),
        testMod:      num(0, "Модификатор теста"),
        // Комбинированный тест Зависимости («Комб.Т+40/W+50», Рекаф/Алкоголь/Лхо):
        // вторая Характеристика со своим модификатором; "" — тест обычный, одиночный.
        // Бросок один, против наименьшего из двух Пределов (rules/drug-withdrawal.mjs).
        testChar2:    new StringField({ initial: "", label: "Вторая характеристика теста (комбинированный)" }),
        testMod2:     num(0, "Модификатор второй характеристики"),
        frequency:    text("Периодичность"),
        penalty:      text("Штраф"),
        // Штраф без дозы ДАННЫМИ (penalty выше остаётся описанием для игрока):
        // «область=значение; …», см. rules/drug-withdrawal.mjs::parsePenaltyMods.
        penaltyMods:  text("Штраф без дозы (область=значение; …)"),
        // Доп. модификатор теста на срыв (Смах: «–20 на тесты избавления от зависимости»).
        breakMod:     num(0, "Доп. модификатор теста на срыв"),
        // Урон в Характеристику «в начале каждого периода частоты приема»
        // (Тиск: 1d5–1 в P; Сатрофин: 1d5 в W) — combat/drug-withdrawal.mjs.
        periodCharDamage: new SchemaField({
          stat:    text("Характеристика"),
          formula: text("Формула")
        }, { label: "Урон в Характеристику за период без дозы" }),
        // Какие Характеристики не восстанавливают урон, пока зависимость есть
        // (task-56da; нотация rules/char-loss.mjs::recoveryTargets: "int,per,wp,fel").
        blocksRecovery: new StringField({ initial: "", label: "Не восстанавливает урон в (при зависимости)" })
      }, { label: "Зависимость" }),
      statMods:            statMods("Правки характеристик"),
      afterEffectStatMods: statMods("Правки характеристик от пост-эффекта"),
      specialEffects: new SchemaField({
        removesBleedingLevels:      num(0, "Снимает Кровотечение"),
        removesHaemorrhagingLevels: num(0, "Снимает Кровоизлияние"),
        removesFatigueLevels:       num(0, "Снимает Усталость"),
        removesWounds:              num(0, "Лечит Ран"),
        healFormula:                text("Формула лечения"),
        healsWoundsPerRound:        text("Лечение за раунд"),
        woundDamage:                text("Урон Ранами"),
        grantsFatigue:              num(0, "Даёт Усталость"),
        woundsToToughness:          new BooleanField({ initial: false, label: "Раны считаются от Стойкости" }),
        removesCondition:           text("Снимает состояние"),
        removesConditionLevel:      num(0, "Уровень снимаемого"),
        grantsCondition:            text("Даёт состояние"),
        grantsConditionLevel:       num(1, "Уровень даваемого"),
        immuneToPoisons:            new BooleanField({ initial: false, label: "Иммунитет к ядам" }),
        counteractsDrugs:           new BooleanField({ initial: false, label: "Гасит другие препараты" }),
        removesRadiation:           new BooleanField({ initial: false, label: "Снимает радиацию" }),
        bonusVsPoisons:             num(0, "Бонус против ядов"),
        reduceDamageOnHit:          num(0, "Снижает урон попадания"),
        noSleepNeeded:              new BooleanField({ initial: false, label: "Не требует сна" }),
        noFatigueFromMarch:         new BooleanField({ initial: false, label: "Нет Усталости от марша" }),
        customEffect:               text("Особое")
      }, { label: "Особые действия" }),
      afterEffectSpecial: new SchemaField({
        removesBleedingLevels:      num(0, "Снимает Кровотечение"),
        removesHaemorrhagingLevels: num(0, "Снимает Кровоизлияние"),
        removesFatigueLevels:       num(0, "Снимает Усталость"),
        removesWounds:              num(0, "Лечит Ран"),
        healFormula:                text("Формула лечения"),
        woundDamage:                text("Урон Ранами"),
        grantsFatigue:              num(0, "Даёт Усталость"),
        grantsCondition:            text("Даёт состояние"),
        grantsConditionLevel:       num(1, "Уровень даваемого"),
        customEffect:               text("Особое")
      }, { label: "Особые действия пост-эффекта" }),
      poisonVector:   stringList("Пути отравления"),
      poisonEffect:   text("Действие яда"),
      poisonTestChar: new StringField({ initial: "t", label: "Характеристика теста на яд" }),
      poisonTestMod:  num(0, "Модификатор теста на яд"),
      activeEffect: new SchemaField({
        isActive:         new BooleanField({ initial: false, label: "Действует" }),
        isAfterEffect:    new BooleanField({ initial: false, label: "Идёт пост-эффект" }),
        // Метки времени мира: null значит «не применялось». Именно null, а не
        // 0 — нулевая отметка времени мира существует и означает другое.
        appliedAt:        new NumberField({ initial: null, nullable: true, label: "Применено в" }),
        expiresAt:        new NumberField({ initial: null, nullable: true, label: "Истекает в" }),
        roundsRemaining:  num(0, "Раундов осталось"),
        charDamageStat:   text("Повреждённая характеристика"),
        charDamageAmount: num(0, "Повреждение характеристики")
      }, { label: "Состояние" }),
      bookSource: new StringField({ initial: "", label: "Книга-источник" })
    };
  }
}
