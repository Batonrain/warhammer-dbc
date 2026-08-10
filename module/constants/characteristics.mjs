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
export const APTITUDES = {
  ws:         "Рукопашный навык (WS)",
  bs:         "Стрелковый навык (BS)",
  s:          "Сила (S)",
  t:          "Стойкость (T)",
  ag:         "Ловкость (A)",
  int:        "Интеллект (I)",
  per:        "Восприятие (P)",
  wp:         "Воля (W)",
  fel:        "Товарищество (F)",
  inf:        "Влияние (Inf)",
  offence:    "Нападение",
  defence:    "Защита",
  finesse:    "Искусность",
  fieldcraft: "Полевые навыки",
  knowledge:  "Знание",
  leadership: "Лидерство",
  social:     "Социальное",
  tech:       "Техника",
  psyker:     "Псайкер",
  general:    "Общее"
};

export const SKILL_RANKS = {
  untrained: { label: "Нетренированное", bonus: -20 },
  knows:     { label: "Знает",           bonus:   0 },
  trained:   { label: "Тренированное",   bonus:  10 },
  veteran:   { label: "Опытный",         bonus:  20 },
  expert:    { label: "Ветеран",         bonus:  30 }
};