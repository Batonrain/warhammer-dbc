// module/rules/bone-head.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «BONE-Head / КОСТеголов» (Огрин, корбук, глава I) — чистая часть без
//  Foundry. Книга:
//
//   «Любой тест I занимает у Огрина минимум полное действие и при Успехе дает
//   не больше 1 Успеха. При попадании в поле Haywire интенсивностью 3+ работа
//   импланта нарушается: Огрин теряет способность читать, писать, и считать
//   более, чем до пяти, автоматически проваливает все тесты I, а все его
//   ментальные действия занимают вдвое больше времени (св. действие >
//   полудействие). Попав в поле Haywire интенсивностью 7+, Огрин впадает в
//   Ступор на 1 Раунд, или пока не покинет поле (что произойдет первым)».
//
//  Что где:
//   • потолок 1 Успех и автопровал тестов I в поле 3+ — правила
//     OGRYN_TRAIT_RULES (rules/library/ogryn.mjs), отбор по Черте;
//   • мощность поля — rules/predicates.mjs::haywireFieldIntensity (аура
//     Дискорданта = 7, попадание Haywire — флаг актора);
//   • попадание, затухание по Раундам и Ступор — combat/bone-head.mjs;
//   • «тест I — минимум полное действие» — combat/bone-head.mjs::
//     payIntTestAction (2 ОД до броска, sheets/actor-sheet.mjs::_runTest);
//   • «ментальные действия вдвое дольше» — mentalApCost/
//     mentalSustainedThreshold ниже, читает combat/action-economy.mjs и
//     combat/sustained-action.mjs;
//   • «или пока не покинет поле» — leftHaywireField ниже, область поля
//     помнит флаг HAYWIRE_AREA_FLAG (combat/bone-head.mjs, хук движения).
//
//  Затухание: у свойства Haywire книга пишет «мощность поля — 1d10, затухает
//  на 2 каждый Ход» (constants/weapon-properties.mjs). Считаем по Раундам
//  боя [допущение]: «Ход» здесь — ход поля, а своего места в порядке
//  Инициативы у поля нет.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName, HAYWIRE_FIELD_FLAG, haywireFieldIntensity } from "./predicates.mjs";

export { HAYWIRE_FIELD_FLAG };

/** Английская половина имени Черты — по ней её узнаёт itemHasName. */
export const BONE_HEAD_TRAIT = "BONE-Head";

/** Порог «импланты сбоят» и порог Ступора. */
export const HAYWIRE_IMPAIR_MIN = 3;
export const HAYWIRE_STUPOR_MIN = 7;

/** На сколько затухает поле за Раунд. */
export const HAYWIRE_DECAY_PER_ROUND = 2;

/** Есть ли у актора Черта BONE-Head (своя или от комплексной Черты «Огрин»). */
export function isBoneHead(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "trait" && itemHasName(i, BONE_HEAD_TRAIT));
}

/** Мощность поля через `rounds` Раундов. */
export function decayedHaywire(intensity, rounds) {
  const i = Math.max(0, Number(intensity) || 0);
  return Math.max(0, i - HAYWIRE_DECAY_PER_ROUND * Math.max(0, Number(rounds) || 0));
}

/** Что делает поле такой мощности с имплантом Огрина. */
export function boneHeadHaywireEffects(intensity) {
  const i = Number(intensity) || 0;
  return { impaired: i >= HAYWIRE_IMPAIR_MIN, stupor: i >= HAYWIRE_STUPOR_MIN };
}

/**
 * Сбит ли имплант прямо сейчас: Черта есть и поле, где стоит Огрин, 3+
 * (попадание Haywire или аура Дискорданта — rules/predicates.mjs).
 * Сначала дешёвый флаг/аура, Черта — только если поле есть.
 */
export function implantDisrupted(actor) {
  return haywireFieldIntensity(actor) >= HAYWIRE_IMPAIR_MIN && isBoneHead(actor);
}

// ─── «Любой тест I занимает у Огрина минимум полное действие» ───────────────
// Тесты Навыков и Характеристик в системе ОД не тратят вовсе. У Костеголова
// тест на I (и Навык на I) в свой Ход в бою — Полное действие: 2 ОД
// списываются до броска, не хватает — теста нет. Вне своего Хода (тест по
// просьбе ГМа, встречный) ОД не трогаются.

/** Цена теста I у Костеголова в свой Ход — Полное действие. */
export const INT_TEST_AP_COST = 2;

// ─── «…все его ментальные действия занимают вдвое больше времени» ──────────
// Ментальное действие — трата ОД, помеченная точкой вызова physical:false
// (Духовный разговор, Командование отрядом, тест I — combat/action-economy.mjs).
// Цена удваивается: Полудействие → Полное; Полное (4 ОД) в Ход не влезает —
// его проводят Длительным, которое у сбитого тянется вдвое больше Ходов.
// Не помеченная трата — как есть: угадывать природу безымянного действия
// нельзя (тот же принцип, что у Калечащего). Свободные действия ОД не тратят.

/** Цена траты ОД с учётом сбоя: ментальное (physical === false) — вдвое. */
export function mentalApCost(cost, { physical, disrupted } = {}) {
  const c = Number(cost) || 0;
  return disrupted && physical === false ? c * 2 : c;
}

/** Порог Длительного действия у сбитого — вдвое больше Ходов. */
export function mentalSustainedThreshold(threshold, { physical, disrupted } = {}) {
  const t = Number(threshold) || 0;
  return disrupted && physical === false ? t * 2 : t;
}

// ─── «…или пока не покинет поле» ────────────────────────────────────────────
// Свойство Haywire (X): «При попадании создаёт сферическую область радиусом
// X… Haywire (0) „привязывает“ эффект к цели, а не области, перемещаясь с
// ней». Область поля (центр — где стояла цель при попадании, радиус X м)
// помнит флаг актора HAYWIRE_AREA_FLAG; мощность по-прежнему во флаге
// HAYWIRE_FIELD_FLAG и гаснет на 2 за Раунд.

/** Флаг актора: {sceneId, x, y, radius, dazed} — область поля Haywire. */
export const HAYWIRE_AREA_FLAG = "haywireFieldArea";

/**
 * Вышел ли токен из поля. Координаты — пиксели сцены, перевод в метры через
 * клетку (`gridSize` пикселей = `gridDistance` м). Радиус 0 — Haywire (0),
 * поле едет с целью: выйти нельзя.
 *
 * @param {{x:number, y:number, radius:number}} area
 * @param {{x:number, y:number}} point центр токена
 */
export function leftHaywireField(area, point, { gridSize = 100, gridDistance = 1 } = {}) {
  const r = Number(area?.radius) || 0;
  if (r <= 0 || !point) return false;
  const px = Math.hypot((Number(point.x) || 0) - (Number(area.x) || 0), (Number(point.y) || 0) - (Number(area.y) || 0));
  return px / (Number(gridSize) || 100) * (Number(gridDistance) || 1) > r;
}
