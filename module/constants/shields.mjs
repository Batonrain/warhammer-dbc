/**
 * Константы силовых щитов Warhammer FFG. Сами записи щитов — в packs-src/,
 * здесь только справочники для листа и логики боя.
 */

// ── Природа щита ─────────────────────────────────────────────────────────────
export const SHIELD_NATURES = {
  technological: "Технологический",
  warp:          "Чародейский"
};

// ── Тип щита ──────────────────────────────────────────────────────────────────
export const SHIELD_TYPES = {
  dome:        "Купол",
  deflector:   "Дефлектор",
  penetrating: "Сквозной"
};

// ── Статус щита ───────────────────────────────────────────────────────────────
export const SHIELD_STATUS = {
  inactive:   { label: "Выключен",   icon: "🔴", css: "shield-off"      },
  active:     { label: "Активен",    icon: "🟢", css: "shield-active"   },
  overloaded: { label: "Перегружен", icon: "🟡", css: "shield-overload" },
  damaged:    { label: "Повреждён",  icon: "⚠️", css: "shield-damaged"  }
};
