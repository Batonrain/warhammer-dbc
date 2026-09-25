// module/rules/starting-characteristics.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Стартовые Характеристики (корбук, глава I, стр. 3–4): Генерация, Сборка,
//  Смещение Характеристик и «Рядовые».
//
//  Стартовая Характеристика = база расы + бонусная. Бонусные даются одним из
//  двух методов «по выбору ГМа» — мировая настройка creationCharMethod:
//  только Генерация, только Сборка или оба (тогда выбирает игрок).
//
//  • Генерация — 2 комплекта по 9+<Бонусные Броски> бросков 2d10, один
//    отбрасывается, 9 старших из другого раскидываются по Характеристикам.
//  • Сборка — 100+<Бонусные Очки> очков, в каждую Характеристику минимум +2;
//    +18→+19 стоит 2 Очка, +19→+20 — 3 Очка (выше +20 книга цены не даёт —
//    значит, это потолок).
//  • Смещение — за каждое +5 одной стартовой Характеристике за счёт −5 другой;
//    одну и ту же можно смещать несколько раз.
//  • Рядовые — Бонусные Броски и Бонусные Очки теряются, Смещения игнорируются.
//
//  Inf и Cor ни в одном методе не участвуют: Бесчестие — rules/starting-infamy,
//  Порча — база расы без бонусов.
//
//  Модуль чистый (без Foundry): Мастер создания (apps/character-wizard.mjs)
//  только показывает и записывает то, что здесь посчитано.
// ════════════════════════════════════════════════════════════════════════════

/** Характеристики, в которые идут бонусные значения (все, кроме Inf и Cor). */
export const BONUS_CHARS = ["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel"];

/** Значения мировой настройки «Метод стартовых Характеристик». */
export const CREATION_METHODS = {
  generation: "Генерация",
  pointbuy:   "Сборка",
  both:       "Оба — на выбор игрока"
};

export const POINTBUY_BASE = 100;
export const POINTBUY_MIN  = 2;
export const POINTBUY_MAX  = 20;
export const SHIFT_STEP    = 5;

/** Какие методы доступны игроку при данной настройке мира. */
export function allowedMethods(setting) {
  if (setting === "pointbuy") return ["pointbuy"];
  if (setting === "both") return ["generation", "pointbuy"];
  return ["generation"];
}

/** Бонусные Броски с учётом «Рядовых». */
export function effectiveBonusRolls(race, rankAndFile = false) {
  return rankAndFile ? 0 : Math.max(0, Number(race?.bonusRolls) || 0);
}

/** Запас очков Сборки: 100 + Бонусные Очки расы (у Рядовых — без них). */
export function pointBuyPool(race, rankAndFile = false) {
  return POINTBUY_BASE + (rankAndFile ? 0 : Math.max(0, Number(race?.bonusPoints) || 0));
}

/** Число Смещений Характеристик (у Рядовых — ноль). */
export function effectiveShifts(race, rankAndFile = false) {
  return rankAndFile ? 0 : Math.max(0, Number(race?.charShift) || 0);
}

/**
 * Сколько очков Сборки стоит бонус +v целиком: до +18 — по очку за единицу,
 * +19 — ещё 2, +20 — ещё 3.
 */
export function pointBuyCost(v) {
  const n = Math.max(0, Math.min(POINTBUY_MAX, Math.floor(Number(v) || 0)));
  if (n <= 18) return n;
  return 18 + 2 + (n >= 20 ? 3 : 0);
}

/** Раскладка Сборки по умолчанию — минимум +2 в каждую. */
export function defaultPointBuy() {
  return Object.fromEntries(BONUS_CHARS.map(k => [k, POINTBUY_MIN]));
}

/**
 * Проверка раскладки Сборки.
 * @returns {{spent:number, left:number, ok:boolean, errors:string[]}}
 */
export function checkPointBuy(alloc, pool) {
  const errors = [];
  let spent = 0;
  for (const k of BONUS_CHARS) {
    const v = Number(alloc?.[k]) || 0;
    if (v < POINTBUY_MIN) errors.push(`${k}: меньше +${POINTBUY_MIN}`);
    if (v > POINTBUY_MAX) errors.push(`${k}: больше +${POINTBUY_MAX}`);
    spent += pointBuyCost(v);
  }
  const left = pool - spent;
  if (left < 0) errors.push(`перерасход на ${-left}`);
  return { spent, left, ok: errors.length === 0, errors };
}

/**
 * Можно ли поднять/опустить бонус k на 1 при данном запасе.
 * @param {1|-1} dir
 */
export function canStepPointBuy(alloc, pool, k, dir) {
  const cur = Number(alloc?.[k]) || 0;
  const next = cur + dir;
  if (next < POINTBUY_MIN || next > POINTBUY_MAX) return false;
  if (dir < 0) return true;
  return checkPointBuy(alloc, pool).spent - pointBuyCost(cur) + pointBuyCost(next) <= pool;
}

/**
 * Применяет Смещения к стартовым Характеристикам. Незаполненные (без up/down
 * или up===down) пропускаются; лишние сверх лимита отбрасываются.
 * @param {Record<string,number>} values стартовые значения (база + бонус)
 * @param {{up:string, down:string}[]} shifts
 * @param {number} limit
 */
export function applyShifts(values, shifts, limit) {
  const out = { ...values };
  for (const s of completeShifts(shifts).slice(0, Math.max(0, limit))) {
    out[s.up]   = (out[s.up]   || 0) + SHIFT_STEP;
    out[s.down] = (out[s.down] || 0) - SHIFT_STEP;
  }
  return out;
}

/** Только заполненные и осмысленные Смещения. */
export function completeShifts(shifts) {
  return (shifts || []).filter(s => s && BONUS_CHARS.includes(s.up)
    && BONUS_CHARS.includes(s.down) && s.up !== s.down);
}
