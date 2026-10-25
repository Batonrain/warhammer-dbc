// module/rules/binary-dominion.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Бинарное Владычество и Бинарная Паства (Таланты Механикума гл. 3, Sahara
//  3-cc96 п.1-2).
//
//  Binary Dominion: «может использовать Tech-Use вместо Command в тестах
//  командования сервиторами, роботами и Скитариями, считая свой уровень Риска
//  равным 3 (при командовании Скитариями уровень Риска не может быть ниже 3)».
//  Binary Flock: «может брать миньонов-людей с Латами Скитарии или Трейтом
//  Mechanicum Implants как Миньонов-машин (в расчёте требований и максимума
//  Миньонов), но создавая их профили как людей».
//
//  Чистый модуль без Foundry. Не замыкает круг импортов: тянет только
//  predicates.mjs (его уже импортирует command-substitution.mjs, лист источника
//  sources.mjs). Таланты опознаются по имени (долг wdbc-iadw) — имя литералом в
//  каждом itemHasName, так их находит tools/capability-reachability.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

const items = actor => [...(actor?.items ?? [])];
const hasTalent = (actor, pred) => items(actor).some(i => i?.type === "talent" && pred(i));

export const hasBinaryDominion = actor =>
  hasTalent(actor, i => itemHasName(i, "Binary Dominion") || itemHasName(i, "Бинарное Владычество"));
export const hasBinaryFlock = actor =>
  hasTalent(actor, i => itemHasName(i, "Binary Flock") || itemHasName(i, "Бинарная Паства"));

/** Миньон группы «Машина» (сервиторы, роботы, дроны) — стр. 111-113. */
export function isMachineMinion(actor) {
  return actor?.type === "minion"
    && (actor.system?.minionGroup || actor.system?.minionType) === "machine";
}

/**
 * Сервитор или робот — Миньон группы «Машина» (стр. 111-113: «Сервиторы, роботы
 * и дроны»). Готовых сервиторов в паках нет, а метки-Черты «Сервитор»/«Робот» в
 * данных тоже не заведено, поэтому сервитор-Персонаж, сделанный ГМом без слота
 * Миньона, отличить от человека нечем — такого система не узнаёт.
 */
export function isServitorOrRobot(actor) {
  return isMachineMinion(actor);
}

/** Боевые Латы Скитария: надетая броня либо имплант (так они выдаются Скитарию). */
function wearsSkitariiPlate(actor) {
  return items(actor).some(i =>
    (i?.type === "armor" ? i.system?.equipped === true : i?.type === "implant")
    && (itemHasName(i, "Skitarii War Plate") || itemHasName(i, "Боевые Латы Скитарии")));
}

/** Скитарий: Архетип «Скитарий» либо Боевые Латы Скитария. */
export function isSkitariiActor(actor) {
  if (!actor) return false;
  const arch = String(actor.system?.archetype ?? "").trim().toLowerCase();
  if (arch === "skitarii" || arch === "скитарий") return true;
  return wearsSkitariiPlate(actor);
}

/** Цель, на которую действует Бинарное Владычество: сервитор, робот или Скитарий. */
export const isBinaryCommandTarget = actor => isServitorOrRobot(actor) || isSkitariiActor(actor);

/**
 * Подмена Command на Tech-Use: насколько Tech-Use больше Command. «Может
 * использовать» — выбор игрока, поэтому ниже нуля подмена не опускается (не
 * хуже, чем без Таланта). Не цель из списка — 0.
 */
export function binaryDominionCommandBonus(actor, ctx = {}) {
  if (!hasBinaryDominion(actor) || !isBinaryCommandTarget(ctx?.targetActor)) return 0;
  const tech = Number(actor?.system?.skills?.techUse?.total);
  const command = Number(actor?.system?.skills?.command?.total);
  if (!Number.isFinite(tech) || !Number.isFinite(command)) return 0;
  return Math.max(0, tech - command);
}

/**
 * Уровень Риска при командовании: сервиторы и роботы — ровно 3, Скитарии — не
 * ниже 3. Смешанный отряд (часть подходит, часть нет) и пустой список — уровень
 * не меняется: книга говорит о командовании этими существами, а не любым строем.
 *
 * @param {number} level  уровень Риска отряда (1..5)
 * @param {Actor[]} commanded  кого сейчас командуют (участники отряда)
 */
export function binaryDominionRisk(actor, level, commanded = []) {
  const base = Number(level) || 1;
  if (!hasBinaryDominion(actor)) return base;
  const list = [...commanded].filter(Boolean);
  if (!list.length) return base;
  if (list.every(isServitorOrRobot)) return 3;
  if (list.every(a => isServitorOrRobot(a) || isSkitariiActor(a))) return Math.max(base, 3);
  return base;
}

// ── Бинарная Паства ─────────────────────────────────────────────────────────

/** Человек, которого Бинарная Паства считает машиной: Латы Скитария или Трейт Mechanicum Implants. */
export function isFlockEligibleHuman(actor) {
  if (!actor) return false;
  if ((actor.system?.minionGroup || actor.system?.minionType) !== "human") return false;
  return wearsSkitariiPlate(actor)
    || items(actor).some(i => i?.type === "trait"
      && (itemHasName(i, "Mechanicum Implants") || itemHasName(i, "Импланты Механикум")));
}

/**
 * Группа Миньона для расчёта максимума и требований Хозяина: Миньон-человек с
 * Латами Скитария/Implants при Бинарной Пастве считается «Машиной». Профиль
 * (характеристики, создание) остаётся человеческим — меняется только счёт.
 */
export function effectiveMinionGroup(master, minion) {
  const group = minion?.system?.minionGroup || minion?.system?.minionType || "";
  if (group === "human" && hasBinaryFlock(master) && isFlockEligibleHuman(minion)) return "machine";
  return group;
}
