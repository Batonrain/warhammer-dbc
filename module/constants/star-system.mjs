// module/constants/star-system.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  Звёздная система (Actor "starSystem") и небесные тела (Item "celestialBody").
//  Списки опций + генератор системы в духе Rogue Trader (Stars of Inferno).
// ─────────────────────────────────────────────────────────────────────────────
import { genUnique, toRoman } from "./name-gen.mjs";

// Типы небесных тел (с иконкой для строки на листе).
export const BODY_TYPES = {
  star:           { label: "Звезда",            icon: "☀" },
  planet:         { label: "Планета",           icon: "🪐" },
  moon:           { label: "Луна / Спутник",    icon: "🌑" },
  gasGiant:       { label: "Газовый гигант",    icon: "🜨" },
  asteroidBelt:   { label: "Астероидный пояс",  icon: "▪" },
  asteroidField:  { label: "Астероидное поле",  icon: "✦" },
  asteroidCluster:{ label: "Астероидный кластер", icon: "✶" },
  dustCloud:      { label: "Пылевое облако",    icon: "≈" },
  gravityRiptide: { label: "Гравитационный риф", icon: "꩜" },
  radiationField: { label: "Поле радиации",     icon: "☢" },
  derelict:       { label: "Дрейфующий объект", icon: "⚙" },
  station:        { label: "Станция",           icon: "⌖" },
  warpGate:       { label: "Варп-врата / т. Мандевиля", icon: "◎" },
  anomaly:        { label: "Аномалия",          icon: "✺" },
  other:          { label: "Прочее",            icon: "•" }
};

// Орбитальные зоны системы.
export const ZONES = {
  innerCauldron:   "Внутренний Котёл",
  primaryBiosphere:"Первичная Биосфера",
  outerReaches:    "Внешние Пределы"
};

// Класс (тип) звезды.
export const STAR_CLASSES = {
  blueGiant:   "Голубой гигант",
  whiteStar:   "Белая звезда",
  yellowDwarf: "Жёлтый карлик",
  orangeDwarf: "Оранжевый карлик",
  redDwarf:    "Красный карлик",
  redGiant:    "Красный гигант",
  supergiant:  "Сверхгигант",
  whiteDwarf:  "Белый карлик",
  neutronStar: "Нейтронная звезда",
  pulsar:      "Пульсар",
  blackHole:   "Чёрная дыра",
  flareStar:   "Вспыхивающая звезда",
  protostar:   "Протозвезда",
  variable:    "Переменная звезда"
};
// Генерация звезды: [ключ, вес, фактор пригодности для жизни 0..1].
const STAR_GEN = [
  ["yellowDwarf", 6, 1.00], ["orangeDwarf", 5, 0.90], ["redDwarf", 7, 0.50],
  ["whiteStar", 3, 0.65],   ["blueGiant", 2, 0.25],   ["redGiant", 3, 0.15],
  ["supergiant", 1, 0.08],  ["whiteDwarf", 2, 0.10],  ["neutronStar", 1, 0.03],
  ["pulsar", 1, 0.02],      ["blackHole", 1, 0.00],   ["flareStar", 2, 0.20],
  ["protostar", 1, 0.05],   ["variable", 2, 0.30]
];
const STAR_LIFE = Object.fromEntries(STAR_GEN.map(s => [s[0], s[2]]));
const pickStar = () => pickW(STAR_GEN.map(s => [s[0], s[1]]));

// Конфигурации кратных звёзд.
export const STAR_CONFIGS = {
  single:       "Одиночная",
  closeBinary:  "Тесная двойная",
  wideBinary:   "Широкая двойная",
  hierarchical: "Иерархическая",
  trinary:      "Тройная (пара + далёкая)",
  wideTrinary:  "Тройная (разнесённая)"
};
// Компоновка звёзд: группы для отображения + «хозяева» планет (кто и сколько получает).
function starLayout(n) {
  if (n <= 1) return { config: "single", groups: [[0]], hosts: [[0, 1]],
    note: "" };
  if (n === 2) {
    const c = pick(["closeBinary", "wideBinary", "hierarchical"]);
    if (c === "closeBinary") return { config: c, groups: [[0, 1]], hosts: [[0, 1]],
      note: "Тесная двойная: звёзды обращаются вокруг общего центра вплотную, и почти все планеты вращаются сразу вокруг обеих." };
    if (c === "wideBinary") return { config: c, groups: [[0], [1]], hosts: [[0, 1], [1, 0.8]],
      note: "Широкая двойная: звёзды разнесены и обращаются вокруг общего центра тяжести; у каждой — собственные планеты." };
    return { config: "hierarchical", groups: [[0, 1]], hosts: [[0, 1], [1, 0.2]],
      note: "Иерархическая: меньшая звезда обращается по орбите вокруг главной, более массивной." };
  }
  const c = pick(["trinary", "wideTrinary"]);
  if (c === "wideTrinary") return { config: c, groups: [[0], [1], [2]], hosts: [[0, 1], [1, 0.7], [2, 0.5]],
    note: "Три разнесённые звезды вокруг общего центра тяжести, у каждой свои планеты." };
  return { config: "trinary", groups: [[0, 1], [2]], hosts: [[0, 1], [2, 0.5]],
    note: "Тесная пара в центре и третья звезда на огромной орбите в отдалении." };
}

// Особенности системы (множественный выбор).
export const SYSTEM_FEATURES = {
  bountiful:      "Изобильная",
  gravityTides:   "Гравитационные Приливы",
  haven:          "Гавань",
  illOmened:      "Зловещая",
  pirateDen:      "Логово Пиратов",
  ruinedEmpire:   "Руины Империи",
  starfarers:     "Звездоплаватели",
  stellarAnomaly: "Звёздная Аномалия",
  warpStasis:     "Варп-Застой",
  warpTurbulence: "Варп-Турбулентность"
};

// Размер тела (планеты/гиганта).
export const BODY_SIZES = {
  lowDensity: "Низкой плотности",
  small:      "Малое",
  large:      "Большое",
  vast:       "Огромное",
  gargantuan: "Гигантское (гигант)"
};

export const GRAVITY = { low: "Низкая", normal: "Нормальная", high: "Высокая" };

export const ATMOSPHERE_PRESENCE = {
  none:     "Отсутствует",
  thin:     "Разреженная",
  moderate: "Умеренная",
  heavy:    "Плотная"
};
export const ATMOSPHERE_TYPE = {
  deadly:    "Смертоносная",
  corrosive: "Едкая",
  toxic:     "Токсичная",
  tainted:   "Загрязнённая",
  pure:      "Чистая"
};

export const CLIMATE = {
  burning:   "Раскалённый",
  hot:       "Жаркий",
  temperate: "Умеренный",
  cold:      "Холодный",
  ice:       "Ледяной"
};

export const HABITABILITY = {
  inhospitable:    "Непригодная",
  trappedWater:    "Связанная вода",
  liquidWater:     "Жидкая вода",
  limitedEcosystem:"Ограниченная экосистема",
  verdant:         "Цветущая"
};

export const ALLEGIANCE = {
  imperial:   "Империум",
  mechanicus: "Адептус Механикус",
  astartes:   "Адептус Астартес",
  chaos:      "Хаос",
  xenos:      "Ксеносы",
  rogueTrader:"Вольный Торговец",
  humans:     "Человечество (вне Империума)",
  abandoned:  "Заброшено",
  unknown:    "Неизвестно"
};

// Виды ксеносов (можно выбрать; "other" — вписать своих в xenosCustom).
export const XENOS_SPECIES = {
  aeldari:  "Азуриан",
  drukhari: "Друкхари",
  ork:      "Орки",
  tau:      "Тау",
  necron:   "Некроны",
  yuvath:   "Ю'Ват",
  stryxis:  "Стиксис",
  kroot:    "Крут",
  rakgol:   "Раколы",
  hrud:     "Хруд",
  slaugth:  "Слаугт",
  enslaver: "Поработители",
  other:    "Другие ксеносы"
};

// Типы ресурсов (cat: raw — добывается; manufactured — нужна заселённость; special).
export const RESOURCE_TYPES = {
  // Продукция
  weapons:    { label: "Оружие",    cat: "product" },
  tech:       { label: "Техника",   cat: "product" },
  provisions: { label: "Провизия",  cat: "product" },
  plasteel:   { label: "Пласталь",  cat: "product" },
  // Сырьё
  ore:        { label: "Руда",      cat: "raw" },
  promethium: { label: "Прометий",  cat: "raw" },
  adamantium: { label: "Адамантий", cat: "raw" },
  phlogiston: { label: "Флогистон", cat: "raw" },
  organics:   { label: "Органика",  cat: "raw" },
  // Другое
  manpower:   { label: "Людской ресурс", cat: "other" },
  xenotech:   { label: "Ксенотех",  cat: "other" },
  heretek:    { label: "Еретех",    cat: "other" },
  archeotech: { label: "Археотех",  cat: "other" }
};
// Иконки ресурсов (зелёный голо-стиль).
const _RI = "systems/warhammer-dbc/assets/res-icons/";
export const RESOURCE_ICONS = {
  ore: _RI + "ore.svg", promethium: _RI + "promethium.svg", adamantium: _RI + "adamantium.svg",
  phlogiston: _RI + "phlogiston.svg", organics: _RI + "organics.svg", plasteel: _RI + "plasteel.svg",
  weapons: _RI + "weapons.svg", tech: _RI + "tech.svg", provisions: _RI + "provisions.svg",
  manpower: _RI + "manpower.svg", archeotech: _RI + "archeotech.svg", xenotech: _RI + "xenotech.svg",
  heretek: _RI + "heretek.svg"
};

// Заселённость / контроль системы (комбинируется при генерации).
export const INHABITANTS = {
  uncharted:   "Новооткрытая",
  uninhabited: "Необитаемая",
  imperium:    "Империум",
  mechanicus:  "Адептус Механикус",
  astartes:    "Адептус Астартес",
  rogueTrader: "Вольные Торговцы",
  humans:      "Человечество (вне Империума)",
  xenos:       "Ксеносы",
  pirates:     "Пираты",
  heretics:    "Еретики (Хаос)"
};

// ── Классификация имперских миров ──────────────────────────────────────────────
export const WORLD_CLASSES = {
  hive:        "Мир-улей",
  forge:       "Мир-кузница",
  agri:        "Агромир",
  civilised:   "Цивилизованный мир",
  industrial:  "Промышленный мир",
  mining:      "Добывающий мир",
  quarry:      "Мир-каменоломня",
  fortress:    "Мир-крепость",
  knight:      "Рыцарский мир",
  shrine:      "Мир-храм",
  cardinal:    "Кардинальский мир",
  cemetery:    "Мир-кладбище",
  pleasure:    "Мир удовольствий",
  feudal:      "Феодальный мир",
  feral:       "Дикий мир",
  frontier:    "Пограничный мир",
  research:    "Исследовательская станция",
  penal:       "Штрафная колония",
  warZone:     "Военная зона",
  quarantine:  "Изолированный мир"
};
// Среда (климатическая градация) — дополняет климат.
export const WORLD_ENVIRONMENTS = {
  temperate: "Умеренный мир",
  ice:       "Ледяной мир",
  dead:      "Мёртвый мир",
  jungle:    "Мир джунглей",
  death:     "Мир смерти",
  ocean:     "Океанический мир",
  desert:    "Пустынный мир"
};
// Имперская десятина (от наивысшей к наименьшей).
export const TITHE_GRADES = {
  exactisExtremis:   "Exactis Extremis",
  exactisParticular: "Exactis Particular",
  exactisMedian:     "Exactis Median",
  exactisPrima:      "Exactis Prima",
  exactisSecundus:   "Exactis Secundus",
  exactisTertius:    "Exactis Tertius",
  decumaExtremis:    "Decuma Extremis",
  decumaParticular:  "Decuma Particular",
  decumaPrima:       "Decuma Prima",
  decumaSecundus:    "Decuma Secundus",
  decumaTertius:     "Decuma Tertius",
  solutioExtremis:   "Solutio Extremis",
  solutioParticular: "Solutio Particular",
  solutioPrima:      "Solutio Prima",
  solutioSecundus:   "Solutio Secundus",
  solutioTertius:    "Solutio Tertius",
  aptusNon:          "Aptus Non"
};
const TITHE_ORDER = Object.keys(TITHE_GRADES);

// Доля добываемых и производимых ресурсов мира, изымаемая в имперскую десятину.
// Логика: Decuma (от лат. «десятина») ≈ 10%; Exactis — требовательные уровни (выше),
// Solutio — символические (ниже); Aptus Non — не взимается.
export const TITHE_RATES = {
  exactisExtremis:   0.40,
  exactisParticular: 0.35,
  exactisMedian:     0.30,
  exactisPrima:      0.27,
  exactisSecundus:   0.24,
  exactisTertius:    0.21,
  decumaExtremis:    0.18,
  decumaParticular:  0.15,
  decumaPrima:       0.12,
  decumaSecundus:    0.10,
  decumaTertius:     0.08,
  solutioExtremis:   0.06,
  solutioParticular: 0.05,
  solutioPrima:      0.04,
  solutioSecundus:   0.03,
  solutioTertius:    0.02,
  aptusNon:          0
};
// Ставка десятины по уровню (доля 0..1). Неизвестный/пустой уровень → 0.
export function titheRate(grade) { return TITHE_RATES[grade] || 0; }

// Профиль класса мира: десятина по умолчанию, перекос ресурсов (изобилие), описание.
const WORLD_PROFILE = {
  hive:       { tithe: "exactisExtremis", res: { weapons: 50, tech: 45, plasteel: 45, manpower: 90, provisions: 0 },
    blurb: "Мир-улей: исполинские города-ульи в десятки уровней, неисчислимое население, еда почти целиком импортируется." },
  forge:      { tithe: "aptusNon", res: { tech: 90, plasteel: 80, weapons: 60, ore: 50, archeotech: 25 },
    blurb: "Мир-кузница Адептус Механикус: бесконечные мануфактории и кузни, отравленная экология, полный цикл производства." },
  agri:       { tithe: "decumaPrima", res: { provisions: 80, organics: 65, manpower: 30 },
    blurb: "Агромир: планетарная ферма, кормящая соседние миры-ульи; малонаселён, под надзором Администратума." },
  civilised:  { tithe: "exactisTertius", res: { provisions: 50, plasteel: 50, tech: 45, weapons: 40, manpower: 55 },
    blurb: "Цивилизованный мир: самодостаточная планета городов с развитой промышленностью; самый распространённый тип." },
  industrial: { tithe: "exactisParticular", res: { plasteel: 80, weapons: 60, ore: 60, tech: 40 },
    blurb: "Промышленный мир: поверхность занята заводами и переработкой; небольшое население, мощная СПО." },
  mining:     { tithe: "exactisPrima", res: { ore: 85, adamantium: 50, promethium: 40 },
    blurb: "Добывающий мир: богат рудой и минералами; труд рабов и каторжан, часто без пригодной атмосферы." },
  quarry:     { tithe: "exactisMedian", res: { adamantium: 85, archeotech: 45, ore: 60 },
    blurb: "Мир-каменоломня: чрезвычайно ценные ископаемые; со времён Разлома особо ценится «чёрный камень»." },
  fortress:   { tithe: "aptusNon", res: { weapons: 75, plasteel: 50, manpower: 70 },
    blurb: "Мир-крепость: бастион обороны Империума; полки Астра Милитарум и флот, население живёт войной." },
  knight:     { tithe: "aptusNon", res: { tech: 60, weapons: 60 },
    blurb: "Рыцарский мир: феодальные дома, владеющие боевыми шагоходами-Рыцарями; тесные узы с Механикус." },
  shrine:     { tithe: "solutioPrima", res: { archeotech: 25, provisions: 20 },
    blurb: "Мир-храм: твердыня Экклезиархии, посвящённая Богу-Императору; даёт Империуму прежде всего веру." },
  cardinal:   { tithe: "solutioPrima", res: { archeotech: 30, provisions: 25 },
    blurb: "Кардинальский мир: управляется кардиналом Министорума, центр Имперского Культа и паломничества." },
  cemetery:   { tithe: "solutioTertius", res: { archeotech: 30 },
    blurb: "Мир-кладбище: огромные мавзолеи и поля могил, хранящие мёртвых имперских родов и павших воинов." },
  pleasure:   { tithe: "decumaSecundus", res: { provisions: 45, organics: 45 },
    blurb: "Мир удовольствий: курорт имперской знати, природная красота, искусство — и порой тёмная изнанка." },
  feudal:     { tithe: "solutioPrima", res: { organics: 40, provisions: 40, manpower: 40 },
    blurb: "Феодальный мир: средневековый уклад, королевства и сословия; губернатор правит с орбиты." },
  feral:      { tithe: "solutioSecundus", res: { organics: 40, manpower: 45 },
    blurb: "Дикий мир: племена с примитивными орудиями; отличный материал для рекрутов Адептус Астартес." },
  frontier:   { tithe: "solutioSecundus", res: { ore: 30, organics: 30 },
    blurb: "Пограничный мир: недавно открыт, немного колонистов; прибежище беглецов и сорвиголов." },
  research:   { tithe: "solutioSecundus", res: { organics: 25 },
    blurb: "Исследовательская станция: недавно ставший доступным мир в процессе изучения и обустройства." },
  penal:      { tithe: "decumaTertius", res: { ore: 60, manpower: 55 },
    blurb: "Штрафная колония: планета-тюрьма; население — ссыльные преступники, поставщик штрафных легионов." },
  warZone:    { tithe: "solutioTertius", res: { weapons: 40 },
    blurb: "Военная зона: опустошённый войной мир — выжженные города, расколотая твердь, поля костей." },
  quarantine: { tithe: "aptusNon", res: {},
    blurb: "Изолированный (карантинный) мир: контакт запрещён Инквизицией; за карантином — древние ужасы или зараза." }
};

// Среда мира по физическим чертам.
function genEnv(s) {
  if (!s) return "";
  if (s.atmospherePresence === "none") return "dead";
  if (s.climate === "ice") return "ice";
  if (s.habitability && s.habitability !== "inhospitable") {
    if (chance(0.08)) return "death";
    if ((s.climate === "hot" || s.climate === "temperate") && chance(0.4)) return "jungle";
    if (chance(0.25)) return "ocean";
    return "temperate";
  }
  if (s.climate === "burning" || s.climate === "hot") return "desert";
  if (s.climate === "cold") return chance(0.5) ? "ice" : "dead";
  return chance(0.5) ? "desert" : "dead";
}

const isLifeHab2 = (h) => h === "limitedEcosystem" || h === "verdant" || h === "liquidWater";
// Подбор класса имперского мира по фракции и чертам планеты.
function pickWorldClass(key, s) {
  if (key === "mechanicus") return pickW([["forge", 5], ["mining", 2], ["industrial", 2], ["quarry", 1]]);
  if (key === "astartes")   return pickW([["fortress", 5], ["feral", 2], ["knight", 1]]);
  const habitable = isLifeHab2(s.habitability);
  if (key === "rogueTrader") return habitable
    ? pickW([["civilised", 3], ["agri", 2], ["frontier", 3], ["pleasure", 1]])
    : pickW([["mining", 3], ["industrial", 2], ["frontier", 2], ["research", 1]]);
  // Империум
  if (habitable) return pickW([["civilised", 5], ["hive", 3], ["agri", 4], ["shrine", 2], ["cardinal", 1],
    ["pleasure", 1], ["knight", 1], ["feudal", 2], ["feral", 2], ["frontier", 2], ["cemetery", 1], ["fortress", 1]]);
  return pickW([["mining", 5], ["industrial", 3], ["quarry", 2], ["penal", 2], ["fortress", 2],
    ["research", 1], ["warZone", 1], ["forge", 1]]);
}
// Случайно сдвигает десятину на ±1 ступень.
function varyTithe(grade) {
  let i = TITHE_ORDER.indexOf(grade);
  if (i < 0) return grade;
  if (grade !== "aptusNon") i = Math.max(0, Math.min(TITHE_ORDER.length - 2, i + (d(3) - 2)));
  return TITHE_ORDER[i];
}
// Применяет класс мира к телу (заселённая имперская планета).
// forcedWc — принудительный класс (для «гарантированных миров» из генератора).
function applyWorldClass(p, key, forcedWc) {
  const wc = (forcedWc && WORLD_PROFILE[forcedWc]) ? forcedWc : pickWorldClass(key, p.system);
  const prof = WORLD_PROFILE[wc];
  p.system.worldClass = wc;
  if (!p.system.worldEnv) p.system.worldEnv = genEnv(p.system);
  p.system.tithe = varyTithe(prof.tithe);
  p.system.presence = WORLD_CLASSES[wc];
  const r = p.system.resources || (p.system.resources = emptyRes());
  for (const [k, v] of Object.entries(prof.res)) r[k] = Math.max(Number(r[k]) || 0, v);
  if (wc === "hive") r.provisions = 0;   // ульи импортируют еду
  // Заселённый мир: экосистему описываем без «не открыт / девственный».
  const s = p.system;
  const eco = (isLifeHab(s.habitability) || s.exotic)
    ? " " + generateEcosystem({ habitability: s.habitability, climate: s.climate, exotic: s.exotic, settled: true })
    : "";
  p.system.description = prof.blurb + eco;
}

// ── Улучшения колонии («Развитие колонии») ────────────────────────────────────
// Каждое улучшение даёт бонус к ресурсам СВЕРХ базовых. {n: имя, d: описание, r: бонусы, c: категория}.
// Категории улучшений (порядок = порядок групп в диалоге постройки).
const _IC = "systems/warhammer-dbc/assets/imp-cat/";
export const IMP_CATEGORIES = {
  raw:         { label: "Добывающие и аграрные", svg: _IC + "raw.svg",         tag: "Добыча" },   // шахты, скважины, фермы → сырьё/провизия
  manufactory: { label: "Мануфакторумы",         svg: _IC + "manufactory.svg", tag: "Завод" },    // заводы → продукция (оружие/техника/пласталь)
  infra:       { label: "Инфраструктура",        svg: _IC + "infra.svg",       tag: "Инфра" },    // космопорты, тракты, жильё → логистика, население
  military:    { label: "Военные",               svg: _IC + "military.svg",    tag: "Армия" },    // казармы, бастионы, арсеналы → рекруты/оружие
  faith:       { label: "Культовые",             svg: _IC + "faith.svg",       tag: "Культ" },     // соборы, святыни → вера/дисциплина
  research:    { label: "Исследовательские",     svg: _IC + "research.svg",    tag: "Наука" },    // лаборатории, архивы → техника/археотех
  decree:      { label: "Указы и распоряжения",  svg: _IC + "decree.svg",      tag: "Указ" },     // административные ордонансы Администратума
  arcane:      { label: "Тайные проекты",        svg: _IC + "arcane.svg",      tag: "Тайна" }       // ксенотех/еретех/археотех, скрытое
};
const IMP_CAT_ORDER = Object.keys(IMP_CATEGORIES);

// Общеимперские улучшения — доступны на любом мире Империума.
const IMP_COMMON = [
  // Инфраструктура (логистика/население — НЕ производит промышленных изделий)
  { n: "Орбитальный космопорт", d: "Расширенные доки и грузовые лифты ускоряют торговлю и переброску грузов.", r: { provisions: 10, manpower: 5 }, c: "infra" },
  { n: "Магистральные тракты", d: "Сеть дорог и монорельсов связывает провинции планеты.", r: { provisions: 10, manpower: 5 }, c: "infra" },
  { n: "Массовые жилые ярусы", d: "Новые хаб-блоки вмещают миллионы рабочих рук.", r: { manpower: 20 }, c: "infra" },
  { n: "Акведуки и опреснители", d: "Водоводы и станции очистки питают население и поля.", r: { provisions: 10, organics: 5 }, c: "infra" },
  // Добыча и агро
  { n: "Горные концессии", d: "Новые шахты и обогатительные фабрики.", r: { ore: 20, adamantium: 10 }, c: "raw" },
  { n: "Прометиевые скважины", d: "Буровые вышки качают горючее из недр.", r: { promethium: 15 }, c: "raw" },
  { n: "Агро-кооперативы", d: "Реформа сельского хозяйства повышает урожаи.", r: { provisions: 35, organics: 70 }, c: "raw" },
  // Мануфакторумы
  { n: "Гильдия мануфакторумов", d: "Кооперация заводов наращивает выпуск изделий.", r: { plasteel: 15, tech: 10 }, c: "manufactory" },
  { n: "Литейные комбинаты", d: "Домны и прокатные станы гонят пласталь потоком (с собственными рудниками).", r: { plasteel: 45, ore: 90 }, c: "manufactory" },
  { n: "Оружейные литейные", d: "Штампуют лаз-винтовки и снаряды для десятины.", r: { weapons: 15 }, c: "manufactory" },
  // Военные
  { n: "Призывные пункты", d: "Сеть казарм и вербовочных контор готовит рекрутов для Гвардии.", r: { manpower: 20, weapons: 5 }, c: "military" },
  { n: "Претория Арбитрес", d: "Усиление правопорядка стабилизирует производство.", r: { manpower: 10, weapons: 5 }, c: "military" },
  { n: "Гарнизон СПО", d: "Планетарная оборона: доты, батареи, ополчение.", r: { weapons: 10, manpower: 10 }, c: "military" },
  // Культовые
  { n: "Имперский собор", d: "Великий храм Культа крепит веру и дисциплину населения.", r: { manpower: 10 }, c: "faith" },
  { n: "Миссия Министорума", d: "Проповедники и схолы Экклезиархии наставляют паству.", r: { manpower: 10 }, c: "faith" },
  // Указы
  { n: "Указ о тыловом производстве", d: "Перевод мощностей на военный заказ Администратума.", r: { weapons: 15, plasteel: 10 }, c: "decree" },
  { n: "Указ о всеобщей мобилизации", d: "Тотальный призыв населения в тыл и на фронт.", r: { manpower: 25 }, c: "decree" },
  { n: "Десятинный ордонанс", d: "Ужесточение сбора провизии и материалов для десятины.", r: { provisions: 10, ore: 10 }, c: "decree" }
];
// Улучшения по классу мира.
const IMP_CLASS = {
  hive:       [{ n: "Новый шпиль улья", d: "Ещё один город-шпиль тянется к орбите, вмещая миллиарды.", r: { manpower: 30 }, c: "infra" }, { n: "Подулейные мануфактории", d: "Заводские ярусы в недрах улья куют оружие и технику.", r: { weapons: 15, tech: 10 }, c: "manufactory" }, { n: "Литейные ярусы", d: "Целые уровни улья отданы под домны и прокат пластали.", r: { plasteel: 50, ore: 100 }, c: "manufactory" }, { n: "Рециркуляторные ярусы", d: "Переработка отходов даёт пищевые брикеты корпва.", r: { provisions: 30, organics: 60 }, c: "raw" }, { n: "Улейные банды-вербовщики", d: "Из подулья гребут бесконечных рекрутов и штрафников.", r: { manpower: 20, weapons: 5 }, c: "military" }],
  forge:      [{ n: "Кузня-храм Омниссии", d: "Священный комплекс Механикус, полный цикл производства.", r: { tech: 25, plasteel: 15 }, c: "manufactory" }, { n: "Генаторий", d: "Плазменные реакторы питают заводы энергией.", r: { tech: 15, weapons: 10 }, c: "manufactory" }, { n: "Плавильные конвейеры", d: "Механикус льёт пласталь непрерывным потоком из орбитальной руды.", r: { plasteel: 55, ore: 110 }, c: "manufactory" }, { n: "Сборочная линия титанов", d: "Стапели Легио Титаникус для боевых машин.", r: { weapons: 20, tech: 15 }, c: "manufactory" }, { n: "Реликварий СШК", d: "Хранилище шаблонов Стандартного Шаблонного Конструкта.", r: { archeotech: 15, tech: 10 }, c: "research" }],
  agri:       [{ n: "Ирригационные каналы", d: "Сеть каналов орошает бесконечные поля.", r: { provisions: 45, organics: 90 }, c: "raw" }, { n: "Животноводческие континенты", d: "Стада гроксов на целых материках.", r: { provisions: 40, organics: 80 }, c: "raw" }, { n: "Океанические фермы", d: "Планктонные и рыбные плантации мирового океана.", r: { provisions: 50, organics: 100 }, c: "raw" }, { n: "Зернохранилища-ульи", d: "Гигантские силосы и биопроцессоры готовят провизию к вывозу.", r: { provisions: 30, organics: 60 }, c: "infra" }],
  mining:     [{ n: "Глубинные стволы", d: "Шахты уходят в мантию за богатой рудой.", r: { ore: 20, adamantium: 10 }, c: "raw" }, { n: "Орбитальный рудный лифт", d: "Космический лифт поднимает руду на орбиту.", r: { ore: 15 }, c: "infra" }, { n: "Криогазовая добыча", d: "Извлечение флогистона и прометия из ледяных пластов.", r: { phlogiston: 15, promethium: 10 }, c: "raw" }, { n: "Обогатительные комбинаты", d: "Обогащение руды и выплавка пластали прямо у шахт.", r: { plasteel: 45, ore: 90 }, c: "manufactory" }],
  quarry:     [{ n: "Карьеры чёрного камня", d: "Добыча редчайшего чёрного камня и археотеха.", r: { adamantium: 20, archeotech: 15 }, c: "raw" }, { n: "Глубинные буровые", d: "Скважины вскрывают адамантиевые жилы.", r: { adamantium: 15, ore: 10 }, c: "raw" }, { n: "Плавильни адамантия", d: "Обработка сверхтвёрдого металла в слитки.", r: { adamantium: 10, plasteel: 10 }, c: "manufactory" }],
  industrial: [{ n: "Тяжёлые мануфактории", d: "Конвейеры штампуют пласталь и узлы в промышленных объёмах.", r: { plasteel: 55, ore: 110 }, c: "manufactory" }, { n: "Перерабатывающие комбинаты", d: "Переплавка руды в пласталь целыми материками заводов.", r: { plasteel: 65, ore: 130 }, c: "manufactory" }, { n: "Химзаводы прометия", d: "Крекинг и синтез топлива и реагентов.", r: { promethium: 10, plasteel: 5 }, c: "manufactory" }],
  fortress:   [{ n: "Бастионные линии", d: "Кольца укреплений и орудийных капониров.", r: { weapons: 20, manpower: 15 }, c: "military" }, { n: "Учебные лагеря", d: "Полигоны готовят полки Астра Милитарум.", r: { manpower: 25 }, c: "military" }, { n: "Подземные арсеналы", d: "Скрытые бункеры с боезапасом и бронетехникой.", r: { weapons: 20, plasteel: 10 }, c: "military" }, { n: "Орбитальные оборонные лазеры", d: "Батареи «земля-космос» простреливают систему.", r: { weapons: 15 }, c: "military" }],
  knight:     [{ n: "Залы Рыцарей", d: "Родовые чертоги благородных пилотов-Рыцарей.", r: { weapons: 20, tech: 15 }, c: "military" }, { n: "Кузни благородных домов", d: "Ремонт и постройка боевых шагоходов.", r: { tech: 15, plasteel: 10 }, c: "manufactory" }, { n: "Сокольничьи угодья", d: "Феодальные владения кормят и растят вассалов.", r: { provisions: 10, manpower: 10 }, c: "raw" }],
  shrine:     [{ n: "Колоссальный собор", d: "Храм-исполин, куда стекаются паломники сектора.", r: { manpower: 15 }, c: "faith" }, { n: "Дороги паломников", d: "Тракты и приюты для нескончаемых процессий.", r: { provisions: 10, manpower: 10 }, c: "infra" }, { n: "Реликварий святого", d: "Хранилище мощей, источающих чудеса.", r: { archeotech: 10 }, c: "faith" }],
  cardinal:   [{ n: "Кафедральный комплекс", d: "Резиденция кардинала и центр Имперского Культа.", r: { manpower: 15 }, c: "faith" }, { n: "Святилище паломничества", d: "Крупный центр паломничества и подаяний.", r: { provisions: 10, manpower: 10 }, c: "faith" }, { n: "Схолы прогениум", d: "Приюты-школы воспитывают верных слуг Империума.", r: { manpower: 10 }, c: "faith" }],
  civilised:  [{ n: "Промышленный пояс", d: "Индустриальная зона городов-фабрик.", r: { plasteel: 15, tech: 10 }, c: "manufactory" }, { n: "Торговые биржи", d: "Финансовые дома и склады оживляют коммерцию.", r: { provisions: 10 }, c: "infra" }, { n: "Университарии", d: "Схолы и лектории готовят техножрецов и офицеров.", r: { tech: 15 }, c: "research" }, { n: "Медиакартели", d: "Пропаганда и вокс-сети сплачивают население.", r: { manpower: 10 }, c: "infra" }],
  penal:      [{ n: "Каторжные рудники", d: "Труд осуждённых даёт руду без счёта.", r: { ore: 20, manpower: 10 }, c: "raw" }, { n: "Штрафные легионы", d: "Формирование частей смертников из заключённых.", r: { manpower: 20, weapons: 10 }, c: "military" }, { n: "Трудовые блоки", d: "Мануфактории на принудительном труде: пласталь любой ценой.", r: { plasteel: 40, ore: 80 }, c: "manufactory" }],
  feudal:     [{ n: "Рыцарские ордена", d: "Верховая знать и её дружины идут на службу.", r: { manpower: 15, weapons: 5 }, c: "military" }, { n: "Гильдии ремесленников", d: "Цеха кузнецов и мастеров ручной работы.", r: { plasteel: 10, organics: 5 }, c: "manufactory" }, { n: "Пахотные вотчины", d: "Крестьянские наделы кормят королевства.", r: { provisions: 30, organics: 60 }, c: "raw" }],
  feral:      [{ n: "Охотничьи племена", d: "Дикие воины — отличный материал для рекрутов.", r: { manpower: 20, organics: 5 }, c: "military" }, { n: "Священные рощи отбора", d: "Обряды инициации выявляют сильнейших.", r: { manpower: 15 }, c: "faith" }, { n: "Звериные загоны", d: "Приручённые твари и охота дают пропитание.", r: { organics: 15, provisions: 5 }, c: "raw" }],
  pleasure:   [{ n: "Курортные шпили", d: "Роскошные комплексы для знати сектора.", r: { provisions: 15, organics: 10 }, c: "infra" }, { n: "Сады наслаждений", d: "Заповедные парки и оранжереи невиданной красоты.", r: { organics: 15 }, c: "raw" }, { n: "Дома искусств", d: "Меценатство и торговля предметами роскоши.", r: { provisions: 10 }, c: "infra" }],
  frontier:   [{ n: "Форт колонистов", d: "Частокол и блокгаузы защищают первопоселенцев.", r: { manpower: 10, weapons: 5 }, c: "military" }, { n: "Старательские заимки", d: "Дикая, необложенная добыча руды и топлива.", r: { ore: 15, promethium: 5 }, c: "raw" }, { n: "Фактория", d: "Торговый пост скупает добычу и снабжает поселенцев.", r: { provisions: 10 }, c: "infra" }],
  research:   [{ n: "Экспедиционные лагеря", d: "Полевые базы исследователей и картографов.", r: { tech: 10, organics: 5 }, c: "research" }, { n: "Ксеноархив", d: "Каталогизация находок и образцов.", r: { tech: 10, archeotech: 5 }, c: "research" }],
  warZone:    [{ n: "Полевые арсеналы", d: "Склады боепитания среди руин фронта.", r: { weapons: 15 }, c: "military" }, { n: "Сборные пункты", d: "Мобилизация уцелевших и раненых в новые части.", r: { manpower: 15 }, c: "military" }, { n: "Трофейные команды", d: "Сбор брошенной техники и металла с полей боёв.", r: { ore: 10, plasteel: 5 }, c: "raw" }]
};
// Фракционные улучшения (сверх общеимперских) — по владельцу мира.
const IMP_FACTION = {
  mechanicus: [
    { n: "Святилище Омниссии", d: "Храм Культа Механикус освящает машины и куёт технику.", r: { tech: 20, plasteel: 10 }, c: "manufactory" },
    { n: "Ряды сервиторов", d: "Лоботомированные слуги-машины пополняют рабочую силу.", r: { manpower: 20 }, c: "infra" },
    { n: "Раскопки археотеха", d: "Поиск утерянных СШК и реликтовых технологий.", r: { archeotech: 15, tech: 5 }, c: "research" },
    { n: "Когитаторный кластер", d: "Расчётные машины и датасмиты обрабатывают данные.", r: { tech: 15 }, c: "research" },
    { n: "Легио кибернетика", d: "Сборка боевых роботов и когитат-разумов.", r: { weapons: 15, tech: 10 }, c: "manufactory" }
  ],
  astartes: [
    { n: "Крепость-монастырь", d: "Твердыня Ордена Космодесанта: арсеналы, реликвии, флот.", r: { weapons: 20, manpower: 5 }, c: "military" },
    { n: "Неофитские полигоны", d: "Отбор и обучение будущих Астартес из аспирантов.", r: { manpower: 15 }, c: "military" },
    { n: "Апотекарион", d: "Джен-семя и хирургия куют новых воинов.", r: { manpower: 10 }, c: "research" },
    { n: "Реклюзиам", d: "Капелланы крепят веру и боевой дух Ордена.", r: { manpower: 5, weapons: 5 }, c: "faith" },
    { n: "Оружейные Ордена", d: "Реликтовое вооружение и доспехи под опекой техномаринов.", r: { weapons: 15, archeotech: 5 }, c: "manufactory" }
  ],
  rogueTrader: [
    { n: "Торговая фактория", d: "Караванный узел вольного торговца в глубоком космосе.", r: { provisions: 15 }, c: "infra" },
    { n: "Династические доки", d: "Частные верфи и ремонтные стапели.", r: { plasteel: 15, weapons: 5 }, c: "manufactory" },
    { n: "Наёмные хускарлы", d: "Личная армия и абордажники под флагом династии.", r: { manpower: 15, weapons: 10 }, c: "military" },
    { n: "Ксенос-контакты", d: "Рискованная торговля чуждыми диковинами.", r: { xenotech: 10, provisions: 5 }, c: "arcane" },
    { n: "Каперский патент", d: "Грамота Вольного Торговца узаконивает захват добычи.", r: { plasteel: 10, weapons: 5 }, c: "decree" }
  ],
  chaos: [
    { n: "Осквернённые кузни", d: "Тёмные механикумы куют оружие под шёпот варпа.", r: { weapons: 20, heretek: 10 }, c: "manufactory" },
    { n: "Капища Тёмных Богов", d: "Кровавые алтари собирают отступников и культистов.", r: { manpower: 20 }, c: "faith" },
    { n: "Ямы рабов", d: "Пленники и жертвы для трудов и ритуалов.", r: { manpower: 15, organics: 5 }, c: "arcane" },
    { n: "Варп-горнила", d: "Еретех-лаборатории оскверняют технологию.", r: { heretek: 15, tech: 5 }, c: "research" },
    { n: "Легионы отступников", d: "Формирование банд предателей и еретиков.", r: { manpower: 15, weapons: 10 }, c: "military" }
  ]
};
const IMP_HUMANS = [
  { n: "Племенные дружины", d: "Воинственные кланы поставляют бойцов.", r: { manpower: 20 }, c: "military" },
  { n: "Самопальные мастерские", d: "Кустарные, но многочисленные плавильни и прокат.", r: { plasteel: 30, ore: 60 }, c: "manufactory" },
  { n: "Свободные рудники", d: "Никем не обложенная добыча руды.", r: { ore: 15 }, c: "raw" },
  { n: "Прометиевые ямы", d: "Открытая добыча горючего кустарным способом.", r: { promethium: 10 }, c: "raw" },
  { n: "Космопорт анклава", d: "Связь с соседними мирами и торговля.", r: { provisions: 10, manpower: 5 }, c: "infra" },
  { n: "Локальные верфи", d: "Постройка собственного флота анклава.", r: { plasteel: 15, weapons: 10 }, c: "manufactory" },
  { n: "Аграрные общины", d: "Самодостаточное земледелие.", r: { provisions: 30, organics: 60 }, c: "raw" },
  { n: "Совет старейшин", d: "Зачатки государственности и порядка.", r: { manpower: 10, provisions: 5 }, c: "decree" },
  { n: "Народное ополчение", d: "Всеобщее вооружение общины для защиты.", r: { manpower: 15, weapons: 5 }, c: "military" }
];
const IMP_XENO = {
  ork:      [{ n: "Грибные плантации", d: "Споровые поля плодят орочью орду без счёта.", r: { manpower: 30, provisions: 10 }, c: "raw" }, { n: "Мастерские мекбоев", d: "Мекбои клепают пушки и багги из любого хлама.", r: { xenotech: 20, weapons: 15 }, c: "manufactory" }, { n: "Зога-арена", d: "Бои крепят боевой дух Вааагх!.", r: { manpower: 15 }, c: "military" }, { n: "Шахты громил", d: "Грубая, но обильная добыча металла.", r: { ore: 20 }, c: "raw" }, { n: "Идол Горка и Морка", d: "Исполинский тотем сплачивает орду в Вааагх!.", r: { manpower: 15, weapons: 5 }, c: "faith" }],
  necron:   [{ n: "Пробуждённый монолит", d: "Древняя машина возобновляет протоколы реанимации.", r: { xenotech: 30 }, c: "arcane" }, { n: "Канопический склеп", d: "Скарабеи восстанавливают воинов из праха.", r: { xenotech: 20 }, c: "arcane" }, { n: "Призмат-реактор", d: "Сбор живой энергии в системы гробницы.", r: { xenotech: 15, adamantium: 10 }, c: "research" }, { n: "Звёздная стела", d: "Геомантический контроль над миром.", r: { xenotech: 15 }, c: "arcane" }, { n: "Гробничные заводы", d: "Конструкторы куют некродермис и оружие.", r: { xenotech: 15, weapons: 10 }, c: "manufactory" }],
  aeldari:  [{ n: "Псайматрица духов-камней", d: "Кристальная сеть направляет жизнь мира.", r: { xenotech: 25 }, c: "arcane" }, { n: "Сады бесконечности", d: "Тонкая био-инженерия Азуриан.", r: { organics: 15, xenotech: 10 }, c: "raw" }, { n: "Паутинный портал", d: "Скрытый проход в Сеть.", r: { xenotech: 15 }, c: "arcane" }, { n: "Кузни костей", d: "Выращивание вритвайн-снаряжения и оружия.", r: { xenotech: 15, weapons: 10 }, c: "manufactory" }, { n: "Купола аспектов", d: "Храмы боевых аспектов готовят воинов.", r: { manpower: 10, weapons: 5 }, c: "military" }],
  drukhari: [{ n: "Гематрические шпили", d: "Сбор боли питает их технологии.", r: { xenotech: 20, weapons: 10 }, c: "arcane" }, { n: "Невольничьи загоны", d: "Добыча рабов для Коморры.", r: { manpower: 15 }, c: "arcane" }, { n: "Теневые верфи", d: "Постройка стремительных налётных судов.", r: { xenotech: 15, weapons: 10 }, c: "manufactory" }, { n: "Гемункул-лаборатории", d: "Плоть-механики создают чудовищ и снадобья.", r: { xenotech: 15, organics: 5 }, c: "research" }, { n: "Арены Комморры", d: "Кровавые бои поставляют бойцов и муку.", r: { manpower: 15, weapons: 5 }, c: "military" }],
  tau:      [{ n: "Производственный анклав", d: "Эффективные фабрики касты Земли.", r: { xenotech: 15, plasteel: 10 }, c: "manufactory" }, { n: "Гидропонные купола", d: "Снабжение касты Земли провизией.", r: { provisions: 30, organics: 60 }, c: "raw" }, { n: "Учебный лагерь касты Огня", d: "Подготовка воинов Тау и их боевых костюмов.", r: { manpower: 15, weapons: 10 }, c: "military" }, { n: "Порт касты Воздуха", d: "Космодром и торговые маршруты Империи Тау.", r: { provisions: 10, manpower: 5 }, c: "infra" }, { n: "Лаборатории Эфирных", d: "Исследования пульсарной технологии.", r: { xenotech: 15, tech: 5 }, c: "research" }],
  kroot:    [{ n: "Гнездовья стай", d: "Рост и адаптация боевых стай.", r: { manpower: 25, organics: 10 }, c: "raw" }, { n: "Шейперские святилища", d: "Управляемая эволюция Крут.", r: { xenotech: 10, manpower: 10 }, c: "research" }, { n: "Охотничьи угодья", d: "Дикие леса кормят и закаляют кроотов.", r: { organics: 15, provisions: 5 }, c: "raw" }, { n: "Наёмные когорты", d: "Стаи Крут продаются как наёмники.", r: { manpower: 15, weapons: 5 }, c: "military" }],
  stryxis:  [{ n: "Меновые свалки", d: "Сортировка трофеев на продажу.", r: { xenotech: 15, plasteel: 10 }, c: "arcane" }, { n: "Караван-рой", d: "Мобильные мастерские Стиксис.", r: { xenotech: 10 }, c: "manufactory" }, { n: "Загоны диковин", d: "Торговля рабами, тварями и артефактами.", r: { manpower: 10, organics: 5 }, c: "arcane" }],
  yuvath:   [{ n: "Тёмные верфи", d: "Постройка проклятых конструктов.", r: { xenotech: 20, heretek: 10 }, c: "manufactory" }, { n: "Узловой алтарь", d: "Связь конструкций с варпом.", r: { xenotech: 10, heretek: 10 }, c: "arcane" }, { n: "Пастыри пустоты", d: "Подчинение варп-тварей воле Ю'Ват.", r: { xenotech: 10, manpower: 5 }, c: "arcane" }],
  rakgol:   [{ n: "Кровавые гнездовья", d: "Ярусы, где плодятся озверевшие раколы.", r: { manpower: 20, organics: 5 }, c: "raw" }, { n: "Кибер-мясницкие", d: "Грубая имплантация оружия в плоть.", r: { weapons: 15, heretek: 5 }, c: "manufactory" }, { n: "Логова стай", d: "Дикие орды раколов рвутся в бой.", r: { manpower: 15, weapons: 5 }, c: "military" }],
  hrud:     [{ n: "Норные лабиринты", d: "Туннели мигрирующего роя Хруд.", r: { xenotech: 10, manpower: 10 }, c: "arcane" }, { n: "Энтропийные ямы", d: "Поле распада разрушает и добывает металл.", r: { ore: 15, xenotech: 5 }, c: "raw" }, { n: "Стойбища роя", d: "Многочисленный рой поставляет бойцов.", r: { manpower: 15 }, c: "military" }],
  slaugth:  [{ n: "Гнилостные ульи", d: "Мозго-черви разлагают жертв в биомассу.", r: { organics: 15, xenotech: 5 }, c: "raw" }, { n: "Плоть-лаборатории", d: "Отвратительные опыты над телами и разумом.", r: { xenotech: 15, heretek: 5 }, c: "research" }, { n: "Инфильтрат-кельи", d: "Сеть агентов в чужих телах и обществах.", r: { xenotech: 10 }, c: "arcane" }],
  enslaver: [{ n: "Варп-разрыв", d: "Пробой в имматериум множит поработителей.", r: { xenotech: 20, heretek: 10 }, c: "arcane" }, { n: "Псионические ульи", d: "Порабощённые псайкеры-марионетки.", r: { manpower: 15, xenotech: 5 }, c: "arcane" }],
  _generic: [{ n: "Ксено-цитадель", d: "Укреплённое ядро чуждого присутствия.", r: { xenotech: 20 }, c: "military" }, { n: "Чужие фермы", d: "Странное, но обильное хозяйство.", r: { organics: 15, manpower: 10 }, c: "raw" }, { n: "Неведомые мастерские", d: "Производство чуждых изделий.", r: { xenotech: 15 }, c: "manufactory" }, { n: "Ксено-святилище", d: "Капище неведомых культов сплачивает чужаков.", r: { manpower: 10 }, c: "faith" }]
};
// Улучшения станций/верфей/орбитальных объектов (по группе фракции).
const IMP_STATION = {
  imperial:   [{ n: "Причальные доки", d: "Расширенные стыковочные узлы и краны.", r: { provisions: 10 }, c: "infra" }, { n: "Орбитальная верфь", d: "Стапели для постройки и ремонта судов.", r: { plasteel: 15, weapons: 10 }, c: "manufactory" }, { n: "Оборонные платформы", d: "Кольцо орудийных и ракетных платформ.", r: { weapons: 15 }, c: "military" }, { n: "Грузовые трюмы", d: "Огромные склады под перевалку грузов.", r: { provisions: 10 }, c: "infra" }, { n: "Пустотные щиты", d: "Усиленная защита от обстрела и абордажа.", r: { manpower: 5, weapons: 5 }, c: "military" }, { n: "Астропатический ретранслятор", d: "Дальняя псионическая связь сектора.", r: { tech: 10 }, c: "research" }, { n: "Скрытый арсенал", d: "Замаскированный склад тяжёлого вооружения.", r: { weapons: 15 }, c: "military" }, { n: "Таможенный пост", d: "Контроль и пошлины с проходящих судов.", r: { provisions: 5, manpower: 5 }, c: "decree" }],
  mechanicus: [{ n: "Ремонтные доки", d: "Сервиторские бригады чинят корпуса и системы.", r: { tech: 15, plasteel: 10 }, c: "manufactory" }, { n: "Кузнечные ангары", d: "Орбитальное производство узлов и орудий.", r: { tech: 15, weapons: 10 }, c: "manufactory" }, { n: "Архивные когитаторы", d: "Хранилища данных и расчётные машины.", r: { tech: 10 }, c: "research" }, { n: "Тайные лаборатории", d: "Сокрытые исследования за семью печатями.", r: { tech: 15, archeotech: 10 }, c: "research" }],
  humans:     [{ n: "Торговые причалы", d: "Оживлённый перевалочный узел анклава.", r: { provisions: 10 }, c: "infra" }, { n: "Кустарная верфь", d: "Собирают и латают суда из чего придётся.", r: { plasteel: 10, weapons: 5 }, c: "manufactory" }, { n: "Контрабандные трюмы", d: "Скрытые отсеки для нелегального груза.", r: { provisions: 5, weapons: 5 }, c: "arcane" }],
  xeno:       [{ n: "Ксено-доки", d: "Причалы чуждой архитектуры.", r: { xenotech: 10 }, c: "infra" }, { n: "Чужие фабрикаторы", d: "Производство непостижимых изделий.", r: { xenotech: 15 }, c: "manufactory" }, { n: "Сокрытые причалы", d: "Замаскированные стоянки для рейдов.", r: { xenotech: 10 }, c: "arcane" }],
  pirate:     [{ n: "Орудийные палубы", d: "Сплошные ряды трофейных пушек.", r: { weapons: 15 }, c: "military" }, { n: "Трюмы добычи", d: "Тайники с награбленным.", r: { plasteel: 10, weapons: 5 }, c: "arcane" }, { n: "Сокрытые причалы", d: "Замаскированные стоянки рейдеров.", r: { manpower: 5, weapons: 5 }, c: "arcane" }, { n: "Невольничий рынок", d: "Торг захваченными пленниками.", r: { manpower: 10 }, c: "arcane" }]
};
// Видимость улучшений: «scout» — скрыто до разведки; «secret» — тайное (видно после раскрытия).
const IMP_SCOUT  = new Set(["Указ о тыловом производстве", "Пробуждённый монолит", "Псайматрица духов-камней",
  "Реликварий святого", "Совет старейшин", "Архивные когитаторы", "Астропатический ретранслятор", "Шейперские святилища",
  "Раскопки археотеха", "Реликварий СШК", "Апотекарион", "Ксенос-контакты", "Плоть-лаборатории", "Инфильтрат-кельи"]);
const IMP_SECRET = new Set(["Подземные арсеналы", "Реликварий СШК", "Канопический склеп", "Призмат-реактор",
  "Невольничьи загоны", "Теневые верфи", "Тёмные верфи", "Узловой алтарь", "Гематрические шпили",
  "Скрытый арсенал", "Тайные лаборатории", "Контрабандные трюмы", "Сокрытые причалы", "Трюмы добычи", "Паутинный портал",
  "Осквернённые кузни", "Капища Тёмных Богов", "Ямы рабов", "Варп-горнила", "Легионы отступников",
  "Варп-разрыв", "Псионические ульи", "Гемункул-лаборатории", "Невольничий рынок", "Гнилостные ульи", "Узловой алтарь"]);

function stationGroup(key) {
  return key === "xenos" ? "xeno" : key === "humans" ? "humans"
    : key === "mechanicus" ? "mechanicus" : ["pirates", "heretics"].includes(key) ? "pirate" : "imperial";
}
// Кол-во улучшений по масштабу объекта.
function colonyImpCount(o) {
  if (o.bodyType === "station" || o.bodyType === "derelict") return 1 + (chance(0.55) ? 1 : 0);
  const big = ["hive", "forge", "civilised", "industrial"].includes(o.worldClass);
  const mid = ["agri", "mining", "quarry", "fortress", "cardinal", "shrine", "knight", "penal"].includes(o.worldClass);
  let n = big ? 2 + (chance(0.7) ? 1 : 0) + (chance(0.4) ? 1 : 0)
        : mid ? 1 + (chance(0.7) ? 1 : 0) + (chance(0.3) ? 1 : 0)
              : 1 + (chance(0.5) ? 1 : 0);
  if (["vast", "gargantuan"].includes(o.size)) n += 1;
  return Math.max(1, n);
}
// Генерирует улучшения по типу мира / фракции / виду ксеносов / типу объекта.
// Пул доступных улучшений для тела (для ручного выбора при «постройке»).
export function improvementPool(o = {}) {
  const station = o.bodyType === "station" || o.bodyType === "derelict";
  if (station) return IMP_STATION[stationGroup(o.key)] || IMP_STATION.imperial;
  if (o.key === "xenos") return IMP_XENO[o.sp] || IMP_XENO._generic;
  if (o.key === "humans") return IMP_HUMANS;
  // Империум и родственные фракции: общее + класс мира + фракционные улучшения.
  const factionKey = ({ heretics: "chaos", chaos: "chaos", mechanicus: "mechanicus",
    astartes: "astartes", rogueTrader: "rogueTrader" })[o.key];
  return [...IMP_COMMON, ...(IMP_CLASS[o.worldClass] || []), ...(IMP_FACTION[factionKey] || [])];
}
// Готовый объект улучшения по записи пула {n,d,r,c}.
export function makeImprovement(p) {
  return { id: rid(), name: p.n, desc: p.d || "", res: { ...(p.r || {}) }, cat: p.c || "",
           hidden: IMP_SCOUT.has(p.n), secret: IMP_SECRET.has(p.n) };
}
export function genImprovements(o = {}) {
  const pool = improvementPool(o);
  const count = o.count || colonyImpCount(o);
  return sample(pool, Math.min(count, pool.length)).map(makeImprovement);
}

// Производственные цепочки: сырьё/полуфабрикат, потребляемый на 1 ед. продукции.
//   1 пласталь = 2 руды · 1 провизия = 2 органики · 1 оружие = 2 пластали · 1 техника = 3 пластали.
export const PRODUCTION_INPUTS = {
  plasteel:   { ore: 2 },
  provisions: { organics: 2 },
  weapons:    { plasteel: 2 },
  tech:       { plasteel: 3 }
};
// Рабочая сила масштабируется по выпуску ПРОДУКЦИИ (мануфактуры/фермы), не по сырью:
// добыча сырья ведётся самим населением, а переработка требует занятых рук.
const PRODUCT_KEYS = ["weapons", "tech", "plasteel", "provisions"];
// Эффективное ПРОИЗВОДСТВО улучшения (res с поправкой на категорию):
// военные улучшения (казармы/гарнизоны/бастионы) НЕ куют оружие — они его тратят
// на вооружение войск (см. improvementUpkeep). Оружие куют мануфакторумы.
export function improvementOutput(imp) {
  const res = { ...(imp?.res || {}) };
  if (imp?.cat === "military" && res.weapons) delete res.weapons;
  return res;
}
// Расход (upkeep) улучшения. Явно заданная ГМом стоимость (custom) — приоритетна.
// Иначе рассчитывается логично: сырьё на производство по цепочкам + рабочая сила
// по масштабу выпуска + (для военных) оружие на вооружение войск/укреплений.
export function improvementUpkeep(imp) {
  const out = {};
  const add = (k, v) => { const n = Math.ceil(v); if (n > 0) out[k] = (out[k] || 0) + n; };
  if (imp?.cost && Object.keys(imp.cost).length) {
    for (const [k, v] of Object.entries(imp.cost)) { const n = Number(v) || 0; if (n > 0) out[k] = n; }
    return out;
  }
  const res = imp?.res || {};
  const isMilitary = imp?.cat === "military";
  let productOut = 0;
  for (const [k, v0] of Object.entries(res)) {
    const v = Number(v0) || 0; if (v <= 0) continue;
    if (isMilitary && k === "weapons") continue;   // у военных оружие — не производство
    if (PRODUCT_KEYS.includes(k)) productOut += v;
    const inputs = PRODUCTION_INPUTS[k];
    if (inputs) for (const [ik, ratio] of Object.entries(inputs)) add(ik, v * ratio);   // сырьё на производство
  }
  // Военные: вооружение войск и укреплений — тратят оружие по масштабу
  // (численность войск + огневая мощь укреплений), а не производят его.
  if (isMilitary) {
    const scale = (Number(res.manpower) || 0) + (Number(res.weapons) || 0);
    add("weapons", scale * 0.5);
  }
  // Рабочая сила: улучшения, дающие население, её не потребляют; остальные —
  // по масштабу ПРОДУКЦИИ, но не меньше базового штата (даже чисто нарративные).
  if ((Number(res.manpower) || 0) <= 0) add("manpower", Math.max(4, productOut * 0.5));
  return out;
}
// НЕТТО-поток улучшения по ресурсам: производство минус СОБСТВЕННОЕ потребление
// (цепочки/рабочая сила/вооружение). Своё сырьё гасит свой же расход — чтобы не было
// «даёт пласталь +15 / тратит пласталь +30», а был честный нетто «тратит пласталь +15».
export function improvementFlow(imp) {
  const output = improvementOutput(imp);
  const up = improvementUpkeep(imp);
  const gives = {}, spends = {};
  for (const k of new Set([...Object.keys(output), ...Object.keys(up)])) {
    const flow = (Number(output[k]) || 0) - (Number(up[k]) || 0);
    if (flow > 0) gives[k] = flow;
    else if (flow < 0) spends[k] = -flow;
  }
  return { gives, spends };
}

// ── Генератор системы ────────────────────────────────────────────────────────
const d  = (n) => Math.floor(Math.random() * n) + 1;
const rd = (n, s) => { let t = 0; for (let i = 0; i < n; i++) t += d(s); return t; };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sample = (arr, n) => {
  const a = [...arr]; const out = [];
  while (n-- > 0 && a.length) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
  return out;
};
// Взвешенный выбор: weights = [[key, weight], ...]
const pickW = (weights) => {
  const tot = weights.reduce((s, w) => s + w[1], 0);
  let r = Math.random() * tot;
  for (const [k, w] of weights) { if ((r -= w) <= 0) return k; }
  return weights[0][0];
};
const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI"];

// Элементы по зонам (тип → вес).
const ZONE_GEN = {
  innerCauldron: { die: 4, min: 0, elements: [
    ["asteroidCluster", 3], ["asteroidField", 2], ["radiationField", 2],
    ["gasGiant", 2], ["planet", 3], ["dustCloud", 1], ["gravityRiptide", 1] ] },
  primaryBiosphere: { die: 3, min: 1, elements: [
    ["planet", 6], ["gasGiant", 2], ["asteroidBelt", 2], ["derelict", 1], ["station", 1] ] },
  // Аномалии здесь НЕ генерируются: они создаются только выделенным генератором
  // (respect настройки «Аномалии» и с полным описанием), см. generateSystem.
  outerReaches: { die: 5, min: 1, elements: [
    ["gasGiant", 4], ["planet", 3], ["asteroidField", 3], ["dustCloud", 3],
    ["derelict", 2], ["warpGate", 1] ] }
};

const CLIMATE_BY_ZONE = {
  innerCauldron:    [["burning", 4], ["hot", 3], ["temperate", 1]],
  primaryBiosphere: [["hot", 2], ["temperate", 5], ["cold", 2]],
  outerReaches:     [["cold", 4], ["ice", 4], ["temperate", 1]]
};

const chance = (p) => Math.random() < p;
const rid = () => foundry.utils.randomID();
const emptyRes = () => ({ ore: 0, promethium: 0, adamantium: 0, phlogiston: 0, organics: 0,
  plasteel: 0, weapons: 0, tech: 0, provisions: 0, manpower: 0, archeotech: 0, xenotech: 0, heretek: 0, notes: "" });

// Физические характеристики планеты/гиганта (без ресурсов).
// lifeFactor 0..1 — пригодность звезды для жизни (чёрная дыра ≈ 0).
function genPlanetTraits(zone, isGiant, lifeFactor = 1) {
  const t = {};
  t.bodySize = isGiant ? pickW([["vast", 3], ["gargantuan", 2]])
                       : pickW([["lowDensity", 1], ["small", 4], ["large", 3], ["vast", 1]]);
  t.gravity  = t.bodySize === "lowDensity" ? "low"
             : (t.bodySize === "vast" || t.bodySize === "gargantuan") ? pickW([["high", 3], ["normal", 1]])
             : pickW([["low", 1], ["normal", 4], ["high", 1]]);
  t.atmospherePresence = isGiant ? "heavy"
    : pickW([["none", 2], ["thin", 2], ["moderate", 3], ["heavy", 2]]);
  if (t.atmospherePresence !== "none") {
    t.atmosphereType = isGiant ? pickW([["deadly", 3], ["corrosive", 2], ["toxic", 2]])
      : pickW([["deadly", 1], ["corrosive", 2], ["toxic", 2], ["tainted", 3], ["pure", 3]]);
    t.climate = pickW(CLIMATE_BY_ZONE[zone] || CLIMATE_BY_ZONE.primaryBiosphere);
  }
  if (!isGiant && (t.atmosphereType === "pure" || t.atmosphereType === "tainted") && t.climate === "temperate")
    t.habitability = pickW([["liquidWater", 3], ["limitedEcosystem", 3], ["verdant", 2], ["trappedWater", 1]]);
  else if (!isGiant && t.atmospherePresence !== "none")
    t.habitability = pickW([["inhospitable", 5], ["trappedWater", 2], ["liquidWater", 1]]);
  else t.habitability = "inhospitable";
  // Враждебная жизни звезда (красный гигант, белый карлик, чёрная дыра…) глушит обитаемость.
  const lifeH = ["liquidWater", "limitedEcosystem", "verdant"];
  if (lifeH.includes(t.habitability) && Math.random() > lifeFactor)
    t.habitability = pickW([["inhospitable", 3], ["trappedWater", 2]]);
  // Жизнь — почти исключительно в Первичной Биосфере. Вне её — лишь редкая экзотика.
  const ecoH = ["limitedEcosystem", "verdant"];
  if (ecoH.includes(t.habitability) && zone !== "primaryBiosphere") {
    if (Math.random() < 0.10 * lifeFactor) t.exotic = true;   // экзотическая экосистема
    else t.habitability = pickW([["inhospitable", 4], ["trappedWater", 2], ["liquidWater", 1]]);
  }
  // Газовый гигант: редкая экзотика — живые газовые облака.
  if (isGiant && chance(0.05 * (lifeFactor + 0.3))) { t.habitability = "limitedEcosystem"; t.exotic = true; }
  return t;
}

// Ресурсы по типу тела + (опц.) заселённости pop {populated, key} + особенностям.
function genResources(type, traits, pop, features) {
  const r = emptyRes();
  const ab = (w) => pickW(w);
  const rocky = ["planet", "moon", "asteroidBelt", "asteroidField", "asteroidCluster"].includes(type);
  const habit = traits && traits.habitability && traits.habitability !== "inhospitable";
  if (rocky) {
    r.ore        = ab([[0, 2], [25, 3], [40, 3], [60, 2], [75, 1], [90, 1]]);   // руда — обычна
    r.adamantium = ab([[0, 30], [25, 2], [40, 1], [60, 1]]);                    // адамантий — СВЕРХРЕДКИЙ
    r.phlogiston = ab([[0, 34], [25, 1], [40, 1], [60, 1]]);                    // флогистон — СВЕРХРЕДКИЙ
    r.promethium = ab([[0, 8], [25, 2], [40, 1]]);                              // прометий на камне — нечаст
  }
  if (type === "gasGiant" || type === "dustCloud") {
    r.promethium = ab([[25, 2], [40, 3], [60, 3], [75, 2], [90, 1]]);           // прометий — обилен на гигантах
    r.phlogiston = ab([[0, 20], [25, 2], [40, 1]]);                             // флогистон — редок даже здесь
  }
  // Органика (биомасса) — ТОЛЬКО на мирах с реальной жизнью (экосистема/экзотика), и много.
  const lifeWorld = traits && (isLifeHab(traits.habitability) || traits.exotic);
  r.organics = lifeWorld ? ab([[40, 2], [60, 3], [75, 3], [90, 2]]) : 0;
  if (type === "derelict") r.archeotech = ab([[0, 3], [25, 3], [40, 2], [60, 1]]);
  if (features && features.has && features.has("ruinedEmpire"))
    r.archeotech = Math.max(r.archeotech, ab([[25, 2], [40, 2], [60, 1]]));
  // Заселённость: мануфактура и спец-ресурсы.
  if (pop && pop.populated) {
    const xeno = pop.key === "xenos";
    // Людской ресурс (рекруты/население) — есть у всех заселённых миров.
    r.manpower = habit ? ab([[25, 2], [40, 3], [60, 3], [75, 2]]) : ab([[0, 3], [25, 3], [40, 1]]);
    if (xeno) {
      // Ксено-миры производят СВОЁ — ксенотех, а не имперскую технику/оружие/пласталь.
      r.xenotech = Math.max(r.xenotech, ab([[40, 2], [60, 3], [75, 2], [90, 1]]));
    } else {
      r.plasteel   = ab([[0, 2], [25, 3], [40, 3], [60, 2]]);
      r.tech       = ab([[0, 2], [25, 3], [40, 2], [60, 1]]);
      r.weapons    = ab([[0, 3], [25, 3], [40, 2]]);
      r.provisions = habit ? ab([[25, 2], [40, 3], [60, 2]]) : ab([[0, 4], [25, 2]]);
      if (pop.key === "mechanicus") { r.tech = Math.max(r.tech, 60); r.plasteel = Math.max(r.plasteel, 40); r.archeotech = Math.max(r.archeotech, ab([[25, 2], [40, 1]])); }
      if (pop.key === "heretics")   r.heretek  = Math.max(r.heretek, ab([[25, 2], [40, 2], [60, 1]]));
      if (pop.key === "pirates")    r.weapons  = Math.max(r.weapons, ab([[25, 2], [40, 2]]));
    }
  }
  return r;
}

const ALLEG_ENUM = { imperium: "imperial", mechanicus: "mechanicus", astartes: "astartes", rogueTrader: "rogueTrader", humans: "humans", xenos: "xenos", pirates: "unknown", heretics: "chaos" };
const GOV_LABEL  = { imperium: "Имперское правление", mechanicus: "Адептус Механикус", astartes: "Орден Адептус Астартес", rogueTrader: "Владение Вольного Торговца", humans: "Независимое человечество", xenos: "Ксеносы", pirates: "Пиратская вольница", heretics: "Культ Хаоса" };
const STATION_KIND = { imperium: "орбитальная станция", mechanicus: "кузня-станция", astartes: "звёздная крепость", rogueTrader: "торговый порт", humans: "орбитальная станция", xenos: "ксено-конструкт", pirates: "пиратское логово", heretics: "осквернённая станция" };

// ── Тип присутствия по фракции (с учётом логики: у части ксеносов колоний нет) ──
// Фракции, способные основывать постоянные колонии/базы.
const COLONIZERS = new Set(["imperium", "mechanicus", "astartes", "rogueTrader", "humans", "heretics", "tau", "ork", "necron", "kroot", "yuvath"]);
// Присутствие на поверхности планеты.
const SURFACE_PRESENCE = {
  imperium:   ["колония", "улей-город", "аграрный мир", "крепость-монастырь", "имперский гарнизон", "шахтёрское поселение", "космопорт", "миссия Экклезиархии"],
  mechanicus: ["кузнечный мир", "разведывательный форпост", "экспедиция магосов", "раскопки археотеха", "генаторная станция"],
  astartes:   ["крепость-монастырь", "цитадель Ордена", "оплот Астартес", "тренировочный мир", "вербовочный мир", "убежище Ордена"],
  humans:     ["племена дикарей", "вождество", "феодальное королевство", "город-государство", "техно-варвары", "независимая колония", "промышленный анклав", "локальная космо-империя"],
  rogueTrader:["торговая фактория", "частная колония", "перевалочная база", "космопорт", "охотничье угодье"],
  pirates:    ["пиратское логово", "схрон добычи", "разбойничий лагерь", "укреплённое убежище"],
  heretics:   ["культовый оплот", "осквернённое святилище", "рабские ямы", "еретический гарнизон", "капище"],
  ork:        ["лагерь орков", "логово", "Зога", "грабь-дыра", "орочья крепость"],
  tau:        ["колония Тау", "сеп-анклав", "форпост касты Огня", "дипломатическая миссия"],
  necron:     ["гробница-комплекс", "спящая усыпальница", "монолитный двор", "некроновый бастион"],
  kroot:      ["кочевье Крут", "гнездовье", "охотничья стоянка"],
  yuvath:     ["проклятый лабиринт", "узел Ю'Ват", "логово в тенях"],
  // Не-колонисты: только временные опорные точки.
  aeldari:    ["скрытое святилище", "мир-врата", "руины-маяк", "сторожевая башня"],
  drukhari:   ["налётный плацдарм", "портал-проход", "скрытый порт", "ловчая застава"],
  stryxis:    ["стоянка каравана", "торговая свалка", "временный лагерь"],
  _xeno:      ["ксено-поселение", "гнездо", "логово", "становище"]
};
// Присутствие на орбите (станции).
const ORBIT_PRESENCE = {
  imperium:   ["орбитальная станция", "звёздный форт", "док-станция", "сторожевая платформа", "орбитальная верфь", "транзитный шпиль"],
  mechanicus: ["кузня-станция", "орбитальная мануфактория", "ковчег исследований", "орбитальная верфь"],
  astartes:   ["звёздная крепость", "орбитальная цитадель", "сторожевая крепость Ордена", "док-крепость"],
  humans:     ["орбитальная станция", "корабль-ковчег", "торговый пост", "верфь анклава"],
  rogueTrader:["торговый порт", "причальный шпиль", "перевалочная станция", "частная верфь"],
  pirates:    ["пиратское логово", "укреплённый астероид", "схрон в пустоте"],
  heretics:   ["осквернённая станция", "капище в пустоте", "якорь варпа"],
  ork:        ["орочья космо-крепость", "роккета-док", "Зога на орбите"],
  tau:        ["орбитальная станция Тау", "причальное кольцо"],
  necron:     ["орбитальный монолит", "сторожевой спутник-гробница"],
  kroot:      ["варп-корабль Крут (стоянка)"],
  yuvath:     ["конструкт Ю'Ват", "узел в пустоте"],
  aeldari:    ["паутинный портал", "страж-буй", "фрагмент мир-корабля"],
  drukhari:   ["налётный порт", "портал в Коморру", "засадный док"],
  stryxis:    ["корабельный рой Стиксис", "торговая свалка"],
  _xeno:      ["ксено-конструкт", "ксено-станция"]
};
// Возвращает {key, sp}: ключ таблицы присутствия по фракции/виду.
function presKey(key, sp) {
  if (key !== "xenos") return key;
  return SURFACE_PRESENCE[sp] ? sp : "_xeno";
}
function genPresence(key, sp, isStation) {
  const tbl = isStation ? ORBIT_PRESENCE : SURFACE_PRESENCE;
  return pick(tbl[presKey(key, sp)] || tbl._xeno);
}
function canColonize(key, sp) {
  if (key !== "xenos") return COLONIZERS.has(key);
  return COLONIZERS.has(sp);
}

// ── Система обороны (только для ГМа) ───────────────────────────────────────────
const DEF_STRENGTH = [["Незначительная", 4], ["Умеренная", 5], ["Сильная", 3], ["Грозная", 2], ["Несокрушимая", 1]];
const DEF_WEAPONS = {
  imperial:   ["батареи СПО", "макро-пушки ×{n}", "лэнс-турели ×{n}", "ракетные капониры", "пустотные щиты", "орбитальные мины"],
  mechanicus: ["плазма-батареи ×{n}", "лэнс-турели ×{n}", "пустотные щиты", "роботы-стражи", "автоматические капониры ×{n}"],
  astartes:   ["орудия звёздной крепости ×{n}", "лэнс-батареи ×{n}", "пустотные щиты Ордена", "орбитальные бомбардировочные платформы", "макро-батареи цитадели ×{n}"],
  rogueTrader:["наёмные турели ×{n}", "макро-батареи ×{n}", "пустотный щит", "минные поля"],
  humans:     ["турели поселения ×{n}", "зенитные орудия ×{n}", "самодельные батареи", "СПО колонии", "примитивные укрепления"],
  chaos:      ["осквернённые батареи ×{n}", "демон-пушки", "варп-турели ×{n}", "пушки скверны", "поля порчи"],
  xenos:      ["ксено-турели ×{n}", "энергобатареи ×{n}", "гравитационные орудия", "неизвестные эмиттеры"],
  unknown:    ["разнородные орудия ×{n}", "трофейные турели ×{n}", "самодельные пушки"]
};
const DEF_GARRISON = {
  imperial:   ["рота СПО (~{n})", "взвод Гвардии (~{n})", "отделение Скитариев", "сервиторы-стражи", "арбитры (~{n})"],
  mechanicus: ["когорта Скитариев (~{n})", "боевые сервиторы", "кастелаксы-роботы", "техножрецы-стражи (~{n})"],
  astartes:   ["{n} боевых отделений Космодесанта", "боевая рота Ордена (~100)", "ветераны и терминаторы", "дредноуты Ордена", "неофиты и сервиторы (~{n}0)"],
  rogueTrader:["наёмники (~{n})", "корабельная гвардия (~{n})", "хаускарлы дома"],
  humans:     ["ополчение (~{n})", "местная дружина (~{n})", "воины племени (~{n})", "колониальная гвардия (~{n})"],
  chaos:      ["культисты (~{n})", "отступники (~{n})", "Астартес Хаоса (отделение)", "одержимые"],
  xenos:      ["ксено-воины (~{n})", "рой (~{n})", "конструкты-стражи", "охотники (~{n})"],
  unknown:    ["разношёрстная банда (~{n})", "наёмный сброд (~{n})"]
};
const DEF_PATROLS = {
  imperial:   ["{n} патрульных эскортника", "{n} системных монитора", "сторожевые катера"],
  mechanicus: ["{n} исследовательских судна", "вооружённый ковчег", "патрульные сервиторы-дроны"],
  astartes:   ["{n} ударных крейсера Ордена", "звено «Громовых ястребов»", "барджа Ордена"],
  rogueTrader:["{n} вооружённых транспорта", "эскортный фрегат"],
  humans:     ["{n} лёгких корабля", "сторожевые катера", "переоборудованные транспорты"],
  chaos:      ["{n} налётных рейдера", "осквернённый эскорт"],
  xenos:      ["{n} ксено-судна", "звено перехватчиков", "рой малых кораблей"],
  unknown:    ["{n} пиратских судна разного класса", "стая катеров"]
};
function defFaction(key) {
  if (key === "imperium") return "imperial";
  if (key === "mechanicus") return "mechanicus";
  if (key === "astartes") return "astartes";
  if (key === "rogueTrader") return "rogueTrader";
  if (key === "humans") return "humans";
  if (key === "heretics") return "chaos";
  if (key === "xenos") return "xenos";
  return "unknown";
}
// Генерирует блок обороны (масштаб зависит от размера присутствия).
function genDefense(key, scale) {
  const fac = defFaction(key);
  const strength = fac === "astartes" ? pickW([["Сильная", 2], ["Грозная", 3], ["Несокрушимая", 2]]) : pickW(DEF_STRENGTH);
  const tier = ["Незначительная", "Умеренная", "Сильная", "Грозная", "Несокрушимая"].indexOf(strength);
  const base = (scale || 1) * (tier + 1);
  const num = (lo, hi) => Math.max(1, Math.round((lo + Math.random() * (hi - lo)) * (0.6 + base * 0.25)));
  const fill = (s) => s.replace("{n}", num(2, 6));
  const fillT = (s) => s.replace("{n}", num(40, 400) * 5);
  const wp = sample(DEF_WEAPONS[fac], 1 + (tier >= 2 ? 1 : 0)).map(fill).join(", ");
  const gar = fac === "astartes" ? fill(pick(DEF_GARRISON[fac])) : fillT(pick(DEF_GARRISON[fac]));
  const pat = tier >= 1 && chance(0.7) ? fill(pick(DEF_PATROLS[fac])) : "—";
  return { weapons: wp, garrison: gar, patrols: pat, strength, notes: "" };
}

// Добавляет колонии и станции по выбранной заселённости (комбинируется).
function addPopulation(bodies, primaries, starId, inhKeys, xenosSpecies, features, useNames, avoid, dynasty, forcedClasses) {
  const colonizable = primaries.filter(p => p.system.bodyType === "planet");
  const habitable   = colonizable.filter(p => p.system.habitability && p.system.habitability !== "inhospitable");
  const pool = habitable.length ? habitable : colonizable;
  const claimed = new Set();   // чтобы разные фракции не перезаписывали одну и ту же планету
  const forcedQ = Array.isArray(forcedClasses) ? forcedClasses.filter(c => WORLD_PROFILE[c]) : []; // очередь гарантированных классов
  const IMP_BRANCH = ["imperium", "mechanicus", "astartes", "rogueTrader"];

  for (const key of inhKeys) {
    const allegiance = ALLEG_ENUM[key] || "unknown";
    const sp = key === "xenos" ? xenosSpecies : "";
    const speciesLabel = key === "xenos" ? (XENOS_SPECIES[sp] || "ксеносы")
      : key === "astartes" ? "Адептус Астартес"
      : key === "mechanicus" ? "Адептус Механикус"
      : key === "humans" ? "люди (независимые)"
      : "люди";
    const colonizes = canColonize(key, sp);
    const nameFor = (kind) => !useNames ? null
      : sp ? genUnique(avoid, { species: sp })
      : key === "heretics" ? genUnique(avoid, { kind: "chaos" })
      : genUnique(avoid, { kind });
    // Колонии: надёжно заселяем 1–3 подходящие планеты (по фракции).
    const available = pool.filter(p => !claimed.has(p));
    let nCol = key === "astartes" ? 1
      : ["humans", "pirates", "heretics"].includes(key) ? 1 + (chance(0.4) ? 1 : 0)
      : 1 + (chance(0.6) ? 1 : 0) + (chance(0.35) ? 1 : 0);
    nCol = Math.min(nCol, available.length);
    for (const p of sample(available, nCol)) {
      claimed.add(p);
      p.system.allegiance = allegiance;
      p.system.government = GOV_LABEL[key];
      p.system.presence = genPresence(key, sp, false);
      if (sp) p.system.xenosSpecies = sp;
      const nm = nameFor("planet"); if (nm) p.name = nm;
      // Колонисты — крупное население; Астартес — малочисленный Орден; не-колонисты — опорная точка.
      const size = key === "astartes" ? pick(["боевая рота", "гарнизон крепости", "капитул Ордена", "Орден (рассредоточен)"])
                 : key === "humans" ? pick(["племя", "вождество", "сотни тысяч", "миллионы", "города-государства", "локальная империя"])
                 : colonizes ? pick(["колония", "сотни тысяч", "миллионы", "миллиарды", "улей-город"])
                             : pick(["небольшой отряд", "форпост", "налётчики", "горстка"]);
      p.system.population = { species: speciesLabel, size, notes: "" };
      if (key === "rogueTrader" && dynasty) p.system.dynasty = dynasty;
      p.system.resources = genResources(p.system.bodyType, p.system, { populated: colonizes, key }, features);
      p.system.defense = genDefense(key, colonizes ? 2 : 1);
      // Имперская классификация мира + десятина (только для имперских ветвей).
      // Гарантированные классы миров расходуются в первую очередь.
      if (IMP_BRANCH.includes(key))
        applyWorldClass(p, key, forcedQ.length ? forcedQ.shift() : null);
      // Улучшения колонии (по типу мира / расе / масштабу).
      if (["imperium", "mechanicus", "astartes", "rogueTrader", "humans", "xenos"].includes(key))
        p.system.improvements = genImprovements({ worldClass: p.system.worldClass, key, sp, size: p.system.bodySize, bodyType: "planet" });
    }
    // Станции / орбитальные опорные точки (1-2).
    const n = 1 + (chance(0.4) ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const parent = pool.length && chance(0.6) ? pick(pool) : null;
      const stType = key === "pirates" && chance(0.5) ? "derelict" : "station";
      const system = {
        bodyType: stType, zone: parent ? parent.system.zone : "primaryBiosphere",
        parentId: parent ? parent._id : starId, allegiance, government: GOV_LABEL[key],
        stationType: STATION_KIND[key] || "станция",
        presence: genPresence(key, sp, true),
        population: { species: speciesLabel, size: "", notes: "" },
        resources: genResources(stType, null, { populated: true, key }, features),
        defense: genDefense(key, 1)
      };
      if (sp) system.xenosSpecies = sp;
      if (key === "rogueTrader" && dynasty) system.dynasty = dynasty;
      system.improvements = genImprovements({ key, sp, bodyType: stType });
      const stName = nameFor("station") || `${INHABITANTS[key]} станция`;
      bodies.push({ _id: rid(), type: "celestialBody", name: stName, system });
    }
  }

  // Гарантированные классы миров, не покрытые обычным заселением → досоздаём
  // имперские колонии на свободных планетах.
  while (forcedQ.length) {
    const wc = forcedQ.shift();
    const p = pool.find(x => !claimed.has(x));
    if (!p) break;   // свободных планет не осталось
    claimed.add(p);
    const key = "imperium";
    p.system.allegiance = ALLEG_ENUM[key];
    p.system.government = GOV_LABEL[key];
    p.system.presence = genPresence(key, "", false);
    const nm = useNames ? genUnique(avoid, { kind: "planet" }) : null; if (nm) p.name = nm;
    p.system.population = { species: "люди", size: pick(["колония", "сотни тысяч", "миллионы", "миллиарды", "улей-город"]), notes: "" };
    p.system.resources = genResources(p.system.bodyType, p.system, { populated: true, key }, features);
    p.system.defense = genDefense(key, 2);
    applyWorldClass(p, key, wc);
    p.system.improvements = genImprovements({ worldClass: p.system.worldClass, key, bodyType: "planet" });
  }
}

// ── Заселить тело фракцией (ГМ-действие) → объект обновления для item.update ──
// forcedWc — принудительный класс мира (для имперских ветвей; иначе подбирается).
export function colonizeUpdate(key, sp, sys, forcedWc) {
  sys = sys || {};
  const bodyType = sys.bodyType || "planet";
  const isStation = bodyType === "station" || bodyType === "derelict";
  const allegiance = ALLEG_ENUM[key] || "unknown";
  const colonizes = canColonize(key, sp);
  const speciesLabel = key === "xenos" ? (XENOS_SPECIES[sp] || "ксеносы")
    : key === "astartes" ? "Адептус Астартес"
    : key === "mechanicus" ? "Адептус Механикус"
    : "люди";
  const size = key === "astartes" ? pick(["боевая рота", "гарнизон крепости", "капитул Ордена"])
    : isStation ? pick(["гарнизон", "персонал", "экипаж"])
    : colonizes ? pick(["колония", "сотни тысяч", "миллионы", "миллиарды", "улей-город"])
    : pick(["небольшой отряд", "форпост", "налётчики", "горстка"]);
  const up = {
    "system.allegiance": allegiance,
    "system.government": GOV_LABEL[key] || "",
    "system.presence": genPresence(key, sp, isStation),
    "system.xenosSpecies": key === "xenos" ? sp : "",
    "system.population.species": speciesLabel,
    "system.population.size": size,
    "system.defense": genDefense(key, isStation ? 1 : (colonizes ? 2 : 1))
  };
  // Имперская классификация мира + десятина для планет имперских ветвей.
  if (["imperium", "mechanicus", "astartes", "rogueTrader"].includes(key) && bodyType === "planet") {
    const wc = (forcedWc && WORLD_PROFILE[forcedWc]) ? forcedWc : pickWorldClass(key, sys);
    const prof = WORLD_PROFILE[wc];
    up["system.worldClass"] = wc;
    up["system.tithe"] = varyTithe(prof.tithe);
    up["system.presence"] = WORLD_CLASSES[wc];
    if (!sys.worldEnv) up["system.worldEnv"] = genEnv(sys);
    const r = { ...emptyRes(), ...(sys.resources || {}) };
    for (const [k, v] of Object.entries(prof.res)) r[k] = Math.max(Number(r[k]) || 0, v);
    if (wc === "hive") r.provisions = 0;
    up["system.resources"] = r;
    up["system.description"] = prof.blurb;
  }
  // Улучшения при ручном заселении НЕ добавляем автоматически — только при
  // генерации системы (addPopulation) или вручную через «Построить улучшение».
  return up;
}

// ── Уничтожить цивилизацию (ГМ-действие) → руины, либо null если нечего рушить ──
export function ruinUpdate(s) {
  s = s || {};
  const hadPresence = !!(s.presence || (s.population && s.population.species && s.population.species !== "нет" && s.population.species !== "")
    || (s.allegiance && !["", "unknown", "abandoned"].includes(s.allegiance)));
  if (!hadPresence) return null;
  const scaleStr = `${s.population?.size || ""} ${s.presence || ""}`;
  const big = /город|миллион|миллиард|улей|колони|анклав|крепост|гарнизон|кузн|мир/i.test(scaleStr);
  const isStation = s.bodyType === "station" || s.bodyType === "derelict";
  const prev = s.presence || "цивилизации";
  const ruinPresence = isStation ? "обломки станции"
    : big ? `руины: ${prev}`
    : pick(["развалины", "заброшенный лагерь", "остовы построек"]);
  const species = s.population?.species ? `${s.population.species} (погибшие)` : "вымершие";
  const up = {
    "system.allegiance": "abandoned",
    "system.government": "Руины",
    "system.presence": ruinPresence,
    "system.population.species": species,
    "system.population.size": big ? "руины" : "развалины",
    "system.defense": { weapons: "", garrison: "", patrols: "", strength: "разрушена", notes: "оборона уничтожена" },
    "system.gmNotes": `${s.gmNotes ? s.gmNotes + "\n\n" : ""}[Уничтожено] Цивилизация стёрта; на её месте остались ${isStation ? "дрейфующие обломки" : "руины"}.`
  };
  if (isStation) up["system.bodyType"] = "derelict";
  if (big) up["system.resources.archeotech"] = Math.max(Number(s.resources?.archeotech) || 0, pickW([[25, 2], [40, 2], [60, 1]]));
  return up;
}

// ── Генератор аномалий (литературный ГМ-текст; для игроков — «Неопознанный сигнал») ──
const ANOM_CAT = {
  warp:       { label: "Варп",          icon: "✺" },
  xeno:       { label: "Ксено",         icon: "👽" },
  archeotech: { label: "Археотех",      icon: "⚙" },
  physical:   { label: "Физическая",    icon: "☄" },
  temporal:   { label: "Темпоральная",  icon: "⏳" },
  daemonic:   { label: "Демоническая",  icon: "🜏" }
};
// Что видят сенсоры/экипаж издалека — атмосферно и неоднозначно (не раскрывает сути).
const ANOM_PUBLIC = [
  "Авгуры захлёбываются помехами. Что-то здесь искажает свет далёких звёзд, сворачивая его в тусклую линзу, и приборы наотрез отказываются давать чёткую картинку.",
  "Пустота вокруг неестественно тиха. Ни астропатических шёпотов, ни фоновых сигнатур — лишь ровная, давящая чернота, от которой у вахтенных сводит зубы.",
  "Слабый ритмичный импульс пробивается сквозь шум — слишком правильный, чтобы быть природным, и слишком чуждый, чтобы быть имперским.",
  "Сенсоры рисуют контур, которого мгновением позже уже нет. Объект то проступает на голо-картах, то растворяется, будто решает, существовать ему или нет.",
  "Гравитационные приливы дёргают корабль за корпус, словно невидимая рука. Навигатор бледнеет и просит увести судно подальше.",
  "Тёмное пятно жадно глотает свет прожекторов и лучи авгуров. Дальномеры показывают то ноль, то бесконечность.",
  "В эфире — обрывки чужой не-музыки и привкус озона на языке. Сервиторы замирают и поворачивают головы в одну сторону.",
  "Звёзды за этим участком будто смазаны и сдвинуты, словно смотришь сквозь толщу воды. Геометрия пространства здесь явно неправильная.",
  "Раз за разом авгуры ловят один и тот же отражённый сигнал — собственный, но пришедший на несколько часов раньше, чем был отправлен.",
  "Холод стоит даже в прогретых отсеках, лампы тускнеют, а молитвенные свитки сами собой шелестят, будто от сквозняка, которого нет."
];
const ANOM_THREAT = ["корабли пропадают здесь без следа", "экипаж видит общие сны", "фоновый шёпот варпа",
  "приборы откровенно лгут", "манящий чуждый сигнал", "необъяснимый страх среди команды",
  "немотивированные сбои реакторов", "странные эхо-сигналы из пустоты", "счёт времени сбивается у всех"];
// Истинная природа — для ГМа, развёрнутой прозой. Всё логически и лорно обосновано.
const ANOM_TRUTH = {
  warp: [
    "Завеса здесь истёрта почти до прозрачности. Имматериум сочится в реальность медленным, маслянистым приливом; всякий, кто задержится дольше нескольких часов, начинает слышать голоса тех, кого давно похоронил. Ещё немного — и разрыв станет постоянным.",
    "Это застывший варп-шторм, пойманный в материальной вселенной, как муха в янтаре. Внутри него корабли стареют за минуты — или не стареют вовсе, — а экипажи возвращаются, если возвращаются, уже не вполне собой.",
    "Здесь умер псайкер невообразимой силы, и его последняя мысль так и не угасла. Эхо предсмертной агонии давит на разум каждого одарённого в системе и медленно сводит с ума остальных.",
    "Невидимый маяк в варпе зовёт. Он терпелив и ласков, он обещает покой — и что-то огромное, голодное уже плывёт на его свет из глубин Имматериума.",
    "Корабль-призрак Флота, пропавший тысячелетие назад, снова и снова выныривает из варпа в одной и той же точке — и всякий раз на мостике тот же экипаж, и всё так же беззвучно кричит.",
    "Точка Мандевиля здесь «больная»: каждый выход из варпа выбрасывает суда с разницей в годы, и в системе уже толкутся эскадры из разных десятилетий, не понимающие, как разминулись во времени."
  ],
  xeno: [
    "Под коркой астероидной породы дремлет некроновый монолит. Его системы отсчитывают последние тысячелетия до пробуждения, и каждый громкий двигатель, каждая орудийная вспышка приближают этот час.",
    "Это улей-зонд генокрадов, дрейфующий по воле течений. Внутри в холодном сне ждут своего часа выводки, которым довольно одного заражённого, чтобы превратить целый мир в кошмар.",
    "Конструкт чужой расы, чьё назначение не разгадать. Он гудит на частотах, от которых плавятся импланты, и тянется к проходящим кораблям тонкими полями, словно пробуя их на вкус.",
    "Законсервированный мир-семя Азуриан: спящий сад, ждущий хозяев, что не вернутся. Его незримые стражи всё ещё бдят, и чужаков они не прощают.",
    "Это ловчая сеть Друкхари — паутина сенсоров и порталов, терпеливо ждущая, когда добыча заберётся достаточно глубоко, чтобы капкан захлопнулся.",
    "Вокруг крошечной чёрной дыры выстроена исполинская ксено-конструкция из колец и шпилей: древние удержали сингулярность в узде и, похоже, черпали из неё энергию. Механизм всё ещё работает — но створки колец еле заметно расходятся год за годом.",
    "Орбитальное кольцо чужой работы опоясывает мёртвую луну; внутри — бесконечные залы, чьи стены покрыты картами звёзд, которых больше нет на небе."
  ],
  archeotech: [
    "В сердце объекта спит искусственный интеллект Тёмной Эры Технологий — разум, объявленный анафемой ещё до рождения Империума. Он наблюдает. И он скучал.",
    "Это фабрикатор-верфь додинастической эпохи, способная строить корабли из голого камня и света. За такой приз Механикус сожжёт половину сектора — и любого, кто доберётся первым.",
    "Хранилище СШК-шаблонов, потерянных тысячи лет назад. Целое состояние и смертный приговор одновременно: за обладание ими развяжут войну.",
    "Древний терраформирующий двигатель, всё ещё тёплый. Он способен превратить мёртвый камень в рай — или в пепел, если запустить его неверной рукой.",
    "Это рукотворная «клетка» вокруг чёрной дыры — додинастическая мегаструктура, гасящая её гравитацию полями немыслимой мощи. Кто-то очень не хотел, чтобы здешняя сингулярность поглотила систему. Или, напротив, копил её голод про запас.",
    "Спящий строй колоний-ковчегов Тёмной Эры дрейфует в идеальном порядке; в криокапсулах — миллионы предков, не ведающих, что Империум давно поделил их небо."
  ],
  physical: [
    "Обломок нейтронной звезды чертит по системе невидимую борозду убийственной гравитации. Всё, что подходит слишком близко, растягивается в нить и исчезает.",
    "Тесная пара «нейтронная звезда — белый карлик» сошлась в смертельном танце, и их пляска рвёт пространство приливами; любой варп-прыжок поблизости превращается в рулетку.",
    "Облако антиматерии мерцает призрачным светом. Одно неосторожное касание пылинки о корпус — и от эскадры останется лишь вспышка.",
    "Магнетар хлещет систему волнами жёсткого излучения. Электроника слепнет, реакторы сбоят, а незащищённая плоть выгорает изнутри.",
    "Молодой протопланетный диск ещё кипит столкновениями: камни летят роем, и каждый час пути здесь — игра со смертью.",
    "Выгоревшая сверхновая оставила расширяющуюся оболочку раскалённого газа и пульсар в центре, что метёт систему лучами, как маяк-убийца."
  ],
  temporal: [
    "Здесь время свернулось в петлю. Сенсоры снова и снова ловят эхо давнего сражения — корабли, что сгорели века назад, опять идут в свою последнюю атаку.",
    "Карман замедленного времени: снаружи проходят годы, внутри — мгновения. Те, кто вошёл сюда в поисках убежища, всё ещё живы и всё ещё ждут спасения, что опоздало на столетия.",
    "Зона, где годы спрессованы в часы. Корпуса ржавеют на глазах, провизия гниёт, а люди седеют за одну вахту.",
    "Сжатый пузырь времени окружает древний обломок: подойдёшь близко — и вернёшься, когда твои близкие уже состарились и забыли тебя."
  ],
  daemonic: [
    "Это врата, и они дышат. За тонкой плёнкой реальности что-то ворочается во сне, и каждое богохульство, каждая пролитая капля крови будит его чуть сильнее.",
    "Дрейфующий мир, одержимый целиком. Его континенты сложились в исполинский лик, что улыбается проходящим кораблям и шепчет каждому его сокровенное имя.",
    "Алтарь Тёмных Богов, парящий в пустоте. Он питается страхом, и чем сильнее ужас входящих, тем ярче разгорается его багровое сияние.",
    "Здесь, за семью печатями, томится принц-демон. Печати стары и слабеют, а имя его так и просится, чтобы его произнесли вслух.",
    "Обломок чернокаменной крепости, заряженный положительной эмпирейной полярностью: он притягивает варп, как магнит — железо, и медленно сводит округу с ума. В нужных руках это оружие, способное провести через себя саму мощь Хаоса."
  ]
};

export function generateAnomaly(o = {}) {
  const avoid = o.avoid || new Set();
  const cat = o.category && ANOM_CAT[o.category] ? o.category : pickW([["warp", 3], ["xeno", 3], ["archeotech", 3], ["physical", 3], ["temporal", 2], ["daemonic", 2]]);
  const useNames = o.useNames !== false;
  const truth = pick(ANOM_TRUTH[cat]);
  let desc = pick(ANOM_PUBLIC);
  if (chance(0.4)) { let d2 = pick(ANOM_PUBLIC); if (d2 !== desc) desc += " " + d2; }
  const name = useNames ? genUnique(avoid, { kind: "anomaly" }) : "Неопознанный сигнал";
  return {
    _id: rid(), type: "celestialBody",
    name,
    system: {
      bodyType: "anomaly", zone: o.zone || "outerReaches", parentId: o.parentId || "",
      allegiance: "unknown", signal: true,
      threat: pick(ANOM_THREAT),
      description: desc,
      gmNotes: `[Аномалия · ${ANOM_CAT[cat].label}]\n${truth}`,
      resources: cat === "archeotech" ? { ...emptyRes(), archeotech: pickW([[40, 2], [60, 3], [75, 2], [90, 1]]) } : emptyRes()
    }
  };
}

// ── Генератор случайных встреч (нейтральная внешность + развёрнутый ГМ-подвох) ──
const ENC = [
  { face: "Дрейфующий корпус корабля", icon: "⚙", type: "derelict",
    desc: [
      "В пустоте дрейфует мёртвый корабль — тёмный силуэт без единого огня, медленно вращающийся вокруг своей оси.",
      "Корпус судна качается в пустоте, исполосованный пробоинами и коркой инея. Ни сигналов, ни движения — лишь тишина."],
    truths: [
      "Внутри пусто и тихо — но в трюмах нетронутым лежит ценный груз, словно команда вышла на минуту и не вернулась.",
      "В холодных отсеках затаились генокрады в спячке. Им довольно одного тёплого гостя, чтобы пробудиться.",
      "Это приманка Друкхари. Стоны «выживших» в эфире — запись; настоящие хозяева ждут в тенях соседних обломков.",
      "Команда мертва до последнего, но бортовой журнал цел — и в нём координаты тайника, ради которого стоит рискнуть.",
      "Реактор давно сорвало с предохранителей. Он держится на честном слове и рванёт от первого же резкого манёвра рядом.",
      "В недрах корабля прячется беглый псайкер, обезумевший от голода и одиночества, и его сила всё ещё смертельно опасна.",
      "Корпус цел, экипажа нет, а корабельный разум сошёл с ума и считает гостей частью команды, которую нельзя выпускать наружу."] },
  { face: "Поле обломков после боя", icon: "✦", type: "asteroidField",
    desc: [
      "Пространство усеяно искорёженным металлом — кладбище кораблей, ещё хранящее тепло недавнего боя.",
      "Поле обломков тянется на тысячи километров: рваные корпуса, застывшие облака замёрзшего воздуха и тел."],
    truths: [
      "Среди обломков мигает аварийный маяк — целая спас-капсула с живым человеком внутри, и время на исходе.",
      "Отступавшие заминировали поле. Каждый крупный обломок может оказаться последним, к которому пришвартуется корабль.",
      "Обломки имперские и чужие вперемешку — здесь недавно сошлись в смертельной схватке, и победитель может вернуться.",
      "В одном из развороченных корпусов уцелел археотех-модуль, стоящий больше иного крейсера.",
      "По полю уже ползают мусорщики-Стиксис, и они не любят делиться добычей с конкурентами.",
      "Среди искорёженного металла дрейфуют мёртвые Астартес в разбитой керамите — и кто-то очень захочет узнать, кто их убил."] },
  { face: "Сигнал бедствия", icon: "◎", type: "other",
    desc: [
      "Из пустоты пробивается слабый сигнал бедствия — повторяющийся код Имперского флота, искажённый помехами.",
      "В эфире звучит голос, молящий о помощи. Он срывается, повторяется и снова срывается."],
    truths: [
      "На том конце — настоящие выжившие. Их воздух на исходе, и каждый час промедления стоит жизней.",
      "Сигнал — наживка. Пираты выставили его, чтобы выманить добрых самаритян под перекрёстный огонь.",
      "Это зацикленная запись. Тот, кто звал на помощь, мёртв уже не одно десятилетие.",
      "Голос принадлежит культистам, что охотятся на сострадание, заманивая спасателей в свои сети.",
      "Сигнал — проверка. Невидимые наблюдатели-ксеносы смотрят, как чужаки откликнутся на чужую беду."] },
  { face: "Неизвестное судно на сближении", icon: "▲", type: "station",
    desc: [
      "На перехват ложится незнакомый корабль. Транспондер молчит, орудийные порты задраены — пока.",
      "Из тени планеты выходит судно неизвестной принадлежности и ложится на сходящийся курс."],
    truths: [
      "Это вольный торговец, и капитан скорее заинтересован в выгодной сделке, чем в драке.",
      "Под чужим транспондером скрывается пиратский рейдер, уже наводящий орудия.",
      "Это разведчик Тау, изучающий регион. Он осторожен, но его «дипломатия» имеет цену.",
      "Корабль принадлежит Инквизиции, идущей под прикрытием, и излишнее любопытство к нему может стоить дорого.",
      "Это судно-госпиталь, забитое беженцами, бегущими от чего-то куда худшего, чем встреча в пустоте.",
      "В трюмах контрабандисты везут ксенотех и очень не хотят, чтобы их досматривали."] },
  { face: "Покинутая станция", icon: "⌖", type: "station",
    desc: [
      "В пустоте висит станция без единого огня — мёртвая громада металла, медленно теряющая орбиту.",
      "Орбитальная станция молчит. Доки распахнуты, шлюзы темны, и ничто не отвечает на запросы."],
    truths: [
      "Станция в полной консервации и исправна — будто хозяева вышли вчера и вот-вот вернутся.",
      "Её захватил культ, угнездившийся в нижних палубах, и он рад новым «прихожанам».",
      "В арсеналах станции дремлет склад оружия, способный вооружить небольшую армию.",
      "Автоматика исправно мигает огнями, но людей здесь не было уже много лет.",
      "Это станция-обманка, под завязку начинённая взрывчаткой и ждущая любопытных."] },
  { face: "Одинокий астероид с сигнатурой", icon: "▪", type: "asteroidCluster",
    desc: [
      "Одинокий астероид фонит странной сигнатурой — слишком насыщенной для простого камня.",
      "Среди безжизненных глыб один камень отзывается на авгуры металлическим блеском и тёплым следом."],
    truths: [
      "В породе залегает богатейшая жила адамантия — целое состояние для того, кто застолбит её первым.",
      "Астероид полый: внутри — замаскированный наблюдательный пост, и его хозяева уже заметили гостей.",
      "В каменном чреве покоится древний саркофаг, и металл его не похож ни на что из имперских хранилищ.",
      "В пустотах астероида свила гнездо стая пустотных тварей, и тепло двигателей для них — как звон обеденного колокола.",
      "Здесь пираты устроили схрон. Добыча на месте — вместе с ловушками для незваных гостей."] },
  { face: "Паломнический караван", icon: "◎", type: "other",
    desc: [
      "Вереница потрёпанных кораблей бредёт сквозь пустоту, ощетинившись иконами и молитвенными вымпелами.",
      "Нестройный караван судов тянется к далёкому миру-храму, распевая литании на всех каналах."],
    truths: [
      "Это и впрямь паломники — измотанные, голодные и готовые щедро отблагодарить за помощь и припасы.",
      "Под рясами скрываются работорговцы, везущие «паству» на продажу.",
      "В трюмах зреет чумной культ, и каждый корабль каравана — рассадник заразы.",
      "Караван бежит от чего-то: за ними по пятам идёт то, о чём они боятся говорить вслух."] },
  { face: "Брошенный рудничный комплекс", icon: "⚒", type: "station",
    desc: [
      "На безжизненной луне темнеют вышки и купола заброшенного рудника, давно оставленного людьми.",
      "Сенсоры находят остывшие плавильни и горы пустой породы — добыча здесь замерла десятилетия назад."],
    truths: [
      "Жила не выработана: рудник бросили в спешке, и богатства всё ещё ждут под землёй.",
      "Шахтёры не ушли — они спустились слишком глубоко и разбудили то, что там спало.",
      "Комплекс цел и пригоден: достаточно завезти рабочих, чтобы он снова заработал.",
      "Под куполами обосновались беглецы и дезертиры, не желающие, чтобы их нашли."] },
  { face: "Тихоходный корабль-ковчег", icon: "▲", type: "station",
    desc: [
      "Исполинский корабль ползёт через систему на досветовой тяге — реликт эпохи до варп-двигателей.",
      "Циклопическое судно идёт сквозь пустоту так медленно, что кажется неподвижным; его обводы древнее Империума."],
    truths: [
      "В криотрюмах спят колонисты Тёмной Эры, не ведающие, что человечество давно обрело варп и Императора.",
      "Ковчег ведёт одичавшее за столетия общество, забывшее, что они вообще куда-то летят.",
      "Корабль пуст, но его архивы хранят утраченные знания, бесценные для Механикус.",
      "На борту тихо угнездились ксеносы, превратив спящих людей в скот."] }
];
const ENC_TWIST = ["Поблизости зреет варп-шторм, и окно для манёвра стремительно закрывается.",
  "На сенсорах — ещё одна сигнатура: кто-то идёт следом.", "Времени почти не осталось.",
  "Всё это слишком похоже на западню.", "За кораблём явно наблюдают чужие глаза."];
export function generateEncounter(o = {}) {
  const avoid = o.avoid || new Set();
  const useNames = o.useNames !== false;
  const e = o.kind != null && ENC[o.kind] ? ENC[o.kind] : pick(ENC);
  const truth = pick(e.truths);
  const twist = chance(0.4) ? ` ${pick(ENC_TWIST)}` : "";
  const name = useNames ? genUnique(avoid, { kind: e.type === "asteroidField" || e.type === "asteroidCluster" ? "asteroid" : "station" }) : "Неопознанный сигнал";
  return {
    _id: rid(), type: "celestialBody",
    name,
    system: {
      bodyType: e.type, zone: o.zone || "primaryBiosphere", parentId: o.parentId || "",
      allegiance: "unknown", signal: true,
      threat: e.face,
      description: pick(e.desc),
      gmNotes: `[Встреча · ${e.face}]\n${truth}${twist}`,
      resources: emptyRes()
    }
  };
}

// ── Генератор описаний экосистем (для планет с жизнью) ────────────────────────
const ECO_BIOME = {
  burning: [
    "Раскалённый мир, где жизнь ютится в глубоких тенистых каньонах и подземных водоносных слоях.",
    "Поверхность плавится под яростным светилом, но в сумеречном поясе у терминатора тянется полоса упрямой зелени.",
    "Кипящие солевые моря и обсидиановые равнины; всё живое прячется от полуденного жара под коркой и в трещинах."],
  hot: [
    "Душные экваториальные джунгли тянутся от моря до моря, исходя паром под ярким светилом.",
    "Тёплые мелкие моря и бесконечные мангровые топи кишат жизнью на каждом уровне.",
    "Саванны и красноземные плато, иссечённые сезонными ливнями, что за ночь покрывают мир цветами."],
  temperate: [
    "Мягкий мир чередующихся лесов, лугов и спокойных морей — почти как сады Святой Терры из легенд.",
    "Умеренные континенты с полноводными реками, дубравами и плодородными долинами.",
    "Архипелаги тёплых островов среди ласковых морей, где суша и вода сплелись в единую живую мозаику."],
  cold: [
    "Бескрайняя тайга и продуваемые ветрами тундры, где жизнь экономна, но упорна.",
    "Хвойные леса спускаются к холодным фьордам; короткое лето взрывается яростным цветением.",
    "Каменистые степи под низким солнцем, поросшие жёстким лишайником и стадами мохнатых исполинов."],
  ice: [
    "Ледяной панцирь сковал поверхность, но в тёплых океанах подо льдом кипит скрытая жизнь.",
    "Мир вечной зимы: гейзеры пробивают лёд, и вокруг них теснятся оазисы причудливых организмов.",
    "Сплошные снега и торосы, где экосистема ушла под лёд, к чёрным курильщикам на дне."]
};
const ECO_LIFE = [
  "Сушу попирают стада гигантских травоядных, а небо рассекают перепончатые хищники.",
  "Доминируют рои насекомоподобных созданий, строящих курганы выше имперских ульев.",
  "На вершине пищевой цепи — стайные хищники, чья координация пугающе осмысленна.",
  "Здесь обитают разумные земноводные племена, ещё не вышедшие из каменного века.",
  "Колонии грибов размером с города оплели целые континенты единой сетью.",
  "Псевдорастительные хищники подстерегают добычу, прикинувшись безобидной флорой.",
  "Океаны полнятся колоссальными левиафанами, чьи песни слышны за полмира.",
  "Мелкая, но невероятно плодовитая фауна заполнила каждую нишу до отказа.",
  "Бронированные звери-исполины бродят по равнинам, не зная естественных врагов.",
  "Колонии разумных полипов в мелководьях строят рифы-города причудливой формы.",
  "Перелётные тучи крылатых тварей затмевают солнце в брачный сезон.",
  "Кочующие травяные «ковры» сами медленно ползут вслед за дождями.",
  "Гнёзда роющих хищников превратили целые материки в лабиринты нор.",
  "Симбиоз растений и насекомых тут достиг почти разумной слаженности."];
const ECO_PECULIAR = [
  "По ночам вся растительность мерцает мягкой биолюминесценцией.",
  "Биосфера связана единой грибницей-разумом, реагирующей на чужаков.",
  "Сезоны тянутся десятилетиями, и жизнь приспособилась засыпать на годы.",
  "Местная биохимия токсична для человека без долгой адаптации.",
  "Экосистема агрессивна: сама планета будто отторгает пришельцев.",
  "Удивительно мирный и щедрый мир, словно созданный для жизни.",
  "Атмосфера густа от спор, и всякая рана здесь зарастает за часы — или гниёт за минуты.",
  "Магнитные бури окрашивают небо, а животные мигрируют по силовым линиям планеты.",
  "Сутки длятся считанные часы, и жизнь здесь бешено тороплива.",
  "Высокая гравитация выковала приземистых, несокрушимо крепких тварей.",
  "Местная флора выделяет лёгкий галлюциноген — старожилы давно привыкли.",
  "Раз в поколение планета вспыхивает буйным цветением, видимым с орбиты.",
  "Вода здесь несёт целебные минералы, ценимые далеко за пределами мира."];
const ECO_VALUE = [
  "Идеальный кандидат для колонии-житницы, если удержать его от ксеносов.",
  "Потребует серьёзной адаптации, но награда стоит трудов.",
  "Смертельно опасен для неподготовленных, и всё же манит исследователей.",
  "Под пышной зеленью скрыты руины давно вымершей цивилизации.",
  "Девственный мир, ещё не нанесённый ни на одну имперскую карту.",
  "Богатые угодья — но кто-то уже присматривает за ними из тени.",
  "В реках поблёскивают самородки — слух о них однажды приведёт сюда орду старателей.",
  "Слишком ценный, чтобы оставаться ничьим: вопрос лишь, кто доберётся первым."];
// Описания для УЖЕ заселённых миров (без «не открыт / девственный»).
const ECO_VALUE_SETTLED = [
  "Колонисты давно приспособились к местной природе и живут с ней в хрупком ладу.",
  "Поселения жмутся к самым безопасным уголкам биосферы.",
  "Дикая жизнь и люди делят этот мир в напряжённом равновесии.",
  "Местная флора и фауна идут и в пищу, и в дело.",
  "Биосфера кормит население — и порой пожирает неосторожных.",
  "Города выросли там, где природа оказалась милостивее всего."];
const ECO_EXOTIC = [
  "В верхних слоях атмосферы газового гиганта дрейфуют живые облака — исполинские студенистые организмы, питающиеся молниями.",
  "У самой звезды, на раскалённом камне, процветают литоиды: кремниевые формы жизни, для которых жар — это пища.",
  "В радиационных поясах роятся плазмоиды — узоры чистой энергии, что ведут себя пугающе осмысленно.",
  "Подо льдом, в полной тьме, хемосинтетические колонии вьются вокруг вулканических трещин на дне океана.",
  "Кристаллические рощи растут в вечной мерзлоте, медленно «поют» в радиодиапазоне и тянутся к теплу кораблей.",
  "В безвоздушной пустоте на поверхности дрейфующего тела расселились вакуумные лишайники, питающиеся звёздным светом.",
  "Газовые «медузы» парят в вечных бурях гиганта, неторопливо пожирая друг друга.",
  "Металлоядные микробы покрыли скалы живой ржавчиной, что медленно ползёт к теплу.",
  "В жерлах действующих вулканов гнездятся твари, для которых лава — родная стихия.",
  "Аммиачные моря луны кишат прозрачными созданиями, светящимися в темноте."];
// Генерирует литературное описание экосистемы по чертам планеты.
// o.settled — мир уже заселён (тогда без «девственный/не на карте»).
export function generateEcosystem(t = {}) {
  const value = t.settled ? pick(ECO_VALUE_SETTLED) : pick(ECO_VALUE);
  if (t.exotic) return `${pick(ECO_EXOTIC)} ${pick(ECO_PECULIAR)} ${value}`;
  const biome = pick(ECO_BIOME[t.climate] || ECO_BIOME.temperate);
  const rich = t.habitability === "verdant" ? "Биосфера буйная и многоярусная. " : "";
  return `${rich}${biome} ${pick(ECO_LIFE)} ${pick(ECO_PECULIAR)} ${value}`;
}

const isLifeHab = (h) => h === "limitedEcosystem" || h === "verdant";
// Принудительно делает тело обитаемым (тонкая настройка генератора).
function makeLife(sys, type) {
  if (!sys.atmospherePresence || sys.atmospherePresence === "none") sys.atmospherePresence = "moderate";
  sys.atmosphereType = "pure";
  sys.climate = sys.climate && sys.climate !== "burning" && sys.climate !== "ice" ? sys.climate : "temperate";
  if (type === "exotic") { sys.exotic = true; sys.habitability = "limitedEcosystem"; }
  else if (type === "verdant") { sys.exotic = false; sys.habitability = "verdant"; }
  else { sys.exotic = chance(0.2); sys.habitability = sys.exotic ? "limitedEcosystem" : pickW([["limitedEcosystem", 2], ["verdant", 2], ["liquidWater", 1]]); }
  sys.description = generateEcosystem({ habitability: sys.habitability, climate: sys.climate, exotic: sys.exotic });
}

// Делает первую букву заглавной (для ГМ-текста).
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/**
 * Генерирует звёздную систему.
 * @param {object} o { inhabitants:[], xenosSpecies, features:[], density, useNames, avoid:Set,
 *                      stars, starClass, life, lifeType, anomalies, encounters }
 * @returns {{baseName, config, starNote, features, bodies}} bodies — celestialBody с _id/parentId.
 */
export function generateSystem(o = {}) {
  const inhabitants = o.inhabitants || [];
  const xenosSpecies = o.xenosSpecies || "ork";
  const density = o.density || "normal";
  const useNames = o.useNames !== false;
  const avoid = o.avoid || new Set();
  const uncharted = inhabitants.includes("uncharted");
  const inh = inhabitants.filter(k => k && k !== "uninhabited" && k !== "uncharted");
  const uninhabited = inhabitants.includes("uninhabited") || inh.length === 0;
  const densMul = density === "sparse" ? 0.6 : density === "rich" ? 1.6 : 1;
  const forcedClass = o.starClass && STAR_LIFE[o.starClass] != null ? o.starClass : null;

  const features = new Set(o.features || []);
  for (const f of sample(Object.keys(SYSTEM_FEATURES), Math.max(0, d(5) - 3))) features.add(f);
  if (inh.includes("pirates"))    features.add("pirateDen");
  if (inh.includes("heretics"))   { features.add("illOmened"); if (chance(0.5)) features.add("warpTurbulence"); }
  if ((inh.includes("imperium") || inh.includes("mechanicus")) && chance(0.5)) features.add("haven");

  const baseName = useNames ? genUnique(avoid, { kind: "base" }) : "Система";

  // Звёзды и компоновка (1-3, конфигурация кратности).
  const bodies = [];
  const starCount = Number(o.stars) > 0 ? Math.min(3, Number(o.stars)) : pickW([[1, 70], [2, 22], [3, 8]]);
  const layout = starLayout(starCount);
  const stars = [];
  for (let s = 0; s < starCount; s++) {
    const sc = (s === 0 && forcedClass) ? forcedClass : pickStar();
    const grp = Math.max(0, layout.groups.findIndex(g => g.includes(s)));
    const sName = !useNames ? `Звезда ${s + 1} (${STAR_CLASSES[sc]})`
      : starCount === 1 ? baseName : `${baseName}-${s + 1}`;
    const _id = rid();
    bodies.push({ _id, type: "celestialBody", name: sName,
      system: { bodyType: "star", starClass: sc, parentId: "", starGroup: grp,
        orbitalFeatures: s === 0 ? layout.note : "" } });
    stars.push({ id: _id, life: STAR_LIFE[sc] ?? 1 });
  }
  const primaryId = stars[0].id;
  const hosts = layout.hosts.map(([si, w]) => ({ id: stars[si].id, life: stars[si].life, w }));

  const counter = {};
  const fallbackName = (type) => { counter[type] = (counter[type] || 0) + 1; return `${BODY_TYPES[type].label} ${toRoman(counter[type])}`; };
  const kindFor = (t) => t === "anomaly" ? "anomaly"
    : (t === "planet" || t === "gasGiant") ? "planet"
    : (t === "station" || t === "derelict") ? "station"
    : ["asteroidBelt", "asteroidField", "asteroidCluster", "dustCloud", "radiationField", "gravityRiptide", "warpGate"].includes(t) ? "asteroid" : "system";
  let seq = 0;
  const nameBody = (type) => {
    seq++;
    if (uncharted) return `${baseName} ${toRoman(seq)}`;
    return useNames ? genUnique(avoid, { kind: kindFor(type) }) : fallbackName(type);
  };
  const setEco = (sysObj, traits) => {
    if (traits && (isLifeHab(traits.habitability) || traits.exotic)) {
      sysObj.exotic = !!traits.exotic;
      sysObj.description = generateEcosystem(traits);
    }
  };

  // Тела по зонам — для каждой звезды-хозяина (вес масштабирует число планет).
  const primaries = [];
  for (const host of hosts) {
    for (const [zoneKey, cfg] of Object.entries(ZONE_GEN)) {
      let count = Math.round((cfg.min + d(cfg.die) - 1) * densMul * host.w);
      count = host.w >= 1 ? Math.max(cfg.min, count) : Math.max(0, count);
      for (let i = 0; i < count; i++) {
        const type = pickW(cfg.elements);
        let traits = null;
        const system = { bodyType: type, zone: zoneKey, parentId: host.id };
        if (type === "planet" || type === "gasGiant") { traits = genPlanetTraits(zoneKey, type === "gasGiant", host.life); Object.assign(system, traits); setEco(system, traits); }
        if (type === "planet") system.worldEnv = genEnv(system);
        if (type === "derelict") system.allegiance = "abandoned";
        system.resources = genResources(type, traits, null, features);
        const body = { _id: rid(), type: "celestialBody", name: nameBody(type), system };
        body._life = host.life;
        bodies.push(body);
        if (type === "planet" || type === "gasGiant") primaries.push(body);
      }
    }
  }

  // Луны вокруг части планет/гигантов.
  for (const p of primaries) {
    const moons = p.system.bodyType === "gasGiant" ? Math.max(0, d(4) - 1) : Math.max(0, d(4) - 3);
    for (let i = 0; i < moons; i++) {
      const traits = genPlanetTraits(p.system.zone, false, p._life ?? 1);
      traits.bodySize = pickW([["lowDensity", 2], ["small", 4], ["large", 1]]);
      const msys = { bodyType: "moon", zone: p.system.zone, parentId: p._id, ...traits, resources: genResources("moon", traits, null, features) };
      msys.worldEnv = genEnv(msys);
      setEco(msys, traits);
      const mName = uncharted ? `${p.name}-${i + 1}`
        : useNames ? genUnique(avoid, { kind: "planet", number: true })
        : `${p.name} ${String.fromCharCode(945 + i)}`;
      bodies.push({ _id: rid(), type: "celestialBody", name: mName, system: msys });
    }
  }

  // Гарантированные классы миров (тонкая настройка): требуют имперского присутствия.
  const forcedClasses = (o.worldClasses || []).filter(c => WORLD_CLASSES[c]);
  const IMP_BRANCH = ["imperium", "mechanicus", "astartes", "rogueTrader"];
  let inhEff = inh;
  if (forcedClasses.length && !inhEff.some(k => IMP_BRANCH.includes(k)))
    inhEff = ["imperium", ...inhEff];   // подселяем Империум, чтобы было кому владеть мирами
  const doPopulate = !uninhabited || forcedClasses.length > 0;
  if (doPopulate) addPopulation(bodies, primaries, primaryId, inhEff, xenosSpecies, features, useNames, avoid, o.dynasty || "", forcedClasses);

  // Тонкая настройка наличия жизни.
  const lifeMode = o.life ?? "auto";
  const lifeType = o.lifeType || "any";
  const isLifeBody = (b) => ["planet", "moon", "gasGiant"].includes(b.system.bodyType) && (isLifeHab(b.system.habitability) || b.system.exotic);
  if (lifeMode === "none") {
    for (const b of bodies) if (isLifeBody(b)) { b.system.habitability = "inhospitable"; b.system.exotic = false; if (b.system.description) b.system.description = ""; }
  } else if (lifeMode !== "auto") {
    const want = lifeMode === "few" ? 1 + (chance(0.5) ? 1 : 0) : lifeMode === "many" ? 4 + d(3) : (Number(lifeMode) || 0);
    let guard = 50;
    while (bodies.filter(isLifeBody).length < want && guard-- > 0) {
      let cand = bodies.find(b => b.system.bodyType === "planet" && b.system.zone === "primaryBiosphere" && !isLifeBody(b));
      if (!cand) cand = bodies.find(b => b.system.bodyType === "planet" && !isLifeBody(b));
      if (!cand) break;
      makeLife(cand.system, lifeType);
    }
  }

  // Аномалии и встречи (тонкая настройка; крепятся к главной звезде с зоной).
  const zoneKeys = ["innerCauldron", "primaryBiosphere", "outerReaches"];
  const resolveN = (mode, auto) => (mode == null || mode === "auto") ? auto
    : mode === "none" ? 0 : mode === "few" ? 1 + (chance(0.5) ? 1 : 0) : mode === "many" ? 3 + d(3) : (Number(mode) || 0);
  const autoAnom = (() => { let n = pickW([[0, 2], [1, 4], [2, 3], [3, 1]]); if (features.has("stellarAnomaly") || features.has("warpTurbulence")) n++; return Math.round(n * densMul); })();
  const autoEnc = Math.round(pickW([[0, 2], [1, 4], [2, 3], [3, 1]]) * densMul);
  const nAnom = Math.max(0, resolveN(o.anomalies, autoAnom));
  const nEnc = Math.max(0, resolveN(o.encounters, autoEnc));
  for (let i = 0; i < nAnom; i++) bodies.push(generateAnomaly({ avoid, useNames, zone: pick(zoneKeys), parentId: primaryId }));
  for (let i = 0; i < nEnc; i++) bodies.push(generateEncounter({ avoid, useNames, zone: pick(zoneKeys), parentId: primaryId }));

  for (const b of bodies) delete b._life;   // служебное поле — не сохраняем
  return { baseName, config: layout.config, starNote: layout.note, features: [...features], bodies };
}
