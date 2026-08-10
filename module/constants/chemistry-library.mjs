/**
 * Библиотека химии (Warhammer DBC).
 *
 * Создаётся системой в компендиуме "warhammer-dbc.chemistry" при первом запуске
 * (см. warhammer-dbc.mjs, хук "ready") и раскладывается по папкам категорий:
 * Медикаменты / Наркотики / Эликсиры / Яды (по полю system.drugCategory).
 * Оттуда предметы перетаскиваются в лист персонажа штатным Drag-and-drop.
 *
 * Указываем только значащие поля — остальное берётся из template.json (тип drug).
 * Сложные/нарративные правила, не ложащиеся в поля движка, прописаны текстом в
 * effect / afterEffect (видно в чате и листе), механические части — в полях.
 */

import { DRUKHARI_CHEMISTRY } from "./drukhari-bio.mjs";

const IMG = "icons/svg/item-bag.svg";

export const CHEMISTRY_LIBRARY = [
  ...DRUKHARI_CHEMISTRY,

  // ═══════════════════════════════ МЕДИКАМЕНТЫ ════════════════════════════════

  {
    name: "Bloodbag / Пакет Крови", type: "drug", img: IMG,
    system: {
      description: "Пакет универсальной донорской крови для переливаний раненным.",
      drugCategory: "medicine", deliveryMethod: "injection", availability: -2, quantity: 1,
      effect: "Снимает 1d5 уровней Обескровливания (авто снимает 1 ур.; ГМ может увеличить под бросок 1d5).",
      specialEffects: { removesHaemorrhagingLevels: 1 },
      hasAfterEffect: true,
      afterEffect: "Быстрая инъекция (1 Ход): +1 Усталость, Оглушён 1 Раунд, 2d10 урона в T. Медленная (12+ Раундов) — без пост-эффекта. Второе Сердце игнорирует.",
      afterEffectCharDamage: { stat: "t", formula: "2d10" },
      afterEffectSpecial: { grantsCondition: "stunned", grantsConditionLevel: 1, grantsFatigue: 1 }
    }
  },
  {
    name: "Smelling Salt / Нюхательная Соль", type: "drug", img: IMG,
    system: {
      description: "Капсула с солями, при сжатии выделяющая резкий дурно пахнущий газ.",
      drugCategory: "medicine", deliveryMethod: "gas", availability: -2, quantity: 1,
      effect: "Пробуждает от бессознательного состояния, сна, Оглушения или Ступора. Если Усталость > T.b — опускается до T.b.",
      specialEffects: { removesCondition: "unconscious", removesConditionLevel: 0,
                        customEffect: "Также снимает сон/Оглушение/Ступор." },
      hasAfterEffect: true,
      afterEffect: "Применивший и цель −30 на все тесты 1 Раунд; следующие 12 Раундов оба автопровал тестов на нюх."
    }
  },
  {
    name: "Detox / Детокс", type: "drug", img: IMG,
    system: {
      description: "Мощный препарат, выводящий токсины из организма, часто вызывая тошноту.",
      drugCategory: "medicine", deliveryMethod: "injection", availability: -1, quantity: 1,
      effect: "Немедленно прекращает эффекты и пост-эффекты всех химикатов и ядов.",
      specialEffects: { counteractsDrugs: true },
      hasAfterEffect: true,
      afterEffect: "Оглушён 1d10−T.b Раундов (если ≤0 — очень неприятно, но не Оглушён).",
      afterEffectSpecial: { grantsCondition: "stunned", grantsConditionLevel: 1 }
    }
  },
  {
    name: "Syntskin Spray / Распылитель Синтекожи", type: "drug", img: IMG,
    system: {
      description: "Баллончик с жидкой синтекожей, затягивающей рану временной заплаткой. 10 зарядов.",
      drugCategory: "medicine", deliveryMethod: "patch", availability: 0, quantity: 10,
      effect: "Немедленно прекращает Кровотечение.",
      specialEffects: { removesCondition: "bleeding", removesConditionLevel: 0 }
    }
  },
  {
    name: "Plumbata / Плумбата", type: "drug", img: IMG,
    system: {
      description: "Мощный антирадиационный препарат, выводящий радионуклиды быстро и немилосердно.",
      drugCategory: "medicine", deliveryMethod: "injection", availability: 0, quantity: 1,
      effect: "Излечивает лучевую болезнь и урон в T от радиации.",
      specialEffects: { removesRadiation: true },
      hasAfterEffect: true,
      afterEffect: "1d5 часов: тошнота, Усталость поднимается и не понижается; каждый Ход после >0.5 действий — тест T−10 или рвота (Оглушение 1d5 Ходов).",
      afterEffectSpecial: { grantsFatigue: 1 }
    }
  },
  {
    name: "Countertox / Контртокс", type: "drug", img: IMG,
    system: {
      description: "Высокотехнологичное универсальное противоядие.",
      drugCategory: "medicine", deliveryMethod: "injection", availability: 1, quantity: 1,
      duration: "1d5+T.b",
      effect: "1d5+T.b минут: +20 на тесты против ядов, длительность ядов вдвое, d10→d5 в уроне ядов; но −5 к S и Ag.",
      statMods: { s: -5, ag: -5 },
      specialEffects: { bonusVsPoisons: 20 }
    }
  },
  {
    name: "Defrag / Дефраг", type: "drug", img: IMG,
    system: {
      description: "Пластырь, закрепляющий осколки и не дающий им наносить дальнейшие повреждения.",
      drugCategory: "medicine", deliveryMethod: "patch", availability: 1, quantity: 1,
      effect: "Немедленно прекращает эффект Crippling (Калечение).",
      specialEffects: { removesCondition: "crippling", removesConditionLevel: 0 },
      hasAfterEffect: true,
      afterEffect: "Наносит 1d5 непоглощаемого урона R.",
      afterEffectSpecial: { woundDamage: "1d5" }
    }
  },
  {
    name: "Haemogenesis / Гемогенезис", type: "drug", img: IMG,
    system: {
      description: "Вирусная сыворотка, заставляющая костный мозг вырабатывать кровь ускоренно.",
      drugCategory: "medicine", deliveryMethod: "injection", availability: 1, quantity: 1,
      duration: "1d5",
      effect: "1d5 минут: снимает 1 уровень Обескровливания в начале каждого Хода.",
      specialEffects: { removesHaemorrhagingLevels: 1,
                        customEffect: "Снимает 1 ур. Обескровливания/Ход на время действия." },
      hasAfterEffect: true,
      afterEffect: "1d10 урона в T и 1 Усталость; пока урон в T не снят — −10 на все физ. действия и реакции.",
      afterEffectCharDamage: { stat: "t", formula: "1d10" },
      afterEffectSpecial: { grantsFatigue: 1 }
    }
  },
  {
    name: "Gasp / Вздох", type: "drug", img: IMG,
    system: {
      description: "Обогащённая кислородом жидкость, вливаемая в лёгкие для долгой задержки дыхания.",
      drugCategory: "medicine", deliveryMethod: "liquid", availability: 2, quantity: 1,
      duration: "10",
      effect: "Персонаж может не дышать 10 минут без штрафов.",
      hasAfterEffect: true,
      afterEffect: "Наносит 1d5−1 Усталости.",
      afterEffectSpecial: { grantsFatigue: 1 }
    }
  },
  {
    name: "Juvenat Treatment / Ювенантная Медицина", type: "drug", img: IMG,
    system: {
      description: "8-часовая операция со стволовыми клетками и выращенными органами, отменяющая биологическое старение. Требует Medicae−20.",
      drugCategory: "medicine", deliveryMethod: "injection", availability: 3, quantity: 1,
      effect: "Уменьшает биологический возраст (1d10 лет/Успех, мин. 25; формула зависит от реального возраста). Существуют версии R:4/R:5.",
      hasAfterEffect: true,
      afterEffect: "−30 на все тесты, уменьшается на 2 за каждый Успех операции; за каждый день постельного режима штраф −1."
    }
  },

  // ════════════════════════════════ НАРКОТИКИ ═════════════════════════════════

  {
    name: "Alcohol / Алкоголь", type: "drug", img: IMG,
    system: {
      description: "Разновидности алкоголя — от высококлассного амасека до дешёвого подулейного пойла.",
      drugCategory: "narcotic", deliveryMethod: "liquid", availability: -2, quantity: 1,
      effect: "Накапливающийся штраф −10/рюмку и Провалы дают бонусы vs Страх/Шок/Запугивание/Подавление и штрафы к действиям (см. таблицу). Каждые 20 минут штраф −1.",
      hasAfterEffect: true,
      afterEffect: "8 часов: −10 на все тесты (похмелье). Good.Q даёт это лишь на 4 часа, Best.Q — без пост-эффекта.",
      afterEffectStatMods: { ws:-10, bs:-10, s:-10, t:-10, ag:-10, int:-10, per:-10, wp:-10, fel:-10 },
      addiction: { hasAddiction: true, minDose: 14, testChar: "t", testMod: 20, frequency: "12 часов",
                   penalty: "−10 на тонкую манипуляцию и Ментальные действия" }
    }
  },
  {
    name: "Lho / Лхо", type: "drug", img: IMG,
    system: {
      description: "Никотиносодержащие сигареты из растений или синтеволокна, распространены повсеместно.",
      drugCategory: "narcotic", deliveryMethod: "smoke", availability: -2, quantity: 1,
      effect: "Лёгкое успокоение: +5 к сопротивлению Запугиванию/Подавлению/Страху на 1 час.",
      addiction: { hasAddiction: true, minDose: 7, testChar: "t", testMod: 30, frequency: "1 час",
                   penalty: "−10 на социальные взаимодействия, кроме Запугивания" }
    }
  },
  {
    name: "Recaf / Рекаф", type: "drug", img: IMG,
    system: {
      description: "Кофеиносодержащие напитки, горячие или холодные.",
      drugCategory: "narcotic", deliveryMethod: "liquid", availability: -2, quantity: 1,
      effect: "8 часов: штраф Усталости с −10 до −5; игнор штрафов нехватки сна; −10 vs наркотики/Усталость; +10 vs одержимость/психоз.",
      addiction: { hasAddiction: true, minDose: 7, testChar: "t", testMod: 40, frequency: "8 часов",
                   penalty: "−10 на социальные взаимодействия" }
    }
  },
  {
    name: "Clear / Ясность", type: "drug", img: IMG,
    system: {
      description: "Запрещённый стимулятор подулейных банд, дающий устойчивость к алкоголю и наркотикам.",
      drugCategory: "narcotic", deliveryMethod: "liquid", availability: -1, quantity: 1,
      effect: "8 часов: нельзя набрать больше 4 Провалов алкоголя; +10 на тесты T против ядов и наркотиков.",
      hasAfterEffect: true,
      afterEffect: "16 часов: ужасная мигрень, −10 на все тесты.",
      afterEffectStatMods: { ws:-10, bs:-10, s:-10, t:-10, ag:-10, int:-10, per:-10, wp:-10, fel:-10 },
      addiction: { hasAddiction: true, minDose: 2, testChar: "t", testMod: 10, frequency: "12 часов",
                   penalty: "зависимость от алкоголя, а не от Ясности" }
    }
  },
  {
    name: "Stimm / Стимм", type: "drug", img: IMG,
    system: {
      description: "Массовый стимулятор из солдатской аптечки: короткий, но мощный прилив сил.",
      drugCategory: "narcotic", deliveryMethod: "injection", availability: -1, quantity: 1, duration: "3d10",
      effect: "3d10 Раундов: игнорирует Усталость и урон в Характеристики. За каждый пункт Усталости сверх порога — 1d5 непоглощ. R/Ход.",
      specialEffects: { customEffect: "Игнорирует Усталость и урон в Характеристики на время действия." },
      hasAfterEffect: true,
      afterEffect: "1 час: −20 на все тесты S, T и Ag.",
      afterEffectStatMods: { s: -20, t: -20, ag: -20 },
      addiction: { hasAddiction: true, minDose: 3, testChar: "t", testMod: 10, frequency: "3 дня",
                   penalty: "−20 на все тесты S, T и Ag" }
    }
  },
  {
    name: "Spur / Шпора", type: "drug", img: IMG,
    system: {
      description: "Мощный боевой стимулятор для особо опасных боёв ценой истощения и аддиктивности.",
      drugCategory: "narcotic", deliveryMethod: "liquid", availability: -1, quantity: 1, duration: "2d10",
      effect: "2d10 Раундов: не может быть Оглушён, игнорирует эффекты Усталости.",
      hasAfterEffect: true,
      afterEffect: "1 час: Усталость до T.b+W.b; −20 на тесты T и Ag; нельзя снимать Усталость ниже T.b+W.b.",
      afterEffectStatMods: { t: -20, ag: -20 },
      addiction: { hasAddiction: true, minDose: 2, testChar: "t", testMod: -10, frequency: "1 день",
                   penalty: "−20 на тесты T и Ag" }
    }
  },
  {
    name: "Sweep / Смах", type: "drug", img: IMG,
    system: {
      description: "Аддиктивный химикат для лечения наркозависимости, притупляющий чувства.",
      drugCategory: "narcotic", deliveryMethod: "injection", availability: -1, quantity: 1,
      effect: "Немедленно избавляет от зависимости от всех наркотиков, кроме Смаха.",
      specialEffects: { customEffect: "Снимает зависимости (кроме самого Смаха)." },
      hasAfterEffect: true,
      afterEffect: "1d5 минут: −10 на тесты A и P; −20 на тесты избавления от зависимости.",
      afterEffectStatMods: { ag: -10, per: -10 },
      addiction: { hasAddiction: true, minDose: 1, testChar: "wp", testMod: -20, frequency: "1 день",
                   penalty: "−10 на тесты A и P" }
    }
  },
  {
    name: "Obscura / Обскура", type: "drug", img: IMG,
    system: {
      description: "Рекреационный наркотик, вызывающий спокойствие и эйфорию; запрещён почти везде.",
      drugCategory: "narcotic", deliveryMethod: "smoke", availability: -1, quantity: 1, duration: "2d10",
      effect: "2d10 минут: не более полудействия/Ход (если не тест W+10); иммунитет к Страху/Запугиванию; +30 на тесты против ментальных расстройств; восприимчив к терапии.",
      hasAfterEffect: true,
      afterEffect: "1d5 минут: −30 на все ментальные тесты.",
      afterEffectStatMods: { wp: -30 },
      addiction: { hasAddiction: true, minDose: 1, testChar: "wp", testMod: -20, frequency: "1 день",
                   penalty: "−30 на ментальные действия, не на добычу дозы" }
    }
  },
  {
    name: "Frenzon / Френзон", type: "drug", img: IMG,
    system: {
      description: "Семейство боевых наркотиков, вгоняющих в боевое безумие.",
      drugCategory: "narcotic", deliveryMethod: "injection", availability: 0, quantity: 1, duration: "1d10",
      effect: "Немедленно входит в Ярость и не может выйти 1d10 Ходов.",
      specialEffects: { customEffect: "Ярость (Frenzy) на 1d10 Ходов, выйти нельзя." },
      hasAfterEffect: true,
      afterEffect: "1d5 Усталости.",
      afterEffectSpecial: { grantsFatigue: 1 },
      addiction: { hasAddiction: true, minDose: 4, testChar: "wp", testMod: 40, frequency: "1 день",
                   penalty: "−50 на тесты I и F, общается простыми фразами" }
    }
  },
  {
    name: "Hyperexia / Гиперексия", type: "drug", img: IMG,
    system: {
      description: "Стимулятор исследователей и проспекторов экстремальных миров — устойчивость к нагрузкам.",
      drugCategory: "narcotic", deliveryMethod: "injection", availability: 0, quantity: 1, duration: "60",
      effect: "1 час: Преимущество на тесты T; +10 против жара и холода.",
      hasAfterEffect: true,
      afterEffect: "1 Усталость; −10 на физические действия (тонус мышц); −2 к Инициативе.",
      afterEffectSpecial: { grantsFatigue: 1 },
      addiction: { hasAddiction: true, minDose: 7, testChar: "t", testMod: 30, frequency: "1 день",
                   penalty: "−10 на все физические действия" }
    }
  },
  {
    name: "Sandstone / Песчаник", type: "drug", img: IMG,
    system: {
      description: "Синтезированный из растений миров смерти; укрепляет нюх, но даёт звон/шум.",
      drugCategory: "narcotic", deliveryMethod: "gas_eye", availability: 0, quantity: 1, duration: "1d5+3",
      effect: "1d5+3 Ходов: +20 на все тесты W, но −20 на все тесты нюха.",
      statMods: { wp: 20 },
      hasAfterEffect: true,
      afterEffect: "−20 на все тесты и потеря нюха (пока штраф сохраняется).",
      afterEffectStatMods: { ws:-20, bs:-20, s:-20, t:-20, ag:-20, int:-20, per:-20, wp:-20, fel:-20 }
    }
  },
  {
    name: "Scav-Glysten / Скав-глистен", type: "drug", img: IMG,
    system: {
      description: "Рафинированная жидкость из отходов фабрик трупного крахмала; маскирует запах и феромоны.",
      drugCategory: "narcotic", deliveryMethod: "liquid", availability: 0, quantity: 1,
      effect: "Через 30 минут и в течение 8 часов: запах не оставляет следа для выслеживания; +30 vs заражённые болезнями раны; кожа чешется 1d5 минут (−10 на тесты T и +20 vs выслеживание по запаху)."
    }
  },
  {
    name: "Ripper / Потрошитель", type: "drug", img: IMG,
    system: {
      description: "Грубый наркотик из жира экзотических рыб: ускорение, эйфория, усиленная чувствительность.",
      drugCategory: "narcotic", deliveryMethod: "injection", availability: 0, quantity: 1, duration: "60",
      effect: "1 час: +30 на тесты A и P; +10 к Инициативе. При непоглощённом уроне — тест T+0 или своё действие на агрессию.",
      statMods: { ag: 30, per: 30 },
      hasAfterEffect: true,
      afterEffect: "Наносит 1d10 урона в P.",
      afterEffectCharDamage: { stat: "per", formula: "1d10" },
      addiction: { hasAddiction: true, minDose: 3, testChar: "t", testMod: 10, frequency: "1 день" }
    }
  },
  {
    name: "Slaught / Тиск (Slaught)", type: "drug", img: IMG,
    system: {
      description: "Боевой наркотик ускоренного восприятия, позволяющий двигаться с потрясающей скоростью.",
      drugCategory: "narcotic", deliveryMethod: "injection", availability: 0, quantity: 1, duration: "2d10",
      effect: "2d10 минут: +30 к A и P, +1 дополнительная Реакция.",
      statMods: { ag: 30, per: 30 },
      hasAfterEffect: true,
      afterEffect: "3d10 урона в P; в начале каждого периода частоты — 1d5−1 урона в P; не восстанавливает I, P, W, F сверхъестественными методами.",
      afterEffectCharDamage: { stat: "per", formula: "3d10" },
      addiction: { hasAddiction: true, minDose: 2, testChar: "t", testMod: 10, frequency: "1 день",
                   penalty: "1d5−1 урона в P" }
    }
  },
  {
    name: "Stimul / Стимул", type: "drug", img: IMG,
    system: {
      description: "Стимулятор для боевой готовности днями без отдыха и маршей ценой ужасной цены.",
      drugCategory: "narcotic", deliveryMethod: "injection", availability: 0, quantity: 1, duration: "T.b+2",
      effect: "T.b+2 суток: не нужен сон, нет Усталости от марша (Talant Sprint). +биологический возраст 1d5 месяцев/доза.",
      specialEffects: { noSleepNeeded: true, noFatigueFromMarch: true },
      hasAfterEffect: true,
      afterEffect: "5d10 урона в S И в A (по большему кубику). Урон в A — ГМ применяет вручную/вторым запуском.",
      afterEffectCharDamage: { stat: "s", formula: "5d10" }
    }
  },
  {
    name: "Tiresias / Тиресий", type: "drug", img: IMG,
    system: {
      description: "Стимулятор сверхвысокой чувствительности и пространственной ориентации.",
      drugCategory: "narcotic", deliveryMethod: "injection", availability: 0, quantity: 1, duration: "2*Per.b",
      effect: "2×P.b Ходов: Unnatural Senses (P.b) (+30), +1 Реакция. Союзники вне радиуса — Linguistics+20, чтобы разобрать речь.",
      statMods: { per: 30 },
      hasAfterEffect: true,
      afterEffect: "1d5 Усталость; до 4 Провалов на ментальные тесты в течение времени.",
      afterEffectSpecial: { grantsFatigue: 1 },
      addiction: { hasAddiction: true, minDose: 4, testChar: "wp", testMod: 10, frequency: "1 день" }
    }
  },
  {
    name: "Wyrder / Виридитель", type: "drug", img: IMG,
    system: {
      description: "Дистиллированный из плесневых грибов Культов Хаоса; обезоруживает молодых псайкеров.",
      drugCategory: "narcotic", deliveryMethod: "liquid", availability: 1, quantity: 1,
      effect: "Не псайкер: Ступор 2d5 минут. Псайкер: W.b+5 минут не может манифестировать психосилы; 2 Феномена (бросок без модификаторов, перебрасывает 75+).",
      hasAfterEffect: true,
      afterEffect: "Наносит 1d10 урона в W.",
      afterEffectCharDamage: { stat: "wp", formula: "1d10" }
    }
  },
  {
    name: "Flect / Флект", type: "drug", img: IMG,
    system: {
      description: "Осколки демонического мира, вдыхающие безумные образы; запрещены повсеместно.",
      drugCategory: "narcotic", deliveryMethod: "smoke", availability: 1, quantity: 1,
      effect: "Ступор 1 Раунд, затем 4 часа иммунитет к Страху/Запугиванию/расстройствам; снимает ментальные расстройства. Псайкер бросает d100 Феномен (35+ → Феномен).",
      hasAfterEffect: true,
      afterEffect: "1d5 Усталость; на 1-3 Провала 1 Порча (макс 60) или Феномен W+30−10×Провал; при Критическом — расстройство Мёртвый Внутри.",
      afterEffectSpecial: { grantsFatigue: 1 },
      addiction: { hasAddiction: true, minDose: 4, testChar: "wp", testMod: -20, frequency: "6 дней",
                   penalty: "−30 на ментальные действия, направленные не на добычу флекта" }
    }
  },
  {
    name: "Greyve / Грейв", type: "drug", img: IMG,
    system: {
      description: "Притупляет восприятие мира, убирая страх перед смертью и болью.",
      drugCategory: "narcotic", deliveryMethod: "injection", availability: 1, quantity: 1, duration: "2d5",
      effect: "2d5 часов: иммунитет к Страху/Запугиванию/панике, но +1 Усталость за каждый Провал встречных социальных тестов.",
      hasAfterEffect: true,
      afterEffect: "Тест T+0, иначе 1 Усталость и апатия (−штрафы к социальным тестам).",
      afterEffectSpecial: { grantsFatigue: 1 },
      addiction: { hasAddiction: true, minDose: 5, testChar: "t", testMod: 10, frequency: "1 день",
                   penalty: "1 Усталость каждый Провал" }
    }
  },
  {
    name: "Karrikan Red-Eye / Карриканский Красноглаз", type: "drug", img: IMG,
    system: {
      description: "Стимулятор охотников: тепловидение и расширенное восприятие ценой цветового зрения.",
      drugCategory: "narcotic", deliveryMethod: "injection", availability: 1, quantity: 1, duration: "1d5",
      effect: "1d5 часов: тепловидение, видит тепло в темноте; но теряет цветовое зрение.",
      hasAfterEffect: true,
      afterEffect: "Наносит 2d10 урона в P; на 1 день теряет цветовое зрение.",
      afterEffectCharDamage: { stat: "per", formula: "2d10" },
      addiction: { hasAddiction: true, minDose: 5, testChar: "t", testMod: 20, frequency: "1 день",
                   penalty: "теряет восприятие цвета" }
    }
  },
  {
    name: "Rose / Роза", type: "drug", img: IMG,
    system: {
      description: "Изысканный наркотик аристократов и культистов Слаанеш, обостряющий чувства.",
      drugCategory: "narcotic", deliveryMethod: "smoke", availability: 1, quantity: 1, duration: "3",
      effect: "3 часа: +30 к P (Trait Night Vision при P.b≥...). Если набрал 5+ Успехов — Ступор 1d5 Раундов.",
      statMods: { per: 30 },
      hasAfterEffect: true,
      afterEffect: "Теряет вкус, обоняние и осязание; −40 на тесты P; стимы не приносят наслаждения.",
      addiction: { hasAddiction: true, minDose: 1, testChar: "wp", testMod: -40, frequency: "6 дней",
                   penalty: "−40 P, стимы не приносят наслаждения" }
    }
  },

  // ── Наркотики (боевые стимуляторы) ──────────────────────────────────────────

  {
    name: "Barkweed Juice / Корольсовый Сок", type: "drug", img: IMG,
    system: {
      description: "Растение демонических миров Слаанеш: даёт скорость и подвижность опытного ветерана.",
      drugCategory: "narcotic", deliveryMethod: "liquid", availability: 1, quantity: 1, duration: "T.b",
      effect: "T.b Раундов: Lightning Reflexes + Rapid Reaction + Unnatural Ag (+1) + Unnatural W (+1).",
      hasAfterEffect: true,
      afterEffect: "Наносит 1d5 урона в A.",
      afterEffectCharDamage: { stat: "ag", formula: "1d5" }
    }
  },
  {
    name: "Barrage / Шквал", type: "drug", img: IMG,
    system: {
      description: "Мощный боевой стимулятор: сила и стойкость ценой истощения мышц.",
      drugCategory: "narcotic", deliveryMethod: "injection", availability: 1, quantity: 1, duration: "T.b",
      effect: "T.b минут: +2×T.b временных Ран и Unnatural S (+5).",
      hasAfterEffect: true,
      afterEffect: "1d5 урона в A и Оглушение 1d5 Раундов; уменьшает свои S и T на 20.",
      afterEffectCharDamage: { stat: "ag", formula: "1d5" },
      afterEffectStatMods: { s: -20, t: -20 },
      afterEffectSpecial: { grantsCondition: "stunned", grantsConditionLevel: 1 },
      addiction: { hasAddiction: true, minDose: 3, testChar: "t", testMod: 30, frequency: "1 день",
                   penalty: "−20 к S и T" }
    }
  },
  {
    name: "Eszielle / Эциал", type: "drug", img: IMG,
    system: {
      description: "Препарат Инквизиции для внедрения в культы Хаоса: имитирует душу, опороченную Хаосом.",
      drugCategory: "narcotic", deliveryMethod: "injection", availability: 1, quantity: 1,
      effect: "Сутки: засекается как Хаосит с Cor 45; возможна малозаметная мутация. В это время — Deceive(I)+0 vs Scrutiny(I)+0, иначе подсознательно выдаёт ложную информацию.",
      hasAfterEffect: true,
      afterEffect: "Тест W+0 или получить 1 Порчу. Хаоситы с Cor 60+ иммунны к пост-эффекту."
    }
  },

  {
    name: "Mortis / Мортис", type: "drug", img: IMG,
    system: {
      description: "Густой чёрный эликсир для имитации смерти; опыт приближения к смерти ищут любители острых ощущений.",
      drugCategory: "narcotic", deliveryMethod: "liquid", availability: 2, quantity: 1, duration: "4d10",
      effect: "4d10 минут: глубокий анабиоз, неотличимый от смерти — без сознания и беспомощен; Medicae меньше 5 Успехов определяет как труп.",
      specialEffects: { grantsCondition: "unconscious", grantsConditionLevel: 1 },
      hasAfterEffect: true,
      afterEffect: "1 час: −20 на все тесты и автопровал тестов Страха, Подавления и сопротивления Запугиванию.",
      afterEffectStatMods: { ws:-20, bs:-20, s:-20, t:-20, ag:-20, int:-20, per:-20, wp:-20, fel:-20 },
      addiction: { hasAddiction: true, minDose: 2, testChar: "wp", testMod: 40, frequency: "1 день",
                   penalty: "−5 на тесты W и F; иначе тест W+0" }
    }
  },
  {
    name: "Polymorphine / Полиморфин", type: "drug", img: IMG,
    system: {
      description: "Делает плоть текучей и податливой: смена цвета/тона кожи, голоса, формы лица, пола, размера. Имплант ассасинов Каллидус раскрывает потенциал полностью.",
      drugCategory: "narcotic", deliveryMethod: "injection", availability: 2, quantity: 1,
      effect: "За полное действие меняет внешность по числу Успехов: цвет/тон кожи и голос (1 Усп.), форма лица (2), пол ±20% (3), форма тела ±20% (4), на другого гуманоида (5).",
      hasAfterEffect: true,
      afterEffect: "Наносит 2d10+5 урона в A.",
      afterEffectCharDamage: { stat: "ag", formula: "2d10+5" },
      addiction: { hasAddiction: true, minDose: 1, testChar: "wp", testMod: -20, frequency: "9 дней",
                   penalty: "−10 на все ментальные действия" }
    }
  },
  {
    name: "Puremind / Чисторазум", type: "drug", img: IMG,
    system: {
      description: "Дистиллят из сока редких рыцарских миров; стимулятор переговорщиков и торговцев.",
      drugCategory: "narcotic", deliveryMethod: "injection", availability: 2, quantity: 1, duration: "60",
      effect: "1 час: +30 на встречные тесты против социальных взаимодействий; +10 на соц. взаимодействия (кроме Commerce и Intimidate).",
      statMods: { fel: 10 },
      addiction: { hasAddiction: true, minDose: 1, testChar: "wp", testMod: 10, frequency: "3 дня",
                   penalty: "ментальное расстройство Мания Преследования (тяжесть 0)" }
    }
  },
  {
    name: "Satrophine / Сатрофин", type: "drug", img: IMG,
    system: {
      description: "Боевой наркотик Тёмных Механикус, наполняющий мышцы и кости силой Варпа.",
      drugCategory: "narcotic", deliveryMethod: "injection", availability: 2, quantity: 1, duration: "60",
      effect: "1 час: +30 к S, T, A и P.",
      statMods: { s: 30, t: 30, ag: 30, per: 30 },
      hasAfterEffect: true,
      afterEffect: "1d5 Усталость; в начале каждого периода частоты — 1d5 урона в W и не восстанавливает W сверхъест.; при 0 W — анабиоз под контролем ГМа.",
      afterEffectCharDamage: { stat: "wp", formula: "1d5" },
      afterEffectSpecial: { grantsFatigue: 1 },
      addiction: { hasAddiction: true, minDose: 1, testChar: "wp", testMod: 0, frequency: "1 день",
                   penalty: "1d5 урона в W за период" }
    }
  },
  {
    name: "Spook / Призрак", type: "drug", img: IMG,
    system: {
      description: "Дистиллят из крови могучего колдуна: даёт одарённым силу, а иногда — дар псайкера.",
      drugCategory: "narcotic", deliveryMethod: "gas", availability: 2, quantity: 1, duration: "1d5",
      effect: "1d5 минут: псайкер без ограничений; не-псайкер-чернокнижник получает Trait Psyker (PR 2) и 2 случайные психосилы; иначе +2 к 1 PR и манифестация как обычный псайкер. +25 на броски Феноменов.",
      hasAfterEffect: true,
      afterEffect: "Псайкеры и чернокнижники не получают низших пост-эффектов; не-псайкеры получают 1d5+5 Порчи.",
      addiction: { hasAddiction: true, minDose: 1, testChar: "wp", testMod: 0, frequency: "1 день",
                   penalty: "−10 на социальные взаимодействия" }
    }
  },
  {
    name: "Thanzex / Танзекс", type: "drug", img: IMG,
    system: {
      description: "Гормональные выделения мутировавшей Сус-Ан Мембраны (Тёмные Механикус): анимация на грани смерти, как у Астартес.",
      drugCategory: "narcotic", deliveryMethod: "injection", availability: 2, quantity: 1,
      effect: "Глубокий анабиоз, неотличимый от смерти; Medicae меньше 5 Успехов — труп. При применении к умершему <1 минуты назад — тест Medicae−40 (12 Успехов = часов), Неудача → потеря конечности/смерть.",
      specialEffects: { grantsCondition: "unconscious", grantsConditionLevel: 1 },
      hasAfterEffect: true,
      afterEffect: "Сразу после пробуждения тест W+0 или 1 Порча. На 1d5 дней персонаж может перенять чужие мировоззрение/любовь/вражду/мораль."
    }
  },
  {
    name: "Blue Fire / Синий Огонь", type: "drug", img: IMG,
    system: {
      description: "Небесно-синее пламя: вдохнувший получает доступ к психическим силам, глаза светятся ярко-синим.",
      drugCategory: "narcotic", deliveryMethod: "gas", availability: 3, quantity: 1, duration: "2*Per.b",
      effect: "2×P.b Раундов: псайкер получает Trait Psyker (PR1), +Precognitive Dodge/Strike; не-псайкер не может манифестировать в Безопасном режиме; глаза светятся.",
      hasAfterEffect: true,
      afterEffect: "Тест T−10 (как яд); 1+ Провал — глаза перманентно меняют цвет; 3+ Провала — светятся 9 дней; на это время −20 Stealth в темноте.",
      addiction: { hasAddiction: true, minDose: 1, testChar: "wp", testMod: -20, frequency: "1 день",
                   penalty: "Талант Paranoia, −20 на любые социальные взаимодействия" }
    }
  },
  {
    name: "D-Dust / Д-Пыль", type: "drug", img: IMG,
    system: {
      description: "Пыль из растираний Камня Душ Эльдар: при вдыхании/втирании в дёсны придаёт демонические свойства.",
      drugCategory: "narcotic", deliveryMethod: "pill", availability: 3, quantity: 1, duration: "2d5",
      effect: "Тест W+20 (как яд), 2d5 Раундов: 1+ Успех — Trait Daemonic (3); 2+ — Trait Phase; 3+ — Trait Warp Weapon. Провал → 1 Порча.",
      hasAfterEffect: true,
      afterEffect: "Тест W+20 (как яд), иначе без сознания 6 дней (засекается как демон Слаанеш).",
      addiction: { hasAddiction: true, minDose: 2, testChar: "wp", testMod: -10, frequency: "1 день",
                   penalty: "Талант Hatred (Eldar), иначе −30 на все тесты" }
    }
  },
  {
    name: "Commorrite Combat Drugs / Коммориттские Боевые Наркотики", type: "drug", img: IMG,
    system: {
      description: "Боевые наркотики Тёмных Эльдар: низкая аддиктивность и отсутствие побочных эффектов, разные виды.",
      drugCategory: "narcotic", deliveryMethod: "injection", availability: 3, quantity: 1, duration: "5",
      effect: "5 минут (вид указывается отдельно): Adrenasept (доп. атака в рукопашной 1 раз/Раунд), Mogilny Lotos (+1 кубик урона в рукопашной), Hyleks (+5 SPD и +1 Реакция), Bolenec (уменьшает урон ядов), Serpentin (+30 vs W).",
      addiction: { hasAddiction: true, minDose: 14, testChar: "wp", testMod: 30, frequency: "1 день",
                   penalty: "−10 на все действия; нельзя снимать последний уровень Усталости" }
    }
  },
  {
    name: "Scab / Струп", type: "drug", img: IMG,
    system: {
      description: "Жёлто-зелёная жидкость из гноя (Метки Нургла): иммунитет к болезням ценой здоровья.",
      drugCategory: "narcotic", deliveryMethod: "smoke", availability: 3, quantity: 1, duration: "60",
      effect: "1 час: Traits Unnatural T (+2) и Stuff of Nightmares; иммунитет к негативным эффектам болезней.",
      hasAfterEffect: true,
      afterEffect: "Наносит 1d10 урона в T; в потоке рвоты — Оглушение 1d10 Раундов; иногда 1 Порча.",
      afterEffectCharDamage: { stat: "t", formula: "1d10" },
      afterEffectSpecial: { grantsCondition: "stunned", grantsConditionLevel: 1 }
    }
  },

  // ═════════════════════════════════ ЭЛИКСИРЫ ═════════════════════════════════
  // Эликсиры не имеют пост-эффектов и не вызывают зависимости.

  {
    name: "Earthblood / Кровь Земли", type: "drug", img: IMG,
    system: {
      description: "Колдовской эликсир жизненной силы покидающего тело духа.",
      drugCategory: "elixir", deliveryMethod: "injection", availability: 3, quantity: 1, duration: "1d10",
      effect: "1d10 Раундов: Trait Regeneration (5) — в конце каждого Хода прекращает Кровотечение и лечит раны.",
      specialEffects: { removesCondition: "bleeding", removesConditionLevel: 0,
                        healsWoundsPerRound: "5",
                        customEffect: "Regeneration (5): лечит 5 Ран и снимает Кровотечение в конце каждого Хода." }
    }
  },
  {
    name: "Heartfire / Очаг", type: "drug", img: IMG,
    system: {
      description: "Колдовской эликсир бодрости.",
      drugCategory: "elixir", deliveryMethod: "liquid", availability: 3, quantity: 1,
      effect: "Снимает всю Усталость и считается 8 часов полноценным сном.",
      specialEffects: { noSleepNeeded: true,
                        customEffect: "Снимает всю Усталость; 8 часов считается сном (обнулите Усталость вручную/через «Сон»)." }
    }
  },
  {
    name: "Spring / Источник", type: "drug", img: IMG,
    system: {
      description: "Колдовской эликсир восстановления.",
      drugCategory: "elixir", deliveryMethod: "liquid", availability: 3, quantity: 1,
      effect: "Восстанавливает 3d5 урона в Характеристику по выбору (или в случайно повреждённую, если нет выбора). Снимите урон в характеристику у соответствующего пост-эффекта вручную.",
      specialEffects: { customEffect: "Восстанавливает 3d5 урона в выбранную Характеристику." }
    }
  },
  {
    name: "Glade / Роща", type: "drug", img: IMG,
    system: {
      description: "Колдовской эликсир очищения.",
      drugCategory: "elixir", deliveryMethod: "liquid", availability: 3, quantity: 1, duration: "10",
      effect: "Исцеляет все яды и болезни и на 10 Раундов даёт иммунитет к ядам и болезням.",
      specialEffects: { removesCondition: "poisoned", removesConditionLevel: 0, immuneToPoisons: true,
                        customEffect: "Исцеляет болезни; 10 Раундов иммунитет к ядам и болезням." }
    }
  },
  {
    name: "Purity / Чистота", type: "drug", img: IMG,
    system: {
      description: "Колдовской эликсир очищения от химии.",
      drugCategory: "elixir", deliveryMethod: "liquid", availability: 4, quantity: 1,
      effect: "Прекращает все эффекты и пост-эффекты химикатов и избавляет от зависимости от наркотиков.",
      specialEffects: { counteractsDrugs: true,
                        customEffect: "Избавляет от всех зависимостей (снимите их в панели Зависимостей)." }
    }
  },
  {
    name: "Sanctum / Святилище", type: "drug", img: IMG,
    system: {
      description: "Колдовской эликсир защиты от Варпа.",
      drugCategory: "elixir", deliveryMethod: "liquid", availability: 4, quantity: 1, duration: "10",
      effect: "На 10 Раундов даёт иммунитет к демонической одержимости.",
      specialEffects: { customEffect: "10 Раундов иммунитет к демонической одержимости." }
    }
  },
  {
    name: "Still / Тишь", type: "drug", img: IMG,
    system: {
      description: "Колдовской эликсир спокойствия Варпа.",
      drugCategory: "elixir", deliveryMethod: "liquid", availability: 4, quantity: 1, duration: "10",
      effect: "Даёт −50 на следующий бросок Феноменов в течение 10 Раундов.",
      specialEffects: { customEffect: "−50 на следующий бросок Феноменов (10 Раундов)." }
    }
  },
  {
    name: "Vigour / Здравие", type: "drug", img: IMG,
    system: {
      description: "Колдовской эликсир исцеления.",
      drugCategory: "elixir", deliveryMethod: "liquid", availability: 4, quantity: 1,
      effect: "Восстанавливает 3d5 Ран и немедленно прекращает Кровотечение и эффект Crippling.",
      specialEffects: { healFormula: "3d5", removesCondition: "bleeding", removesConditionLevel: 0,
                        customEffect: "Также прекращает Crippling." }
    }
  },

  // ══════════════════════════════════════ ЯДЫ ═════════════════════════════════
  // Яды применяются к жертве (на оружие/еду), жертва проходит тест.
  // Вектор и тест заданы в полях яда (вкладка предмета).

  {
    name: "Choking Gas / Душащий Газ", type: "drug", img: IMG,
    system: {
      description: "Один из сотен разнообразных смертельных газов, впитывающихся через лёгкие и дыхательные пути.",
      drugCategory: "poison", deliveryMethod: "gas", availability: 0, quantity: 1,
      effect: "Газовая бомба; число доз зависит от объёма.",
      poisonVector: ["gas_contact"], poisonTestChar: "t", poisonTestMod: 0,
      poisonEffect: "Качество задаёт силу: Poor.Q — Toxic (1), Good.Q — Toxic (2), Best.Q — Toxic (3)."
    }
  },
  {
    name: "Deadly Poison / Смертельная Отрава", type: "drug", img: IMG,
    system: {
      description: "Пищевой яд, добавляемый в еду или питьё жертвы.",
      drugCategory: "poison", deliveryMethod: "food", availability: 0, quantity: 1,
      effect: "Через минуту после приёма — тест T−10.",
      poisonVector: ["food"], poisonTestChar: "t", poisonTestMod: -10,
      poisonEffect: "Провал → 1d10 непоглощаемого S урона в торс; повторять тест каждую минуту, пока не умрёт или не пройдёт." }
  },
  {
    name: "Deadly Venom / Смертельный Яд", type: "drug", img: IMG,
    system: {
      description: "Сборная солянка тысяч ядов для покрытия клинков, стрел и инъекций.",
      drugCategory: "poison", deliveryMethod: "wound", availability: 0, quantity: 1,
      effect: "Наносится на оружие/боеприпас.",
      poisonVector: ["wound", "injection"], poisonTestChar: "t", poisonTestMod: 0,
      poisonEffect: "Качество: Poor.Q — Toxic (0), Comm.Q — Toxic (1), Good.Q — Toxic (2), Best.Q — Toxic (3)." }
  },
  {
    name: "Tear Gas / Слезоточивый Газ", type: "drug", img: IMG,
    system: {
      description: "Массово используется законниками для разгона протестов и бунтов.",
      drugCategory: "poison", deliveryMethod: "gas", availability: 0, quantity: 1,
      effect: "Действует на кожу и глаза.",
      poisonVector: ["contact", "gas_eye"], poisonTestChar: "t", poisonTestMod: -10,
      poisonEffect: "Кожа: тест T−10, иначе зуд и штраф к действиям с поражённой кожей. Глаза: T−10 или Ослеплён, затем −30 WS/BS (Blind Fighting нивелирует)." }
  },

  {
    name: "Deadlock / Тупик", type: "drug", img: IMG,
    system: {
      description: "Паралитический яд: мышцы замедляются, затем замирают, как у статуи.",
      drugCategory: "poison", deliveryMethod: "wound", availability: 1, quantity: 1,
      effect: "Тест T−10 при попадании.",
      poisonVector: ["wound", "injection"], poisonTestChar: "t", poisonTestMod: -10,
      poisonEffect: "Провал → 1d10 урона в A и торпор; за каждый Провал — нарастающее замедление." }
  },
  {
    name: "Hallucinogen / Галлюциноген", type: "drug", img: IMG,
    system: {
      description: "Яд буйных галлюцинаций и помутнения разума.",
      drugCategory: "poison", deliveryMethod: "gas", availability: 1, quantity: 1,
      effect: "Тест при контакте.",
      poisonVector: ["wound", "injection", "gas_contact"], poisonTestChar: "t", poisonTestMod: 0,
      poisonEffect: "Качество: Poor.Q — Hallucinogenic (1), Good.Q — (2), Best.Q — (3)." }
  },
  {
    name: "Midnighter / Полуночник", type: "drug", img: IMG,
    system: {
      description: "Яд, накатывающий волну усталости, часто валящий жертву в дрёму.",
      drugCategory: "poison", deliveryMethod: "gas", availability: 1, quantity: 1,
      effect: "Тест T+10.",
      poisonVector: ["gas_contact"], poisonTestChar: "t", poisonTestMod: 10,
      poisonEffect: "Провал → +1 Усталость на каждый нечётный Провал (1,3,5,7…)." }
  },
  {
    name: "Thorn / Шип", type: "drug", img: IMG,
    system: {
      description: "Ядовитый газ, ослабляющий тонус мышц; популярен у охотников.",
      drugCategory: "poison", deliveryMethod: "gas", availability: 1, quantity: 1,
      effect: "Тест T−10.",
      poisonVector: ["gas_contact"], poisonTestChar: "t", poisonTestMod: -10,
      poisonEffect: "Провал → 1d10 урона в WS, BS и S за каждый Провал." }
  },
  {
    name: "Tranq / Транк", type: "drug", img: IMG,
    system: {
      description: "Транквилизатор законников и охотников за головами.",
      drugCategory: "poison", deliveryMethod: "injection", availability: 1, quantity: 1,
      effect: "Тест T+0.",
      poisonVector: ["injection"], poisonTestChar: "t", poisonTestMod: 0,
      poisonEffect: "Провал → без сознания 1 час (обычные стимуляторы не пробуждают)." }
  },

  {
    name: "Untangler / Распутыватель", type: "drug", img: IMG,
    system: {
      description: "Сыворотка правды, доступная даже подулейным бандам.",
      drugCategory: "poison", deliveryMethod: "injection", availability: 2, quantity: 1,
      effect: "Тест T−20 (или 1d5 минут с напором).",
      poisonVector: ["injection"], poisonTestChar: "t", poisonTestMod: -20,
      poisonEffect: "Провал → не может лгать; Deceive со штрафом −60; напор даёт допрашивающему +30." }
  },
  {
    name: "Escape / Побег", type: "drug", img: IMG,
    system: {
      description: "Яд доверчивости, скрытно подмешиваемый в еду или питьё.",
      drugCategory: "poison", deliveryMethod: "food", availability: 2, quantity: 1,
      effect: "Тест T−40.",
      poisonVector: ["food"], poisonTestChar: "t", poisonTestMod: -40,
      poisonEffect: "Провалы → крайне доверчив; Deceive против него авто-успех." }
  },
  {
    name: "Childbless / Детское Благословение", type: "drug", img: IMG,
    system: {
      description: "Ярко-красная жидкость, временно подавляющая способность отличать правду ото лжи.",
      drugCategory: "poison", deliveryMethod: "food", availability: 2, quantity: 1,
      effect: "Тест T−40.",
      poisonVector: ["food"], poisonTestChar: "t", poisonTestMod: -40,
      poisonEffect: "Провалы → крайне доверчив; Deceive против жертвы авто-успех (кроме абсурдной лжи)." }
  },
  {
    name: "Mercurio / Меркурий", type: "drug", img: IMG,
    system: {
      description: "Мощное седативное, усыпляющее цель.",
      drugCategory: "poison", deliveryMethod: "injection", availability: 2, quantity: 1,
      effect: "Тест T−70.",
      poisonVector: ["injection"], poisonTestChar: "t", poisonTestMod: -70,
      poisonEffect: "Провал → в конце Хода засыпает на 1 час; накапливающийся штраф −5 на повторный тест." }
  },
  {
    name: "Mindwipe / Разумочист", type: "drug", img: IMG,
    system: {
      description: "Препарат очистки памяти Инквизиции и тайных организаций.",
      drugCategory: "poison", deliveryMethod: "injection", availability: 2, quantity: 1,
      effect: "Особое (5 Провалов).",
      poisonVector: ["injection"], poisonTestChar: "wp", poisonTestMod: 0,
      poisonEffect: "Ступор; теряет воспоминания последней сцены/минуты и формирует ложную версию." }
  },
  {
    name: "Rattle / Трещотка", type: "drug", img: IMG,
    system: {
      description: "Яд, мешающий жертве концентрироваться, вводящий в алкогольное опьянение.",
      drugCategory: "poison", deliveryMethod: "wound", availability: 2, quantity: 1,
      effect: "Тест T−10.",
      poisonVector: ["wound", "injection"], poisonTestChar: "t", poisonTestMod: -10,
      poisonEffect: "Провалы → не может использовать Ментальные действия." }
  },
  {
    name: "Throne / Трон", type: "drug", img: IMG,
    system: {
      description: "Желеобразный яд, впитывающийся в мебель и одежду; действует через часы.",
      drugCategory: "poison", deliveryMethod: "contact", availability: 2, quantity: 1,
      effect: "Тест T−10.",
      poisonVector: ["contact"], poisonTestChar: "t", poisonTestMod: -10,
      poisonEffect: "Провал → 1d10 непоглощаемого C урона в торс; повторять каждую минуту, пока не умрёт или не пройдёт." }
  },

  {
    name: "Agent Delta / Агент Дельта", type: "drug", img: IMG,
    system: {
      description: "Психоактивный наркотик Альфа-Легиона: записывает в разум жертвы команду (Обет).",
      drugCategory: "poison", deliveryMethod: "injection", availability: 3, quantity: 1,
      effect: "Активируется агентом; тест против Успехов псайкера-агента.",
      poisonVector: ["injection"], poisonTestChar: "wp", poisonTestMod: 0,
      poisonEffect: "Жертва получает Обет; провал — выполняет, успех — нет; не помнит. Разлагается за 15 минут." }
  },
  {
    name: "Agent Sigma / Агент Сигма", type: "drug", img: IMG,
    system: {
      description: "Модифицированный фильтр для сложных программируемых галлюцинаций (Мир Грёз).",
      drugCategory: "poison", deliveryMethod: "gas", availability: 3, quantity: 1,
      effect: "Запрограммированные галлюцинации.",
      poisonVector: ["gas_contact"], poisonTestChar: "wp", poisonTestMod: 0,
      poisonEffect: "Hallucinogenic (2) с фильтром Мир Грёз; активируется психосилой; разлагается, если не зарядить за 2 недели." }
  },
  {
    name: "Gate / Врата", type: "drug", img: IMG,
    system: {
      description: "Психотропный яд крайне реальных галлюцинаций демонов; опасен для псайкеров.",
      drugCategory: "poison", deliveryMethod: "wound", availability: 3, quantity: 1,
      effect: "Тест T−20.",
      poisonVector: ["wound", "injection"], poisonTestChar: "t", poisonTestMod: -20,
      poisonEffect: "Провал → 2d10 Раундов галлюцинации демонов в Истинной форме; псайкер реально призывает настоящих демонов." }
  },
  {
    name: "Mindmend / Разумочин", type: "drug", img: IMG,
    system: {
      description: "Препарат очистки и изменения памяти; укрепляющий результат.",
      drugCategory: "poison", deliveryMethod: "injection", availability: 3, quantity: 1,
      effect: "Особое (5 Провалов).",
      poisonVector: ["injection"], poisonTestChar: "wp", poisonTestMod: 0,
      poisonEffect: "Засыпает; через 30 минут стирает/изменяет воспоминания (телепатия). Стирание участков может вызвать ментальные расстройства." }
  },
  {
    name: "Morpeus / Морфей", type: "drug", img: IMG,
    system: {
      description: "Сверхмощное седативное для усыпления Астартес и огромных ксеносущ.",
      drugCategory: "poison", deliveryMethod: "injection", availability: 3, quantity: 1,
      effect: "1d5+1 Раундов.",
      poisonVector: ["injection"], poisonTestChar: "t", poisonTestMod: 0,
      poisonEffect: "Через 1d5+1 Раундов жертва засыпает на 1d10 часов (обычные стимуляторы не пробуждают; урон пробуждает)." }
  },
  {
    name: "Pale Tongue / Бледный Язык", type: "drug", img: IMG,
    system: {
      description: "Белоснежные кристаллы, способные отравить огромное количество воды; симптомы отложены.",
      drugCategory: "poison", deliveryMethod: "food", availability: 3, quantity: 1,
      effect: "Один кристалл отравляет до 100 тонн воды.",
      poisonVector: ["food"], poisonTestChar: "t", poisonTestMod: -10,
      poisonEffect: "Тест T−10; Провалы дней — не снимает Усталость отдыхом, каждый час тест T+0 или +1 Усталость; смерть при 2×T.b Усталости." }
  },
  {
    name: "Red Drop / Красная Капля", type: "drug", img: IMG,
    system: {
      description: "Производное Френзона: вгоняет жертву в буйное безумие, нападая на всё живое.",
      drugCategory: "poison", deliveryMethod: "injection", availability: 3, quantity: 1,
      effect: "Тест T−10 при попадании.",
      poisonVector: ["injection"], poisonTestChar: "t", poisonTestMod: -10,
      poisonEffect: "Провал → Ярость, выйти нельзя 1d5 Раундов за каждый Провал; атакует всех (своих/неодушевлённое — по ГМу)." }
  },
  {
    name: "Thrall Brand / Рабская Метка", type: "drug", img: IMG,
    system: {
      description: "Мистический яд, подавляющий защиту души перед силами Варпа.",
      drugCategory: "poison", deliveryMethod: "wound", availability: 3, quantity: 1,
      effect: "Тест T−20.",
      poisonVector: ["wound", "injection"], poisonTestChar: "t", poisonTestMod: -20,
      poisonEffect: "Провалы → автопровал встречных тестов против психосил, чародейских даров и демонической одержимости (1d10 Провалов)." }
  },
  {
    name: "Whiteblood / Белокровка", type: "drug", img: IMG,
    system: {
      description: "Яд худших кошмаров: жертва теряет лишний рассудок.",
      drugCategory: "poison", deliveryMethod: "injection", availability: 3, quantity: 1,
      effect: "Тест T−20.",
      poisonVector: ["injection"], poisonTestChar: "t", poisonTestMod: -20,
      poisonEffect: "Провалы Ходов → перебрасывает успешные тесты Страха/Подавления/сопротивления Запугиванию (рейтинг Страха 4)." }
  },
  {
    name: "Discharge / Разрядка", type: "drug", img: IMG,
    system: {
      description: "Мистический яд, проносящийся сквозь душу псайкера и высвобождающий силы Варпа.",
      drugCategory: "poison", deliveryMethod: "wound", availability: 4, quantity: 1,
      effect: "Опасен для псайкеров.",
      poisonVector: ["wound", "injection", "contact"], poisonTestChar: "t", poisonTestMod: -30,
      poisonEffect: "Псайкер: тест T−30 или манифестирует мощнейшую атакующую психосилу в Усиленном режиме по ближайшей цели." }
  },
  {
    name: "Lhamean Kiss / Ламийский Поцелуй", type: "drug", img: IMG,
    system: {
      description: "Шедевр отравителей Тёмных Эльдар: обойти противоядия невозможно, исход — агонизирующая смерть.",
      drugCategory: "poison", deliveryMethod: "injection", availability: 4, quantity: 1,
      effect: "Тест T−30.",
      poisonVector: ["injection"], poisonTestChar: "t", poisonTestMod: -30,
      poisonEffect: "Провал → −30 на все тесты, только полудействие, 1d5+1 непогл. C урона в голову/Раунд; Detox 1d8 (1−8 не выводит)." }
  },
  {
    name: "Mjod / Мёд", type: "drug", img: IMG,
    system: {
      description: "Смесь фенрисийских трав и интоксикантов; пьянит космодесантника, как хороший амасек — человека.",
      drugCategory: "poison", deliveryMethod: "food", availability: 4, quantity: 1,
      effect: "По-разному действует на Астартес и обычных людей.",
      poisonVector: ["food"], poisonTestChar: "t", poisonTestMod: 0,
      poisonEffect: "Космодесант: 1d5 часов Resistance (Poisons) + эффекты Преомнора/Оолитической Почки; для прочих — Best.Q Смертельная Отрава. Считается алкоголем." }
  },
  {
    name: "Shaimesh Wine / Вино Шаимеша", type: "drug", img: IMG,
    system: {
      description: "Без вкуса, запаха и абсолютно смертельно — вершина отравительного искусства Тёмных Эльдар.",
      drugCategory: "poison", deliveryMethod: "food", availability: 4, quantity: 1,
      effect: "Через 3 часа после приёма — тест T−10.",
      poisonVector: ["food"], poisonTestChar: "t", poisonTestMod: -10,
      poisonEffect: "Провал → 1d10 непогл. C урона в голову; повторять каждый Ход, пока не умрёт или не пройдёт (3 раза). Нейрологик не засекает." }
  },
  {
    name: "Sweet Milk / Сладкое Молоко", type: "drug", img: IMG,
    system: {
      description: "Белёсая сладко пахнущая жидкость из смертных оболочек, иссечённых демонами Слаанеш: видения сбываются.",
      drugCategory: "poison", deliveryMethod: "food", availability: 4, quantity: 1,
      effect: "Тест W−40.",
      poisonVector: ["food", "wound", "contact"], poisonTestChar: "wp", poisonTestMod: -40,
      poisonEffect: "Провал → Ступор; видения сбываются в реальность; в конце каждого Хода повтор теста, иначе глубокая депрессия на 1 час (штраф −10 на все тесты, кроме T)." }
  },
  {
    name: "TP-III / ТП-III", type: "drug", img: IMG,
    system: {
      description: "Болезненно-зелёное облако ужасного кислотного газа: разъедает броню, химзащиту и противогазы.",
      drugCategory: "poison", deliveryMethod: "gas", availability: 4, quantity: 1,
      effect: "Газ заправляется только в газовую бомбу.",
      poisonVector: ["gas_contact", "contact"], poisonTestChar: "t", poisonTestMod: -10,
      poisonEffect: "Контакт: Corrosive (1) во все части тела, 1d5 непогл. C урона/Ход; разъедает фильтр за пару Ходов. Газ: Toxic (4)." }
  },
  {
    name: "Genophage / Генофаг", type: "drug", img: IMG,
    system: {
      description: "Легендарный яд ассасинов-отравителей храма Венеnum: настроен на конкретную жертву, верная гибель.",
      drugCategory: "poison", deliveryMethod: "injection", availability: 5, quantity: 1,
      effect: "Нужен генетический материал жертвы (кровь, обрезок ногти/локон).",
      poisonVector: ["wound", "injection", "contact"], poisonTestChar: "t", poisonTestMod: 0,
      poisonEffect: "Настроенная жертва умирает в конце следующего Хода (без теста); Detox 1d10 (1−14 не выводит). Против остальных — Best.Q Смертельный Яд." }
  }

];
