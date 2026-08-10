/**
 * Библиотека Бестиария — Warhammer DBC.
 *
 * Создаётся в компендиуме "warhammer-dbc.bestiary" при первом запуске
 * (см. warhammer-dbc.mjs, хук "ready"). Неразрушающее наполнение по имени —
 * существующие акторы не трогаются. Перетаскивается на сцену/в мир.
 *
 * NPC = актёр типа "character" (отдельного типа npc в системе нет). Характеристики
 * задаются базой (base); total/bonus и тоталы навыков считает actor.mjs
 * (prepareDerivedData). Раны задаются вручную (для character не деривятся).
 *
 * СНАРЯЖЕНИЕ И СПОСОБНОСТИ (kit):
 *   Хук на старте резолвит записи kit из уже существующих компендиумов по имени
 *   (гибкое совпадение по подстроке — токены RU/EN в q[]) и вкладывает КОПИИ в
 *   актора. Отсутствующее пропускается с предупреждением в консоли — актор всё
 *   равно создаётся. Так статы оружия/брони живут в одном источнике (компендиумах).
 *
 *   Форматы записи kit:
 *     { pack, q:[токены...], equipped?, qty? }  — тянуть из компендиума <pack>
 *     { inline: {name,type,img,system} }         — вложить объект как есть
 *
 *   pack: "weapons" | "armor" | "shields" | "ammunition" | "talents" | "traits"
 *       | "psychic-powers" | "diseases" | "implants"
 *
 * Числа — это стартовый ориентир для ГМа, легко подкручиваются на акторе.
 */

import { SKITARII_WAR_PLATE } from "./implants.mjs";
import { DRUKHARI_BESTIARY }  from "./drukhari-bestiary.mjs";

const IMG = "icons/svg/mystery-man.svg";

// Характеристики из базовой карты { ws, bs, ... }. total/bonus пересчитает актор.
const CH = (m) => {
  const o = {};
  for (const k of ["ws","bs","s","t","ag","int","per","wp","fel","inf"]) {
    const base = m[k] ?? 0;
    o[k] = { base, advance: 0, supernatural: 0, improvement: "none",
             total: base, bonus: Math.floor(base / 10), cost: 0 };
  }
  return o;
};

// Навыки из карты { skill: "rank" }; остальные остаются untrained.
const SK = (m) => {
  const o = {};
  for (const [k, rank] of Object.entries(m)) o[k] = { rank, cost: 0, total: 0 };
  return o;
};

// Инлайн-черта с авто-эффектами (для расовых черт Астартес — гарантируем расчёт).
const FX0 = { charBonusStat: "", charBonusValue: 0, armourAll: 0, fearRating: 0, sizeMod: 0 };
const TRAIT = (name, benefit, effects = {}, rating = 0, hasRating = false) => ({
  inline: {
    name, type: "trait", img: "icons/svg/item-bag.svg",
    system: { description: "", benefit, source: "раса", hasRating, rating,
              hasRating2: false, rating2: 0, effects: { ...FX0, ...effects } }
  }
});

// Черта Страха с авто-эффектом fearRating (читается в prepareDerivedData).
const FEAR = (n, note) => ({
  inline: {
    name: `Fear (${n}) / Страх (${n})`, type: "trait", img: "icons/svg/terror.svg",
    system: { description: note || "", benefit: `Вызывает Страх (${n}) — цели проходят тест Воли.`,
              source: "", hasRating: true, rating: n, hasRating2: false, rating2: 0,
              effects: { ...FX0, fearRating: n } }
  }
});

// Расовые Черты Астартес (копия из races.mjs — с авто-эффектами).
const ASTARTES_TRAITS = [
  TRAIT("Nimble / Проворный", "Атакующим по нему −Ag.b к попаданию.", {}, 10, true),
  TRAIT("Size (1) / Размер (1)", "Размер +1 к SPD.", { sizeMod: 1 }, 1, true),
  TRAIT("Unnatural Strength (4) / Сверхъестественная Сила (4)", "+4 к Бонусу Силы.",
        { charBonusStat: "s", charBonusValue: 4 }, 4, true),
  TRAIT("Unnatural Toughness (4) / Сверхъестественная Стойкость (4)", "+4 к Бонусу Стойкости.",
        { charBonusStat: "t", charBonusValue: 4 }, 4, true),
  TRAIT("Gene-Seed / Геносемя", "Открывает преимущества имплантов Геносемени.", {})
];

// Токены снаряжения (RU + EN) для гибкого резолва из компендиумов.
const W = {
  autogun:   ["Autogun", "Автоган", "Автомат"],
  autopistol:["Autopistol", "Автопистолет"],
  laspistol: ["Laspistol", "Лазпистолет"],
  lasgun:    ["Lasgun", "Лазган", "Лазружь"],
  shotgun:   ["Shotgun", "Дробовик"],
  stubAuto:  ["Stub Automatic", "Стаб-автомат", "Стаб-пистолет"],
  knife:     ["Knife", "Нож"],
  club:      ["Club", "Дубина", "Cudgel", "Дубьё", "Improvised"],
  sword:     ["Sword", "Меч"],
  chainsword:["Chainsword", "Цепной меч"],
  chainaxe:  ["Chainaxe", "Цепной топор"],
  boltPistol:["Bolt Pistol", "Болт-пистолет", "Болтовой пистолет"],
  bolter:    ["Boltgun", "Bolter", "Болтер"],
  powerSword:["Power Sword", "Силовой меч"],
  crozius:   ["Accursed Crozius", "Проклятый Крозиус", "Крозиус"],
  // ── Лоялисты: тяжёлое / силовое / Механикус ──
  heavyStub: ["Heavy Stubber", "Тяжёлый стаб", "Тяжёлый стуб"],
  autocannon:["Autocannon", "Автопушка"],
  missile:   ["Missile Launcher", "Ракетн", "Ракетомёт"],
  heavyBolt: ["Heavy Bolter", "Тяжёлый болтер"],
  combatSg:  ["Combat Shotgun", "Боевой дробовик", "Shotgun", "Дробовик"],
  hotshot:   ["Hotshot", "Hot-shot", "Хотшот", "Lasgun", "Лазган"],
  shockMaul: ["Shock Maul", "Шок-дубин", "Шоковая дубин", "Shock Whip"],
  powerMaul: ["Power Maul", "Силовая дубин", "Truncheon", "Дубинка"],
  omniAxe:   ["Omnissiah Axe", "Omniss", "Топор Омнисс", "Аксиом", "Power Axe", "Силовой топор"],
  // ── Арбитрес: одноручное стрелковое + щиты Арбитров ──
  shotgunPistol: ["Shotgun Pistol", "Дробовик-пистолет", "Пистолет-дробовик"],
  stubRevolver:  ["Stub Revolver", "Револьвер"],
  handCannon:    ["Hand Cannon", "Ручная пушка"],
  arbitesShield: ["Slab Shield", "Слэб-щит", "Слэб", "Boarding Shield", "Штурмовой щит", "Assault Shield", "Combat Shield"],
  // ── Скитарии / Адептус Механикус ──
  radiumCarb:["Radium Carbine", "Радиевый карабин", "Радиев"],
  radiumJez: ["Radium Jezzail", "Радиевый джезайл", "Джезайл"],
  galvRifle: ["Galvanic Rifle", "Гальваническая винтовка"],
  galvCarb:  ["Galvanic Carbine", "Гальванический карабин"],
  arquebus:  ["Transuranic Arquebus", "Трансураниев", "Аркебуза"],
  plasmaCal: ["Plasma Caliver", "Плазменный каливер"],
  phosphor:  ["Phosphor Pistol", "Phosphor Serpenta", "Phosphor Blast Pistol", "Фосфор"],
  flechette: ["Flechette Blaster", "Flechette Carbine", "Флешетт", "Флешетта"],
  transBlade:["Transonic Blade", "Трансоническ", "Трансоник"],
  transRazor:["Transonic Razor", "Трансоническая бритва"],
  chordclaw: ["Chordclaw", "Хордокоготь", "Аккорд-коготь"],
  arcMaul:   ["Arc Maul", "Дуговая дубин", "Арк-маул"],
  arcClaw:   ["Arc Claw", "Дуговой коготь"],
  taserGoad: ["Taser Goad", "Taser Lance", "Тазер", "Тэйзер"],
  // ── Тяжёлое (для сервиторов) ──
  multimelta:["Multimelta", "Multi-melta", "Мультимелта", "Мультиплавиль"],
  plasmaCann:["Plasma Cannon", "Плазменная пушка", "Плазмопушка"],
  lascannon: ["Lascannon", "Лазпушка", "Ласкэннон"],
  heavyFlamer:["Heavy Flamer", "Тяжёлый огнемёт"],
  gravCannon:["Grav Cannon", "Гравипушка", "Грав-пушка", "Graviton"],
  powerFist: ["Power Fist", "Силовой кулак"],
  chainfist: ["Chainfist", "Цепной кулак"],
  drill:     ["Drill", "Дрель", "Бур"],
  servoClaw: ["Servo Claw", "Серво-Коготь", "Серво Коготь"]
};
const A = {
  leather:   ["Leather", "Кожан", "Robes", "Роба", "Рубище", "Тряпь"],
  flak:      ["Flak", "Флак"],
  carapace:  ["Carapace", "Панцир"],
  powerArm:  ["Power Armour", "Power Armor", "Силовая броня", "Силовой доспех", "Mk"],
  mechRobe:  ["Mechanicus", "Механикус", "Adept", "Ряса", "Роба", "Carapace", "Панцир"],
  vulcanCloak:  ["Вулканизированный плащ", "Vulcanised Cloak", "Vulcanized Cloak", "Вулкан"],
  enforcerCarapace: ["Панцирь Силовиков", "Панцирь силовик", "Enforcer", "Carapace", "Панцир"],
  arbitesCarapace:  ["Панцирь Арбитров", "Arbites", "Панцир"]
};
const T = {
  frenzy:    ["Frenzy", "Ярость", "Бешенство"],
  fearless:  ["Fearless", "Бесстраш"],
  nerves:    ["Nerves of Steel", "Стальные Нервы"],
  jaded:     ["Jaded", "Пресыщ", "привыкш"],
  ambi:      ["Ambidextrous", "Двурук", "Амбидекстр"],
  swift:     ["Swift Attack", "Быстрая Атака"],
  hatred:    ["Hatred", "Ненависть"],
  quickDraw: ["Quick Draw", "Быстрое обнажение", "Молниеносное обнажение"],
  command:   ["Air of Authority", "Iron Discipline", "Железная Дисциплина", "Командный голос"],
  ironDisc:  ["Iron Discipline", "Железная Дисциплина"],
  takedown:  ["Takedown", "Обезвреживание", "Захват"],
  mechUse:   ["Mechadendrite Use", "Мехадендрит", "Использование Мехадендрита"],
  weaponTech:["Weapon-Tech", "Оружейная Технология", "Оружейный Техник"],
  techKnock: ["Technical Knock", "Технический Удар", "Заклинивание"],
  logisTeach:["Logis Implant", "Логис", "Feedback Screech"],
  marksman:  ["Marksman", "Меткий стрелок", "Снайпер"],
  deadeye:   ["Deadeye Shot", "Меткий выстрел"],
  fearless2: ["Fearless", "Бесстраш"]
};

// Имплант Механикус (для техножрецов).
const IMP = {
  servoArm:  ["Servo-Arm", "Серво-Рука"],
  servoTalon:["Servo-Talon", "Серво-Коготь"],
  miu:       ["Mind Impulse", "МИУ", "MIU"],
  respirator:["Respirator", "Респиратор"],
  potentia:  ["Potentia", "Потенциа", "Потенц"],
  servoShunt:["Servo-Shunt", "Серво-Шунт"],
  mechad:    ["Mechadendrite", "Мехадендрит"]
};

const gun   = (q, extra = {}) => ({ pack: "weapons", q, equipped: true, ...extra });
const melee = (q, extra = {}) => ({ pack: "weapons", q, equipped: true, ...extra });
const armr  = (q, extra = {}) => ({ pack: "armor", q, equipped: true, ...extra });
const tal   = (q) => ({ pack: "talents", q });
const psy   = (q) => ({ pack: "psychic-powers", q });
const dis   = (q) => ({ pack: "diseases", q });
const imp   = (q) => ({ pack: "implants", q });
const tec   = (q) => ({ pack: "tech-powers", q });

// Черта бездумной машины (сервиторы): иммунитет к страху/боли/психологии + бонус Силы.
const MINDLESS = (sMod = 2) => ({
  inline: {
    name: "Машинный разум / Mindless Machine", type: "trait", img: "icons/svg/pawprint.svg",
    system: { description: "",
      benefit: "Не подвержен Страху, боли и психологии; не проходит тесты Воли на страх. "
             + "Действует только по последней команде хозяина.",
      source: "конструкция", hasRating: false, rating: 0, hasRating2: false, rating2: 0,
      effects: { ...FX0, charBonusStat: "s", charBonusValue: sMod } }
  }
});

// Доктринальный «мозговой замок» скитариев: иммунитет к страху/психологии.
const MINDLOCK = {
  inline: {
    name: "Мозговой замок / Mind-Lock", type: "trait", img: "icons/svg/paralysis.svg",
    system: { description: "",
      benefit: "Доктринальный замок разума: иммунитет к Страху и большинству психологических эффектов; "
             + "беспрекословно исполняет приказы своего альфы. При гибели командира действует по последнему приказу.",
      source: "аугметика", hasRating: false, rating: 0, hasRating2: false, rating2: 0, effects: { ...FX0 } }
  }
};

// Фабрика боевого сервитора: общие статы киборга-раба + переданное вооружение.
const SERVITOR = (name, note, weapons, o = {}) => ({
  name, folderParent: "Империум", folder: "Боевые сервиторы", img: IMG,
  system: {
    race: "human", alignment: "loyalist", size: 0,
    characteristics: CH({ ws: o.ws ?? 35, bs: o.bs ?? 33, s: o.s ?? 40, t: o.t ?? 40,
                          ag: 25, int: 12, per: 25, wp: 30, fel: 10, inf: 19 }),
    wounds: { value: o.wounds ?? 12, max: o.wounds ?? 12, critical: 0, firstAidUsed: false },
    fate:   { value: 0, max: 0 },
    skills: SK({ athletics: "knows" }),
    notes: note
  },
  kit: [ MINDLESS(o.sMod ?? 2), ...weapons, armr(A.carapace) ]
});

// ────────────────────────────────────────────────────────────────────────────
export const BESTIARY_LIBRARY = [

  // ── Тир 0: пушечное мясо ──────────────────────────────────────────────────
  {
    name: "Отребье культа",
    folderParent: "Культы Хаоса", folder: "Рядовые", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:25, bs:20, s:25, t:25, ag:30, int:20, per:25, wp:22, fel:20, inf:25 }),
      wounds: { value: 8, max: 8, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 15, threshold: 0 }, insanity: { value: 10, threshold: 0 },
      skills: SK({ intimidate: "knows", stealth: "knows", athletics: "knows" }),
      notes: "<p><b>Роль:</b> толпа-мясо, берёт числом. Дубьё, ножи, ржавые самопалы. "
           + "Обычно выставляется группами или как <i>Орда</i>. Бежит при потере половины.</p>"
    },
    kit: [ melee(W.club), melee(W.knife), gun(W.stubAuto, { equipped: false }) ]
  },

  // ── Тир 1: линейный боец ──────────────────────────────────────────────────
  {
    name: "Культист-неофит",
    folderParent: "Культы Хаоса", folder: "Рядовые", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:30, bs:30, s:30, t:30, ag:30, int:25, per:30, wp:30, fel:25, inf:30 }),
      wounds: { value: 10, max: 10, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      corruption: { value: 25, threshold: 0 }, insanity: { value: 15, threshold: 0 },
      skills: SK({ awareness: "knows", dodge: "knows", intimidate: "knows", stealth: "knows",
                   deceive: "knows" }),
      notes: "<p><b>Роль:</b> рядовой боец культа. Автоган или лазган, нож, робы поверх флак-жилета. "
           + "Дерётся дисциплинированнее отребья, держит строй под началом надсмотрщика.</p>"
    },
    kit: [ gun([...W.autogun, ...W.lasgun]), melee(W.knife), armr(A.flak) ]
  },

  // ── Тир 2: сержант / надсмотрщик ──────────────────────────────────────────
  {
    name: "Надсмотрщик культа",
    folderParent: "Культы Хаоса", folder: "Рядовые", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:35, bs:35, s:35, t:35, ag:30, int:30, per:30, wp:35, fel:32, inf:35 }),
      wounds: { value: 14, max: 14, critical: 0, firstAidUsed: false },
      fate:   { value: 1, max: 1 },
      corruption: { value: 35, threshold: 0 }, insanity: { value: 20, threshold: 0 },
      skills: SK({ command: "trained", intimidate: "trained", awareness: "knows",
                   dodge: "knows", parry: "knows", deceive: "knows" }),
      notes: "<p><b>Роль:</b> вожак малой группы. Дробовик и цепной меч, флак-броня. "
           + "Держит паству в узде (Command/Intimidate), гонит рядовых вперёд. "
           + "Пока он жив, рядовые не бегут при провале Воли.</p>"
    },
    kit: [ gun(W.shotgun), melee(W.chainsword), armr(A.flak), tal(T.jaded) ]
  },

  // ── Тир 3: элитный боевик / поборник ──────────────────────────────────────
  {
    name: "Поборник Хаоса",
    folderParent: "Культы Хаоса", folder: "Рядовые", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:42, bs:38, s:40, t:40, ag:38, int:32, per:35, wp:40, fel:38, inf:42 }),
      wounds: { value: 18, max: 18, critical: 0, firstAidUsed: false },
      fate:   { value: 1, max: 2 },
      corruption: { value: 55, threshold: 0 }, insanity: { value: 30, threshold: 0 },
      skills: SK({ command: "trained", intimidate: "trained", parry: "trained",
                   dodge: "trained", awareness: "knows", deceive: "knows" }),
      notes: "<p><b>Роль:</b> избранный воитель, отмеченный Богами. Силовой меч и болт-пистолет, "
           + "панцирная броня. Ведёт культ в бой, служит мини-боссом. "
           + "Стальные Нервы против страха.</p>"
    },
    kit: [ melee([...W.powerSword, ...W.chainsword]), gun(W.boltPistol, { equipped: false }),
           armr(A.carapace), tal(T.nerves) ]
  },

  // ── Тир 4: КХОРН — головорез/берсерк ──────────────────────────────────────
  {
    name: "Головорез Кхорна",
    folderParent: "Культы Хаоса", folder: "Служители Тёмных Богов", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:45, bs:25, s:42, t:42, ag:38, int:22, per:30, wp:35, fel:25, inf:40 }),
      wounds: { value: 20, max: 20, critical: 0, firstAidUsed: false },
      fate:   { value: 1, max: 1 },
      corruption: { value: 60, threshold: 0 }, insanity: { value: 40, threshold: 0 },
      skills: SK({ intimidate: "trained", athletics: "trained", parry: "knows", awareness: "knows" }),
      notes: "<p><b>Бог:</b> Кхорн, Кровавый Бог. <b>Роль:</b> берсерк ближнего боя. "
           + "Цепной топор наперевес, кидается в свалку. <b>Ярость</b> (Frenzy) и "
           + "<b>Ненависть</b> — не отступает, не сдаётся. «Кровь для Кровавого Бога!»</p>"
    },
    kit: [ melee(W.chainaxe), armr(A.flak), tal(T.frenzy), tal(T.hatred) ]
  },

  // ── Тир 4: НУРГЛ — чумной культист ────────────────────────────────────────
  {
    name: "Чумной культист Нургла",
    folderParent: "Культы Хаоса", folder: "Служители Тёмных Богов", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:33, bs:28, s:35, t:45, ag:25, int:28, per:30, wp:38, fel:22, inf:35 }),
      wounds: { value: 22, max: 22, critical: 0, firstAidUsed: false },
      fate:   { value: 1, max: 1 },
      corruption: { value: 65, threshold: 0 }, insanity: { value: 35, threshold: 0 },
      skills: SK({ intimidate: "knows", awareness: "knows", survival: "knows", medicae: "knows" }),
      notes: "<p><b>Бог:</b> Нургл, Владыка Мора. <b>Роль:</b> медлительный, но невероятно живучий "
           + "разносчик заразы (высокая Стойкость, много Ран). Ржавый нож и гнилостные испарения; "
           + "переносит болезнь. Не чувствует боли, прёт вперёд под огнём. «Дедушка Нургл любит вас».</p>"
    },
    kit: [ melee(W.knife), armr(A.leather), tal(T.jaded),
           FEAR(1, "Разлагающийся, смердящий носитель заразы."),
           dis(["Чума", "Plague", "Гни", "Rot", "Нургл"]) ]
  },

  // ── Тир 4: ТЗИНЧ — магус-псайкер ──────────────────────────────────────────
  {
    name: "Магус Тзинча",
    folderParent: "Культы Хаоса", folder: "Служители Тёмных Богов", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      isPsyker: true,
      psyker: { class: "unbound", rating: 2, sustain: 0, currentRating: 2 },
      characteristics: CH({ ws:30, bs:30, s:28, t:32, ag:33, int:42, per:38, wp:45, fel:38, inf:42 }),
      wounds: { value: 12, max: 12, critical: 0, firstAidUsed: false },
      fate:   { value: 1, max: 2 },
      corruption: { value: 60, threshold: 0 }, insanity: { value: 45, threshold: 0 },
      skills: SK({ psyniscience: "trained", deceive: "trained",
                   charm: "knows", awareness: "knows", dodge: "knows" }),
      notes: "<p><b>Бог:</b> Тзинч, Изменяющий Пути. <b>Роль:</b> лидер-псайкер (PR 2). "
           + "Плетёт заклятья с задней линии, прикрываясь культистами. Лазпистолет на крайний случай. "
           + "Псисилы вложены из компендиума (подставьте нужные). «Всё по плану».</p>"
    },
    kit: [ gun(W.laspistol), tal(["Psy Rating", "Пси-Рейтинг", "Псайкер"]),
           psy(["", "Молния", "Bolt", "Огонь"]) ]  // резолв возьмёт первую подходящую псисилу
  },

  // ── Тир 4: СЛААНЕШ — фанатик-гедонит ──────────────────────────────────────
  {
    name: "Фанатик Слаанеш",
    folderParent: "Культы Хаоса", folder: "Служители Тёмных Богов", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:42, bs:35, s:33, t:33, ag:48, int:30, per:38, wp:35, fel:42, inf:42 }),
      wounds: { value: 14, max: 14, critical: 0, firstAidUsed: false },
      fate:   { value: 1, max: 1 },
      corruption: { value: 60, threshold: 0 }, insanity: { value: 40, threshold: 0 },
      skills: SK({ acrobatics: "trained", dodge: "trained", parry: "trained", charm: "trained",
                   intimidate: "knows", stealth: "knows" }),
      notes: "<p><b>Бог:</b> Слаанеш, Владычица Наслаждений. <b>Роль:</b> стремительный дуэлянт. "
           + "Два клинка, бьёт первым и много (Ambidextrous, Swift Attack), уходит от ответа "
           + "за счёт огромной Ловкости. Экстатичен, бесстрашен в бою. «Ощути всё!»</p>"
    },
    kit: [ melee(W.sword), melee(W.sword, { equipped: true }), armr(A.leather),
           tal(T.ambi), tal(T.swift) ]
  },

  // ── Особый: ТЁМНЫЙ АПОСТОЛ — Астартес, Несущие Слово (XVII) ────────────────
  {
    name: "Тёмный Апостол (Несущие Слово)",
    folderParent: "Культы Хаоса", folder: "Астартес Хаоса", img: IMG,
    system: {
      race: "astartes", alignment: "heretic", size: 0,   // +1 к размеру даёт черта Size(1)
      geneSeed: { origin: "", legion: "XVII", chapter: "" },
      characteristics: CH({ ws:55, bs:50, s:45, t:45, ag:45, int:45, per:45, wp:55, fel:50, inf:45 }),
      wounds: { value: 30, max: 30, critical: 0, firstAidUsed: false },
      fate:   { value: 3, max: 4 },
      deadMight: { value: 0, max: 0 },
      corruption: { value: 80, threshold: 0 }, insanity: { value: 40, threshold: 0 },
      skills: SK({ command: "expert", intimidate: "expert", deceive: "veteran", charm: "trained",
                   parry: "veteran", dodge: "trained", awareness: "trained", scrutiny: "trained" }),
      notes: "<p><b>Легион:</b> XVII «Несущие Слово». <b>Роль:</b> вождь-жрец культа, босс-энкаунтер. "
           + "Проклятый Крозиус и болт-пистолет, силовая броня. Внушает <b>Страх</b>, разжигает "
           + "фанатизм паствы вокруг.</p>"
           + "<p><b>«Изначальная Истина» (культура легиона):</b> Common Lore (Chaos)+20, "
           + "Forbidden Lore (Daemons/Heresy/Warp), Linguistics (Chaos Glyphs, True Tongue). "
           + "Раз/сцену — переброс этих Навыков, Charm или Deceive. <b>Проклятья нет.</b></p>"
           + "<p><i>Сверхъест. Сила/Стойкость (+4 к бонусам) и Размер +1 дают расовые Черты (вложены). "
           + "Легион задан в геносемени.</i></p>"
    },
    kit: [
      ...ASTARTES_TRAITS,
      FEAR(2, "Отмеченный Богами вождь-жрец, само присутствие которого леденит кровь."),
      melee(W.crozius),
      gun(W.boltPistol, { equipped: false }),
      armr(A.powerArm),
      tal(T.nerves), tal(T.fearless), tal(T.hatred)
    ]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ЛОЯЛИСТЫ ИМПЕРИУМА
  // ══════════════════════════════════════════════════════════════════════════

  // ── СПО: ополченец (пушечное мясо обороны) ────────────────────────────────
  {
    name: "Ополченец СПО",
    folderParent: "Империум", folder: "Силы Планетарной Обороны (СПО)", img: IMG,
    system: {
      race: "human", alignment: "loyalist", size: 0,
      characteristics: CH({ ws:28, bs:28, s:28, t:28, ag:28, int:25, per:28, wp:25, fel:25, inf:19 }),
      wounds: { value: 8, max: 8, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 0 },
      skills: SK({ awareness: "knows", dodge: "knows", athletics: "knows" }),
      notes: "<p><b>Роль:</b> призванный ополченец Сил Планетарной Обороны. Лазган и флак-жилет, "
           + "слабая подготовка. Держится числом и под присмотром сержанта; при потере половины бежит.</p>"
    },
    kit: [ gun(W.lasgun), melee(W.knife, { equipped: false }), armr(A.flak) ]
  },

  // ── СПО: гвардеец (линейный) ──────────────────────────────────────────────
  {
    name: "Гвардеец СПО",
    folderParent: "Империум", folder: "Силы Планетарной Обороны (СПО)", img: IMG,
    system: {
      race: "human", alignment: "loyalist", size: 0,
      characteristics: CH({ ws:33, bs:35, s:30, t:32, ag:30, int:28, per:32, wp:30, fel:28, inf:19 }),
      wounds: { value: 11, max: 11, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 1 },
      skills: SK({ awareness: "trained", dodge: "knows", athletics: "knows", intimidate: "knows",
                   security: "knows" }),
      notes: "<p><b>Роль:</b> кадровый боец СПО. Лазган, флак-броня, нож. Обучен строю и "
           + "подавляющему огню, держит позицию под командой офицера.</p>"
    },
    kit: [ gun(W.lasgun), melee(W.knife, { equipped: false }), armr(A.flak) ]
  },

  // ── СПО: тяжёлый стрелок ───────────────────────────────────────────────────
  {
    name: "Тяжёлый стрелок СПО",
    folderParent: "Империум", folder: "Силы Планетарной Обороны (СПО)", img: IMG,
    system: {
      race: "human", alignment: "loyalist", size: 0,
      characteristics: CH({ ws:30, bs:38, s:35, t:33, ag:28, int:28, per:33, wp:30, fel:25, inf:19 }),
      wounds: { value: 12, max: 12, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 1 },
      skills: SK({ awareness: "trained", athletics: "knows", dodge: "knows", techUse: "knows" }),
      notes: "<p><b>Роль:</b> расчёт тяжёлого оружия. Тяжёлый стаббер (или автопушка/ракетомёт), "
           + "флак-броня, лазпистолет для самозащиты. Ставится на удержание секторов и подавление.</p>"
    },
    kit: [ gun(W.heavyStub), gun([...W.laspistol], { equipped: false }), armr(A.flak) ]
  },

  // ── СПО: офицер-командир ──────────────────────────────────────────────────
  {
    name: "Офицер СПО",
    folderParent: "Империум", folder: "Силы Планетарной Обороны (СПО)", img: IMG,
    system: {
      race: "human", alignment: "loyalist", size: 0,
      characteristics: CH({ ws:38, bs:38, s:33, t:33, ag:33, int:35, per:35, wp:38, fel:40, inf:19 }),
      wounds: { value: 15, max: 15, critical: 0, firstAidUsed: false },
      fate:   { value: 1, max: 2 },
      skills: SK({ command: "expert", intimidate: "trained", awareness: "trained", parry: "trained",
                   dodge: "knows", scrutiny: "knows", charm: "knows" }),
      notes: "<p><b>Роль:</b> командир подразделения СПО. Силовой меч и лазпистолет, панцирная броня. "
           + "Держит строй Командованием (Command/Iron Discipline): пока он жив, бойцы не бегут при "
           + "провале Воли и получают его лидерство.</p>"
    },
    kit: [ melee([...W.powerSword, ...W.sword]), gun(W.laspistol, { equipped: false }),
           armr(A.carapace), tal(T.ironDisc) ]
  },

  // ── Силовики: патрульный энфорсер ─────────────────────────────────────────
  {
    name: "Силовик (энфорсер)",
    folderParent: "Империум", folder: "Силовики / Арбитрес", img: IMG,
    system: {
      race: "human", alignment: "loyalist", size: 0,
      characteristics: CH({ ws:35, bs:35, s:35, t:35, ag:32, int:30, per:33, wp:33, fel:30, inf:19 }),
      wounds: { value: 13, max: 13, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 1 },
      skills: SK({ intimidate: "trained", awareness: "trained", dodge: "knows", parry: "knows",
                   security: "trained", inquiry: "knows" }),
      notes: "<p><b>Роль:</b> городской силовик Арбитрес, поддержание порядка. Щит Арбитров и шок-дубина, "
           + "одноручный ствол (пистолет-дробовик/револьвер), <b>Панцирь Арбитров</b>. Держит строй со щитами, "
           + "гонит нарушителей нелетально, при эскалации бьёт из пистолета.</p>"
    },
    kit: [ gun([...W.shotgunPistol, ...W.stubRevolver]), melee(W.arbitesShield),
           melee(W.shockMaul, { equipped: false }), armr(A.arbitesCarapace), tal(T.takedown) ]
  },

  // ── Силовики: Арбитратор (Адептус Арбитрес) ───────────────────────────────
  {
    name: "Арбитратор",
    folderParent: "Империум", folder: "Силовики / Арбитрес", img: IMG,
    system: {
      race: "human", alignment: "loyalist", size: 0,
      characteristics: CH({ ws:40, bs:40, s:38, t:38, ag:33, int:32, per:35, wp:38, fel:30, inf:19 }),
      wounds: { value: 15, max: 15, critical: 0, firstAidUsed: false },
      fate:   { value: 1, max: 1 },
      skills: SK({ intimidate: "trained", awareness: "trained", parry: "trained", dodge: "trained",
                   security: "trained", interrogate: "knows" }),
      notes: "<p><b>Роль:</b> судебный силовик Адептус Арбитрес, ударная пехота закона. "
           + "Щит Арбитров и силовая/шок-дубина, одноручный ствол (пистолет-дробовик/болт-пистолет), "
           + "<b>Панцирь Арбитров</b>. Стойкий, дисциплинированный, давит бунты стеной щитов.</p>"
    },
    kit: [ gun([...W.shotgunPistol, ...W.boltPistol]), melee(W.arbitesShield),
           melee([...W.powerMaul, ...W.shockMaul], { equipped: false }),
           armr(A.arbitesCarapace), tal(T.ironDisc), tal(T.nerves) ]
  },

  // ── Силовики: Проктор Арбитрес (сержант/лидер) ────────────────────────────
  {
    name: "Проктор Арбитрес",
    folderParent: "Империум", folder: "Силовики / Арбитрес", img: IMG,
    system: {
      race: "human", alignment: "loyalist", size: 0,
      characteristics: CH({ ws:42, bs:42, s:38, t:40, ag:33, int:35, per:38, wp:42, fel:35, inf:19 }),
      wounds: { value: 17, max: 17, critical: 0, firstAidUsed: false },
      fate:   { value: 1, max: 2 },
      skills: SK({ command: "expert", intimidate: "expert", awareness: "trained", parry: "trained",
                   dodge: "knows", security: "trained", interrogate: "trained", scrutiny: "knows" }),
      notes: "<p><b>Роль:</b> командир отделения Арбитрес, мини-босс. Болт-пистолет (одноручный) и силовая "
           + "дубина, щит Арбитров, <b>Панцирь Арбитров</b>. Внушает <b>Страх (1)</b> одним видом закона, "
           + "координирует силовиков Командованием.</p>"
    },
    kit: [ gun(W.boltPistol), melee(W.arbitesShield),
           melee([...W.powerMaul, ...W.shockMaul], { equipped: false }),
           armr(A.arbitesCarapace), tal(T.command),
           FEAR(1, "Неумолимый лик имперского правосудия.") ]
  },

  // ── Механикус: техножрец-энгинсир ─────────────────────────────────────────
  {
    name: "Техножрец-энгинсир",
    folderParent: "Империум", folder: "Адептус Механикус", img: IMG,
    system: {
      race: "human", alignment: "loyalist", size: 0,
      isTechpriest: true,
      cognition: { value: 6, max: 6, regen: 1 },
      energy:    { value: 4, max: 4 },
      characteristics: CH({ ws:33, bs:35, s:35, t:38, ag:30, int:42, per:35, wp:38, fel:25, inf:19 }),
      wounds: { value: 12, max: 12, critical: 0, firstAidUsed: false },
      fate:   { value: 1, max: 1 },
      skills: SK({ techUse: "expert", logic: "trained", awareness: "knows", dodge: "knows",
                   medicae: "knows", commerce: "knows" }),
      notes: "<p><b>Роль:</b> рядовой жрец Адептус Механикус, полевой инженер. Аксиом Омниссии (силовой топор) "
           + "и лазпистолет, механикус-облачение поверх панциря. Серво-рука, МИУ, респиратор и Потенциа-катушка "
           + "(вложены имплантами) дают ему Когницию и Энергию для техно-чудес. Чинит технику, командует сервиторами.</p>"
    },
    kit: [ melee(W.omniAxe), gun(W.laspistol, { equipped: false }),
           armr(A.vulcanCloak, { stacks: true }), armr(A.enforcerCarapace, { stacks: true }),
           imp(IMP.servoArm), imp(IMP.miu), imp(IMP.respirator), imp(IMP.potentia),
           tal(T.mechUse), tal(T.techKnock),
           tec(["Luminen Shock", "Люминен Шок"]) ]
  },

  // ── Механикус: магос (старший техножрец) ──────────────────────────────────
  {
    name: "Магос Механикус",
    folderParent: "Империум", folder: "Адептус Механикус", img: IMG,
    system: {
      race: "human", alignment: "loyalist", size: 0,
      isTechpriest: true,
      cognition: { value: 10, max: 10, regen: 2 },
      energy:    { value: 8, max: 8 },
      characteristics: CH({ ws:38, bs:40, s:40, t:45, ag:30, int:50, per:42, wp:45, fel:30, inf:19 }),
      wounds: { value: 18, max: 18, critical: 0, firstAidUsed: false },
      fate:   { value: 1, max: 2 },
      skills: SK({ techUse: "expert", logic: "expert", medicae: "trained", awareness: "trained",
                   command: "trained", scrutiny: "trained", parry: "knows" }),
      notes: "<p><b>Роль:</b> старший жрец Механикус, босс-энкаунтер. Аксиом Омниссии и серво-оружие, "
           + "тяжёлое механикус-облачение. Обвешан имплантами и мехадендритами (вложены), высокая Когниция/Энергия "
           + "для мощных техно-чудес. Внушает <b>Страх (1)</b> нечеловеческим обликом. Командует сервиторами и "
           + "скитариями.</p>"
    },
    kit: [ melee(W.omniAxe), gun(W.laspistol, { equipped: false }),
           armr(A.vulcanCloak, { stacks: true }), armr(A.enforcerCarapace, { stacks: true }),
           imp(IMP.servoArm), imp(IMP.servoTalon), imp(IMP.mechad), imp(IMP.miu),
           imp(IMP.respirator), imp(IMP.potentia), imp(IMP.servoShunt),
           tal(T.mechUse), tal(T.weaponTech),
           FEAR(1, "Полу-машина, чьё присутствие тревожит смертную плоть."),
           tec(["Luminen Smite", "Люминен Сокрушение"]),
           tec(["Benediction of the Omnissiah", "Благословение Омниссии"]) ]
  },

  // ── Механикус: техэкзорцист (охотник на демон-машины) ─────────────────────
  {
    name: "Техэкзорцист Механикус",
    folderParent: "Империум", folder: "Адептус Механикус", img: IMG,
    system: {
      race: "human", alignment: "loyalist", size: 0,
      isTechpriest: true,
      cognition: { value: 8, max: 8, regen: 2 },
      energy:    { value: 6, max: 6 },
      characteristics: CH({ ws:38, bs:40, s:38, t:42, ag:32, int:48, per:42, wp:50, fel:28, inf:19 }),
      wounds: { value: 16, max: 16, critical: 0, firstAidUsed: false },
      fate:   { value: 1, max: 2 },
      skills: SK({ techUse: "expert", logic: "trained", scrutiny: "trained", awareness: "trained",
                   medicae: "knows", parry: "knows", intimidate: "knows" }),
      notes: "<p><b>Роль:</b> техножрец-специалист по <b>Техзорцизму</b> — изгоняет заражённые скрапкодом "
           + "и одержимые демонами машинные духи. Аксиом Омниссии и лазпистолет, механикус-облачение поверх "
           + "панциря. Мощная Сила Воли против варпа; серво-рука, МИУ, респиратор и Потенциа-катушка (вложены "
           + "имплантами) питают его чудеса.</p>"
           + "<p><b>Дисциплина «Техзорцизм»</b> (вложена тех-силами): Чистка, Оберег, Восстание и Пробуждение "
           + "Техзорцизма + Рунический Экзорцизм — против демонических машин и оружия.</p>"
    },
    kit: [ melee(W.omniAxe), gun(W.laspistol, { equipped: false }),
           armr(A.vulcanCloak, { stacks: true }), armr(A.enforcerCarapace, { stacks: true }),
           imp(IMP.servoArm), imp(IMP.miu), imp(IMP.respirator), imp(IMP.potentia),
           tal(T.mechUse),
           tec(["Techsorcism Purge", "Чистка Техзорцизма"]),
           tec(["Techsorcism Ward", "Оберег Техзорцизма"]),
           tec(["Techsorcism Rebellion", "Восстание Техзорцизма"]),
           tec(["Techsorcism Awakening", "Пробуждение Техзорцизма"]),
           tec(["Runic Exorcism", "Рунический Экзорцизм"]) ]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // СКИТАРИИ (папка «Скитарии»)
  // ══════════════════════════════════════════════════════════════════════════

  // ── Скитарий-рядовой ──────────────────────────────────────────────────────
  {
    name: "Скитарий-рядовой",
    folderParent: "Империум", folder: "Скитарии", img: IMG,
    system: {
      race: "human", alignment: "loyalist", size: 0,
      characteristics: CH({ ws:33, bs:38, s:33, t:38, ag:33, int:22, per:35, wp:35, fel:12, inf:19 }),
      wounds: { value: 11, max: 11, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 1 },
      skills: SK({ awareness: "knows", dodge: "knows", athletics: "knows", intimidate: "knows" }),
      notes: "<p><b>Роль:</b> рядовой солдат-киборг Адептус Механикус. Радиевый карабин, аугметическая "
           + "броня. Иммунен к страху (Мозговой замок). Действует под управлением Доктрин альфы.</p>"
    },
    kit: [ gun(W.radiumCarb), { inline: SKITARII_WAR_PLATE }, imp(IMP.respirator), MINDLOCK, tal(T.fearless) ]
  },

  // ── Скитарий-страж (Авангард) ─────────────────────────────────────────────
  {
    name: "Скитарий-страж (Авангард)",
    folderParent: "Империум", folder: "Скитарии", img: IMG,
    system: {
      race: "human", alignment: "loyalist", size: 0,
      characteristics: CH({ ws:35, bs:40, s:35, t:40, ag:33, int:22, per:35, wp:38, fel:12, inf:19 }),
      wounds: { value: 13, max: 13, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 1 },
      skills: SK({ awareness: "trained", dodge: "knows", athletics: "knows", intimidate: "trained" }),
      notes: "<p><b>Роль:</b> штурмовой авангард. Радиевый карабин (излучение косит ближние ряды) и "
           + "дуговая дубина для рукопашной. Прёт на короткую дистанцию, окружает врага радиационной аурой. "
           + "Иммунен к страху.</p>"
    },
    kit: [ gun(W.radiumCarb), melee(W.arcMaul, { equipped: false }), { inline: SKITARII_WAR_PLATE },
           imp(IMP.respirator), MINDLOCK, tal(T.fearless) ]
  },

  // ── Скитарий-рейнджер ─────────────────────────────────────────────────────
  {
    name: "Скитарий-рейнджер",
    folderParent: "Империум", folder: "Скитарии", img: IMG,
    system: {
      race: "human", alignment: "loyalist", size: 0,
      characteristics: CH({ ws:33, bs:45, s:33, t:38, ag:35, int:25, per:42, wp:38, fel:12, inf:19 }),
      wounds: { value: 12, max: 12, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 1 },
      skills: SK({ awareness: "expert", dodge: "knows", stealth: "trained", survival: "knows" }),
      notes: "<p><b>Роль:</b> дальнобойный стрелок-разведчик. Гальваническая винтовка (большая дальность, "
           + "пробитие) — снимает цели с дистанции; для снайпера подставьте Трансураниевую аркебузу. "
           + "Высокое Восприятие и меткость. Иммунен к страху.</p>"
    },
    kit: [ gun([...W.galvRifle, ...W.arquebus]), { inline: SKITARII_WAR_PLATE }, imp(IMP.respirator),
           MINDLOCK, tal(T.marksman), tal(T.deadeye) ]
  },

  // ── Ржаволов (Сикариан Руствокер) ─────────────────────────────────────────
  {
    name: "Ржаволов (Руствокер)",
    folderParent: "Империум", folder: "Скитарии", img: IMG,
    system: {
      race: "human", alignment: "loyalist", size: 0,
      characteristics: CH({ ws:45, bs:30, s:38, t:38, ag:45, int:22, per:38, wp:38, fel:10, inf:19 }),
      wounds: { value: 14, max: 14, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 1 },
      skills: SK({ acrobatics: "trained", dodge: "trained", stealth: "expert", awareness: "trained",
                   parry: "trained" }),
      notes: "<p><b>Роль:</b> Сикариан-ассасин ближнего боя. Трансонические клинки и хордокоготь режут "
           + "броню как бумагу; стремителен (Ag 45), бьёт из тени. Внушает <b>Страх (1)</b> жутким "
           + "обликом ржавого убийцы. Иммунен к страху.</p>"
    },
    kit: [ melee(W.transBlade), melee([...W.transRazor, ...W.chordclaw], { equipped: false }),
           { inline: SKITARII_WAR_PLATE }, MINDLOCK, tal(T.ambi), tal(T.swift),
           FEAR(1, "Бесшумный ржавый ассасин, чьи клинки поют перед смертью.") ]
  },

  // ── Сикариан-инфильтратор ─────────────────────────────────────────────────
  {
    name: "Сикариан-инфильтратор",
    folderParent: "Империум", folder: "Скитарии", img: IMG,
    system: {
      race: "human", alignment: "loyalist", size: 0,
      characteristics: CH({ ws:42, bs:40, s:35, t:38, ag:45, int:25, per:42, wp:38, fel:12, inf:19 }),
      wounds: { value: 13, max: 13, critical: 0, firstAidUsed: false },
      fate:   { value: 0, max: 1 },
      skills: SK({ stealth: "expert", awareness: "trained", dodge: "trained", acrobatics: "trained",
                   security: "knows" }),
      notes: "<p><b>Роль:</b> Сикариан-диверсант. Флешетт-бластер и тазер-стрекало (Taser Goad) для "
           + "оглушения; сеет хаос в тылу, глушит связь и целеуказание. Мастер скрытности. Иммунен к страху.</p>"
    },
    kit: [ gun(W.flechette), melee(W.taserGoad, { equipped: false }), { inline: SKITARII_WAR_PLATE },
           MINDLOCK, tal(T.fearless) ]
  },

  // ── Скитарий-альфа (командир) ─────────────────────────────────────────────
  {
    name: "Скитарий-альфа",
    folderParent: "Империум", folder: "Скитарии", img: IMG,
    system: {
      race: "human", alignment: "loyalist", size: 0,
      characteristics: CH({ ws:40, bs:42, s:35, t:40, ag:35, int:30, per:40, wp:42, fel:20, inf:19 }),
      wounds: { value: 15, max: 15, critical: 0, firstAidUsed: false },
      fate:   { value: 1, max: 2 },
      skills: SK({ command: "expert", awareness: "trained", intimidate: "trained", dodge: "knows",
                   parry: "trained", techUse: "knows" }),
      notes: "<p><b>Роль:</b> командир скитарийского клада. Дуговая дубина и фосфорный пистолет, "
           + "усиленная броня. Транслирует <b>Доктрины Империативов</b> подчинённым (Command), задавая их "
           + "боевой режим. Ядро отряда скитариев. Иммунен к страху.</p>"
    },
    kit: [ melee(W.arcMaul), gun(W.phosphor, { equipped: false }), { inline: SKITARII_WAR_PLATE },
           imp(IMP.respirator), imp(IMP.miu), MINDLOCK, tal(T.command), tal(T.fearless) ]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // БОЕВЫЕ СЕРВИТОРЫ (папка «Боевые сервиторы») — разное вооружение
  // ══════════════════════════════════════════════════════════════════════════

  SERVITOR("Сервитор с тяжёлым стаббером",
    "<p><b>Роль:</b> подавляющий огонь. Встроенный тяжёлый стаббер поливает зону очередями. "
  + "Бездумный киборг-раб; иммунен к страху/боли.</p>",
    [ gun(W.heavyStub) ], { bs: 35 }),

  SERVITOR("Сервитор с тяжёлым болтером",
    "<p><b>Роль:</b> тяжёлая огневая точка. Тяжёлый болтер рвёт пехоту и лёгкую броню. "
  + "Бездумный киборг-раб; иммунен к страху/боли.</p>",
    [ gun(W.heavyBolt) ], { bs: 37, wounds: 13 }),

  SERVITOR("Сервитор с автопушкой",
    "<p><b>Роль:</b> противотехника/тяжёлая пехота. Автопушка бьёт мощными снарядами на дистанции. "
  + "Бездумный киборг-раб; иммунен к страху/боли.</p>",
    [ gun(W.autocannon) ], { bs: 35, wounds: 14 }),

  SERVITOR("Сервитор с мультимельтой",
    "<p><b>Роль:</b> истребитель танков и терминаторов. Мультимелта испаряет броню на короткой дистанции. "
  + "Бездумный киборг-раб; иммунен к страху/боли.</p>",
    [ gun(W.multimelta) ], { bs: 35, wounds: 13 }),

  SERVITOR("Сервитор с плазменной пушкой",
    "<p><b>Роль:</b> тяжёлое энергетическое орудие. Плазменная пушка выжигает бронегоалов; риск перегрева. "
  + "Бездумный киборг-раб; иммунен к страху/боли.</p>",
    [ gun(W.plasmaCann) ], { bs: 35, wounds: 13 }),

  SERVITOR("Сервитор с ласпушкой",
    "<p><b>Роль:</b> дальнобойный истребитель бронетехники. Ласпушка пробивает корпуса на большой дальности. "
  + "Бездумный киборг-раб; иммунен к страху/боли.</p>",
    [ gun(W.lascannon) ], { bs: 37, wounds: 13 }),

  SERVITOR("Сервитор ближнего боя",
    "<p><b>Роль:</b> штурмовой таран. Силовой кулак и промышленная дрель/серво-коготь дробят врага и переборки. "
  + "Очень силён (Сверхъест. Сила), бездумен; иммунен к страху/боли.</p>",
    [ melee(W.powerFist), melee([...W.drill, ...W.servoClaw], { equipped: false }) ],
    { ws: 40, s: 45, t: 45, wounds: 15, sMod: 3 }),

  // ══════════════════ ДЕМОНЫ ХАОСА — НЕДЕЛИМЫЙ ══════════════════════════════
  {
    name: "Фантом", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Неделимый", img: DIMG("Chaos"),
    prototypeToken: DTOKEN("Chaos"),
    system: {
      allegiance: "undivided", rank: "minor", form: "vessel", instabilityRating: 1, isDaemon: true, isPsyker: false,
      portfolio: "остаточные эмоции", size: -1,
      characteristics: CH({ ws:24, bs:1, s:26, t:26, ag:35, int:17, per:43, wp:25, fel:21, inf:0 }),
      wounds: { value: 5, max: 5, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ awareness:"trained", deceive:"trained", dodge:"knows", stealth:"trained" }),
      groupSkills: GSK([["commonLore","любое (×3)","knows",17], ["linguistics","Low Gothic","knows",17], ["linguistics","True Tongue","knows",17]]),
      notes: DNOTE("Ничтожнейший демон Неделимого, сотканный из остаточных эмоций смертных. Обитает в Материуме, в зонах тонкой Завесы.",
        "<b>Эмоциональный Паразит:</b> в 200 м от группы 100+ людей стабилизируется (стоп отсчёта изгнания) и усиливает их эмоции; Орда ×2 радиус/эффект за каждые 5 Магнитуды.",
        "Таланты: Paranoia, Sentry, Mimic, Total Recall, Peer (дети/безумцы). Трусливый паразит: прячется, вселяется в трупы для якоря.")
    },
    kit: [
      DTR("Daemonic (1)", "×1 к T.b в Поглощении; против экзотического незнакомого оружия ГМ может утроить бонус.", { charBonuses:[{stat:"t",value:1}] }, 1),
      FEAR(1), DTR("Flyer (4)", "Полёт со скоростью 4 (×2/×3/×6).", {}, 4),
      DTR("Phase", "Может проходить сквозь твёрдую материю; поражается только силовым/варп/психическим."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума; не Обездвиживается обычным."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне (или при любом действии при отриц. Истончении)."),
      DTR("Warp Sight", "Видит в Варпе, сквозь Завесу, души и психическую активность."),
      DTR("Deadly Natural Weapons (1)", "Смертельное естественное оружие (Когти)."),
      Dw("Spectral Claws / Спектральные Когти", { dmg:"1d10+3", type:"rending", pen:1, props:["reinforced"], special:"Считается ладонью." }),
      DTAL("Paranoia", "+2 к Инициативе; всегда считается настороже."),
      DTAL("Sentry", "Преимущество на пассивную Awareness."),
      DTAL("Mimic", "Имитирует чужой голос."),
      DTAL("Total Recall", "Вспоминает точные детали без теста."),
      DTAL("Peer (дети, безумцы)", "+10 на общение с этой фракцией."),
      DTAL("Эмоциональный Паразит", "В 200 м от группы 100+ людей стабилизируется (стоп отсчёта изгнания) и усиливает их эмоции. Орда: ×2 радиус/эффект за каждые 5 Магнитуды.", 3)
    ]
  },

  {
    name: "Призрак", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Неделимый", img: DIMG("Chaos"),
    prototypeToken: DTOKEN("Chaos"),
    system: {
      allegiance: "undivided", rank: "minor", form: "vessel", instabilityRating: 1, isDaemon: true, isPsyker: false,
      portfolio: "осколок Фурии", size: -2,
      characteristics: CH({ ws:35, bs:11, s:16, t:22, ag:52, int:5, per:38, wp:25, fel:1, inf:0 }),
      wounds: { value: 2, max: 2, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ awareness:"knows", dodge:"veteran", stealth:"veteran", survival:"knows" }),
      groupSkills: GSK([["operate","Aeronautica","veteran",72]]),
      notes: DNOTE("Иссушённый осколок разорванной Фурии. Дикий зверь, сбивается в стаи; другие демоны его игнорируют.",
        "<b>Дикое Вселение:</b> вселяется в трупы диких животных (предпочтительно). Ритуал Призыва Презреннейших на летающих хищниках призывает 1d5 Призраков за Успех.",
        "Таланты: Heightened Senses (Smell), Raptor (+1/2 кубика урона с Натиска с полёта).")
    },
    kit: [
      DTR("Bestial", "Звериный разум: не выполняет сложные приказы, действует инстинктивно."),
      DTR("Daemonic (1)", "×1 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:1}] }, 1),
      FEAR(1), DTR("Flyer (5)", "Полёт со скоростью 5.", {}, 5),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."),
      DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons (2)", "Смертельное естественное оружие (Когти.Р, Укус)."),
      Dw("Claws / Когти", { dmg:"1d5+3", type:"rending", pen:2, props:["reinforced","tearing"], special:"Считается ладонью." }),
      Dw("Bite / Укус", { dmg:"1d5+3", type:"rending", pen:2, props:["reinforced","tearing",{key:"crippling",rating:2}], special:"Атака головой (в борьбе)." }),
      DTAL("Heightened Senses (Smell)", "+10 к тестам на нюх."),
      DTAL("Raptor", "+1 или 2 кубика урона с Натиска с полёта."),
      DTAL("Дикое Вселение", "Вселяется в трупы диких животных (предпочтительно). Ритуал Призыва Презреннейших на летающих хищниках призывает 1d5 Призраков за Успех.", 3)
    ]
  },

  {
    name: "Фурия", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Неделимый", img: DIMG("Chaos"),
    prototypeToken: DTOKEN("Chaos"),
    system: {
      allegiance: "undivided", rank: "lesserNoPatron", form: "trueForm", instabilityRating: 2, isDaemon: true, isPsyker: false,
      portfolio: "гнев без патрона", size: 0,
      characteristics: CH({ ws:37, bs:15, s:32, t:35, ag:30, int:11, per:38, wp:27, fel:11, inf:7 }),
      wounds: { value: 15, max: 15, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ awareness:"knows", dodge:"veteran", survival:"knows" }),
      groupSkills: GSK([["operate","Aeronautica","veteran",50], ["linguistics","Low Gothic","knows",11], ["linguistics","True Tongue","knows",11]]),
      notes: DNOTE("Низший демон без патрона — презренный налётчик и разведчик демонических легионов.",
        "<b>Охотник Ужаса:</b> Unnatural Senses (50) засекает только существ под Шоком/Подавлением/Паникой/Запугиванием; атакуя таких — +20 к попаданию (не работает, когда Фурия сама напугана).",
        "<b>Угасание:</b> ниже 0 Ран от Варп/свящ./Выжигания/атак демона — 1d10, на 1 уничтожается вместо изгнания (Посвящённые иммунны).",
        "<b>Посвящение (опц.):</b> служа Богу, теряет Bestial и получает: С +10A+Alluring Presence; Н +10T+Mockery of Life; К +10S+Blood for the Blood God; Т +10W+Sorcerous Barrier. Как Миньон — средний.",
        "Таланты: Double Team, Heightened Senses (Smell), Raptor.")
    },
    kit: [
      DTR("Bestial", "Звериный разум; для боя без преимущества — тест Bestial."),
      DTR("Daemonic (2)", "×2 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:2}] }, 2),
      DTR("Daemonic Presence (5/5)", "Аура присутствия демона (радиус/эффект 5)."),
      FEAR(1), DTR("Flyer (6)", "Полёт со скоростью 6.", {}, 6),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."),
      DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Unnatural Senses (50)", "Чует существ под Шоком/Паникой/Запугиванием на 50 м."),
      DTR("Deadly Natural Weapons (1)", "Смертельное естественное оружие (Когти.Р, Укус)."),
      Dw("Claws / Когти", { dmg:"1d10+4", type:"rending", pen:1, props:["reinforced","tearing"], special:"Считается ладонью." }),
      Dw("Bite / Укус", { dmg:"1d10+4", type:"rending", pen:1, props:["reinforced","tearing",{key:"crippling",rating:2}], special:"Атака головой." }),
      DTAL("Double Team", "Ещё +10 за численное превосходство в рукопашной."),
      DTAL("Heightened Senses (Smell)", "+10 к тестам на нюх."),
      DTAL("Raptor", "+1 или 2 кубика урона с Натиска с полёта."),
      DTAL("Охотник Ужаса", "Unnatural Senses (50) засекает только существ под Шоком/Подавлением/Паникой/Запугиванием; атакуя таких — +20 к попаданию (не работает, когда Фурия сама напугана).", 3),
      DTAL("Угасание", "Ниже 0 Ран от Варп/свящ./Выжигания/атак демона — 1d10, на 1 уничтожается вместо изгнания (Посвящённые иммунны).", 3),
      DTAL("Посвящение (опц.)", "Служа Богу, теряет Bestial и получает: С +10A+Alluring Presence; Н +10T+Mockery of Life; К +10S+Blood for the Blood God; Т +10W+Sorcerous Barrier.", 3)
    ]
  },

  {
    name: "Катарт", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Неделимый", img: DIMG("Chaos"),
    prototypeToken: DTOKEN("Chaos"),
    system: {
      allegiance: "undivided", rank: "lesser", form: "trueForm", instabilityRating: 4, isDaemon: true, isPsyker: false,
      portfolio: "слепая вера и фанатизм", size: 0,
      characteristics: CH({ ws:45, bs:12, s:34, t:38, ag:48, int:18, per:21, wp:42, fel:21, inf:22 }),
      wounds: { value: 18, max: 18, critical: 0, firstAidUsed: false },
      fate: { value: 1, max: 1 },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ awareness:"knows", charm:"knows", deceive:"knows", dodge:"trained", parry:"trained" }),
      groupSkills: GSK([
        ["operate","Aeronautica","expert",78], ["scholasticLore","Imperial Creed","veteran",38],
        ["forbiddenLore","Daemons","knows",18], ["forbiddenLore","Heresy","veteran",38],
        ["linguistics","Chaos Glyphs","knows",18], ["linguistics","Low Gothic","knows",18], ["linguistics","True Tongue","knows",18]]),
      notes: DNOTE("Истинный демон Хаоса Неделимого, рождённый из слепой веры и фанатизма. Ангелоподобен в Истинной Форме; вселяясь — бескожее крылатое чудовище.",
        "<b>Мост Между Мирами:</b> в Реальности — аура истончения Завесы +2 радиусом 50 м (в Варпе — аура частичной реальности). Стаи суммируют до 1 км (20 демонов).",
        "<b>Правоверное Служение:</b> откликается лишь на зов истинно верующих; не-фанатики −50 на призыв/Владычество.",
        "<b>Сила Мученичества:</b> +кубик урона по фанатично верующим, но их атаки +кубик урона по демону.",
        "<b>Добровольное Вселение:</b> Одержимость сквозь Завесу, но только против сам приглашающих (цель всё равно делает встречный тест).",
        "<b>Возвышение (Мученик):</b> I→36, W→52, F→33, Раны→22 + один комплект: (WS+5,A+10,Dodge+20,Crippling Strike,Precise Blow,Sure Strike) / (WS+5,P+10,Parry+20,Counter-Attack,High Guard,Riposte) / (WS+5,S+10,Athletics,Crushing Blow,Blademaster) / (WS+5,F+10,Charm/Deceive,Double Team,Inspire Wrath,Mimic) / (W+5,F+10,Command,Bring It Down,Frontline Commander).",
        "Таланты: Ambidextrous, Blade Dancer, Bodyguard, Divine Protection (10% игнор варп-эффекта), Step Aside, Two-Weapon Wielder (Melee).")
    },
    kit: [
      DTR("Daemonic (4)", "×4 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:4}] }, 4),
      DTR("Unnatural S (2)", "Сверхъестественная Сила: +2 к S.b (бонусные Успехи).", { charBonuses:[{stat:"s",value:2}] }, 2),
      DTR("Daemonic Armament (3/4, Мечи)", "Формирует из Варпа волнистые клинки (Мечи)."),
      DTR("Daemonic Presence (10/10)", "Аура присутствия демона (радиус/эффект 10)."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(2), DTR("Flyer (7)", "Полёт со скоростью 7.", {}, 7),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Touched by the Fates (1)", "1 Очко Судьбы."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."),
      DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons (1)", "Смертельное естественное оружие (Когти)."),
      Dw("Claws / Когти (×2)", { dmg:"1d10+6", type:"rending", pen:1, props:["reinforced","tearing"], special:"Считается ладонью; парные." }),
      Dw("Bite / Укус", { dmg:"1d5+6", type:"rending", pen:1, props:["reinforced","tearing"], special:"Только в борьбе.", equipped:false }),
      Dw("Sword / Меч (×2)", { dmg:"1d10+8", type:"rending", pen:4, props:["reinforced","flexible"], special:"Волнистые клинки из Варпа; парные, Балансное, Мономолек. (2р, Об, Бл, Мх)." }),
      DTAL("Ambidextrous", "−10 штраф за 2 оружия; нет штрафа за левую руку."),
      DTAL("Blade Dancer", "−10 штраф за парные мечи."),
      DTAL("Bodyguard", "Может парировать атаки по союзникам."),
      DTAL("Divine Protection", "10% шанс проигнорировать любой варп-эффект."),
      DTAL("Step Aside", "+1 Реакция."),
      DTAL("Two-Weapon Wielder (Melee)", "Бой двумя оружиями со штрафом −20."),
      DTAL("Мост Между Мирами", "В Реальности — аура истончения Завесы +2 радиусом 50 м; стаи суммируют до 1 км (20 демонов).", 3),
      DTAL("Правоверное Служение", "Откликается лишь на зов истинно верующих; не-фанатики −50 на призыв/Владычество.", 3),
      DTAL("Сила Мученичества", "+кубик урона по фанатично верующим, но их атаки +кубик урона по демону.", 3),
      DTAL("Добровольное Вселение", "Одержимость сквозь Завесу, но только против сам приглашающих (цель всё равно делает встречный тест).", 3),
      DTAL("Возвышение (Мученик)", "I→36, W→52, F→33, Раны→22 + один комплект улучшений (WS/A/P/S/F + таланты).", 3)
    ]
  },

  // ══════════════════ ДЕМОНЫ ХАОСА — СЛААНЕШ ════════════════════════════════
  {
    name: "Демонетка", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Слаанеш", img: DIMG("Slaanesh"), prototypeToken: DTOKEN("Slaanesh"),
    system: {
      allegiance: "slaanesh", rank: "lesser", form: "trueForm", instabilityRating: 4, isDaemon: true, isPsyker: false,
      portfolio: "желание и избыток", size: 0,
      characteristics: CH({ ws:52, bs:30, s:38, t:44, ag:51, int:16, per:35, wp:36, fel:32, inf:22 }),
      wounds: { value: 18, max: 18, critical: 0, firstAidUsed: false }, fate: { value: 0, max: 0 },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ acrobatics:"veteran", athletics:"knows", awareness:"knows", charm:"trained", deceive:"knows", dodge:"trained", interrogate:"trained" }),
      groupSkills: GSK([["forbiddenLore","Daemons","trained",26], ["linguistics","Eldar","knows",16], ["linguistics","Low Gothic","knows",16], ["linguistics","True Tongue","knows",16], ["trade","Dancer","veteran",71]]),
      notes: DNOTE("Низший демон Слаанеш — стремительная танцовщица клинков, воплощение желания и избытка.",
        "<b>Возвышение (Соблазнительница):</b> I→34, W→48, F→44, Раны→22 + один из наборов улучшений (WS/A/BS/F + таланты).",
        "Музыкант: +20 всем Демонеткам отряда на Trade (Dancer).")
    },
    kit: [
      DTR("Alluring Presence", "Чарующая аура: все враги −10 на Избегания против атак демона."),
      DTR("Daemonic (4)", "×4 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:4}] }, 4),
      DTR("Unnatural A (2)", "Сверхъестественная Ловкость: +2 к A.b.", { charBonuses:[{stat:"ag",value:2}] }, 2),
      DTR("Daemonic Armament (Серебряный Дротик)", "Формирует оружие из Варпа."),
      DTR("Daemonic Presence (10/10)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("Digitigrade (2)", "Пальцеходящие ноги: +2 к прыжкам/бегу."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(2), DTR("Nimble (10)", "+10 к Уклонению."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Смертельное естественное оружие (Клешни, Клинки, Поцелуй, Пинок)."),
      Dw("Pincer Claws / Клешни (×2)", { dmg:"1d10+4", type:"rending", pen:3, props:[{key:"extreme",rating:8},"razorSharp","reinforced","tearing"], special:"Считается ладонью; парные." }),
      Dw("Piercing Blades / Пронзающие Клинки (×2)", { dmg:"1d10+6", type:"rending", pen:3, props:[{key:"crippling",rating:2},{key:"extreme",rating:8},"precise","reinforced"], special:"Парные (1-5)." }),
      Dw("Kick / Пинок", { dmg:"1d10+3", type:"rending", pen:2, props:["reinforced"], special:"Атака ногой.", equipped:false }),
      DTAL("Ambidextrous", "−10 штраф за 2 оружия; нет штрафа за левую руку."),
      DTAL("Flip", "Перекат вместо сбивания с ног."),
      DTAL("Hard Target", "−10 на стрельбу по персонажу при Беге и Натиске."),
      DTAL("Heightened Senses (All)", "+10 к тестам на все чувства."),
      DTAL("Pirouette", "Прыжок с пути несущегося вперёд врага."),
      DTAL("Step Aside", "+1 Реакция."),
      DTAL("Sure Strike", "−10 штраф за Избирательный удар или Размер."),
      DTAL("Swift Attack", "Приём с −10 на ½ Успехи попаданий."),
      DTAL("Two-Weapon Wielder (Melee)", "Бой двумя оружиями со штрафом −20."),
      DTAL("Возвышение (Соблазнительница)", "I→34, W→48, F→44, Раны→22 + один комплект улучшений.", 3)
    ]
  },

  // ══════════════════ ДЕМОНЫ ХАОСА — НУРГЛ ══════════════════════════════════
  {
    name: "Нурглинги", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Нургл", img: DIMG("Nurgle"), prototypeToken: DTOKEN("Nurgle"),
    system: {
      allegiance: "nurgle", rank: "minor", form: "trueForm", instabilityRating: 2, isDaemon: true, isPsyker: false,
      portfolio: "заразная орава", size: 0,
      characteristics: CH({ ws:25, bs:1, s:16, t:25, ag:25, int:16, per:16, wp:43, fel:15, inf:0 }),
      wounds: { value: 35, max: 35, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ awareness:"knows" }),
      groupSkills: GSK([["linguistics","True Tongue","knows",16]]),
      notes: DNOTE("Крошечные обжоры Нургла. Профиль — бурлящая масса размером с человека; берут числом.",
        "<b>Гниль Нургла:</b> выживший после непоглощ. урона от яда — после боя Т+10 или заражается Гнилью Нургла.",
        "<b>Одиночный Нурглинг:</b> Размер −2, SPD 0, 2 Раны, урон 1d5, без Экстрем. урона; теряет Fear и Swarm, W→25.",
        "Талант: Takedown.")
    },
    kit: [
      DTR("Daemonic (2)", "×2 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:2}] }, 2),
      FEAR(1), DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      DTR("Mockery of Life", "Раз в Раунд при падении ниже 0 Ран — Т+10, при Успехе остаться с 0. Иммунитет ко всем ядам."),
      DTR("Swarm (1d5)", "Рой: делится урон, поглощает атаки по площади."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Смертельное естественное оружие (Когти, Укус)."),
      Dw("Claws / Когти", { dmg:"1d10+2", type:"rending", pen:1, props:["reinforced",{key:"toxic",rating:3}], special:"Проб. 1d5+1 (переменное)." }),
      Dw("Bite / Укус", { dmg:"1d10+1", type:"rending", pen:1, props:["reinforced","tearing",{key:"toxic",rating:3}], special:"Проб. 1d5+1 (переменное)." }),
      DTAL("Takedown", "Оглушить неприцельно любым оружием."),
      DTAL("Гниль Нургла", "Выживший после непоглощ. урона от яда Нурглинга — после боя Т+10 или заражается Гнилью Нургла.", 3),
      DTAL("Одиночные Нурглинги", "Одиночный: Размер −2, SPD 0, 2 Раны, урон 1d5, без Экстрем. урона; теряет Fear и Swarm, W→25.", 3)
    ]
  },

  {
    name: "Чумонос", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Нургл", img: DIMG("Nurgle"), prototypeToken: DTOKEN("Nurgle"),
    system: {
      allegiance: "nurgle", rank: "lesser", form: "trueForm", instabilityRating: 5, isDaemon: true, isPsyker: false,
      portfolio: "отчаянье и упорство", size: 0,
      characteristics: CH({ ws:42, bs:32, s:43, t:56, ag:30, int:32, per:31, wp:36, fel:16, inf:22 }),
      wounds: { value: 22, max: 22, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ athletics:"knows", awareness:"trained", logic:"veteran", medicae:"expert", parry:"knows" }),
      groupSkills: GSK([["scholasticLore","Chymistry","trained",42], ["scholasticLore","Numerology","veteran",42], ["forbiddenLore","Daemons","trained",42], ["linguistics","Low Gothic","knows",32], ["linguistics","True Tongue","knows",32], ["trade","Chymist","veteran",52], ["trade","Musician","trained",26]]),
      notes: DNOTE("Рядовой Нургла — неотвратимый, упорный, заражающий отчаяньем. Медлителен, но невыносимо стоек.",
        "<b>Зараженные Раны:</b> провал против Bane/Toxic и выживание (или первая помощь) → после боя Т+10 или Гниль Нургла (+30 при покровительстве Нургла).",
        "<b>Стойкость:</b> получив непоглощ. урон — Реакция + Т+30, снизить урон от этого персонажа в этот Ход.",
        "<b>Возвышение (Измученный):</b> I→44, W→48, F→34, Раны→26 + набор улучшений. Кавалерия (Чумной Трутень) на Гнильной Мухе.",
        "Таланты: Counter Attack, Crippling Strike, Foresight, Hunker Down, Iron Jaw, Resistance (Psychic Powers), Steady Footwork, Tenacity, Total Recall.")
    },
    kit: [
      DTR("Daemonic (5)", "×5 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:5}] }, 5),
      DTR("Unnatural S (1)", "Сверхъестественная Сила: +1 к S.b.", { charBonuses:[{stat:"s",value:1}] }, 1),
      DTR("Daemonic Armament (Чумной Меч)", "Формирует оружие из Варпа."),
      DTR("Daemonic Presence (10/10)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(2), DTR("Mockery of Life", "Раз в Раунд при падении ниже 0 Ран — Т+10, при Успехе остаться с 0. Иммунитет ко всем ядам."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Смертельное естественное оружие (Гниющий Рог, Когти, Укус)."),
      Dw("Claws / Когти", { dmg:"1d10+6", type:"rending", pen:1, props:["primitive","reinforced",{key:"toxic",rating:2}], special:"Считается ладонью." }),
      Dw("Bite / Укус", { dmg:"1d5+6", type:"rending", pen:1, props:[{key:"bane",rating:2},"primitive","reinforced"], special:"Только в борьбе.", equipped:false }),
      Dw("Rotting Horn / Гниющий Рог", { dmg:"2d10+6", type:"rending", pen:1, props:[{key:"bane",rating:2},"piercing","reinforced"], special:"Только с натиска; отламывается в ране (отрастает после боя).", equipped:false }),
      Dw("Plague Sword / Чумной Меч", { dmg:"1d10+8", type:"rending", pen:4, props:[{key:"felling",rating:4},"reinforced",{key:"toxic",rating:2}], special:"Балансное (2-4)." }),
      Dw("Bile Spit / Желчный Плевок", { cls:"ranged", wtype:"Пистолет", rng:"5м", dmg:"1d10+5", type:"chemical", pen:2, rofS:true, props:[{key:"corrosive",rating:2},{key:"toxic",rating:2},"recharge"], recharge:true, special:"", equipped:false }),
      DTAL("Counter Attack", "Атака с −10 после парирования."),
      DTAL("Crippling Strike", "+2 Отрицательных Ран в рукопашной."),
      DTAL("Foresight", "5 минут на раздумья дают +10 на тест I."),
      DTAL("Hunker Down", "Удвоенная эффективность укрытий."),
      DTAL("Iron Jaw", "Т+0, чтобы игнорировать Оглушение."),
      DTAL("Resistance (Psychic Powers)", "+10 на тесты сопротивления психосилам."),
      DTAL("Steady Footwork", "Нет штрафов к WS от ландшафта."),
      DTAL("Tenacity", "Второй шанс на единственную атаку в Ход."),
      DTAL("Total Recall", "Вспоминает точные детали без теста."),
      DTAL("Зараженные Раны", "Провал против Bane/Toxic и выживание (или первая помощь) → после боя Т+10 или Гниль Нургла (+30 при покровительстве Нургла).", 3),
      DTAL("Стойкость", "Получив непоглощ. урон — Реакция + Т+30, снизить урон от этого персонажа в этот Ход.", 3),
      DTAL("Возвышение (Измученный)", "I→44, W→48, F→34, Раны→26 + набор улучшений. Кавалерия (Чумной Трутень) на Гнильной Мухе.", 3)
    ]
  },

  // ══════════════════ ДЕМОНЫ ХАОСА — КХОРН ══════════════════════════════════
  {
    name: "Кровопускатель", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Кхорн", img: DIMG("Khorne"), prototypeToken: DTOKEN("Khorne"),
    system: {
      allegiance: "khorne", rank: "lesser", form: "trueForm", instabilityRating: 4, isDaemon: true, isPsyker: false,
      portfolio: "ярость и кровопролитие", size: 0,
      characteristics: CH({ ws:50, bs:40, s:42, t:46, ag:40, int:30, per:30, wp:36, fel:14, inf:22 }),
      wounds: { value: 20, max: 20, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ athletics:"trained", awareness:"knows", dodge:"knows", intimidate:"trained", parry:"veteran", survival:"knows" }),
      groupSkills: GSK([["commonLore","War","expert",60], ["forbiddenLore","Daemons","trained",40], ["linguistics","Low Gothic","knows",30], ["linguistics","True Tongue","knows",30], ["trade","Armourer","trained",40], ["trade","Weaponsmith","trained",40]]),
      notes: DNOTE("Рядовой Кхорна — прямолинейная ярость и мастерство клинка. Бросается в рукопашную и убивает.",
        "<b>Знания Орудий Гнева:</b> владеет всяким оружием, отнявшим жизнь; авто-опознание оружия и боевых машин.",
        "<b>Жажда Крови:</b> все в 8 м перебрасывают успешные тесты против Кровотечения.",
        "<b>Возвышение (Кровожнец):</b> I→42, W→48, F→32, Раны→24 + набор улучшений. Кавалерия (Кровокрушитель) на Джаггернауте.",
        "Таланты: Battle Rage, Berserk Charge, Blademaster, Crushing Blow, Fire in Blood, Frenzy, Furious Assault, Reckless Charge, Swift Attack.")
    },
    kit: [
      DTR("Blood for the Blood God", "Убив живого/изгнав демона — +2 к рукопашному урону (склад. до +8) до конца боя; кровь/трупы — не трудный ландшафт."),
      DTR("Daemonic (4)", "×4 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:4}] }, 4),
      DTR("Unnatural S (4)", "Сверхъестественная Сила: +4 к S.b.", { charBonuses:[{stat:"s",value:4}] }, 4),
      DTR("Daemonic Armament (Адский Клинок)", "Формирует оружие из Варпа."),
      DTR("Daemonic Presence (10/10)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("Digitigrade (1)", "Пальцеходящие ноги."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(2), DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Смертельное естественное оружие (Рога, Когти, Укус, Пинок)."),
      Dw("Claws / Когти", { dmg:"1d10+12", type:"rending", pen:0, props:[{key:"challenge",rating:0},{key:"extreme",rating:8},"primitive","reinforced"], special:"Считается ладонью." }),
      Dw("Kick / Пинок", { dmg:"1d10+8", type:"rending", pen:0, props:["primitive","reinforced"], special:"Атака ногой.", equipped:false }),
      Dw("Bite / Укус", { dmg:"1d10+12", type:"rending", pen:1, props:["primitive","tearing","reinforced"], special:"Только в борьбе.", equipped:false }),
      Dw("Horns / Рога", { dmg:"2d10+12", type:"rending", pen:1, props:[{key:"challenge",rating:0},"reinforced"], special:"Только с натиска; −30 на атаки руками в этот Ход.", equipped:false }),
      Dw("Hell Blade / Адский Клинок", { dmg:"1d10+14", type:"rending", pen:10, props:[{key:"extreme",rating:8},"powerField"], special:"Основное оружие (2-5)." }),
      DTAL("Battle Rage", "Может парировать в Ярости."),
      DTAL("Berserk Charge", "+10 к атаке с Натиска."),
      DTAL("Blademaster", "Переброс попаданий клинковым оружием."),
      DTAL("Crushing Blow", "+½ WS.b к рукопашному урону."),
      DTAL("Fire in Blood", "Вход в Ярость за полудействие."),
      DTAL("Frenzy", "Может войти в Ярость: +10 WS/S/W, −20 BS/I/F."),
      DTAL("Furious Assault", "Доп. атака за 1 Реакцию после Полной Атаки."),
      DTAL("Reckless Charge", "Полная атака с Натиска."),
      DTAL("Swift Attack", "Приём с −10 на ½ Успехи попаданий."),
      DTAL("Знания Орудий Гнева", "Владеет всяким оружием, отнявшим жизнь; авто-опознание оружия и боевых машин.", 3),
      DTAL("Жажда Крови", "Все в 8 м перебрасывают успешные тесты против Кровотечения.", 3),
      DTAL("Возвышение (Кровожнец)", "I→42, W→48, F→32, Раны→24 + набор улучшений. Кавалерия (Кровокрушитель) на Джаггернауте.", 3)
    ]
  },

  // ══════════════════ ДЕМОНЫ ХАОСА — ТЗИНЧ ══════════════════════════════════
  {
    name: "Серный Ужас", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Тзинч", img: DIMG("Tzeentch"), prototypeToken: DTOKEN("Tzeentch"),
    system: {
      allegiance: "tzeentch", rank: "minor", form: "trueForm", instabilityRating: 2, isDaemon: true, isPsyker: false,
      portfolio: "остаток надежды", size: -2,
      characteristics: CH({ ws:18, bs:31, s:16, t:23, ag:30, int:21, per:25, wp:32, fel:21, inf:0 }),
      wounds: { value: 3, max: 3, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ awareness:"knows" }),
      groupSkills: GSK([["linguistics","True Tongue","knows",21]]),
      notes: DNOTE("Мельчайший демон Тзинча — остаток убитого Синего Ужаса. Злобный, мстительный, самоубийственный.",
        "<b>Пылающее Тело:</b> иммунен к E(Fl) и Горению; в Борьбе — цель в конце Хода получает 1d5+5 E(Fl), Pen 4, Flame.",
        "<b>Серная Вонь:</b> все без герметичной брони/респиратора в 3 м — −5 WS/BS/A (−10 против Орды 20+).",
        "<b>Самосожжение:</b> рукопашная атака +20; при попадании цель получает 2d10+4 E(Fl), Pen 1, Flame (можно Избегать), а Ужас изгоняется.",
        "Талант: Hip Shooting. Щит 1-35 (Sorcerous Barrier).")
    },
    kit: [
      DTR("Daemonic (2)", "×2 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:2}] }, 2),
      DTR("Unnatural A (1)", "Сверхъестественная Ловкость: +1 к A.b.", { charBonuses:[{stat:"ag",value:1}] }, 1),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      DTR("Quadruped (0)", "Четвероногое."),
      DTR("Sorcerous Barrier", "Колдовской щит-купол 1-35, вкл/выкл свободным действием."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Смертельное естественное оружие (Укус)."),
      Dw("Bite / Укус", { dmg:"1d5+2", type:"energy", pen:1, props:["reinforced","tearing","flame"], special:"E(Fl); атака головой." }),
      Dw("Brimstone Fire / Серное Пламя", { cls:"ranged", wtype:"Пистолет", rng:"30м", dmg:"1d10+2", type:"energy", pen:4, rofS:true, rofSemi:3, props:["flame"], special:"E(Fl); ∞ заряд." }),
      DTAL("Hip Shooting", "Стрельба на полном ходу."),
      DTAL("Пылающее Тело", "Иммунен к E(Fl) и Горению; в Борьбе — цель в конце Хода получает 1d5+5 E(Fl), Pen 4, Flame.", 3),
      DTAL("Серная Вонь", "Все без герметичной брони/респиратора в 3 м — −5 WS/BS/A (−10 против Орды 20+).", 3),
      DTAL("Самосожжение", "Рукопашная атака +20; при попадании цель получает 2d10+4 E(Fl), Pen 1, Flame (можно Избегать), а Ужас изгоняется.", 3)
    ]
  },

  {
    name: "Розовый Ужас", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Тзинч", img: DIMG("Tzeentch"), prototypeToken: DTOKEN("Tzeentch"),
    system: {
      allegiance: "tzeentch", rank: "lesser", form: "trueForm", instabilityRating: 3, isDaemon: true, isPsyker: false,
      portfolio: "перемены и колдовство", size: 0,
      characteristics: CH({ ws:23, bs:45, s:35, t:33, ag:30, int:30, per:35, wp:38, fel:22, inf:22 }),
      wounds: { value: 18, max: 18, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ awareness:"veteran", charm:"knows", deceive:"veteran", dodge:"knows", scrutiny:"trained" }),
      groupSkills: GSK([["scholasticLore","Occult","trained",40], ["forbiddenLore","Daemons","veteran",50], ["forbiddenLore","Psykers","trained",40], ["forbiddenLore","Warp","trained",40], ["linguistics","Low Gothic","knows",30], ["linguistics","True Tongue","knows",30]]),
      notes: DNOTE("Рядовой Тзинча — колдун-стрелок, мечущий сгустки мутирующего пламени; держится на дистанции.",
        "<b>Непостоянство:</b> 2–5 рук в любой момент (атакует одной); руки всегда «свободны» в Борьбе.",
        "<b>Разделение:</b> ниже 0 Ран (кроме свящ./варп/выжигания/нестабильности) → разваливается на 2 Синих Ужаса.",
        "<b>Возвышение (Радужный Ужас):</b> BS→55, I→42, W→50, F→34, Раны→22, Command+10, Warp Gifted (5) с 2 психосилами.",
        "Таланты: Covering Fire, Crack Shot, Hip Shooting, Mimic, Paranoia, Target Selection, Trick Shooter. Щит 1-35.")
    },
    kit: [
      DTR("Daemonic (3)", "×3 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:3}] }, 3),
      DTR("Daemonic Armament (Атам)", "Формирует оружие из Варпа."),
      DTR("Daemonic Presence (10/10)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(2), DTR("Sorcerous Barrier", "Колдовской щит-купол 1-35, вкл/выкл свободным действием."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons (2)", "Смертельное естественное оружие (Когти, Укус)."),
      Dw("Claws / Когти", { dmg:"1d10+5", type:"rending", pen:2, props:["reinforced"], special:"Считается ладонью." }),
      Dw("Bite / Укус", { dmg:"1d10+5", type:"rending", pen:2, props:["tearing","reinforced"], special:"Атака головой.", equipped:false }),
      Dw("Athame / Атам", { dmg:"1d5+4", type:"rending", pen:1, props:["precise","warpWeapon"], special:"Нож (1-2)." }),
      Dw("Pink Fire / Розовое Пламя", { cls:"ranged", wtype:"Пистолет", rng:"50м", dmg:"1d10+10", type:"energy", pen:6, rofS:true, rofSemi:3, props:[{key:"change",rating:9}], special:"Попадания считаются как психосила; ∞ заряд." }),
      DTAL("Covering Fire", "Стрельба во время выхода из рукопашной."),
      DTAL("Crack Shot", "+2 Отрицательных Ран в стрельбе."),
      DTAL("Hip Shooting", "Стрельба на полном ходу."),
      DTAL("Mimic", "Имитирует чужой голос."),
      DTAL("Paranoia", "+2 к Инициативе; всегда настороже."),
      DTAL("Target Selection", "Нет штрафа за стрельбу в рукопашную."),
      DTAL("Trick Shooter", "+30 на трюкаческие выстрелы."),
      DTAL("Непостоянство", "2–5 рук в любой момент (атакует одной); руки всегда «свободны» в Борьбе.", 3),
      DTAL("Разделение", "Ниже 0 Ран (кроме свящ./варп/выжигания/нестабильности) → разваливается на 2 Синих Ужаса.", 3),
      DTAL("Возвышение (Радужный Ужас)", "BS→55, I→42, W→50, F→34, Раны→22, Command+10, Warp Gifted (5) с 2 психосилами.", 3)
    ]
  },

  {
    name: "Синий Ужас", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Тзинч", img: DIMG("Tzeentch"), prototypeToken: DTOKEN("Tzeentch"),
    system: {
      allegiance: "tzeentch", rank: "minor", form: "trueForm", instabilityRating: 2, isDaemon: true, isPsyker: false,
      portfolio: "уныние (осколок Розового)", size: -1,
      characteristics: CH({ ws:21, bs:40, s:20, t:33, ag:30, int:25, per:35, wp:34, fel:22, inf:9 }),
      wounds: { value: 9, max: 9, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ awareness:"veteran", deceive:"veteran", scrutiny:"trained" }),
      groupSkills: GSK([["scholasticLore","Occult","trained",40], ["forbiddenLore","Daemons","veteran",50], ["linguistics","Low Gothic","knows",30], ["linguistics","True Tongue","knows",30]]),
      notes: DNOTE("Осколок убитого Розового Ужаса — унылая, но всё ещё опасная стрелковая версия. Ниже 0 Ран разваливается на 2 Серных Ужаса.",
        "Наследует навыки/таланты Розового Ужаса; характеристики и оружие слабее. Щит 1-35.")
    },
    kit: [
      DTR("Daemonic (2)", "×2 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:2}] }, 2),
      DTR("Unnatural A (1)", "Сверхъестественная Ловкость: +1 к A.b.", { charBonuses:[{stat:"ag",value:1}] }, 1),
      DTR("Daemonic Armament (Атам)", "Формирует оружие из Варпа."),
      DTR("Daemonic Presence (5/10)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(1), DTR("Sorcerous Barrier", "Колдовской щит-купол 1-35."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      Dw("Claws / Когти", { dmg:"1d10+3", type:"rending", pen:1, props:["primitive","reinforced"], special:"Считается ладонью." }),
      Dw("Bite / Укус", { dmg:"1d10+3", type:"rending", pen:1, props:["primitive","tearing","reinforced"], special:"Атака головой.", equipped:false }),
      Dw("Athame / Атам", { dmg:"1d5+3", type:"rending", pen:1, props:["precise","warpWeapon"], special:"Нож (1-2)." }),
      Dw("Blue Fire / Синее Пламя", { cls:"ranged", wtype:"Пистолет", rng:"40м", dmg:"1d10+6", type:"energy", pen:4, rofS:true, rofSemi:3, props:[{key:"change",rating:5}], special:"Попадания считаются как психосила; ∞ заряд." }),
      DTAL("Covering Fire", "Стрельба во время выхода из рукопашной."),
      DTAL("Crack Shot", "+2 Отрицательных Ран в стрельбе."),
      DTAL("Hip Shooting", "Стрельба на полном ходу."),
      DTAL("Mimic", "Имитирует чужой голос."),
      DTAL("Paranoia", "+2 к Инициативе; всегда настороже."),
      DTAL("Target Selection", "Нет штрафа за стрельбу в рукопашную."),
      DTAL("Trick Shooter", "+30 на трюкаческие выстрелы."),
      DTAL("Разделение", "Ниже 0 Ран → разваливается на 2 Серных Ужаса.", 3)
    ]
  },

  // ══════════════════ НИЗШИЕ ДЕМОНИЧЕСКИЕ ЗВЕРИ ═════════════════════════════
  {
    name: "Скакун Слаанеш", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Слаанеш", img: DIMG("Slaanesh"), prototypeToken: DTOKEN("Slaanesh"),
    system: {
      allegiance: "slaanesh", rank: "beast", form: "trueForm", instabilityRating: 3, isDaemon: true, isPsyker: false,
      portfolio: "скорость и грация", size: 1,
      characteristics: CH({ ws:32, bs:0, s:35, t:32, ag:67, int:4, per:53, wp:33, fel:6, inf:13 }),
      wounds: { value: 16, max: 16, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ acrobatics:"veteran", athletics:"veteran", awareness:"expert", dodge:"trained", survival:"knows" }),
      notes: DNOTE("Низший демонический зверь Слаанеш — неразумный скакун невозможной грации и скорости. Лёгкая кавалерия (Искатели — Демонетки верхом).",
        "<b>Скакун:</b> игнорирует вес всадника (Размер ≤1); всадник управляет без рук, без штрафов скорости на стрельбу, доступ к чувствам Скакуна, +1 Реакция на Избегание за Скакуна.",
        "<b>Орудия Всадника:</b> возвышенные Демонетки/Герольды/чемпионы получают Daemonic Armament (Адская Плеть: Кнут 5-7, 1d10+5 R, Pen 4, Crippling(3)/Flexible/Imprecise/Razor Sharp/Reinforced/Tearing).",
        "<b>Возвышение:</b> I→12, W→45, F→14, Раны→21 + навыки/таланты + Natural Armour (2).")
    },
    kit: [
      DTR("Alluring Presence", "Все враги −10 на Избегания против атак демона."),
      DTR("Daemonic (3)", "×3 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:3}] }, 3),
      DTR("Unnatural A (6)", "Сверхъестественная Ловкость: +6 к A.b.", { charBonuses:[{stat:"ag",value:6}] }, 6),
      DTR("Daemonic Presence (5/10)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("Digitigrade (6)", "Пальцеходящие ноги: бонус к прыжкам/бегу."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(1), DTR("Maneuverable", "Не получает штрафов за резкие манёвры."),
      DTR("Sonar Sense", "Ощущает окружение эхолокацией."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("War-Trained", "Приучен к бою, не пугается сражений."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Смертельное естественное оружие (Когти, Хвост, Хлещущий Язык)."),
      Dw("Claws / Когти", { dmg:"1d10+5", type:"rending", pen:2, props:["razorSharp","reinforced"], special:"Атака лапами (1-2)." }),
      Dw("Tail / Хвост", { dmg:"1d10+5", type:"rending", pen:2, props:["flexible","precise","reinforced"], special:"3-6.", equipped:false }),
      Dw("Lashing Tongue / Хлещущий Язык", { dmg:"1d5+5", type:"rending", pen:2, props:[{key:"dreaming",rating:-2},"flexible","precise","reinforced",{key:"snare",rating:0}], special:"Независимая атака (5-7); при Snare удерживает цель.", equipped:false }),
      DTAL("Assassin Strike", "Acrobatics+0 для отскока после атаки."),
      DTAL("Hard Target", "−10 на стрельбу по персонажу при Беге и Натиске."),
      DTAL("Heightened Senses (All)", "+10 к тестам на все чувства."),
      DTAL("Jumper", "Прыжки за полудействие."),
      DTAL("Leap Up", "Встать за свободное действие."),
      DTAL("Pirouette", "Прыжок с пути несущегося вперёд врага."),
      DTAL("Preternatural Speed", "Натиск со скоростью Бега."),
      DTAL("Step Aside", "+1 Реакция."),
      DTAL("Изящный Аллюр", "Игнорирует Трудный Ландшафт, не оставляет следов, может двигаться по жидкостям/сыпучему.", 3),
      DTAL("Мультиатака", "Свободный Скакун — 2 атаки в Ход (когти+хвост или когти+язык), как Multiple Arms (4).", 3)
    ]
  },

  {
    name: "Гнильная Муха", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Нургл", img: DIMG("Nurgle"), prototypeToken: DTOKEN("Nurgle"),
    system: {
      allegiance: "nurgle", rank: "beast", form: "trueForm", instabilityRating: 5, isDaemon: true, isPsyker: false,
      portfolio: "злоба и ненависть к жизни", size: 1,
      characteristics: CH({ ws:29, bs:0, s:42, t:57, ag:36, int:6, per:45, wp:33, fel:1, inf:13 }),
      wounds: { value: 20, max: 20, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ athletics:"veteran", awareness:"trained", dodge:"knows", survival:"knows" }),
      groupSkills: GSK([["operate","Aeronautica","veteran",56]]),
      notes: DNOTE("Низший зверь Нургла — агрессивная летающая тварь, вылупляется тройкой из Твари Нургла. Воздушная кавалерия (Чумные Трутни).",
        "<b>Скакун:</b> несёт всадника Размером 0 весом до 675 кг; всадник передаёт Мухе таланты группы Стойкость и трейт «Стойкость» Чумоноса, +1 Реакция на «Стойкость».",
        "<b>Мертвые Головы:</b> из брюха достаются Моровые Гранаты (∞ запас; вынутая растекается через 3 Раунда) — естественное оружие демона.",
        "<b>Орудия Всадника:</b> Daemonic Armament (Чумное Лассо: 5-7, 1d10+1 C, Bane(3)/Flexible/Imprecise/Reinforced/Snare(1); можно как винтовку Rng 7м).",
        "<b>Возвышение:</b> WS→34, I→12, W→45, F→14, Раны→25 + навыки/таланты.")
    },
    kit: [
      DTR("Daemonic (5)", "×5 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:5}] }, 5),
      DTR("Unnatural S (2)", "Сверхъестественная Сила: +2 к S.b.", { charBonuses:[{stat:"s",value:2}] }, 2),
      DTR("Natural Armour (4)", "Хитиновый панцирь: 4 брони по всем локациям.", { armourAll:4 }, 4),
      DTR("Daemonic Presence (5/10)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("Flyer (10)", "Полёт со скоростью 10.", {}, 10),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(1), DTR("Mockery of Life", "Раз в Раунд при падении ниже 0 Ран — Т+10, при Успехе остаться с 0. Иммунитет ко всем ядам."),
      DTR("Multiple Arms (6)", "Шесть лапок: удерживает до 3 целей."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("War-Trained", "Приучен к бою."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Смертельное естественное оружие (Хоботок)."),
      Dw("Tenons / Лапки (×3)", { dmg:"1d5+5", type:"rending", pen:1, props:["primitive","reinforced"], special:"Независимая атака (0-2); Захват." }),
      Dw("Proboscis / Хоботок", { dmg:"1d10+6", type:"chemical", pen:3, props:[{key:"bane",rating:3},{key:"toxic",rating:3},"reinforced"], special:"Только в борьбе.", equipped:false }),
      DTAL("Combat Sense", "Использует P.b для Инициативы."),
      DTAL("Berserk Charge", "+10 к атаке с Натиска."),
      DTAL("Hatred (Живые существа)", "+10 на рукопашные атаки по живым существам."),
      DTAL("Meat Shield", "Использует жертв Захвата как щит."),
      DTAL("Reposition", "Полудвижение в начале боя."),
      DTAL("Sentry", "Преимущество на пассивную Awareness."),
      DTAL("Tenacity", "Второй шанс на единственную атаку в Ход."),
      DTAL("Wrestler", "Переброс тестов на Борьбу."),
      DTAL("Мертвые Головы", "∞ запас Моровых Гранат из брюха (естественное оружие); вынутая растекается через 3 Раунда.", 3),
      DTAL("Стоячий Воздух", "Опирается крыльями на воздух как на скалу — плавный полёт без штрафов на атаки всадника.", 3),
      DTAL("Мультиатака", "Атакует только одной парой лапок в Ход; лишние пары держат до 3 целей.", 3)
    ]
  },

  {
    name: "Гончая Плоти", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Кхорн", img: DIMG("Khorne"), prototypeToken: DTOKEN("Khorne"),
    system: {
      allegiance: "khorne", rank: "beast", form: "trueForm", instabilityRating: 4, isDaemon: true, isPsyker: false,
      portfolio: "презрение к колдунам и трусам", size: 1,
      characteristics: CH({ ws:49, bs:0, s:45, t:40, ag:38, int:15, per:60, wp:40, fel:1, inf:13 }),
      wounds: { value: 18, max: 18, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ acrobatics:"trained", athletics:"veteran", awareness:"expert", dodge:"trained", stealth:"knows", survival:"veteran" }),
      groupSkills: GSK([["forbiddenLore","Psykers","expert",45]]),
      notes: DNOTE("Низший зверь Кхорна — охотничий пёс, гроза колдунов и трусов. Служит лишь командирам, лично победившим всю стаю.",
        "<b>Ошейник Кхорна:</b> −30 на психотесты в 16 м; +30 на сопротивление психосилам; оружие со свойством Force теряет Force при попадании по Гончей.",
        "<b>Охотник за Колдунами:</b> переброс атак по целям, что манифестировали/поддерживали психосилы в этом бою; чует псайкеров/чернокнижников (в т.ч. по старым следам).",
        "<b>Скакун (для смертных):</b> несёт Размер ≤1 весом до 1354 кг, удваивает штрафы скорости; всадник получает защиту Ошейника.",
        "<b>Возвышение (Гончая Крови):</b> WS→54, I→21, W→52, F→14, Раны→21 + навыки/таланты.")
    },
    kit: [
      DTR("Blood for the Blood God", "Убив живого/изгнав демона — +2 к рукопашному урону (склад. до +8) до конца боя; кровь/трупы — не трудный ландшафт."),
      DTR("Daemonic (4)", "×4 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:4}] }, 4),
      DTR("Unnatural S (4)", "Сверхъестественная Сила: +4 к S.b.", { charBonuses:[{stat:"s",value:4}] }, 4),
      DTR("Natural Armour (4)", "Чешуя: 4 брони по всем локациям.", { armourAll:4 }, 4),
      DTR("Daemonic Presence (10/10)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("Quadruped (0)", "Четвероногое."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(2), DTR("Unnatural Senses (30)", "Сверхчутьё на 30 м (чует псайкеров)."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Смертельное естественное оружие (Когти, Укус)."),
      Dw("Claws / Когти", { dmg:"1d10+12", type:"rending", pen:2, props:["reinforced"], special:"Атака лапами (0-2); независимая; Захват." }),
      Dw("Bite / Укус", { dmg:"1d10+12", type:"rending", pen:2, props:[{key:"challenge",rating:0},"flame","reinforced","sanctified","tearing"], special:"", equipped:false }),
      Dw("Tail / Хвост", { dmg:"1d10+8", type:"rending", pen:2, props:[{key:"challenge",rating:2},"cheapShot","reinforced","tearing"], special:"За Реакцию (0-4).", equipped:false }),
      DTAL("Berserk Charge", "+10 к атаке с Натиска."),
      DTAL("Crushing Blow", "+½ WS.b к рукопашному урону."),
      DTAL("Double Team", "Ещё +10 за численное превосходство."),
      DTAL("Fire in Blood", "Вход в Ярость за полудействие."),
      DTAL("Frenzy", "Может войти в Ярость: +10 WS/S/W, −20 BS/I/F."),
      DTAL("Hatred (Псайкеры, Трусы)", "+10 на атаки по псайкерам и убегающим."),
      DTAL("Hard Target", "−10 на стрельбу по персонажу при Беге и Натиске."),
      DTAL("Pin Down", "Прижать лежащего врага своим весом."),
      DTAL("Pounce", "Повалить после успешного Захвата с Натиска."),
      DTAL("Ошейник Кхорна", "−30 на психотесты в 16 м; +30 на сопротивление психосилам; Force-оружие теряет Force при попадании по Гончей.", 3),
      DTAL("Охотник за Колдунами", "Переброс атак по целям, что колдовали в этом бою; чует псайкеров даже по старым следам.", 3)
    ]
  },

  {
    name: "Крикун", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Тзинч", img: DIMG("Tzeentch"), prototypeToken: DTOKEN("Tzeentch"),
    system: {
      allegiance: "tzeentch", rank: "beast", form: "trueForm", instabilityRating: 4, isDaemon: true, isPsyker: false,
      portfolio: "разрушение", size: 1,
      characteristics: CH({ ws:27, bs:0, s:45, t:45, ag:50, int:3, per:43, wp:40, fel:1, inf:13 }),
      wounds: { value: 27, max: 27, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ awareness:"veteran", dodge:"trained" }),
      groupSkills: GSK([["operate","Aeronautica","trained",60]]),
      notes: DNOTE("Низший зверь Тзинча — небесный разрушитель, прогрызающий керамит и адамантий варп-пастью. Живучая приманка в легионах Тзинча.",
        "<b>Скакун (для смертных):</b> плохой скакун; несёт Размер 0 весом до 112 кг; трейты Stand и Unruly; выпавший всадник получает атаку шипами.",
        "<b>Возвышение:</b> Крикуны единственные из зверей не возвышаются (слишком бездумны).")
    },
    kit: [
      DTR("Daemonic (4)", "×4 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:4}] }, 4),
      DTR("Daemonic Presence (5/10)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(1), DTR("Flyer (12)", "Полёт со скоростью 12.", {}, 12),
      DTR("Sorcerous Barrier", "Колдовской щит-купол 1-35, вкл/выкл свободным действием."),
      DTR("Unnatural Senses (81)", "Сверхчутьё на 81 м (Чутьё Структуры)."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Смертельное естественное оружие (Варп-Пасть, Шипы)."),
      Dw("Spikes / Шипы", { dmg:"1d10+6", type:"rending", pen:4, props:["tearing","razorSharp","reinforced"], special:"0-3." }),
      Dw("Warp-Maw / Варп-Пасть", { dmg:"2d10+9", type:"energy", pen:12, props:[{key:"change",rating:12},{key:"felling",rating:3},"powerField"], special:"Прогрызает материю; укус.", equipped:false }),
      DTAL("Hard Target", "−10 на стрельбу по персонажу при Беге и Натиске."),
      DTAL("Neural Triggers", "Паралич вместо контроля разума или тела."),
      DTAL("Paranoia", "+2 к Инициативе; всегда настороже."),
      DTAL("Sprint", "Полн. Движение — SPD×3, Бег — SPD×12."),
      DTAL("Sure Strike", "−10 штраф за Избирательный удар или Размер."),
      DTAL("Вопль", "Постоянно кричит, не может молчать даже по приказу.", 3),
      DTAL("Имматериальные Ветра", "При Беге/Натиске/Верховой Атаке становится нематериальным (Immaterial) — проходит сквозь препятствия и атаки.", 3),
      DTAL("Терзающий Нырок", "Может совершать Верховую Атаку шипами самостоятельно (+20).", 3),
      DTAL("Чутьё Структуры", "Находит слабые места; против Размера 3+ — Избирательная атака пастью −20 наносит +2d10 урона.", 3)
    ]
  },

  // ══════════════════ ТРАНСФОРМИРОВАННЫЕ СКАКУНЫ ════════════════════════════
  {
    name: "Паланкин Нургла", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Нургл", img: DIMG("Nurgle"), prototypeToken: DTOKEN("Nurgle"),
    system: {
      allegiance: "nurgle", rank: "beast", form: "trueForm", instabilityRating: 4, isDaemon: true, isPsyker: false,
      portfolio: "гнилой трон роя", size: 2,
      characteristics: CH({ ws:32, bs:0, s:30, t:63, ag:32, int:16, per:16, wp:43, fel:15, inf:0 }),
      wounds: { value: 35, max: 35, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ athletics:"trained", awareness:"trained", dodge:"knows", survival:"knows" }),
      groupSkills: GSK([["linguistics","True Tongue","knows",16]]),
      notes: DNOTE("Возвышенный рой Нурглингов с троном из гниющего дерева. Медлителен, но прочен и стремительно регенерирует; лучший скакун Нургла для смертных (дар «Рыцарь Нургла»).",
        "<b>Гниющий Трон:</b> всадник получает не деградирующее укрытие AP 7 с задней арки 180°. Оседлать/спешиться — только с передней 90°.",
        "<b>Симбиотическое Восстановление:</b> использует Т всадника для Regeneration; всадник за полудействие поглощает Раны Паланкина (до 3d5), снимая Кровотечение/Горение/Crippling/Piercing (5 Ран) и Усталость (2 Раны/пункт).",
        "<b>Нурглинги-Оруженосцы:</b> хранят снаряжение всадника, считаются 2 ассистентами при надевании брони.",
        "<b>Возвышение:</b> нет; вместо этого +3 к макс. Ран за каждый пункт Inf.b всадника (теряются при спешивании).")
    },
    kit: [
      DTR("Daemonic (4)", "×4 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:4}] }, 4),
      DTR("Natural Armour (7)", "Гниющий Трон: 7 брони по всем локациям.", { armourAll:7 }, 7),
      DTR("Crawler", "Ползающее: не сбивается с ног, но не прыгает."),
      DTR("Daemonic Presence (5/10)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("Fanatic", "Обязан защищать командира/всадника; +1 Реакция на защиту."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      DTR("Maneuverable", "Не получает штрафов за резкие манёвры."),
      DTR("Mockery of Life", "Раз в Раунд при падении ниже 0 Ран — Т+10, при Успехе остаться с 0. Иммунитет ко всем ядам."),
      DTR("Regeneration (3)", "В начале Хода восстанавливает 3 Раны."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Swarm (1d5)", "Рой: делится урон, поглощает атаки по площади."),
      DTR("War-Trained", "Приучен к бою."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."),
      DTR("Deadly Natural Weapons", "Смертельное естественное оружие (Волна Нурглингов)."),
      Dw("Wave of Nurglings / Волна Нурглингов", { dmg:"1d10+4", type:"rending", pen:1, props:["reinforced","tearing",{key:"toxic",rating:3}], special:"Независимая атака; Проб. 1d5+1 (переменное)." }),
      DTAL("Combat Master", "Враги не получают бонуса за толпу против него."),
      DTAL("Gatekeeper", "До WS.b свободных атак в Раунд."),
      DTAL("Takedown", "Оглушить неприцельно любым оружием."),
      DTAL("Гниющий Трон", "Всадник — не деградирующее укрытие AP 7 с задней арки 180°; посадка/спешивание только с передней 90°.", 3),
      DTAL("Симбиотическое Восстановление", "Использует Т всадника для Regeneration; всадник поглощает Раны Паланкина для снятия эффектов.", 3),
      DTAL("Нурглинги-Оруженосцы", "Хранят снаряжение всадника; 2 ассистента при надевании брони.", 3)
    ]
  },

  {
    name: "Диск Тзинча", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Тзинч", img: DIMG("Tzeentch"), prototypeToken: DTOKEN("Tzeentch"),
    system: {
      allegiance: "tzeentch", rank: "beast", form: "trueForm", instabilityRating: 0, isDaemon: true, isPsyker: false,
      portfolio: "перекованный Крикун", size: 1,
      characteristics: CH({ ws:35, bs:0, s:45, t:45, ag:50, int:3, per:43, wp:25, fel:1, inf:0 }),
      wounds: { value: 18, max: 18, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ awareness:"veteran", dodge:"trained" }),
      groupSkills: GSK([["operate","Aeronautica","trained",60]]),
      notes: DNOTE("Крикун, перекованный в парящий скакун чемпиона Тзинча — быстрый, маневренный, с сильным щитом. Бездумно послушен хозяину через связь Псайбера.",
        "<b>Нет Warp Instability:</b> Диск стабилизирован хозяином (демон-всадник свою Нестабильность сохраняет).",
        "<b>Чародейский Щит:</b> не перегружающийся щит-купол 1-50; всадник может получать его сам или использовать свой.",
        "<b>Связанная Сущность:</b> изгоняется вместе с хозяином-демоном; при смерти хозяина превращается обратно в Крикуна с текущими Ранами.",
        "<b>Скакун:</b> несёт существо ≤ своего Размера весом до 900 кг; всадник использует For.Lore (Warp) (W) вместо Survival для манёвров, +1 Реакция на Пси-Избегания/Пси-Капюшон.")
    },
    kit: [
      DTR("Daemonic (4)", "×4 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:4}] }, 4),
      DTR("Daemonic Presence (5/10)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      DTR("Flyer (12)", "Полёт со скоростью 12.", {}, 12),
      DTR("Maneuverable", "Не получает штрафов за резкие манёвры."),
      DTR("Psyber", "Псайбер: мысленная связь с хозяином."),
      DTR("Stand", "Может служить устойчивой платформой."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Смертельное естественное оружие (Бритвенные Шипы)."),
      Dw("Razor Spikes / Бритвенные Шипы", { dmg:"1d10+5", type:"rending", pen:4, props:[{key:"felling",rating:3},"razorSharp","reinforced"], special:"Независимая атака (3)." }),
      DTAL("Hard Target", "−10 на стрельбу по персонажу при Беге и Натиске."),
      DTAL("Neural Triggers", "Паралич вместо контроля разума или тела."),
      DTAL("Paranoia", "+2 к Инициативе; всегда настороже."),
      DTAL("Sprint", "Полн. Движение — SPD×3, Бег — SPD×12."),
      DTAL("Sure Strike", "−10 штраф за Избирательный удар или Размер."),
      DTAL("Адаптивный Размер", "За полудействие меняет Размер от −1 до 1.", 3),
      DTAL("Многоглазый", "Круговое зрение 360°.", 3),
      DTAL("Чародейский Щит 1-50", "Не перегружающийся колдовской щит-купол 1-50 (всадник может получать сам).", 3),
      DTAL("Терзающий Нырок", "Может совершать Верховую Атаку шипами самостоятельно.", 3)
    ]
  },

  // ══════════════════ ВЫСШИЕ ДЕМОНИЧЕСКИЕ ЗВЕРИ ═════════════════════════════
  {
    name: "Изверг Слаанеш", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Слаанеш", img: DIMG("Slaanesh"), prototypeToken: DTOKEN("Slaanesh"),
    system: {
      allegiance: "slaanesh", rank: "greaterBeast", form: "trueForm", instabilityRating: 4, isDaemon: true, isPsyker: false,
      portfolio: "разрушающая песнь", size: 2,
      characteristics: CH({ ws:49, bs:0, s:54, t:44, ag:57, int:18, per:56, wp:40, fel:6, inf:27 }),
      wounds: { value: 24, max: 24, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ acrobatics:"veteran", athletics:"veteran", awareness:"trained", dodge:"veteran", intimidate:"knows", interrogate:"expert", parry:"trained", survival:"knows" }),
      notes: DNOTE("Высший зверь Слаанеш — чарующий хищник, чья дискордантная песнь искажает реальность и подрывает волю врагов.",
        "<b>Дискордантная Песнь:</b> враги в ауре Демонического Присутствия (20 м) — тест W−10 (псайкеры W−20) при каждой атаке по Извергу; 1-4 Провала — штраф −5×Провалы, 5+ — не могут атаковать. Стрельба извне по целям в ауре −10.",
        "<b>Мультиатака:</b> клешни ИЛИ язык; при Захвате клешнями — атака языком; +Реакция на хвост.",
        "<b>Мучитель:</b> при пытках/допросе считается 2 ассистентами.")
    },
    kit: [
      DTR("Alluring Presence", "Все враги −10 на Избегания против атак демона."),
      DTR("Daemonic (4)", "×4 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:4}] }, 4),
      DTR("Unnatural S (2)", "Сверхъестественная Сила: +2 к S.b.", { charBonuses:[{stat:"s",value:2}] }, 2),
      DTR("Unnatural A (4)", "Сверхъестественная Ловкость: +4 к A.b.", { charBonuses:[{stat:"ag",value:4}] }, 4),
      DTR("Daemonic Presence (10/20)", "Аура присутствия демона (20 м)."), DTR("Dark Sight", "Видит в темноте."),
      DTR("Quadruped (2)", "Четвероногое: +бонус к передвижению."),
      DTR("Nimble (10)", "+10 к Уклонению."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(3), DTR("Sonar Sense", "Ощущает окружение эхолокацией."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Смертельное естественное оружие (Клешни, Хвост-Жало, Хлещущий Язык)."),
      Dw("Pincer Claws / Клешни (×2)", { dmg:"1d10+10", type:"rending", pen:4, props:[{key:"extreme",rating:8},"razorSharp","reinforced","tearing"], special:"Парные (0-4)." }),
      Dw("Tail-Stinger / Хвост-Жало", { dmg:"1d10+9", type:"rending", pen:2, props:["cheapShot","flexible","reinforced",{key:"toxic",rating:4}], special:"За Реакцию (0-6).", equipped:false }),
      Dw("Lashing Tongue / Хлещущий Язык", { dmg:"1d5+9", type:"rending", pen:2, props:[{key:"dreaming",rating:1},"flexible","precise","reinforced",{key:"snare",rating:0}], special:"5-7; при Snare удерживает цель.", equipped:false }),
      DTAL("Ambidextrous", "−10 штраф за 2 оружия; нет штрафа за левую руку."),
      DTAL("Hard Target", "−10 на стрельбу по персонажу при Беге и Натиске."),
      DTAL("Heightened Senses (All)", "+10 к тестам на все чувства."),
      DTAL("Jumper", "Прыжки за полудействие."),
      DTAL("Step Aside", "+1 Реакция."),
      DTAL("Strange Technique", "+1 Реакция только для бонусных атак."),
      DTAL("Sure Strike", "−10 штраф за Избирательный удар или Размер."),
      DTAL("Swift Attack", "Приём с −10 на ½ Успехи попаданий."),
      DTAL("Two-Weapon Wielder (Melee)", "Бой двумя оружиями со штрафом −20."),
      DTAL("Дискордантная Песнь", "Аура 20 м: враги тест W−10 (псайкеры −20) при каждой атаке по Извергу; 1-4 Провала — −5×Провалы, 5+ — не могут атаковать. Стрельба извне по целям в ауре −10.", 3),
      DTAL("Мучитель", "При пытках/допросе считается 2 ассистентами.", 3)
    ]
  },

  {
    name: "Тварь Нургла", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Нургл", img: DIMG("Nurgle"), prototypeToken: DTOKEN("Nurgle"),
    system: {
      allegiance: "nurgle", rank: "greaterBeast", form: "trueForm", instabilityRating: 4, isDaemon: true, isPsyker: false,
      portfolio: "жизнерадостный слизень", size: 2,
      characteristics: CH({ ws:43, bs:1, s:52, t:63, ag:25, int:16, per:34, wp:40, fel:3, inf:27 }),
      wounds: { value: 35, max: 35, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ athletics:"veteran", awareness:"knows", survival:"knows" }),
      notes: DNOTE("Высший зверь Нургла — огромный радостный слизень, ищущий «новых друзей», чьи объятья смертоносны. Невероятно живуч и регенеративен.",
        "<b>Игры и Забавы:</b> раз в Ход свободным действием (d5, если не по приказу): 1 Облако Мух (Smoke 7), 2 След Слизи (Трудный Ландшафт −10, Corrosive 2), 3 Тошнотворные Газы (Blast 7, Т−10 или Оглушение), 4 Проглотить Живьём (Размер ≤1), 5 Кислотная Рвота (стрелковая, шаблон).",
        "<b>Гротескная Регенерация:</b> в начале Хода +1..+7 Ран (тем больше, чем ниже текущие Раны).",
        "<b>Разъедающая Слизь:</b> все в Борьбе с Тварью в конце Хода — Corrosive (2) по всем частям; при AP 0 — Bane (3).",
        "<b>Игривая:</b> Реакция — перехватить Натиск на союзника (SPD×2). <b>Рассеянность:</b> помнит приказы 3 Раунда; приказ = Command + Survival (F)+30.")
    },
    kit: [
      DTR("Daemonic (4)", "×4 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:4}] }, 4),
      DTR("Unnatural S (2)", "Сверхъестественная Сила: +2 к S.b.", { charBonuses:[{stat:"s",value:2}] }, 2),
      DTR("Unnatural T (5)", "Сверхъестественная Стойкость: +5 к T.b.", { charBonuses:[{stat:"t",value:5}] }, 5),
      DTR("Crawler", "Ползающее: не сбивается с ног, но не прыгает."),
      DTR("Daemonic Presence (10/20)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(3), DTR("Mockery of Life", "Раз в Раунд при падении ниже 0 Ран — Т+10, при Успехе остаться с 0. Иммунитет ко всем ядам."),
      DTR("Sturdy", "Устойчив: труднее сбить/сдвинуть."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Смертельное естественное оружие (Гнилостные Объятья)."),
      Dw("Putrid Embrace / Гнилостные Объятья", { dmg:"2d10+7", type:"chemical", pen:0, props:[{key:"corrosive",rating:2},{key:"bane",rating:3},"reinforced"], special:"Попав по меньшей цели — может взять в Захват." }),
      Dw("Acid Vomit / Кислотная Рвота", { cls:"ranged", wtype:"Спрей", rng:"20м", dmg:"2d10+7", type:"chemical", pen:0, rofS:true, props:[{key:"corrosive",rating:2},{key:"bane",rating:3}], special:"Шаблон Spray; ∞.", equipped:false }),
      DTAL("Ambidextrous", "−10 штраф за 2 оружия; нет штрафа за левую руку."),
      DTAL("Boxer", "−10 штраф за 2 оружия для кулаков."),
      DTAL("Combat Master", "Враги не получают бонуса за толпу против него."),
      DTAL("Gatekeeper", "До WS.b свободных атак в Раунд."),
      DTAL("Iron Jaw", "Т+0, чтобы игнорировать Оглушение."),
      DTAL("Steady Footwork", "Нет штрафов к WS от ландшафта."),
      DTAL("Two-Weapon Wielder (Melee)", "Бой двумя оружиями со штрафом −20."),
      DTAL("Игры и Забавы", "Раз в Ход (d5): Облако Мух / След Слизи / Тошнотворные Газы / Проглотить Живьём / Кислотная Рвота.", 3),
      DTAL("Гротескная Регенерация", "В начале Хода +1..+7 Ран (больше при низких Ранах).", 3),
      DTAL("Разъедающая Слизь", "Все в Борьбе с Тварью в конце Хода — Corrosive (2); при AP 0 — Bane (3).", 3),
      DTAL("Игривая", "Реакция — перехватить Натиск на союзника (SPD×2).", 3),
      DTAL("Рассеянность", "Помнит приказы 3 Раунда; приказ = Command + Survival (F)+30.", 3)
    ]
  },

  {
    name: "Чумная Жаба", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Нургл", img: DIMG("Nurgle"), prototypeToken: DTOKEN("Nurgle"),
    system: {
      allegiance: "nurgle", rank: "greaterBeast", form: "trueForm", instabilityRating: 4, isDaemon: true, isPsyker: false,
      portfolio: "наказание за амбиции", size: 1,
      characteristics: CH({ ws:38, bs:35, s:52, t:63, ag:35, int:32, per:23, wp:40, fel:7, inf:27 }),
      wounds: { value: 28, max: 28, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ acrobatics:"trained", athletics:"veteran", awareness:"trained", logic:"veteran", stealth:"expert", survival:"trained" }),
      notes: DNOTE("Возвышенный Чумонос, обращённый Нурглом в жабу в наказание за амбиции. Прыгучая засадная тварь; смертные всадники — «Моровые Всадники».",
        "<b>Прыжки:</b> игнорирует Трудный Ландшафт/преграды между точками движения (не при скрытности).",
        "<b>Приземление:</b> при Натиске — авто-попадание 2d10+7 I(Cr), Primitive, всем Размером ≤0 в контакте; тест S+20/A+10 или сбита с ног.",
        "<b>Проглотить Живьём:</b> за полудействие глотает удержанное существо Размером ≤0 (авто-Нестабильность, пока держит душу внутри).")
    },
    kit: [
      DTR("Daemonic (5)", "×5 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:5}] }, 5),
      DTR("Unnatural S (2)", "Сверхъестественная Сила: +2 к S.b.", { charBonuses:[{stat:"s",value:2}] }, 2),
      DTR("Natural Armour (3)", "Толстая шкура: 3 брони по всем локациям.", { armourAll:3 }, 3),
      DTR("Crawler", "Ползающее: не сбивается с ног, но не прыгает как обычно."),
      DTR("Daemonic Presence (10/10)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(2), DTR("Mockery of Life", "Раз в Раунд при падении ниже 0 Ран — Т+10, при Успехе остаться с 0. Иммунитет ко всем ядам."),
      DTR("Quadruped (0)", "Четвероногое."), DTR("Sturdy", "Устойчив: труднее сбить/сдвинуть."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Смертельное естественное оружие (Гниющий Рог, Укус, Язык)."),
      Dw("Bite / Укус", { dmg:"2d10+8", type:"rending", pen:1, props:[{key:"bane",rating:2},"reinforced","tearing"], special:"Независимая атака; при попадании по меньшей цели — может взять в Захват." }),
      Dw("Rotting Horn / Гниющий Рог", { dmg:"2d10+14", type:"rending", pen:1, props:[{key:"bane",rating:2},"piercing","reinforced"], special:"Только с Натиска; после непоглощённого урона рог отламывается (отрастает после боя).", equipped:false }),
      Dw("Tongue / Язык", { cls:"ranged", wtype:"Пистолет", rng:"7м", dmg:"1d10+7", type:"chemical", pen:0, rofS:true, recharge:true, props:[{key:"corrosive",rating:2}], special:"∞; при попадании по Размеру ≤1 — встречная Атлетика(S), подтянуть цель на 3м/Успех, затем немедленный укус.", equipped:false }),
      DTAL("Crippling Strike", "+2 Отрицательных Ран в рукопашной."),
      DTAL("Gatekeeper", "До WS.b свободных атак в Раунд."),
      DTAL("Iron Jaw", "Т+0, чтобы игнорировать Оглушение."),
      DTAL("Jumper", "Прыжки за полудействие."),
      DTAL("Resistance (Psychic Powers)", "+10 на тесты сопротивления психосилам."),
      DTAL("Steady Footwork", "Нет штрафов к WS от ландшафта."),
      DTAL("Tenacity", "Второй шанс на единственную атаку в Ход."),
      DTAL("Прыжки", "Игнорирует Трудный Ландшафт и преграды между точками движения (одним прыжком; не при скрытности).", 3),
      DTAL("Приземление", "При Натиске — авто 2d10+7 I(Cr) Primitive всем Размером ≤0 в контакте; тест S+20/A+10 или сбита с ног.", 3),
      DTAL("Проглотить Живьём", "За полудействие глотает удержанное существо Размером ≤0.", 3)
    ]
  },

  {
    name: "Джаггернаут", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Кхорн", img: DIMG("Khorne"), prototypeToken: DTOKEN("Khorne"),
    system: {
      allegiance: "khorne", rank: "greaterBeast", form: "trueForm", instabilityRating: 4, isDaemon: true, isPsyker: false,
      portfolio: "воплощённый гнев", size: 2,
      characteristics: CH({ ws:45, bs:0, s:64, t:56, ag:25, int:15, per:18, wp:40, fel:3, inf:27 }),
      wounds: { value: 24, max: 24, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ athletics:"veteran", awareness:"veteran", dodge:"knows", intimidate:"trained", survival:"trained" }),
      notes: DNOTE("Скакун Кхорна — бронзовый бык-машина необузданного гнева. Смертные всадники — «Кровокрушители», тяжёлая кавалерия-таран.",
        "<b>Закалённая в Крови Броня:</b> не перегружающийся щит-дефлектор 1-15; против психосил/варп-оружия усиливается до 1-30.",
        "<b>Неистовый Натиск:</b> не-Избирательная атака рогом с Натиска — авто-попадание с 8 Успехами; в конце Хода шаблон взрыва 2d10+8 I(Cr), Blast 2 (свои игнорируют).",
        "<b>Пламенный Путь:</b> под могучим всадником Inf 50-79 получает Hoverer (8), Inf 80+ — Flyer (8) (бежит по огненной дороге).")
    },
    kit: [
      DTR("Daemonic (5)", "×5 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:5}] }, 5),
      DTR("Unnatural S (5)", "Сверхъестественная Сила: +5 к S.b.", { charBonuses:[{stat:"s",value:5}] }, 5),
      DTR("Natural Armour (8/8/6/6)", "Бронзовая шкура: 8 тело/руки, 6 ноги/спина.", { armourAll:8 }, 8),
      DTR("Brutal Charge (4)", "+4 к урону при атаке с Натиска.", {}, 4),
      DTR("Blood for the Blood God", "Иммунитет к Страху, Пиннингу, психосилам страха; жажда убийства."),
      DTR("Daemonic Presence (10/10)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(3), DTR("Quadruped (0)", "Четвероногое."), DTR("Sturdy", "Устойчив: труднее сбить/сдвинуть."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Смертельное естественное оружие (Рог, Укус, Копыта)."),
      Dw("Bite / Укус", { dmg:"1d10+11", type:"rending", pen:2, props:[{key:"challenge",rating:1},"reinforced","tearing"], special:"Независимая атака; при попадании по меньшей цели — может взять в Захват." }),
      Dw("Horn / Рог", { dmg:"2d10+8", type:"rending", pen:8, props:[{key:"concussive",rating:2},"reinforced"], special:"Независимая атака, только с Натиска.", equipped:false }),
      Dw("Hooves / Копыта", { dmg:"1d10+11", type:"rending", pen:0, props:[{key:"concussive",rating:-2},"reinforced"], special:"Удар копытами (ноги).", equipped:false }),
      DTAL("Battle Rage", "Может парировать в Ярости."),
      DTAL("Berserk Charge", "+10 к атаке с Натиска."),
      DTAL("Fire in the Blood", "Вход в Ярость за полудействие."),
      DTAL("Frenzy", "Может войти в Ярость: +10 WS, S, W, −20 BS, I, F."),
      DTAL("Reckless Charge", "Полная атака с Натиска."),
      DTAL("Thunder Charge", "Улучшенный Напролом."),
      DTAL("Hammer Blow", "+½ WS.b к Pen и Concussive для Полной атаки."),
      DTAL("Закалённая в Крови Броня", "Щит-дефлектор 1-15; против психосил/варп-оружия — 1-30.", 3),
      DTAL("Неистовый Натиск", "Атака рогом с Натиска — авто 8 Успехов; в конце Хода взрыв 2d10+8 I(Cr) Blast 2 (свои игнорируют).", 3),
      DTAL("Пламенный Путь", "Под всадником Inf 50-79 — Hoverer (8), Inf 80+ — Flyer (8).", 3)
    ]
  },

  {
    name: "Огневик", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Тзинч", img: DIMG("Tzeentch"), prototypeToken: DTOKEN("Tzeentch"),
    system: {
      allegiance: "tzeentch", rank: "greaterBeast", form: "trueForm", instabilityRating: 3, isDaemon: true, isPsyker: false,
      portfolio: "непредсказуемое пламя", size: 1,
      characteristics: CH({ ws:22, bs:38, s:34, t:39, ag:34, int:32, per:30, wp:40, fel:9, inf:27 }),
      wounds: { value: 27, max: 27, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ awareness:"veteran", dodge:"trained", scrutiny:"veteran" }),
      groupSkills: GSK([["operate","Aeronautica","trained",44],["forbiddenLore","Daemons","veteran",52],["forbiddenLore","Psykers","trained",42],["forbiddenLore","Warp","trained",42]]),
      notes: DNOTE("Пиродемон Тзинча с текучим телом из пастей, мечущий сгустки непредсказуемого Пламени Хаоса. Бесстрашно исполняет любые приказы. 1 Очко Судьбы.",
        "<b>Пламя Хаоса:</b> бросок урона по каждой цели в Spray отдельно; при дубле вместо попадания — эффект d10: 1 Исцеляющее Пламя, 2 Тех-Проклятье (Haywire 3), 3 Расплавление, 4 Инферно (Flame 3d10), 5 Негатив, 6 Смещение, 7 Пиростойкость, 8 Щупальца, 9 Гнев Варпа (Варп-Прорыв), 10 Пламя Души (2d10+2 Warp Weapon).",
        "<b>Контролируемый Хаос:</b> за Очко Судьбы бросить ещё 3d10 и заменять кубики урона.",
        "<b>Пиродемон:</b> иммунен к E(Fl)/Горению, удваивает поглощение против прочего E. <b>Текучее Тело:</b> нельзя Захватить/Snare, иммунен к Crippling/Piercing.")
    },
    kit: [
      DTR("Daemonic (3)", "×3 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:3}] }, 3),
      DTR("Unnatural T (3)", "Сверхъестественная Стойкость: +3 к T.b.", { charBonuses:[{stat:"t",value:3}] }, 3),
      DTR("Daemonic Presence (10/10)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(2), DTR("Hoverer (8)", "Парит/скользит со скоростью 8.", {}, 8),
      DTR("Touched by the Fates (1)", "1 Очко Судьбы.", {}, 1),
      DTR("Sorcerous Barrier", "Колдовской щит-купол 1-35, вкл/выкл свободным действием."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Смертельное естественное оружие (Пасти, Пламя Перемен)."),
      Dw("Maws / Пасти", { dmg:"2d10+3", type:"energy", pen:4, props:[{key:"change",rating:9},"contained","flame","flexible","reinforced"], special:"E(Fl); нельзя Парировать (огонь из десятка пастей)." }),
      Dw("Flames of Change / Пламя Перемен", { cls:"ranged", wtype:"Пистолет", rng:"20м", dmg:"2d10+3", type:"energy", pen:4, rofS:true, props:[{key:"change",rating:9},"flame",{key:"linger",rating:1},"spray"], special:"E(Fl); ∞; попавшие в шаблон считают Огневика имеющим Страх 3.", equipped:false }),
      DTAL("Friendly Fire", "Более безопасная стрельба через союзников."),
      DTAL("Hard Target", "−10 на стрельбу по персонажу при Беге и Натиске."),
      DTAL("Hip Shooting", "Стрельба на полном ходу."),
      DTAL("Paranoia", "+2 Init, всегда настороже."),
      DTAL("Strong Minded", "Переброс тестов против контроля разума."),
      DTAL("Пламя Хаоса", "Дубль на уроне (стрельба/рукопашная) → эффект d10: Исцеляющее Пламя / Тех-Проклятье / Расплавление / Инферно / Негатив / Смещение / Пиростойкость / Щупальца / Гнев Варпа / Пламя Души.", 3),
      DTAL("Встречный Огонь", "Реакция при Натиске — попадание пламенем перемен по атакующему (точечно).", 3),
      DTAL("Текучее Тело", "Нельзя Захватить/Snare; иммунен к Crippling/Piercing.", 3),
      DTAL("Контролируемый Хаос", "За Очко Судьбы бросить ещё 3d10 и заменять кубики урона.", 3),
      DTAL("Пиродемон", "Иммунен к E(Fl)/Горению; удваивает поглощение против прочего E; игнорирует атаки других Огневиков.", 3),
      DTAL("Податливый", "Тзинч герольда+ и меченые смертные: +60 на Команду Огневиками, те не могут сопротивляться приказам.", 3)
    ]
  },

  {
    name: "Возвышенный Огневик", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Тзинч", img: DIMG("Tzeentch"), prototypeToken: DTOKEN("Tzeentch"),
    system: {
      allegiance: "tzeentch", rank: "greaterBeast", form: "trueForm", instabilityRating: 3, isDaemon: true, isPsyker: false,
      portfolio: "возвышенное пламя", size: 2,
      characteristics: CH({ ws:29, bs:54, s:34, t:45, ag:49, int:39, per:45, wp:52, fel:34, inf:37 }),
      wounds: { value: 36, max: 36, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ acrobatics:"knows", awareness:"veteran", command:"trained", deceive:"trained", dodge:"veteran", scrutiny:"veteran" }),
      groupSkills: GSK([["operate","Aeronautica","veteran",69],["forbiddenLore","Daemons","veteran",59],["forbiddenLore","Warp","trained",49],["forbiddenLore","Psykers","trained",49],["linguistics","Low Gothic","knows",39],["linguistics","True Tongue","knows",39]]),
      notes: DNOTE("Возвышенный пиродемон Тзинча — один из сильнейших его зверей, тягается с герольдами. Дальнобойное колдовское пламя, пробивающее танки. 3 Очка Судьбы.",
        "<b>Высшее Пламя Хаоса:</b> как у Огневика, но при дубле эффект применяется в дополнение к попаданию (демон выбирает эффект).",
        "<b>Контролируемый Хаос / Пиродемон / Текучее Тело:</b> как у обычного Огневика (Очки Судьбы, иммунитет к огню, нельзя Захватить/Snare).")
    },
    kit: [
      DTR("Daemonic (3)", "×3 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:3}] }, 3),
      DTR("Unnatural T (3)", "Сверхъестественная Стойкость: +3 к T.b.", { charBonuses:[{stat:"t",value:3}] }, 3),
      DTR("Daemonic Presence (10/15)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(3), DTR("Hoverer (8)", "Парит/скользит со скоростью 8.", {}, 8),
      DTR("Touched by the Fates (3)", "3 Очка Судьбы.", {}, 3),
      DTR("Sorcerous Barrier", "Колдовской щит-купол 1-35, вкл/выкл свободным действием."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Смертельное естественное оружие (Пасти, Синее и Розовое Пламя Перемен)."),
      Dw("Maws / Пасти", { dmg:"3d10", type:"energy", pen:6, props:[{key:"change",rating:9},"contained","flame","flexible","reinforced"], special:"E(Fl); нельзя Парировать." }),
      Dw("Blue Flames of Change / Синее Пламя Перемен", { cls:"ranged", wtype:"Пистолет", rng:"60м", dmg:"5d10+3", type:"energy", pen:9, rofS:true, recharge:true, props:[{key:"change",rating:12},"flame"], special:"E(Fl); ∞; пробивает танки и бункеры.", equipped:false }),
      Dw("Pink Flames of Change / Розовое Пламя Перемен", { cls:"ranged", wtype:"Пистолет", rng:"30м", dmg:"3d10", type:"energy", pen:6, rofS:true, props:[{key:"change",rating:9},"flame",{key:"linger",rating:1},"spray"], special:"E(Fl); ∞.", equipped:false }),
      DTAL("Friendly Fire", "Более безопасная стрельба через союзников."),
      DTAL("Hard Target", "−10 на стрельбу по персонажу при Беге и Натиске."),
      DTAL("Hip Shooting", "Стрельба на полном ходу."),
      DTAL("Paranoia", "+2 Init, всегда настороже."),
      DTAL("Reposition", "Полудвижение в начале боя."),
      DTAL("Step Aside", "+1 Реакция."),
      DTAL("Strong Minded", "Переброс тестов против контроля разума."),
      DTAL("Target Selection", "Нет штрафа за стрельбу в рукопашную."),
      DTAL("Tracking Aim", "P+0, чтобы убрать штраф за быструю цель."),
      DTAL("Высшее Пламя Хаоса", "При дубле на уроне эффект (d10) применяется в дополнение к попаданию (демон выбирает).", 3),
      DTAL("Контролируемый Хаос", "За Очко Судьбы бросить ещё 3d10 и заменять кубики урона.", 3),
      DTAL("Пиродемон", "Иммунен к E(Fl)/Горению; удваивает поглощение против прочего E.", 3),
      DTAL("Текучее Тело", "Нельзя Захватить/Snare; иммунен к Crippling/Piercing.", 3)
    ]
  },

  // ══════════════════ ДЕМОНИЧЕСКИЕ ГЕРОЛЬДЫ ═════════════════════════════════
  {
    name: "Герольд Пантеона", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Неделимый", img: DIMG("Chaos"), prototypeToken: DTOKEN("Chaos"),
    system: {
      allegiance: "undivided", rank: "herald", form: "trueForm", instabilityRating: 5, isDaemon: true, isPsyker: true,
      portfolio: "дипломат легионов", size: 1,
      characteristics: CH({ ws:65, bs:28, s:48, t:48, ag:58, int:43, per:54, wp:64, fel:52, inf:68 }),
      wounds: { value: 45, max: 45, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ acrobatics:"trained", athletics:"trained", awareness:"trained", charm:"veteran", command:"veteran", commerce:"trained", deceive:"trained", dodge:"veteran", intimidate:"trained", parry:"veteran", psyniscience:"trained", scrutiny:"trained" }),
      groupSkills: GSK([["operate","Aeronautica","expert",88],["scholasticLore","Imperial Creed","expert",73],["forbiddenLore","Daemons","veteran",63],["forbiddenLore","Heresy","expert",73],["linguistics","Chaos Glyphs","knows",43],["linguistics","High Gothic","knows",43],["linguistics","Low Gothic","knows",43],["linguistics","True Tongue","knows",53]]),
      notes: DNOTE("Слияние двух возвышенных Катартов — четырёхрукий шестикрылый герольд-дипломат Неделимого, открывающий врата инфернальным легионам всех Богов. Демонический псайкер (PR 5).",
        "<b>Псайкер:</b> 7 психосил из Демонологии и/или Прорицания, фокус в обеих; раз в Раунд психосила Демонологии — авто-успех с 3 Успехами.",
        "<b>Локус Пантеона:</b> действует на союзных демонов всех Богов (не на чужих герольдов): Грация (переброс А) / Несокрушимость (Unnatural T+2) / Гнев (Hatred Все!) / Мутация (W вместо WS/S) / Цепи (+Inf на Нестабильность и анти-Экзорцизм) / Фанатизм (Touched by the Fates 1).",
        "<b>Врата Плоти:</b> вселившись в псайкера, за полное действие превращает его в портал в Варп (Размер 3, +10×бPR Ран).")
    },
    kit: [
      DTR("Daemonic (6)", "×6 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:6}] }, 6),
      DTR("Unnatural S (4)", "Сверхъестественная Сила: +4 к S.b.", { charBonuses:[{stat:"s",value:4}] }, 4),
      DTR("Unnatural F (2)", "Сверхъестественная Харизма: +2 к F.b.", { charBonuses:[{stat:"fel",value:2}] }, 2),
      DTR("Bite (2)", "Естественная атака укусом (2).", {}, 2),
      DTR("Daemonic Armament (4/5, Мечи)", "Может призывать/развеивать демонические мечи."),
      DTR("Daemonic Presence (15/15)", "Аура присутствия демона."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      DTR("Flyer (8)", "Полёт со скоростью 8.", {}, 8),
      FEAR(3), DTR("Multiple Arms (4)", "Четыре руки.", {}, 4),
      DTR("Nimble (10)", "+10 к Уклонению."),
      DTR("Psyker (PR 5)", "Демонический псайкер, Сила Псионики 5.", {}, 5),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons (3, Когти)", "Смертельные когти."),
      Dw("Claws / Когти (×4)", { dmg:"1d10+11", type:"rending", pen:3, props:["reinforced","tearing"], special:"Считается ладонью (0-2)." }),
      Dw("Bite / Укус", { dmg:"1d5+10", type:"rending", pen:2, props:["reinforced","tearing"], special:"Только в борьбе.", equipped:false }),
      Dw("Sword / Меч (×4)", { dmg:"1d10+12", type:"rending", pen:5, props:["reinforced"], special:"Демоническое оружие (2-4); 2р/Об/Бл/Мх.", equipped:false }),
      DTAL("Air of Authority", "×10 подчинённых для командования."),
      DTAL("Ambidextrous", "−10 штраф за 2 оружия; нет штрафа за левую руку."),
      DTAL("Blade Dancer", "−10 штраф за парные мечи."),
      DTAL("Blademaster", "Переброс попаданий клинковым оружием."),
      DTAL("Bodyguard", "Можно парировать атаки по союзникам."),
      DTAL("Bring It Down", "Команды дают бонус к урону по большой цели."),
      DTAL("Counter-Attack", "Атака с −10 после парирования."),
      DTAL("Divine Protection", "10% шанс игнорировать любой Варп-эффект."),
      DTAL("Frontline Commander", "Переброс командования с передовой."),
      DTAL("Inspire Wrath", "Вызывает ненависть у толпы слушателей."),
      DTAL("Peer (демоны)", "+10 на общение с фракцией демонов."),
      DTAL("Step Aside", "+1 Реакция."),
      DTAL("Sure Strike", "−10 штраф за Избирательный удар или Размер."),
      DTAL("Two-Weapon Wielder (Melee)", "Бой двумя оружиями со штрафом −20."),
      DTAL("Локус Пантеона", "Аура на демонов всех Богов: Грация / Несокрушимость / Гнев / Мутация / Цепи / Фанатизм (переключение раз в Ход).", 3),
      DTAL("Проводник Чистоты", "Может использовать психосилы Чистой Демонологии, считая Cor = 0.", 3),
      DTAL("Врата Плоти", "Вселившись в псайкера — за полное действие превращает его в портал в Варп (Размер 3).", 3),
      DTAL("Добровольное Вселение", "Как у Катарта — вселяется в согласного носителя.", 3),
      DTAL("Мост Между Мирами", "Как у Катарта, но считается 5-ю Катартами.", 3),
      DTAL("Сила Мученичества", "Как у Катарта.", 3)
    ]
  },

  {
    name: "Герольд Слаанеш", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Слаанеш", img: DIMG("Slaanesh"), prototypeToken: DTOKEN("Slaanesh"),
    system: {
      allegiance: "slaanesh", rank: "herald", form: "trueForm", instabilityRating: 6, isDaemon: true, isPsyker: true,
      portfolio: "куртизанка Тёмного Принца", size: 1,
      characteristics: CH({ ws:72, bs:48, s:48, t:52, ag:61, int:41, per:50, wp:56, fel:66, inf:68 }),
      wounds: { value: 42, max: 42, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ acrobatics:"veteran", athletics:"trained", awareness:"veteran", charm:"veteran", command:"veteran", deceive:"trained", dodge:"veteran", interrogate:"trained", parry:"knows", scrutiny:"trained", survival:"trained" }),
      groupSkills: GSK([["forbiddenLore","Daemons","veteran",61],["linguistics","Eldar","trained",51],["linguistics","High Gothic","trained",51],["linguistics","Low Gothic","veteran",61],["linguistics","True Tongue","trained",51],["trade","Dancer","expert",91],["trade","Musician","veteran",86],["trade","Stylist","veteran",86]]),
      notes: DNOTE("Приближённая демонетка Слаанеш — служанка и куртизанка Тёмного Принца, предводительница легионов. Смертоносна и на удивление крепка. Демонический псайкер (PR 5).",
        "<b>Псайкер:</b> 6 психосил из дисциплин Слаанеш и/или Телепатии, фокус в обеих; раз в Раунд психосила Слаанеш — авто-успех с 3 Успехами.",
        "<b>Локус Слаанеш:</b> Быстрота (убирает −20 за 2 руки) / Грация (переброс А) / Мастерство (переброс WS) / Очарование (цель перебрасывает встречный) / Стремительность (Nimble +10 и бонусное полудвижение) / Утончённость (Felling 4 на атаки по сочленениям/глазам).",
        "<b>Неземная Грация:</b> ещё +1 Реакция.")
    },
    kit: [
      DTR("Alluring Presence", "Все враги −10 на Избегания против атак демона."),
      DTR("Daemonic (6)", "×6 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:6}] }, 6),
      DTR("Unnatural A (5)", "Сверхъестественная Ловкость: +5 к A.b.", { charBonuses:[{stat:"ag",value:5}] }, 5),
      DTR("Unnatural F (2)", "Сверхъестественная Харизма: +2 к F.b.", { charBonuses:[{stat:"fel",value:2}] }, 2),
      DTR("Daemonic Armament (Серебряный Дротик)", "Может призывать/развеивать демоническое оружие."),
      DTR("Daemonic Presence (15/15)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("Digitigrade (2)", "Пальцеходящие ноги: +2 к передвижению."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(2), DTR("Nimble (20)", "+20 к Уклонению."),
      DTR("Psyker (PR 5)", "Демонический псайкер, Сила Псионики 5.", {}, 5),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Клешни, Пронзающие Клинки, Поцелуй, Пинок."),
      Dw("Pincer Claws / Клешни (×2)", { dmg:"1d10+7", type:"rending", pen:4, props:[{key:"extreme",rating:8},"razorSharp","reinforced","tearing"], special:"Парные (0-5)." }),
      Dw("Piercing Blades / Пронзающие Клинки (×2)", { dmg:"1d10+9", type:"rending", pen:4, props:[{key:"crippling",rating:2},{key:"extreme",rating:8},"precise","reinforced"], special:"Ножи (1-6).", equipped:false }),
      Dw("Kick / Пинок", { dmg:"1d10+6", type:"rending", pen:3, props:["reinforced"], special:"Удар ногой.", equipped:false }),
      Dw("Kiss / Поцелуй", { dmg:"—", type:"rending", pen:5, props:[{key:"dreaming",rating:2},"precise"], special:"Только в борьбе; урона нет — накладывает Dreaming (2).", equipped:false }),
      Dw("Silver Javelin / Серебряный Дротик", { cls:"ranged", wtype:"Метательное", rng:"20м", dmg:"1d10+8", type:"rending", pen:3, rofS:true, props:[{key:"crippling",rating:2},"piercing","reinforced"], special:"∞ (демоническое).", equipped:false }),
      DTAL("Assassin Strike", "Acrobatics+0 для отскока после атаки."),
      DTAL("Ambidextrous", "−10 штраф за 2 оружия; нет штрафа за левую руку."),
      DTAL("Flip", "Перекат вместо сбивания с ног."),
      DTAL("Hard Target", "−10 на стрельбу по персонажу при Беге и Натиске."),
      DTAL("Heightened Senses (All)", "+10 к тестам на все чувства."),
      DTAL("Lightning Attack", "Приём с −20 на Успехи попаданий."),
      DTAL("Mimic", "Имитация чужого голоса."),
      DTAL("Pirouette", "Прыжок с пути несущегося вперёд врага."),
      DTAL("Precise Blow", "−10 штраф за Избирательный удар или Размер."),
      DTAL("Show-Off", "Устрашающая демонстрация мастерства."),
      DTAL("Step Aside", "+1 Реакция."),
      DTAL("Sure Strike", "−10 штраф за Избирательный удар или Размер."),
      DTAL("Swift Attack", "Приём с −10 на ½ Успехи попаданий."),
      DTAL("Two-Weapon Wielder (Melee)", "Бой двумя оружиями со штрафом −20."),
      DTAL("Локус Слаанеш", "Быстрота / Грация / Мастерство / Очарование / Стремительность / Утончённость (переключение раз в Ход).", 3),
      DTAL("Танцовщица Тёмного Принца", "Как у демонеток; +Неземная Грация: ещё +1 Реакция.", 3),
      DTAL("Арсенал Агонии", "Как у демонеток.", 3),
      DTAL("В Глазах Смотрящего", "Как у демонеток.", 3)
    ]
  },

  {
    name: "Герольд Нургла", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Нургл", img: DIMG("Nurgle"), prototypeToken: DTOKEN("Nurgle"),
    system: {
      allegiance: "nurgle", rank: "herald", form: "trueForm", instabilityRating: 7, isDaemon: true, isPsyker: true,
      portfolio: "счетовод чумы", size: 1,
      characteristics: CH({ ws:62, bs:50, s:53, t:70, ag:40, int:50, per:41, wp:56, fel:45, inf:68 }),
      wounds: { value: 49, max: 49, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ athletics:"trained", awareness:"veteran", charm:"trained", command:"veteran", deceive:"knows", logic:"expert", intimidate:"trained", medicae:"expert", parry:"trained", scrutiny:"veteran", survival:"veteran" }),
      groupSkills: GSK([["scholasticLore","Chymistry","veteran",70],["scholasticLore","Numerology","expert",80],["forbiddenLore","Daemons","veteran",70],["forbiddenLore","Heresy","trained",60],["linguistics","Low Gothic","knows",50],["linguistics","High Gothic","knows",50],["linguistics","True Tongue","veteran",70],["trade","Chymist","expert",80],["trade","Musician","veteran",65]]),
      notes: DNOTE("Предводитель легионов Нургла и счетовод чумы — любящая отеческая фигура для подчинённых. Сверхъестественно живуч. Демонический псайкер (PR 5).",
        "<b>Псайкер:</b> 7 психосил из дисциплин Нургла и/или Биомантии, фокус в обеих; раз в Раунд психосила Нургла — авто-успех с 3 Успехами.",
        "<b>Локус Нургла:</b> Возрождение (Regeneration 3) / Живучесть (переброс Т) / Заразность (+2 к Toxic и Bane) / Неизбежность (авто-попадание 1 Успех, −10 до след. Хода) / Несокрушимость (Unnatural T+2) / Упорство (игнор Трудного Ландшафта и Linger).",
        "<b>Истинная Стойкость:</b> ещё +1 Реакция только на Трейт «Стойкость».")
    },
    kit: [
      DTR("Daemonic (7)", "×7 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:7}] }, 7),
      DTR("Unnatural S (2)", "Сверхъестественная Сила: +2 к S.b.", { charBonuses:[{stat:"s",value:2}] }, 2),
      DTR("Unnatural T (2)", "Сверхъестественная Стойкость: +2 к T.b.", { charBonuses:[{stat:"t",value:2}] }, 2),
      DTR("Unnatural I (2)", "Сверхъестественный Интеллект: +2 к Int.b.", { charBonuses:[{stat:"int",value:2}] }, 2),
      DTR("Daemonic Armament (Чумной Меч)", "Может призывать/развеивать демоническое оружие."),
      DTR("Daemonic Presence (15/15)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(2), DTR("Mockery of Life", "Раз в Раунд при падении ниже 0 Ран — Т+10, при Успехе остаться с 0. Иммунитет ко всем ядам."),
      DTR("Psyker (PR 5)", "Демонический псайкер, Сила Псионики 5.", {}, 5),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons (3, Гниющий Рог, Когти, Укус)", "Смертельное естественное оружие."),
      Dw("Claws / Когти", { dmg:"1d10+10", type:"rending", pen:3, props:["reinforced",{key:"toxic",rating:2}], special:"Считается ладонью (0-3)." }),
      Dw("Bite / Укус", { dmg:"1d5+10", type:"rending", pen:3, props:[{key:"bane",rating:2},"reinforced"], special:"Только в борьбе.", equipped:false }),
      Dw("Rotting Horn / Гниющий Рог", { dmg:"2d10+10", type:"rending", pen:3, props:[{key:"bane",rating:2},"piercing","reinforced"], special:"Только с Натиска; рог отламывается (отрастает после боя).", equipped:false }),
      Dw("Plague Sword / Чумной Меч", { dmg:"1d10+11", type:"rending", pen:5, props:[{key:"felling",rating:4},"reinforced",{key:"toxic",rating:2}], special:"Демоническое оружие (2-5); 2р/Об.", equipped:false }),
      Dw("Bile Spit / Желчный Плевок", { cls:"ranged", wtype:"Пистолет", rng:"7м", dmg:"1d10+9", type:"chemical", pen:3, rofS:true, recharge:true, props:[{key:"corrosive",rating:2},{key:"toxic",rating:2}], special:"∞.", equipped:false }),
      DTAL("Combat Formation", "Использует I.b для Init +1 Init."),
      DTAL("Counter Attack", "Атака с −10 после парирования."),
      DTAL("Crippling Strike", "+2 Отрицательных Ран в рукопашной."),
      DTAL("Disarm", "WS+0 vs WS+0, чтобы обезоружить."),
      DTAL("Fast Stitches", "Быстрая первая помощь в бою."),
      DTAL("Foresight", "5 минут на раздумья дают +10 на тест I."),
      DTAL("Hunker Down", "Удвоенная эффективность укрытий."),
      DTAL("Iron Jaw", "Т+0, чтобы игнорировать Оглушение."),
      DTAL("Resistance (Psychic Powers)", "+10 на тесты сопротивления психосилам."),
      DTAL("Steady Footwork", "Нет штрафов к WS от ландшафта."),
      DTAL("Step Aside", "+1 Реакция."),
      DTAL("Takedown", "Оглушить неприцельно любым оружием."),
      DTAL("Tenacity", "Второй шанс на единственную атаку в Ход."),
      DTAL("Total Recall", "Может вспоминать точные детали без теста."),
      DTAL("Локус Нургла", "Возрождение / Живучесть / Заразность / Неизбежность / Несокрушимость / Упорство (переключение раз в Ход).", 3),
      DTAL("Истинная Стойкость", "Ещё +1 Реакция только на Трейт «Стойкость».", 3),
      DTAL("Зараженные Раны", "Как у Чумоноса.", 3),
      DTAL("Стойкость", "Как у Чумоноса.", 3)
    ]
  },

  {
    name: "Герольд Кхорна", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Кхорн", img: DIMG("Khorne"), prototypeToken: DTOKEN("Khorne"),
    system: {
      allegiance: "khorne", rank: "herald", form: "trueForm", instabilityRating: 6, isDaemon: true, isPsyker: false,
      portfolio: "тактик Кровавого Бога", size: 1,
      characteristics: CH({ ws:70, bs:58, s:56, t:56, ag:50, int:49, per:40, wp:56, fel:44, inf:68 }),
      wounds: { value: 45, max: 45, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ acrobatics:"knows", athletics:"veteran", awareness:"expert", charm:"knows", command:"veteran", dodge:"trained", intimidate:"veteran", logic:"trained", parry:"expert", scrutiny:"expert", survival:"trained" }),
      groupSkills: GSK([["commonLore","War","expert",79],["scholasticLore","Heraldry","trained",59],["scholasticLore","Judgement","trained",59],["forbiddenLore","Daemons","veteran",69],["forbiddenLore","Psykers","veteran",69],["forbiddenLore","Orks","trained",59],["linguistics","Low Gothic","knows",49],["linguistics","Ork","knows",49],["linguistics","True Tongue","knows",49],["trade","Armourer","veteran",69],["trade","Weaponsmith","veteran",69]]),
      notes: DNOTE("Предводитель инфернальных легионов Кхорна — опытный тактик и могучий дуэлянт, лишённый колдовства, но непревзойдённый в бою и стойкий к трюкам колдунов.",
        "<b>Благословение Кровавого Бога:</b> раз в Раунд свободным действием — вход/выход из Ярости / Избегания в Ярости / авто-успех атаки с 5 Успехами / подавить психосилы на себе / приём с любой базой.",
        "<b>Локус Кхорна:</b> Буйство (переброс атаки) / Гнев (Hatred Все!) / Кровопролитие (цель перебрасывает Избегание) / Ограждение (Blunted 2) / Подношение (Избирательные не ментальны, −20 штрафа в голову) / Сокрушение (любая атака как Полная Атака).",
        "<b>Могущество:</b> двуручное оружие одной рукой, считая двуручным хватом.")
    },
    kit: [
      DTR("Blood for the Blood God", "Иммунитет к Страху, Пиннингу, психосилам страха; жажда убийства."),
      DTR("Daemonic (6)", "×6 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:6}] }, 6),
      DTR("Unnatural WS (2)", "Сверхъестественное БМ: +2 к WS.b.", { charBonuses:[{stat:"ws",value:2}] }, 2),
      DTR("Unnatural S (6)", "Сверхъестественная Сила: +6 к S.b.", { charBonuses:[{stat:"s",value:6}] }, 6),
      DTR("Unnatural I (2)", "Сверхъестественный Интеллект: +2 к Int.b.", { charBonuses:[{stat:"int",value:2}] }, 2),
      DTR("Daemonic Armament (Адский Клинок)", "Может призывать/развеивать демоническое оружие."),
      DTR("Daemonic Presence (15/15)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("Digitigrade (1)", "Пальцеходящие ноги: +1 к передвижению."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(2), DTR("Nimble (10)", "+10 к Уклонению."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons (3, Рога, Когти, Укус, Пинок)", "Смертельное естественное оружие."),
      Dw("Claws / Когти", { dmg:"1d10+19", type:"rending", pen:3, props:[{key:"challenge",rating:0},{key:"extreme",rating:8},"primitive","reinforced"], special:"Считается ладонью (0-3)." }),
      Dw("Kick / Пинок", { dmg:"1d10+15", type:"rending", pen:3, props:["primitive","reinforced"], special:"Удар ногой.", equipped:false }),
      Dw("Bite / Укус", { dmg:"1d10+19", type:"rending", pen:3, props:["primitive","tearing","reinforced"], special:"Только в борьбе.", equipped:false }),
      Dw("Horns / Рога", { dmg:"2d10+19", type:"rending", pen:3, props:[{key:"challenge",rating:0},"reinforced"], special:"Только с Натиска; −30 на атаки руками в этот Ход.", equipped:false }),
      Dw("Hell Blade / Адский Клинок", { dmg:"1d10+20", type:"rending", pen:10, props:[{key:"extreme",rating:8},"powerField"], special:"Демоническое оружие (2-6); 2р/1р/Бл/Мх.", equipped:false }),
      DTAL("Battle Rage", "Может парировать в Ярости."),
      DTAL("Berserk Charge", "+10 к атаке с Натиска."),
      DTAL("Blademaster", "Переброс попаданий клинковым оружием."),
      DTAL("Cold Fury", "Больше контроля в Ярости."),
      DTAL("Combat Formation", "Использует I.b для Init +1 Init."),
      DTAL("Crushing Blow", "+½ WS.b к рукопашному урону."),
      DTAL("Defiance", "Иммунитет к Страху; вдохновляет союзников."),
      DTAL("Fire in the Blood", "Вход в Ярость за полудействие."),
      DTAL("Frenzy", "Может войти в Ярость: +10 WS, S, W, −20 BS, I, F."),
      DTAL("Frontline Commander", "Переброс командования с передовой."),
      DTAL("Furious Assault", "Доп. атака за 1 Реакцию после Полной Атаки."),
      DTAL("Overpower", "S+0 vs S+0, чтобы пробить Парирование."),
      DTAL("Reckless Charge", "Полная атака с Натиска."),
      DTAL("Step Aside", "+1 Реакция."),
      DTAL("Swift Attack", "Приём с −10 на ½ Успехи попаданий."),
      DTAL("Благословение Кровавого Бога", "Раз в Раунд свободным действием: Ярость / Избегания в Ярости / авто 5 Успехов / подавить психосилы / приём с любой базой.", 3),
      DTAL("Локус Кхорна", "Буйство / Гнев / Кровопролитие / Ограждение / Подношение / Сокрушение (переключение раз в Ход).", 3),
      DTAL("Могущество", "Двуручное рукопашное оружие одной рукой (считая двуручным хватом).", 3),
      DTAL("Знания Орудий Гнева", "Как у Кровопускателя.", 3),
      DTAL("Жажда Крови", "Как у Кровопускателя.", 3),
      DTAL("Кровопускание", "Как у Кровопускателя.", 3)
    ]
  },

  {
    name: "Герольд Тзинча", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Тзинч", img: DIMG("Tzeentch"), prototypeToken: DTOKEN("Tzeentch"),
    system: {
      allegiance: "tzeentch", rank: "herald", form: "trueForm", instabilityRating: 6, isDaemon: true, isPsyker: true,
      portfolio: "чародей Архитектора Судеб", size: 1,
      characteristics: CH({ ws:37, bs:65, s:45, t:43, ag:40, int:48, per:52, wp:60, fel:44, inf:68 }),
      wounds: { value: 45, max: 45, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ awareness:"expert", charm:"trained", command:"veteran", deceive:"expert", dodge:"veteran", inquiry:"trained", interrogate:"trained", intimidate:"trained", parry:"trained", psyniscience:"veteran", scrutiny:"expert" }),
      groupSkills: GSK([["scholasticLore","Occult","expert",78],["scholasticLore","Legend","veteran",68],["scholasticLore","Philosophy","veteran",68],["forbiddenLore","Daemons","expert",78],["forbiddenLore","Psykers","veteran",68],["forbiddenLore","Warp","veteran",68],["forbiddenLore","Heresy","trained",58],["linguistics","Low Gothic","trained",58],["linguistics","True Tongue","trained",58]]),
      notes: DNOTE("Предводитель легионов Тзинча — один из искуснейших чародеев-герольдов, странная переходная форма от Ужаса к Владыке Перемен. Демонический псайкер (PR 6).",
        "<b>Псайкер:</b> 9 психосил из дисциплин Тзинча и/или одной фундаментальной, фокус в обеих; раз в Раунд психосила Тзинча — авто-успех с 4 Успехами.",
        "<b>Локус Тзинча:</b> Мутация (W вместо WS/S) / Перемены (+9 к Change) / Преломление (переброс щитов) / Призыв (Twin-Linked всей стрельбе) / Разрушение (Tearing всей стрельбе) / Трансмогрификация (Ужасы делятся на 3).",
        "<b>Подстава:</b> раз за сцену при уроне ниже 0 Ран призывает Розового Ужаса и переносит на него весь непоглощённый урон.")
    },
    kit: [
      DTR("Daemonic (6)", "×6 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:6}] }, 6),
      DTR("Unnatural BS (2)", "Сверхъестественная БС: +2 к BS.b.", { charBonuses:[{stat:"bs",value:2}] }, 2),
      DTR("Unnatural P (2)", "Сверхъестественное Восприятие: +2 к Per.b.", { charBonuses:[{stat:"per",value:2}] }, 2),
      DTR("Bite", "Естественная атака укусом."),
      DTR("Daemonic Armament (Атам, Психосиловой Посох)", "Может призывать/развеивать демоническое оружие."),
      DTR("Daemonic Presence (15/15)", "Аура присутствия демона."), DTR("Dark Sight", "Видит в темноте."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(2), DTR("Nimble (10)", "+10 к Уклонению."),
      DTR("Psyker (PR 6)", "Демонический псайкер, Сила Псионики 6.", {}, 6),
      DTR("Sorcerous Barrier", "Колдовской щит-купол 1-35, вкл/выкл свободным действием."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons (2, Когти, Укус)", "Смертельное естественное оружие."),
      Dw("Claws / Когти", { dmg:"1d10+6", type:"rending", pen:2, props:["reinforced"], special:"Считается ладонью (0-2)." }),
      Dw("Bite / Укус", { dmg:"1d10+6", type:"rending", pen:2, props:["tearing","reinforced"], special:"Укус.", equipped:false }),
      Dw("Athame / Атам", { dmg:"1d5+5", type:"rending", pen:2, props:["precise","warpWeapon"], special:"Демоническое оружие-нож (1-3); Об.", equipped:false }),
      Dw("Force Staff / Психосиловой Посох", { dmg:"1d10+11", type:"impact", pen:6, props:["force","imprecise"], special:"Демоническое оружие (2-5); психофокус; 2р/1р.", equipped:false }),
      Dw("Iridescent Fire / Радужное Пламя", { cls:"ranged", wtype:"Пистолет", rng:"80м", dmg:"2d10+9", type:"energy", pen:6, rofS:true, rofSemi:3, rofFull:5, props:[{key:"change",rating:9},{key:"extreme",rating:9}], special:"∞; попадания считаются как психосила.", equipped:false }),
      DTAL("Combat Sense", "Использует P.b для Init."),
      DTAL("Covering Fire", "Стрельба во время выхода из рукопашной."),
      DTAL("Crack Shot", "+2 Отрицательных Ран в стрельбе."),
      DTAL("Favoured by the Warp", "Бросать два раза на феномен."),
      DTAL("Hip Shooting", "Стрельба на полном ходу."),
      DTAL("Meditation", "Медитировать для усиления психосил."),
      DTAL("Mimic", "Имитация чужого голоса."),
      DTAL("Paranoia", "+2 Init, всегда настороже."),
      DTAL("Snapshot", "Уничтожить гранаты выстрелом в полёте."),
      DTAL("Step Aside", "+1 Реакция."),
      DTAL("Target Selection", "Нет штрафа за стрельбу в рукопашную."),
      DTAL("Trick Shooter", "+30 на трюкаческие выстрелы."),
      DTAL("Unburdened", "Одна атакующая сила игнорирует штрафы к тPR."),
      DTAL("Warp Sense", "Psyniscience как свободное действие и реакция."),
      DTAL("Локус Тзинча", "Мутация / Перемены / Преломление / Призыв / Разрушение / Трансмогрификация (переключение раз в Ход).", 3),
      DTAL("Укреплённый Щит", "Чародейский щит (кроме Sorcerous Barrier) получает +15 к рейтингу.", 3),
      DTAL("Подстава", "Раз за сцену при уроне ниже 0 Ран — призывает Розового Ужаса и переносит на него урон.", 3),
      DTAL("Непостоянство", "Как у Ужасов.", 3)
    ]
  },

  // ══════════════════ ВЫСШИЕ ДЕМОНЫ ═════════════════════════════════════════
  {
    name: "Хранитель Секретов", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Слаанеш", img: DIMG("Slaanesh"), prototypeToken: DTOKEN("Slaanesh"),
    system: {
      allegiance: "slaanesh", rank: "greater", form: "trueForm", instabilityRating: 6, isDaemon: true, isPsyker: true,
      portfolio: "Любитель Боли", size: 3,
      characteristics: CH({ ws:81, bs:48, s:65, t:66, ag:72, int:70, per:63, wp:75, fel:84, inf:74 }),
      wounds: { value: 190, max: 190, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ acrobatics:"expert", athletics:"trained", awareness:"veteran", charm:"expert", command:"veteran", commerce:"trained", deceive:"veteran", dodge:"expert", interrogate:"expert", intimidate:"expert", logic:"veteran", parry:"veteran", psyniscience:"veteran", scrutiny:"veteran", stealth:"trained" }),
      groupSkills: GSK([["scholasticLore","Legend","expert",100],["forbiddenLore","Daemons","expert",100],["forbiddenLore","Psykers","veteran",90],["forbiddenLore","Heresy","veteran",90],["forbiddenLore","Warp","veteran",90],["forbiddenLore","Eldar","expert",100],["linguistics","Все!","veteran",90],["trade","Dancer","expert",102],["trade","Musician","expert",114],["trade","Stylist","veteran",104]]),
      notes: DNOTE("Высший демон Слаанеш — элегантный четырёхрукий «Любитель Боли», осквернитель непорочности. Смертоносный дуэлянт и мастер иллюзий. Демонический псайкер (PR 6). Размер 3, 190 Ран.",
        "<b>Псайкер:</b> знает все психосилы Слаанеш + 6 из Телепатии, фокус в обеих; раз в Раунд психосила Слаанеш — авто-успех с 1d5+1 Успехами.",
        "<b>Арсенал Совершенства:</b> оружие Daemonic Armament получает +1 кубик урона, Crippling (3), Shocking и Best.Q; раз в Ход трансформирует оружие в любое примитивное.",
        "<b>Аура Уступчивости:</b> раз в Ход тест W+0 против существа в 25м — при победе цель очарована (не может атаковать демона, подчиняется командам +30). Не действует на герольдов+ и хаоситов с бо́льшим Inf.",
        "<b>Мастер Отражений:</b> до 2 атак в Ход, если одна — психосила Иллюзионизма; поддерживает до 3 иллюзий без потери тPR.")
    },
    kit: [
      DTR("Daemonic (6)", "×6 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:6}] }, 6),
      DTR("Unnatural S (7)", "Сверхъестественная Сила: +7 к S.b.", { charBonuses:[{stat:"s",value:7}] }, 7),
      DTR("Unnatural T (5)", "Сверхъестественная Стойкость: +5 к T.b.", { charBonuses:[{stat:"t",value:5}] }, 5),
      DTR("Unnatural A (7)", "Сверхъестественная Ловкость: +7 к A.b.", { charBonuses:[{stat:"ag",value:7}] }, 7),
      DTR("Unnatural P (4)", "Сверхъестественное Восприятие: +4 к Per.b.", { charBonuses:[{stat:"per",value:4}] }, 4),
      DTR("Unnatural F (4)", "Сверхъестественная Харизма: +4 к F.b.", { charBonuses:[{stat:"fel",value:4}] }, 4),
      DTR("Alluring Presence", "Все враги −10 на Избегания против атак демона."),
      DTR("Daemonic Armament (3/5, Любое)", "Может призывать/развеивать любое демоническое оружие."),
      DTR("Daemonic Presence (20/20)", "Аура присутствия демона (20 м)."), DTR("Dark Sight", "Видит в темноте."),
      DTR("Digitigrade (3)", "Пальцеходящие ноги: +3 к передвижению."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(4), DTR("Multiple Arms (4)", "Четыре руки.", {}, 4),
      DTR("Nimble (20)", "+20 к Уклонению."),
      DTR("Psyker (PR 6)", "Демонический псайкер, Сила Псионики 6.", {}, 6),
      DTR("Unnatural Senses (20)", "Сверхчутьё на 20 м."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Клешни×2, Когти×2, Копыта."),
      Dw("Pincer Claws / Клешни (×2)", { dmg:"2d10+14", type:"rending", pen:6, props:[{key:"crippling",rating:6},"precise","razorSharp","reinforced","tearing"], special:"Парные (0-5)." }),
      Dw("Claws / Когти (×2)", { dmg:"1d10+14", type:"rending", pen:3, props:["reinforced","tearing"], special:"Считается ладонью (0-4).", equipped:false }),
      Dw("Hooves / Копыта", { dmg:"1d10+15", type:"impact", pen:2, props:["imprecise","reinforced"], special:"Удар копытами (ноги).", equipped:false }),
      Dw("Longsword / Длинный Меч", { dmg:"2d10+20", type:"rending", pen:5, props:[{key:"crippling",rating:3},"reinforced","shocking"], special:"Демоническое оружие Best.Q (2-8); 2р/1р/Бл/Мх.", equipped:false }),
      Dw("Javelin / Дротик", { cls:"ranged", wtype:"Метательное", rng:"70м", dmg:"2d10+16", type:"rending", pen:5, rofS:true, props:[{key:"crippling",rating:3},"piercing","reinforced","shocking"], special:"Демоническое оружие Best.Q; ∞.", equipped:false }),
      DTAL("Adrenaline Rush", "1 ОБ чтобы восстановить все Реакции."),
      DTAL("Ambidextrous", "−10 штраф за 2 оружия; нет штрафа за левую руку."),
      DTAL("Assassin Strike", "Acrobatics+0 для отскока после атаки."),
      DTAL("Combat Master", "Враги не получают бонуса за толпу."),
      DTAL("Counter Attack", "Атака с −10 после парирования."),
      DTAL("Crippling Strike", "+2 Отрицательных Ран в рукопашной."),
      DTAL("Hard Target", "−10 на стрельбу по персонажу при Беге и Натиске."),
      DTAL("Heightened Senses (All)", "+10 к тестам на все чувства."),
      DTAL("Jumper", "Прыжки за полудействие."),
      DTAL("Lightning Attack", "Приём с −20 на Успехи попаданий."),
      DTAL("Lightning Reflexes", "Бросает 2 раза на Init."),
      DTAL("Mimic", "Имитация чужого голоса."),
      DTAL("Pirouette", "Прыжок с пути несущегося вперёд врага."),
      DTAL("Precise Blow", "−10 штраф за Избирательный удар или Размер."),
      DTAL("Preternatural Speed", "Натиск со скоростью Бега."),
      DTAL("Quick Draw", "Взять оружие за свободное действие."),
      DTAL("Show-Off", "Устрашающая демонстрация мастерства."),
      DTAL("Solipsism", "Переброс тестов против контроля разума."),
      DTAL("Step Aside", "+1 Реакция."),
      DTAL("Sure Strike", "−10 штраф за Избирательный удар или Размер."),
      DTAL("Swift Attack", "Приём с −10 на ½ Успехи попаданий."),
      DTAL("Two-Weapon Wielder (Melee)", "Бой двумя оружиями со штрафом −20."),
      DTAL("Арсенал Совершенства", "Оружие Daemonic Armament: +1 кубик, Crippling (3), Shocking, Best.Q; раз в Ход трансформация оружия.", 3),
      DTAL("Аура Уступчивости", "Раз в Ход тест W+0 в 25м — цель очарована (подчиняется командам +30). Не на герольдов+.", 3),
      DTAL("Мастер Отражений", "До 2 атак в Ход, если одна — психосила Иллюзионизма; до 3 иллюзий без потери тPR.", 3),
      DTAL("Владыка Умов", "Психосилы на разум игнорируют From Beyond целей-демонов.", 3)
    ]
  },

  {
    name: "Великий Нечистый", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Нургл", img: DIMG("Nurgle"), prototypeToken: DTOKEN("Nurgle"),
    system: {
      allegiance: "nurgle", rank: "greater", form: "trueForm", instabilityRating: 7, isDaemon: true, isPsyker: true,
      portfolio: "Владыка Разложения", size: 3,
      characteristics: CH({ ws:77, bs:42, s:63, t:77, ag:21, int:84, per:56, wp:75, fel:63, inf:74 }),
      wounds: { value: 231, max: 231, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ athletics:"veteran", awareness:"trained", charm:"expert", command:"veteran", commerce:"trained", deceive:"trained", logic:"expert", interrogate:"trained", intimidate:"expert", medicae:"expert", parry:"veteran", psyniscience:"veteran", scrutiny:"expert", survival:"veteran" }),
      groupSkills: GSK([["scholasticLore","Chymistry","expert",114],["scholasticLore","Numerology","expert",114],["forbiddenLore","Daemons","expert",114],["forbiddenLore","Heresy","veteran",104],["forbiddenLore","Warp","veteran",104],["linguistics","True Tongue","veteran",104],["trade","Chymist","expert",114],["trade","Musician","veteran",83]]),
      notes: DNOTE("Высший демон Нургла — огромный разлагающийся Владыка Разложения, почти неуничтожимый и не чувствующий боли. Колдун смерти и перерождения. Демонический псайкер (PR 7). Размер 3, 231 Рана.",
        "<b>Псайкер:</b> знает все психосилы Нургла + 7 из Биомантии, фокус в обеих; раз в Раунд психосила Нургла — авто-успех с 1d5+2 Успехами.",
        "<b>Тантрум:</b> вместо атаки бьёт оружием оземь и взрывает его — 3 шаблона Blast (3) с профилем оружия (−1 кубик, Pen 0, Flush).",
        "<b>Аура Энтропии:</b> при непоглощённом уроне (кроме E(Fl)/Нестабильности/Change) — призвать рой Нурглингов или вылечить рой/Паланкин; +отдельный тест T против существа в 25м (урон S/Т, −1 к Качеству предмета).",
        "<b>Носильщики:</b> поглощает рой Нурглингов в 7м → скорость. <b>Мастер Жизни и Смерти:</b> до 2 Контактов Плоти в Ход.")
    },
    kit: [
      DTR("Daemonic (7)", "×7 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:7}] }, 7),
      DTR("Unnatural S (8)", "Сверхъестественная Сила: +8 к S.b.", { charBonuses:[{stat:"s",value:8}] }, 8),
      DTR("Unnatural T (10)", "Сверхъестественная Стойкость: +10 к T.b.", { charBonuses:[{stat:"t",value:10}] }, 10),
      DTR("Unnatural I (4)", "Сверхъестественный Интеллект: +4 к Int.b.", { charBonuses:[{stat:"int",value:4}] }, 4),
      DTR("Unnatural F (2)", "Сверхъестественная Харизма: +2 к F.b.", { charBonuses:[{stat:"fel",value:2}] }, 2),
      DTR("Daemonic Armament (Желчный Меч)", "Может призывать/развеивать демоническое оружие."),
      DTR("Daemonic Presence (20/20)", "Аура присутствия демона (20 м)."), DTR("Dark Sight", "Видит в темноте."),
      DTR("Fanatic", "Обязан защищать паству; +1 Реакция на защиту."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(4), DTR("Mockery of Life", "Раз в Раунд при падении ниже 0 Ран — Т+10, при Успехе остаться с 0. Иммунитет ко всем ядам."),
      DTR("Psyker (PR 7)", "Демонический псайкер, Сила Псионики 7.", {}, 7),
      DTR("Regeneration (5)", "В начале Хода восстанавливает 5 Ран."),
      DTR("Sturdy", "Устойчив: труднее сбить/сдвинуть."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Кулаки, Пинок, Укус."),
      Dw("Fists / Кулаки (×2)", { dmg:"1d10+18", type:"impact", pen:0, props:["reinforced",{key:"toxic",rating:2}], special:"Считается ладонью (0-5)." }),
      Dw("Bite / Укус", { dmg:"3d10+7", type:"chemical", pen:7, props:[{key:"corrosive",rating:7},{key:"bane",rating:3},"reinforced"], special:"Только в борьбе.", equipped:false }),
      Dw("Kick / Пинок", { dmg:"1d10+19", type:"impact", pen:0, props:["imprecise","reinforced"], special:"Удар ногой.", equipped:false }),
      Dw("Bile Sword / Желчный Меч", { dmg:"2d10+20", type:"rending", pen:5, props:[{key:"corrosive",rating:3},{key:"toxic",rating:4},"reinforced"], special:"Демоническое оружие (2-6); 2р/Об.", equipped:false }),
      Dw("Putrid Vomit / Гнилостная Рвота", { cls:"ranged", wtype:"Пистолет", rng:"30м", dmg:"3d10+3", type:"chemical", pen:3, rofS:true, props:[{key:"corrosive",rating:3},{key:"bane",rating:3},"independent",{key:"proven",rating:3},"spray",{key:"linger",rating:3}], special:"∞.", equipped:false }),
      DTAL("Ambidextrous", "−10 штраф за 2 оружия; нет штрафа за левую руку."),
      DTAL("Combat Formation", "Использует I.b для Init +1 Init."),
      DTAL("Counter Attack", "Атака с −10 после парирования."),
      DTAL("Crippling Strike", "+2 Отрицательных Ран в рукопашной."),
      DTAL("Crushing Blow", "+½ WS.b к рукопашному урону."),
      DTAL("Disarm", "WS+0 vs WS+0, чтобы обезоружить."),
      DTAL("Disturbing Voice", "+10 на запугивание, −10 на общение с трусами."),
      DTAL("Fast Stitches", "Быстрая первая помощь в бою."),
      DTAL("Hammer Blow", "+½ WS.b к Pen и Concussive для Полной атаки."),
      DTAL("Hardened Soul", "+½ I.b при поглощении урона варп-оружия."),
      DTAL("Hunker Down", "Удвоенная эффективность укрытий."),
      DTAL("Iron Jaw", "Т+0, чтобы игнорировать Оглушение."),
      DTAL("Quick Draw", "Взять оружие за свободное действие."),
      DTAL("Reckless Charge", "Полная атака с Натиска."),
      DTAL("Steady Footwork", "Нет штрафов к WS от ландшафта."),
      DTAL("Step Aside", "+1 Реакция."),
      DTAL("Swift Attack", "Приём с −10 на ½ Успехи попаданий."),
      DTAL("Takedown", "Оглушить неприцельно любым оружием."),
      DTAL("Tenacity", "Второй шанс на единственную атаку в Ход."),
      DTAL("Thunder Charge", "Улучшенный Напролом."),
      DTAL("Total Recall", "Может вспоминать точные детали без теста."),
      DTAL("Тантрум", "Вместо атаки — взрыв оружия оземь: 3 шаблона Blast (3) профилем оружия (−1 кубик, Pen 0, Flush).", 3),
      DTAL("Аура Энтропии", "При непоглощённом уроне — призвать/вылечить Нурглингов; тест T против существа в 25м (урон S/Т, −1 к Качеству).", 3),
      DTAL("Носильщики", "Поглощает рой Нурглингов в 7м для ускорения движения.", 3),
      DTAL("Мастер Жизни и Смерти", "До 2 Контактов Плоти в Ход; всё оружие считается естественным для Контакта Плоти.", 3),
      DTAL("Владыка Ложной Плоти", "Психосилы Биомантии могут воздействовать на демонов как на плоть.", 3)
    ]
  },

  {
    name: "Кровожад", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Кхорн", img: DIMG("Khorne"), prototypeToken: DTOKEN("Khorne"),
    system: {
      allegiance: "khorne", rank: "greater", form: "trueForm", instabilityRating: 6, isDaemon: true, isPsyker: false,
      portfolio: "неостановимая ярость", size: 3,
      characteristics: CH({ ws:99, bs:56, s:88, t:65, ag:50, int:80, per:56, wp:75, fel:48, inf:74 }),
      wounds: { value: 195, max: 195, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ acrobatics:"trained", athletics:"expert", awareness:"expert", charm:"trained", command:"expert", commerce:"trained", dodge:"veteran", intimidate:"expert", logic:"trained", parry:"expert", scrutiny:"expert", survival:"trained" }),
      groupSkills: GSK([["operate","Aeronautica","veteran",70],["operate","Surface","veteran",70],["commonLore","War","expert",110],["scholasticLore","Heraldry","trained",90],["scholasticLore","Judgement","veteran",100],["scholasticLore","Legend","trained",90],["forbiddenLore","Daemons","expert",110],["forbiddenLore","Psykers","expert",110],["forbiddenLore","Heresy","trained",90],["forbiddenLore","Warp","veteran",100],["forbiddenLore","Orks","trained",90],["trade","Armourer","expert",110],["trade","Weaponsmith","expert",110]]),
      notes: DNOTE("Высший демон Кхорна — крылатое воплощение безграничной ярости, живущее лишь ради битвы. Неостановимая сила разрушения и грозный командир. Размер 3, 195 Ран.",
        "<b>Аура Гнева:</b> все в 30м при непоглощённом уроне — тест W+0 или впадают в Ярость; союзники входят/выходят из Ярости свободно, могут Избегать в Ярости.",
        "<b>Высший Воин:</b> раз в Ход рукопашный приём с любой базой. <b>Неостановимая Сила:</b> Unnatural S врага вдвое меньше — не считается при «авто-ничьей».",
        "<b>Пока Она Льётся:</b> тратит рейтинг Unnatural S как Очки Бесчестия (рукопашная/защита от психосил); при смерти существа в 30м восстанавливает 1 рейтинг Unnatural S.",
        "<b>Взор Истины:</b> распознаёт и видит сквозь колдовские иллюзии.")
    },
    kit: [
      DTR("Blood for the Blood God", "Иммунитет к Страху, Пиннингу, психосилам страха; жажда убийства."),
      DTR("Daemonic (6)", "×6 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:6}] }, 6),
      DTR("Unnatural WS (4)", "Сверхъестественное БМ: +4 к WS.b.", { charBonuses:[{stat:"ws",value:4}] }, 4),
      DTR("Unnatural S (14)", "Сверхъестественная Сила: +14 к S.b.", { charBonuses:[{stat:"s",value:14}] }, 14),
      DTR("Unnatural T (6)", "Сверхъестественная Стойкость: +6 к T.b.", { charBonuses:[{stat:"t",value:6}] }, 6),
      DTR("Unnatural I (4)", "Сверхъестественный Интеллект: +4 к Int.b.", { charBonuses:[{stat:"int",value:4}] }, 4),
      DTR("Natural Armour (8/10/8/8)", "Бронзовая шкура: 10 тело, 8 остальное.", { armourAll:8 }, 8),
      DTR("Daemonic Armament (Плеть Кхорна, Топор Кхорна)", "Может призывать/развеивать демоническое оружие."),
      DTR("Daemonic Presence (20/20)", "Аура присутствия демона (20 м)."), DTR("Dark Sight", "Видит в темноте."),
      DTR("Digitigrade (2)", "Пальцеходящие ноги: +2 к передвижению."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(4), DTR("Flyer (15)", "Полёт со скоростью 15.", {}, 15),
      DTR("Nimble (10)", "+10 к Уклонению."),
      DTR("Unnatural Senses (8)", "Сверхчутьё на 8 м."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Рога, Когти×2, Копыта, Крылья×2, Укус."),
      Dw("Claws / Когти (×2)", { dmg:"1d10+29", type:"rending", pen:3, props:["reinforced","tearing"], special:"Считается ладонью (0-4)." }),
      Dw("Bite / Укус", { dmg:"2d10+26", type:"rending", pen:8, props:["flame","reinforced","tearing"], special:"Только в борьбе.", equipped:false }),
      Dw("Horns / Рога", { dmg:"3d10+29", type:"impact", pen:8, props:[{key:"challenge",rating:2},{key:"concussive",rating:3},"imprecise","reinforced",{key:"wrecker",rating:2}], special:"Только с Натиска; лишь по целям Размером 2+.", equipped:false }),
      Dw("Hooves / Копыта", { dmg:"1d10+30", type:"impact", pen:2, props:["imprecise","reinforced"], special:"Удар копытами (ноги).", equipped:false }),
      Dw("Wings / Крылья (×2)", { dmg:"1d10+27", type:"rending", pen:4, props:["reinforced"], special:"Только пешком (SPD 10); отдельная пара рук; −30 на атаки.", equipped:false }),
      Dw("Axe of Khorne / Топор Кхорна", { dmg:"3d10+30", type:"rending", pen:10, props:[{key:"felling",rating:4},{key:"devastating",rating:3},"tearing"], special:"Демоническое оружие Best.Q (2-6); 2р/Кл. 2-й профиль: 1d10+19 Pen 8 Devastating (8) — авто 8 Успехов по всем в 2м/180°.", equipped:false }),
      Dw("Whip of Khorne / Плеть Кхорна", { dmg:"1d10+27", type:"energy", pen:8, props:["flame","flexible","imprecise","reinforced","tearing"], special:"E(Fl); Flame (2d10); до 20м, до 4 целей в 8м друг от друга.", equipped:false }),
      Dw("Hellfire Breath / Дыхание Адского Пламени", { cls:"ranged", wtype:"Пистолет", rng:"20м", dmg:"2d10+8", type:"energy", pen:8, rofS:true, props:[{key:"challenge",rating:2},"flame","independent","spray",{key:"linger",rating:1}], special:"E(Fl); ∞.", equipped:false }),
      DTAL("Ambidextrous", "−10 штраф за 2 оружия; нет штрафа за левую руку."),
      DTAL("Berserk Charge", "+10 к атаке с Натиска."),
      DTAL("Blademaster", "Переброс попаданий клинковым оружием."),
      DTAL("Cold Fury", "Больше контроля в Ярости."),
      DTAL("Combat Formation", "Использует I.b для Init +1 Init."),
      DTAL("Crushing Blow", "+½ WS.b к рукопашному урону."),
      DTAL("Focused Wrath", "Улучшенная трата ОБ на ненавистных врагов."),
      DTAL("Frenzy", "Может войти в Ярость: +10 WS, S, W, −20 BS, I, F."),
      DTAL("Frontline Commander", "Переброс командования с передовой."),
      DTAL("Furious Assault", "Доп. атака за 1 Реакцию после Полной Атаки."),
      DTAL("Hammer Blow", "+½ WS.b к Pen и Concussive для Полной атаки."),
      DTAL("Hatred (Все!)", "+10 на рукопашные атаки по всем."),
      DTAL("Inspire Wrath", "Вызывает ненависть у толпы слушателей."),
      DTAL("Killing Strike", "1 ОБ, чтобы сделать Полную атаку неуклоняемой."),
      DTAL("Lightning Attack", "Приём с −20 на Успехи попаданий."),
      DTAL("Overpower", "S+0 vs S+0, чтобы пробить Парирование."),
      DTAL("Preternatural Speed", "Натиск со скоростью Бега."),
      DTAL("Reckless Charge", "Полная атака с Натиска."),
      DTAL("Riding the Beast", "W+0, чтобы выбирать цель в Ярости."),
      DTAL("Shield of Contempt", "1 ОБ, чтобы аннулировать психосилы на W+0."),
      DTAL("Step Aside", "+1 Реакция."),
      DTAL("Swift Attack", "Приём с −10 на ½ Успехи попаданий."),
      DTAL("Two-Weapon Wielder (Melee)", "Бой двумя оружиями со штрафом −20."),
      DTAL("Аура Гнева", "Все в 30м при уроне — W+0 или Ярость; союзники входят/Избегают в Ярости свободно.", 3),
      DTAL("Высший Воин", "Раз в Ход рукопашный приём с любой базой.", 3),
      DTAL("Неостановимая Сила", "Unnatural S врага вдвое меньше — не считается при «авто-ничьей».", 3),
      DTAL("Пока Она Льётся", "Тратит рейтинг Unnatural S как ОБ; восстанавливает 1 при смерти существа в 30м.", 3),
      DTAL("Взор Истины", "Распознаёт и видит сквозь колдовские иллюзии.", 3),
      DTAL("Предводитель Крови", "I вместо F для командования; WS вместо F для команд на рукопашные атаки.", 3)
    ]
  },

  {
    name: "Повелитель Перемен", type: "daemon",
    folderParent: "Демоны Хаоса", folder: "Тзинч", img: DIMG("Tzeentch"), prototypeToken: DTOKEN("Tzeentch"),
    system: {
      allegiance: "tzeentch", rank: "greater", form: "trueForm", instabilityRating: 6, isDaemon: true, isPsyker: true,
      portfolio: "Архитектор Судеб", size: 3,
      characteristics: CH({ ws:54, bs:64, s:54, t:63, ag:54, int:99, per:72, wp:81, fel:64, inf:74 }),
      wounds: { value: 160, max: 160, critical: 0, firstAidUsed: false },
      corruption: { value: 100, threshold: 0 },
      skills: SK({ acrobatics:"knows", athletics:"trained", awareness:"expert", charm:"veteran", command:"veteran", commerce:"trained", deceive:"expert", dodge:"veteran", inquiry:"veteran", interrogate:"veteran", intimidate:"trained", logic:"veteran", parry:"trained", psyniscience:"expert", scrutiny:"expert", stealth:"trained" }),
      groupSkills: GSK([["operate","Aeronautica","veteran",74],["scholasticLore","Все!","veteran",119],["forbiddenLore","Daemons","expert",129],["forbiddenLore","Psykers","expert",129],["forbiddenLore","Warp","expert",129],["forbiddenLore","Heresy","veteran",119],["linguistics","True Tongue","trained",109],["trade","Calligraphy","veteran",74],["trade","Linguist","veteran",119],["trade","Soothsayer","trained",74]]),
      notes: DNOTE("Высший демон Тзинча — всевидящий Архитектор Судеб, наделённый высочайшим интеллектом и колдовской мощью, но физически слабейший из высших демонов. Демонический псайкер (PR 9). Размер 3, 160 Ран.",
        "<b>Псайкер:</b> фокусы Тзинча + 2 фундаментальных + 1 любой; знает все психосилы Тзинча + 9 из фокусных/Тауматургии/Колдовства; раз в Раунд авто-успех 1d5+1 (2d5 для Тзинча).",
        "<b>Аура Перемен:</b> раз в Раунд один из эффектов на цель в 30м: отнять ½ I.b Успехов теста / телепортировать в начало движения / перенаправить отбитое щитом попадание / отменить трату Очка Бесчестия.",
        "<b>Верховный Магус:</b> доп. полудействие и Реакция только на психосилы/Пси-капюшон; до 2 атак в Ход, если одна — психосила; до 3 психосил без потери тPR; игнорирует Феномены/Прорывы на себе.",
        "<b>Щит Провидения:</b> +35 к чародейским щитам против стрельбы; может дать эффект союзнику за Реакцию.")
    },
    kit: [
      DTR("Daemonic (6)", "×6 к T.b в Поглощении.", { charBonuses:[{stat:"t",value:6}] }, 6),
      DTR("Unnatural S (6)", "Сверхъестественная Сила: +6 к S.b.", { charBonuses:[{stat:"s",value:6}] }, 6),
      DTR("Unnatural T (5)", "Сверхъестественная Стойкость: +5 к T.b.", { charBonuses:[{stat:"t",value:5}] }, 5),
      DTR("Unnatural I (4)", "Сверхъестественный Интеллект: +4 к Int.b.", { charBonuses:[{stat:"int",value:4}] }, 4),
      DTR("Unnatural P (4)", "Сверхъестественное Восприятие: +4 к Per.b.", { charBonuses:[{stat:"per",value:4}] }, 4),
      DTR("Unnatural W (4)", "Сверхъестественная Воля: +4 к W.b.", { charBonuses:[{stat:"wp",value:4}] }, 4),
      DTR("Unnatural Сor (4)", "Сверхъестественная Порча: +4 к Cor.b."),
      DTR("Daemonic Armament (Посох Тзинча)", "Может призывать/развеивать демоническое оружие."),
      DTR("Daemonic Presence (20/20)", "Аура присутствия демона (20 м)."), DTR("Dark Sight", "Видит в темноте."),
      DTR("Digitigrade (2)", "Пальцеходящие ноги: +2 к передвижению."),
      DTR("From Beyond", "Не дышит/ест/спит; иммунен к ядам/болезням/удушью/вакууму."),
      FEAR(4), DTR("Flyer (12)", "Полёт со скоростью 12.", {}, 12),
      DTR("Nimble (10)", "+10 к Уклонению."),
      DTR("Psyker (PR 9)", "Демонический псайкер, Сила Псионики 9.", {}, 9),
      DTR("Sorcerous Barrier", "Колдовской щит-купол 1-35, вкл/выкл свободным действием."),
      DTR("Stuff of Nightmares", "Иммунитет к Страху/Оглушению/Крит-эффектам разума."),
      DTR("Warp Instability", "Тесты Нестабильности при уроне."), DTR("Warp Sight", "Видит сквозь Завесу и души."),
      DTR("Deadly Natural Weapons", "Когти×2, Птичьи Лапы, Укус."),
      Dw("Claws / Когти (×2)", { dmg:"1d10+14", type:"rending", pen:3, props:["reinforced"], special:"Считается ладонью (0-4)." }),
      Dw("Bite / Укус", { dmg:"2d10+14", type:"rending", pen:8, props:[{key:"change",rating:9},"reinforced","tearing"], special:"Только в борьбе.", equipped:false }),
      Dw("Bird Claws / Птичьи Лапы", { dmg:"1d10+15", type:"rending", pen:3, props:["imprecise","reinforced"], special:"Удар лапами (ноги).", equipped:false }),
      Dw("Staff of Tzeentch / Посох Тзинча", { dmg:"2d10+21", type:"energy", pen:9, props:[{key:"extreme",rating:9},"force",{key:"proven",rating:3}], special:"Демоническое оружие Best.Q; психофокус; тип урона на выбор; 2р/1р.", equipped:false }),
      Dw("Impossible Fire / Невозможное Пламя", { cls:"ranged", wtype:"Пистолет", rng:"180м", dmg:"3d10+9", type:"energy", pen:6, rofS:true, rofSemi:3, rofFull:5, props:[{key:"change",rating:18},{key:"extreme",rating:9}], special:"∞; попадания считаются как психосила.", equipped:false }),
      DTAL("Aegis of Will", "Защитить союзников от своих психосил."),
      DTAL("Bastion of Iron Will", "+PR×5 на встречные тесты против психосил."),
      DTAL("Blade Reader", "Переброс неудач против чужого Финта."),
      DTAL("Combat Formation", "Использует I.b для Init +1 Init."),
      DTAL("Covering Fire", "Стрельба во время выхода из рукопашной."),
      DTAL("Favoured by the Warp", "Бросать два раза на феномен."),
      DTAL("Fluid Weave", "Смена эффекта психосилы."),
      DTAL("Hardened Soul", "+½ I.b при поглощении урона варп-оружия."),
      DTAL("Hip Shooting", "Стрельба на полном ходу."),
      DTAL("Meditation", "Медитировать для усиления психосил."),
      DTAL("Mimic", "Имитация чужого голоса."),
      DTAL("Paranoia", "+2 Init, всегда настороже."),
      DTAL("Psychic Precision", "Уменьшить PR, чтобы прицеливаться."),
      DTAL("Sacrifice", "Убить жертву, чтобы усилить пси-силу."),
      DTAL("Snapshot", "Уничтожить гранаты выстрелом в полёте."),
      DTAL("Step Aside", "+1 Реакция."),
      DTAL("Strong Minded", "Переброс тестов против контроля разума."),
      DTAL("Swift Attack", "Приём с −10 на ½ Успехи попаданий."),
      DTAL("Target Selection", "Нет штрафа за стрельбу в рукопашную."),
      DTAL("Trick Shooter", "+30 на трюкаческие выстрелы."),
      DTAL("Unburdened", "Одна атакующая сила игнорирует штрафы к тPR."),
      DTAL("Warp Sense", "Psyniscience как свободное действие и реакция."),
      DTAL("Аура Перемен", "Раз в Раунд эффект на цель в 30м: отнять Успехи / телепорт в начало движения / перенаправить попадание / отменить трату ОБ.", 3),
      DTAL("Верховный Магус", "Доп. полудействие/Реакция на психосилы; до 2 атак (одна — психосила); до 3 психосил без потери тPR; игнор Феноменов.", 3),
      DTAL("Щит Провидения", "+35 к чародейским щитам против стрельбы; может дать союзнику за Реакцию.", 3)
    ]
  },

  // ══════════════════ II. СМЕРТНЫЕ — СЛУГИ ══════════════════════════════════
  {
    name: "Раб", folderParent: "Смертные Хаоса", folder: "Слуги", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:18, bs:18, s:31, t:32, ag:27, int:25, per:21, wp:19, fel:19, inf:0 }),
      wounds: { value: 6, max: 6, critical: 0, firstAidUsed: false },
      fate: { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ awareness:"knows" }),
      groupSkills: GSK([["commonLore","любое","knows",25],["trade","любое","knows",25],["linguistics","Low Gothic","knows",25]]),
      notes: DNOTE("Дно социальной лестницы Хаоса — расходный материал для труда и жертвоприношений.",
        "<b>Сломленный:</b> покорно выполняет любой приказ хозяина, но не получает преимуществ Командования; для побега — тест W+0.",
        "<b>Реквизиция:</b> обученные — Редкость −3, необученные — −4.")
    },
    kit: [ melee(W.club),
      DTAL("Peer (рабы)", "+10 на общение с фракцией рабов."),
      DTAL("Unremarkable", "Внешность персонажа трудно запомнить."),
      DTAL("Сломленный", "Выполняет любой приказ хозяина, но не получает преимуществ Командования; побег — тест W+0.", 2) ]
  },

  {
    name: "Лакей", folderParent: "Смертные Хаоса", folder: "Слуги", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:25, bs:18, s:33, t:33, ag:35, int:31, per:31, wp:35, fel:35, inf:0 }),
      wounds: { value: 8, max: 8, critical: 0, firstAidUsed: false },
      fate: { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ awareness:"trained", charm:"trained", stealth:"knows" }),
      groupSkills: GSK([["commonLore","любое","trained",41],["trade","любое","trained",41],["linguistics","Low Gothic","knows",25]]),
      notes: DNOTE("Прислужник и куртизан из свиты чемпиона — символ статуса; развлекает и шпионит за гостями.",
        "<b>Снаряжение:</b> светосфера, хроно.",
        "<b>Реквизиция:</b> Редкость 0; талантливые/обученные — +1 к Качеству.")
    },
    kit: [ melee(W.knife),
      DTR("Sycophant", "Мастер лести: +10 на социальные тесты с вышестоящими."),
      DTAL("Peer (слуги)", "+10 на общение с фракцией слуг."),
      DTAL("Unshakeable Will", "Переброс тестов Страха.") ]
  },

  {
    name: "Носильщик", folderParent: "Смертные Хаоса", folder: "Слуги", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:22, bs:22, s:41, t:45, ag:32, int:25, per:21, wp:19, fel:19, inf:0 }),
      wounds: { value: 10, max: 10, critical: 0, firstAidUsed: false },
      fate: { value: 0, max: 0 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ athletics:"knows", awareness:"knows", dodge:"knows" }),
      groupSkills: GSK([["commonLore","любое","knows",25],["trade","любое","knows",25],["linguistics","Low Gothic","knows",25]]),
      notes: DNOTE("Крепкий раб на усиленном питании — таскает награбленное и снаряжение чемпионов.",
        "<b>Носильщик:</b> союзник в базовом контакте берёт/складывает предметы с его разгрузки за свободное действие (неудобные слоты — −1 полудействие носильщику).",
        "<b>Реквизиция:</b> Редкость −2. <b>Снаряжение:</b> рюкзак, бандольер, пояс.")
    },
    kit: [ melee(W.knife), melee(W.club, { equipped: false }),
      DTAL("Double Team", "Ещё +10 за численное превосходство."),
      DTAL("Jaded", "Иммунитет к обыденным ужасам."),
      DTAL("Tireless", "Нет штрафа от усталости для физических действий."),
      DTAL("Unshakeable Will", "Переброс тестов Страха."),
      DTAL("Носильщик", "Союзник в контакте берёт/складывает предметы с разгрузки за свободное действие.", 2) ]
  },

  {
    name: "Старший Слуга", folderParent: "Смертные Хаоса", folder: "Слуги", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:32, bs:34, s:34, t:34, ag:40, int:41, per:40, wp:39, fel:37, inf:0 }),
      wounds: { value: 12, max: 12, critical: 0, firstAidUsed: false },
      fate: { value: 0, max: 1 },
      corruption: { value: 0, threshold: 0 }, insanity: { value: 0, threshold: 0 },
      skills: SK({ awareness:"veteran", charm:"trained", command:"trained", commerce:"knows", deceive:"knows", dodge:"trained", intimidate:"trained", logic:"knows", scrutiny:"veteran", techUse:"knows" }),
      groupSkills: GSK([["commonLore","любое","trained",51],["scholasticLore","любое","knows",41],["trade","любое","veteran",61],["linguistics","Low Gothic","knows",41]]),
      notes: DNOTE("Управляющий свитой чемпиона — ремесленник, администратор, порой советник; говорит от имени хозяина.",
        "<b>Вариации:</b> Пилот (Navigate/Operate +Interface Port), Надсмотрщик (Intimidate/Command/Logic/C.L.War +20, Iron Discipline), Шпион (Inquiry/Stealth/Deceive, Mimic, Multi-Key, Disguise Kit).",
        "<b>Броня:</b> Флак Униформа (−/3/3/3). <b>Снаряжение:</b> пояс, вокс-бусина, светосфера, хроно, инфопланшет.",
        "<b>Реквизиция:</b> Редкость 2, +1 к Качеству за вариацию.")
    },
    kit: [ melee(W.sword), gun(W.handCannon, { equipped: false }), armr(A.flak),
      DTAL("Hunker Down", "Удвоенная эффективность укрытий."),
      DTAL("Journeyman", "Лучше ассистирует для Крафта."),
      DTAL("Jaded", "Иммунитет к обыденным ужасам."),
      DTAL("Peer (слуги)", "+10 на общение с фракцией слуг."),
      DTAL("Slow Shift", "Бонус на Крафт за счёт удлинения смены."),
      DTAL("Unshakeable Will", "Переброс тестов Страха."),
      DTAL("Workaholic", "Нет штрафов за монотонную работу.") ]
  },

  // ══════════════════ II. СМЕРТНЫЕ — КУЛЬТИСТЫ ══════════════════════════════
  {
    name: "Культист Отребье", folderParent: "Смертные Хаоса", folder: "Культисты", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:24, bs:19, s:31, t:33, ag:32, int:25, per:22, wp:19, fel:20, inf:0 }),
      wounds: { value: 6, max: 6, critical: 0, firstAidUsed: false },
      fate: { value: 0, max: 0 },
      corruption: { value: 20, threshold: 0 }, insanity: { value: 15, threshold: 0 },
      skills: SK({ awareness:"knows" }),
      groupSkills: GSK([["commonLore","любое","knows",25],["linguistics","Low Gothic","knows",25]]),
      notes: DNOTE("Безоружная гражданская масса культа — живая волна, давящая числом.",
        "<b>Вооружённые:</b> некоторые получают WS 26, BS 24 и два оружия (Булава/Топор/Копьё/Стаб Револьвер/Карабин/Винтовка).",
        "<b>Как Низший Миньон-человек / Орда Миньонов.</b>")
    },
    kit: [ melee(W.club),
      DTAL("Double Team", "Ещё +10 за численное превосходство."),
      DTAL("Unremarkable", "Внешность персонажа трудно запомнить.") ]
  },

  {
    name: "Культист Посвящённый", folderParent: "Смертные Хаоса", folder: "Культисты", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:31, bs:28, s:35, t:36, ag:33, int:28, per:31, wp:30, fel:28, inf:0 }),
      wounds: { value: 8, max: 8, critical: 0, firstAidUsed: false },
      fate: { value: 0, max: 0 },
      corruption: { value: 25, threshold: 0 }, insanity: { value: 20, threshold: 0 },
      skills: SK({ awareness:"knows", command:"knows", deceive:"knows", dodge:"knows", intimidate:"knows" }),
      groupSkills: GSK([["commonLore","Chaos","trained",38],["commonLore","любое","knows",28],["linguistics","Low Gothic","knows",28]]),
      notes: DNOTE("Костяк боевой силы культа — частично компетентные бойцы, возглавляют орды отребья.",
        "<b>Огневая Поддержка:</b> 1-2 бойца несут Огнемёт / Тяжёлый Стаббер / Гранатомёт вместо автогана.",
        "<b>Броня:</b> Импровизированная (2/3/2/2). <b>Как Низший Миньон / Орда Миньонов.</b>")
    },
    kit: [ gun(W.autogun), gun(W.autopistol, { equipped: false }), armr(A.leather),
      DTAL("Double Team", "Ещё +10 за численное превосходство."),
      DTAL("Quick Draw", "Взять оружие за свободное действие."),
      DTAL("Nerves of Steel", "Переброс тестов Подавления."),
      DTAL("Takedown", "Оглушить неприцельно любым оружием.") ]
  },

  {
    name: "Культист Фанатик", folderParent: "Смертные Хаоса", folder: "Культисты", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:38, bs:28, s:42, t:45, ag:35, int:23, per:31, wp:35, fel:28, inf:0 }),
      wounds: { value: 12, max: 12, critical: 0, firstAidUsed: false },
      fate: { value: 0, max: 1 },
      corruption: { value: 35, threshold: 0 }, insanity: { value: 30, threshold: 0 },
      skills: SK({ athletics:"trained", awareness:"knows", command:"knows", dodge:"knows", intimidate:"veteran", parry:"trained" }),
      groupSkills: GSK([["commonLore","Chaos","veteran",43],["commonLore","любое","knows",23],["linguistics","Low Gothic","knows",23]]),
      notes: DNOTE("Крепкие рукопашники культа с арсеналом настоящего оружия; «мышцы» лидеров, идеологически обработанные до фанатизма.",
        "<b>Вариации:</b> Берсерк (2-е рукопашное вместо пистолета), Молотильщик (Двуручный Пиломеч/Пилосекира/Метеоритный Молот), Оплот (Штурмовой Щит вместо пистолета).",
        "<b>Броня:</b> Импровизированная+Кираса (0/6/2/2). <b>Как Средний Миньон-человек.</b> Химия: 1×Stimm, 1×Spur.")
    },
    kit: [ melee(W.chainaxe), gun(W.autopistol, { equipped: false }), armr(A.carapace),
      DTAL("Ambidextrous", "−10 штраф за 2 оружия; нет штрафа за левую руку."),
      DTAL("Berserk Charge", "+10 к атаке с Натиска."),
      DTAL("Double Team", "Ещё +10 за численное превосходство."),
      DTAL("Fire in the Blood", "Вход в Ярость за полудействие."),
      DTAL("Field Execution", "Казнь, чтобы подавить страх и панику."),
      DTAL("Frenzy", "Может войти в Ярость: +10 WS, S, W, −20 BS, I, F."),
      DTAL("Idolater", "Бесстрашие в присутствии кумира."),
      DTAL("Nerves of Steel", "Переброс тестов Подавления."),
      DTAL("Pity the Weak", "Бонусы к командованию слабыми."),
      DTAL("Takedown", "Оглушить неприцельно любым оружием."),
      DTAL("Two-Weapon Wielder (Оба)", "Бой двумя оружиями со штрафом −20.") ]
  },

  {
    name: "Культист Разведчик", folderParent: "Смертные Хаоса", folder: "Культисты", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:33, bs:33, s:32, t:33, ag:42, int:31, per:41, wp:32, fel:21, inf:0 }),
      wounds: { value: 10, max: 10, critical: 0, firstAidUsed: false },
      fate: { value: 0, max: 1 },
      corruption: { value: 30, threshold: 0 }, insanity: { value: 25, threshold: 0 },
      skills: SK({ acrobatics:"trained", athletics:"trained", awareness:"veteran", dodge:"veteran", deceive:"knows", stealth:"veteran", medicae:"knows", survival:"veteran", techUse:"knows" }),
      groupSkills: GSK([["navigation","Surface","veteran",51],["commonLore","Chaos","trained",51],["commonLore","любое","knows",41],["trade","Cook","trained",51],["linguistics","Low Gothic","knows",41]]),
      notes: DNOTE("Бывшие охотники, контрабандисты и воры — разведка, слежка, засады, ловля «языков».",
        "<b>Вариации:</b> Диверсант (Tech-Use/Trade Technomat, Подрывные Заряды), Охотник за головами (Intimidate/Interrogate, наручники), Снайпер (BS 38 + Снайперская Винтовка/Лук/Лонглаз/Арбалеста).",
        "<b>Броня:</b> Импровизированная (−/3/2/2). <b>Как Средний Миньон-человек.</b>")
    },
    kit: [ melee(W.knife), gun(W.lasgun, { equipped: false }), armr(A.leather),
      DTAL("Catfall", "Уменьшает урон от падения."),
      DTAL("Deadeye Shot", "−10 штраф за Избирательный выстрел / Размер."),
      DTAL("Heightened Senses (Sight, Hearing)", "+10 к тестам зрения и слуха."),
      DTAL("Leap Up", "Встать за свободное действие."),
      DTAL("Lightning Reflexes", "Бросает 2 раза на Init."),
      DTAL("Light Sleeper", "Нет штрафа на тесты Восприятия во время сна."),
      DTAL("Quick Draw", "Взять оружие за свободное действие."),
      DTAL("Rapid Reaction", "А+0, чтобы избежать засады."),
      DTAL("Sentry", "Преимущество на пассивную Awareness.") ]
  },

  {
    name: "Культист Боевик", folderParent: "Смертные Хаоса", folder: "Культисты", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:33, bs:38, s:32, t:41, ag:38, int:31, per:35, wp:32, fel:28, inf:0 }),
      wounds: { value: 10, max: 10, critical: 0, firstAidUsed: false },
      fate: { value: 0, max: 1 },
      corruption: { value: 30, threshold: 0 }, insanity: { value: 25, threshold: 0 },
      skills: SK({ acrobatics:"knows", awareness:"trained", command:"trained", dodge:"trained", intimidate:"knows", logic:"knows", medicae:"knows", techUse:"knows" }),
      groupSkills: GSK([["commonLore","War","knows",31],["commonLore","Chaos","trained",41],["commonLore","любое","knows",31],["trade","Earthworks","trained",41],["linguistics","Low Gothic","knows",31]]),
      notes: DNOTE("Профессиональные солдаты культа — укрытия, огонь на подавление, обходы, полевые укрепления.",
        "<b>Вариации:</b> Специалист (Огнемёт/Гранатомёт/Мельтаган/Плазмаган/Снайперка вместо винтовки), Тяжёлый Расчёт (Автопушка/Тяж.Огнемёт/Тяж.Болтер/Спар.Стаббер/Ракетная Установка).",
        "<b>Броня:</b> Сборная флак (4/4/3/3). <b>Как Средний Миньон-человек.</b>")
    },
    kit: [ gun(W.lasgun), gun(W.autopistol, { equipped: false }), armr(A.flak),
      DTAL("Deadeye Shot", "−10 штраф за Избирательный выстрел / Размер."),
      DTAL("Double Team", "Ещё +10 за численное превосходство."),
      DTAL("Heightened Senses (Sight)", "+10 к тестам зрения."),
      DTAL("Leap Up", "Встать за свободное действие."),
      DTAL("Nerves of Steel", "Переброс тестов Подавления."),
      DTAL("Rapid Reload", "Сокращает время перезарядки вдвое."),
      DTAL("Quick Draw", "Взять оружие за свободное действие."),
      DTAL("Technical Knock", "Расклин за полудействие.") ]
  },

  {
    name: "Культист Мутант", folderParent: "Смертные Хаоса", folder: "Культисты", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:43, bs:28, s:42, t:45, ag:38, int:23, per:31, wp:35, fel:21, inf:0 }),
      wounds: { value: 18, max: 18, critical: 0, firstAidUsed: false },
      fate: { value: 0, max: 1 },
      corruption: { value: 72, threshold: 0 }, insanity: { value: 30, threshold: 0 },
      skills: SK({ athletics:"veteran", acrobatics:"knows", awareness:"trained", dodge:"trained", intimidate:"trained", parry:"veteran" }),
      groupSkills: GSK([["commonLore","Chaos","trained",33],["commonLore","любое","knows",23],["linguistics","Low Gothic","knows",23]]),
      notes: DNOTE("Культист, благословлённый полезной мутацией — хитиновый панцирь и оружие-конечности вместо брони и клинков.",
        "<b>Вариации:</b> Бессмертный (Regeneration 3 + Undying), Живое Оружие (+1 естественное оружие, нет ладоней), Здоровяк (S 52, +5 Ран, Размер 1), Псевдодемон (Daemonic 3 + Warp Instability, +7 Ран).",
        "<b>Как Средний Миньон-человек.</b>")
    },
    kit: [ melee(W.knife),
      DTR("Natural Armour (4)", "Естественная броня: 4 по всем локациям.", { armourAll:4 }, 4),
      DTR("Unnatural S (3)", "Сверхъестественная Сила: +3 к S.b.", { charBonuses:[{stat:"s",value:3}] }, 3),
      DTR("Unnatural T (3)", "Сверхъестественная Стойкость: +3 к T.b.", { charBonuses:[{stat:"t",value:3}] }, 3),
      DTR("Deadly Natural Weapons (2)", "Смертельное естественное оружие."),
      DTR("Fanatic", "Обязан защищать духовного лидера; +1 Реакция на защиту."),
      Dw("Claws / Когти", { dmg:"1d10+9", type:"rending", pen:2, props:["reinforced"], special:"Естественное оружие (0-1). Альтернативы: Клешня 2d10+7 Crunch; Рука-Клинок 1d10+9; Щупальца 1d10+9 Flexible, Multi-strike (3)." }),
      DTAL("Ambidextrous", "−10 штраф за 2 оружия; нет штрафа за левую руку."),
      DTAL("Berserk Charge", "+10 к атаке с Натиска."),
      DTAL("Double Team", "Ещё +10 за численное превосходство."),
      DTAL("Fearless", "Иммунитет к Страху, Панике и Подавлению."),
      DTAL("Fire in the Blood", "Вход в Ярость за полудействие."),
      DTAL("Frenzy", "Может войти в Ярость: +10 WS, S, W, −20 BS, I, F."),
      DTAL("Nerves of Steel", "Переброс тестов Подавления."),
      DTAL("Takedown", "Оглушить неприцельно любым оружием."),
      DTAL("Two-Weapon Wielder (Melee)", "Бой двумя оружиями со штрафом −20.") ]
  },

  {
    name: "Культист Ведьма", folderParent: "Смертные Хаоса", folder: "Культисты", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      isPsyker: true,
      psyker: { class: "unbound", rating: 3, sustain: 0, currentRating: 3 },
      characteristics: CH({ ws:31, bs:23, s:32, t:32, ag:38, int:31, per:41, wp:42, fel:23, inf:0 }),
      wounds: { value: 10, max: 10, critical: 0, firstAidUsed: false },
      fate: { value: 0, max: 1 },
      corruption: { value: 35, threshold: 0 }, insanity: { value: 30, threshold: 0 },
      skills: SK({ awareness:"trained", dodge:"trained", intimidate:"trained", parry:"trained", psyniscience:"trained" }),
      groupSkills: GSK([["commonLore","Chaos","trained",41],["commonLore","любое","knows",31],["forbiddenLore","Warp","knows",31],["linguistics","Low Gothic","knows",31]]),
      notes: DNOTE("Несвязанный псайкер культа (PR 3) — почитаемая, но недолговечная. Выбирает 5 психосил из одной дисциплины с фокусом.",
        "<b>Псайкер:</b> несвязанный, часто манифестирует в усиленном режиме. Психосилы вложить из компендиума.",
        "<b>Броня:</b> Импровизированная (0/3/2/2). <b>Как Средний Миньон-человек.</b> Снаряжение: психофокус (Poor.Q).")
    },
    kit: [ melee(W.knife), gun(W.laspistol, { equipped: false }),
      DTR("Mutant (1)", "Одна мутация."),
      DTR("Psyker (PR 3)", "Несвязанный псайкер, Сила Псионики 3.", {}, 3),
      DTAL("Corpus Conversion", "Урон в Т, чтобы усилить психосилу."),
      DTAL("Gaze Into the Abyss", "На 1 меньше Порчи от психосил и демонов."),
      DTAL("Jaded", "Иммунитет к обыденным ужасам."),
      DTAL("Meditation", "Усиление психосил и лечение Характеристик."),
      DTAL("Paranoia", "+2 Init, всегда настороже."),
      DTAL("Resistance (Fear)", "+10 на тесты сопротивления страху."),
      DTAL("Unshakeable Will", "Переброс тестов Страха."),
      DTAL("Warp Sense", "Psyniscience как свободное действие и реакция.") ]
  },

  {
    name: "Культист Демагог", folderParent: "Смертные Хаоса", folder: "Культисты", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:33, bs:28, s:32, t:33, ag:32, int:38, per:35, wp:41, fel:43, inf:0 }),
      wounds: { value: 10, max: 10, critical: 0, firstAidUsed: false },
      fate: { value: 0, max: 1 },
      corruption: { value: 35, threshold: 0 }, insanity: { value: 30, threshold: 0 },
      skills: SK({ awareness:"trained", charm:"veteran", command:"trained", commerce:"trained", deceive:"veteran", dodge:"knows", inquiry:"trained", intimidate:"trained", logic:"trained", scrutiny:"veteran" }),
      groupSkills: GSK([["commonLore","любое","knows",38],["forbiddenLore","Heresy","trained",48],["trade","любое","knows",38],["linguistics","Low Gothic","trained",48]]),
      notes: DNOTE("Пламенный оратор культа — ведёт орды в бой и вербует рекрутов; проникает во вражеские ряды, подрывая мораль.",
        "<b>Вариации:</b> Предводитель (Command/C.L.War, Back to Back, Iron Discipline, флак), Проповедник (F 48, For.Lore Heresy, Good Reputation), Исповедник (подчинённым — Fearless + Подрывной Жилет), Шпион (A 37, Security/Stealth/Sleight, Мульти-Ключ).",
        "<b>Броня:</b> Импровизированная (−/3/2/2). <b>Как Средний Миньон-человек.</b>")
    },
    kit: [ melee(W.chainsword), gun(W.autopistol, { equipped: false }), armr(A.leather),
      DTAL("Air of Authority", "×10 подчинённых для командования."),
      DTAL("Decadence", "Сопротивление алкоголю и зависимостям."),
      DTAL("Demagogue", "Размер аудитории ×100."),
      DTAL("Inspire Wrath", "Вызывает ненависть у толпы слушателей."),
      DTAL("Jaded", "Иммунитет к обыденным ужасам."),
      DTAL("Mimic", "Имитация чужого голоса."),
      DTAL("Paranoia", "+2 Init, всегда настороже."),
      DTAL("Peer (любые 3)", "+10 на общение с фракцией."),
      DTAL("Unshakeable Will", "Переброс тестов Страха.") ]
  },

  {
    name: "Культист Жрец", folderParent: "Смертные Хаоса", folder: "Культисты", img: IMG,
    system: {
      race: "human", alignment: "heretic", size: 0,
      characteristics: CH({ ws:28, bs:25, s:32, t:33, ag:35, int:43, per:32, wp:41, fel:36, inf:0 }),
      wounds: { value: 10, max: 10, critical: 0, firstAidUsed: false },
      fate: { value: 0, max: 1 },
      corruption: { value: 61, threshold: 0 }, insanity: { value: 35, threshold: 0 },
      skills: SK({ awareness:"knows", charm:"trained", command:"knows", deceive:"veteran", dodge:"knows", intimidate:"trained", logic:"trained", scrutiny:"trained" }),
      groupSkills: GSK([["commonLore","любое","knows",43],["scholasticLore","Occult","knows",43],["forbiddenLore","Daemons","trained",53],["forbiddenLore","Heresy","veteran",63],["forbiddenLore","Warp","knows",53],["trade","Soothsayer","trained",46],["linguistics","True Tongue","knows",43]]),
      notes: DNOTE("Младший оккультист культа — проводит ритуалы, призывает демонов, превращает это в спектакль веры.",
        "<b>Вариации (ритуалы):</b> Демонолог (For.Lore Daemons +20; Ад в Бутылке, Ритуал Цепей, Ритуал Одержимости), Каратель (проклятья Куклы/Тьмы/Кривой Руки), Придворный (Charm/Scrutiny; Неуязвимость/Котёл/Переполнение), Криптомант (Logic/Security; Маяк/Тёмное Письмо/Однодневка).",
        "<b>Как Средний Миньон-человек.</b> Снаряжение: нечестивые тома (Poor.Q), 2 рунические вязи.")
    },
    kit: [ melee(W.knife), gun(W.autopistol, { equipped: false }),
      DTAL("Erudite-Infernal", "Нет штрафов за незнание демона."),
      DTAL("Foresight", "5 минут на раздумья дают +10 на тест I."),
      DTAL("Forsaken", "Стойкость к психосилам, слабость к демонам."),
      DTAL("Infernal Familiarity", "−1 к Страху демонов, −5 к их Присутствию."),
      DTAL("Infernal Master", "Командовать демонами через For.Lore (Daemons)."),
      DTAL("Jaded", "Иммунитет к обыденным ужасам."),
      DTAL("Meditation", "Усиление психосил и лечение Характеристик."),
      DTAL("Mind Killer", "Шок − ½I; I−10 для действий в панике."),
      DTAL("Resistance (Fear)", "+10 на тесты сопротивления Страху.") ]
  }
];

// ── Друкхари (отдельный модуль) — досыпаем в общую библиотеку ────────────────
BESTIARY_LIBRARY.push(...DRUKHARI_BESTIARY);

// ── Помощники для демонов бестиария (function-декларации — хостятся) ─────────
function DIMG(sigil) { return `systems/warhammer-dbc/assets/${sigil}.png`; }
function DTOKEN(sigil) {
  return { texture: { src: `systems/warhammer-dbc/assets/${sigil}.png` }, actorLink: false };
}
function DNOTE(...paras) { return paras.map(p => `<p>${p}</p>`).join(""); }
// Групповые навыки: [[gkey, спец, rank, total], ...]
function GSK(list) {
  const o = {};
  for (const [g, spec, rank, total] of list) {
    (o[g] ??= []).push({ specialty: spec, rank, char: "int", total, cost: 0 });
  }
  return o;
}
// Демоническая Черта (можно с charBonuses/эффектами и рейтингом).
function DTR(name, benefit, effects = {}, rating = null) {
  return {
    inline: {
      name, type: "trait", img: "icons/svg/aura.svg",
      system: { description: "", benefit, source: "демон",
        hasRating: rating != null, rating: rating ?? 0, hasRating2: false, rating2: 0,
        effects: { charBonusStat: "", charBonusValue: 0, armourAll: 0, fearRating: 0, sizeMod: 0, ...effects } }
    }
  };
}
// Демонический талант / особая способность (инлайн-талант).
function DTAL(name, benefit, tier = 1) {
  return {
    inline: {
      name, type: "talent", img: "icons/svg/upgrade.svg",
      system: { description: "", benefit, tier, requirement: "", aptitudes: [], god: "", specialization: "",
        effects: { charBonusStat: "", charBonusValue: 0, initMod: 0, fearRating: 0, speedMod: 0 } }
    }
  };
}
// Демоническое естественное оружие (инлайн).
function Dw(name, o) {
  return {
    inline: {
      name, type: "weapon", img: "icons/svg/sword.svg",
      system: {
        weaponClass: o.cls || "melee", weaponType: o.wtype || "Естественное",
        range: o.rng || "0", damage: o.dmg, damageType: o.type || "rending",
        penetration: o.pen || 0, quality: "common", availability: "",
        weaponProps: (o.props || []).map(p => (typeof p === "string" ? { key: p } : p)),
        special: o.special || "", equipped: o.equipped !== false,
        magazineCur: o.clip || 0, magazineMax: o.clip || 0,
        rof_single: o.rofS ?? (o.cls === "ranged"), rof_semi: o.rofSemi || 0, rof_full: o.rofFull || 0,
        attackBonus: 0, balance: 0, reload: o.reload || "", needsRecharge: !!o.recharge
      }
    }
  };
}
