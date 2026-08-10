// ════════════════════════════════════════════════════════════════════════
//  Библиотека Техники (Warhammer DBC) — компендиум-Actor «vehicles».
//  Статблоки машин из DoomBC_Machines.pdf. Заводится ready-хуком
//  (см. warhammer-dbc.mjs) неразрушающе по имени.
//
//  ОРУДИЯ и ЧЕРТЫ резолвятся из компендиумов «vehicle-weapons» и
//  «vehicle-traits» по имени (гибко, по EN-подстроке) и вкладываются копиями;
//  места (stations) создаются из списка crew, орудия привязываются к первому
//  месту своей роли. Отсутствующее оружие/черта пропускается с предупреждением.
//
//  Формат записи оружия: { w:"EN name", role, mount, hArc, vArc, std?, alt? }
//    alt: [ "EN name", ... ] — альтернативы на том же разъёме (не осн. комплект).
//  crew: ["driver","gunner",...] или { role, n } для нескольких мест/пассажиров.
//  Числа — стартовый ориентир для ГМа.
// ════════════════════════════════════════════════════════════════════════

// Строитель записи машины. o: {cls,vtype,r,chassis,man,ap,struct,size,crew,traits,weapons,gear,notes}
const V = (folder, name, o) => ({
  name, folder,
  system: {
    vehicleClass: o.cls || "", vehicleType: o.vtype || "other",
    origin: o.origin || "", commander: "",
    manoeuvrability: o.man ?? 0,
    operate: o.operate ?? 0,
    size: o.size ?? 0,
    chassis: {
      type: o.chassis?.type || "tracked",
      spd: o.chassis?.spd ?? 0,
      spdDamage: 0, manoeuvreDamage: 0,
      strength: o.chassis?.strength ?? 0, unnaturalS: o.chassis?.unnaturalS ?? 0
    },
    armour: { front: o.ap?.[0] ?? 0, side: o.ap?.[1] ?? 0, rear: o.ap?.[2] ?? 0 },
    structure: { value: o.struct ?? 0, max: o.struct ?? 0, critical: 0 },
    ammoReloads: 10,
    availability: o.r ?? 0,
    notes: o.notes || "", gmNotes: ""
  },
  // «сырые» описания для сид-хука (резолв в предметы/места):
  _crew: o.crew || [],
  _traits: o.traits || [],
  _weapons: o.weapons || [],
  _rarity: o.r ?? 0
});

const GUARD  = "Гвардия";
const LEGION = "Легионы";
const CHAOS  = "Хаос";
const DAEMON = "Демонические Машины";
const DREAD  = "Дредноуты";
const MECH   = "Механикус";
const PLATFORM = "Орудийные Платформы";
const DRU    = "Друкхари";

export const VEHICLE_LIBRARY = [

  // ─────────────── ГВАРДИЯ: разведка / лёгкие ───────────────
  V(GUARD, "Таурос", {
    cls: "Таурос", vtype: "transport", r: 0,
    chassis: { type: "wheeled", spd: 20 }, man: 15, ap: [16, 14, 14], struct: 20, size: 1,
    crew: ["driver", "gunner"],
    traits: ["Damage Control", "Fast", "Open Topped"],
    weapons: [
      { w: "Heavy Flamer", role: "gunner", mount: "pintle", hArc: "−60°..+60°", vArc: "−8°..+30°", std: true }
    ],
    notes: "<p><b>Гвардия.</b> Лёгкая колёсная машина разведки десантных полков, сбрасываемая с Валькирий. "
         + "<b>Стабилизированная Подвеска</b> (Трудный Ландшафт как Малый Ход; 1d10 на 4+ игнор урона), "
         + "<b>Гальванические Двигатели</b> (½ штрафа SPD от поломок Ходовой, электропитание/солнечные батареи).</p>"
  }),

  V(GUARD, "Таурос Венатор", {
    cls: "Таурос", vtype: "transport", r: 1,
    chassis: { type: "wheeled", spd: 20 }, man: 10, ap: [20, 16, 16], struct: 25, size: 2,
    crew: ["driver", "gunner"],
    traits: ["Damage Control", "Fast", "Open Topped"],
    weapons: [
      { w: "Twin Multilaser", role: "gunner", mount: "turret", hArc: "360°", vArc: "−8°..+30°", std: true,
        alt: ["Twin Lascannon"] }
    ],
    notes: "<p><b>Гвардия.</b> Утяжелённый Таурос с собственным реактором и башенным орудием. "
         + "<b>Стабилизированная Подвеска</b>, <b>Гальванические Двигатели</b> (реактор питает мультилазер).</p>"
  }),

  V(GUARD, "Таурокс", {
    cls: "Таурокс", vtype: "transport", r: 1,
    chassis: { type: "tracked", spd: 15 }, man: 5, ap: [25, 20, 18], struct: 30, size: 3,
    crew: ["commander", "driver", "loader", { role: "passenger", n: 10 }],
    traits: ["Advanced Targeting", "Conductive Plating", "Enclosed", "Side Hatches"],
    weapons: [
      { w: "Twin Autocannon", role: "commander", mount: "turret", hArc: "360°", vArc: "−15°..+15°", std: true },
      { w: "Combi-Bolter", role: "commander", mount: "pintle", hArc: "−150°..+150°", vArc: "−35°..+90°",
        alt: ["Storm Bolter"] }
    ],
    notes: "<p><b>Гвардия.</b> Быстрый гусеничный транспорт; уступает Химере в броне и вездеходности, но быстрее. "
         + "<b>Квад-Траки</b> (переброс тестов Трудного Ландшафта), <b>Бойницы</b> (по 1 в каждом борту, 90°), "
         + "<b>Зарядники</b> (10 батзарядников в отсеке). Снаряжение по умолчанию: Track Guards.</p>"
  }),

  // ─────────────── ГВАРДИЯ: шагоходы ───────────────
  V(GUARD, "Десантный Часовой", {
    cls: "Часовой", vtype: "walker", r: 2,
    chassis: { type: "walker", spd: 11, strength: 55, unnaturalS: 4 }, man: 15, ap: [25, 15, 15], struct: 20, size: 2,
    crew: ["pilot"],
    traits: ["Conductive Plating", "Open Topped", "Orbital Deployment"],
    weapons: [
      { w: "Heavy Bolter", role: "pilot", mount: "hull", hArc: "фикс.", vArc: "—", std: true,
        alt: ["Heavy Flamer", "Autocannon", "Lascannon", "Multilaser", "Missile Launcher"] }
    ],
    notes: "<p><b>Гвардия.</b> Одноместный шагоход-разведчик десантных полков, высаживаемый с орбиты/Валькирий. "
         + "Двигается и атакует как персонаж (S.b 9). <b>Орбитальная Высадка</b>. Оружие — в правой руке (выбор при реквизиции).</p>"
  }),

  // ─────────────── ГВАРДИЯ: БМП / транспорт ───────────────
  V(GUARD, "Химера", {
    cls: "Химера", vtype: "transport", r: 1,
    chassis: { type: "tracked", spd: 13 }, man: 0, ap: [30, 22, 16], struct: 35, size: 3,
    crew: ["commander", "driver", "gunner", { role: "passenger", n: 12 }],
    traits: ["Amphibious", "Conductive Plating", "Enclosed", "Rugged", "Sealed"],
    weapons: [
      { w: "Multilaser", role: "commander", mount: "turret", hArc: "360°", vArc: "−8°..+25°", std: true,
        alt: ["Twin Heavy Bolter", "Autocannon", "Heavy Flamer"] },
      { w: "Heavy Bolter", role: "gunner", mount: "hull", hArc: "−25°..+25°", vArc: "−10°..+25°", std: true,
        alt: ["Heavy Flamer"] },
      { w: "Heavy Stubber", role: "commander", mount: "pintle", hArc: "360°", vArc: "−35°..+90°",
        alt: ["Combi-Bolter", "Storm Bolter"] }
    ],
    notes: "<p><b>Гвардия.</b> Основная БМП Гвардии и армий Хаоса. <b>Огневой люк</b> (до 2 пассажиров/расчёт стреляют из люка), "
         + "<b>Бойницы</b> (по 3 в каждом борту, лазганы по умолчанию), <b>Зарядники</b> (10). "
         + "Опции: Продв. Системы Управления (Advanced Targeting), Командная Химера (Command & Control, пасс. до 6).</p>"
  }),

  V(GUARD, "Саламандра", {
    cls: "Саламандра", vtype: "transport", r: 1,
    chassis: { type: "tracked", spd: 20 }, man: 15, ap: [30, 18, 14], struct: 35, size: 2,
    crew: ["commander", "driver", "gunner", { role: "passenger", n: 1 }],
    traits: ["Amphibious", "Command & Control", "Conductive Plating", "Fast", "Open Topped", "Rugged"],
    weapons: [
      { w: "Autocannon", role: "commander", mount: "fixed", hArc: "−11°..+11°", vArc: "−3°..+24°", std: true,
        alt: ["Heavy Bolter", "Heavy Flamer"] }
    ],
    notes: "<p><b>Гвардия.</b> Лёгкая открытая разведмашина и командно-штабная (наводка артиллерии). "
         + "Связист занимает пассажирское место. Быстрая, манёвренная.</p>"
  }),

  V(GUARD, "Самаритянин", {
    cls: "Самаритянин", vtype: "transport", r: 2,
    chassis: { type: "tracked", spd: 15 }, man: 0, ap: [25, 18, 16], struct: 35, size: 3,
    crew: ["driver", "gunner", { role: "passenger", n: 7 }],
    traits: ["Conductive Plating", "Enclosed", "Sealed"],
    weapons: [
      { w: "Heavy Bolter", role: "gunner", mount: "hull", hArc: "−25°..+25°", vArc: "−10°..+25°", std: true,
        alt: ["Heavy Flamer"] },
      { w: "Heavy Stubber", role: "driver", mount: "pintle", hArc: "−150°..+150°", vArc: "−35°..+90°",
        alt: ["Combi-Bolter", "Storm Bolter"] }
    ],
    notes: "<p><b>Гвардия.</b> Мобильный полевой госпиталь / эвакуация. Военврач, 2 санитара и 4 раненых — пассажиры. "
         + "<b>Мобильный Госпиталь</b> (+10 Medicae, операции на Малом Ходу), <b>Стазис-капсулы</b> ×4 (−2 SPD за активную).</p>"
  }),

  V(GUARD, "Адская Гончая", {
    cls: "Химера", vtype: "tank", r: 2,
    chassis: { type: "tracked", spd: 18 }, man: 10, ap: [30, 28, 16], struct: 30, size: 3,
    crew: ["commander", "driver", "gunner"],
    traits: ["Amphibious", "Conductive Plating", "Enclosed", "Fast", "Reinforced Armour", "Rugged", "Sealed", "Volatile"],
    weapons: [
      { w: "Inferno Cannon", role: "commander", mount: "turret", hArc: "360°", vArc: "−8°..+25°", std: true,
        alt: ["Chem Cannon", "Melta Cannon"] },
      { w: "Heavy Bolter", role: "gunner", mount: "hull", hArc: "−25°..+25°", vArc: "−10°..+25°",
        alt: ["Heavy Flamer"] },
      { w: "Heavy Stubber", role: "commander", mount: "pintle", hArc: "360°", vArc: "−35°..+90°",
        alt: ["Combi-Bolter", "Storm Bolter"] }
    ],
    notes: "<p><b>Гвардия.</b> Быстрый огнемётный танк для зачистки пехоты. Bane Wolf (Химическая Пушка), Devil Dog (Мельта-Пушка). "
         + "<b>Питание от Бака</b>: урон в корму (1d10, 4+) пробивает бак — потеря зарядов, 7+ Пожар (для Инферно/Мельта); "
         + "пустой бак снимает Volatile.</p>"
  }),

  V(GUARD, "Аурокс", {
    cls: "Аурокс", vtype: "transport", r: 2,
    chassis: { type: "tracked", spd: 15 }, man: 0, ap: [25, 25, 20], struct: 25, size: 3,
    crew: ["pilot", { role: "passenger", n: 10 }],
    traits: ["Advanced Controls", "Damage Control", "Enclosed", "Indestructible Chassis", "Sealed", "Side Hatches"],
    weapons: [
      { w: "Heavy Stubber", role: "pilot", mount: "pintle", hArc: "360°", vArc: "−35°..+90°", std: true,
        alt: ["Heavy Flamer", "Combi-Bolter", "Bolter", "Storm Bolter"] }
    ],
    notes: "<p><b>Гвардия / Хаос.</b> Основной БТР Великого Крестового Похода и Ереси, вытеснен Химерой; делит дизайн с Носорогом. "
         + "<b>Огневой люк</b>. Опции: Керамитовая Броня, Двигатель Антиох (Fast, −10 Ман., ×2 штрафы SPD).</p>"
  }),

  // ─────────────── ГВАРДИЯ: боевые танки ───────────────
  V(GUARD, "Боевой Танк Леман Русс", {
    cls: "Леман Русс", vtype: "tank", r: 2,
    chassis: { type: "tracked", spd: 12 }, man: -10, ap: [40, 32, 20], struct: 55, size: 3,
    crew: ["commander", "driver", "gunner", "loader", { role: "gunner", n: 2 }],
    traits: ["Conductive Plating", "Enclosed", "Ponderous", "Reinforced Armour", "Rugged", "Sealed"],
    weapons: [
      { w: "Battle Cannon", role: "commander", mount: "turret", hArc: "360°", vArc: "−8°..+22°", std: true,
        alt: ["Eradicator Nova Cannon", "Vanquisher Battle Cannon"] },
      { w: "Heavy Bolter", role: "gunner", mount: "hull", hArc: "−25°..+25°", vArc: "−10°..+25°", std: true,
        alt: ["Lascannon"] },
      { w: "Heavy Bolter", role: "gunner", mount: "sponson", hArc: "борт", vArc: "—",
        alt: ["Multimelta", "Plasma Cannon"] },
      { w: "Heavy Bolter", role: "gunner", mount: "sponson", hArc: "борт", vArc: "—",
        alt: ["Multimelta", "Plasma Cannon"] }
    ],
    notes: "<p><b>Гвардия.</b> Стандартный боевой танк — отличная лобовая броня и огневая мощь, прост в производстве и обучении. "
         + "Варианты главного орудия: Искоренитель (Нова-Пушка) и Покоритель (охотник на танки). 2 спонсонных стрелка — при наличии спонсонов.</p>"
  }),

  V(GUARD, "Боевой Танк Леман Русс «Разрушитель»", {
    cls: "Леман Русс", vtype: "tank", r: 2,
    chassis: { type: "tracked", spd: 12 }, man: -15, ap: [40, 35, 25], struct: 55, size: 3,
    crew: ["commander", "driver", "gunner", "loader", { role: "gunner", n: 2 }],
    traits: ["Conductive Plating", "Enclosed", "Ponderous", "Reinforced Armour", "Rugged", "Sealed", "Siege"],
    weapons: [
      { w: "Demolisher Cannon", role: "commander", mount: "turret", hArc: "360°", vArc: "−8°..+22°", std: true,
        alt: ["Punisher Gatling Cannon", "Plasma Destroyer"] },
      { w: "Heavy Bolter", role: "gunner", mount: "hull", hArc: "−25°..+25°", vArc: "−10°..+25°", std: true,
        alt: ["Lascannon"] },
      { w: "Heavy Bolter", role: "gunner", mount: "sponson", hArc: "борт", vArc: "—",
        alt: ["Multimelta", "Plasma Cannon"] },
      { w: "Heavy Bolter", role: "gunner", mount: "sponson", hArc: "борт", vArc: "—",
        alt: ["Multimelta", "Plasma Cannon"] }
    ],
    notes: "<p><b>Гвардия.</b> Осадный паттерн Леман Русса: короткоствольные разрушительные орудия (Разрушитель/Каратель/Плазм-Разрушитель), "
         + "толще борт/корма (35/25). <b>Осадная</b> (Siege). В этой книге у Русса два паттерна: стандартный и «Разрушитель».</p>"
  }),

  // ─────────────── ГВАРДИЯ: артиллерия ───────────────
  V(GUARD, "Василиск", {
    cls: "Василиск", vtype: "artillery", r: 2,
    chassis: { type: "tracked", spd: 12 }, man: -5, ap: [30, 18, 14], struct: 40, size: 3,
    crew: ["commander", "driver", "gunner", "loader"],
    traits: ["Conductive Plating", "Open Topped"],
    weapons: [
      { w: "Earthshaker Cannon", role: "commander", mount: "fixed", hArc: "−2°..+2°", vArc: "0°..+59°", std: true },
      { w: "Heavy Bolter", role: "gunner", mount: "hull", hArc: "−25°..+25°", vArc: "−10°..+25°", alt: ["Heavy Flamer"] },
      { w: "Heavy Stubber", role: "driver", mount: "pintle", hArc: "−150°..+150°", vArc: "−35°..+90°", alt: ["Combi-Bolter", "Storm Bolter"] }
    ],
    notes: "<p><b>Гвардия.</b> Основная тяжёлая САУ; способна на бомбардировку и прямую наводку по танкам. "
         + "<b>Тяжёлая Артиллерия</b> (не стреляет в Ход движения кроме Поворота на месте), <b>Долет</b> (снаряды летят Rng/Ход). "
         + "Опции: Закрытая Кабина (Enclosed, +2 корма AP, −Open Topped, −500м Rng), Легион-версия.</p>"
  }),

  V(GUARD, "Медуза (САУ)", {
    cls: "Василиск", vtype: "artillery", r: 3,
    chassis: { type: "tracked", spd: 12 }, man: -5, ap: [30, 18, 14], struct: 40, size: 3,
    crew: ["commander", "driver", "gunner", "loader"],
    traits: ["Conductive Plating", "Open Topped"],
    weapons: [
      { w: "Medusa Siege Cannon", role: "commander", mount: "fixed", hArc: "−2°..+2°", vArc: "0°..+40°", std: true },
      { w: "Heavy Bolter", role: "gunner", mount: "hull", hArc: "−25°..+25°", vArc: "−10°..+25°", alt: ["Heavy Flamer"] },
      { w: "Heavy Stubber", role: "driver", mount: "pintle", hArc: "−150°..+150°", vArc: "−35°..+90°", alt: ["Combi-Bolter", "Storm Bolter"] }
    ],
    notes: "<p><b>Гвардия.</b> Тяжёлая осадная САУ на шасси Василиска — специалист по крепостям и укреплениям. Меньше дальность, чем у Василиска.</p>"
  }),

  V(GUARD, "Гидра", {
    cls: "Гидра", vtype: "artillery", r: 2,
    chassis: { type: "tracked", spd: 13 }, man: 0, ap: [30, 18, 16], struct: 35, size: 3,
    crew: ["commander", "driver", "gunner", "loader", { role: "gunner", n: 1 }],
    traits: ["Conductive Plating", "Open Topped"],
    weapons: [
      { w: "Hydra Flak Autocannon", role: "commander", mount: "turret", hArc: "360°", vArc: "0°..+80°", std: true,
        alt: ["Stormshard Mortar"] }
    ],
    notes: "<p><b>Гвардия.</b> Основная самоходная зенитка; выдаёт поток разрывных снарядов по авиации, эффективна и против лёгкой техники/пехоты. "
         + "Связист — доп. место. На том же шасси/башне — САУ Виверна (Мортира Осколочный Шторм).</p>"
  }),

  V(GUARD, "Виверна", {
    cls: "Гидра", vtype: "artillery", r: 2,
    chassis: { type: "tracked", spd: 13 }, man: 0, ap: [30, 18, 16], struct: 35, size: 3,
    crew: ["commander", "driver", "gunner", "loader"],
    traits: ["Conductive Plating", "Open Topped"],
    weapons: [
      { w: "Stormshard Mortar", role: "commander", mount: "turret", hArc: "360°", vArc: "0°..+80°", std: true }
    ],
    notes: "<p><b>Гвардия.</b> САУ на шасси Гидры для подавления укреплений ураганным огнём кассетных бомб (Мортира Осколочный Шторм).</p>"
  }),

  V(GUARD, "Мантикора", {
    cls: "Мантикора", vtype: "artillery", r: 3,
    chassis: { type: "tracked", spd: 13 }, man: 0, ap: [30, 18, 16], struct: 35, size: 3,
    crew: ["commander", "driver", "gunner", "loader"],
    traits: ["Conductive Plating", "Enclosed", "Sealed"],
    weapons: [
      { w: "Manticore Launcher", role: "commander", mount: "turret", hArc: "360°", vArc: "0°..+45°", std: true }
    ],
    notes: "<p><b>Гвардия.</b> Ракетная САУ дальнего действия (4000 м). Ракеты по 5 т, перезарядка только с машины снабжения.</p>"
  }),

  V(GUARD, "Троянец", {
    cls: "Химера", vtype: "other", r: 1,
    chassis: { type: "tracked", spd: 13 }, man: 0, ap: [25, 18, 16], struct: 35, size: 3,
    crew: ["commander", "driver", "gunner"],
    traits: ["Conductive Plating", "Enclosed", "Sealed"],
    weapons: [
      { w: "Heavy Bolter", role: "gunner", mount: "hull", hArc: "−25°..+25°", vArc: "−10°..+25°", std: true, alt: ["Heavy Flamer"] },
      { w: "Heavy Stubber", role: "commander", mount: "pintle", hArc: "360°", vArc: "−35°..+90°", alt: ["Combi-Bolter", "Storm Bolter"] }
    ],
    notes: "<p><b>Гвардия.</b> Инженерный танк: помогает в полевом ремонте и заряжает тяжёлые боеприпасы. "
         + "Подъёмник грузит до ½ боекомплекта главного орудия; склад на 15 боекомплектов не-сверхтяжёлой техники.</p>"
  }),

  // ═══════════════════════════ ЛЕГИОНЫ (Астартес; часто и Хаос) ═══════════════════════════
  V(LEGION, "Носорог", {
    cls: "Носорог", vtype: "transport", r: 2,
    chassis: { type: "tracked", spd: 15 }, man: 0, ap: [27, 27, 20], struct: 30, size: 3,
    crew: ["pilot", { role: "passenger", n: 10 }],
    traits: ["Advanced Controls", "Advanced Targeting", "Damage Control", "Enclosed", "Indestructible Chassis", "Legion", "Reinforced Armour", "Rugged", "Sealed", "Side Hatches"],
    weapons: [
      { w: "Combi-Bolter", role: "pilot", mount: "pintle", hArc: "360°", vArc: "−35°..+90°", std: true,
        alt: ["Storm Bolter", "Havoc Launcher"] }
    ],
    notes: "<p><b>Легионы / Хаос.</b> Основной БТР Астартес. Два разъёма в люке (пилот и пассажир). "
         + "<b>Неразрушимое Шасси</b>, <b>Саморемонт</b>. Основа для Секача, Хищника, Вихря, Поборника.</p>"
  }),

  V(LEGION, "Секач", {
    cls: "Носорог", vtype: "tank", r: 2,
    chassis: { type: "tracked", spd: 15 }, man: 0, ap: [27, 27, 20], struct: 30, size: 3,
    crew: ["pilot", { role: "passenger", n: 6 }],
    traits: ["Advanced Controls", "Advanced Targeting", "Damage Control", "Enclosed", "Indestructible Chassis", "Legion", "Reinforced Armour", "Rugged", "Sealed", "Side Hatches"],
    weapons: [
      { w: "Twin Heavy Bolter", role: "pilot", mount: "turret", hArc: "360°", vArc: "−5°..+45°", std: true,
        alt: ["Twin Heavy Flamer", "Twin Lascannon", "Twin Assault Cannon"] }
    ],
    notes: "<p><b>Легионы / Хаос.</b> Носорог с башенным спаренным орудием и уменьшенным десантом (Razorback).</p>"
  }),

  V(LEGION, "Хищник", {
    cls: "Хищник", vtype: "tank", r: 3,
    chassis: { type: "tracked", spd: 15 }, man: 0, ap: [37, 27, 20], struct: 40, size: 3,
    crew: ["driver", "gunner", { role: "gunner", n: 2 }],
    traits: ["Advanced Controls", "Advanced Targeting", "Auto-Loader", "Damage Control", "Enclosed", "Indestructible Chassis", "Legion", "Reinforced Armour", "Rugged", "Sealed"],
    weapons: [
      { w: "Predator Autocannon", role: "gunner", mount: "turret", hArc: "360°", vArc: "−15°..+28°", std: true,
        alt: ["Twin Lascannon"] },
      { w: "Heavy Bolter", role: "gunner", mount: "sponson", hArc: "борт", vArc: "—",
        alt: ["Heavy Flamer", "Lascannon"] },
      { w: "Heavy Bolter", role: "gunner", mount: "sponson", hArc: "борт", vArc: "—",
        alt: ["Heavy Flamer", "Lascannon"] },
      { w: "Combi-Bolter", role: "driver", mount: "pintle", hArc: "360°", vArc: "−35°..+90°",
        alt: ["Heavy Flamer", "Bolter", "Havoc Launcher"] }
    ],
    notes: "<p><b>Легионы / Хаос.</b> Основной боевой танк Астартес: башенная автопушка/спар. лазпушка + спонсоны.</p>"
  }),

  V(LEGION, "Поборник", {
    cls: "Носорог", vtype: "tank", r: 3,
    chassis: { type: "tracked", spd: 15 }, man: 0, ap: [39, 27, 20], struct: 40, size: 3,
    crew: ["driver", "gunner"],
    traits: ["Advanced Controls", "Advanced Targeting", "Auto-Loader", "Damage Control", "Enclosed", "Indestructible Chassis", "Legion", "Reinforced Armour", "Rugged", "Sealed", "Siege"],
    weapons: [
      { w: "Demolisher Cannon", role: "gunner", mount: "fixed", hArc: "−2°..+2°", vArc: "0°..+45°", std: true,
        alt: ["Vanquisher Battle Cannon"] }
    ],
    notes: "<p><b>Легионы / Хаос.</b> Осадный танк (Vindicator): корпусная Пушка Разрушитель. <b>Осадная</b> (Siege).</p>"
  }),

  V(LEGION, "Вихрь", {
    cls: "Носорог", vtype: "artillery", r: 3,
    chassis: { type: "tracked", spd: 15 }, man: 0, ap: [27, 27, 20], struct: 35, size: 3,
    crew: ["driver", "gunner"],
    traits: ["Advanced Controls", "Advanced Targeting", "Auto-Loader", "Damage Control", "Enclosed", "Indestructible Chassis", "Legion", "Reinforced Armour", "Rugged", "Sealed"],
    weapons: [
      { w: "Helios Launcher", role: "gunner", mount: "turret", hArc: "360°", vArc: "0°..+55°", std: true,
        alt: ["Castellan Launcher"] }
    ],
    notes: "<p><b>Легионы / Хаос.</b> Ракетная САУ (Whirlwind) на шасси Носорога.</p>"
  }),

  V(LEGION, "Лэнд Рейдер", {
    cls: "Лэнд Рейдер", vtype: "tank", r: 4,
    chassis: { type: "tracked", spd: 15 }, man: 0, ap: [50, 50, 50], struct: 60, size: 4,
    crew: ["driver", "gunner", { role: "gunner", n: 2 }, { role: "passenger", n: 10 }],
    traits: ["Advanced Controls", "Advanced Targeting", "Assault Ramp", "Auto-Loader", { name: "Autonomous", rating: 50, rating2: 50, rating3: 50 }, "Command & Control", "Enclosed", "Indestructible Chassis", "Legion", "Multi-Targeter", "Reinforced Armour", "Sealed", "Side Hatches"],
    weapons: [
      { w: "Twin Heavy Bolter", role: "gunner", mount: "hull", hArc: "−21°..+21°", vArc: "−10°..+21°", std: true,
        alt: ["Twin Assault Cannon"] },
      { w: "Twin Lascannon", role: "gunner", mount: "sponson", hArc: "борт", vArc: "—", std: true },
      { w: "Twin Lascannon", role: "gunner", mount: "sponson", hArc: "борт", vArc: "—", std: true }
    ],
    notes: "<p><b>Легионы / Хаос.</b> Легендарный штурмовой танк-транспорт: спонсонные спар. лазпушки + корпусной спар. болтер. "
         + "Броня 50 со всех сторон, <b>Штурмовая Рампа</b>, <b>Автономная</b> (50/50/50), +10 десанта.</p>"
  }),

  V(LEGION, "Спартанец", {
    cls: "Лэнд Рейдер", vtype: "tank", r: 5,
    chassis: { type: "tracked", spd: 15 }, man: 0, ap: [50, 50, 50], struct: 75, size: 4,
    crew: ["driver", "gunner", { role: "gunner", n: 2 }, { role: "passenger", n: 25 }],
    traits: ["Advanced Controls", "Advanced Targeting", "Assault Ramp", { name: "Autonomous", rating: 50, rating2: 50, rating3: 50 }, "Command & Control", "Enclosed", "Indestructible Chassis", "Legion", "Multi-Targeter", "Reinforced Armour", "Sealed", "Side Hatches", "Super-Heavy"],
    weapons: [
      { w: "Twin Heavy Bolter", role: "gunner", mount: "hull", hArc: "−21°..+21°", vArc: "−10°..+18°", std: true,
        alt: ["Twin Heavy Flamer"] },
      { w: "Quad Lascannon", role: "gunner", mount: "sponson", hArc: "борт", vArc: "—", std: true },
      { w: "Quad Lascannon", role: "gunner", mount: "sponson", hArc: "борт", vArc: "—", std: true }
    ],
    notes: "<p><b>Легионы / Хаос.</b> Сверхтяжёлый штурмовой транспорт: спонсонные счетверённые лазпушки, десант до 25. <b>Сверхтяжёлая</b>.</p>"
  }),

  // ═══════════════════════════ ХАОС ═══════════════════════════
  V(CHAOS, "СТэГ", {
    cls: "СТэГ", vtype: "transport", r: 1,
    chassis: { type: "wheeled", spd: 14 }, man: 10, ap: [25, 22, 16], struct: 30, size: 3,
    crew: ["commander", "driver", "gunner", { role: "passenger", n: 10 }],
    traits: ["Conductive Plating", "Enclosed", "Rugged", "Sealed"],
    weapons: [
      { w: "Autocannon", role: "gunner", mount: "turret", hArc: "360°", vArc: "−8°..+25°", std: true },
      { w: "Heavy Stubber", role: "commander", mount: "pintle", hArc: "360°", vArc: "−35°..+90°",
        alt: ["Combi-Bolter", "Storm Bolter"] }
    ],
    notes: "<p><b>Хаос.</b> Колёсный БТР Кровавого Договора и Сынов Сэка (Саббатские войны). Опция: Командная Машина (Command & Control, пасс. до 4).</p>"
  }),

  V(CHAOS, "АТ-70 Разоритель", {
    cls: "АТ-70", vtype: "tank", r: 1,
    chassis: { type: "tracked", spd: 12 }, man: -10, ap: [35, 32, 20], struct: 40, size: 3,
    crew: ["commander", "driver", "gunner", "loader"],
    traits: ["Conductive Plating", "Enclosed", "Ponderous", "Reinforced Armour", "Rugged", "Sealed"],
    weapons: [
      { w: "Urdesh Cannon", role: "commander", mount: "turret", hArc: "360°", vArc: "−8°..+25°", std: true },
      { w: "Multilaser", role: "gunner", mount: "hull", hArc: "−25°..+25°", vArc: "−10°..+25°", std: true,
        alt: ["Heavy Bolter", "Heavy Flamer"] },
      { w: "Heavy Stubber", role: "commander", mount: "pintle", hArc: "360°", vArc: "−35°..+90°",
        alt: ["Combi-Bolter", "Storm Bolter"] }
    ],
    notes: "<p><b>Хаос.</b> Дешёвый танк Кровавого Договора/Сынов Сэка — во всём уступает Леман Руссу, но кузницы Урдеша штампуют их тысячами. Давят числом.</p>"
  }),

  // ── Авиация Хаоса ──
  V(CHAOS, "Адский Клинок", {
    cls: "Hell Blade", vtype: "aircraft", r: 2,
    chassis: { type: "plane", spd: 30 }, man: 30, ap: [20, 20, 20], struct: 20, size: 1,
    crew: ["pilot"],
    traits: ["Advanced Controls", "Advanced Targeting", "Enclosed", "Fast", "Sealed", "Vector Thrusters", "Voidcraft", "VTOL"],
    weapons: [
      { w: "Twin Hellstorm Autocannon", role: "pilot", mount: "hull", hArc: "−10°..+10°", vArc: "−10°..+10°", std: true },
      { w: "Twin Hellstorm Autocannon", role: "pilot", mount: "hull", hArc: "−10°..+10°", vArc: "−10°..+10°", std: true }
    ],
    notes: "<p><b>Хаос — авиация.</b> Знаменитый истребитель Хаоса, убийственно быстр и подвижен. "
         + "<b>Инфернальное Ядро</b> — не нуждается в топливе/боеприпасах; <b>Пространственный Скачок</b> (варп-телепорт). "
         + "В ядре — малый демон (оболочка для вселения демона посильнее: +10 BS, +5 A).</p>"
  }),

  V(CHAOS, "Адский Коготь", {
    cls: "Hell Talon", vtype: "aircraft", r: 3,
    chassis: { type: "plane", spd: 25 }, man: 15, ap: [22, 22, 20], struct: 40, size: 3,
    crew: ["pilot", "gunner", "commander"],
    traits: ["Advanced Targeting", "Enclosed", "Fast", "Sealed", "Vector Thrusters", "Voidcraft", "VTOL"],
    weapons: [
      { w: "Twin Lascannon", role: "gunner", mount: "hull", hArc: "−15°..+15°", vArc: "−15°..+15°", std: true },
      { w: "Twin Hellstorm Autocannon", role: "gunner", mount: "hull", hArc: "−15°..+15°", vArc: "−15°..+15°", std: true,
        alt: ["Havoc Launcher"] }
    ],
    notes: "<p><b>Хаос — авиация.</b> Бомбардировщик-штурмовик на технологии Адского Клинка, крупнее и лучше вооружён. "
         + "<b>Инфернальное Ядро</b> (малый демон, без топлива). Несёт бомбы для наземных целей.</p>"
  }),

  // ── Демон-движки (шагоходы; пилот — заточённый демон) ──
  V(DAEMON, "Осквернитель", {
    cls: "Осквернитель", vtype: "walker", r: 2,
    chassis: { type: "walker", spd: 10, strength: 85, unnaturalS: 6 }, man: 0, ap: [35, 35, 20], struct: 55, size: 3,
    crew: ["pilot"],
    traits: ["Conductive Plating", "Onslaught", { name: "Multi-Legged", rating: 6 }, "Reinforced Armour"],
    weapons: [
      { w: "Pincer Claw", role: "pilot", mount: "hull", hArc: "—", vArc: "—", std: true },
      { w: "Pincer Claw", role: "pilot", mount: "hull", hArc: "—", vArc: "—", std: true },
      { w: "Reaper Autocannon", role: "pilot", mount: "hull", hArc: "рука", vArc: "—", std: true,
        alt: ["Twin Heavy Flamer", "Havoc Launcher"] }
    ],
    notes: "<p><b>Хаос — демон-движок.</b> Шестиногий Defiler: 2 клешни + 2 руки со сменным оружием. "
         + "Пилот — заточённый демон (<b>+5 WS</b>; WS/BS/A задаются ритуалом вселения). <b>Штурм</b>, <b>Многоногая (6)</b>.</p>"
  }),

  V(DAEMON, "Кузнизверг", {
    cls: "Кузнизверг", vtype: "walker", r: 2,
    chassis: { type: "walker", spd: 10, strength: 65, unnaturalS: 6 }, man: 0, ap: [35, 35, 20], struct: 35, size: 2,
    crew: ["pilot"],
    traits: ["Conductive Plating", { name: "Multi-Legged", rating: 4 }, "Onslaught", "Reinforced Armour"],
    weapons: [
      { w: "Paw", role: "pilot", mount: "hull", hArc: "—", vArc: "—", std: true },
      { w: "Paw", role: "pilot", mount: "hull", hArc: "—", vArc: "—", std: true },
      { w: "Hades Autocannon", role: "pilot", mount: "hull", hArc: "рука", vArc: "—", std: true,
        alt: ["Ectoplasma Cannon"] },
      { w: "Hades Autocannon", role: "pilot", mount: "hull", hArc: "рука", vArc: "—",
        alt: ["Ectoplasma Cannon"] }
    ],
    notes: "<p><b>Хаос — демон-движок.</b> Forgefiend: артиллерийская платформа, 2 руки (обязательно одинаковые) + пасть. "
         + "Пилот-демон (<b>+10 BS</b>, Covering Fire, Storm of Lead). <b>Штурм</b>, <b>Многоногая (4)</b>.</p>"
  }),

  V(DAEMON, "Молотизверг", {
    cls: "Молотизверг", vtype: "walker", r: 2,
    chassis: { type: "walker", spd: 12, strength: 65, unnaturalS: 6 }, man: 10, ap: [35, 35, 20], struct: 35, size: 2,
    crew: ["pilot"],
    traits: ["Conductive Plating", { name: "Multi-Legged", rating: 6 }, "Onslaught", "Reinforced Armour"],
    weapons: [
      { w: "Daemon Power Fist", role: "pilot", mount: "hull", hArc: "—", vArc: "—", std: true,
        alt: ["Magma Cutters"] },
      { w: "Daemon Power Fist", role: "pilot", mount: "hull", hArc: "—", vArc: "—", std: true,
        alt: ["Magma Cutters"] }
    ],
    notes: "<p><b>Хаос — демон-движок.</b> Maulerfiend: штурмовой шагоход ближнего боя. Силовые кулаки или магма-резаки (прорезают переборки). "
         + "Пилот-демон (<b>+10 WS</b>, Unarmed Master, Step Aside). <b>Штурм</b>, <b>Многоногая (6)</b>.</p>"
  }),

  V(DAEMON, "Адский Змий", {
    cls: "Адский Змий", vtype: "walker", r: 2,
    chassis: { type: "walker", spd: 6, strength: 65, unnaturalS: 6 }, man: 0, ap: [35, 35, 20], struct: 35, size: 3,
    crew: ["pilot"],
    traits: ["Conductive Plating", "Onslaught", "Vector Thrusters", "Voidcraft", "VTOL"],
    weapons: [
      { w: "Talons", role: "pilot", mount: "hull", hArc: "—", vArc: "—", std: true },
      { w: "Talons", role: "pilot", mount: "hull", hArc: "—", vArc: "—", std: true },
      { w: "Baleflamer", role: "pilot", mount: "pintle", hArc: "360°", vArc: "−90°..+90°", std: true,
        alt: ["Hades Autocannon"] }
    ],
    notes: "<p><b>Хаос — демон-движок (летающий).</b> Heldrake: крылатый ужас-штурмовик. Когти + пасть (Бедствогнемёт/Аид). "
         + "Пилот-демон (<b>+5 WS, +10 A</b>, Operate(Aeronautica)+10). <b>VTOL</b>, <b>Векторные Двигатели</b>, <b>Космолёт</b>.</p>"
  }),

  // ── Пример одержимой обычной машины (ритуал Машинной Одержимости) ──
  V(DAEMON, "Одержимый Носорог", {
    cls: "Носорог", vtype: "transport", r: 3,
    chassis: { type: "tracked", spd: 15 }, man: 0, ap: [27, 27, 20], struct: 30, size: 3,
    crew: ["pilot", { role: "passenger", n: 10 }],
    traits: [{ name: "Daemonic Possession", rating: 15 }, "Conductive Plating", "Enclosed", "Indestructible Chassis", "Legion", "Reinforced Armour", "Rugged", "Sealed", "Side Hatches"],
    weapons: [
      { w: "Combi-Bolter", role: "pilot", mount: "pintle", hArc: "360°", vArc: "−35°..+90°", std: true,
        alt: ["Havoc Launcher"] }
    ],
    notes: "<p><b>Хаос — одержимая машина.</b> Носорог с вселённым демоном (Ритуал Машинной Одержимости). "
         + "<b>Демоническая Одержимость (15)</b>: колдовской щит-дефлектор 1–15 (обходится атаками, игнорирующими Daemonic), "
         + "иммунитет к крит-эффектам экипажа, демон управляет всеми орудиями. Не требует топлива, оружие не тратит станд. боеприпасы. "
         + "WS/BS/A демона задаются ритуалом; связан Владычеством.</p>"
  }),

  // ═══════════════════════════ ДРЕДНОУТЫ ═══════════════════════════
  // Рука рукопашная (со встроенным орудием) + рука стрелковая; Пинок ногами.
  V(DREAD, "Кастраферум", {
    cls: "Дредноут", vtype: "walker", r: 3,
    chassis: { type: "walker", spd: 7, strength: 75, unnaturalS: 7 }, man: 0, ap: [37, 37, 22], struct: 35, size: 2,
    crew: ["pilot"],
    traits: ["Damage Control", "Enclosed", "Indestructible Chassis", "Land Resupply", "Onslaught", "Reinforced Armour", "Rugged", "Sealed"],
    weapons: [
      { w: "Dreadnought Fist", role: "pilot", mount: "hull", hArc: "рука", vArc: "—", std: true,
        alt: ["Dreadnought Claw", "Dreadnought Chainfist", "Dreadnought Talons", "Power Scourge"] },
      { w: "Storm Bolter", role: "pilot", mount: "hull", hArc: "встроен.", vArc: "—",
        alt: ["Heavy Flamer", "Meltagun"] },
      { w: "Multimelta", role: "pilot", mount: "hull", hArc: "рука", vArc: "—", std: true,
        alt: ["Twin Autocannon", "Twin Heavy Bolter", "Reaper Autocannon", "Assault Cannon", "Missile Launcher", "Frag Cannon", "Lascannon", "Plasma Cannon", "Heavy Flamer"] },
      { w: "Kick", role: "pilot", mount: "hull", hArc: "ноги", vArc: "—" }
    ],
    notes: "<p><b>Дредноут.</b> Кастраферрум — самый распространённый Дредноут: рукопашная рука (со встроенным орудием) + стрелковая рука. "
         + "Пилот — умирающий герой в саркофаге. Чинится запчастями Носорога. <b>Штурм</b>, <b>Перезарядка на Земле</b>. "
         + "Ногами атакует только без рукопашного оружия в руках.</p>"
  }),

  V(DREAD, "Контемптор", {
    cls: "Дредноут", vtype: "walker", r: 4,
    chassis: { type: "walker", spd: 10, strength: 75, unnaturalS: 7 }, man: 10, ap: [43, 37, 22], struct: 40, size: 2,
    crew: ["pilot"],
    traits: [{ name: "Atomantic Shielding", rating: 40 }, "Damage Control", "Enclosed", "Indestructible Chassis", "Land Resupply", "Multi-Targeter", "Onslaught", "Reinforced Armour", "Sealed"],
    weapons: [
      { w: "Dreadnought Fist", role: "pilot", mount: "hull", hArc: "рука", vArc: "—", std: true,
        alt: ["Dreadnought Claw", "Dreadnought Chainfist", "Dreadnought Talons"] },
      { w: "Storm Bolter", role: "pilot", mount: "hull", hArc: "встроен.", vArc: "—",
        alt: ["Heavy Flamer", "Meltagun"] },
      { w: "Assault Cannon", role: "pilot", mount: "hull", hArc: "рука", vArc: "—", std: true,
        alt: ["Multimelta", "Twin Lascannon", "Twin Heavy Bolter", "Plasma Cannon", "Missile Launcher"] },
      { w: "Kick", role: "pilot", mount: "hull", hArc: "ноги", vArc: "—" }
    ],
    notes: "<p><b>Дредноут.</b> Контемптор — древний ересианский образец: превосходит Кастраферрум, но дорог в снабжении. "
         + "<b>Атоматические Щиты (40)</b> — технологический щит-дефлектор 1–40. <b>Мультиприцел</b>, <b>Штурм</b>.</p>"
  }),

  V(DREAD, "Хельбрут", {
    cls: "Дредноут", vtype: "walker", r: 2,
    chassis: { type: "walker", spd: 7, strength: 75, unnaturalS: 7 }, man: 0, ap: [37, 37, 22], struct: 35, size: 2,
    crew: ["pilot"],
    traits: ["Damage Control", "Enclosed", "Indestructible Chassis", "Land Resupply", "Onslaught", "Reinforced Armour", "Rugged", "Sealed"],
    weapons: [
      { w: "Dreadnought Fist", role: "pilot", mount: "hull", hArc: "рука", vArc: "—", std: true,
        alt: ["Dreadnought Claw", "Dreadnought Chainfist", "Power Scourge"] },
      { w: "Combi-Bolter", role: "pilot", mount: "hull", hArc: "встроен.", vArc: "—",
        alt: ["Heavy Flamer", "Meltagun"] },
      { w: "Multimelta", role: "pilot", mount: "hull", hArc: "рука", vArc: "—", std: true,
        alt: ["Twin Autocannon", "Reaper Autocannon", "Twin Heavy Bolter", "Lascannon", "Plasma Cannon", "Missile Launcher", "Havoc Launcher", "Ectoplasma Cannon"] },
      { w: "Kick", role: "pilot", mount: "hull", hArc: "ноги", vArc: "—" }
    ],
    notes: "<p><b>Дредноут (Хаос).</b> Хельбрут: саркофаг не отсоединить, пилот не в гибернации; Здравомыслие не ниже 10, "
         + "не атакует своих в Ярости/Безумии (ур. 20/10). Встроенная Киберпривязь (управление — Хаосит Cor 30+). "
         + "Варианты: Броненосец (AP Л/Б 43, Сейсм. Молот), Осадный (Siege), Фуриозо (+10 WS), Мортис (+10 BS).</p>"
  }),

  // ═══════════════════════════ АДЕПТУС МЕХАНИКУС ═══════════════════════════
  V(MECH, "Железноход", {
    cls: "Ironstrider", vtype: "walker", r: 2,
    chassis: { type: "walker", spd: 14, strength: 50, unnaturalS: 5 }, man: 25, ap: [25, 25, 25], struct: 20, size: 1,
    crew: ["pilot", "gunner"],
    traits: ["Conductive Plating", "Indestructible Chassis", "Land Resupply", "Onslaught", "Open Topped"],
    weapons: [
      { w: "Taser Lance", role: "pilot", mount: "pintle", hArc: "−95°..+95°", vArc: "−65°..+90°", std: true,
        alt: ["Twin Multilaser", "Twin Missile Launcher", "Twin Cognis Autocannon", "Twin Cognis Lascannon", "Radium Jezzail"] }
    ],
    notes: "<p><b>Адептус Механикус.</b> Двуногий шагоход-разведчик. Дракон (Sydonian Dragoon) — с Тазерной Пикой; "
         + "Баллистарий — со спаренным орудием (сменить в дропдауне). Устойчив на длинных ногах, игнорирует Трудный Ландшафт. "
         + "Пилот-скитарий + сервитор.</p>"
  }),

  V(MECH, "Онагр Дюнокрав", {
    cls: "Onager", vtype: "walker", r: 3,
    chassis: { type: "walker", spd: 8, strength: 60, unnaturalS: 6 }, man: 10, ap: [32, 32, 25], struct: 40, size: 3,
    crew: ["pilot", "gunner"],
    traits: ["Advanced Targeting", "Auto-Loader", "Enclosed", "Indestructible Chassis", { name: "Multi-Legged", rating: 4 }, "Multi-Targeter", "Reinforced Armour", "Sealed"],
    weapons: [
      { w: "Eradication Ray", role: "gunner", mount: "hull", hArc: "−15°..+15°", vArc: "−32°..+90°", std: true,
        alt: ["Twin Heavy Phosphor Blaster", "Neutron Laser"] },
      { w: "Heavy Stubber", role: "pilot", mount: "pintle", hArc: "360°", vArc: "−35°..+90°",
        alt: ["Icarus Stormcannon"] }
    ],
    notes: "<p><b>Адептус Механикус.</b> Онагр Дюнокрав — тяжёлый четырёхногий шагоход-платформа. "
         + "Главное орудие в корпусе (Излучатель/Фосфорный Бластер/Нейтронный Лазер). <b>Многоногая (4)</b>, <b>Мультиприцел</b>.</p>"
  }),

  V(MECH, "Скорпиус", {
    cls: "Scorpius", vtype: "transport", r: 1,
    chassis: { type: "skimmer", spd: 15 }, man: 10, ap: [22, 22, 18], struct: 30, size: 3,
    crew: ["driver", "gunner", { role: "passenger", n: 12 }],
    traits: ["Conductive Plating", "Indestructible Chassis", "Open Topped", "Rugged"],
    weapons: [
      { w: "Twin Heavy Stubber", role: "gunner", mount: "pintle", hArc: "360°", vArc: "−35°..+90°", std: true },
      { w: "Heavy Stubber", role: "gunner", mount: "sponson", hArc: "−135°..−45°", vArc: "−45°..+45°" },
      { w: "Heavy Stubber", role: "gunner", mount: "sponson", hArc: "+45°..+135°", vArc: "−45°..+45°" }
    ],
    notes: "<p><b>Адептус Механикус.</b> Простой расходный БТР Скитариев на воздушной подушке (скиммер). Каждая пушка наводится вручную; остов легко восстановить.</p>"
  }),

  V(MECH, "Скорпиус Дезинтегратор", {
    cls: "Scorpius", vtype: "tank", r: 2,
    chassis: { type: "skimmer", spd: 15 }, man: 10, ap: [27, 24, 18], struct: 35, size: 3,
    crew: ["driver", { role: "gunner", n: 3 }],
    traits: ["Conductive Plating", "Enclosed", "Indestructible Chassis", "Rugged"],
    weapons: [
      { w: "Disruptor Missile Launcher", role: "driver", mount: "fixed", hArc: "−6°..+6°", vArc: "−6°..+6°", std: true },
      { w: "Ferrumite Cannon", role: "gunner", mount: "turret", hArc: "360°", vArc: "−25°..+65°", std: true,
        alt: ["Beleros Energy Cannon"] },
      { w: "Heavy Stubber", role: "gunner", mount: "coaxial", hArc: "соосн.", vArc: "—" }
    ],
    notes: "<p><b>Адептус Механикус.</b> Лёгкий танк на шасси Скорпиус — мобильная огневая поддержка штурмовых волн Скитариев.</p>"
  }),

  V(MECH, "Триарос", {
    cls: "Triaros", vtype: "transport", r: 3,
    chassis: { type: "tracked", spd: 13 }, man: 0, ap: [40, 30, 30], struct: 55, size: 4,
    crew: ["driver", { role: "gunner", n: 2 }, { role: "passenger", n: 20 }],
    traits: [{ name: "Atomantic Shielding", rating: 45 }, "Advanced Controls", "Advanced Targeting", "Auto-Loader", "Enclosed", "Indestructible Chassis", "Reinforced Armour", "Sealed", "Side Hatches"],
    weapons: [
      { w: "Twin Mauler Bolt Cannon", role: "driver", mount: "pintle", hArc: "360°", vArc: "−15°..+60°", std: true },
      { w: "Volkite Charger", role: "gunner", mount: "pintle", hArc: "−120°..+15°", vArc: "−15°..+90°", std: true },
      { w: "Volkite Charger", role: "gunner", mount: "pintle", hArc: "−15°..+120°", vArc: "−15°..+90°", std: true }
    ],
    notes: "<p><b>Адептус Механикус (Тагмата).</b> Бронетранспортёр техножреца (до 20 боевых сервиторов/автоматов). "
         + "<b>Тяжёлый Вспышковый Щит</b> 1–45/10 (не сработав против взрыва/спрея — +10 AP). <b>Шоковый Таран</b> (+1d10 Dmg, Concussive 4, +10 лоб.AP).</p>"
  }),

  V(MECH, "Карахнос", {
    cls: "Triaros", vtype: "artillery", r: 3,
    chassis: { type: "tracked", spd: 13 }, man: 0, ap: [40, 30, 30], struct: 55, size: 4,
    crew: ["driver", { role: "gunner", n: 2 }, { role: "passenger", n: 5 }],
    traits: ["Advanced Controls", "Advanced Targeting", "Auto-Loader", "Enclosed", "Indestructible Chassis", "Reinforced Armour", "Sealed", "Side Hatches", "Volatile"],
    weapons: [
      { w: "Karachnos Missile Battery", role: "driver", mount: "pintle", hArc: "360°", vArc: "−15°..+60°", std: true },
      { w: "Lightning Blaster", role: "gunner", mount: "sponson", hArc: "−5°..−175°", vArc: "−32°..+42°", std: true },
      { w: "Lightning Blaster", role: "gunner", mount: "sponson", hArc: "+175°..+5°", vArc: "−32°..+42°", std: true }
    ],
    notes: "<p><b>Адептус Механикус (Тагмата).</b> Боевой танк/противопехотная артиллерия на шасси Триароса: батарея радиологических ракет + молниевые бластеры.</p>"
  }),

  V(MECH, "Криос", {
    cls: "Krios", vtype: "tank", r: 3,
    chassis: { type: "tracked", spd: 17 }, man: 20, ap: [35, 30, 18], struct: 36, size: 3,
    crew: ["pilot"],
    traits: [{ name: "Atomantic Shielding", rating: 45 }, "Advanced Controls", "Advanced Targeting", "Damage Control", "Enclosed", "Fast", "Multi-Targeter", "Open Topped", "Reinforced Armour", "Rugged"],
    weapons: [
      { w: "Lightning Cannon", role: "pilot", mount: "fixed", hArc: "−8°..+8°", vArc: "−35°..+70°", std: true,
        alt: ["Pulsar Fusil"] },
      { w: "Volkite Charger", role: "pilot", mount: "sponson", hArc: "−5°..−175°", vArc: "−32°..+42°" },
      { w: "Volkite Charger", role: "pilot", mount: "sponson", hArc: "+175°..+5°", vArc: "−32°..+42°" }
    ],
    notes: "<p><b>Адептус Механикус (Тагмата).</b> Древний быстрый танк-эскадрон. <b>Тяжёлый Вспышковый Щит</b> 1–45/10. "
         + "<b>Ноосферное Управление</b> (Импланты Механикум → I вместо A/BS), Гальванические Двигатели (переброс Ландшафта). Опция: Анбарический Коготь (разряд 3 м).</p>"
  }),

  V(MECH, "Крот", {
    cls: "Mole", vtype: "transport", r: 3,
    chassis: { type: "tracked", spd: 15 }, man: 0, ap: [30, 30, 21], struct: 35, size: 3,
    crew: ["pilot", { role: "passenger", n: 12 }],
    traits: ["Advanced Controls", "Advanced Targeting", "Enclosed", "Indestructible Chassis", "Ponderous", "Reinforced Armour", "Rugged", "Sealed", "Side Hatches"],
    weapons: [
      { w: "Melta Drill", role: "pilot", mount: "hull", hArc: "−15°..+15°", vArc: "−10°..+25°", std: true }
    ],
    notes: "<p><b>Адептус Механикус (Тагмата).</b> Продвинутая штурмовая дрель-транспорт — полноценный подземный ход, "
         + "доставляет штурмовые команды в сердце вражеских крепостей. Механикум охотно «одалживает» Кроты союзникам.</p>"
  }),

  V(MECH, "Макрокарид", {
    cls: "Macrocarid", vtype: "transport", r: 4,
    chassis: { type: "tracked", spd: 15 }, man: 10, ap: [50, 50, 50], struct: 60, size: 3,
    crew: ["driver", { role: "gunner", n: 3 }, { role: "passenger", n: 10 }],
    traits: ["Advanced Controls", "Advanced Targeting", "Auto-Loader", { name: "Autonomous", rating: 50, rating2: 50, rating3: 50 }, "Command & Control", "Damage Control", "Enclosed", "Indestructible Chassis", "Multi-Targeter", "Reinforced Armour", "Sealed", "Side Hatches"],
    weapons: [
      { w: "Mauler Bolt Cannon", role: "gunner", mount: "pintle", hArc: "360°", vArc: "−15°..+90°", std: true,
        alt: ["Heavy Flamer", "Multilaser", "Twin Rad Cleanser", "Multimelta", "Lascannon", "Plasma Cannon"] }
    ],
    notes: "<p><b>Адептус Механикус (Тагмата).</b> Тяжелобронированный транспорт-исследователь (AP 50 со всех сторон): "
         + "подбирает вооружение и модули под задачу. <b>Автономная</b> (50/50/50), <b>Командно-Штабная</b>.</p>"
  }),

  // ═══════════════════════════ ОРУДИЙНЫЕ ПЛАТФОРМЫ (стр. 39-40) ═══════════════════════════
  V(PLATFORM, "Тарантула", {
    cls: "Tarantula", vtype: "artillery", r: 0,
    chassis: { type: "tracked", spd: 0 }, man: 0, ap: [13, 13, 13], struct: 15, size: 1,
    crew: [],  // экипажа нет — стреляет Автопилот (Autonomous)
    traits: [{ name: "Autonomous", rating: 0, rating2: 35, rating3: 45 }, "Conductive Plating", "Immobile", "Rugged"],
    weapons: [
      { w: "Twin Heavy Flamer", role: "gunner", mount: "turret", hArc: "360°", vArc: "−15°..+70°", std: true,
        alt: ["Twin Multilaser", "Twin Missile Launcher", "Twin Heavy Bolter", "Twin Plasma Cannon", "Twin Multimelta", "Twin Lascannon"] }
    ],
    notes: "<p><b>Орудийная платформа.</b> Автоматическая турель (Дух Машины). <b>Экипаж не нужен</b> — "
         + "<b>Автономная</b> (0/35/45): стреляет своим BS 35, замечает цели (Awareness 45). "
         + "<b>Неподвижная</b>. Опция: Дистанционное Управление (пульт оператора).</p>"
  }),

  V(PLATFORM, "Сабля", {
    cls: "Sabre", vtype: "artillery", r: 0,
    chassis: { type: "tracked", spd: 0 }, man: 0, ap: [18, 10, 10], struct: 15, size: 1,
    crew: ["gunner"],
    traits: ["Conductive Plating", "Immobile", "Open Topped", "Rugged"],
    weapons: [
      { w: "Quad Heavy Stubber", role: "gunner", mount: "turret", hArc: "360°", vArc: "−35°..+83°", std: true,
        alt: ["Twin Multilaser", "Twin Autocannon", "Twin Heavy Bolter", "Twin Lascannon"] }
    ],
    notes: "<p><b>Орудийная платформа.</b> Дешёвая турель обороны, выставляется массово. <b>Неподвижная</b>, требует стрелка.</p>"
  }),

  V(PLATFORM, "Рапира", {
    cls: "Rapier", vtype: "artillery", r: 1,
    chassis: { type: "tracked", spd: 5 }, man: -20, ap: [25, 20, 20], struct: 15, size: 1,
    crew: ["pilot"],
    traits: ["Conductive Plating", "Open Topped"],
    weapons: [
      { w: "Quad Multilaser", role: "pilot", mount: "hull", hArc: "−5°..+5°", vArc: "−10°..+65°", std: true,
        alt: ["Quad Heavy Bolter", "Quad-Gun", "Rapier Laser Array", "Graviton Cannon"] }
    ],
    notes: "<p><b>Орудийная платформа.</b> Гусеничный самоходный лафет (медленный, SPD 5) с тяжёлым счетверённым орудием.</p>"
  }),

  V(PLATFORM, "Артиллерийская Платформа", {
    cls: "Artillery Platform", vtype: "artillery", r: 2,
    chassis: { type: "tracked", spd: 0 }, man: 0, ap: [25, 14, 14], struct: 25, size: 3,
    crew: ["commander", "gunner", { role: "loader", n: 2 }, { role: "passenger", n: 1 }],
    traits: ["Conductive Plating", "Open Topped", "Rugged"],
    weapons: [
      { w: "Earthshaker Cannon", role: "gunner", mount: "turret", hArc: "180°", vArc: "0°..+70°", std: true,
        alt: ["Medusa Siege Cannon"] }
    ],
    notes: "<p><b>Орудийная платформа.</b> Неподвижная тяжёлая артиллерийская платформа (Сотрясатель/Медуза). Связист — пассажирское место.</p>"
  }),

  // ═══════════════════════════ ДРУКХАРИ (стр. 55+) ═══════════════════════════
  // Все — скиммеры (Легкий Друкхарийский Скиммер: Низкая/Высокая высота свободно).
  V(DRU, "Скайборд Геллиона", {
    cls: "Hellion Skyboard", vtype: "skimmer", r: -2,
    chassis: { type: "skimmer", spd: 36 }, man: 50, ap: [12, 12, 10], struct: 10, size: 0,
    crew: ["pilot"],
    traits: ["Advanced Controls", "Fast", "Fall Breaks", "Open Topped", "Rugged"],
    weapons: [
      { w: "Splinter Pod", role: "pilot", mount: "hull", hArc: "−10°..+10°", vArc: "−10°..+10°", std: true },
      { w: "Hellion Wings", role: "pilot", mount: "hull", hArc: "корпус", vArc: "—", std: true }
    ],
    notes: "<p><b>Друкхари.</b> Гравидоска банд Геллионов — лёгкая, дешёвая, стремительная (SPD 36, Ман +50). "
         + "<b>Крючковые Цепи</b> удерживают пилота. Крылья бьют при Налёте/Таране.</p>"
  }),

  V(DRU, "Реактивный Мотоцикл Разоритель", {
    cls: "Reaver Jetbike", vtype: "skimmer", r: 0,
    chassis: { type: "skimmer", spd: 35 }, man: 30, ap: [16, 16, 14], struct: 15, size: 1,
    crew: ["pilot"],
    traits: ["Advanced Controls", "Fast", "Fall Breaks", "Open Topped"],
    weapons: [
      { w: "Splinter Rifle / Осколочная Винтовка (техн.)", role: "pilot", mount: "hull", hArc: "−10°..+10°", vArc: "−45°..+10°", std: true,
        alt: ["Shredder / Шреддер (техн.)", "Blaster / Бластер (техн.)", "Horrorfex / Хоррорфекс (техн.)", "Heat Lance / Тепловое Копьё (техн.)"] },
      { w: "Blades / Лезвия", role: "pilot", mount: "hull", hArc: "корпус", vArc: "—", std: true,
        alt: ["Grav-Talon / Грав-Коготь"] }
    ],
    notes: "<p><b>Друкхари.</b> Гравимотоцикл Разоритель — самый частый в Коммораге. Соперничает в небе с Бичевателями/Геллионами, "
         + "превосходя в огне и скорости. Опция: Кластерные Калтропы (антиграв-гранаты).</p>"
  }),

  V(DRU, "Яд", {
    cls: "Venom", vtype: "skimmer", r: 2,
    chassis: { type: "skimmer", spd: 35 }, man: 30, ap: [22, 22, 18], struct: 25, size: 2,
    crew: ["pilot", "gunner", { role: "passenger", n: 6 }],
    traits: ["Advanced Controls", "Enclosed", "Fast", "Fall Breaks", "Sealed", { name: "Flickerfield" }],
    weapons: [
      { w: "Twin Splinter Rifle", role: "pilot", mount: "hull", hArc: "−10°..+10°", vArc: "−45°..+10°", std: true,
        alt: ["Splinter Cannon / Осколочная Пушка (техн.)"] },
      { w: "Splinter Cannon / Осколочная Пушка (техн.)", role: "gunner", mount: "turret", hArc: "360°", vArc: "−35°..+90°", std: true }
    ],
    notes: "<p><b>Друкхари.</b> Лёгкий скоростной транспорт элитного отряда (перевозит аристократию/чемпионов). "
         + "Крайне манёвренный и скрытный. <b>Мерцающие Поля</b>. Гротеск занимает 5 мест.</p>"
  }),

  V(DRU, "Рейдер", {
    cls: "Raider", vtype: "skimmer", r: 1,
    chassis: { type: "skimmer", spd: 30 }, man: 25, ap: [24, 24, 20], struct: 35, size: 3,
    crew: ["gunner", { role: "passenger", n: 10 }],
    traits: ["Open Topped", "Fast", "Fall Breaks", { name: "Flickerfield" }],
    weapons: [
      { w: "Dark Lance / Тёмное Копьё (техн.)", role: "gunner", mount: "turret", hArc: "360°", vArc: "−35°..+90°", std: true,
        alt: ["Disintegrator Cannon / Дезинтегратор"] },
      { w: "Blades / Лезвия", role: "gunner", mount: "hull", hArc: "корпус", vArc: "—", std: true }
    ],
    notes: "<p><b>Друкхари.</b> Основной штурмовой транспорт-платформа (10 десанта). <b>Мерцающие Поля</b>, "
         + "<b>Эфирные Паруса</b> (3 дня ускорения после выхода из Паутины). Интегрированное орудие — R1.</p>"
  }),

  V(DRU, "Опустошитель", {
    cls: "Ravager", vtype: "skimmer", r: 3,
    chassis: { type: "skimmer", spd: 30 }, man: 25, ap: [27, 26, 21], struct: 36, size: 3,
    crew: ["pilot", { role: "gunner", n: 3 }],
    traits: ["Advanced Targeting", "Open Topped", "Fast", "Fall Breaks", { name: "Flickerfield" }],
    weapons: [
      { w: "Dark Lance / Тёмное Копьё (техн.)", role: "gunner", mount: "turret", hArc: "360°", vArc: "−35°..+90°", std: true,
        alt: ["Disintegrator Cannon / Дезинтегратор"] },
      { w: "Dark Lance / Тёмное Копьё (техн.)", role: "gunner", mount: "turret", hArc: "360°", vArc: "−35°..+90°", std: true,
        alt: ["Disintegrator Cannon / Дезинтегратор"] },
      { w: "Dark Lance / Тёмное Копьё (техн.)", role: "gunner", mount: "turret", hArc: "360°", vArc: "−35°..+90°", std: true,
        alt: ["Disintegrator Cannon / Дезинтегратор"] },
      { w: "Blades / Лезвия", role: "pilot", mount: "hull", hArc: "корпус", vArc: "—", std: true }
    ],
    notes: "<p><b>Друкхари.</b> Летающая канонерка на шасси Рейдера: три башенных Тёмных Копья/Дезинтегратора. <b>Мерцающие Поля</b>.</p>"
  }),

  V(DRU, "Танталус", {
    cls: "Tantalus", vtype: "skimmer", r: 4,
    chassis: { type: "skimmer", spd: 25 }, man: 20, ap: [30, 30, 20], struct: 36, size: 3,
    crew: ["pilot", { role: "gunner", n: 2 }, { role: "passenger", n: 16 }],
    traits: ["Advanced Controls", "Open Topped", "Fast", "Fall Breaks", "Reinforced Armour", { name: "Flickerfield" }],
    weapons: [
      { w: "Pulse Disintegrators / Импульсные Дезинтеграторы", role: "gunner", mount: "hull", hArc: "+10°..−10°", vArc: "−45°..0°", std: true },
      { w: "Pulse Disintegrators / Импульсные Дезинтеграторы", role: "gunner", mount: "hull", hArc: "+10°..−10°", vArc: "−45°..0°", std: true },
      { w: "Scythevane / Огромные Косы", role: "pilot", mount: "hull", hArc: "корпус", vArc: "—", std: true }
    ],
    notes: "<p><b>Друкхари.</b> Тяжёлый штурмовой транспорт-катамаран (16 десанта). Импульсные Дезинтеграторы + Огромные Косы "
         + "(заряжаются на Налёте). <b>Мерцающие Поля</b>, <b>Укреплённая Броня</b>.</p>"
  }),

  V(DRU, "Бритвокрылья", {
    cls: "Razorwing", vtype: "aircraft", r: 2,
    chassis: { type: "skimmer", spd: 50 }, man: 60, ap: [22, 21, 20], struct: 35, size: 3,
    crew: ["pilot"],
    traits: ["Advanced Targeting", "Advanced Controls", "Enclosed", "Fast", "Fall Breaks", "Vector Thrusters", "Voidcraft", "VTOL", "Sealed", "Multi-Targeter", { name: "Flickerfield" }],
    weapons: [
      { w: "Twin Splinter Rifle", role: "pilot", mount: "hull", hArc: "−10°..+10°", vArc: "−45°..0°", std: true },
      { w: "Dark Lance / Тёмное Копьё (техн.)", role: "pilot", mount: "sponson", hArc: "−5°..+175°", vArc: "−15°..+15°", std: true,
        alt: ["Disintegrator Cannon / Дезинтегратор"] },
      { w: "Dark Lance / Тёмное Копьё (техн.)", role: "pilot", mount: "sponson", hArc: "−5°..+175°", vArc: "−15°..+15°", std: true,
        alt: ["Disintegrator Cannon / Дезинтегратор"] }
    ],
    notes: "<p><b>Друкхари — авиация.</b> Истребитель Бритвокрылья — сверхбыстрый (SPD 50, Ман +60), <b>VTOL</b>/<b>Космолёт</b>. "
         + "Спар. Осколочные + крыльевые Тёмные Копья/Дезинтеграторы + ракеты крыльев. <b>Мерцающие Поля</b>.</p>"
  })

];
