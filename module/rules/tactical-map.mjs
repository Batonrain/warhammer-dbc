// module/rules/tactical-map.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАКТИЧЕСКАЯ КАРТА (wdbc-8k0i) — чистая геометрия, без Foundry.
//
//  Три пункта книги (стр. 30-31), которые пользователь явно попросил
//  автоматизировать:
//   • Базы — 2×2 клетки по умолчанию, 3×3 у крупных (Огрин, Терминаторская
//     броня и т.п.), независимо от характеристики «Размер» (та даёт бонус
//     к SPD — см. module/constants/races.mjs, отношения к Базе не имеет).
//   • Дистанции — от края Базы до края Базы (стрельба, округление вверх),
//     от центра к центру (движение, округление вниз); диагональ — по
//     линейке (Евклидово), не по клеткам.
//   • Виды контакта — Базовый (грани Баз соприкасаются) и Глубокий (Базы
//     налагаются). Переиспользует rectsOverlap/rectsInContact из
//     rules/horde-geometry.mjs — они уже общего назначения, не привязаны
//     к Орде именно клетками счёта, а не смыслом.
//
//  Foundry-обвязка (перевод токена в rect, ресинк размера, доступ к canvas)
//  — combat/tactical-map.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { rectsOverlap, rectsInContact } from "./horde-geometry.mjs";

/** Базовый размер Базы в клетках. */
export const BASE_SIZE_DEFAULT = 2;
/** Крупная База (Огрин, Терминаторская броня и т.п.). */
export const BASE_SIZE_LARGE = 3;

/**
 * Размер Базы персонажа в клетках — чистое решение по уже резолвленным
 * флагам (раса/броня резолвятся Foundry-обвязкой, здесь только правило).
 * @param {{raceLarge?: boolean, armorLarge?: boolean}} [flags]
 */
export function baseSizeCells({ raceLarge = false, armorLarge = false } = {}) {
  return (raceLarge || armorLarge) ? BASE_SIZE_LARGE : BASE_SIZE_DEFAULT;
}

/** Радиус вписанной в прямоугольник окружности Базы, в клетках. */
function baseRadiusCells(rect) {
  return Math.min(rect.w ?? 1, rect.h ?? 1) / 2;
}

/** Центр прямоугольника в клетках. */
function rectCenter(rect) {
  return { x: (rect.x ?? 0) + (rect.w ?? 1) / 2, y: (rect.y ?? 0) + (rect.h ?? 1) / 2 };
}

/** Евклидово расстояние между центрами двух прямоугольников, в клетках. */
function centerDistanceCells(rectA, rectB) {
  const a = rectCenter(rectA), b = rectCenter(rectB);
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * От края Базы до края Базы (стрельба, стр. 30) — Евклидово расстояние
 * центров минус радиусы обеих Баз, округление ВВЕРХ (книга требует
 * округлять дистанции для стрельбы в невыгодную для дальности сторону).
 * @param {{x:number,y:number,w:number,h:number}} rectA
 * @param {{x:number,y:number,w:number,h:number}} rectB
 * @param {number} cellMeters  метров на клетку (обычно 1)
 */
export function edgeDistanceMeters(rectA, rectB, cellMeters = 1) {
  const cells = Math.max(0, centerDistanceCells(rectA, rectB) - baseRadiusCells(rectA) - baseRadiusCells(rectB));
  return Math.ceil(cells * cellMeters);
}

/**
 * От центра к центру (движение, стр. 30) — округление ВНИЗ.
 * @param {{x:number,y:number,w:number,h:number}} rectA
 * @param {{x:number,y:number,w:number,h:number}} rectB
 * @param {number} cellMeters
 */
export function centerDistanceMeters(rectA, rectB, cellMeters = 1) {
  return Math.floor(centerDistanceCells(rectA, rectB) * cellMeters);
}

/**
 * Вид контакта двух Баз: "deep" — налагаются, "base" — грани соприкасаются,
 * "none" — не касаются вовсе.
 * @returns {"none"|"base"|"deep"}
 */
export function contactType(rectA, rectB) {
  if (rectsOverlap(rectA, rectB)) return "deep";
  if (rectsInContact(rectA, rectB)) return "base";
  return "none";
}

// ─── Полосы дальности стрельбы (стр. 40 корбука, раздел «Дистанция») ────────
// «+30 в упор 0,5–3 м · +10 короткая до Rng/2 · +0 боевая до Rng ·
//  −10 дальняя до Rng×2 · −30 экстремальная до Rng×3», дальше выстрел
// невозможен. Ключи совпадают с лейблами галочек в диалоге атаки.
export const RANGE_BANDS = [
  { key: "pointBlank", label: "Дистанция в упор",        mod:  30 },
  { key: "short",      label: "Короткая дистанция",      mod:  10 },
  { key: "combat",     label: "Боевая дистанция",        mod:   0 },
  { key: "long",       label: "Дальняя дистанция",       mod: -10 },
  { key: "extreme",    label: "Экстремальная дистанция", mod: -30 }
];

/**
 * Полоса дальности по измеренной дистанции и Rng оружия — чистая логика
 * для автоотметки в диалоге атаки. Каскад «≤» терпит вырожденные полосы
 * (у Rng 4 короткая полоса пуста: в упор ≤3, боевая ≤4).
 * @param {number} distM  метры от края Базы до края Базы (edgeM)
 * @param {number} rng    Rng оружия, м
 * @returns {"pointBlank"|"short"|"combat"|"long"|"extreme"|"out"|null}
 *          null — считать нечего (нет Rng или дистанции), "out" — вне 3×Rng.
 */
export function rangeBandKey(distM, rng) {
  if (!Number.isFinite(distM) || distM < 0 || !(rng > 0)) return null;
  if (distM > rng * 3) return "out";
  if (distM <= 3)       return "pointBlank";
  if (distM <= rng / 2) return "short";
  if (distM <= rng)     return "combat";
  if (distM <= rng * 2) return "long";
  return "extreme";
}

/**
 * Границы полос дальности (верхний край каждой полосы, в метрах) для
 * эффективного Rng оружия — общая точка правды для диалога атаки
 * (подсказка с сеткой полос) и превью-колец дальности на канвасе (wdbc-fb2d),
 * чтобы числа не разъезжались между двумя местами отображения.
 * @param {number} effRng  Эффективный Rng (после множителя/надбавки боеприпаса)
 */
export function rangeBandBoundaries(effRng) {
  const rng = Number(effRng) || 0;
  return {
    pointBlank: 3,
    short: Math.ceil(rng / 2),
    combat: rng,
    long: rng * 2,
    extreme: rng * 3
  };
}
