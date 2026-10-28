// module/rules/technomystic-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Таланты Техномистика главы 3, считающие Когницию и Славословия (Sahara
//  3-2501): Проблеск Всеведенья, Омнимнезис (переброс за 1 ⚙), Декомпиляция,
//  Разгон, Рекомпиляция, Вотивная Месса, Цифровое Откровение, Ноосферная
//  Набожность.
//
//  Чистый модуль без Foundry; вызывает его sheets/tabs/tech.mjs. Не
//  импортируется из sources.mjs (как rules/digital-hatred.mjs). Таланты
//  опознаются по имени (долг wdbc-iadw), имя — литералом в каждом вызове
//  itemHasName: так их находит tools/capability-reachability.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

const talentsWhere = (actor, pred) =>
  [...(actor?.items ?? [])].filter(i => i?.type === "talent" && pred(i));

const isGlimpse    = i => itemHasName(i, "Glimpse of Omniscience") || itemHasName(i, "Проблеск Всеведенья");
const isOmnimnesis = i => itemHasName(i, "Omnimnesis") || itemHasName(i, "Омнимнезис");
const isDecompile  = i => itemHasName(i, "Decompile") || itemHasName(i, "Декомпиляция");
const isOverclock  = i => itemHasName(i, "Overclock") || itemHasName(i, "Разгон");
const isRecompile  = i => itemHasName(i, "Recompile") || itemHasName(i, "Рекомпиляция");
const isVotiveMass = i => itemHasName(i, "Votive Mass") || itemHasName(i, "Вотивная Месса");
const isRevelation = i => itemHasName(i, "Digital Revelation") || itemHasName(i, "Цифровое Откровение");
const isPiety      = i => itemHasName(i, "Noospheric Piety") || itemHasName(i, "Ноосферная Набожность");

export const hasGlimpseOfOmniscience = actor => talentsWhere(actor, isGlimpse).length > 0;
export const hasOmnimnesis = actor => talentsWhere(actor, isOmnimnesis).length > 0;
export const hasDecompile = actor => talentsWhere(actor, isDecompile).length > 0;
export const hasOverclock = actor => talentsWhere(actor, isOverclock).length > 0;
export const hasRecompile = actor => talentsWhere(actor, isRecompile).length > 0;
export const hasVotiveMass = actor => talentsWhere(actor, isVotiveMass).length > 0;

/** Переброс Проблеска Всеведенья / Омнимнезиса и Декомпиляция стоят по 1 ⚙. */
export const COGNITION_REROLL_COST = 1;
export const DECOMPILE_COST = 1;
export const RECOMPILE_COST = 1;

/** Разгон: «потратить 1 ⚡, чтобы восстановить себе до I.b ⚙, но за каждую … 2 урона в I». */
export const OVERCLOCK_ENERGY_COST = 1;
export const OVERCLOCK_SELF_DAMAGE_PER_COG = 2;
/** Метка «Разгон уже был в этом Ходу» (rules/turn-flags.mjs). */
export const OVERCLOCK_FLAG = "overclockThisTurn";

/**
 * Метка «цена Процессов в этот Ход уже списана» (rules/turn-flags.mjs): кнопка
 * «↻» (начало Хода) списывает её сама, один раз за Ход (решение владельца
 * 25.10.2026, Digital Revelation / Noospheric Piety).
 */
export const PROCESS_PAID_FLAG = "processCostPaidThisTurn";

/**
 * Списание цены Процессов с пула Когниции. Книга: «если не хватает ⚙ для
 * поддержания всех Процессов, персонаж должен отключить лишние» — какие именно,
 * решает игрок, поэтому система списывает всё, что есть, и называет остаток.
 *
 * @param {number} cognition  ⚙ в пуле после восстановления
 * @param {number} total      суммарная цена Процессов (processCostTotal().total)
 * @returns {{pay:number, after:number, shortfall:number}}
 */
export function settleProcessCost(cognition, total) {
  const have = Math.max(0, Number(cognition) || 0);
  const need = Math.max(0, Number(total) || 0);
  const pay = Math.min(have, need);
  return { pay, after: have - pay, shortfall: need - pay };
}

/**
 * Сколько ⚙ можно вернуть Разгоном сейчас: до I.b, не выше свободного места в
 * пуле Когниции. 0 — Разгон невозможен (нет ⚡, нет места, I.b = 0).
 */
export function overclockMax(actor) {
  const ib = Math.max(0, Number(actor?.system?.characteristics?.int?.bonus) || 0);
  const cog = actor?.system?.cognition ?? {};
  const room = Math.max(0, (Number(cog.max) || 0) - (Number(cog.value) || 0));
  const energy = Number(actor?.system?.energy?.value) || 0;
  if (energy < OVERCLOCK_ENERGY_COST) return 0;
  return Math.min(ib, room);
}

/** Вотивная Месса: компиляция Славословия за <Рейтинг>×4 ⚙ вместо <Рейтинг>×5 минут. */
export const votiveMassCost = rating => 4 * Math.max(1, Math.trunc(Number(rating) || 1));

/** Рейтинг (X) Славословия: основной тип предмета либо extraType. */
export function slavoRating(power) {
  const s = power?.system ?? {};
  if (s.miracleType === "slavoslovie") return Math.max(1, Number(s.rating) || 1);
  const extra = (s.extraTypes ?? []).find(e => e?.type === "slavoslovie");
  return extra ? Math.max(1, Number(extra.x) || 1) : 0;
}

export const isSlavoslovie = power => slavoRating(power) > 0;

/**
 * Рекомпиляция: «заменить одно скомпилированное Славословие другим равного или
 * меньшего рейтинга». Какие скомпилированные можно заменить новым: рейтинг
 * нового не выше рейтинга заменяемого.
 *
 * @param {object[]} items предметы-Техночудеса актора
 * @param {object} target Славословие, которое хотят скомпилировать
 */
export function recompileSources(items, target) {
  const want = slavoRating(target);
  if (!want) return [];
  return (items ?? []).filter(p => p?.type === "techPower" && p !== target && p.id !== target?.id
    && isSlavoslovie(p) && p.system?.compiled && slavoRating(p) >= want);
}

// ── Цена Процессов ───────────────────────────────────────────────────────────

/**
 * Цена Процесса одного Техночуда в ⚙ за Ход. Скомпилированное Славословие
 * «считается как Процесс с Ценой ½X»; держимое Техночудо — своя цена
 * поддержания. Половины НЕ округляются здесь: книга округляет вверх СУММАРНУЮ
 * цену («если суммарная цена не целое число, она округляется вверх»), поэтому
 * два Славословия X=1 вместе стоят 1 ⚙, а не 2 (processCostTotal).
 */
export function processCostOf(power) {
  const s = power?.system ?? {};
  if (isSlavoslovie(power) && s.compiled && !s.sustained) return slavoRating(power) / 2;
  if (s.sustained) return Math.max(0, Number(s.sustainCost) || 0);
  return 0;
}

/**
 * Сколько ⚙ снимают Цифровое Откровение («суммарная цена всех Процессов −1»,
 * до 3 раз) и Ноосферная Набожность («суммарная стоимость Процессов
 * скомпилированных Славословий −1», до 3 раз; уже активированных не касается).
 */
export function processDiscounts(actor) {
  const revelation = Math.min(3, talentsWhere(actor, isRevelation).length);
  const piety = Math.min(3, talentsWhere(actor, isPiety).length);
  return { revelation, piety };
}

/**
 * Суммарная цена Процессов в Ход (книга: «если суммарная цена не целое число,
 * она округляется вверх»).
 *
 * @returns {{base:number, compiledBase:number, revelation:number, piety:number, total:number}}
 *   base — без Талантов; revelation/piety — сколько реально снято каждым; total
 *   не опускается ниже 0.
 */
export function processCostTotal(actor) {
  const powers = [...(actor?.items ?? [])].filter(i => i?.type === "techPower");
  let sustainedBase = 0, compiledBase = 0;
  for (const p of powers) {
    const cost = processCostOf(p);
    if (p.system?.sustained) sustainedBase += cost; else compiledBase += cost;
  }
  const base = sustainedBase + compiledBase;
  const want = processDiscounts(actor);
  // Набожность — только из цены скомпилированных Славословий и не глубже неё.
  const piety = Math.min(want.piety, compiledBase);
  // Откровение — из общей суммы, после Набожности.
  const revelation = Math.min(want.revelation, Math.max(0, base - piety));
  // Округление вверх — один раз, на сумме (половины складываются дробно).
  return { base: Math.ceil(base), compiledBase, revelation, piety,
           total: Math.max(0, Math.ceil(base - piety - revelation)) };
}
