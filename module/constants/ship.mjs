// ════════════════════════════════════════════════════════════════════════
//  Константы пустотных кораблей (Warhammer DBC).
//  Лист корабля: характеристики, узлы (компоненты), бюджеты Энергии/
//  Пространства/Очков Корабля.
// ════════════════════════════════════════════════════════════════════════

// Характеристики корпуса (база; узлы их модифицируют).
export const SHIP_CHARS = {
  speed:           { abbr: "SPD", label: "Скорость" },
  manoeuvrability: { abbr: "MN",  label: "Манёвренность" },
  detection:       { abbr: "DT",  label: "Обнаружение" },
  voidShields:     { abbr: "VS",  label: "Пустотные щиты" },
  armour:          { abbr: "ARM", label: "Броня" },
  turretRating:    { abbr: "TR",  label: "Класс турелей" }
};

// Дуги орудийной оснащённости (Weapon Capacity).
export const SHIP_WEAPON_ARCS = {
  port:    "Левый борт (ЛБ)",
  star:    "Правый борт (ПБ)",
  dorsal:  "Надпалубное (НП)",
  prow:    "Носовое (Н)",
  keel:    "Килевое (К)"
};

// Офицерские должности корабля (по умолчанию; переименовываемы + свои).
export const OFFICER_POSTS = [
  "Капитан", "Старпом", "Хормейстер", "Навигатор", "Магос Механикус",
  "Старший Медикарий", "Мастер-канонир", "Мастер пустотных щитов",
  "Мастер вокса", "Мастер авгуров", "Мастер полёта", "Мастер плети",
  "Мастер порядка", "Комиссар", "Исповедник", "Квартирмейстер"
];

// Порядок позиций Орудийной оснащённости для отображения.
export const WC_ORDER = ["prow", "dorsal", "port", "star", "keel"];
// Коды из строки WC корпуса (напр. «Н1, ПБ1, ЛБ1») → ключ позиции.
const WC_CODE = { "Н": "prow", "НП": "dorsal", "ПБ": "star", "ЛБ": "port", "К": "keel" };

/**
 * Разбор строки Орудийной оснащённости (Weapon Capacity) корпуса в число
 * слотов по позициям: { prow, dorsal, port, star, keel }.
 * Понимает «Н1, ПБ1, ЛБ1», «1НП, 1ПБ», «НП2» и т.п.
 */
export function parseWeaponCapacity(str) {
  const out = { prow: 0, dorsal: 0, port: 0, star: 0, keel: 0 };
  if (!str) return out;
  for (const tok of String(str).split(/[,;/]+/)) {
    const letters = (tok.match(/[А-Яа-яЁё]+/) || [""])[0].toUpperCase().replace(/\s+/g, "");
    const num = parseInt((tok.match(/\d+/) || ["1"])[0]) || 1;
    const key = WC_CODE[letters];
    if (key) out[key] += num;
  }
  return out;
}

// Категории узлов (Components / Узлы).
export const SHIP_COMPONENT_CATEGORIES = {
  drive:        "Плазменный двигатель",
  warp:         "Варп-двигатель",
  voidShield:   "Пустотные щиты",
  bridge:       "Мостик",
  lifeSustainer:"Жизнеобеспечение",
  quarters:     "Жилые отсеки",
  augur:        "Ауспики / Авгуры",
  weapon:       "Орудие",
  hold:         "Грузовой трюм / Отсек",
  supplemental: "Улучшение",
  other:        "Прочее"
};

// Характеристика, которую модифицирует узел (для авто-суммирования).
export const SHIP_MOD_CHARS = {
  "":              "— нет —",
  speed:           "SPD (Скорость)",
  manoeuvrability: "MN (Манёвренность)",
  detection:       "DT (Обнаружение)",
  voidShields:     "VS (Пустотные щиты)",
  armour:          "ARM (Броня)",
  turretRating:    "TR (Класс турелей)",
  hullIntegrity:   "HI (Прочность корпуса)"
};

// Бюджет Очков Корабля (SP) от Бесчестья/Влияния капитана (Inf).
//   0-10→30, 11-20→40, 21-30→50, 31-40→60, 41-50→70, 51+→80
export function spFromInfluence(inf) {
  const v = Number(inf) || 0;
  if (v >= 51) return 80;
  if (v >= 41) return 70;
  if (v >= 31) return 60;
  if (v >= 21) return 50;
  if (v >= 11) return 40;
  return 30;
}

// Класс судна (категория корпуса) — для группировки/отыгрыша.
export const SHIP_TYPES = {
  transport:  "Транспорт",
  raider:     "Рейдер",
  frigate:    "Фрегат",
  lightCruiser:"Лёгкий крейсер",
  cruiser:    "Крейсер",
  grandCruiser:"Гранд-крейсер",
  battleship: "Линкор",
  other:      "Прочее"
};

// ── Грузы (Cargo / Load Capacity) ──────────────────────────────────────────
// Типы грузов с базовой Редкостью (R) и примерами (по таблице DoomBC).
// rarity — строка (часто диапазон «От −X до Y» или «Различное»), для справки.
export const CARGO_TYPES = [
  // Сырьё
  { key: "minerals",      group: "Сырьё",   label: "Минералы",          rarity: "От −2 до 0", examples: "Уголь, бедная руда; железная руда, обогащённая руда; редкие руды" , rMin: -2, rMax: 0 },
  { key: "rareMinerals",  group: "Сырьё",   label: "Редкие минералы",   rarity: "3",          examples: "Ноктилит" , rMin: 3, rMax: 3 },
  { key: "materials",     group: "Сырьё",   label: "Материалы",         rarity: "−2",         examples: "Камень, кирпич, бетон; камнебетон, армаплас, сталебетон, пласталь; адамантий, керамит" , rMin: -2, rMax: -2 },
  { key: "rareMaterials", group: "Сырьё",   label: "Редкие материалы",  rarity: "4",          examples: "Аурумит" , rMin: 4, rMax: 4 },
  // Товары
  { key: "provisions",    group: "Товары",  label: "Провизия",          rarity: "От −3 до 1", examples: "Трупный крахмал, корнеплоды, овощи, фрукты, мясо, амасек, вода" , rMin: -3, rMax: 1 },
  { key: "chemicals",     group: "Товары",  label: "Химикаты",          rarity: "От −2 до 2", examples: "Промышленные газы, кислоты и т.д." , rMin: -2, rMax: 2 },
  { key: "medicaments",   group: "Товары",  label: "Медикаменты",       rarity: "От −1 до 4", examples: "Медицинские средства, наркотические вещества" , rMin: -1, rMax: 4 },
  { key: "luxury",        group: "Товары",  label: "Роскошь",           rarity: "От 0 до 4",  examples: "Украшения, роскошные одеяния, статуи, предметы искусства" , rMin: 0, rMax: 4 },
  { key: "plasma",        group: "Товары",  label: "Плазма",            rarity: "1",          examples: "Плазменное топливо для плазменных двигателей" , rMin: 1, rMax: 1 },
  { key: "fuel",          group: "Товары",  label: "Топливо",           rarity: "От −2 до 0", examples: "Прометий разной степени очистки" , rMin: -2, rMax: 0 },
  { key: "tools",         group: "Товары",  label: "Инструменты",       rarity: "От −3 до 0", examples: "Промышленные и строительные инструменты — лопатки, буры, кирки и пр." , rMin: -3, rMax: 0 },
  { key: "weaponry",      group: "Товары",  label: "Вооружение",        rarity: "Любое",      examples: "Стрелковое и рукопашное оружие, модификации к нему" , rMin: null, rMax: null },
  { key: "ammo",          group: "Товары",  label: "Боеприпасы",        rarity: "От −3 до 4", examples: "Топливо огнемётов, лазбатареи, пули, болты, колбы плазмы и т.д." , rMin: -3, rMax: 4 },
  { key: "explosives",    group: "Товары",  label: "Взрывчатка",        rarity: "От −4 до 5", examples: "Гранаты, бомбы, мины, мельта-гель, промышленная взрывчатка" , rMin: -4, rMax: 5 },
  { key: "parts",         group: "Товары",  label: "Запчасти",          rarity: "Различное",  examples: "Части для ремонта и сбора техники и авиации, ремонта силовой брони и пр." , rMin: null, rMax: null },
  { key: "armor",         group: "Товары",  label: "Броня",             rarity: "От −4 до 5", examples: "Флак-броня, панцирная броня, силовая броня (в т.ч. астартес), модификации" , rMin: -4, rMax: 5 },
  { key: "machinery",     group: "Товары",  label: "Машинерия",         rarity: "От −2 до 3", examples: "Части сложной машинерии — плазмапроводы, шестерни, подъёмные механизмы и т.д." , rMin: -2, rMax: 3 },
  { key: "techComplex",   group: "Товары",  label: "Сложная техника",   rarity: "От −1 до 4", examples: "Инфопланшеты, ауспики, когитаторы, голографы, воксы" , rMin: -1, rMax: 4 },
  { key: "equipment",     group: "Товары",  label: "Снаряжение",        rarity: "Различное",  examples: "Магнокли, наручники, гравишюты, прыжковые ранцы, ингаляторы, противогазы" , rMin: null, rMax: null },
  { key: "cybernetics",   group: "Товары",  label: "Кибернетика",       rarity: "Различное",  examples: "Бионические замены, киберусовершенствования, священные импланты Механикус" , rMin: null, rMax: null },
  { key: "civVehicles",   group: "Товары",  label: "Гражданская техника",rarity: "Различное", examples: "Мотоциклы, тягачи, буровые машины, автомобили, погрузочные «Часовые» и т.д." , rMin: null, rMax: null },
  { key: "milVehicles",   group: "Товары",  label: "Военная техника",   rarity: "Различное",  examples: "Танки, БТРы, артиллерия и т.д." , rMin: null, rMax: null },
  { key: "aviation",      group: "Товары",  label: "Авиация",           rarity: "Различное",  examples: "Все виды шаттлов и самолётов в разобранном виде" , rMin: null, rMax: null }
];

export function getCargoType(key) {
  return CARGO_TYPES.find(c => c.key === key) || null;
}

export function buildCargoTypeOptions(selectedKey) {
  let html = "", group = null;
  for (const c of CARGO_TYPES) {
    if (c.group !== group) {
      if (group !== null) html += `</optgroup>`;
      html += `<optgroup label="${c.group}">`;
      group = c.group;
    }
    const sel = c.key === selectedKey ? " selected" : "";
    html += `<option value="${c.key}"${sel}>${c.label}</option>`;
  }
  if (group !== null) html += `</optgroup>`;
  return html;
}

// Качество груза (как у снаряжения).
export const CARGO_QUALITY = { poor: "Poor.Q", common: "Comm.Q", good: "Good.Q", best: "Best.Q" };

// ── Экипаж: пороговые таблицы (эффект активен, когда показатель ≤ порога) ────
export const CREW_POP_TABLE = [
  { t: 80, mutiny: false, fx: "Время всех путешествий +1d5 дней." },
  { t: 60, mutiny: false, fx: "Тесты при Абордаже, отражении Ударил-отступил, Тушении Пожара и Срочном ремонте −5." },
  { t: 50, mutiny: false, fx: "−10 к MN." },
  { t: 40, mutiny: false, fx: "Действия с Command(F) −5." },
  { t: 20, mutiny: false, fx: "Корабль считается полуразрушенным. Если уже полуразрушен — СХ раз в 2 СР." },
  { t: 10, mutiny: false, fx: "Нельзя Абордаж/Ударил-отступил. Отражение Абордажа/Ударил-отступил/тушение/срочный ремонт −20." },
  { t: 0,  mutiny: false, fx: "Корабль — склеп мертвецов; не может действовать без команды." }
];
export const CREW_MORALE_TABLE = [
  { t: 80, mutiny: false, fx: "Все тесты Command (корабль/экипаж) −5." },
  { t: 70, mutiny: true,  fx: "Попытка бунта." },
  { t: 60, mutiny: false, fx: "Все тесты BS при Стрельбе −5." },
  { t: 50, mutiny: false, fx: "Все тесты Command (корабль/экипаж) становятся −15." },
  { t: 40, mutiny: true,  fx: "−10 к MN; BS при Стрельбе −10; попытка бунта." },
  { t: 20, mutiny: false, fx: "Нельзя Абордаж/Ударил-отступил; в порту CP −1d5 (дезертирство)." },
  { t: 10, mutiny: true,  fx: "Command −30; −10 к MN/SPD/DT; попытка бунта." },
  { t: 0,  mutiny: false, fx: "Восстание: экипаж убивает облечённых властью и захватывает корабль." }
];
export const CREW_RATING_TABLE = [
  { label: "Неумелый", skill: 20 }, { label: "Умелый", skill: 30 },
  { label: "Искусный", skill: 40 }, { label: "Ветераны", skill: 50 }, { label: "Отборный", skill: 60 }
];
// Активные строки таблицы при текущем значении (value ≤ порога).
export function crewActiveRows(table, value) {
  const v = Number(value);
  return table.filter(r => Number.isFinite(v) && v <= r.t);
}

// Краткая справка по ключевым свойствам кораблей/узлов (для подсказок).
export const SHIP_PROPERTIES = {
  "Aimer (X)":        "Тесты BS из лэнсов, нова-орудий и макробатарей получают +X (на узле — только из него).",
  "Archeotech":       "Сложное оборудование: штраф к Tech-Use при ремонте (−20, или −10 c FL(Archeotech)).",
  "Armored (X)":      "Корабль бронирован тяжелее класса: +X к Броне (иногда только с указанной дуги).",
  "Breathing Heat (X)":"Плазменные двигатели вырабатывают дополнительно +X энергии.",
  "Chain Reaction (Y)":"При крите 1–2 от этого орудия критический эффект бьёт по Y узлам.",
  "Clumsy (X)":       "Корабль неуклюж: −X к Манёвренности.",
  "Dreadnought":      "Сверхтяжёлый корпус (особые правила постройки/повреждений).",
  "Fast":             "Корабль быстрее своего класса.",
  "Hybrid Ship":      "Узлы другого класса доступны кораблю (см. перечень в скобках).",
  "In-build":         "Узел встроен в корпус по умолчанию (не тратит SP/Пространство, в указанной пропорции).",
  "Limited":          "Доступ к свойству/узлу ограничен (см. скобки).",
  "Vicious Design (X)":"Жестокая конструкция (часто друкхари): особые эффекты на экипаж/врага."
};

// ── Грузы: механики книги (раздел «Грузы») ──────────────────────────────────

// Каждая LC ≈ 101–1000 предметов; при продаже +40, при приобретении −40.
export const CARGO_TRADE = { sell: 40, buy: -40, itemsPerLcMin: 101, itemsPerLcMax: 1000 };

// Ксенотовары и снаряжение Астартес получают +1 к R.
export const CARGO_RARITY_MODS = [
  { key: "xenos",    label: "Ксенотовары",           mod: 1 },
  { key: "astartes", label: "Снаряжение Астартес",   mod: 1 }
];

// Качество груза сдвигает его ценность: бедные руды дешевле, санктумный товар дороже.
export const CARGO_QUALITY_R = { poor: -1, common: 0, good: 1, best: 2 };

/**
 * Итоговая редкость партии: база типа + качество + пометки (ксено/астартес) +
 * ручная правка. Типы с «Различным» R базы не имеют — тогда считаем от нуля,
 * а базовый разброс остаётся подсказкой для МИ.
 */
export function cargoRarity(sys) {
  const t = getCargoType(sys?.cargoType);
  const manual = Number(sys?.rarity);
  if (Number.isFinite(manual) && sys?.rarityManual) return manual;
  let base = 0, known = false;
  if (t && t.rMin != null) { base = Math.round((t.rMin + t.rMax) / 2); known = true; }
  let r = base + (CARGO_QUALITY_R[sys?.quality] ?? 0);
  for (const m of CARGO_RARITY_MODS) if (sys?.[m.key]) r += m.mod;
  return { value: r, known, min: t?.rMin ?? null, max: t?.rMax ?? null };
}

// Пороги проверок из книги.
//   Повреждение узла (не External) или падение INT → 1d100, 51-100 губит груз.
//   Критический эффект (кроме 3, 4 и 7) → 1d100, 76-100 губит груз.
//   Падение CP → 1d100, 75-100 губит пассажиров (по 1 PC за провал).
export const CARGO_DAMAGE = {
  nodeHit:   { threshold: 51, label: "Повреждение узла / падение INT" },
  critEffect:{ threshold: 76, label: "Критический эффект", exemptCrits: [3, 4, 7] },
  passengers:{ threshold: 75, label: "Гибель пассажиров при падении CP" }
};

// Специализированные грузовые узлы: +20 к тесту на воровство; их груз не портится
// и гибнет только при критическом повреждении самого узла.
export const CARGO_HOLD_BONUS = 20;

// ── Экипаж: восстановление и бунт (раздел «Экипаж») ─────────────────────────

// Число действий НИП за СР равно бонусу Выучки (CR/10): умелый — 3, ветераны — 5.
// Альтернативное правило книги — жёсткий потолок в 3 действия.
export const CREW_ACTION_CAP = 3;
export function crewActionsPerSR(ratingLabel) {
  const r = CREW_RATING_TABLE.find(x => x.label === ratingLabel);
  return r ? Math.floor(r.skill / 10) : 0;
}

// Пожертвование Inf: на лёгких судах команда малочисленнее, эффект заметнее.
const LIGHT_HULLS = new Set(["transport", "raider", "frigate"]);
export function moralePerInfluence(shipType) {
  return LIGHT_HULLS.has(shipType) ? "1d10" : "1d5";
}

// Увольнение на берег: сколько недель до полного восстановления CM.
export const SHORE_LEAVE = [
  { key: "uninhabited", label: "Необитаемая пригодная планета", weeks: 3, note: "Пополнение припасов и свежий воздух." },
  { key: "inhabited",   label: "Населённая планета или поселение", weeks: 2, note: "Есть куда сойти и с кем выпить." },
  { key: "paid",        label: "Населённая + оплата ущерба", weeks: 1,
    note: "Тест реквизиции по Inf +20 — возместить ущерб пивным, притонам и борделям." }
];

// Вербовка: доступность зависит от того, где набирают.
export const CREW_RECRUIT = [
  { key: "hive",    label: "Улей",              avail: 50, note: "Людей в избытке." },
  { key: "planet",  label: "Населённая планета", avail: 20, note: "Базовая доступность вербовки." },
  { key: "outpost", label: "Аванпост",           avail: 0,  note: "Живая сила ценится." },
  { key: "remote",  label: "Одинокий аванпост",  avail: -10, note: "Рабочих рук почти нет." }
];

// Подавление бунта: три подхода, каждый со своей ценой (книга, раздел «Бунт»).
export const MUTINY_APPROACHES = [
  { key: "command",   label: "Command — подавить силой", skill: "Command",
    cost: "CP и CM −1d5", cpLoss: "1d5", cmLoss: "1d5",
    note: "Оруженосцы против бунтовщиков, посты охраны, настоящая война на борту." },
  { key: "charm",     label: "Charm — договориться", skill: "Charm",
    cost: "CM −1d10", cpLoss: "", cmLoss: "1d10",
    note: "Выслушать требования главарей. Экипаж сочтёт командиров слабаками." },
  { key: "intimidate",label: "Intimidation — устрашить", skill: "Intimidation",
    cost: "CM −1d10", cpLoss: "", cmLoss: "1d10",
    note: "Убить главарей, взять заложников, грозить выстудить отсеки. Командиры станут тиранами." }
];

// Пороги CM, на которых требуется тест Command на бунт.
export const MUTINY_THRESHOLDS = [70, 40, 10];
// Бунтовщики побеждают окончательно при 4+ степенях успеха во встречном тесте.
export const MUTINY_WIN_DOS = 4;
