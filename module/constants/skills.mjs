// apt2 — вторая склонность навыка (Скл2 из таблицы стр. 57); первая = char.
// en — английское имя (как оно встречается в module/constants/legions.mjs::CULT
// friendlySkills/hostileSkills, стр. 58-... книги) — cultureCat() матчит по
// подстроке в НИЖНЕМ РЕГИСТРЕ АНГЛИЙСКОГО текста; передавать туда русский
// label бессмысленно (wdbc-ko14 — до этой правки культура легиона для Навыков
// через SKILLS_DEF никогда реально не матчилась).
export const SKILLS_DEF = {
  acrobatics:    { label: "Акробатика",       en: "Acrobatics",     char: "ag",  apt2: "general"    },
  athletics:     { label: "Атлетика",         en: "Athletics",      char: "s",   apt2: "general"    },
  awareness:     { label: "Внимательность",   en: "Awareness",      char: "per", apt2: "fieldcraft" },
  charm:         { label: "Очарование",       en: "Charm",          char: "fel", apt2: "social"     },
  command:       { label: "Командование",     en: "Command",        char: "fel", apt2: "social"     },
  commerce:      { label: "Торговля",         en: "Commerce",       char: "int", apt2: "social"     },
  deceive:       { label: "Обман",            en: "Deceive",        char: "fel", apt2: "social"     },
  dodge:         { label: "Уклонение",        en: "Dodge",          char: "ag",  apt2: "defence"    },
  inquiry:       { label: "Расспрос",         en: "Inquiry",        char: "fel", apt2: "social"     },
  interrogate:   { label: "Допрос",           en: "Interrogate",    char: "wp",  apt2: "social"     },
  intimidate:    { label: "Запугивание",      en: "Intimidate",     char: "wp",  apt2: "social"     },
  logic:         { label: "Логика",           en: "Logic",          char: "int", apt2: "knowledge"  },
  medicae:       { label: "Медицина",         en: "Medicae",        char: "int", apt2: "fieldcraft" },
  parry:         { label: "Парирование",      en: "Parry",          char: "ws",  apt2: "defence"    },
  // cannotUntrained (стр. 57, сноска ²) — тест вообще недоступен без
  // изучения, не просто −20 как у обычного неизученного Навыка.
  psyniscience:  { label: "Психочутьё",       en: "Psyniscience",   char: "per", apt2: "psyker",     cannotUntrained: true },
  scrutiny:      { label: "Пристальность",    en: "Scrutiny",       char: "per", apt2: "general"    },
  security:      { label: "Безопасность",     en: "Security",       char: "int", apt2: "tech"       },
  sleightOfHand: { label: "Ловкость рук",     en: "Sleight of Hand",char: "ag",  apt2: "finesse"    },
  stealth:       { label: "Скрытность",       en: "Stealth",        char: "ag",  apt2: "fieldcraft" },
  survival:      { label: "Выживание",        en: "Survival",       char: "per", apt2: "fieldcraft" },
  techUse:       { label: "Технология",       en: "Tech-Use",       char: "int", apt2: "tech"       }
};

// alwaysAlly — группа всегда Дружественная (стр. 58, 61: «Бог: Всегда
// Дружественный, даже если персонаж Неделимый»). Перебивает и Склонности,
// и Мировоззрение, и культуру легиона — цена всегда как у Дружественного.
// en — см. комментарий над SKILLS_DEF; group-варианты (Forbidden Lore и т.п.)
// матчатся substring'ом БЕЗ специализации — «forbidden lore (archeotech)»
// содержит «forbidden lore» целиком, специализацию указывать не нужно.
export const GROUP_SKILLS_DEF = {
  commonLore:     { label: "Общие знания",     en: "Common Lore",     char: "int", apt2: "general",   alwaysAlly: true },
  // cannotUntrained — та же сноска ², относится ко всей группе (не к
  // отдельным специализациям) в отличие от Operate, где она точечная.
  forbiddenLore:  { label: "Запретные знания", en: "Forbidden Lore",  char: "int", apt2: "knowledge", cannotUntrained: true },
  scholasticLore: { label: "Ученые знания",    en: "Scholastic Lore", char: "int", apt2: "knowledge" },
  linguistics:    { label: "Язык",             en: "Linguistics",     char: "int", apt2: "general"   },
  navigation:     { label: "Навигация",        en: "Navigation",      char: "int", apt2: "fieldcraft"},
  operate:        { label: "Вождение",         en: "Operate",         char: "ag",  apt2: "fieldcraft"},
  trade:          { label: "Ремесло",          en: "Trade",           char: "int", apt2: "general",   alwaysAlly: true }
};

// ── Прежние русские названия Навыков ─────────────────────────────────────────
// Подписи Навыков приведены к книге (Основная книга, стр. 57-61, «Навыки»:
// Внимательность, Очарование, Торговля, Расспрос, Медицина, Психочутьё,
// Пристальность, Технология, Язык, Вождение). Но название — не только подпись:
// правила рас сравнивают `match` с подписью Навыка (aptitude-overrides.mjs), а
// Таланты вроде «Мастерство (Психонаука)» хранят её в `specialization`. Снимки
// предметов на акторах живых миров несут старое слово и пак их не догонит
// (AGENTS.md → «Миграции»), поэтому сравнение сводит старое название к
// нынешнему, а не требует миграции. Только именительный падеж, целым словом —
// «Медика-палуба» и «Медикаменты» не задеваются.
const LEGACY_SKILL_NAMES = [
  ["бдительность",     "внимательность"],
  ["обаяние",          "очарование"],
  ["коммерция",        "торговля"],
  ["дознание",         "расспрос"],
  ["медика",           "медицина"],
  ["психонаука",       "психочутьё"],
  ["проницательность", "пристальность"],
  ["техпользование",   "технология"],
  ["лингвистика",      "язык"],
  ["управление",       "вождение"]
];
const LEGACY_SKILL_RE = LEGACY_SKILL_NAMES.map(([old, now]) =>
  [new RegExp(String.raw`(?<![\p{L}-])${old}(?![\p{L}-])`, "gu"), now]);

/** Старое русское название Навыка → нынешнее (регистр уже нижний). Прочий текст — как есть. */
export function currentSkillName(lowerText) {
  let out = String(lowerText ?? "");
  for (const [re, now] of LEGACY_SKILL_RE) out = out.replace(re, now);
  return out;
}
