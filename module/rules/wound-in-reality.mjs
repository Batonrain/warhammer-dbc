// module/rules/wound-in-reality.mjs
// ════════════════════════════════════════════════════════════════════════════
//  РАНА В РЕАЛЬНОСТИ / Wound In Reality (Талант Псайканы, Sahara 3-28, пачка I2,
//  решение владельца 26.10.2026: «галочка «бесплатная» + авто-аура на токены»).
//
//  Книга: «Когда он тратит как минимум 3 PR на поддержание психосил, персонаж
//  может выбрать не тратить тPR на поддержание новых манифестаций, ограничиваясь
//  изначальными тремя. Псайкер может поддерживать не более Cor.b «бесплатных»
//  психосил за счет раны в реальности. За каждую «бесплатно» поддерживаемую
//  психосилу все в Cor.b×2м от псайкера (включая его самого) получают –5 на тесты
//  Пси-чутья, +10 на Феномены, и +10 на тесты Варп-Нестабильности. За каждые 3
//  «бесплатные» психосилы, Истончение Завесы в этой ауре увеличивается на 1.»
//
//  Как собрано:
//   • галочка — флаг `woundFree` на самой психосиле (flags.warhammer-dbc);
//   • сумма поддержания в rules/character.mjs не считает бесплатные силы — тPR
//     от них не падает (woundSustainSplit);
//   • сама зона — штатный движок аур (regions/auras.mjs): Талант несёт запись
//     kind:"aura" с радиусом «ceil(wound/(wound+1))*cor*2» (ключ «wound» —
//     число бесплатных сил, apps/mechanics.mjs читает его через mechRollData),
//     каждому токену в радиусе клонируется служебная Черта-метка «Аура Раны в
//     Реальности» с флагом auraSource (= uuid Таланта) и снимается при выходе;
//   • числа за каждую силу считаются ЖИВЬЁМ по метке (woundAuraRules и т.д.):
//     метка помнит только источник, сколько в нём сейчас бесплатных сил — спрашивается
//     в момент броска, поэтому смена числа сил не требует пересоздавать метки.
//
//  Чистый модуль без Foundry (читает только duck-typed актора/предметы): его
//  импортирует sources.mjs — зависеть от флагов/сборки правил нельзя (AGENTS.md,
//  wdbc-795h). Единственное исключение из «чистоты» — resolveSource по умолчанию
//  пробует глобальный fromUuidSync; тесты и вызывающий код передают свой.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

const NS = "warhammer-dbc";

/** Флаг психосилы: поддерживается «бесплатно» за счёт раны в реальности. */
export const WOUND_FREE_FLAG = "woundFree";
/** «Когда он тратит как минимум 3 PR на поддержание психосил…» */
export const WOUND_MIN_PAID_SUSTAIN = 3;
/** Числа ауры за каждую бесплатную силу (книга). */
export const WOUND_AURA_PSYNISCIENCE = -5;
export const WOUND_AURA_PHENOMENA = 10;
export const WOUND_AURA_INSTABILITY = 10;
/** «За каждые 3 бесплатные психосилы Истончение Завесы в ауре +1». */
export const WOUND_VEIL_PER = 3;
/** Служебная Черта-метка, которую аура клонирует на токены в радиусе (packs-src/traits). */
export const WOUND_AURA_NAME = "Wound in Reality Aura / Аура Раны в Реальности";

const isWoundTalent = i => itemHasName(i, "Wound In Reality") || itemHasName(i, "Рана в Реальности");
const talentsOf = actor => [...(actor?.items ?? [])].filter(i => i?.type === "talent" && isWoundTalent(i));

export function hasWoundInReality(actor) { return talentsOf(actor).length > 0; }

/** Сами предметы-Таланты (аура и флаг радиуса живут на них). */
export const woundInRealityTalents = talentsOf;

/** «Не более Cor.b бесплатных психосил». */
export function woundFreeLimit(actor) {
  return hasWoundInReality(actor) ? Math.max(0, Math.trunc(Number(actor?.system?.corruptionBonus) || 0)) : 0;
}

const flagOf = (doc, key) => doc?.getFlag?.(NS, key) ?? doc?.flags?.[NS]?.[key];
const isFlagged = p => !!flagOf(p, WOUND_FREE_FLAG);
const costOf = p => Math.max(0, Number(p?.system?.sustainCost ?? 1) || 0);
const sustainedPowers = actor => [...(actor?.items ?? [])]
  .filter(i => i?.type === "psychicPower" && i.system?.isSustained);

/**
 * Разбор поддержания: что платится из тPR, что бесплатно.
 * Пометка работает, пока платных сил (не помеченных) поддерживается хотя бы на 3 PR; помеченных
 * действует не больше Cor.b (в порядке предметов), остальные платные.
 * @returns {{paid:number, free:number, freeCount:number, freeIds:string[], gateOk:boolean}}
 *   paid/free — суммы цен поддержания; freeCount — число бесплатных сил
 */
export function woundSustainSplit(actor) {
  const all = sustainedPowers(actor);
  const total = all.reduce((n, p) => n + costOf(p), 0);
  if (!hasWoundInReality(actor)) return { paid: total, free: 0, freeCount: 0, freeIds: [], gateOk: false };
  const plain = all.filter(p => !isFlagged(p));
  const flagged = all.filter(isFlagged);
  const limit = woundFreeLimit(actor);
  // Помеченные сверх Cor.b (Порча упала) платны, как обычные, — они и входят в порог «3 PR».
  const overflowCost = flagged.slice(limit).reduce((n, p) => n + costOf(p), 0);
  const plainCost = plain.reduce((n, p) => n + costOf(p), 0) + overflowCost;
  const gateOk = plainCost >= WOUND_MIN_PAID_SUSTAIN;
  if (!gateOk) return { paid: total, free: 0, freeCount: 0, freeIds: [], gateOk };
  const freePowers = flagged.slice(0, limit);
  const free = freePowers.reduce((n, p) => n + costOf(p), 0);
  return { paid: total - free, free, freeCount: freePowers.length, freeIds: freePowers.map(p => p.id), gateOk };
}

/** Сколько психосил сейчас действительно бесплатны — от этого числа растёт аура. */
export function woundFreeCount(actor) { return woundSustainSplit(actor).freeCount; }

const TOGGLE_WHY = {
  "no-talent": "Рана в Реальности: нет Таланта.",
  "not-sustained": "Рана в Реальности: бесплатно можно держать только поддерживаемую силу.",
  already: "Рана в Реальности: эта сила уже бесплатная.",
  paid: `Рана в Реальности: бесплатной сила становится, когда на платное поддержание уходит хотя бы ${WOUND_MIN_PAID_SUSTAIN} PR (первые три — «изначальные»).`,
  limit: "Рана в Реальности: бесплатных сил уже Cor.b — больше нельзя."
};

/**
 * Можно ли поставить/снять галочку «бесплатная».
 * @param {{off?:boolean, assumeSustained?:boolean}} opts off — снять; assumeSustained — окно манифестации (сила ещё не отмечена поддерживаемой)
 */
export function woundFreeToggleGate(actor, power, { off = false, assumeSustained = false } = {}) {
  const refuse = code => ({ ok: false, code, reason: TOGGLE_WHY[code] });
  if (off) return { ok: true, code: "off", reason: "" };
  if (!hasWoundInReality(actor)) return refuse("no-talent");
  if (!assumeSustained && !power?.system?.isSustained) return refuse("not-sustained");
  if (isFlagged(power)) return refuse("already");
  const others = sustainedPowers(actor).filter(p => p !== power && !(p.id && p.id === power?.id));
  const paidOthers = others.filter(p => !isFlagged(p)).reduce((n, p) => n + costOf(p), 0);
  if (paidOthers < WOUND_MIN_PAID_SUSTAIN) return refuse("paid");
  if (others.filter(isFlagged).length >= woundFreeLimit(actor)) return refuse("limit");
  return { ok: true, code: "on", reason: "" };
}

// ── Аура ────────────────────────────────────────────────────────────────────

/** Числа ауры от n бесплатных сил одного псайкера. */
export function woundAuraTotals(n) {
  const k = Math.max(0, Math.trunc(Number(n) || 0));
  return {
    n: k,
    psyniscience: k ? WOUND_AURA_PSYNISCIENCE * k : 0,
    phenomena: k ? WOUND_AURA_PHENOMENA * k : 0,
    instability: k ? WOUND_AURA_INSTABILITY * k : 0,
    veil: Math.floor(k / WOUND_VEIL_PER)
  };
}

/** Метка-Черта, выданная аурой (клон служебной Черты из packs-src/traits). */
export function isWoundAuraMarker(item) {
  return item?.type === "trait"
    && (itemHasName(item, "Wound in Reality Aura") || itemHasName(item, "Аура Раны в Реальности"));
}

/** Источник метки по uuid: в игре — fromUuidSync (мировой актор и дельта токена резолвятся синхронно). */
function defaultResolve(uuid) {
  try { return globalThis.fromUuidSync?.(uuid) ?? null; } catch { return null; }
}

/**
 * Сколько бесплатных сил у источника каждой метки на акторе.
 * Источник не нашёлся (удалён/чужая сцена) — метка считается за одну силу: аура, выданная
 * подметателем, существует только пока он её видит; молча обнулять живую метку нельзя.
 * @returns {number[]} по числу меток
 */
function auraCounts(actor, resolve = defaultResolve) {
  const out = [];
  for (const item of actor?.items ?? []) {
    if (!isWoundAuraMarker(item)) continue;
    const src = flagOf(item, "auraSource");
    const talent = src ? resolve(src) : null;
    const owner = talent?.parent ?? talent?.actor ?? null;
    out.push(owner ? woundFreeCount(owner) : 1);
  }
  return out;
}

/** Суммарные числа аур, накрывающих актора. */
export function woundAuraAggregate(actor, resolve = defaultResolve) {
  const sum = { n: 0, psyniscience: 0, phenomena: 0, instability: 0, veil: 0 };
  for (const n of auraCounts(actor, resolve)) {
    const t = woundAuraTotals(n);
    for (const k of Object.keys(sum)) sum[k] += t[k];
  }
  return sum;
}

/** Модификатор к броску Феномена от аур, накрывающих актора (+10 за каждую силу). */
export function woundAuraPhenMod(actor, resolve = defaultResolve) { return woundAuraAggregate(actor, resolve).phenomena; }

/** Прибавка Истончения Завесы в ауре (Завеса сцены — отдельно; считается для тех, кто спрашивает Завесу у токена). */
export function woundAuraVeil(actor, resolve = defaultResolve) { return woundAuraAggregate(actor, resolve).veil; }

/**
 * Правила для конвейера бросков (источник «woundAura», sources.mjs): −5 Пси-чутьё и +10 Варп-Нестабильность
 * за каждую бесплатную силу. Феномены — не тест, а число в броске Феномена (woundAuraPhenMod).
 */
export function woundAuraRules(actor, resolve = defaultResolve) {
  const t = woundAuraAggregate(actor, resolve);
  const effects = [];
  const label = "Рана в Реальности (аура)";
  if (t.psyniscience) effects.push({ kind: "rollBonus", target: "skill:psyniscience", value: t.psyniscience, label: `${label}: Пси-чутьё`, auto: true });
  if (t.instability) effects.push({ kind: "rollBonus", target: "instability", value: t.instability, label: `${label}: Варп-Нестабильность`, auto: true });
  if (!effects.length) return [];
  return [{ id: "woundInReality.aura", label, when: {}, effects }];
}
