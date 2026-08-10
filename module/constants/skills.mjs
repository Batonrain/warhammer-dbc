// apt2 — вторая склонность навыка (Скл2 из таблицы стр. 57); первая = char.
export const SKILLS_DEF = {
  acrobatics:    { label: "Акробатика",       char: "ag",  apt2: "general"    },
  athletics:     { label: "Атлетика",         char: "s",   apt2: "general"    },
  awareness:     { label: "Бдительность",     char: "per", apt2: "fieldcraft" },
  charm:         { label: "Обаяние",          char: "fel", apt2: "social"     },
  command:       { label: "Командование",     char: "fel", apt2: "social"     },
  commerce:      { label: "Коммерция",        char: "int", apt2: "social"     },
  deceive:       { label: "Обман",            char: "fel", apt2: "social"     },
  dodge:         { label: "Уклонение",        char: "ag",  apt2: "defence"    },
  inquiry:       { label: "Дознание",         char: "fel", apt2: "social"     },
  interrogate:   { label: "Допрос",           char: "wp",  apt2: "social"     },
  intimidate:    { label: "Запугивание",      char: "wp",  apt2: "social"     },
  logic:         { label: "Логика",           char: "int", apt2: "knowledge"  },
  medicae:       { label: "Медика",           char: "int", apt2: "fieldcraft" },
  parry:         { label: "Парирование",      char: "ws",  apt2: "defence"    },
  psyniscience:  { label: "Психонаука",       char: "per", apt2: "psyker"     },
  scrutiny:      { label: "Проницательность", char: "per", apt2: "general"    },
  security:      { label: "Безопасность",     char: "int", apt2: "tech"       },
  sleightOfHand: { label: "Ловкость рук",     char: "ag",  apt2: "finesse"    },
  stealth:       { label: "Скрытность",       char: "ag",  apt2: "fieldcraft" },
  survival:      { label: "Выживание",        char: "per", apt2: "fieldcraft" },
  techUse:       { label: "Техпользование",   char: "int", apt2: "tech"       }
};

// alwaysAlly — группа всегда Дружественная (стр. 58, 61: «Бог: Всегда
// Дружественный, даже если персонаж Неделимый»). Перебивает и Склонности,
// и Мировоззрение, и культуру легиона — цена всегда как у Дружественного.
export const GROUP_SKILLS_DEF = {
  commonLore:     { label: "Общие знания",     char: "int", apt2: "general",   alwaysAlly: true },
  forbiddenLore:  { label: "Запретные знания", char: "int", apt2: "knowledge" },
  scholasticLore: { label: "Ученые знания",    char: "int", apt2: "knowledge" },
  linguistics:    { label: "Лингвистика",      char: "int", apt2: "general"   },
  navigation:     { label: "Навигация",        char: "int", apt2: "fieldcraft"},
  operate:        { label: "Управление",       char: "ag",  apt2: "fieldcraft"},
  trade:          { label: "Ремесло",          char: "int", apt2: "general",   alwaysAlly: true }
};