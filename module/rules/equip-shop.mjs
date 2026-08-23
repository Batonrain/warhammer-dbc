// module/rules/equip-shop.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Очки Снаряжения (стр. 24, «Стартовое Снаряжение»): помимо снаряжения от
//  Расы/Архетипа/Элитного архетипа, персонаж получает Inf.b Очков Снаряжения
//  и тратит их по фиксированной таблице книги. Чистые данные и математика —
//  сам расход (открыть Обозреватель компендиумов, создать предмет) живёт в
//  Мастере создания (module/apps/character-wizard.mjs), здесь только то, что
//  проверяется без запуска Foundry.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Таблица трат — дословно книга. `kind` определяет, как Мастер создания
 * резолвит строку:
 *   "buy"     — N предметов заданной Редкости (или диапазона) из общих
 *               категорий снаряжения — бюджетный Обозреватель компендиумов.
 *   "quality" — поднять Качество уже полученных предметов на `steps` ступеней;
 *               `count` — скольким предметам сразу (обычно 1, у первой строки — 3).
 *   "special" — пометить оружие Редкостью не выше `maxAvailability` особым
 *               видом (`special`: "rune"|"legacy"|"daemonic").
 */
export const EQUIP_SHOP_ROWS = [
  { key: "r-1",   cost: 1, kind: "buy",     count: 50, maxAvailability: -1,
    label: "50 предметов Редкостью −1 и ниже" },
  { key: "r0",    cost: 1, kind: "buy",     count: 10, maxAvailability: 0,
    label: "10 предметов Редкостью 0" },
  { key: "r1",    cost: 1, kind: "buy",     count: 3,  maxAvailability: 1,
    label: "3 предмета Редкостью 1" },
  { key: "r2",    cost: 1, kind: "buy",     count: 1,  maxAvailability: 2,
    label: "1 предмет Редкостью 2" },
  { key: "r3",    cost: 2, kind: "buy",     count: 1,  maxAvailability: 3,
    label: "1 предмет Редкостью 3" },
  { key: "r4",    cost: 5, kind: "buy",     count: 1,  maxAvailability: 4,
    label: "1 предмет Редкостью 4" },
  { key: "q3x1",  cost: 1, kind: "quality", count: 3, steps: 1, maxAvailability: 1,
    label: "Увеличить Качество 3 предметов с Редкостью 1 и ниже на 1" },
  { key: "q1x2",  cost: 1, kind: "quality", count: 1, steps: 2, maxAvailability: 1,
    label: "Увеличить Качество предмета с Редкостью 1 и ниже на 2" },
  { key: "q1x1hi", cost: 1, kind: "quality", count: 1, steps: 1, minAvailability: 2, maxAvailability: 4,
    label: "Увеличить Качество предмета с Редкостью 2-4 на 1" },
  { key: "rune",     cost: 1, kind: "special", special: "rune",     maxAvailability: 2,
    label: "Сделать оружие Редкостью не более 2 Руническим" },
  { key: "legacy",   cost: 2, kind: "special", special: "legacy",   maxAvailability: 2,
    label: "Сделать оружие Редкостью не более 2 Оружием Наследия" },
  { key: "daemonic", cost: 4, kind: "special", special: "daemonic", maxAvailability: 2,
    label: "Сделать оружие Редкостью не более 2 Демоническим" }
];

export const EQUIP_SHOP_ROW_BY_KEY = Object.fromEntries(EQUIP_SHOP_ROWS.map(r => [r.key, r]));

/** Категории снаряжения, из которых можно покупать по строкам "buy" — любой физический предмет, не Таланты/Психосилы/Черты. */
export const EQUIP_SHOP_PACKS = ["weapons", "armor", "gear", "ammunition", "implants", "tools", "shields"];

/** Пул: Inf.b + ручной бонус (ГМ может расщедриться, стр. 24 явно этого не запрещает). */
export function equipPointsTotal(infBonus, bonusPoints = 0) {
  return Math.max(0, Number(infBonus) || 0) + Math.max(0, Number(bonusPoints) || 0);
}

/** Сколько ещё доступно после уже потраченного. Не может уйти в минус — это ошибка вызывающего, не пользователя. */
export function equipPointsLeft(total, spent) {
  return Math.max(0, (Number(total) || 0) - (Number(spent) || 0));
}

/** Можно ли купить строку с текущим остатком. */
export function canAffordRow(row, left) {
  return !!row && Number(left) >= Number(row.cost);
}

/** 3 модификации Редкостью не более 2 за каждый пожертвованный предмет (стр. 24, отдельно от таблицы очков). */
export const SACRIFICE_MOD_COUNT = 3;
export const SACRIFICE_MOD_MAX_AVAILABILITY = 2;

/**
 * Боеприпасы после завершения выбора снаряжения: 4 полных магазина или 20
 * стандартных — что больше. `magazineMax` — ёмкость магазина оружия
 * (system.magazineMax); для оружия без магазина (0/не задано) считаем от 0,
 * итог всё равно не меньше 20 благодаря max().
 */
export function startingAmmoQuantity(magazineMax) {
  const cap = Math.max(0, Number(magazineMax) || 0);
  return Math.max(4 * cap, 20);
}
