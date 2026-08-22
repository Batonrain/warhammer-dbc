// module/constants/skill-specializations.mjs
// ════════════════════════════════════════════════════════════════════════
//  Специализации Групп Навыков (Основная книга, стр. 58-61).
//
//  key   — устойчивый ключ, на который ссылаются механики системы;
//  label — английское название из книги (оно же попадает в specialty);
//  ru    — русская подпись для списка;
//  char  — своя базовая Характеристика, если отличается от группы;
//  chars — прочие часто используемые Характеристики (памятка);
//  free  — специализация с подстановкой (<Регион>, <Раса>, <Организация>).
//
//  Ссылаться на конкретный навык следует ключом: SPEC.operate.voidship —
//  тогда переименование подписи не сломает механику.
// ════════════════════════════════════════════════════════════════════════

const S = (key, label, ru, o = {}) => ({ key, label, ru, ...o });

export const SKILL_SPECIALIZATIONS = {

  // ── Общие Знания (I) ──────────────────────────────────────────────────
  commonLore: [
    S("arbites",        "Adeptus Arbites",          "Адептус Арбитес"),
    S("astraTelepathica","Adeptus Astra Telepathica","Астра Телепатика"),
    S("administratum",  "Administratum",            "Администратум"),
    S("archenemy",      "Archenemy",                "Заклятый Враг"),
    S("chaos",          "Chaos",                    "Хаос"),
    S("crime",          "Crime",                    "Преступность"),
    S("ecclesiarchy",   "Ecclesiarchy",             "Экклезиархия"),
    S("imperialCreed",  "Imperial Creed",           "Имперский Культ"),
    S("imperialGuard",  "Imperial Guard",           "Имперская Гвардия"),
    S("imperialFleet",  "Imperial Fleet",           "Имперский Флот"),
    S("imperium",       "Imperium",                 "Империум"),
    S("intrigue",       "Intrigue",                 "Интриги"),
    S("sump",           "Sump",                     "Днище"),
    S("tech",           "Tech",                     "Техника"),
    S("toil",           "Toil",                     "Труд"),
    S("war",            "War",                      "Война"),
    S("region",         "<Регион>",                 "<Регион>", { free: true })
  ],

  // ── Запретные Знания (I) ──────────────────────────────────────────────
  forbiddenLore: [
    S("astartes",        "Astartes",                     "Астартес"),
    S("astartesImplants","Astartes Implants",            "Импланты Астартес"),
    S("archeotech",      "Archeotech",                   "Археотех"),
    S("codexAstartes",   "Codex Astartes",               "Кодекс Астартес"),
    S("daemons",         "Daemons",                      "Демоны"),
    S("followersOfChaos","Followers of Chaos (<Регион>)","Последователи Хаоса", { free: true }),
    // Единственная специализация с иным покровителем — Нургл вместо Тзинча.
    S("heresy",          "Heresy",                       "Ересь", { god: "nurgle" }),
    S("horusHeresy",     "Horus Heresy and Long War",    "Ересь Хоруса и Долгая Война"),
    S("inquisition",     "Inquisition",                  "Инквизиция"),
    S("mechanicum",      "Mechanicum",                   "Механикум"),
    S("mutants",         "Mutants",                      "Мутанты"),
    S("navigators",      "Navigators",                   "Навигаторы"),
    S("pirates",         "Pirates",                      "Пираты"),
    S("psykers",         "Psykers",                      "Псайкеры"),
    S("underworld",      "Underworld",                   "Преступный мир"),
    S("warp",            "Warp",                         "Варп"),
    // Комбинированное знание: заменяет любое из трёх, двигается как одно.
    S("warpDaemonsPsykers", "Warp, Daemons and Psykers", "Варп, Демоны и Псайкеры",
      { combines: ["warp", "daemons", "psykers"], psykerOnly: true }),
    S("xenobiology",     "Xenobiology",                  "Ксенобиология"),
    S("xenos",           "Xenos (<Раса>)",               "Ксеносы", { free: true }),
    S("xenosOccult",     "Xenos Occult (<Раса>)",        "Оккультизм ксеносов", { free: true })
  ],

  // ── Язык (I) ──────────────────────────────────────────────────────────
  linguistics: [
    S("lowGothic",   "Low Gothic",                 "Низкий Готик"),
    S("highGothic",  "High Gothic",                "Высокий Готик"),
    S("binaryCant",  "Binary Cant",                "Бинарный Кант"),
    S("chaosGlyphs", "Chaos Glyphs",               "Глифы Хаоса"),
    S("trueTongue",  "True Tongue",                "Истинный Язык"),
    S("battleCant",  "Battle Cant (<Организация>)","Боевой Язык", { free: true })
  ],

  // ── Навигация (I) ─────────────────────────────────────────────────────
  navigation: [
    S("surface", "Surface", "Поверхность"),
    S("stellar", "Stellar", "Межпланетная"),
    S("warp",    "Warp",    "Варп")
  ],

  // ── Вождение — три отдельных навыка со своими Характеристиками ────────
  operate: [
    S("surface",     "Surface",     "Наземное", { char: "ag" }),
    S("aeronautica", "Aeronautica", "Полёт",    { char: "ag" }),
    S("voidship",    "Voidship",    "Корабль",  { char: "int" })
  ],

  // ── Учёные Знания (I) ─────────────────────────────────────────────────
  scholasticLore: [
    S("astromancy",      "Astromancy",        "Астромантия"),
    S("beasts",          "Beasts",            "Звери"),
    S("bureaucracy",     "Bureaucracy",       "Бюрократия"),
    S("chymistry",       "Chymistry",         "Химия"),
    S("cryptology",      "Cryptology",        "Криптология"),
    S("heraldry",        "Heraldry",          "Геральдика"),
    S("imperialCreed",   "Imperial Creed",    "Имперский Культ"),
    S("judgement",       "Judgement",         "Правосудие"),
    S("legend",          "Legend",            "Легенды"),
    S("navisNobilite",   "Navis Nobilite",    "Навис Нобилитэ"),
    S("numerology",      "Numerology",        "Нумерология"),
    S("occult",          "Occult",            "Оккультизм"),
    S("philosophy",      "Philosophy",        "Философия"),
    S("tacticaImperialis","Tactica Imperialis","Тактика Империалис")
  ],

  // ── Ремесло (I) — многие специализации на своих Характеристиках ───────
  trade: [
    S("archaeologist", "Archaeologist", "Археолог"),
    S("architect",     "Architect",     "Архитектор"),
    S("armourer",      "Armourer",      "Бронник"),
    S("astrographer",  "Astrographer",  "Астрограф"),
    S("calligraphy",   "Calligraphy",   "Каллиграф",   { char: "ag" }),
    S("carpenter",     "Carpenter",     "Плотник",     { char: "ag" }),
    S("chymist",       "Chymist",       "Химик"),
    S("cook",          "Cook",          "Повар",       { char: "per" }),
    S("dancer",        "Dancer",        "Танцор",      { char: "ag" }),
    S("earthworks",    "Earthworks",    "Земляные работы", { chars: ["int", "s", "ag"] }),
    S("engineer",      "Engineer",      "Инженер"),
    S("farmer",        "Farmer",        "Фермер",      { chars: ["int", "t", "per"] }),
    S("instructor",    "Instructor",    "Наставник",   { chars: ["int", "fel"] }),
    S("jeweler",       "Jeweler",       "Ювелир",      { char: "ag" }),
    S("linguist",      "Linguist",      "Лингвист"),
    S("mason",         "Mason",         "Каменщик",    { chars: ["int", "per"] }),
    S("musician",      "Musician",      "Музыкант",    { chars: ["fel", "ag", "t", "per", "int"] }),
    S("painter",       "Painter",       "Художник",    { chars: ["ag", "per"] }),
    S("remembrancer",  "Remembrancer",  "Летописец"),
    S("scrimshawer",   "Scrimshawer",   "Резчик",      { char: "ag" }),
    S("shipwright",    "Shipwright",    "Корабел"),
    S("soothsayer",    "Soothsayer",    "Прорицатель", { char: "fel" }),
    S("stylist",       "Stylist",       "Стилист",     { char: "fel" }),
    S("tailor",        "Tailor",        "Портной",     { char: "ag" }),
    S("technomat",     "Technomat",     "Техномат"),
    S("voidfarer",     "Voidfarer",     "Пустотник",   { chars: ["s", "ag", "int"] }),
    S("weaponsmith",   "Weaponsmith",   "Оружейник")
  ]
};

/** Быстрый доступ по ключу: SPEC.operate.voidship.label === "Voidship". */
export const SPEC = Object.fromEntries(Object.entries(SKILL_SPECIALIZATIONS).map(
  ([g, list]) => [g, Object.fromEntries(list.map(s => [s.key, { ...s, group: g }]))]));

/** Описание специализации по группе и ключу. */
export function specDef(group, key) {
  return SPEC[group]?.[key] || null;
}

/**
 * Удовлетворяет ли специализация `haveKey` требованию/тесту на `wantKey` —
 * тем же ключом, либо совмещённой записью (`combines`, стр. 58-61: «Варп,
 * Демоны и Псайкеры» заменяет любую из трёх и бросается как одна). Общий
 * хелпер для requirements/roll-подбора, чтобы не дублировать
 * `def?.combines?.includes(wantKey)` в каждом месте, где сверяют specKey.
 */
export function specCovers(group, haveKey, wantKey) {
  if (!haveKey || !wantKey) return false;
  if (haveKey === wantKey) return true;
  const def = specDef(group, haveKey);
  return !!def?.combines?.includes(wantKey);
}

const norm = (s) => String(s || "").toLowerCase().replace(/[<>]/g, "").replace(/\s+/g, " ").trim();

/**
 * Находит описание специализации по любому написанию: ключу, английскому
 * названию, русской подписи или подстроке (для «Xenos (Eldar)» → xenos).
 */
export function matchSpec(group, text) {
  const list = SKILL_SPECIALIZATIONS[group];
  if (!list) return null;
  const n = norm(text);
  if (!n) return null;
  return list.find(s => s.key.toLowerCase() === n)
      || list.find(s => norm(s.label) === n || norm(s.ru) === n)
      // «Voidships», «Xenos (Eldar)», «Battle Cant (Кабал)» — по началу строки.
      || list.find(s => {
        const base = norm(s.label.replace(/\s*\(.*\)$/, ""));
        return base && (n.startsWith(base) || base.startsWith(n));
      })
      || null;
}

/**
 * Ищет запись специализации на листе актора.
 * Сравнение идёт по ключу, английскому названию и русской подписи, поэтому
 * работают и записи, заведённые вручную до появления каталога.
 */
export function findGroupEntry(actor, group, spec) {
  const arr = actor?.system?.groupSkills?.[group];
  if (!Array.isArray(arr) || !arr.length) return null;
  const want = matchSpec(group, spec);
  const n = norm(spec);

  for (const e of arr) {
    if (e?.specKey && want && e.specKey === want.key) return e;
    const en = norm(e?.specialty);
    if (!en) continue;
    if (en === n) return e;
    if (want && (en === norm(want.label) || en === norm(want.ru) || en === want.key.toLowerCase())) return e;
    // «Xenos (Eldar)» удовлетворяет запросу «Xenos».
    const base = want ? norm(want.label.replace(/\s*\(.*\)$/, "")) : n;
    if (base && en.startsWith(base)) return e;
  }
  // Комбинированное знание заменяет любое из входящих в него.
  for (const e of arr) {
    const def = e?.specKey ? specDef(group, e.specKey) : matchSpec(group, e?.specialty);
    if (def?.combines && want && def.combines.includes(want.key)) return e;
  }
  return null;
}

/** Базовая Характеристика конкретной специализации (или характеристика группы). */
export function specChar(group, spec, groupChar) {
  const def = matchSpec(group, spec);
  return def?.char || groupChar;
}

/** Варианты для выпадающего списка при добавлении специализации. */
export function specOptions(group) {
  return (SKILL_SPECIALIZATIONS[group] || []).map(s => ({
    key: s.key, label: s.label, ru: s.ru, free: !!s.free,
    display: s.ru && s.ru !== s.label ? `${s.label} — ${s.ru}` : s.label
  }));
}
