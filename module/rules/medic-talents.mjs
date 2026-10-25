// module/rules/medic-talents.mjs
//
// Таланты Медика главы 3 (корбук, «Медик»): чистая арифметика без Foundry.
// Диалог Лечения (sheets/tabs/healing.mjs) и «Реанимировать» (combat/reanimate.mjs)
// только спрашивают отсюда числа, поэтому всё проверяется тестом на литералах.
//
// Файл НЕ импортирует ничего — его читает healing.mjs, а тот живёт в листе;
// чистота — гарантия, что цикл импортов (source-registry-acyclic) не замкнётся.

export const FIELD_SURGEON_CAP     = "medic.core.fieldSurgeon";
export const RADICAL_TREATMENT_CAP = "medic.core.radicalTreatment";
export const FAST_STITCHES_CAP     = "medic.core.fastStitches";
export const RESTITCHING_CAP       = "medic.core.restitching";
export const COUNCILIUM_CAP        = "medic.core.councilium";
export const REANIMATE_CAP         = "medic.core.reanimate";
export const POISONER_CAP          = "medic.core.poisoner";
export const SURGICAL_PRECISION_CAP = "medic.core.surgicalPrecision";
export const HOOK_UP_CAP           = "medic.core.hookUp";
export const TORTURER_CAP          = "medic.core.torturer";

// ── Полевой Хирург ──────────────────────────────────────────────────────────

/**
 * Режимы Лечения, которые «обычно требуют полноценной госпитализации»:
 * операции — Пришивание конечности, Бионика, Хирургия Гангрены. Решение
 * владельца 24.10.2026 (3-dc87): другие тесты Medicae стационара не требуют.
 * Требование стационара введено и для Пришивания с Бионикой (решение владельца
 * 24.10.2026, вечер): раньше его проверяла только Гангрена, и Талант «Полевой
 * Хирург» на двух других режимах ничего не менял. Книга для них прямо «хотя бы
 * операционную» не называет (только «сложная операция»), но Апотекарион описан
 * как «необходим для проведения операций» — решение владельца читает так.
 */
export const HOSPITAL_MODES = ["reattach", "bionic", "gangreneSurgery"];

/** Штраф «в поле» по книге (Полевой Хирург). */
export const FIELD_SURGEON_PENALTY = -20;

/**
 * Что делать с операцией, если стационара (операционной) нет.
 *  - режим не операционный → ничего не меняется;
 *  - стационар есть → штрафа нет;
 *  - стационара нет, Полевой Хирург есть → операция разрешена со штрафом −20;
 *  - стационара нет, Таланта нет → `blocked` (Пришивание, Бионика, Гангрена).
 * @returns {{penalty:number, blocked:boolean, inField:boolean}}
 */
export function fieldSurgery({ mode, theatre = false, hasTalent = false } = {}) {
  if (!HOSPITAL_MODES.includes(mode) || theatre) return { penalty: 0, blocked: false, inField: false };
  if (hasTalent) return { penalty: FIELD_SURGEON_PENALTY, blocked: false, inField: true };
  return { penalty: 0, blocked: true, inField: false };
}

// ── Радикальное Лечение ─────────────────────────────────────────────────────

/** Уровни выпадающего списка: штраф −10/−20/−30 → +1/+2/+3 Раны при Успехе. */
export const RADICAL_LEVELS = [0, 1, 2, 3];

/**
 * @param {number|string} level 0..3 (всё прочее считается нулём)
 * @returns {{level:number, mod:number, bonus:number}}
 */
export function radicalTreatment(level) {
  const n = Math.trunc(Number(level));
  const lv = RADICAL_LEVELS.includes(n) ? n : 0;
  return { level: lv, mod: -10 * lv, bonus: lv };
}

// ── Быстрые Стежки ──────────────────────────────────────────────────────────

/** I.b «вдвое ниже (окр.▲)» для эффективности Первой Помощи. */
export function fastStitchesIb(ib) {
  return Math.ceil((Number(ib) || 0) / 2);
}

// ── Перешивание ─────────────────────────────────────────────────────────────

/**
 * Можно ли повторить Первую Помощь: предыдущая провалена и прошло не более
 * I.b минут (мировое время, секунды). Кто лечил в прошлый раз — неважно
 * («в т.ч. если её проводил другой»), метка живёт на пациенте.
 * Метка времени/результата пишется каждой Первой Помощью (wounds.firstAidAt /
 * firstAidFailed); новый урон сбрасывает firstAidUsed — тогда повтор не нужен.
 */
export function restitchingAllowed({ used = false, failed = false, at = null, now = 0, ib = 0 } = {}) {
  if (!used || !failed) return false;
  if (typeof at !== "number" || !Number.isFinite(at)) return false;
  const elapsed = (Number(now) || 0) - at;
  return elapsed >= 0 && elapsed <= Math.max(0, Number(ib) || 0) * 60;
}

// ── Консилиум ───────────────────────────────────────────────────────────────

/** Обычный максимум помощников теста лечения (rules/assists.mjs::DEFAULT_ASSIST_MAX). */
export const HEAL_ASSIST_BASE_MAX = 2;

/** «Удваивает максимум ассистентов для любого теста лечения (до 4 для Первой Помощи)». */
export function healAssistMax(councilium = false) {
  return councilium ? HEAL_ASSIST_BASE_MAX * 2 : HEAL_ASSIST_BASE_MAX;
}

/** Число помощников, ужатое в допустимое: целое, 0..максимум. */
export function clampHealAssists(count, councilium = false) {
  const n = Math.trunc(Number(count) || 0);
  return Math.min(Math.max(0, n), healAssistMax(councilium));
}

/** Прибавка к Порогу: +10 за помощника (корбук, стр. 25). */
export function healAssistBonus(count) {
  return 10 * (Number(count) || 0);
}

/** «Пациенты восстанавливают +2 Раны за каждого ассистента» — только у Консилиума. */
export function councilWounds(councilium, count) {
  return councilium ? 2 * (Number(count) || 0) : 0;
}

// ── Реанимировать ───────────────────────────────────────────────────────────

/** Раунд — 6 секунд (корбук). */
export const ROUND_SECONDS = 6;

/**
 * Сколько Раундов назад умер пациент. В бою (та же схватка и Раунд записаны
 * при смерти) — разница Раундов; иначе — по мировому времени. null — момент
 * смерти неизвестен (ГМ поставил галочку до появления метки).
 * @param {{worldTime?:number, combatId?:string|null, round?:number|null}|null} diedAt
 * @param {{worldTime?:number, combatId?:string|null, round?:number|null}} now
 */
export function roundsSinceDeath(diedAt, now = {}) {
  if (!diedAt) return null;
  if (diedAt.combatId && diedAt.combatId === now.combatId
      && Number.isFinite(diedAt.round) && Number.isFinite(now.round)) {
    return Math.max(0, now.round - diedAt.round);
  }
  if (Number.isFinite(diedAt.worldTime) && Number.isFinite(now.worldTime)) {
    return Math.max(0, Math.floor((now.worldTime - diedAt.worldTime) / ROUND_SECONDS));
  }
  return null;
}

/**
 * Решение владельца 24.10.2026: умер дольше Cor.b Раундов назад — не получается
 * вовсе (условие допуска). Неизвестный момент смерти не блокирует: решает стол.
 * @returns {{ok:boolean, rounds:number|null, limit:number}}
 */
export function reanimateWindow(roundsAgo, corBonus) {
  const limit = Math.max(0, Number(corBonus) || 0);
  if (roundsAgo == null) return { ok: true, rounds: null, limit };
  return { ok: roundsAgo <= limit, rounds: roundsAgo, limit };
}
