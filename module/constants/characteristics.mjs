export const CHARACTERISTICS = {
  ws:  { label: "Рукопашный Навык", abbr: "WS"  },
  bs:  { label: "Стрелковый Навык", abbr: "BS"  },
  s:   { label: "Сила",             abbr: "S"   },
  t:   { label: "Стойкость",        abbr: "T"   },
  ag:  { label: "Ловкость",         abbr: "Ag"  },
  int: { label: "Интеллект",        abbr: "Int" },
  per: { label: "Восприятие",       abbr: "Per" },
  wp:  { label: "Воля",             abbr: "WP"  },
  fel: { label: "Товарищество",     abbr: "Fel" },
  inf: { label: "Влияние",          abbr: "Inf" },
};

export const IMPROVEMENTS = {
  none:        "Нет",
  simple:      "Простое",
  average:     "Среднее",
  trained:     "Тренированное",
  significant: "Значительное",
  expert:      "Экспертное"
};

export const IMPROVEMENT_BONUS = {
  none: 0, simple: 5, average: 10,
  trained: 15, significant: 20, expert: 25
};

// ── Склонности (Aptitudes) для талантов ─────────────────────────────────────
// Названия — как в книге (стр. 24, таблица Склонностей), сверка 04.10.2026.
export const APTITUDES = {
  ws:         "Рукопашная (WS)",
  bs:         "Стрельба (BS)",
  s:          "Сила (S)",
  t:          "Стойкость (T)",
  ag:         "Ловкость (A)",
  int:        "Интеллект (I)",
  per:        "Восприятие (P)",
  wp:         "Сила Воли (W)",
  fel:        "Товарищество (F)",
  offence:    "Нападение",
  defence:    "Защита",
  finesse:    "Изящество",
  fieldcraft: "Полевая работа",
  knowledge:  "Знания",
  social:     "Социальная",
  tech:       "Технология",
  psyker:     "Псайкана",
  general:    "Общая"
};

export const SKILL_RANKS = {
  untrained: { label: "Нетренированное", bonus: -20 },
  knows:     { label: "Знает",           bonus:   0 },
  trained:   { label: "Тренированное",   bonus:  10 },
  veteran:   { label: "Опытный",         bonus:  20 },
  expert:    { label: "Ветеран",         bonus:  30 }
};