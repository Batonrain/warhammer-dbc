// apt2 — вторая склонность навыка (Скл2 из таблицы стр. 57); первая = char.
// en — английское имя (как оно встречается в module/constants/legions.mjs::CULT
// friendlySkills/hostileSkills, стр. 58-... книги) — cultureCat() матчит по
// подстроке в НИЖНЕМ РЕГИСТРЕ АНГЛИЙСКОГО текста; передавать туда русский
// label бессмысленно (wdbc-ko14 — до этой правки культура легиона для Навыков
// через SKILLS_DEF никогда реально не матчилась).
export const SKILLS_DEF = {
  acrobatics:    { label: "Акробатика",       en: "Acrobatics",     char: "ag",  apt2: "general"    },
  athletics:     { label: "Атлетика",         en: "Athletics",      char: "s",   apt2: "general"    },
  awareness:     { label: "Бдительность",     en: "Awareness",      char: "per", apt2: "fieldcraft" },
  charm:         { label: "Обаяние",          en: "Charm",          char: "fel", apt2: "social"     },
  command:       { label: "Командование",     en: "Command",        char: "fel", apt2: "social"     },
  commerce:      { label: "Коммерция",        en: "Commerce",       char: "int", apt2: "social"     },
  deceive:       { label: "Обман",            en: "Deceive",        char: "fel", apt2: "social"     },
  dodge:         { label: "Уклонение",        en: "Dodge",          char: "ag",  apt2: "defence"    },
  inquiry:       { label: "Дознание",         en: "Inquiry",        char: "fel", apt2: "social"     },
  interrogate:   { label: "Допрос",           en: "Interrogate",    char: "wp",  apt2: "social"     },
  intimidate:    { label: "Запугивание",      en: "Intimidate",     char: "wp",  apt2: "social"     },
  logic:         { label: "Логика",           en: "Logic",          char: "int", apt2: "knowledge"  },
  medicae:       { label: "Медика",           en: "Medicae",        char: "int", apt2: "fieldcraft" },
  parry:         { label: "Парирование",      en: "Parry",          char: "ws",  apt2: "defence"    },
  psyniscience:  { label: "Психонаука",       en: "Psyniscience",   char: "per", apt2: "psyker"     },
  scrutiny:      { label: "Проницательность", en: "Scrutiny",       char: "per", apt2: "general"    },
  security:      { label: "Безопасность",     en: "Security",       char: "int", apt2: "tech"       },
  sleightOfHand: { label: "Ловкость рук",     en: "Sleight of Hand",char: "ag",  apt2: "finesse"    },
  stealth:       { label: "Скрытность",       en: "Stealth",        char: "ag",  apt2: "fieldcraft" },
  survival:      { label: "Выживание",        en: "Survival",       char: "per", apt2: "fieldcraft" },
  techUse:       { label: "Техпользование",   en: "Tech-Use",       char: "int", apt2: "tech"       }
};

// alwaysAlly — группа всегда Дружественная (стр. 58, 61: «Бог: Всегда
// Дружественный, даже если персонаж Неделимый»). Перебивает и Склонности,
// и Мировоззрение, и культуру легиона — цена всегда как у Дружественного.
// en — см. комментарий над SKILLS_DEF; group-варианты (Forbidden Lore и т.п.)
// матчатся substring'ом БЕЗ специализации — «forbidden lore (archeotech)»
// содержит «forbidden lore» целиком, специализацию указывать не нужно.
export const GROUP_SKILLS_DEF = {
  commonLore:     { label: "Общие знания",     en: "Common Lore",     char: "int", apt2: "general",   alwaysAlly: true },
  forbiddenLore:  { label: "Запретные знания", en: "Forbidden Lore",  char: "int", apt2: "knowledge" },
  scholasticLore: { label: "Ученые знания",    en: "Scholastic Lore", char: "int", apt2: "knowledge" },
  linguistics:    { label: "Лингвистика",      en: "Linguistics",     char: "int", apt2: "general"   },
  navigation:     { label: "Навигация",        en: "Navigation",      char: "int", apt2: "fieldcraft"},
  operate:        { label: "Управление",       en: "Operate",         char: "ag",  apt2: "fieldcraft"},
  trade:          { label: "Ремесло",          en: "Trade",           char: "int", apt2: "general",   alwaysAlly: true }
};