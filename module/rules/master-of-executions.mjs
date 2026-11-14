// module/rules/master-of-executions.mjs
// ════════════════════════════════════════════════════════════════════════
//  Мастер Казней (Элитный архетип Космодесанта Хаоса, глава 3, Sahara 1-54b9) — чистая логика без Foundry.
//  Foundry-обвязка — combat/master-of-executions.mjs.
//
//  Целеустремлённый Охотник: «Психопатия» на Тяжести 0 (не ниже 0) и Помеха на тесты Command, Charm,
//  Deceive и Inquiry. Взор Охотника: души существ в зоне Unnatural Senses и их грубая сила по Inf.
//  Туманоходец: нельзя в Терминаторской броне и Экзо-Костюме, нельзя телепортом уйти дальше от
//  достойной цели, чем начал; выход из Захвата. Туманный Прыжок: в базовый контакт с добычей,
//  как Натиск. Спаситель Туманов: обмен местами с согласным или Беспомощным союзником.
//
//  Способности опознаются по имени предмета ИЛИ по ключу записи Конструктора (rules/item-marker.mjs),
//  как в rules/dark-apostle.mjs. Модуль ничего из combat/, flags.mjs и character.mjs не импортирует.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { itemHasKey } from "./item-marker.mjs";
import { liveTraitRating } from "./flight-speed.mjs";
import { mechRollData } from "./mech-formula.mjs";

const hasAbility = (actor, key, name, type) =>
  [...(actor?.items ?? [])].some(i => i?.type === type && (itemHasName(i, name) || itemHasKey(i, key)));

export const hasSingleMindedHunter = actor => hasAbility(actor, "ability.singleMindedHunter", "Single-Minded Hunter", "trait");
export const hasHunterSight = actor => hasAbility(actor, "ability.hunterSight", "Hunter Sight", "trait");
export const hasMistSavior = actor => hasAbility(actor, "ability.mistSavior", "Mist Savior", "talent");
export const hasMistwalker = actor => hasAbility(actor, "ability.mistwalker", "Mistwalker", "trait");
export const hasMistLeap = actor => hasAbility(actor, "ability.mistLeap", "Mist Leap", "talent");

/** Навыки, на которые Целеустремлённый Охотник получает Помеху. */
export const HUNTER_HINDRANCE_SKILLS = Object.freeze(["command", "charm", "deceive", "inquiry"]);

/** Помеха Целеустремлённого Охотника на этот Навык. */
export function hunterHindranceApplies(actor, skill) {
  return hasSingleMindedHunter(actor) && HUNTER_HINDRANCE_SKILLS.includes(String(skill ?? ""));
}

/** Название расстройства и его нижний предел Тяжести (книга: «не может опуститься ниже 0»). */
export const HUNTER_DISORDER = Object.freeze({ name: "Психопатия", severityMin: 0 });

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Дальность Unnatural Senses в метрах: рейтинг Трейта (у Мастера Казней он выдан значением P), без Трейта — P.
 * Отмеченная Добыча даёт «до P км вместо P м» — тысячекратно (km = true).
 */
export function unnaturalSensesRange(actor, { km = false } = {}) {
  const senses = [...(actor?.items ?? [])].find(i => i?.type === "trait"
    && (itemHasName(i, "Unnatural Senses") || itemHasName(i, "Сверхъестественные Чувства")));
  let rating = num(senses?.system?.rating);
  if (senses) {
    try { rating = num(liveTraitRating(senses, mechRollData(actor))) || rating; } catch { /* формулы нет — берём выданное число */ }
  }
  const base = rating > 0 ? rating : Math.max(0, num(actor?.system?.characteristics?.per?.total));
  return km ? base * 1000 : base;
}

/** Грубая сила души по Inf цели: те же пороги 30 / 60 / 80, что у Казни и Трофеев Триумфа. */
export function soulTier(inf) {
  const n = num(inf);
  if (n >= 80) return { key: "great", label: "великая душа", inf: n };
  if (n >= 60) return { key: "mighty", label: "могучая душа", inf: n };
  if (n >= 30) return { key: "notable", label: "заметная душа", inf: n };
  return { key: "faint", label: "слабая душа", inf: n };
}

/** Надета ли броня, с которой Туманоходец не телепортируется: Терминаторская (крупная База) или Экзо-Костюм. */
export function wearsTerminatorOrExo(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "armor" && i.system?.equipped
    && (i.system?.largeBase === true || /terminator|терминатор|exo-?suit|экзо-?костюм/i.test(String(i.name ?? ""))));
}

/**
 * Не дальше ли от ближайшей достойной цели, чем начал: сравнение ближайших расстояний до и после.
 * Нет целей отсчёта — ограничение нечем мерить, телепорт разрешён.
 * @param {number[]} before расстояния до целей отсчёта из старой точки
 * @param {number[]} after  из новой
 */
export function mistwalkerAnchorOk(before, after) {
  const b = (before ?? []).filter(Number.isFinite);
  const a = (after ?? []).filter(Number.isFinite);
  if (!b.length || !a.length) return true;
  return Math.min(...a) <= Math.min(...b) + 0.01;
}

/**
 * Центр токена-прыгуна в базовом контакте с добычей: на прямой от центра добычи к прыгуну, ровно там, где
 * прямоугольники Баз соприкасаются (у крупной добычи — у её края, а не внутри неё).
 * @param {{x:number,y:number,width?:number,height?:number}} self   токен прыгуна (пиксели, левый верхний угол; размер в клетках)
 * @param {{x:number,y:number,width?:number,height?:number}} prey   токен добычи
 * @param {number} size  размер клетки сцены в пикселях
 * @returns {{x:number,y:number,distCells:number}} центр новой позиции
 */
export function baseContactPoint(self, prey, size = 100) {
  const cx = t => num(t.x) + (num(t.width) || 1) * size / 2;
  const cy = t => num(t.y) + (num(t.height) || 1) * size / 2;
  const px = cx(prey), py = cy(prey);
  let dx = cx(self) - px, dy = cy(self) - py;
  const len = Math.hypot(dx, dy);
  if (len === 0) { dx = 1; dy = 0; } else { dx /= len; dy /= len; }
  const hx = ((num(self.width) || 1) + (num(prey.width) || 1)) / 2 * size;
  const hy = ((num(self.height) || 1) + (num(prey.height) || 1)) / 2 * size;
  const t = Math.min(Math.abs(dx) > 1e-9 ? hx / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-9 ? hy / Math.abs(dy) : Infinity);
  return { x: px + dx * t, y: py + dy * t, distCells: t / size };
}

/** Стоят ли Базы вплотную (зазор между краями не больше полуклетки, диагональ допускается). */
export function basesInContact(a, b, size = 100) {
  const cx = t => num(t.x) + (num(t.width) || 1) * size / 2;
  const cy = t => num(t.y) + (num(t.height) || 1) * size / 2;
  const gapX = Math.max(0, Math.abs(cx(a) - cx(b)) - ((num(a.width) || 1) + (num(b.width) || 1)) / 2 * size);
  const gapY = Math.max(0, Math.abs(cy(a) - cy(b)) - ((num(a.height) || 1) + (num(b.height) || 1)) / 2 * size);
  return Math.hypot(gapX, gapY) <= size * 0.5;
}

/** Новый левый верхний угол токена такого размера, чтобы его центр встал в точку. */
export function topLeftFor(tokenDoc, center, size = 100) {
  return {
    x: Math.round(center.x - (num(tokenDoc?.width) || 1) * size / 2),
    y: Math.round(center.y - (num(tokenDoc?.height) || 1) * size / 2)
  };
}

/** Потолок дальности обмена местами для сверки ГМ-релеем: P.b (Туманоходец) или Полудвижение (Fanatic), что больше, не меньше 1 м. */
export function swapLimitMeters(actor) {
  return Math.max(1, num(actor?.system?.characteristics?.per?.bonus), num(actor?.system?.movement?.halfMove));
}

/** Согласие на обмен не нужно, если цель Беспомощна (книга: «согласной на это или Беспомощной»). */
export const swapNeedsConsent = ally => !ally?.system?.conditions?.helpless;
