// module/constants/formation.mjs
// ════════════════════════════════════════════════════════════════════════
//  «Книга Битв» — масштабные войны: формирования и соединения.
//  Сила / Численность / Боевой дух / Скорость, приказы, ландшафт,
//  ключевые события, обстрелы планет.
// ════════════════════════════════════════════════════════════════════════

/** Типы акторов, которых можно придать формированию (командир и герои). */
export const FORMATION_HERO_TYPES = ["character", "daemon", "demonPrince"];

/**
 * Типы подразделений (таблица «Род войск»).
 * s — базовая Сила; def = 2×S (пересчитывается от итоговой Силы);
 * rng — дальность поражения в км (null = «С», обычное соприкосновение);
 * spd — км за стратегический раунд; r — значение колонки «R» из таблицы.
 */
export const TROOP_TYPES = {
  lightInfantry:   { label: "Лёгкая пехота",                 cat: "infantry", s: 2,  rng: null, spd: 30,   r: 0,
    examples: "Горные стрелки, воины джунглей, партизаны, скауты, десантные части, культисты, ополчение, Фратерис Милиция" },
  mediumInfantry:  { label: "Средняя пехота",                cat: "infantry", s: 4,  rng: null, spd: 20,   r: 1,
    examples: "Большинство полков Имперской Гвардии, инженеры, сапёры, астартес" },
  heavyInfantry:   { label: "Тяжёлая пехота",                cat: "infantry", s: 6,  rng: null, spd: 15,   r: 2,
    examples: "Бронебойщики, Отпрыски Темпестус, гренадеры, тяжеловооружённые части в панцирной броне, терминаторы" },

  lightCavalry:    { label: "Лёгкая кавалерия",              cat: "cavalry",  s: 2,  rng: null, spd: 70,   r: 2,
    examples: "Разведчики, застрельщики и налётчики" },
  mediumCavalry:   { label: "Средняя кавалерия",             cat: "cavalry",  s: 4,  rng: null, spd: 60,   r: 3,
    examples: "Всадники смерти Крига" },
  heavyCavalry:    { label: "Тяжёлая кавалерия",             cat: "cavalry",  s: 6,  rng: null, spd: 50,   r: 4,
    examples: "Волчья кавалерия Космических Волков" },

  lightMech:       { label: "Лёгкая механизированная пехота", cat: "mech",    s: 3,  rng: null, spd: 300,  r: 1,
    examples: "Мотоциклисты, лёгкие БТР, лендспидеры" },
  mediumMech:      { label: "Средняя механизированная пехота", cat: "mech",   s: 5,  rng: null, spd: 280,  r: 2,
    examples: "«Химеры», «Носороги»" },
  heavyMech:       { label: "Тяжёлая механизированная пехота", cat: "mech",   s: 7,  rng: 1,    spd: 250,  r: 3,
    examples: "«Лэнд Рейдеры»" },

  lightArmour:     { label: "Лёгкая бронетехника",           cat: "armour",   s: 5,  rng: null, spd: 170,  r: 1,
    examples: "«Часовые», «Саламандры»" },
  mediumArmour:    { label: "Средняя бронетехника",          cat: "armour",   s: 7,  rng: 1,    spd: 140,  r: 2,
    examples: "«Леманы Руссы», «Хищники»" },
  heavyArmour:     { label: "Тяжёлая бронетехника",          cat: "armour",   s: 9,  rng: 5,    spd: 120,  r: 3,
    examples: "«Клинок Бури», «Махарий»" },

  lightArtillery:  { label: "Лёгкая артиллерия",             cat: "artillery", s: 4, rng: 5,    spd: 120,  r: 1,
    examples: "Тяжёлые миномёты, ракетные установки" },
  mediumArtillery: { label: "Средняя артиллерия",            cat: "artillery", s: 6, rng: 20,   spd: 100,  r: 2,
    examples: "«Медузы», «Василиски»" },
  heavyArtillery:  { label: "Тяжёлая артиллерия",            cat: "artillery", s: 8, rng: 40,   spd: 90,   r: 3,
    examples: "«Мантикоры», осадные пушки, «Смертельные удары»" },

  lightAir:        { label: "Лёгкая авиация",                cat: "air",      s: 6,  rng: 5,    spd: 2700, r: 3,
    examples: "Перехватчики, скоростные транспорты, разведчики, «Молнии»",
    rngNote: "1 км из авиапушек, 5 км ракетами" },
  mediumAir:       { label: "Средняя авиация",               cat: "air",      s: 8,  rng: 10,   spd: 2400, r: 4,
    examples: "«Гром», «Шаровая молния», «Валькирии», «Стервятники»",
    rngNote: "1 км из авиапушек, 10 км ракетами" },
  heavyAir:        { label: "Тяжёлая авиация",               cat: "air",      s: 10, rng: 20,   spd: 2100, r: 5,
    examples: "«Мародёры», «Фурии», «Звёздные ястребы»",
    rngNote: "1 км из авиапушек, 20 км ракетами" },

  lightAA:         { label: "Лёгкая ПВО",                    cat: "aa",       s: 4,  rng: 5,    spd: 170,  r: 2,
    examples: "Турели, пехотные ракетные установки, тяжёлые стабберы и болтеры",
    aaRadius: 5,  aaCover: 10 },
  mediumAA:        { label: "Средняя ПВО",                   cat: "aa",       s: 6,  rng: 10,   spd: 140,  r: 3,
    examples: "«Гидры», техника со спаренными автопушками",
    aaRadius: 10, aaCover: 20 },
  heavyAA:         { label: "Тяжёлая ПВО",                   cat: "aa",       s: 8,  rng: 30,   spd: 110,  r: 4,
    examples: "«Мантикоры»",
    aaRadius: 30, aaCover: 30 },

  lightTitan:      { label: "Лёгкий титан",                  cat: "titan",    s: 25, rng: 1,    spd: 70,   r: 4,
    examples: "«Гончие»", fearless: true, defaultCount: 50 },
  mediumTitan:     { label: "Средний титан",                 cat: "titan",    s: 35, rng: 5,    spd: 60,   r: 5,
    examples: "«Налётчик», «Полководец»", fearless: true, defaultCount: 75 },
  heavyTitan:      { label: "Тяжёлый титан",                 cat: "titan",    s: 45, rng: 10,   spd: 50,   r: 6,
    examples: "«Император»", fearless: true, defaultCount: 100 },

  lightKnight:     { label: "Лёгкие Имперские Рыцари",       cat: "knight",   s: 8,  rng: null, spd: 110,  r: 3,
    examples: "Оруженосцы" },
  mediumKnight:    { label: "Средние Имперские Рыцари",      cat: "knight",   s: 10, rng: null, spd: 80,   r: 4,
    examples: "Церастусы, квесторисы" },
  heavyKnight:     { label: "Тяжёлые Имперские Рыцари",      cat: "knight",   s: 12, rng: null, spd: 60,   r: 5,
    examples: "Доминусы, Акастус-порфирионы" }
};

/** Порядок родов войск в выпадающем списке и справочнике. */
export const TROOP_CATEGORIES = {
  infantry:  "Пехота",
  cavalry:   "Кавалерия",
  mech:      "Механизированная пехота",
  armour:    "Бронетехника",
  artillery: "Артиллерия",
  air:       "Авиация",
  aa:        "Противовоздушная оборона",
  titan:     "Титаны",
  knight:    "Имперские Рыцари"
};

/**
 * Размер формирования — определяет число костей в броске урона.
 * Бригады и дивизии книга называет соединениями (unit: false).
 */
export const FORMATION_SIZES = {
  squad:     { label: "Отделение / звено (малое)", dice: 1, headcount: "до 20",            formation: true },
  platoon:   { label: "Взвод",                     dice: 2, headcount: "20–50",            formation: true },
  company:   { label: "Рота (Звено)",              dice: 3, headcount: "50–100",           formation: true },
  battalion: { label: "Батальон (Эскадрилья)",     dice: 4, headcount: "100–500",          formation: true },
  brigade:   { label: "Бригада (Авиакрыло)",       dice: 4, headcount: "2 000–20 000",     formation: false },
  division:  { label: "Дивизия (Авиадивизия)",     dice: 4, headcount: "40 000–100 000",   formation: false },
  army:      { label: "Армия / крестовый поход",   dice: 4, headcount: "миллионы",         formation: false }
};
export const SIZE_ORDER = ["squad", "platoon", "company", "battalion", "brigade", "division", "army"];

/** Технический уровень родного мира: модификатор Силы и Доступности. */
export const TECH_LEVELS = {
  savage:     { label: "Дикий",         s: -1, avail: 30,  allows: "Лёгкая и средняя пехота" },
  feudal:     { label: "Феодальный",    s:  0, avail: 20,  allows: "Пехота, кавалерия и, отчасти, артиллерия" },
  industrial: { label: "Промышленный",  s:  1, avail: 10,  allows: "Пехота, кавалерия, артиллерия, лёгкая механизированная пехота, лёгкая бронетехника" },
  advanced:   { label: "Развитый",      s:  2, avail: 0,   allows: "Любые, кроме титанов" },
  modern:     { label: "Современный",   s:  3, avail: -10, allows: "Любые" }
};
export const TECH_ORDER = ["savage", "feudal", "industrial", "advanced", "modern"];

/** Какие категории войск доступны на мире данного технического уровня. */
export const TECH_ALLOWED = {
  savage:     ["infantry"],
  feudal:     ["infantry", "cavalry", "artillery"],
  industrial: ["infantry", "cavalry", "artillery", "mech", "armour"],
  advanced:   ["infantry", "cavalry", "artillery", "mech", "armour", "air", "aa", "knight"],
  modern:     ["infantry", "cavalry", "artillery", "mech", "armour", "air", "aa", "knight", "titan"]
};

/** Подготовка войска (таблица 4-5): Доступность, Выучка, Боевой дух. */
export const TRAINING_LEVELS = {
  conscripts:    { label: "Призывники",     avail: 10,  skill: 20, morale: 50,
    desc: "Фермеры, преступники, отбросы, безумцы и нищие: простейшая подготовка, лазган и самоубийственная атака. Пример — штрафные легионы." },
  tithe:         { label: "Десятина",       avail: 0,   skill: 30, morale: 60,
    desc: "Большая часть СПО, Имперской Гвардии и придворных армий вольных торговцев. Надёжные бойцы, но страх и хаос жаркого боя могут их сломить." },
  professionals: { label: "Профессионалы",  avail: -10, skill: 40, morale: 80,
    desc: "Умелые солдаты, сделавшие войну ремеслом: опытные гвардейские части, младший офицерский корпус, многие наёмные роты." },
  veterans:      { label: "Ветераны",       avail: -20, skill: 50, morale: 90,
    desc: "Прошли много боёв и стали лучшими солдатами. Ротные офицеры и отборные формирования Гвардии. Сломить их почти невозможно." },
  elite:         { label: "Элита",          avail: -30, skill: 60, morale: 100,
    desc: "Астартес, полки штурмовиков и лучшие наёмники. Самые опасные и самые дорогие солдаты — смятение в их рядах едва ли возможно." }
};
export const TRAINING_ORDER = ["conscripts", "tithe", "professionals", "veterans", "elite"];

/** Качество уставного снаряжения: Сила и Боевой дух. */
export const GEAR_QUALITY = {
  poor:     { label: "Низкое",  s: -1, moraleDie: "-1d10",
    examples: "Самоорганизованные войска, скитающиеся отряды космодесанта Хаоса, отлучённые ордена, штрафные полки, повстанцы, культисты" },
  standard: { label: "Среднее", s:  0, moraleDie: "",
    examples: "Штатное оснащение" },
  good:     { label: "Хорошее", s:  1, moraleDie: "+1d10",
    examples: "Богатые отряды легионов-предателей, хорошо снабжаемые ордена Астартес или полки Гвардии" }
};
export const GEAR_ORDER = ["poor", "standard", "good"];

/** Ландшафт: очки укрытия и множитель скорости. */
export const TERRAIN_TYPES = {
  open:       { label: "Открытая местность",     cover: 0, speed: 1.00,
    desc: "Бескрайние равнины или невысокие холмы. Ни деревьев, ни скал, ни иных препятствий." },
  rough:      { label: "Труднопроходимая",       cover: 2, speed: 0.75,
    desc: "Заросли, древние руины, остатки сожжённых городов, снег, мелкие болота и пески." },
  impassable: { label: "Непроходимая",           cover: 3, speed: 0.50,
    desc: "Горные хребты, глубокий снег, ледяные торосы." },
  urban:      { label: "Городская застройка",    cover: 1, speed: 0.75,
    desc: "Феодальный город, автоматизированная фабрика или небольшие жилые блоки." },
  denseUrban: { label: "Плотная застройка",      cover: 5, speed: 0.25,
    desc: "Ульи, космические станции и недра миров-кузниц. Укрытия здесь на каждом шагу." }
};
export const TERRAIN_ORDER = ["open", "rough", "impassable", "urban", "denseUrban"];

/**
 * Приказы. Один приказ на стратегический ход.
 * test — {skill|char, mod} или null (приказ без броска);
 * air — можно ли отдавать авиации.
 */
export const ORDERS = {
  attack: { label: "Наступление", en: "Attack", test: null, air: true,
    desc: "Двигаться к позициям врага и попытаться уничтожить его или обратить в бегство. Если два формирования войдут в соприкосновение, они атакуют друг друга." },

  advance: { label: "Продвижение", en: "Advance", test: null, air: true,
    desc: "Движение на полной скорости из точки в точку. Формирование не готово немедленно вступить в бой: войдя в соприкосновение, оно может прервать марш, но до конца стратегического хода бросает на одну кость меньше в бросках урона.",
    effect: { diceMod: -1 } },

  cautious: { label: "Осторожное продвижение", en: "Cautious Advance", test: null, air: true,
    desc: "Движение вдвое медленнее обычного, но с постоянной бдительностью: при столкновении с врагом формирование не получает никаких штрафов. Выйти из боя без потерь этим приказом нельзя.",
    effect: { speedMult: 0.5 } },

  charge: { label: "Натиск", en: "Charge", test: { skill: "intimidate", char: "wp", mod: 0 }, air: true,
    desc: "Старая добрая лобовая атака. При успехе враг теряет 1к10 боевого духа и до конца стратегического раунда наносит совершившему натиск формированию на 1к10 урона меньше." },

  digIn: { label: "Окапывание", en: "Dig In",
    test: { group: "scholasticLore", spec: "Tactica Imperialis", mod: 0, alt: { group: "trade", spec: "Earthworks", char: "s", mod: 10 } },
    air: false,
    desc: "Солдаты находят надёжные укрытия и строят полевые укрепления. Успех даёт 10 очков укрытия, провал — 5. Танковое формирование при окапывании получает дополнительно +1к10 очков укрытия.",
    effect: { coverOnSuccess: 10, coverOnFail: 5 } },

  feint: { label: "Ложный удар", en: "Feint", test: { skill: "deceive", char: "fel", mod: -10 }, air: true,
    desc: "Подразделение наносит ложный удар, отвлекая врага от истинной цели. Успех — +5 к урону против настоящей цели на 1к5 стратегических раундов. Провал — атакующее истинную цель формирование до конца стратегического хода захвачено внезапностью." },

  flank: { label: "Фланговый обход", en: "Flank",
    test: { group: "scholasticLore", spec: "Tactica Imperialis", mod: 10,
            alt: { group: "commonLore", spec: "War", mod: 0 }, alt2: { skill: "logic", char: "int", mod: -10 } },
    air: true,
    desc: "Удар во фланг. Успех — +10 к урону на следующие 1к5 стратегических раундов, пока враг перестраивает боевые порядки. Провал — бонуса нет, а ГМ может дать несостоявшейся жертве возможность контратаки." },

  forcedMarch: { label: "Форсированный марш", en: "Forced March", test: { char: "t", mod: 0 }, air: true,
    airLabel: "Спешный перелёт",
    desc: "Формирование удваивает километраж за стратегический ход. После марш-броска солдаты вымотаны: −10 на все тесты и на три кости урона меньше, пока не отдохнут хотя бы один стратегический ход.",
    effect: { speedMult: 2 } },

  disengage: { label: "Перегруппировка", en: "Disengage", test: { skill: "command", char: "fel", mod: -10 }, air: true,
    desc: "Выход из соприкосновения без бегства с поля боя. Успех — в начале следующего стратегического хода формирование также считается окопавшимся. Провал — формирование в панике и беспорядке, −10 на все его тесты. Повторить перегруппировку можно через два стратегических раунда тестом Command(F) −20." },

  pushThrough: { label: "Прорыв", en: "Push Through",
    test: { skill: "command", char: "fel", mod: -20, alt: { skill: "intimidate", char: "wp", mod: -20 } }, air: true,
    desc: "Прорваться через ряды врага, рассеять его или отрезать от частей поддержки. Успех — цель достигнута, но враг наносит дополнительные 1к10 урона. Провал — прорыв отбит, враг наносит дополнительные 2к10 урона." },

  withdrawal: { label: "Стратегическое отступление", en: "Strategic Withdrawal",
    test: { skill: "command", char: "fel", mod: -20 }, air: true,
    desc: "Выход из боя с половиной обычной скорости. Все атаки по отступающим наносят +5 урона. Провал — формирование в хаосе и панике: −10 на все тесты на два следующих стратегических раунда.",
    effect: { speedMult: 0.5 } },

  airPatrol: { label: "Воздушное патрулирование", en: "Combat Air Patrol", test: null, air: true, airOnly: true,
    desc: "Авиация патрулирует и атакует наземные и воздушные цели по мере возможности, поддерживая дружественные наземные части. Патрулирующее формирование прикрывает пятьдесят квадратных километров и перехватывает всю встреченную авиацию противника." }
};
export const ORDER_ORDER = ["attack", "advance", "cautious", "charge", "digIn", "feint", "flank",
                            "forcedMarch", "disengage", "pushThrough", "withdrawal", "airPatrol"];

/** Модификаторы броска урона — то, что книга даёт как разовые бонусы. */
export const DAMAGE_MODS = [
  { key: "surprise", label: "Внезапность (первый раунд)", value: 10 },
  { key: "flank",    label: "Удался фланговый обход",     value: 10 },
  { key: "feint",    label: "Удался ложный удар",         value: 5 },
  { key: "recon",    label: "Рекогносцировка",            value: 0, dice: 1 },
  { key: "keyEvent", label: "Успешное ключевое событие",  value: 0, dice: 1 },
  { key: "withdraw", label: "Цель отступает",             value: 5 },
  { key: "charged",  label: "Мы под Натиском врага",      value: 0, dice: -1 },
  { key: "advance",  label: "Мы на Продвижении",          value: 0, dice: -1 },
  { key: "marched",  label: "Вымотаны форсированным маршем", value: 0, dice: -3 },
  { key: "artillery",label: "Ключевое событие «Артобстрел»", value: -3 }
];

/** Ключевые события: сцены, в которых герои прямо влияют на ход битвы. */
export const KEY_EVENTS = {
  barrage: { label: "Артиллерийский обстрел", tier: "simple",
    test: { skill: "navigation", spec: "Surface", char: "int", mod: 0 },
    desc: "Не идёт в счёт приказов раунда. Артиллеристы совершают атаку с уроном на 3 меньше обычного, но либо лишают врага 1к10 очков укрытия, либо наносят 3к10 урона боевому духу — по выбору. Провал: обстрел ложится не там, где нужно (ГМ определяет по схеме направлений)." },

  voxWar: { label: "Вокс-электронная борьба", tier: "simple",
    test: { skill: "techUse", char: "int", mod: -20 },
    desc: "Успех глушит вражескую связь: в следующем стратегическом раунде жертва получает −10 из-за падения боеспособности. Провал — враг дал отпор; его вокс-связист может отследить источник помех." },

  sabotage: { label: "Диверсия", tier: "complex",
    test: { skill: "stealth", char: "ag", mod: 0, alt: { skill: "techUse", char: "int", mod: 0 } },
    desc: "Отдельная сцена: подобраться тестом Stealth(A)+0 и уничтожить цель тестом Tech-Use(I)+0. Успех — жертва наносит на 2 очка урона меньше, теряет 2к10 численности и 4к10 боевого духа." },

  supplies: { label: "Неожиданные поставки", tier: "simple",
    test: { skill: "sleightOfHand", char: "ag", mod: -10, alt: { skill: "deceive", char: "fel", mod: -20 } },
    desc: "Пайки, снаряды, медикаменты или лхо, которые «просто лежали». Успех навсегда поднимает боевой дух формирования на 2к10." },

  bombardment: { label: "Обстрел планеты", tier: "medium",
    test: { group: "operate", spec: "Voidships", char: "int", mod: -40 },
    desc: "Корабль выходит на опасно низкую орбиту и проходит тест Operate(Voidships)(I) −40 и тест BS −40. Если оба успешны — цель накрыта. Иначе удар ложится в 2к10+Х км от заданной точки, где Х — сумма ступеней провала обоих тестов." },

  recon: { label: "Рекогносцировка", tier: "medium",
    test: { skill: "stealth", char: "ag", mod: 0, alt: { skill: "awareness", char: "ag", mod: 0 } },
    desc: "Нужны хотя бы один тест Stealth(A)+0 и один Awareness(A)+0; ГМ может потребовать Tech-Use(I), Navigation(Surface)(I) и Security(I). Успех — дружественные войска атакуют с бонусом +10 и наносят +1к10 урона в текущем и следующих стратегических раундах." },

  triage: { label: "Сортировка раненых", tier: "simple",
    test: { skill: "medicae", char: "int", mod: -20 },
    desc: "Только если формирование понесло потери в прошлый стратегический раунд. Успех уменьшает потери численности вдвое, а потери боевого духа — вчетверо." },

  rally: { label: "Сплочение", tier: "simple",
    test: { skill: "command", char: "fel", mod: -10,
            alt: { skill: "deceive", char: "fel", mod: -10 }, alt2: { skill: "intimidate", char: "wp", mod: -10 },
            alt3: { skill: "charm", char: "fel", mod: -10 } },
    desc: "Успех восстанавливает 2к10 боевого духа и даёт +5 к боевым тестам в текущем стратегическом раунде. Провал обрушивает боевой дух на 1к10 и даёт −5. В варианте среднего события (социальная сцена) бонусы возрастают до 3к10 и +10." },

  airStrike: { label: "Удар с воздуха", tier: "simple",
    test: { skill: "navigation", spec: "Surface", char: "int", mod: 0, alt: { skill: "command", char: "fel", mod: 0 } },
    desc: "Простой вариант: тест Navigation(Surface)(I)+0 для координат и Command(F)+0 для наведения самолёта. Средний добавляет второго героя за штурвалом — Operate(Aeronautica)(A)+0 с бонусом +5 за каждую ступень успеха товарища. Если цель уничтожена, в следующем стратегическом раунде вражеское формирование наносит на 2 очка меньше урона." }
};
export const KEY_EVENT_ORDER = ["barrage", "voxWar", "sabotage", "supplies", "bombardment",
                                "recon", "triage", "rally", "airStrike"];

export const EVENT_TIERS = {
  simple:  { label: "Простое",  desc: "Один-два авантюриста, малое количество тестов. Одна цель." },
  medium:  { label: "Среднее",  desc: "Двое-трое авантюристов, больше тестов; возможны исследовательское изыскание, социальная сцена или короткий бой. Одна цель." },
  complex: { label: "Сложное",  desc: "Вся команда: разные тесты, каверзное изыскание, социальная сцена или масштабный бой. Три цели — главная и две второстепенных; успех за главную или обе второстепенных." }
};

/** Награда за успешное ключевое событие. */
export const KEY_EVENT_REWARD =
  "В следующем стратегическом раунде все прямо задействованные в бою формирования получают +20 ко всем тестам и наносят +1к10 урона. Отдельные события могут приносить иные, уникальные награды.";

export const KEY_EVENT_LIMITS = [
  "На авантюриста должно приходиться не больше двух ключевых событий за один день игрового времени.",
  "У каждого события должна быть цель: простым и средним хватит одной, сложным нужны главная и две второстепенных.",
  "Злоупотребление ключевыми событиями перегружает историю повторяющимися сценами."
];

/** Обстрелы планет с низкой орбиты. */
export const ORBITAL_BOMBARDMENT = [
  { key: "lance", label: "Лэнс-излучатели",
    bulk: "75+5к10 урона численности", single: "5к10+10 Э, ББ 6",
    area: "Несколько сотен метров полного уничтожения; ударная волна расходится на 1 км².",
    note: "Цель в радиусе изначального попадания просто погибает — чтобы выжить, нужно потратить очко судьбы." },
  { key: "macro", label: "Макробатареи",
    bulk: "40+5к10 урона численности", single: "4к10+5, ББ 4",
    area: "Каждое попадание — несколько десятков метров; залп сметает всё в пределах 10 км².",
    note: "Цель в радиусе изначального попадания просто погибает — чтобы выжить, нужно потратить очко судьбы." }
];

export const ORBITAL_NOTE =
  "Пережившие обстрел немедленно утрачивают боеспособность и бегут с поля боя, если только приданный авантюрист не пройдёт тест Command(F) −40, чтобы навести порядок. Урон считается по общим правилам — помогают броня, укрытия и бонус Стойкости, но от него нельзя уклониться и его невозможно парировать.";

/** Особые формирования: астартес и титаны идут по своим профилям. */
export const SPECIAL_FORMATIONS = [
  { label: "Адептус Астартес",
    desc: "Элитное формирование тяжёлой пехоты с Силой 20 и боевым духом 100. Поскольку каждый астартес стоит множества обычных солдат, численность такого формирования впятеро выше обычного количества космодесантников в нём. Простым тестом приобретения космодесантников не получить — нужны месяцы переговоров и хорошего отыгрыша." },
  { label: "Титаны",
    desc: "Каждый титан — отдельное формирование: «Гончая» — численность 50, Сила 25; «Разбойник» — 75 и 35; «Полководец» — 100 и 45. Показателя боевого духа у титанов нет: богомашины неспособны удариться в панику и все тесты боевого духа проходят автоматически." },
  { label: "Имперские Рыцари",
    desc: "Одноместные мини-титаны 9–12 метров высотой под почти непроницаемыми ионными щитами. Развёртываются группой из нескольких машин. Управлять Рыцарем может лишь дворянин родового рыцарского дома, прошедший ритуал становления." }
];

/** Порядок сбора войска — три пути. */
export const RECRUITMENT_PATHS = [
  { label: "Собрать своими силами",
    desc: "Пожирает много времени и средств, но позволяет снабдить солдат тем оружием, бронёй, машинами, снаряжением, провиантом и укрытиями, что сочтёте нужным. Организация может растянуться на месяцы или годы и по карману обычно лишь настоящим богачам." },
  { label: "Нанять кондотьеров",
    desc: "Куда проще — особенно в Коронусе. Каждая вольная рота имеет свою репутацию, так что наниматель обычно знает, что получит за деньги. Увы, надёжные наёмники стоят дорого." },
  { label: "Затребовать войска у сюзерена",
    desc: "Некоторые патенты позволяют требовать содействия Имперской Гвардии. В теории это работает намного лучше, чем на практике: губернаторы могут упорно не замечать запросов, не желая отдавать обученных и снаряжённых солдат." }
];

/** Правила истощения — пороги и штрафы. */
export const ATTRITION = {
  moralePerNumbers: 10,      // за каждые 10 потерянной численности — 1к10 боевого духа
  moraleDie: "1d10",
  penaltyPerMorale: 20,      // за каждые 20 потерянного боевого духа — −5 к тестам
  penaltyStep: -5,
  thresholds: [0.5, 0.25],   // тесты боевого духа при 50% и 25% от предела
  rallyBonus: 10             // Command(F)+0 приданного героя — +10 ко всем тестам боевого духа
};

/** Половинный урон по авиации от обычных наземных частей. */
export const AIR_HALF_DAMAGE_NOTE =
  "Наземные формирования, не являющиеся специальными зенитными частями, наносят авиации только половину урона.";

export const CONTACT_NOTE =
  "Формирования в пределах километра друг от друга считаются пребывающими в соприкосновении. Артиллерия и авиация бьют «за горизонт»: они считаются в соприкосновении со всеми врагами в пределах своей дальности поражения и могут атаковать их, не получая ответного урона.";

// ── Расчётные функции ───────────────────────────────────────────────────

/**
 * Итоговая Сила: род войск + технический уровень + качество снаряжения + ручной мод.
 * strengthOverride задаёт Силу напрямую — для астартес (20), титанов и особых частей.
 */
export function totalStrength({ troopType, techLevel, gearQuality, strengthMod = 0, strengthOverride = null }) {
  if (strengthOverride != null && strengthOverride !== "" && !Number.isNaN(Number(strengthOverride)))
    return Number(strengthOverride);
  const base = TROOP_TYPES[troopType]?.s ?? 0;
  const tech = TECH_LEVELS[techLevel]?.s ?? 0;
  const gear = GEAR_QUALITY[gearQuality]?.s ?? 0;
  return Math.max(0, base + tech + gear + (Number(strengthMod) || 0));
}

/** Оборона равна удвоенной Силе и работает как броня персонажей. */
export const defenceFrom = (s) => (Number(s) || 0) * 2;

/** Число костей урона по размеру формирования (плюс ситуативные модификаторы). */
export function damageDice(size, diceMod = 0) {
  const base = FORMATION_SIZES[size]?.dice ?? 4;
  return Math.max(0, base + (Number(diceMod) || 0));
}

/** Скорость с учётом ландшафта и приказа (км за стратегический раунд). */
export function effectiveSpeed({ troopType, terrain, speedMult = 1, speedOverride = null }) {
  const base = (speedOverride != null && speedOverride !== "" && !Number.isNaN(Number(speedOverride)))
    ? Number(speedOverride) : (TROOP_TYPES[troopType]?.spd ?? 0);
  const t = TERRAIN_TYPES[terrain]?.speed ?? 1;
  return Math.round(base * t * (Number(speedMult) || 1));
}

/** Суммарное укрытие: ландшафт + окопы + прикрытие ПВО + ручное. */
export function totalCover({ terrain, dugIn = 0, aaCover = 0, coverMod = 0 }) {
  return Math.max(0, (TERRAIN_TYPES[terrain]?.cover ?? 0)
    + (Number(dugIn) || 0) + (Number(aaCover) || 0) + (Number(coverMod) || 0));
}

/** Штраф за истощение: −5 за каждые 20 потерянных очков боевого духа. */
export function attritionPenalty(moraleMax, moraleValue) {
  const lost = Math.max(0, (Number(moraleMax) || 0) - (Number(moraleValue) || 0));
  return Math.floor(lost / ATTRITION.penaltyPerMorale) * ATTRITION.penaltyStep;
}

/** Модификатор Доступности при наборе: технический уровень + подготовка. */
export function availabilityMod(techLevel, training) {
  return (TECH_LEVELS[techLevel]?.avail ?? 0) + (TRAINING_LEVELS[training]?.avail ?? 0);
}

/** Численность = 10% от числа людей (у астартес — впятеро выше). */
export function numbersFromHeadcount(headcount, astartes = false) {
  const h = Math.max(0, Number(headcount) || 0);
  return Math.round(h / 10 * (astartes ? 5 : 1));
}
