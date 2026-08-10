/**
 * Бестиарий Друкхари — Warhammer DBC.
 *
 * Архетипы Тёмных Аэльдари Комморры (Кабалы, Культы Ведьм, Ковены Гемункулов,
 * Храмы Инкубов) для компендиума «Бестиарий». Заводится тем же ready-хуком, что
 * и остальной бестиарий (см. warhammer-dbc.mjs): массив спредится в
 * BESTIARY_LIBRARY (см. конец bestiary-library.mjs). Неразрушающее наполнение
 * по имени; снаряжение/способности (kit) резолвятся из компендиумов по токенам.
 *
 * Числа — стартовый ориентир для ГМа. Друкхарское оружие/броня/таланты уже
 * заведены в паки (aeldari-weapons, aeldari-armor, talents-library, chemistry).
 * Расовые Черты (Сверхъест. Ловкость/Восприятие 4, Проворный и пр.) вложены
 * ИНЛАЙН — чтобы бонусы гарантированно считались prepareDerivedData.
 *
 * Друкхари: НЕТ Очков Судьбы (Трейт «Безбожник»); вместо них — Очки Боли
 * (Трейт «Через Боль»). Поэтому fate = {0,0} у всех.
 */

const IMG = "icons/svg/mystery-man.svg";

// Характеристики из карты { ws, bs, ... }. total/bonus пересчитает актор.
const CH = (m) => {
  const o = {};
  for (const k of ["ws","bs","s","t","ag","int","per","wp","fel","inf"]) {
    const base = m[k] ?? 0;
    o[k] = { base, advance: 0, supernatural: 0, improvement: "none",
             total: base, bonus: Math.floor(base / 10), cost: 0 };
  }
  return o;
};

// Навыки из карты { skill: "rank" }.
const SK = (m) => {
  const o = {};
  for (const [k, rank] of Object.entries(m)) o[k] = { rank, cost: 0, total: 0 };
  return o;
};

// Инлайн-Черта с авто-эффектами (для расовых/субрасовых — гарантируем расчёт).
const FX0 = { charBonusStat: "", charBonusValue: 0, armourAll: 0, fearRating: 0, sizeMod: 0 };
const TRAIT = (name, benefit, effects = {}, rating = 0, hasRating = false) => ({
  inline: {
    name, type: "trait", img: "icons/svg/item-bag.svg",
    system: { description: "", benefit, source: "раса", hasRating, rating,
              hasRating2: false, rating2: 0, effects: { ...FX0, ...effects } }
  }
});

// Черта Страха с авто-эффектом fearRating.
const FEAR = (n, note) => ({
  inline: {
    name: `Fear (${n}) / Страх (${n})`, type: "trait", img: "icons/svg/terror.svg",
    system: { description: note || "", benefit: `Вызывает Страх (${n}) — цели проходят тест Воли.`,
              source: "", hasRating: true, rating: n, hasRating2: false, rating2: 0,
              effects: { ...FX0, fearRating: n } }
  }
});

// ─────────────────── Резолверы из компендиумов ───────────────────
const gun   = (q, extra = {}) => ({ pack: "weapons", q, equipped: true, ...extra });
const melee = (q, extra = {}) => ({ pack: "weapons", q, equipped: true, ...extra });
const armr  = (q, extra = {}) => ({ pack: "armor", q, equipped: true, ...extra });
const tal   = (q) => ({ pack: "talents", q });
const chem  = (q, extra = {}) => ({ pack: "chemistry", q, ...extra });
// Боеприпасы: 1 единица запаса = 1 магазин. qty — число запасных магазинов.
const amm   = (q, qty = 2) => ({ pack: "ammunition", q, qty });

// ─────────────────── Токены снаряжения (RU exact + EN) ───────────────────
// Стрелковое
const W = {
  splinterPistol: ["Осколочный Пистолет", "Splinter Pistol"],
  splinterRifle:  ["Осколочная Винтовка", "Splinter Rifle"],
  splinterCarbine:["Осколкарабин", "Splinter Carbine"],
  splinterCannon: ["Осколочная Пушка", "Splinter Cannon"],
  splinterSniper: ["Осколочная Винтовка «Пробиватель»", "Splinter Sniper"],
  shredder:       ["Шреддер", "Shredder"],
  blastPistol:    ["Бласт Пистолет", "Blast Pistol"],
  blaster:        ["Бластер", "Blaster"],
  darkLance:      ["Тёмное Копьё", "Dark Lance"],
  heatLance:      ["Тепловое Копьё", "Heat Lance"],
  hexRifle:       ["Сглаз-винтовка", "Hexrifle"],
  ossefactor:     ["Оссефактор", "Ossefactor"],
  liquifier:      ["Разжижитель", "Liquifier"],
  stinger:        ["Жало", "Stinger"],
  soulstring:     ["Струна Души", "Soul String"],
  disintegrator:  ["Дезинтегратор", "Disintegrator"],
  haywire:        ["Бластер Помех", "Haywire Blaster"],
  phantasm:       ["Гранатомёт Фантазм", "Phantasm"],
  terrorfex:      ["Террорфекс", "Terrorfex"]
};
// Рукопашное
const M = {
  klaive:      ["Клэйв", "Klaive"],
  demiklaive:  ["Полуклэйв", "Demiklaive"],
  djinnBlade:  ["Клинок Джинна", "Djin Blade"],
  punisher:    ["Каратель", "Punisher"],
  huskblade:   ["Клинок Обдиратель", "Huskblade"],
  agoniser:    ["Агонайзер", "Agoniser"],
  ecWhip:      ["Электрокоррозивный Хлыст", "Electrocorrosive Whip"],
  venomBlade:  ["Ядовитый Клинок", "Venom Blade"],
  shaimesh:    ["Клинок Шаимеша", "Blade of Shaimesh"],
  hekatarii:   ["Гекатрийский Клинок", "Hekatarii Blade"],
  wychBlade:   ["Ведьмин Клинок (Друкхари)", "Wych Blade"],
  succubusBl:  ["Клинок Суккуба", "Succubus Blade"],
  hellglaive:  ["Адская Глефа", "Hellglaive"],
  razorflail:  ["Бритвоцеп", "Razorflail"],
  shardnet:    ["Осколочная Сеть", "Shardnet"],
  hydraGaunt:  ["Перчатка Гидры", "Hydra Gauntlets"],
  impaler:     ["Пронзатель", "Impaler"],
  stunclaw:    ["Оглушающие Когти", "Stunclaw"],
  monoBlade:   ["Мономолекулярный Клинок", "Monofilament Blade"],
  glimmersteel:["Блестящий Клинок", "Glimmersteel Blade"],
  mindphase:   ["Мыслефазовая Перчатка", "Mindphase Gauntlet"],
  scissorhand: ["Рука-Ножницы", "Scissorhand"],
  fleshGaunt:  ["Перчатка Плоти", "Flesh Gauntlet"],
  amputator:   ["Ампутатор", "Amputator"]
};
// Броня
const A = {
  kabalite:   ["Кабалитская Броня", "Kabalite Armour"],
  wychSuit:   ["Ведьмин Костюм", "Wychsuit"],
  xenohide:   ["Туника из Ксеношкуры", "Xenohide"],
  xenocell:   ["Ксеноячеистая Броня", "Xenocellular"],
  hardened:   ["Затвердевшая Кожа", "Hardened Skin"],
  ghostplate: ["Призрачная Броня", "Ghostplate"],
  incubus:    ["Латы Инкуба", "Incubus Warsuit"],
  wraithWeave:["Психокостяной Тканый Костюм", "Wraithbone Weave"]
};
// Боеприпасы (компендиум ammunition). Осколочное = ядокристаллы (1 ед. = 1 магазин).
const AM = {
  crystals:   ["Базовые Ядокристаллы", "Splinter Crystals"],
  hypertoxic: ["Сверхтоксичные", "Hypertoxic"],
  paralytic:  ["Парализаторы", "Paralytic"],
  compressed: ["Прессованные", "Compressed"],
  mindflay:   ["Мыслеплеть", "Mindflay"],
  daemonbane: ["Демонобой", "Daemonbane"],
  anticoag:   ["Антикоагулянты", "Anticoagulant"],
  resonant:   ["Резонирующие", "Resonant"],
  exotic:     ["Экзотическая амуниция", "Exotic"]
};

// ─────────────────── Расовые Черты Друкхари (инлайн) ───────────────────
// Механические (с эффектами) + ключевые нарративные. Общий костяк для всех.
const DRU_CORE = [
  TRAIT("Dark Sight / Тёмное Зрение", "Видит в темноте без штрафов."),
  TRAIT("Nimble / Проворный", "Атакующим по нему −A.b к попаданию.", {}, 10, true),
  TRAIT("Unnatural Agility (4) / Сверхъест. Ловкость (4)", "+4 к Бонусу Ловкости.",
        { charBonusStat: "ag", charBonusValue: 4 }, 4, true),
  TRAIT("Unnatural Perception (4) / Сверхъест. Восприятие (4)", "+4 к Бонусу Восприятия.",
        { charBonusStat: "per", charBonusValue: 4 }, 4, true),
  TRAIT("Druchiiten / Друкхарийское Тело",
        "Доп. Реакция; +4 к Инициативе (3 броска, лучший); избегает атак Орды/«Троек» как одиночные. "
      + "Не страдает от боли (ощущает, но не страдает) и от пост-эффектов/штрафов наркотиков. "
      + "Иммунитет к обычным болезням; долгожитель; авто-обнаружение ядов по запаху."),
  TRAIT("Through the Pain / Через Боль",
        "Копит Очки Боли (макс W.b) с крит-эффектов боли и болезненных смертей в радиусе P м "
      + "(1/раунд с цели). Тратит их как Очки Бесчестья по строке таблицы. Развивает Psyniscience "
      + "как враждебный навык (видит лишь тяжелораненых/в страхе)."),
  TRAIT("Godless / Безбожник",
        "Нет Очков Судьбы, Очков Бесчестья и Покровительства. Для талантов, требующих ОБ, тратит "
      + "Очки Боли по уровню таланта. Смерть окончательна (кроме воскрешения Гемункулами — «Цена Бессмертия»).")
];

// helper: собрать kit с расовым костяком
const withCore = (...extra) => [...extra];

export const DRUKHARI_BESTIARY = [

  // ═══════════════════ ЗВЕРИ УКРОТИТЕЛЯ ═══════════════════
  // Питомцы элитного архетипа Укротитель. Ранг миньона указан в заметках:
  // он определяет, сколько слотов зверь занимает у хозяина.

  // ── Бритвокрыл (Низший миньон, R1 необученный / R2 обученный) ──
  {
    name: "Бритвокрыл",
    folderParent: "Друкхари", folder: "Звери Укротителя", img: IMG,
    system: {
      race: "", size: 0,
      characteristics: CH({ ws:47, bs:1, s:31, t:33, ag:52, int:22, per:39, wp:40, fel:10, inf:0 }),
      wounds: { value: 10, max: 10, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ acrobatics: "trained", awareness: "trained", dodge: "trained",
                   operateAeronautica: "trained", survival: "knows" }),
      notes: "<p><b>Низший миньон Укротителя.</b> Необученный — предмет R1, обученный — R2.</p>"
           + "<p>Крупная хищная птица с размахом крыльев почти четыре метра. Дрейфует на тепловых "
           + "потоках, пока не увидит добычу, затем ныряет так, что побег невозможен. Нападает стаей, "
           + "окружая жертву ураганом ножеподобных перьев и бритвенных клювов.</p>"
           + "<p><b>Атаки.</b> Клюв и Когти (Когти.Р, 0–2 м, 1d10+3 R, Pen 2, Reinforced, Tearing, "
           + "Bl −2) — при успешном попадании может захватить конечность цели клювом, удерживая её "
           + "как двумя руками с Athletics+20 и S 45. Перья (Нож, 0–1 м, 1d10+2 R, Pen 3, Razor Sharp, "
           + "Bl 0) — атака перьями совершается через A вместо WS.</p>"
           + "<p><b>Поведение.</b> Не действует агрессивно сразу: изучает противника и ищет, как его "
           + "победить. Без команды сверху бьёт крыльями с ужасающей яростью.</p>"
    },
    kit: [
      tal(["Double Team", "Двойная Команда"]),
      tal(["Frenzy", "Ярость"]),
      tal(["Furious Assault", "Яростный Натиск"]),
      tal(["Lightning Attack", "Молниеносная Атака"]),
      tal(["Lightning Reflexes", "Молниеносные Рефлексы"]),
      TRAIT("Bestial / Звериный", "Животный разум: не поддаётся обычному убеждению и командам, кроме как от хозяина."),
      TRAIT("Dark Sight / Тёмное Зрение", "Видит в темноте без штрафов."),
      TRAIT("Flyer (12) / Летун (12)", "Полёт со скоростью 12.", {}, 12, true),
      TRAIT("Deadly Natural Weapons (0, Клюв, Когти)", "Естественное оружие: клюв и когти.", {}, 0, true),
      TRAIT("Natural Armour (2) / Природная Броня (2)", "Оперение даёт AP 2 по всем локациям.", { armourAll: 2 }, 2, true),
      TRAIT("Unnatural Agility (4) / Сверхъест. Ловкость (4)", "+4 к Бонусу Ловкости.", { charBonusStat: "ag", charBonusValue: 4 }, 4, true),
      TRAIT("Unnatural Perception (4) / Сверхъест. Восприятие (4)", "+4 к Бонусу Восприятия.", { charBonusStat: "per", charBonusValue: 4 }, 4, true),
      TRAIT("Pack Hunters / Стайные Охотники",
            "Общаются между собой на расстоянии до 400 метров на непереводимом животном языке, "
            + "координируя атаки по воле Укротителя, который понимает их автоматически. Когда один "
            + "Бритвокрыл атакует цель, все остальные получают +5 на атаки против неё; бонус "
            + "складывается до +20 и сбрасывается, если цель покидает обзор того бритвокрыла, что "
            + "атаковал первым. Старые бритвокрылы и вожаки могут иметь Common Lore (War)+10.")
    ]
  },

  // ── Адский Паук (Средний миньон, R2 / R3) ──
  {
    name: "Адский Паук",
    folderParent: "Друкхари", folder: "Звери Укротителя", img: IMG,
    system: {
      race: "", size: 1,
      characteristics: CH({ ws:37, bs:37, s:45, t:43, ag:36, int:12, per:34, wp:24, fel:10, inf:0 }),
      wounds: { value: 35, max: 35, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ athletics: "trained", acrobatics: "knows", awareness: "trained",
                   dodge: "knows", survival: "trained", parry: "knows" }),
      notes: "<p><b>Средний миньон Укротителя.</b> Необученный — предмет R2, обученный — R3.</p>"
           + "<p>Выведен в Коммораге из мирных гигантских пауков. Лапы укреплены клинками, "
           + "пробивающими бронированного противника. Обученные особи нежны с хозяином и приносят "
           + "ему завёрнутые в кокон останки жертв ради похвалы.</p>"
           + "<p><b>Атаки.</b> Когти (Когти.Р, 0–4 м, 1d10+8 R, Pen 2, Reinforced, Tearing, Toxic (2), "
           + "Bl 0). Укус (0 м, 2d10+8 R, Pen 2, Reinforced, Tearing, Toxic (2), Independent, Bl −2) — "
           + "при попадании может провести Захват. Кислотный Плевок (30 м, S/–/–, 1d10+7 C, Pen 3, "
           + "Corrosive (2)) — против жертвы в захвате плюётся за Свободное действие тестом T+30.</p>"
           + "<p><b>Поведение.</b> Держит дистанцию и бьёт когтями; при угрозе сокращает дистанцию и "
           + "пытается сожрать врага укусом. Против прытких использует кислотный плевок. В отчаянии "
           + "входит в ярость и совершает натиск при каждой возможности.</p>"
    },
    kit: [
      tal(["Berserk Charge", "Безумный Натиск"]),
      tal(["Double Team", "Двойная Команда"]),
      tal(["Frenzy", "Ярость"]),
      tal(["Heightened Senses", "Обострённые Чувства"]),
      tal(["Gatekeeper", "Привратник"]),
      tal(["Lightning Reflexes", "Молниеносные Рефлексы"]),
      tal(["Preternatural Speed", "Сверхъестественная Скорость"]),
      TRAIT("Bestial / Звериный", "Животный разум."),
      TRAIT("Dark Sight / Тёмное Зрение", "Видит в темноте без штрафов."),
      TRAIT("Deadly Natural Weapons (2, Укус, Когти)", "Естественное оружие: укус и когти.", {}, 2, true),
      FEAR(1, "Гигантский бронированный паук."),
      TRAIT("Multiple Arms (8) / Множество Рук (8)", "Восемь лап-когтей. В расчёте своих «ног» паук считается имеющим P.b 8.", {}, 8, true),
      TRAIT("Nimble (10) / Проворный (10)", "Атакующим по нему −A.b к попаданию.", {}, 10, true),
      TRAIT("Quadruped (0) / Четвероногий", "Многоногое тело: устойчив, движение не сковано."),
      TRAIT("Size (1) / Размер (1)", "Размер +1.", { sizeMod: 1 }, 1, true),
      TRAIT("Unnatural Strength (2) / Сверхъест. Сила (2)", "+2 к Бонусу Силы.", { charBonusStat: "s", charBonusValue: 2 }, 2, true),
      TRAIT("Unnatural Toughness (2) / Сверхъест. Стойкость (2)", "+2 к Бонусу Стойкости.", { charBonusStat: "t", charBonusValue: 2 }, 2, true),
      TRAIT("Unnatural Agility (4) / Сверхъест. Ловкость (4)", "+4 к Бонусу Ловкости.", { charBonusStat: "ag", charBonusValue: 4 }, 4, true),
      TRAIT("Toxic (2) / Токсичный (2)", "Естественные атаки ядовиты.", {}, 2, true),
      TRAIT("Cruel Predators / Жестокие Хищники",
            "В начале битвы паук (или владеющий им Укротитель) избирает одну жертву, против которой "
            + "получает +10 на все атакующие тесты. В начале своего хода паук может сконцентрироваться "
            + "на жертве, получая возможность совершать атаки за реакции против неё. Если выбранная "
            + "цель оглушена или сбита с ног в радиусе атаки когтями, паук может тестом A+30 захватить "
            + "её в Захват даже вне своего хода.")
    ]
  },

  // ── Когтистый Дьявол (Средний миньон, R3 / R4) ──
  {
    name: "Когтистый Дьявол",
    folderParent: "Друкхари", folder: "Звери Укротителя", img: IMG,
    system: {
      race: "", size: 1,
      characteristics: CH({ ws:43, bs:1, s:59, t:53, ag:47, int:12, per:54, wp:23, fel:4, inf:0 }),
      wounds: { value: 48, max: 48, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ athletics: "expert", dodge: "knows", parry: "knows" }),
      notes: "<p><b>Средний миньон Укротителя.</b> Необученный — предмет R3, обученный — R4.</p>"
           + "<p>Полуразумный мускулистый монстр, покрытый шерстью. Три пары глаз видят в разных "
           + "спектрах, чувствительные уши отфильтровывают фоновый шум. Когти из хитина размером с "
           + "орочьи пальцы и острые как боевые ножи. Сила примерно равна силе Астартес, но длинные "
           + "конечности дают преимущество в дистанции. Опаснее всего, когда ранен: запах собственной "
           + "крови приводит его в неистовство.</p>"
           + "<p><b>Атаки.</b> Кулак (Кулак.Б, 0–2 м, 1d10+11 I(Cr), Pen 0, Concussive (0), Reinforced, "
           + "Bl 1). Когти (Когти.Р, 2–3 м, 1d10+11 R, Pen 4, Razor Sharp, Reinforced, Tearing, Bl 0).</p>"
           + "<p><b>Поведение.</b> Очень тяжёл для управления: входит в ярость при первой возможности. "
           + "Без приказа взять живьём рвёт врага когтями; с приказом — бьёт кулаками, чья сила "
           + "отправляет в нокаут.</p>"
    },
    kit: [
      tal(["Berserk Charge", "Безумный Натиск"]),
      tal(["Blind Fighting", "Слепой Бой"]),
      tal(["Crippling Strike", "Калечащий Удар"]),
      tal(["Hamstring", "Подсечка"]),
      tal(["Headcracker", "Головолом"]),
      tal(["Nerves of Steel", "Стальные Нервы"]),
      tal(["Swift Attack", "Быстрая Атака"]),
      tal(["Takedown", "Сбить с Ног"]),
      TRAIT("Bestial / Звериный", "Животный разум."),
      TRAIT("Brutal Charge (5) / Жестокий Натиск (5)", "+5 к урону при Натиске.", {}, 5, true),
      TRAIT("Dark Sight / Тёмное Зрение", "Видит в темноте без штрафов."),
      TRAIT("Deadly Natural Weapons (Кулак.Б, Когти)", "Естественное оружие: кулаки и когти."),
      FEAR(2, "Огромный когтистый монстр."),
      TRAIT("Multiple Arms (4) / Множество Рук (4)", "Четыре конечности.", {}, 4, true),
      TRAIT("Natural Armour (4) / Природная Броня (4)", "Шкура даёт AP 4 по всем локациям.", { armourAll: 4 }, 4, true),
      TRAIT("Quadruped (1) / Четвероногий (1)", "Передвигается на четырёх конечностях.", {}, 1, true),
      TRAIT("Size (1) / Размер (1)", "Размер +1.", { sizeMod: 1 }, 1, true),
      TRAIT("Unnatural Strength (6) / Сверхъест. Сила (6)", "+6 к Бонусу Силы.", { charBonusStat: "s", charBonusValue: 6 }, 6, true),
      TRAIT("Unnatural Toughness (6) / Сверхъест. Стойкость (6)", "+6 к Бонусу Стойкости.", { charBonusStat: "t", charBonusValue: 6 }, 6, true),
      TRAIT("Sturdy / Кряжистый", "Устойчив к сбиванию с ног и отбрасыванию."),
      TRAIT("Dismemberer / Расчленитель",
            "Получив непоглощённый урон или эффект кровотечения, до конца боя получает таланты Frenzy "
            + "и Lightning Attack, а также +10 на приёмы Быстрой и Молниеносной атаки.")
    ]
  },

  // ── Кхимера (Средний миньон, R3 / R4) ──
  {
    name: "Кхимера",
    folderParent: "Друкхари", folder: "Звери Укротителя", img: IMG,
    system: {
      race: "", size: 1,
      characteristics: CH({ ws:45, bs:1, s:40, t:35, ag:54, int:15, per:40, wp:35, fel:5, inf:0 }),
      wounds: { value: 25, max: 25, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ acrobatics: "expert", athletics: "expert", awareness: "expert",
                   dodge: "knows", parry: "knows", stealth: "trained",
                   survival: "master", psyniscience: "master" }),
      notes: "<p><b>Средний миньон Укротителя.</b> Необученный — предмет R3, обученный — R4. Также "
           + "добывается через особую миссию в сновидениях или сновидениях пытаемых рабов.</p>"
           + "<p>Варп-чудовище с демонических миров: длинноклыкастое, многоглазое, жилистое. "
           + "Укротители выслеживают кхимер в царстве снов и захватывают в материальный мир, "
           + "превращая в полуреальные кошмары, что сеют хаос и растворяются как туман.</p>"
           + "<p><b>Защита.</b> Брони нет; колдовской щит 1–35/5 (Чарод/Сквоз), перегруженный щит "
           + "восстанавливается через раунд.</p>"
           + "<p><b>Атаки.</b> Копыта (0 м, 1d10+7 I(Cr), Pen 3, Imprecise, Reinforced, Bl −2). "
           + "Укус (0 м, 1d10+7 R, Pen 3, Reinforced, Tearing, Warp Weapon, Bl 0). Косы (Меч, 2–4 м, "
           + "1d10+12 R, Pen 5, Reinforced, Warp Weapon, Bl 1).</p>"
           + "<p><b>Поведение.</b> Послушна подчинившему и исполняет приказы без сомнений. Без "
           + "приказов атакует псайкеров с PR 1 и выше, стремясь убить и пожрать их тело и душу, "
           + "используя косы как сильнейшую атаку.</p>"
    },
    kit: [
      tal(["Battle Rage", "Боевая Ярость"]),
      tal(["Berserk Charge", "Безумный Натиск"]),
      tal(["Frenzy", "Ярость"]),
      tal(["Fire in Blood", "Огонь в Крови"]),
      tal(["Reckless Charge", "Безрассудный Натиск"]),
      tal(["Hatred", "Ненависть"]),
      tal(["Heightened Senses", "Обострённые Чувства"]),
      tal(["Speed Awareness", "Скоростное Восприятие"]),
      TRAIT("Daemonic (4) / Демонический (4)", "Сопротивление материальному урону.", {}, 4, true),
      TRAIT("Daemonic Presence (10/20) / Демоническое Присутствие", "Аура ужаса вокруг существа.", {}, 10, true),
      TRAIT("Dark Sight / Тёмное Зрение", "Видит в темноте без штрафов."),
      TRAIT("Deadly Natural Weapons (3, Копыта, Укус, Косы)", "Естественное оружие.", {}, 3, true),
      FEAR(2, "Варп-хищник из кошмаров."),
      TRAIT("From Beyond / Извне", "Чуждое сознание: невосприимчива к воздействиям на разум."),
      TRAIT("Phase / Фаза", "Может уходить в фазовое состояние."),
      TRAIT("Quadruped (0) / Четвероногий", "Передвигается на четырёх конечностях."),
      TRAIT("Size (1) / Размер (1)", "Размер +1.", { sizeMod: 1 }, 1, true),
      TRAIT("Stuff of Nightmares / Плоть Кошмаров", "Не чувствует боли, игнорирует критические эффекты."),
      TRAIT("Unnatural Agility (3) / Сверхъест. Ловкость (3)", "+3 к Бонусу Ловкости.", { charBonusStat: "ag", charBonusValue: 3 }, 3, true),
      TRAIT("Unnatural Toughness (4) / Сверхъест. Стойкость (4)", "+4 к Бонусу Стойкости.", { charBonusStat: "t", charBonusValue: 4 }, 4, true),
      TRAIT("Warp Sight / Варп-Зрение", "Видит потоки имматериума."),
      TRAIT("Warp Weapon / Варп-Оружие", "Атаки игнорируют материальную защиту."),
      TRAIT("Warp Instability / Варп-Нестабильность", "Развоплощается при потере связи с материумом."),
      TRAIT("Warp Predator / Варп-Хищник",
            "Два состояния: в варпе считается обычным демоном, в материальном получает +30 на все "
            + "тесты против вязей, кругов и прочих защит от варпа. Атакованная оружием со свойством "
            + "Sanctified теряет колдовской щит, но сохраняет остальные свойства. Автоматически "
            + "проходит тесты против Демонического Владычества. Пока на поле битвы её хозяин, "
            + "автоматически проходит Warp Instability. Атаки со свойством Warp Weapon теряют его "
            + "против парий. В фазовом состоянии может атаковать псайкеров в фазе и существ, "
            + "испытывающих серьёзные эмоции. Автоматически засекает всех Псайкеров в радиусе 500 "
            + "метров и стремится атаковать их, если Укротитель не даст другой приказ. Нанося "
            + "непоглощённый урон Псайкеру, заставляет его пройти тест W+10 или получить 1d5 "
            + "непоглощаемого E урона от переизбытка эмоций и развеять одну психосилу на выбор. "
            + "Против иммунных к материальному урону использует Warp Weapon, против иммунных к Warp "
            + "Weapon — материальный урон. Получив от одного попадания больше 10 непоглощаемого урона, "
            + "может уйти в фазу, проигнорировав остальной урон, и вернуться в начале своего "
            + "следующего хода за Свободное действие.")
    ]
  },

  // ── Бхаргези (Высший миньон, R4 / R5) ──
  {
    name: "Бхаргези",
    folderParent: "Друкхари", folder: "Звери Укротителя", img: IMG,
    system: {
      race: "", size: 1,
      characteristics: CH({ ws:45, bs:1, s:40, t:45, ag:54, int:15, per:40, wp:35, fel:5, inf:0 }),
      wounds: { value: 38, max: 38, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ athletics: "trained", acrobatics: "knows", awareness: "trained",
                   dodge: "trained", survival: "trained", parry: "expert" }),
      notes: "<p><b>Высший миньон Укротителя.</b> Необученный — предмет R4, обученный — R5.</p>"
           + "<p>Чрезмерно агрессивная и биологически превосходящая раса: четвероногие краснокожие "
           + "существа, способные эффективно сражаться даже против Астартес. В 30-м тысячелетии от их "
           + "рук погибло целое братство Белых Шрамов. Лапы имеют человекообразный характер, поэтому "
           + "при правильной тренировке передние лапы можно научить использовать как руки.</p>"
           + "<p><b>Атаки.</b> Укус (0 м, 1d10+15 R, Pen 5, Reinforced, Tearing, Bl 0). Когти "
           + "(Когти.Р, 2–3 м, 1d10+15 R, Pen 5, Razor Sharp, Reinforced, Tearing, Bl 0).</p>"
           + "<p><b>Поведение.</b> Дики, агрессивны и очень жестоки. Без командования не добивают "
           + "противника, а измываются над ним, отрезая кусок за куском и давая иллюзорный шанс "
           + "убежать.</p>"
    },
    kit: [
      tal(["Battle Rage", "Боевая Ярость"]),
      tal(["Berserk Charge", "Безумный Натиск"]),
      tal(["Frenzy", "Ярость"]),
      tal(["Fire in Blood", "Огонь в Крови"]),
      tal(["Heightened Senses", "Обострённые Чувства"]),
      tal(["Reckless Charge", "Безрассудный Натиск"]),
      tal(["Stonewall", "Каменная Стена"]),
      tal(["Iron Jaw", "Железная Челюсть"]),
      TRAIT("Brutal Charge (6) / Жестокий Натиск (6)", "+6 к урону при Натиске.", {}, 6, true),
      TRAIT("Dark Sight / Тёмное Зрение", "Видит в темноте без штрафов."),
      TRAIT("Deadly Natural Weapons (5, Когти, Укус)", "Естественное оружие.", {}, 5, true),
      TRAIT("Nimble (10) / Проворный (10)", "Атакующим по нему −A.b к попаданию.", {}, 10, true),
      TRAIT("Natural Armour (4) / Природная Броня (4)", "Шкура даёт AP 4 по всем локациям.", { armourAll: 4 }, 4, true),
      TRAIT("Size (1) / Размер (1)", "Размер +1.", { sizeMod: 1 }, 1, true),
      TRAIT("Unnatural Strength (6) / Сверхъест. Сила (6)", "+6 к Бонусу Силы.", { charBonusStat: "s", charBonusValue: 6 }, 6, true),
      TRAIT("Unnatural Toughness (6) / Сверхъест. Стойкость (6)", "+6 к Бонусу Стойкости.", { charBonusStat: "t", charBonusValue: 6 }, 6, true),
      TRAIT("Unnatural Agility (4) / Сверхъест. Ловкость (4)", "+4 к Бонусу Ловкости.", { charBonusStat: "ag", charBonusValue: 4 }, 4, true),
      TRAIT("Sturdy / Кряжистый", "Устойчив к сбиванию с ног и отбрасыванию."),
      TRAIT("Dismemberer / Расчленитель",
            "Получив непоглощённый урон или эффект кровотечения, до конца боя получает таланты Frenzy "
            + "и Lightning Attack, а также +10 на приёмы Быстрой и Молниеносной атаки.")
    ]
  },

  // ═══════════════════════════ КАБАЛ ═══════════════════════════
  // Основа военной мощи Кабала: осколочное оружие, отравляющее массы, и
  // тёмносветовое — для брони и техники. Дисциплина держится на страхе.

  // ── Кабалит-Воин (линейный боец) ──────────────────────────────────────
  {
    name: "Кабалит-Воин",
    folderParent: "Друкхари", folder: "Кабал", img: IMG,
    system: {
      race: "drukhari", size: 0,
      characteristics: CH({ ws:35, bs:40, s:28, t:28, ag:40, int:33, per:38, wp:25, fel:30, inf:35 }),
      wounds: { value: 12, max: 12, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ awareness: "trained", dodge: "trained", stealth: "trained",
                   acrobatics: "knows", intimidate: "knows", parry: "knows" }),
      notes: "<p><b>Кабал.</b> <b>Роль:</b> рядовой стрелок налётного отряда. Осколочная винтовка "
           + "заливает цель отравленными кристаллами (Toxic), осколочный пистолет — на добивание. "
           + "Кабалитская броня затвердевает по приказу. Дерётся стаей, бьёт из засады и отступает "
           + "в Паутину, пока цель истекает ядом. Труслив в честном бою — но честного боя не даёт.</p>"
    },
    kit: withCore(
      gun(W.splinterRifle), gun(W.splinterPistol, { equipped: false }), armr(A.kabalite),
      amm(AM.crystals, 3), amm(AM.paralytic, 1),
      tal(["Kabalite Weapon Training", "Тренировка Кабалита"]),
      tal(["Cruelty", "Жестокость"]),
      tal(["Copious Slaughter", "Обильная Резня"]),
      tal(["Enjoyment", "Наслаждение"]),
      tal(["Jaded", "Пресыщенный"]),
      ...DRU_CORE)
  },

  // ── Кабалит-Терзатель (тяжёлое/спец. оружие) ──────────────────────────
  {
    name: "Кабалит-Терзатель",
    folderParent: "Друкхари", folder: "Кабал", img: IMG,
    system: {
      race: "drukhari", size: 0,
      characteristics: CH({ ws:36, bs:46, s:30, t:30, ag:42, int:35, per:42, wp:28, fel:30, inf:35 }),
      wounds: { value: 14, max: 14, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ awareness: "trained", dodge: "trained", stealth: "trained",
                   acrobatics: "knows", intimidate: "knows" }),
      notes: "<p><b>Кабал.</b> <b>Роль:</b> носитель специального оружия отряда. Бластер выжигает "
           + "антисветом технику и терминаторов (Lance, Felling); при нужде берёт осколочную пушку "
           + "по пехоте. Держится за спинами воинов, выцеливая самую опасную мишень.</p>"
    },
    kit: withCore(
      gun(W.blaster), gun(W.splinterPistol, { equipped: false }), armr(A.kabalite),
      amm(AM.crystals, 2),
      tal(["Kabalite Weapon Training", "Тренировка Кабалита"]),
      tal(["Marksman", "Снайпер"]),
      tal(["Deadeye Shot", "В Яблочко"]),
      tal(["Mighty Shot", "Могучий Выстрел"]),
      tal(["Cruelty", "Жестокость"]),
      tal(["Jaded", "Пресыщенный"]),
      ...DRU_CORE)
  },

  // ── Сибарит (сержант отряда) ──────────────────────────────────────────
  {
    name: "Сибарит",
    folderParent: "Друкхари", folder: "Кабал", img: IMG,
    system: {
      race: "drukhari", size: 0,
      characteristics: CH({ ws:42, bs:44, s:32, t:30, ag:44, int:38, per:42, wp:34, fel:40, inf:40 }),
      wounds: { value: 15, max: 15, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ command: "trained", intimidate: "trained", dodge: "trained",
                   awareness: "trained", acrobatics: "knows", deceive: "knows" }),
      notes: "<p><b>Кабал.</b> <b>Роль:</b> вожак налётного отряда, добившийся места клинком в спину. "
           + "Агонайзер-хлыст калечит непокорных болью (урон в S/P), осколочный пистолет наготове. "
           + "<b>Сифон Боли</b> — режет себя перед боем ради Очков Боли. Пока Сибарит жив, воины "
           + "не бегут: боятся его больше врага.</p>"
    },
    kit: withCore(
      melee(M.agoniser), gun(W.splinterPistol, { equipped: false }), armr(A.kabalite),
      amm(AM.crystals, 2), amm(AM.hypertoxic, 1),
      tal(["Kabalite Weapon Training", "Тренировка Кабалита"]),
      tal(["Cruelty", "Жестокость"]),
      tal(["Siphon Pain", "Сифон Боли"]),
      tal(["Air of Authority", "Аура Власти"]),
      tal(["Iron Discipline", "Железная Дисциплина"]),
      tal(["Deep Fear", "Глубокий Страх"]),
      tal(["Sadistic Pleasure", "Садистическое Наслаждение"]),
      ...DRU_CORE)
  },

  // ── Скурж (крылатый налётчик) ─────────────────────────────────────────
  {
    name: "Скурж",
    folderParent: "Друкхари", folder: "Кабал", img: IMG,
    system: {
      race: "drukhari", size: 0,
      characteristics: CH({ ws:36, bs:46, s:30, t:30, ag:46, int:34, per:42, wp:28, fel:32, inf:35 }),
      wounds: { value: 14, max: 14, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ awareness: "trained", dodge: "trained", acrobatics: "trained",
                   stealth: "knows", intimidate: "knows" }),
      notes: "<p><b>Кабал.</b> <b>Роль:</b> крылатый штурмовик на призрачно-костяных крыльях. "
           + "Пикирует, поливает шреддером (мономолекулярная сеть режет в куски) и уходит вверх. "
           + "Летун (10) — атакует и разрывает дистанцию по вертикали. Носит призрачную броню.</p>"
    },
    kit: withCore(
      gun(W.shredder), gun(W.splinterPistol, { equipped: false }), armr(A.ghostplate),
      amm(AM.crystals, 2), amm(AM.exotic, 1),
      tal(["Kabalite Weapon Training", "Тренировка Кабалита"]),
      tal(["Sprint", "Спринт"]),
      tal(["Marksman", "Снайпер"]),
      tal(["Hard Target", "Сложная Мишень"]),
      tal(["Copious Slaughter", "Обильная Резня"]),
      TRAIT("Flyer (10) / Летун (10)", "Крылья: полёт со скоростью 10 (Manoeuvrable). "
          + "Может пикировать и набирать высоту вне досягаемости рукопашной.", {}, 10, true),
      ...DRU_CORE)
  },

  // ── Дракон (офицер Кабала) ────────────────────────────────────────────
  {
    name: "Дракон",
    folderParent: "Друкхари", folder: "Кабал", img: IMG,
    system: {
      race: "drukhari", size: 0,
      characteristics: CH({ ws:48, bs:46, s:34, t:32, ag:46, int:42, per:44, wp:38, fel:46, inf:45 }),
      wounds: { value: 20, max: 20, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ command: "veteran", intimidate: "trained", deceive: "trained",
                   dodge: "trained", parry: "trained", acrobatics: "trained",
                   awareness: "trained", scrutiny: "knows" }),
      notes: "<p><b>Кабал.</b> <b>Роль:</b> приближённый Архонта, командир кабалитского воинства и "
           + "мини-босс. Отравленный клинок и бласт-пистолет; призрачная броня. Плетёт интриги, "
           + "жаждет трона своего господина. <b>Аура Власти</b> и <b>Сифон Боли</b>; насыщается "
           + "болью подчинённых не хуже, чем болью врага.</p>"
    },
    kit: withCore(
      melee(M.venomBlade), gun(W.blastPistol, { equipped: false }),
      gun(W.splinterPistol, { equipped: false }), armr(A.ghostplate),
      amm(AM.hypertoxic, 2), amm(AM.mindflay, 1),
      tal(["Kabalite Weapon Training", "Тренировка Кабалита"]),
      tal(["Air of Authority", "Аура Власти"]),
      tal(["Iron Discipline", "Железная Дисциплина"]),
      tal(["Cruelty", "Жестокость"]),
      tal(["Siphon Pain", "Сифон Боли"]),
      tal(["Step Aside", "Шаг в Сторону"]),
      tal(["Swift Attack", "Быстрая Атака"]),
      tal(["Counter Attack", "Контратака"]),
      tal(["Blademaster", "Мастер Клинка"]),
      tal(["Sadistic Pleasure", "Садистическое Наслаждение"]),
      ...DRU_CORE)
  },

  // ── Архонт (владыка Кабала — рейд-босс) ───────────────────────────────
  {
    name: "Архонт",
    folderParent: "Друкхари", folder: "Кабал", img: IMG,
    system: {
      race: "drukhari", size: 0,
      characteristics: CH({ ws:64, bs:58, s:40, t:38, ag:60, int:54, per:54, wp:52, fel:60, inf:64 }),
      wounds: { value: 38, max: 38, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ command: "expert", intimidate: "expert", deceive: "expert",
                   charm: "veteran", parry: "expert", dodge: "expert",
                   acrobatics: "veteran", awareness: "veteran", scrutiny: "veteran",
                   stealth: "trained" }),
      notes: "<p><b>Кабал — РЕЙД-БОСС.</b> <b>Роль:</b> тысячелетний тиран Комморры, вершина "
           + "интриг и жестокости. Клинок-Обдиратель (иссушает жертву в мумию) и бласт-пистолет; "
           + "призрачная броня. <b>Теневое Поле</b> (1–90) делает его почти неуязвимым, пока не "
           + "пробито. <b>Сверхъест. WS(2)</b> и расовая Ловкость — фехтует как демон. Внушает "
           + "<b>Страх (2)</b>, питается болью (Сифон Боли, Бездонная Душа). Командует абсолютным "
           + "террором. Если бой проигран — жертвует свитой и бежит через Паутину.</p>"
           + "<p><i>Тактика:</i> держит дистанцию бласт-пистолетом, входит в рукопашную лишь с "
           + "преимуществом; Контратака+Рипост наказывают каждую атаку по нему; Теневое Поле "
           + "гасит первый решающий удар.</p>"
    },
    kit: withCore(
      melee(M.huskblade), gun(W.blastPistol, { equipped: false }),
      gun(W.splinterPistol, { equipped: false }), armr(A.ghostplate),
      amm(AM.mindflay, 2), amm(AM.hypertoxic, 2),
      FEAR(2, "Владыка боли и предательства; сама его слава сеет ужас."),
      TRAIT("Unnatural Weapon Skill (2) / Сверхъест. Владение Оружием (2)", "+2 к Бонусу WS.",
            { charBonusStat: "ws", charBonusValue: 2 }, 2, true),
      TRAIT("Shadow Field / Теневое Поле",
            "Неперегружаемое затемняющее поле 1–90/− (как силовой щит-дефлектор). "
          + "Первое пробитие поля выключает его до конца боя."),
      tal(["Kabalite Weapon Training", "Тренировка Кабалита"]),
      tal(["Air of Authority", "Аура Власти"]),
      tal(["Iron Discipline", "Железная Дисциплина"]),
      tal(["Cruelty", "Жестокость"]),
      tal(["Siphon Pain", "Сифон Боли"]),
      tal(["Blademaster", "Мастер Клинка"]),
      tal(["Swift Attack", "Быстрая Атака"]),
      tal(["Counter Attack", "Контратака"]),
      tal(["Riposte", "Рипост"]),
      tal(["Step Aside", "Шаг в Сторону"]),
      tal(["Combat Master", "Мастер Боя"]),
      tal(["Paranoia", "Паранойя"]),
      tal(["Lightning Reflexes", "Молниеносные Рефлексы"]),
      tal(["Bottomless Soul", "Бездонная Душа"]),
      tal(["Copious Slaughter", "Обильная Резня"]),
      ...DRU_CORE)
  },

  // ── Сслит-Наёмник (телохранитель двора Архонта) ───────────────────────
  {
    name: "Сслит-Наёмник",
    folderParent: "Друкхари", folder: "Кабал", img: IMG,
    system: {
      race: "sslyth", size: 0,
      characteristics: CH({ ws:42, bs:40, s:40, t:42, ag:36, int:28, per:34, wp:36, fel:25, inf:30 }),
      wounds: { value: 22, max: 22, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ parry: "trained", dodge: "trained", awareness: "trained",
                   intimidate: "trained", athletics: "knows" }),
      notes: "<p><b>Кабал (наёмник).</b> <b>Роль:</b> змеечеловек-телохранитель, купленный за яды и "
           + "плоть. Четыре руки — два осколочных пистолета и два клинка разом. Хладнокровен, "
           + "стоек, безразличен к страху. Живая стена перед Архонтом.</p>"
    },
    kit: withCore(
      gun(W.splinterPistol), gun(W.splinterPistol, { equipped: true }),
      melee(M.venomBlade), melee(M.venomBlade, { equipped: true }), armr(A.xenocell),
      amm(AM.crystals, 4),
      TRAIT("Multiple Arms (+2) / Многорукий (+2)",
            "Четыре руки: может держать и использовать до четырёх одноручных оружий, "
          + "по одной атаке каждым при полной атаке (со штрафами за доп. руки).", {}, 2, true),
      TRAIT("Unnatural Strength (2) / Сверхъест. Сила (2)", "+2 к Бонусу Силы.",
            { charBonusStat: "s", charBonusValue: 2 }, 2, true),
      TRAIT("Unnatural Toughness (2) / Сверхъест. Стойкость (2)", "+2 к Бонусу Стойкости.",
            { charBonusStat: "t", charBonusValue: 2 }, 2, true),
      tal(["Ambidextrous", "Амбидекстр"]),
      tal(["Two Weapon Wielder", "Два Оружия"]),
      tal(["Gunslinger", "Македонец"]),
      tal(["Nerves of Steel", "Стальные Нервы"]),
      tal(["Fearless", "Бесстрашный"]),
      tal(["Combat Sense", "Боевое Чутьё"]))
  },

  // ═══════════════════════════ КУЛЬТ ВЕДЬМ ═══════════════════════════
  // Гладиаторы кровавых арен Комморры. Почти без брони, на боевых наркотиках,
  // с парными клинками и сетями — воплощение убийственной грации.

  // ── Ведьма (Гекатрия) ─────────────────────────────────────────────────
  {
    name: "Ведьма",
    folderParent: "Друкхари", folder: "Культ Ведьм", img: IMG,
    system: {
      race: "drukhari", size: 0,
      characteristics: CH({ ws:45, bs:32, s:30, t:28, ag:48, int:33, per:40, wp:30, fel:36, inf:35 }),
      wounds: { value: 13, max: 13, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ acrobatics: "veteran", dodge: "veteran", parry: "trained",
                   athletics: "knows", stealth: "knows", intimidate: "knows" }),
      notes: "<p><b>Культ Ведьм.</b> <b>Роль:</b> арена-убийца ближнего боя. Гекатрийский клинок и "
           + "осколочный пистолет; ведьмин костюм (защищает лишь переднюю дугу). Танцует сквозь "
           + "выстрелы (огромная Ловкость, Уклонение) и режет в упор. <b>Боевые наркотики</b> "
           + "приняты перед боем — доп. атака/урон/скорость. Уворачивается, а не терпит.</p>"
    },
    kit: withCore(
      melee(M.hekatarii), gun(W.splinterPistol, { equipped: false }), armr(A.wychSuit),
      chem(["Коммориттские Боевые Наркотики", "Combat Drug"]),
      amm(AM.crystals, 2),
      tal(["Kabalite Weapon Training", "Тренировка Кабалита"]),
      tal(["Swift Attack", "Быстрая Атака"]),
      tal(["Step Aside", "Шаг в Сторону"]),
      tal(["Catfall", "Кошачье Приземление"]),
      tal(["Leap Up", "Вскочить"]),
      tal(["Assassin Strike", "Удар Ассасина"]),
      tal(["Copious Slaughter", "Обильная Резня"]),
      ...DRU_CORE)
  },

  // ── Кровавая Невеста (ветеран-ведьма) ─────────────────────────────────
  {
    name: "Кровавая Невеста",
    folderParent: "Друкхари", folder: "Культ Ведьм", img: IMG,
    system: {
      race: "drukhari", size: 0,
      characteristics: CH({ ws:50, bs:34, s:32, t:30, ag:50, int:34, per:42, wp:32, fel:38, inf:40 }),
      wounds: { value: 16, max: 16, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ acrobatics: "veteran", dodge: "veteran", parry: "veteran",
                   athletics: "knows", stealth: "knows", intimidate: "trained" }),
      notes: "<p><b>Культ Ведьм.</b> <b>Роль:</b> ветеран-гладиатор, вожак группы ведьм. "
           + "Бритвоцеп (переключается в гибкий хлыст) и осколочная сеть — обездвиживает и режет. "
           + "<b>Рипост</b> и <b>Два Оружия</b>: наказывает каждую отбитую атаку. На боевых наркотиках.</p>"
    },
    kit: withCore(
      melee(M.razorflail), melee(M.shardnet, { equipped: true }),
      gun(W.splinterPistol, { equipped: false }), armr(A.wychSuit),
      chem(["Коммориттские Боевые Наркотики", "Combat Drug"]),
      amm(AM.crystals, 2), amm(AM.anticoag, 1),
      tal(["Kabalite Weapon Training", "Тренировка Кабалита"]),
      tal(["Swift Attack", "Быстрая Атака"]),
      tal(["Two Weapon Wielder", "Два Оружия"]),
      tal(["Riposte", "Рипост"]),
      tal(["Counter Attack", "Контратака"]),
      tal(["Step Aside", "Шаг в Сторону"]),
      tal(["Assassin Strike", "Удар Ассасина"]),
      tal(["Deep Fear", "Глубокий Страх"]),
      ...DRU_CORE)
  },

  // ── Геллион (небесный налётчик) ───────────────────────────────────────
  {
    name: "Геллион",
    folderParent: "Друкхари", folder: "Культ Ведьм", img: IMG,
    system: {
      race: "drukhari", size: 0,
      characteristics: CH({ ws:44, bs:34, s:30, t:28, ag:48, int:33, per:42, wp:30, fel:34, inf:35 }),
      wounds: { value: 13, max: 13, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ acrobatics: "veteran", dodge: "trained", awareness: "trained",
                   stealth: "knows", intimidate: "knows" }),
      notes: "<p><b>Культ Ведьм.</b> <b>Роль:</b> лихач на парящей доске (скайборд). Адская глефа "
           + "рубит на пролёте (+бонусы с доски), осколочный пистолет. Носится над схваткой, "
           + "цепляет жертв и уносит. Управление доской — навык Operate; на ней Летун.</p>"
    },
    kit: withCore(
      melee(M.hellglaive), gun(W.splinterPistol, { equipped: false }), armr(A.wychSuit),
      amm(AM.crystals, 2),
      tal(["Kabalite Weapon Training", "Тренировка Кабалита"]),
      tal(["Swift Attack", "Быстрая Атака"]),
      tal(["Sprint", "Спринт"]),
      tal(["Assassin Strike", "Удар Ассасина"]),
      tal(["Copious Slaughter", "Обильная Резня"]),
      TRAIT("Skyboard / Скайборд (Летун 12)",
            "Парящая доска: полёт со скоростью 12 (Manoeuvrable). +10 Operate (Скайборд); "
          + "на пролёте адская глефа даёт +20 по сочленениям. Сбитый с доски теряет полёт.", {}, 12, true),
      ...DRU_CORE)
  },

  // ── Суккуба (владычица Культа — босс) ─────────────────────────────────
  {
    name: "Суккуба",
    folderParent: "Друкхари", folder: "Культ Ведьм", img: IMG,
    system: {
      race: "drukhari", size: 0,
      characteristics: CH({ ws:68, bs:44, s:38, t:36, ag:66, int:46, per:52, wp:48, fel:58, inf:60 }),
      wounds: { value: 34, max: 34, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ acrobatics: "expert", dodge: "expert", parry: "expert",
                   athletics: "veteran", command: "veteran", intimidate: "veteran",
                   charm: "veteran", stealth: "veteran", awareness: "trained" }),
      notes: "<p><b>Культ Ведьм — РЕЙД-БОСС.</b> <b>Роль:</b> звезда кровавых арен и повелительница "
           + "культа. Клинок Суккуба и агонайзер-хлыст; ведьмин костюм. <b>Сверхъест. Владение "
           + "Оружием (2)</b> + расовая Ловкость — почти невозможно попасть или задеть. <b>Техника "
           + "Гекатрии</b> даёт неограниченные Быстрые/Молниеносные атаки; <b>Мастер Клинка</b>, "
           + "<b>Контратака</b>, <b>Рипост</b>, <b>Смертельный Танец</b>. Внушает <b>Страх (2)</b>. "
           + "Убивает красиво, на публику, под лучшими боевыми наркотиками Комморры.</p>"
           + "<p><i>Тактика:</i> первый ход — Смертельный Танец (Brutal Charge) в натиске; далее "
           + "шквал Молниеносных атак; уходит от ответа за счёт запредельной Ловкости и Шага в Сторону.</p>"
    },
    kit: withCore(
      melee(M.succubusBl), melee(M.agoniser, { equipped: true }),
      gun(W.splinterPistol, { equipped: false }), armr(A.wychSuit),
      chem(["Коммориттские Боевые Наркотики", "Combat Drug"]),
      amm(AM.crystals, 2), amm(AM.hypertoxic, 1),
      FEAR(2, "Ослепительная и смертоносная звезда кровавых арен."),
      TRAIT("Unnatural Weapon Skill (2) / Сверхъест. Владение Оружием (2)", "+2 к Бонусу WS.",
            { charBonusStat: "ws", charBonusValue: 2 }, 2, true),
      tal(["Kabalite Weapon Training", "Тренировка Кабалита"]),
      tal(["Hekatrii Technique", "Техника Гекатрии"]),
      tal(["Swift Attack", "Быстрая Атака"]),
      tal(["Lightning Attack", "Молниеносная Атака"]),
      tal(["Blademaster", "Мастер Клинка"]),
      tal(["Counter Attack", "Контратака"]),
      tal(["Riposte", "Рипост"]),
      tal(["Step Aside", "Шаг в Сторону"]),
      tal(["Assassin Strike", "Удар Ассасина"]),
      tal(["Death Dance", "Смертельный Танец"]),
      tal(["Air of Authority", "Аура Власти"]),
      tal(["Deep Fear", "Глубокий Страх"]),
      tal(["Sadistic Pleasure", "Садистическое Наслаждение"]),
      ...DRU_CORE)
  },

  // ═══════════════════════════ КОВЕН ГЕМУНКУЛОВ ═══════════════════════════
  // Плотоделы Комморры — хирурги-садисты и их выращенные ужасы. Медленные,
  // но невероятно живучие; сеют боль ядами и модифицированной плотью.

  // ── Развалина (Варк) ──────────────────────────────────────────────────
  {
    name: "Развалина (Варк)",
    folderParent: "Друкхари", folder: "Ковен Гемункулов", img: IMG,
    system: {
      race: "drukhari", subrace: "wrack", size: 0,
      characteristics: CH({ ws:40, bs:30, s:36, t:40, ag:34, int:34, per:36, wp:34, fel:22, inf:30 }),
      wounds: { value: 18, max: 18, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ awareness: "knows", dodge: "knows", intimidate: "trained",
                   medicae: "knows", athletics: "knows", interrogate: "knows" }),
      notes: "<p><b>Ковен.</b> <b>Роль:</b> гемаколит, хирургически перестроенный в живучего "
           + "громилу-мясника. Мономолекулярный клинок/ампутатор и разжижитель (кислота). "
           + "Естественное оружие ядовито (Toxic 2). Затвердевшая кожа как броня. Не чувствует "
           + "страха и боли, прёт вперёд, ремонтируется медикаментами. Идёт стеной перед Гемункулом.</p>"
    },
    kit: withCore(
      melee(M.monoBlade), gun(W.liquifier, { equipped: false }), armr(A.hardened),
      amm(AM.exotic, 2),
      TRAIT("Unnatural Strength (2) / Сверхъест. Сила (2)", "+2 к Бонусу Силы.",
            { charBonusStat: "s", charBonusValue: 2 }, 2, true),
      TRAIT("Unnatural Toughness (2) / Сверхъест. Стойкость (2)", "+2 к Бонусу Стойкости.",
            { charBonusStat: "t", charBonusValue: 2 }, 2, true),
      TRAIT("Machine (2) / Машина (2)",
            "+2 AP естественной брони; иммунен к Haywire; лечится ремонтом и медикаментами.", {}, 2, true),
      TRAIT("Toxic (2) / Токсичный (2)", "Интегрированное природное оружие получает Toxic (2).", {}, 2, true),
      tal(["Ambidextrous", "Амбидекстр"]),
      tal(["Unarmed Warrior", "Безоружный Воин"]),
      tal(["Bulging Biceps", "Могучие Бицепсы"]),
      tal(["Resistance", "Сопротивление"]),
      tal(["Enjoyment", "Наслаждение"]),
      tal(["Fearless", "Бесстрашный"]),
      ...DRU_CORE)
  },

  // ── Гротеск (плотяной монстр) ─────────────────────────────────────────
  {
    name: "Гротеск",
    folderParent: "Друкхари", folder: "Ковен Гемункулов", img: IMG,
    system: {
      race: "drukhari", subrace: "wrack", size: 1,
      characteristics: CH({ ws:35, bs:20, s:48, t:46, ag:30, int:18, per:28, wp:28, fel:16, inf:25 }),
      wounds: { value: 32, max: 32, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ intimidate: "trained", athletics: "trained", awareness: "knows" }),
      notes: "<p><b>Ковен.</b> <b>Роль:</b> выращенный из пленника мясной колосс (Размер 1). "
           + "Перчатка плоти (растит Стойкость с каждым ударом) и ампутатор-тесак рвут строй. "
           + "<b>Ярость</b>, <b>Сверхъест. Сила/Стойкость (4)</b>, огромный запас Ран. Управляется "
           + "болевым жезлом Гемункула; без надзора впадает в неистовство и крушит всё живое. "
           + "Внушает <b>Страх</b>.</p>"
    },
    kit: withCore(
      melee(M.fleshGaunt), melee(M.amputator, { equipped: true }), armr(A.hardened),
      FEAR(1, "Слепленный из плоти пленников ревущий колосс."),
      TRAIT("Size (1) / Размер (1)", "Размер +1 (крупнее человека).", { sizeMod: 1 }, 1, true),
      TRAIT("Unnatural Strength (4) / Сверхъест. Сила (4)", "+4 к Бонусу Силы.",
            { charBonusStat: "s", charBonusValue: 4 }, 4, true),
      TRAIT("Unnatural Toughness (4) / Сверхъест. Стойкость (4)", "+4 к Бонусу Стойкости.",
            { charBonusStat: "t", charBonusValue: 4 }, 4, true),
      TRAIT("Machine (2) / Машина (2)", "+2 AP естественной брони; иммунен к Haywire; лечится ремонтом.", {}, 2, true),
      TRAIT("Brutal Charge (2) / Свирепый Натиск (2)",
            "При атаке в Натиске: +2 к урону рукопашной атаки.", {}, 2, true),
      tal(["Frenzy", "Ярость"]),
      tal(["Berserk Charge", "Берсеркский Натиск"]),
      tal(["Iron Jaw", "Железная Челюсть"]),
      tal(["Unarmed Warrior", "Безоружный Воин"]),
      tal(["Fearless", "Бесстрашный"]),
      ...DRU_CORE)
  },

  // ── Гемункул (мастер Ковена — рейд-босс) ──────────────────────────────
  {
    name: "Гемункул",
    folderParent: "Друкхари", folder: "Ковен Гемункулов", img: IMG,
    system: {
      race: "drukhari", size: 0,
      characteristics: CH({ ws:54, bs:48, s:38, t:52, ag:48, int:60, per:54, wp:54, fel:46, inf:60 }),
      wounds: { value: 42, max: 42, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ medicae: "expert", interrogate: "expert", intimidate: "expert",
                   awareness: "veteran", scrutiny: "veteran", deceive: "veteran",
                   dodge: "veteran", parry: "trained" }),
      notes: "<p><b>Ковен — РЕЙД-БОСС.</b> <b>Роль:</b> древний плотодел-хирург, кошмар Комморры. "
           + "Парит на механических отростках (доп. руки, четыре оружия). Мыслефазовая перчатка "
           + "ломает волю, рука-ножницы с ядом Шаимеша, сглаз-винтовка и оссефактор сеют "
           + "стеклянную чуму и костяные взрывы. Психокостяной костюм. <b>Сверхъест. Стойкость (4)</b>, "
           + "<b>Регенерация (2)</b>, <b>Страх (3)</b>. <b>Искусная Пытка</b>, <b>Учение Шаимеш</b>, "
           + "<b>Отравитель</b>. <b>Бессмертен</b>, пока цел ферментный чан: убей его — вернётся хуже.</p>"
           + "<p><i>Тактика:</i> с задней линии сеет яды и болезни оссефактором/сглаз-винтовкой, "
           + "в рукопашной подчиняет через мыслефазовую перчатку; регенерирует урон каждый ход; "
           + "поднимает Развалин и Гротесков как живой щит.</p>"
    },
    kit: withCore(
      melee(M.mindphase), melee(M.scissorhand, { equipped: true }),
      gun(W.hexRifle, { equipped: false }), gun(W.ossefactor, { equipped: false }),
      armr(A.wraithWeave), amm(AM.exotic, 3), amm(AM.daemonbane, 1),
      FEAR(3, "Улыбающийся плотодел, увешанный трофеями из чужих тел."),
      TRAIT("Multiple Arms (+2) / Многорукий (+2)",
            "Механодендриты и лишние руки: до четырёх одноручных инструментов/оружий разом.", {}, 2, true),
      TRAIT("Unnatural Toughness (4) / Сверхъест. Стойкость (4)", "+4 к Бонусу Стойкости.",
            { charBonusStat: "t", charBonusValue: 4 }, 4, true),
      TRAIT("Regeneration (2) / Регенерация (2)",
            "В начале каждого хода восстанавливает 2 Раны (не работает под Force/Sanctified/Warp Weapon).", {}, 2, true),
      TRAIT("Hovering / Парение",
            "Гравитационные подвески: свободно парит и перемещается по вертикали, игнорируя "
          + "трудный ландшафт по земле."),
      TRAIT("The Vials Are Never Empty / Возвращение из Чана",
            "Пока цел ферментный чан Ковена, погибший Гемункул возрождается через 1d5 дней "
          + "в новом, улучшенном теле. Уничтожение навеки требует Выжигания Души / варп-оружия "
          + "или разрушения чана."),
      tal(["Disciple Of Shaimesh", "Учение Шаимеш"]),
      tal(["Skillful Torture", "Искусная Пытка"]),
      tal(["Poisoner", "Отравитель"]),
      tal(["Siphon Pain", "Сифон Боли"]),
      tal(["Cruelty", "Жестокость"]),
      tal(["Pain After Pain", "Боль За Болью"]),
      tal(["Cruel Desire", "Жестокое Желание"]),
      tal(["Bottomless Soul", "Бездонная Душа"]),
      tal(["Sadistic Pleasure", "Садистическое Наслаждение"]),
      tal(["Step Aside", "Шаг в Сторону"]),
      ...DRU_CORE)
  },

  // ═══════════════════════════ ХРАМ ИНКУБОВ И ТЕНИ ═══════════════════════════
  // Наёмные убийцы храмов войны (Инкубы) и порождения тёмного измерения
  // (Мандрагоры) — самые смертоносные клинки Комморры.

  // ── Инкуб (храмовый убийца-телохранитель) ─────────────────────────────
  {
    name: "Инкуб",
    folderParent: "Друкхари", folder: "Храм Инкубов и Тени", img: IMG,
    system: {
      race: "drukhari", size: 0,
      characteristics: CH({ ws:52, bs:38, s:36, t:34, ag:46, int:36, per:44, wp:40, fel:32, inf:40 }),
      wounds: { value: 18, max: 18, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ parry: "veteran", dodge: "trained", acrobatics: "trained",
                   awareness: "trained", intimidate: "trained", stealth: "knows" }),
      notes: "<p><b>Храм Инкубов.</b> <b>Роль:</b> наёмный храмовый убийца, телохранитель "
           + "Архонтов. Клэйв (силовой двуручник, +20 по сочленениям) и перчатка-гидра. Тяжёлые "
           + "латы инкуба (лучшая друкхарская броня, щит-дефлектор). <b>Мастер Клинка</b>, "
           + "<b>Крушащий Удар</b>, <b>Верный Удар</b>. Молчаливый профессионал смерти. "
           + "Внушает <b>Страх</b>.</p>"
    },
    kit: withCore(
      melee(M.klaive), melee(M.hydraGaunt, { equipped: false }), armr(A.incubus),
      FEAR(1, "Безмолвный убийца в шипастых латах-костюме войны."),
      tal(["Kabalite Weapon Training", "Тренировка Кабалита"]),
      tal(["Blademaster", "Мастер Клинка"]),
      tal(["Swift Attack", "Быстрая Атака"]),
      tal(["Crushing Blow", "Крушащий Удар"]),
      tal(["Sure Strike", "Верный Удар"]),
      tal(["Precise Blow", "Выверенный Удар"]),
      tal(["Counter Attack", "Контратака"]),
      tal(["Step Aside", "Шаг в Сторону"]),
      tal(["Cruelty", "Жестокость"]),
      ...DRU_CORE)
  },

  // ── Клэйвекс (иерарх Инкубов — рейд-босс) ─────────────────────────────
  {
    name: "Клэйвекс",
    folderParent: "Друкхари", folder: "Храм Инкубов и Тени", img: IMG,
    system: {
      race: "drukhari", size: 0,
      characteristics: CH({ ws:70, bs:48, s:42, t:40, ag:56, int:42, per:50, wp:48, fel:42, inf:54 }),
      wounds: { value: 34, max: 34, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ parry: "expert", dodge: "expert", acrobatics: "expert",
                   awareness: "expert", intimidate: "expert", command: "veteran",
                   stealth: "veteran" }),
      notes: "<p><b>Храм Инкубов — РЕЙД-БОСС.</b> <b>Роль:</b> иерарх храма войны, совершеннейший "
           + "фехтовальщик Комморры. Полуклэйв (двойной клинок, за полудействие складывается в Клэйв "
           + "и обратно) и перчатка-гидра. Тяжёлые латы инкуба со щитом-дефлектором. <b>Сверхъест. "
           + "Владение Оружием (3)</b> и <b>Сила (2)</b>. <b>Техника Гекатрии</b> + <b>Молниеносная "
           + "Атака</b> + <b>Вихрь Смерти</b> — каждое движение убивает; <b>Мастер Клинка</b>, "
           + "<b>Рипост</b>, <b>Контратака</b>, <b>Мастер Боя</b>. Внушает <b>Страх (2)</b>.</p>"
           + "<p><i>Тактика:</i> в свалку — Клэйв (2d10+7 E, +20 по сочленениям) с Вихрем Смерти; "
           + "против одиночек — Полуклэйв и Рипост. Практически не промахивается и парирует всё.</p>"
    },
    kit: withCore(
      melee(M.demiklaive), melee(M.klaive, { equipped: false }),
      melee(M.hydraGaunt, { equipped: false }), armr(A.incubus),
      FEAR(2, "Совершенный клинок Комморры, чьё имя знают все арены."),
      TRAIT("Unnatural Weapon Skill (3) / Сверхъест. Владение Оружием (3)", "+3 к Бонусу WS.",
            { charBonusStat: "ws", charBonusValue: 3 }, 3, true),
      TRAIT("Unnatural Strength (2) / Сверхъест. Сила (2)", "+2 к Бонусу Силы.",
            { charBonusStat: "s", charBonusValue: 2 }, 2, true),
      tal(["Kabalite Weapon Training", "Тренировка Кабалита"]),
      tal(["Hekatrii Technique", "Техника Гекатрии"]),
      tal(["Blademaster", "Мастер Клинка"]),
      tal(["Lightning Attack", "Молниеносная Атака"]),
      tal(["Swift Attack", "Быстрая Атака"]),
      tal(["Whirlwind of Death", "Вихрь Смерти"]),
      tal(["Riposte", "Рипост"]),
      tal(["Counter Attack", "Контратака"]),
      tal(["Crushing Blow", "Крушащий Удар"]),
      tal(["Precise Blow", "Выверенный Удар"]),
      tal(["Combat Master", "Мастер Боя"]),
      tal(["Step Aside", "Шаг в Сторону"]),
      tal(["Air of Authority", "Аура Власти"]),
      ...DRU_CORE)
  },

  // ── Мандрагора (порождение тени) ──────────────────────────────────────
  {
    name: "Мандрагора",
    folderParent: "Друкхари", folder: "Храм Инкубов и Тени", img: IMG,
    system: {
      race: "drukhari", subrace: "mandrake", size: 0,
      characteristics: CH({ ws:44, bs:30, s:30, t:30, ag:44, int:25, per:40, wp:34, fel:20, inf:30 }),
      wounds: { value: 16, max: 16, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ stealth: "expert", acrobatics: "trained", awareness: "trained",
                   dodge: "trained", intimidate: "trained" }),
      notes: "<p><b>Тени.</b> <b>Роль:</b> дитя теневого царства Элиндрах — убийца из темноты. "
           + "Блестящий клинок из Мерцающей Стали (излучает холод) и туника из ксеношкуры. "
           + "<b>Фаза</b> — материален лишь во тьме; выходит из теней Незримой атакой. "
           + "Демонический (3), <b>Бесстрашен</b>, <b>Тревожащий Голос</b>. Убивает и растворяется "
           + "в чужой тени. Внушает <b>Страх</b>.</p>"
    },
    kit: withCore(
      melee(M.glimmersteel), armr(A.xenohide),
      FEAR(1, "Чёрный силуэт с горящими глазами, шагающий из теней."),
      TRAIT("Unnatural Strength (4) / Сверхъест. Сила (4)", "+4 к Бонусу Силы.",
            { charBonusStat: "s", charBonusValue: 4 }, 4, true),
      TRAIT("Unnatural Toughness (2) / Сверхъест. Стойкость (2)", "+2 к Бонусу Стойкости.",
            { charBonusStat: "t", charBonusValue: 2 }, 2, true),
      TRAIT("Daemonic (3) / Демонический (3)",
            "Поглощение варп-урона +3 (от теневого измерения). Обходится Force/Sanctified/Warp Weapon.", {}, 3, true),
      TRAIT("Phase / Фаза",
            "Материален только во Тьме/Слабом Свете. В Тьме +20 и Преимущество на Уворот/Скрытность. "
          + "Может входить в теневое измерение (телепорт до 500 м между тёмными точками; выход — "
          + "Незримая атака). Иммунитет к холоду/вакууму."),
      TRAIT("Drasii / Житель Тьмы",
            "Видит сквозь любую тьму; аура холода 16 м. Убийство даёт заряд атаки «Губительное Пламя» "
          + "(Doomfire: пистолет 20 м, 1d10+6 E, Corrosive/Crippling/Shocking). Бонусы теряются под "
          + "запечатанной бронёй."),
      tal(["Fearless", "Бесстрашный"]),
      tal(["Unarmed Warrior", "Безоружный Воин"]),
      tal(["Deep Fear", "Глубокий Страх"]),
      tal(["Assassin Strike", "Удар Ассасина"]),
      tal(["Step Aside", "Шаг в Сторону"]),
      tal(["Fast And Swift", "Быстрый И Проворный"]),
      ...DRU_CORE.filter(t => !/Godless|Through the Pain/.test(t.inline?.name || "")))
  },

  // ── Гекатрикс (сержант ведьм) ─────────────────────────────────────────
  {
    name: "Гекатрикс",
    folderParent: "Друкхари", folder: "Культ Ведьм", img: IMG,
    system: {
      race: "drukhari", size: 0,
      characteristics: CH({ ws:54, bs:36, s:32, t:30, ag:52, int:36, per:44, wp:36, fel:44, inf:44 }),
      wounds: { value: 18, max: 18, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ acrobatics: "veteran", dodge: "veteran", parry: "veteran",
                   athletics: "trained", command: "trained", intimidate: "trained",
                   stealth: "knows" }),
      notes: "<p><b>Культ Ведьм.</b> <b>Роль:</b> вожак стаи ведьм на арене — между рядовой Ведьмой "
           + "и Суккубой. Клинок Суккуба и агонайзер, ведьмин костюм. <b>Два Оружия</b>, <b>Рипост</b>, "
           + "<b>Контратака</b>, <b>Удар Ассасина</b>. Ведёт группу ведьм, задаёт темп резни. "
           + "На боевых наркотиках. Пока Гекатрикс жива, ведьмы дерутся показательно жестоко.</p>"
    },
    kit: withCore(
      melee(M.succubusBl), melee(M.agoniser, { equipped: true }),
      gun(W.splinterPistol, { equipped: false }), armr(A.wychSuit),
      chem(["Коммориттские Боевые Наркотики", "Combat Drug"]),
      amm(AM.crystals, 2),
      tal(["Kabalite Weapon Training", "Тренировка Кабалита"]),
      tal(["Swift Attack", "Быстрая Атака"]),
      tal(["Two Weapon Wielder", "Два Оружия"]),
      tal(["Riposte", "Рипост"]),
      tal(["Counter Attack", "Контратака"]),
      tal(["Step Aside", "Шаг в Сторону"]),
      tal(["Assassin Strike", "Удар Ассасина"]),
      tal(["Air of Authority", "Аура Власти"]),
      tal(["Deep Fear", "Глубокий Страх"]),
      ...DRU_CORE)
  },

  // ── Истиннорождённый (элитный кабалит) ────────────────────────────────
  {
    name: "Истиннорождённый",
    folderParent: "Друкхари", folder: "Кабал", img: IMG,
    system: {
      race: "drukhari", subrace: "truebornDrukhari", size: 0,
      characteristics: CH({ ws:46, bs:52, s:32, t:32, ag:46, int:42, per:46, wp:36, fel:42, inf:44 }),
      wounds: { value: 16, max: 16, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ awareness: "veteran", dodge: "trained", stealth: "trained",
                   acrobatics: "trained", command: "knows", intimidate: "knows" }),
      notes: "<p><b>Кабал.</b> <b>Роль:</b> рождённый естественным путём аристократ-воин, "
           + "презирающий клонов-кабалитов. Лучшая меткость и снаряжение. Осколкарабин «Удав» и "
           + "бласт-пистолет; кабалитская броня. <b>Снайпер</b>, <b>Могучий Выстрел</b>, "
           + "<b>Молниеносные Рефлексы</b>. Стреляет отравленными кристаллами лучше всех в отряде.</p>"
    },
    kit: withCore(
      gun(["Осколкарабин «Удав»", "Осколкарабин", "Splinter Carbine"]),
      gun(W.blastPistol, { equipped: false }), armr(A.kabalite),
      amm(AM.hypertoxic, 2), amm(AM.compressed, 1),
      tal(["Kabalite Weapon Training", "Тренировка Кабалита"]),
      tal(["Marksman", "Снайпер"]),
      tal(["Deadeye Shot", "В Яблочко"]),
      tal(["Mighty Shot", "Могучий Выстрел"]),
      tal(["Lightning Reflexes", "Молниеносные Рефлексы"]),
      tal(["Cruelty", "Жестокость"]),
      tal(["Copious Slaughter", "Обильная Резня"]),
      ...DRU_CORE)
  },

  // ═══════════════════════════ РАБЫ И ПРИСЛУЖНИКИ ═══════════════════════════
  // Пленники Комморры и экзотические твари-паразиты на службе Тёмных Аэльдари.

  // ── Медуза (варп-паразит) ─────────────────────────────────────────────
  {
    name: "Медуза",
    folderParent: "Друкхари", folder: "Рабы и Прислужники", img: IMG,
    system: {
      race: "", size: 0,
      characteristics: CH({ ws:32, bs:15, s:22, t:26, ag:42, int:34, per:42, wp:55, fel:28, inf:35 }),
      wounds: { value: 20, max: 20, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ dodge: "trained", awareness: "trained", psyniscience: "trained",
                   deceive: "knows", stealth: "knows" }),
      notes: "<p><b>Прислужник.</b> <b>Роль:</b> варп-паразит из свиты Архонтов — питается эмоциями "
           + "и болью. Без хоста парит (Hoverer) и рвёт щупальцами; захватывает беспомощного носителя "
           + "за день и правит его телом (жертва в полу-коме всё видит, но бессильна). Использует "
           + "навыки/таланты/Сверхъест. характеристики хоста. Развеивается в Варп, если месяц не "
           + "питается сильной эмоцией — убивая носителя. <b>Не От Мира Сего</b>, <b>Варп-Зрение</b>, "
           + "<b>Страх (2)</b>. Данный лист — форма без хоста.</p>"
    },
    kit: [
      FEAR(2, "Бестелесный варп-хищник, впивающийся в душу."),
      TRAIT("Unnatural Willpower (4) / Сверхъест. Воля (4)", "+4 к Бонусу Воли.",
            { charBonusStat: "wp", charBonusValue: 4 }, 4, true),
      TRAIT("Deadly Natural Weapon (Щупальца) / Смертельное Природное Оружие",
            "Щупальца: рукопашная атака 1d10+S.b R, Pen 2 (укус — Pen 7). Считается природным оружием."),
      TRAIT("From Beyond / Не От Мира Сего",
            "Сущность Варпа: иммунитет к нементальным психосилам, страху, ядам, болезням, вакууму; "
          + "не нуждается в воздухе/еде/сне. Паралич/оглушение действуют лишь от Force/Sanctified/Warp."),
      TRAIT("Parasite / Паразит",
            "Атакой на беспомощного/оглушённого захватывает тело за 1 день (псайкера — тоже за день). "
          + "Управляет хостом; жертва в полу-коме. Получает и делит Сверхъест. хар-ки (кроме S/T/A), "
          + "Dark Sight, Unnatural/Sonar Senses хоста. При гибели хоста живёт ещё T.b дней (W.b в мат. мире)."),
      TRAIT("Hoverer / Парящий",
            "Без хоста парит и перемещается по воздуху со скоростью W.b (Manoeuvrable)."),
      TRAIT("Warp Sight / Варп-Зрение",
            "Видит души и потоки эмоций; авто-обнаружение живых/псайкеров в радиусе Per м.")
    ]
  },

  // ── Раб-Боец Ямы (человек-гладиатор) ──────────────────────────────────
  {
    name: "Раб-Боец Ямы",
    folderParent: "Друкхари", folder: "Рабы и Прислужники", img: IMG,
    system: {
      race: "human", size: 0,
      characteristics: CH({ ws:38, bs:22, s:38, t:36, ag:34, int:24, per:30, wp:32, fel:22, inf:25 }),
      wounds: { value: 14, max: 14, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ athletics: "trained", parry: "knows", dodge: "knows",
                   intimidate: "knows", awareness: "knows" }),
      notes: "<p><b>Раб.</b> <b>Роль:</b> пленник-человек, брошенный на арену Комморры на потеху "
           + "Друкхари. Дерётся отчаянно — жить всё равно не дадут. Трофейный гладий и обрывки "
           + "ксеношкуры. <b>Ярость</b> отчаяния, <b>Стальные Нервы</b>. Выставляется толпами или "
           + "как «дичь» на охоте геллионов и укротителей.</p>"
    },
    kit: [
      melee(["Гладий", "Меч", "Sword"]), armr(A.xenohide),
      TRAIT("Broken Chains / Разорванные Цепи",
            "Смертник арены: авто-проходит первый тест Страха/Морали в бою (терять нечего), "
          + "но при потере половины Ран может попытаться сбежать (тест Воли)."),
      tal(["Frenzy", "Ярость"]),
      tal(["Nerves of Steel", "Стальные Нервы"]),
      tal(["Bulging Biceps", "Могучие Бицепсы"])
    ]
  },

  // ── Порабощённый Невольник (человек-пушмясо) ──────────────────────────
  {
    name: "Порабощённый Невольник",
    folderParent: "Друкхари", folder: "Рабы и Прислужники", img: IMG,
    system: {
      race: "human", size: 0,
      characteristics: CH({ ws:25, bs:20, s:28, t:28, ag:28, int:22, per:25, wp:18, fel:20, inf:20 }),
      wounds: { value: 8, max: 8, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ athletics: "knows", stealth: "knows" }),
      notes: "<p><b>Раб.</b> <b>Роль:</b> сломленный невольник-работяга Комморры — живой инструмент, "
           + "щит и разменная монета. Нож или обломок трубы, лохмотья. <b>Сломленная Воля</b>: "
           + "паникует и бежит при первой возможности, если рядом нет надсмотрщика-Друкхари. "
           + "Выставляется толпами как заслон или отвлечение.</p>"
    },
    kit: [
      melee(["Нож", "Knife"]), armr(["Выделанная Кожа", "Рубище", "Leather"]),
      TRAIT("Broken Will / Сломленная Воля",
            "Забитый раб: −10 на все тесты Воли/Страха/Морали; при провале Страха бежит. "
          + "Под присмотром надсмотрщика-Друкхари в радиусе 10 м штраф снимается.")
    ]
  }

];
