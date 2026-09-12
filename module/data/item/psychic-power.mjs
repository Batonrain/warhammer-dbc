// module/data/item/psychic-power.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПСИХОСИЛА — бросок Психической Дисциплины, стоимость в ПР, поддержание.
//  Атакующая сила несёт ещё и профиль оружия (урон, пробитие, свойства).
//
//  `effects` — свободный объект, как у Черты и Таланта: механика поддерживаемой
//  силы переезжает в ActiveEffect (migrations/item-effects.mjs), а усиление
//  оружия (weaponBuff) читает combat/weapon-mods.mjs.
// ════════════════════════════════════════════════════════════════════════════

/** Умолчание `effects`: те же нули, что раздавал template.json. */
function emptyEffects() {
  return {
    // Пара charBonusStat/charBonusValue у сил не заполнена ни в одном предмете
    // пака и на лист не выведена, но её всё ещё читает legacyEffectsToChanges —
    // оставлена как была, чтобы перевод типа ничего не менял в механике.
    charBonusStat: "", charBonusValue: 0, charBonuses: [],
    armourAll: 0, fearRating: 0, sizeMod: 0, grantedTraits: "",
    weaponBuff: {
      enabled: false, scope: "equipped",
      damageMod: 0, penMod: 0, rangeMod: 0, addProps: []
    }
  };
}

import { migrateCharBonusPair } from "./_legacy-char-bonus.mjs";

export class PsychicPowerData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, BooleanField, NumberField, ObjectField, ArrayField } = foundry.data.fields;
    const num  = (initial, label) => new NumberField({ initial, nullable: false, label });
    const list = label => new ArrayField(new ObjectField(), { label });
    return {
      description:   new HTMLField({ initial: "", label: "Описание" }),
      notes:         new HTMLField({ initial: "", label: "Заметки" }),
      // Книжная цена в Опыте (wdbc-2b61) — фиксированная, не зависит от
      // Склонностей/Мировоззрения (в отличие от Талантов/Навыков). Метка
      // "в ПР" — старая ошибка: Пси-Рейтинг для применения силы хранит
      // prRequired ниже, cost всегда был ценой покупки за опыт.
      cost:          num(0, "Стоимость в опыте"),
      discipline:    new StringField({ initial: "", label: "Дисциплина" }),
      subtype:       new StringField({ initial: "", label: "Подтип" }),
      powerType:     new StringField({ initial: "attack", label: "Тип силы" }),
      extraTypes:    list("Дополнительные типы"),
      shootSubtype:  new StringField({ initial: "", label: "Подтип стрельбы" }),
      prRequired:    num(1, "Требуемый ПР"),
      // Полное книжное требование строкой — «Метка Слаанеш, PR 4+, T 40+»
      // (wdbc-k1q4). prRequired выше несёт только PR и потому не мог выразить
      // ни Метку Бога, ни порог Характеристики: у Божественных Дисциплин
      // требование из трёх частей, и две из них были не видны нигде, кроме
      // книги. Разбирается тем же checkRequirement, что и у Талантов.
      requirement:   new StringField({ initial: "", label: "Требование" }),
      testChar:      new StringField({ initial: "wp", label: "Характеристика проверки" }),
      testMod:       num(0, "Модификатор проверки"),
      action:        new StringField({ initial: "half", label: "Действие" }),
      // Дальность — строка: в книге это и «10 м», и «Бонус Воли × 5 м».
      range:         new StringField({ initial: "", label: "Дальность" }),
      sustainable:   new BooleanField({ initial: false, label: "Поддерживаемая" }),
      sustainCost:   num(1, "Стоимость поддержания"),
      sustainAction: new StringField({ initial: "free", label: "Действие поддержания" }),
      damage:        new StringField({ initial: "", label: "Урон" }),
      damageType:    new StringField({ initial: "energy", label: "Тип урона" }),
      // Формула, не число (wdbc-5kd): книга местами задаёт Пробитие через ПР
      // самого псайкера — «Разрушение» Pen=PR, «Сверхъестественный Шторм»
      // Pen=PR×3 (записывается как «PR*3»). Прежнее NumberField умело хранить
      // только константу — авторам пака оставалось писать в notes и класть 0,
      // выдуманное значение. Читается тем же способом, что и damage: «PR»
      // подставляется реальным эПР манифестации (module/sheets/tabs/psychic.mjs),
      // остаток считает module/rules/mech-formula.mjs. Голое число — валидная
      // формула из одного терма, старые данные пака (просто "0"/"8"/…) не ломаются.
      penetration:   new StringField({ initial: "0", label: "Пробитие" }),
      weaponProps:   list("Свойства оружия"),
      charDamageStat:    new StringField({ initial: "", label: "Урон по характеристике" }),
      charDamageFormula: new StringField({ initial: "", label: "Формула урона по характеристике" }),
      profiles:      list("Дополнительные профили"),
      variants:      list("Вариации броска"),
      // Тест Сопротивления ЦЕЛИ (wdbc-5vf4) — книжный формат «Психотест X vs
      // Y+N» (стр. 289 далее): resistChar пуст = сила не требует встречного
      // теста цели (Изменение/Вливание без сопротивления, чисто
      // информационные/союзные силы). Непусто — характеристика (CHARACTERISTICS,
      // тот же набор ключей, что и у testChar/charBonusOptions), которой цель
      // защищается, + resistMod — модификатор ЕЁ теста (в книге почти всегда
      // +0; построчный разбор всех 83 сил с полем — wdbc-3x1n — нашёл ровно
      // один пример с отличным от нуля модификатором: Mentor/Ментор, −20).
      // ЖИВОЙ ЗАПРОС, не запись Конструктора: читается прямо при манифестации
      // (module/sheets/tabs/psychic.mjs::executePsychotest), как уже устроены
      // testChar/testMod рядом — не ActiveEffect (эффект метит ЧУЖОЙ, ещё не
      // существующий на момент получения предмета тест — считать заранее
      // нечем) и не перманентная правка (ничего не хранится).
      resistChar:    new StringField({ initial: "", label: "Тест Сопротивления цели (характеристика)" }),
      resistMod:     num(0, "Модификатор теста Сопротивления цели"),
      effect:        new StringField({ initial: "", label: "Эффект" }),
      isSustained:   new BooleanField({ initial: false, label: "Поддерживается сейчас" }),
      // wdbc-8m0x: степень успеха психотеста, на которой сейчас манифестирована
      // поддерживаемая сила — сила/длительность эффекта часто завязаны на неё
      // (стр. 289 и тексты конкретных сил), а без хранения приходится помнить
      // или искать в истории чата. null = нет сохранённого результата (ещё не
      // манифестировалась или поддержание снято). Пишется в executePsychotest
      // тем же item.update, что и isSustained (module/sheets/tabs/psychic.mjs),
      // и сбрасывается в null там же при снятии поддержания.
      sustainedDegree: new NumberField({ initial: null, nullable: true, integer: true, label: "Степень успеха (поддержание)" }),
      // wdbc-lmd2 (найдено внутри wdbc-q0q8): uuid актора-цели, зафиксированный
      // в момент включения «Поддерживать» (по game.user.targets, tabs/psychic.mjs).
      // Читает cross-actor источник module/rules/psychic-sustain-target.mjs —
      // способности «Цели психосилы получают...» (Dragon Scales/Wings of the
      // Phoenix), а не только владельцу. Пустая строка — цель не отмечена
      // (сила не поддерживается, либо игрок ничего не выделил при манифестации).
      sustainedTargetUuid: new StringField({ initial: "", label: "Цель поддержания (uuid)" }),
      // Руна Сигиллитов (wdbc-exjp, DoomBC — Психокеры-Жабы, стр. 101-102):
      // «Псайкер получает возможность изучить Руну любой психосилы... за 50
      // опыта» — Руна привязана к КОНКРЕТНОЙ психосиле, поэтому это поле
      // самой психосилы (как isSustained/sustainedDegree выше), а не список
      // на акторе. У всех, кто не Сигиллит, поле просто лежит false и никем
      // не читается — читает только module/rules/sigillite-runes.mjs и Путь
      // Силы «Руны Сигиллитов» (tabs/psychic.mjs). runeLearnCost — сколько
      // реально уплачено (50, либо 100 за Prometheus Fire), нужно отдельно от
      // общей `cost`, чтобы обе траты складывались в system.experience.spentPsy
      // независимо (rules/character.mjs) и не путались местами в UI.
      runeLearned:   new BooleanField({ initial: false, label: "Руна изучена (Сигиллиты)" }),
      runeLearnCost: num(0, "Уплачено опыта за Руну"),
      effects:       new ObjectField({ initial: emptyEffects, label: "Механика" })
    };
  }

  /** @override — общий разбор пары charBonusStat/charBonusValue. */
  static migrateData(source) { return migrateCharBonusPair(source); }
}
