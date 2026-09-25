// module/rules/char-loss.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Урон в Характеристики (книга, «Раны и Урон → Урон в Характеристики»,
//  wdbc-x1nz.2.83; решения владельца 24.09.2026):
//
//  «Урон в Характеристики уменьшает их текущее значение (и потенциально также
//  бонус), но не максимальное значение. Этот урон не может быть Поглощён.
//  Характеристика не может опускаться ниже 0, при достижении которого на
//  персонажа накладываются эффекты нулевой Характеристики… Урон в
//  Характеристики восстанавливается пассивно по 1 в час, хотя от некоторых
//  источников восстанавливается медленнее или вовсе не может быть восстановлен
//  до выполнения некоего условия (указано в самом эффекте).»
//
//  Хранение — system.charLoss.<х-ка> (≥ 0, отдельно от ручного «Мод.»
//  system.charDamage, который остаётся баффом/дебаффом стола) и
//  system.charLossAt.<х-ка> — момент следующего восстановления (worldTime).
//  Итог считает rules/character.mjs (вычитает, пол 0), часы —
//  combat/condition-clock.mjs, писать урон — combat/char-damage.mjs.
//
//  Медленнее / никак (Гангрена, Лучевая болезнь, Гниль Нургла, зависимости) —
//  данными: запись правила `{ kind: "charRecovery", target: "t" | "t,s" |
//  "all", mode: "block" | "period", hours }` (rules/library/conditions.mjs,
//  Конструктор). Несколько записей: любой block — блок; иначе самый длинный
//  период.
// ════════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { collectRules } from "./collect.mjs";

export const CHAR_LOSS_KEYS = Object.keys(CHARACTERISTICS);

export const SECONDS_PER_HOUR = 3600;

/** Пассивное восстановление по книге — 1 в час. */
export const DEFAULT_RECOVERY_HOURS = 1;

/**
 * Эффекты нулевой Характеристики (таблица книги). Состояния-следствия
 * ставятся производно в rules/character.mjs; T — смерть в момент урона
 * (combat/char-damage.mjs). Влияние (inf) в таблице нет.
 */
export const ZERO_EFFECTS = {
  ws:  { label: "Не может совершать рукопашные атаки" },
  bs:  { label: "Не может стрелять" },
  s:   { label: "Теряет сознание", conditions: ["unconscious"] },
  t:   { label: "Умирает" },
  ag:  { label: "Парализован и Беспомощен", conditions: ["paralyzed", "helpless"] },
  int: { label: "Впадает в кому", conditions: ["coma"] },
  per: { label: "Лишён всех чувств", conditions: ["blinded", "deafened"] },
  wp:  { label: "Впадает в наполненный кошмарами сон", conditions: ["unconscious"] },
  fel: { label: "Теряет способность общаться", conditions: ["mute"] }
};

const num = v => Math.max(0, Number(v) || 0);

/**
 * Обнулена ли Характеристика УРОНОМ: Итог ≤ 0 и есть урон. Без урона ноль —
 * это незаполненный лист (новый актор, шаблон), а не эффект книги.
 */
export function isZeroedByLoss(system, key) {
  return charLossTotal(system, key) > 0 && (Number(system?.characteristics?.[key]?.total) || 0) <= 0;
}

/** Ключи обнулённых уроном Характеристик. */
export function zeroedKeys(system) {
  return Object.keys(ZERO_EFFECTS).filter(k => isZeroedByLoss(system, k));
}

/**
 * Патч «получить урон в Характеристику». Лишний урон ниже 0 не пишется —
 * «Характеристика не может опускаться ниже 0» (иначе восстановление шло бы
 * часами «сквозь ноль»). Отсчёт часа начинается с первого урона: уже идущий
 * не сбрасывается.
 *
 * @param {object} system  actor.system (нужен Итог characteristics.<key>.total)
 * @returns {{patch: object, applied: number, before: number, after: number}}
 */
export function charLossAddFields(system, key, amount, worldTime = 0) {
  const total = Number(system?.characteristics?.[key]?.total) || 0;
  const applied = Math.min(num(amount), Math.max(0, total));
  const cur = num(system?.charLoss?.[key]);
  const at = Number(system?.charLossAt?.[key]) || 0;
  const patch = {};
  if (applied > 0) {
    patch[`system.charLoss.${key}`] = cur + applied;
    if (!at) patch[`system.charLossAt.${key}`] = Number(worldTime) + DEFAULT_RECOVERY_HOURS * SECONDS_PER_HOUR;
  }
  return { patch, applied, before: total, after: total - applied };
}

/**
 * Патч «восстановить n урона в Характеристику» (лечение, эликсиры, Таланты).
 * @returns {{patch: object, healed: number}}
 */
export function charLossHealFields(system, key, n) {
  const cur = num(system?.charLoss?.[key]);
  const healed = Math.min(cur, num(n));
  if (!healed) return { patch: {}, healed: 0 };
  const left = cur - healed;
  const patch = { [`system.charLoss.${key}`]: left };
  if (!left) patch[`system.charLossAt.${key}`] = 0;
  return { patch, healed };
}

/**
 * Лечение урона в Характеристику для Талантов/способностей «восстанавливает
 * урон в Характеристики»: сперва урон по книге (charLoss), остаток — старый
 * урон, записанный до wdbc-x1nz.2.83 минусом в ручной «Мод.» (до 0, в бафф
 * не превращается).
 * @returns {{patch: object, healed: number}}
 */
export function charHealFields(system, key, n, { magic = false } = {}) {
  const { patch, healed } = charLossHealFields(system, key, n);
  let rest = num(n) - healed;
  // Затем порции со своим темпом (кроме перманентных и «не лечится
  // сверхъестественным» при magic) — task 1-8.
  const portions = charLossPortionsHeal(system, key, rest, { magic });
  if (portions.healed) { patch["system.charLossPortions"] = portions.list; rest -= portions.healed; }
  const legacy = Number(system?.charDamage?.[key]) || 0;
  let total = healed + portions.healed;
  if (rest > 0 && legacy < 0) {
    const fix = Math.min(rest, -legacy);
    patch[`system.charDamage.${key}`] = legacy + fix;
    total += fix;
  }
  return { patch, healed: total };
}

/** Сколько урона сейчас на Характеристике: по книге + старый минус в «Мод.». */
export function charDamageOutstanding(system, key) {
  return charLossTotal(system, key) + Math.max(0, -(Number(system?.charDamage?.[key]) || 0));
}

/** Какие Характеристики задевает запись: "t", "t,s", "all". */
export function recoveryTargets(target) {
  const t = String(target ?? "").trim();
  if (!t || t === "all") return CHAR_LOSS_KEYS;
  return t.split(/[\s,]+/).filter(k => CHAR_LOSS_KEYS.includes(k));
}

/**
 * Политика восстановления по записям charRecovery: { <key>: { blocked,
 * hours } }. Чистая: принимает уже собранные записи.
 */
export function recoveryPolicy(effects = []) {
  const out = Object.fromEntries(CHAR_LOSS_KEYS.map(k => [k, { blocked: false, hours: DEFAULT_RECOVERY_HOURS, sources: [] }]));
  for (const e of effects) {
    if (e?.kind !== "charRecovery") continue;
    for (const k of recoveryTargets(e.target)) {
      const p = out[k];
      if (e.label) p.sources.push(e.label);
      if (e.mode === "period") p.hours = Math.max(p.hours, Number(e.hours) || DEFAULT_RECOVERY_HOURS);
      else p.blocked = true;
    }
  }
  return out;
}

/** Записи charRecovery актора из всех правил (Состояния, Конструктор предметов). */
export function actorRecoveryPolicy(actor) {
  const effects = [];
  for (const rule of collectRules(actor)) {
    for (const e of rule?.effects ?? []) {
      if (e?.kind === "charRecovery") effects.push({ ...e, label: rule.label || rule.id });
    }
  }
  return recoveryPolicy(effects);
}

/**
 * Шаг часов восстановления до `to`: по 1 за каждый истёкший период каждой
 * Характеристики. Заблокированная не восстанавливается, а её отсчёт
 * переносится на `to` + период — после снятия блока ждать полный час, а не
 * вылечить разом всё накопленное.
 *
 * @returns {{patch: object, healed: Record<string, number>}}
 */
export function charLossClockStep(system, policy, to) {
  const patch = {};
  const healed = {};
  for (const key of CHAR_LOSS_KEYS) {
    let loss = num(system?.charLoss?.[key]);
    let at = Number(system?.charLossAt?.[key]) || 0;
    if (!loss) { if (at) patch[`system.charLossAt.${key}`] = 0; continue; }
    const p = policy?.[key] ?? { blocked: false, hours: DEFAULT_RECOVERY_HOURS };
    const period = Math.max(1, p.hours) * SECONDS_PER_HOUR;
    if (!at) at = to + period;
    if (p.blocked) {
      if (at <= to) patch[`system.charLossAt.${key}`] = to + period;
      else if (at !== Number(system?.charLossAt?.[key])) patch[`system.charLossAt.${key}`] = at;
      continue;
    }
    const before = loss;
    while (loss > 0 && at <= to) { loss -= 1; at += period; }
    if (loss !== before) {
      healed[key] = before - loss;
      patch[`system.charLoss.${key}`] = loss;
    }
    const nextAt = loss ? at : 0;
    if (nextAt !== (Number(system?.charLossAt?.[key]) || 0)) patch[`system.charLossAt.${key}`] = nextAt;
  }
  return { patch, healed };
}

// ── Порции урона со своим темпом (task 1-8, решение Сергея 25.09.2026) ──────
//
// Книга местами задаёт темп у САМОГО урона: Импровизированная Руна
// Сигиллита — «восстанавливает 1 за 8 часов, не лечится психосилами/судьбой/
// медитацией», пытки — «не может восстанавливать урон в W, пока не пройдут
// сутки», крит — «1 перманентного урона в I». Такой урон — отдельной порцией
// в system.charLossPortions: сколько, куда, свой период (hours, 0 — не
// восстанавливается вовсе), «не раньше» (until, worldTime), источник и
// «не лечится сверхъестественным» (noMagic). Обычный урон остаётся одним
// числом charLoss. Итог Характеристики вычитает оба (charLossTotal).

/** Порции урона актора (пустой список, если поля нет). */
export function charLossPortions(system) {
  return Array.isArray(system?.charLossPortions) ? system.charLossPortions : [];
}

/** Весь урон на Характеристике: обычный + порции. */
export function charLossTotal(system, key) {
  return num(system?.charLoss?.[key])
    + charLossPortions(system).filter(p => p?.key === key).reduce((s, p) => s + num(p.amount), 0);
}

/** Весь урон по всем Характеристикам: { key: число } — для расчёта листа. */
export function charLossTotals(system) {
  return Object.fromEntries(CHAR_LOSS_KEYS.map(k => [k, charLossTotal(system, k)]));
}

/** Порция не восстанавливается никогда (перманентный урон). */
export function isPermanentPortion(p) {
  return !(Number(p?.hours) > 0);
}

/**
 * Патч «получить урон порциями». entries — [{ key, amount, hours, until,
 * source, noMagic }]; пол 0 по каждой Характеристике — как у обычного урона,
 * с учётом того, что уже снято этим же вызовом.
 * @returns {{patch: object, applied: Record<string, number>}}
 */
export function charLossPortionsAddFields(system, entries = [], worldTime = 0) {
  const list = [...charLossPortions(system)];
  const applied = {};
  for (const e of entries) {
    if (!CHAR_LOSS_KEYS.includes(e?.key)) continue;
    const total = (Number(system?.characteristics?.[e.key]?.total) || 0) - (applied[e.key] || 0);
    const a = Math.min(num(e.amount), Math.max(0, total));
    if (!a) continue;
    applied[e.key] = (applied[e.key] || 0) + a;
    const hours = Math.max(0, Number(e.hours) || 0);
    const until = Math.max(0, Number(e.until) || 0);
    list.push({
      key: e.key, amount: a, hours, until,
      at: hours > 0 ? Math.max(Number(worldTime) + hours * SECONDS_PER_HOUR, until) : 0,
      source: String(e.source || ""), noMagic: !!e.noMagic
    });
  }
  return { patch: Object.keys(applied).length ? { "system.charLossPortions": list } : {}, applied };
}

/**
 * Шаг часов порций до `to`: каждая отходит по 1 за свой период, не раньше
 * своего until. Блок политики актора (Гниль Нургла и т.п.) держит и порции;
 * период политики длиннее своего — берётся длиннейший. Перманентные — никогда.
 * @returns {?object[]} новый список или null, если ничего не изменилось
 */
export function charLossPortionsStep(system, policy, to) {
  const list = charLossPortions(system);
  if (!list.length) return null;
  let changed = false;
  const out = [];
  for (const p of list) {
    if (isPermanentPortion(p)) { out.push(p); continue; }
    const pol = policy?.[p.key] ?? { blocked: false, hours: DEFAULT_RECOVERY_HOURS };
    if (pol.blocked) { out.push(p); continue; }
    const period = Math.max(Number(p.hours), pol.hours || 0) * SECONDS_PER_HOUR;
    let amount = num(p.amount);
    let at = Math.max(Number(p.at) || 0, Number(p.until) || 0);
    while (amount > 0 && at <= to) { amount -= 1; at += period; }
    if (amount !== num(p.amount) || at !== Number(p.at)) changed = true;
    if (amount > 0) out.push({ ...p, amount, at });
  }
  return changed ? out : null;
}

/**
 * Лечение урона порциями после обычного: n единиц, сперва старые порции.
 * Перманентные не лечатся; noMagic — только не сверхъестественным путём
 * (magic:true — психосилы, Судьба, медитация).
 * @returns {{list: object[], healed: number}}
 */
export function charLossPortionsHeal(system, key, n, { magic = false } = {}) {
  let left = num(n);
  let healed = 0;
  const list = [];
  for (const p of charLossPortions(system)) {
    if (left > 0 && p.key === key && !isPermanentPortion(p) && !(magic && p.noMagic)) {
      const take = Math.min(left, num(p.amount));
      left -= take; healed += take;
      if (num(p.amount) - take > 0) list.push({ ...p, amount: num(p.amount) - take });
      continue;
    }
    list.push(p);
  }
  return { list, healed };
}

/**
 * Лечение n урона в КАЖДУЮ Характеристику одним патчем (пытки, Пожиратель
 * Боли). Порции — один список на актора, поэтому каждая следующая
 * Характеристика лечится уже от списка после предыдущей, а не от исходного:
 * иначе в патче выжило бы только последнее лечение порций.
 * @returns {object} patch
 */
export function charHealAllFields(system, n, { magic = false } = {}) {
  const patch = {};
  let shadow = system;
  for (const key of CHAR_LOSS_KEYS) {
    if (!system?.characteristics?.[key]) continue;
    const r = charHealFields(shadow, key, n, { magic });
    Object.assign(patch, r.patch);
    if (r.patch["system.charLossPortions"]) shadow = { ...shadow, charLossPortions: r.patch["system.charLossPortions"] };
  }
  return patch;
}
