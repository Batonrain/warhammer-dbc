// module/rules/bone-head.mjs
// ════════════════════════════════════════════════════════════════════════════
//  BONE-Head / Костеголов (Огрин) — то, что правило-эффектом не выразить:
//  цена действий и выход из поля Haywire. Тесты I (потолок 1 Успеха, провал
//  при Сбое) — эффекты rules/library/ogryn.mjs; здесь арифметика для
//  combat/action-economy.mjs, sheets/actor-sheet.mjs::_runTest и
//  combat/bone-head-field.mjs. Чистый модуль, без Foundry.
//
//  «Любой тест I занимает у Огрина минимум полное действие» — тесты Навыков
//  и Характеристик в системе ОД не тратят вовсе (их объявляет игрок, ГМ
//  решает, чем они были). У Костеголова тест на I в свой Ход в бою —
//  Полное действие: 2 ОД списываются до броска, не хватает — теста нет.
//  Вне своего Хода (тест по просьбе ГМа, встречный) ОД не трогаются.
//
//  «…все его ментальные действия занимают вдвое больше времени
//  (св. действие > полудействие)» — при Сбое импланта. Ментальное действие —
//  то, что точка траты ОД пометила physical:false (Командование голосом,
//  Духовный разговор, психический ритуал — combat/action-economy.mjs). Цена
//  удваивается: Полудействие → Полное; Полное (4 ОД) в Ход не влезает — его
//  проводят Длительным действием, которое у сбитого тянется вдвое больше
//  Ходов. Свободные действия ОД не тратят и сюда не приходят.
// ════════════════════════════════════════════════════════════════════════════

/** Возможность «мозговые импланты Огрина» — выдаёт ogryn.boneHead.flag. */
export const BONE_HEAD_FLAG = "haywire.boneHead";

/** Возможность «тест I — Полное действие» — выдаёт ogryn.boneHead.intFullAction. */
export const INT_FULL_ACTION_FLAG = "tests.intFullAction";

/** Цена теста I у Костеголова в свой Ход — Полное действие. */
export const INT_TEST_AP_COST = 2;

/** Флаг актора: где висит поле, сбившее имплант (combat/bone-head-field.mjs). */
export const HAYWIRE_FIELD_FLAG = "boneHeadHaywireField";

/** Сбит ли имплант прямо сейчас: Черта есть и Состояние «Сбой импланта» висит. */
export function implantDisrupted(conditions, hasBoneHead) {
  return !!hasBoneHead && !!conditions?.implantHaywire;
}

/**
 * Цена траты ОД с учётом Сбоя: ментальное (physical === false) — вдвое.
 * Не указано/физическое — как есть: угадывать природу безымянной траты
 * нельзя (тот же принцип, что у Калечащего в action-economy.mjs).
 */
export function mentalApCost(cost, { physical, disrupted } = {}) {
  const c = Number(cost) || 0;
  return disrupted && physical === false ? c * 2 : c;
}

/** Порог Длительного действия у сбитого — вдвое больше Ходов. */
export function mentalSustainedThreshold(threshold, { physical, disrupted } = {}) {
  const t = Number(threshold) || 0;
  return disrupted && physical === false ? t * 2 : t;
}

/**
 * Вышел ли токен из поля. Поле — шар радиуса `radius` метров вокруг точки
 * попадания; координаты в пикселях сцены, перевод через размер клетки
 * (`gridSize` пикселей = `gridDistance` метров). Радиус 0 — Haywire (0)
 * «привязан к цели» и перемещается с ней: из такого поля не выйти.
 *
 * @param {{x:number, y:number, radius:number}} field
 * @param {{x:number, y:number}} point центр токена
 */
export function leftHaywireField(field, point, { gridSize = 100, gridDistance = 1 } = {}) {
  const r = Number(field?.radius) || 0;
  if (r <= 0 || !point) return false;
  const px = Math.hypot((Number(point.x) || 0) - (Number(field.x) || 0), (Number(point.y) || 0) - (Number(field.y) || 0));
  const meters = px / (Number(gridSize) || 100) * (Number(gridDistance) || 1);
  return meters > r;
}
