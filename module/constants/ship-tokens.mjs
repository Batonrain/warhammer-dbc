// module/constants/ship-tokens.mjs
// Иконки/размеры/цвета токенов кораблей: условные обозначения по классу корпуса
// (натовский стиль эшелонов) + цвет по «отношению» (тинт токена).

import { SHIP_COMPONENTS } from "./ship-components.mjs";

const ICON_BASE = "systems/warhammer-dbc/assets/ship-icons/";

// Отношение → цвет (когитаторная палитра) и метка.
export const SHIP_RELATIONS = {
  player:  { label: "Корабль игроков",   color: "#ffd23f" }, // жёлтый
  ally:    { label: "Союзный корабль",   color: "#3fb6ff" }, // ярко-голубой
  enemy:   { label: "Вражеский корабль", color: "#ff4d4d" }, // красный
  neutral: { label: "Нейтральный корабль", color: "#4dffa6" } // зелёный
};

// Отношение → расположение токена Foundry.
export const RELATION_DISPOSITION = {
  player:  1,   // FRIENDLY
  ally:    1,   // FRIENDLY
  enemy:  -1,   // HOSTILE
  neutral: 0    // NEUTRAL
};

// Категория корпуса → иконка и базовый размер токена [ширина, высота].
const CATEGORY_ICON = {
  "Транспорты":        "transport.svg",
  "Рейдеры":           "raider.svg",
  "Фрегаты":           "frigate.svg",
  "Лёгкие крейсеры":   "light-cruiser.svg",
  "Крейсеры":          "cruiser.svg",
  "Линейные крейсеры": "battlecruiser.svg",
  "Гранд-крейсеры":    "grand-cruiser.svg",
  "Линкоры":           "battleship.svg"
};
const CATEGORY_BASE_SIZE = {
  "Транспорты":        [1, 1],
  "Рейдеры":           [1, 1],
  "Фрегаты":           [1, 1],
  "Лёгкие крейсеры":   [2, 1],
  "Крейсеры":          [2, 1],
  "Линейные крейсеры": [2, 1],
  "Гранд-крейсеры":    [3, 2],
  "Линкоры":           [4, 2]
};
// Исключения размера по классу корпуса (в рамках категории).
const CATEGORY_SIZE_EXCEPTIONS = {
  "Транспорты": {
    "Джон Бахмейер": [2, 1], "Мул": [2, 1], "Купец": [2, 1], "Титан": [3, 2],
    "Колосс": [4, 2], "Открытие": [2, 1], "Цверг": [2, 1], "Голиаф": [2, 1],
    "Вселенная": [4, 2]
  },
  "Линейные крейсеры": { "Одиссея": [3, 2], "Одиссей": [3, 2] },
  "Линкоры": { "Глориана": [5, 3], "Легат": [3, 2], "Бездна": [6, 3] }
};

// shipType актора → категория корпуса (для снятия неоднозначности по имени).
const SHIPTYPE_CATEGORY = {
  transport:    "Транспорты",
  raider:       "Рейдеры",
  frigate:      "Фрегаты",
  lightCruiser: "Лёгкие крейсеры",
  cruiser:      "Крейсеры",
  grandCruiser: "Гранд-крейсеры",
  battleship:   "Линкоры"
};

// Имя корпуса → множество категорий (из библиотеки узлов).
const HULL_CATEGORY = (() => {
  const m = new Map();
  for (const c of SHIP_COMPONENTS) {
    if (c.system?.kind !== "hull") continue;
    const cat = Array.isArray(c.folder) ? c.folder[c.folder.length - 1] : null;
    if (!cat) continue;
    if (!m.has(c.name)) m.set(c.name, new Set());
    m.get(c.name).add(cat);
  }
  return m;
})();

/** Определить категорию корпуса по имени (+ shipType для снятия неоднозначности). */
export function shipHullCategory(hullName, shipType) {
  const cats = HULL_CATEGORY.get(hullName);
  const byType = SHIPTYPE_CATEGORY[shipType] || null;
  if (cats && cats.size) {
    if (cats.size === 1) return [...cats][0];
    if (byType && cats.has(byType)) return byType;
    return [...cats][0];
  }
  return byType;   // корпуса нет в библиотеке — берём по типу актора
}

/** Размер токена [ширина, высота] по имени корпуса и его категории. */
export function shipTokenSize(hullName, category) {
  const ex = CATEGORY_SIZE_EXCEPTIONS[category]?.[hullName];
  if (ex) return ex;
  return CATEGORY_BASE_SIZE[category] || [1, 1];
}

/**
 * Полная «идентичность» токена корабля из актора:
 *   { icon, tint, disposition, width, height } либо null (нет корпуса и типа).
 */
export function computeShipIdentity(actor) {
  const hull = actor.items.find(i => i.type === "component" && i.system?.kind === "hull");
  const shipType = actor.system?.shipType || "";
  const hullName = hull?.name || "";
  const category = shipHullCategory(hullName, shipType);
  if (!category) return null;

  const rel = actor.system?.shipRelation || "neutral";
  const icon = ICON_BASE + (CATEGORY_ICON[category] || "cruiser.svg");
  const [w, h] = shipTokenSize(hullName, category);
  return {
    icon,
    tint: SHIP_RELATIONS[rel]?.color || SHIP_RELATIONS.neutral.color,
    disposition: RELATION_DISPOSITION[rel] ?? 0,
    width: w, height: h,
    category
  };
}
