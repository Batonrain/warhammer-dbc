// module/constants/items.mjs

export const ITEM_TYPES = {
  weapon:       "Оружие",
  weaponMod:    "Модификация оружия",
  ammo:         "Боеприпасы",
  armor:        "Броня",
  armorMod:     "Модификация брони",
  forcefield:   "Силовое поле",
  gear:         "Снаряжение",
  drug:         "Препараты",
  tool:         "Инструменты",
  cybernetic:   "Кибернетика",
  talent:       "Талант",
  ability:      "Способность",
  mutation:     "Мутация",
  trait:        "Черта (Трейт)",
  implant:      "Имплант",
  psychicPower: "Психосила",
  techPower:    "Техносила",
  navigatorPower: "Сила навигатора",
  mentalDisorder: "Ментальное расстройство",
  mentalTrauma:   "Ментальная травма",
  ritual:         "Ритуал",
  vehicleGear:    "Оснащение техники",
  vehicleTrait:   "Черта техники",
  smallCraft:     "Малое судно (МЛА)",
  race:           "Раса",
  subrace:        "Субраса",
  runicWeave:     "Руническая Вязь"
};

// Типы снаряжения (вкладка «Снаряжение»). Кнопка «Добавить предмет» предлагает
// только их — без талантов/черт/психосил/расстройств и прочих способностей.
export const GEAR_ITEM_TYPES = [
  "weapon", "weaponMod", "ammo", "armor", "armorMod",
  "forcefield", "gear", "drug", "tool", "runicWeave"
];

export const WEAPON_CLASSES = {
  melee:      "Рукопашное",
  thrown:     "Метательное",
  pistol:     "Пистолет",
  basic:      "Ручное",
  heavy:      "Тяжёлое",
  launcher:   "Пусковое",
  stationary: "Стационарное"
};

export const DAMAGE_TYPES = {
  energy:   "Энергетический",
  impact:   "Ударный",
  rending:  "Режущий",
  blast:    "Взрывной",
  chemical: "Химический"
};

export const AVAILABILITY = {
  "-5": "−5 Повсеместно",
  "-4": "−4 Распространено",
  "-3": "−3 Изобильно",
  "-2": "−2 Обычно",
  "-1": "−1 Средне",
   "0": "0 Дефицит",
   "1": "+1 Редко",
   "2": "+2 Очень редко",
   "3": "+3 Чрезвычайно редко",
   "4": "+4 Почти уникально",
   "5": "+5 Уникально"
};

// ── Группы модификаций оружия (по типу оружия) ──────────────────────────────
export const WEAPON_MOD_GROUPS = {
  ranged: {
    melee:     "Рукопашные",
    sights:    "Прицелы",
    flexibility:"Гибкость",
    other:     "Прочие",
    altMag:    "Альтернативные магазины",
    autoStab:  "Авто и Стаб оружие",
    las:       "Лаз Оружие",
    bolt:      "Болт оружие",
    plasma:    "Плазменное оружие",
    melta:     "Мельта оружие",
    flamer:    "Огнемёты",
    shotgun:   "Дробовики",
    launcher:  "Ракетные установки",
    grenade:   "Гранатомёты"
  },
  melee: {
    materials: "Материалы",
    blades:    "Клинки",
    bludgeon:  "Дробящее",
    polearm:   "Древковое",
    chain:     "Цепное",
    power:     "Силовое",
    psychic:   "Психосиловое",
    misc:      "Разное"
  },
  shield: {
    shield: "Щиты"
  }
};

// ── Группы модификаций брони ────────────────────────────────────────────────
//   armor       — обычные модификации брони
//   powerSystem — Системы Силовой брони (только для брони типа «Силовая»)
export const ARMOR_MOD_GROUPS = {
  armor: {
    general:       "Общие",
    reinforcement: "Укрепление",
    helmet:        "Шлем",
    torso:         "Торс",
    limbs:         "Конечности",
    backpack:      "Ранец",
    mystic:        "Мистическое"
  },
  powerSystem: {
    standard: "Стандартные системы",
    helmet:   "Шлем",
    torso:    "Торс",
    arms:     "Руки",
    legs:     "Ноги",
    backpack: "Ранец"
  }
};

// Директивы auto.* (читает module/combat/armor-properties.mjs, применяет
// module/documents/actor.mjs при сборе AP по локациям + module/combat/damage.mjs
// при поглощении): noApVsType — не даёт AP от указанного типа урона;
// doubleApVsType — удваивает AP от указанного типа урона; noApRanged — не даёт
// AP от стрелковых атак; noApJointCalled/noApEyeCalled — не даёт AP при
// Избирательном попадании в Сочленение/Глаз; blocksPrimitiveDouble — Примитивное
// оружие атакующего не удваивает AP этой брони. Свойство без auto — только
// напоминание (десk/label на листе), как у большинства WEAPON_PROPERTIES.
export const ARMOR_PROPERTIES = {
  blinders:   { label: "Blinders / Шоры",        desc: "Шлем. Уменьшает угол обзора до X°." },
  cloak:      { label: "Cloak / Плащ",            desc: "Не защищает с фронта 90°, кроме особых позиций." },
  conductive: { label: "Conductive / Проводящая", desc: "Не даёт AP от E(El) урона.", auto: { noApVsType: "energy" } },
  flak:       { label: "Flak / Флак",             desc: "Удваивает AP против X(Fr) урона, кроме прямых попаданий.", auto: { doubleApVsType: "blast" } },
  gorget:     { label: "Gorget / Горжет",          desc: "Защищает шею. При случайном попадании в голову — бросок 1d10." },
  hard:       { label: "Hard / Жёсткая",          desc: "Нельзя снимать, не оставляя Усталость. Нельзя носить 2 жёстких на одной части." },
  heavy:      { label: "Heavy / Тяжёлая",         desc: "−10 к Stealth. Нельзя плавать." },
  open:       { label: "Open / Открытый",          desc: "Шлем. Нет визора. Избирательные атаки в лицо игнорируют AP.", auto: { noApEyeCalled: true } },
  primitive:  { label: "Primitive / Примитивная", desc: "Не получает бонус AP от примитивного оружия.", auto: { blocksPrimitiveDouble: true } },
  protective: { label: "Protective / Защитная",   desc: "+X AP против урона от среды." },
  rods:       { label: "Rods / Стержни",           desc: "Не даёт AP против стрелковых атак и Избирательных попаданий в сочленения.", auto: { noApRanged: true, noApJointCalled: true } },
  sealed:     { label: "Sealed / Закрытая",        desc: "Защита от химии на коже. Теряется при пробитии брони." },
  stealthed:  { label: "Stealthed / Скрытная",    desc: "+10 к Stealth. Скрывает от тепловизора." },
  undersuit:  { label: "Undersuit / Подкладка",   desc: "Носится под другой бронёй." },
  soft:       { label: "Soft / Мягкая",           desc: "Нет AP от I(Cr) урона. Нет Сочленений.", auto: { noApVsType: "impact" } },
  void:       { label: "Void / Пустотная",         desc: "Защита от вакуума, жара, газов, радиации. 6 часов воздуха." },
  // ── Эльдарские (Азуриане) ──
  aspect:     { label: "Aspect / Аспект",          desc: "Броня аспекта. Без соответствующего Пути — штраф −20 на все тесты, пока носишь броню. Не-Асуриане/Иннари: модификация R3 убирает штраф." },
  runesOfProtection: { label: "Runes of Protection / Защитные Руны", desc: "При попадании извне — тест W+(бPR×5): успех → +(бPR+Успехи+4) AP, провал → +бPR AP. Даёт +бPR×5 на тесты против Blinding, Concussive, Flame, Grav, Hallucinogenic, Rad, Shocking, Snare, Toxic." },
  wraithboneRegen: { label: "Wraithbone Regeneration / Регенерация Психокости", desc: "В руках псайкера броня самовосстанавливается; не теряет Sealed/Void при пробитии. Рядом с Певцом Кости (Следующий+) восстанавливает AP раз в 3 раунда." },
  special:    { label: "Special / Особое",         desc: "Особые правила — см. описание предмета." }
};

// ── Снаряжение и Инструменты ────────────────────────────────────────────────

// Категории снаряжения (папки компендиума «Снаряжение» + группировка на листе).
export const GEAR_CATEGORIES = {
  rig:      "Разгрузка",
  mobility: "Мобильность",
  head:     "Головное",
  misc:     "Разное",
  mystic:   "Мистическое"
};

// Категории инструментов (папки компендиума «Инструменты»).
export const TOOL_CATEGORIES = {
  general:    "Общие",
  kits:       "Наборы инструментов",
  stationary: "Стационарное",
  consumable: "Расходники",
  mystic:     "Мистическое"
};

// Удобство разгрузки — влияет на Quick Draw и перемещение при снятии/укладке.
export const RIG_COMFORT = {
  normal:      "Удобная",
  awkward:     "Неудобная",       // не даёт пользоваться Quick Draw
  veryAwkward: "Очень неудобная"  // + нельзя перемещаться в Ход снятия/укладки
};

// Стандартные размеры слотов/предметов на разгрузке (Ш×В в «клетках»).
export const RIG_SLOT_SIZES = {
  "1x1": "1×1 — граната, 2 магазина, увелич./дуплюс/барабан",
  "2x1": "2×1 — нож, пистолет, компакт-винтовка, бомба, магазин тяж.",
  "3x1": "3×1 — карабин, гладиус, булава, топор, ракета, аптечка, набор инстр.",
  "4x1": "4×1 — винтовка, одноручное рукопашное",
  "5x1": "5×1 — двуручное рукопашное, длинная винтовка",
  "5x2": "5×2 — тяжёлое оружие",
  "3x3": "3×3 — щит",
  "4x3": "4×3 — прыжковый ранец, рюкзак, вокс-кастер",
  "5x3": "5×3 — ранец с боеприпасами"
};

// ── Химия ─────────────────────────────────────────────────────────────────────

export const DRUG_CATEGORIES = {
  medicine: "Медицина",
  narcotic: "Наркотики",
  poison:   "Яды",
  elixir:   "Эликсиры"
};

export const DRUG_DELIVERY = {
  injection:   "Инъекция",
  gas:         "Газ/Аэрозоль",
  liquid:      "Жидкость",
  smoke:       "Курение",
  patch:       "Припарка",
  pill:        "Таблетка",
  food:        "Еда (яд)",
  wound:       "Рана (яд)",
  contact:     "Контакт (яд)",
  gas_contact: "Газ-Контакт (яд)",
  gas_eye:     "Газ-Глаза (яд)"
};

export const DRUG_CHAR_KEYS = {
  ws:  "WS",
  bs:  "BS",
  s:   "S",
  t:   "T",
  ag:  "Ag",
  int: "Int",
  per: "Per",
  wp:  "WP",
  fel: "Fel"
};

export const DRUG_CONDITIONS = {
  "":             "— нет —",
  bleeding:       "Кровотечение",
  stunned:        "Оглушение",
  pinned:         "Подавление",
  prone:          "Повален",
  helpless:       "Беспомощный",
  unconscious:    "Без сознания",
  fatigued:       "Усталость",
  crippling:      "Калечение",
  poisoned:       "Отравление",
  blinded:        "Ослеплён",
  deafened:       "Оглох",
  burning:        "Горение",
  radiation:      "Радиация",
  haemorrhaging:  "Обескровливание",
  hallucinogenic: "Галлюцинации",
  addicted:       "Зависимость"
};

export const DRUG_DELIVERY_RU = {
  injection:   "Инъекция",
  gas:         "Газ/Аэрозоль",
  liquid:      "Жидкость",
  smoke:       "Курение",
  patch:       "Припарка",
  pill:        "Таблетка",
  food:        "Еда",
  wound:       "Рана",
  contact:     "Контакт",
  gas_contact: "Газ-Контакт",
  gas_eye:     "Газ-Глаза"
};

/**
 * Качество препарата.
 * Влияет на тест яда: Poor +10, Common ±0, Good −10, Best −20
 * Ключи совпадают с book-таблицей: Poor.Q / Comm.Q / Good.Q / Best.Q
 */
export const DRUG_QUALITY = {
  poor: { label: "Низкое",   abbr: "Poor.Q", poisonMod:  10 },
  common: { label: "Обычное", abbr: "Comm.Q", poisonMod:   0 },
  good: { label: "Хорошее",  abbr: "Good.Q", poisonMod: -10 },
  best: { label: "Высшее",   abbr: "Best.Q", poisonMod: -20 }
};