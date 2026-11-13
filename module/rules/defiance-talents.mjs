// module/rules/defiance-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Таланты Пси-Стойкости главы 3, которым нужен собственный читатель (Sahara
//  3-defiance): Взгляд в Бездну, Инфернальное Знакомство (Страх демонов −1 —
//  rules/fear-ignore.mjs; штраф Daemonic Dread −5 — regions/auras.mjs),
//  Ведьмоискатель (галочка в окне броска — sheets/actor-sheet.mjs). Остальные
//  (Бастион Железной Воли, Ортопрокси) — записи Конструктора на новых областях
//  теста (rules/resolve-test.mjs: psychicPower, interrogation), читателя в коде
//  не требуют.
//
//  Чистый модуль без Foundry; не импортируется из sources.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

// ── Инфернальное Знакомство ──────────────────────────────────────────────────

export const INFERNAL_FAMILIARITY_CAP = "psyResist.core.infernalFamiliarity";

/** «Уменьшает штраф к W от Трейта Daemonic Presence на 5». */
export const INFERNAL_FAMILIARITY_DREAD_REDUCTION = 5;

/** Ключ характеристики, на которую действует выданный аурой штраф Daemonic Dread. */
const DREAD_CHANGE_KEY = "system.characteristics.wp.totalFx";

/** Это предмет-штраф ауры Daemonic Presence («Daemonic Dread (−X W) / Демонический Ужас»)? */
export function isDaemonicDread(data) {
  return /^Daemonic Dread\b/i.test(String(data?.name ?? "").trim());
}

/**
 * Штраф Daemonic Dread, который получает носитель Инфернального Знакомства.
 * Штраф выдаёт аура (regions/auras.mjs клонирует предмет «Daemonic Dread (−X W)»
 * врагам в радиусе); здесь выданная копия переписывается под цель: −X становится
 * −(X−5) в эффекте, названии и описании. Штраф опустился до нуля — копию не
 * выдаём вовсе (null). Не Dread, нулевое снижение или нераспознанная форма
 * эффекта — данные возвращаются как были.
 *
 * @param {object} data   plain-данные предмета (Item#toObject())
 * @param {number} reduction на сколько уменьшить штраф (>0)
 * @returns {object|null} данные для выдачи или null — выдавать нечего
 */
export function reduceDaemonicDread(data, reduction) {
  const cut = Number(reduction) || 0;
  if (!isDaemonicDread(data) || !(cut > 0)) return data;
  const out = structuredClone(data);
  let left = null;
  for (const effect of out.effects ?? []) {
    for (const change of effect.system?.changes ?? []) {
      if (change.key !== DREAD_CHANGE_KEY || !(Number(change.value) < 0)) continue;
      change.value = Math.min(0, Number(change.value) + cut);
      left = Math.abs(change.value);
    }
  }
  if (left === null) return data;
  if (left === 0) return null;
  // Подписи: «(−10 W) / (−10 к W)» в названии и эффекте, «−10 к Итого Воли» в описании.
  const relabel = text => typeof text === "string"
    ? text.replace(/(\()−\d+( к)? W\)/g, (_m, p, k) => `${p}−${left}${k ?? ""} W)`).replace(/−\d+ к Итого/g, `−${left} к Итого`)
    : text;
  out.name = relabel(out.name);
  for (const effect of out.effects ?? []) effect.name = relabel(effect.name);
  if (out.system) out.system.benefit = relabel(out.system.benefit);
  return out;
}

// ── Ведьмоискатель ───────────────────────────────────────────────────────────

export const WITCHFINDER_CAP = "psyResist.core.witchfinder";

/**
 * Какой из двух тестов Ведьмоискателя это может быть: «Awareness на засекание
 * проявления психосил» ("detect") или «Forbidden Lore (Psykers) для распознания
 * психосилы» ("recognize"); иной тест — null. Система не знает, для чего игрок
 * бросает Awareness или Forbidden Lore, поэтому по этим признакам только решается,
 * предлагать ли галочку «Это засекание/распознание психосилы» в окне теста;
 * включает её игрок (тот же приём, что «Земной ужас» у Пресыщенного).
 *
 * Специализация Forbidden Lore приходит текстом («Psykers», «Варп, Демоны и
 * Псайкеры» — совмещённая запись тоже содержит Псайкеров).
 *
 * @param {{skill?: string, group?: string, specialty?: string}} ctx контекст броска
 * @returns {"detect"|"recognize"|null}
 */
export function witchfinderTestKind(ctx) {
  if (String(ctx?.skill ?? "").toLowerCase() === "awareness") return "detect";
  if (String(ctx?.group ?? "").toLowerCase() === "forbiddenlore"
      && /psyker|псайкер/i.test(String(ctx?.specialty ?? ""))) return "recognize";
  return null;
}

/**
 * Взгляд в Бездну: «на 1 Порчи меньше от эффектов Феноменов, Прорывов,
 * Варп-Шока, Отвращения Варпа, Психосил и Атаки Одержимостью. Этот Талант можно
 * брать до ½W.b (окр.▼) раз». Каждое взятие — −1. Предел ½W.b — ограничение
 * ПОКУПКИ, а не ослабление эффекта: упал W.b после урона в Волю — уже взятые
 * копии продолжают действовать, поэтому здесь считаются все взятия.
 *
 * Автоматически применяется только там, где система сама начисляет Порчу:
 * Варп-Шок манифестации (sheets/tabs/psychic.mjs). Порча из таблиц Феноменов и
 * Прорывов, Отвращения Варпа и Атаки Одержимостью — текст таблиц, их считает стол.
 *
 * @returns {number} на сколько уменьшить каждое начисление Порчи от этих источников
 */
export function gazeIntoAbyssReduction(actor) {
  const copies = [...(actor?.items ?? [])]
    .filter(i => i?.type === "talent" && (itemHasName(i, "Gaze Into Abyss") || itemHasName(i, "Взгляд в Бездну")))
    .length;
  return copies;
}
