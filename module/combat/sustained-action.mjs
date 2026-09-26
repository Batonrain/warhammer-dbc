// module/combat/sustained-action.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Длительное/Расширенное действие (стр. 12, wdbc-x1nz.2.27) — Foundry-
//  обвязка поверх чистой арифметики rules/sustained-action.mjs: хранение —
//  тот же приём, что у Расширенных тестов (flags.warhammer-dbc.
//  sustainedActions.<key>, module/sheets/actor-sheet.mjs::extendedTests),
//  трата ОД — combat/action-economy.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { spendActionPoints, apCostForActionType, isImplantDisrupted } from "./action-economy.mjs";
import { mentalSustainedThreshold } from "../rules/bone-head.mjs";
import {
  advanceSustainedAction, interruptSustainedAction, passCheckpoint,
  sustainedActionKey, SUSTAINED_ACTION_KINDS
} from "../rules/sustained-action.mjs";

export { sustainedActionKey, SUSTAINED_ACTION_KINDS };

const FLAG_SCOPE = "warhammer-dbc";
const FLAG_ROOT  = "sustainedActions";

/** Строка actionType для apCostForActionType — обе разновидности сейчас 2 ОД. */
function apLabelFor(kind) {
  return kind === SUSTAINED_ACTION_KINDS.EXTENDED ? "Расширенное действие" : "Длительное действие";
}

/**
 * Начать новое Длительное/Расширенное действие — первый Ход тоже тратит
 * 2 ОД (стр. 12), тем же путём, что и продолжение (continueSustainedAction).
 *
 * @param {Actor} actor
 * @param {{label:string, kind:"long"|"extended", threshold:number, physical?:boolean}} opts
 *   threshold — turnsNeeded (Длительное) или testInterval (Расширенное).
 *   physical — метка action-economy.mjs::actionBlockReason, передаётся как
 *   есть: НЕ умолчание false, иначе любое Длительное действие считалось бы
 *   явно не-физическим и было бы доступно Беспомощному (wdbc-x1nz.2.88).
 * @returns {?object} новая строка банка ({key,...}), либо null — не хватило ОД
 */
export async function beginSustainedAction(actor, { label, kind, threshold, physical } = {}) {
  const cost = apCostForActionType(apLabelFor(kind));
  // Сбой импланта Костеголова (rules/bone-head.mjs): ментальное Длительное
  // тянется вдвое больше Ходов. Цена Хода остаётся 2 ОД — удваивается срок,
  // а не трата за Ход (4 ОД в Ход не влезли бы вовсе).
  const disrupted = physical === false && isImplantDisrupted(actor);
  threshold = mentalSustainedThreshold(threshold, { physical, disrupted });
  if (!await spendActionPoints(actor, cost, { physical, sustained: true })) return null;
  const key = sustainedActionKey(label);
  const state = { kind, label, threshold, ...advanceSustainedAction(null, threshold) };
  await actor.setFlag(FLAG_SCOPE, `${FLAG_ROOT}.${key}`, state);
  return { key, ...state };
}

/** Продолжить на ещё один Ход — тот же расход ОД, тот же порог. */
export async function continueSustainedAction(actor, key, { physical } = {}) {
  const state = actor.getFlag(FLAG_SCOPE, `${FLAG_ROOT}.${key}`);
  if (!state) return null;
  const cost = apCostForActionType(apLabelFor(state.kind));
  // Срок уже удвоен при начале (beginSustainedAction) — Ход стоит 2 ОД как есть.
  if (!await spendActionPoints(actor, cost, { physical, sustained: true })) return null;
  const next = { ...state, ...advanceSustainedAction(state, state.threshold) };
  await actor.setFlag(FLAG_SCOPE, `${FLAG_ROOT}.${key}`, next);
  return { key, ...next };
}

/**
 * Контрольная точка Расширенного действия пройдена (тест сдан своим путём —
 * обычным броском Навыка/Характеристики, вне этого модуля): счётчик точек
 * растёт, банк с последней точки гасится для следующего интервала.
 */
export async function passSustainedCheckpoint(actor, key) {
  const state = actor.getFlag(FLAG_SCOPE, `${FLAG_ROOT}.${key}`);
  if (!state) return null;
  const next = { ...state, ...passCheckpoint(state) };
  await actor.setFlag(FLAG_SCOPE, `${FLAG_ROOT}.${key}`, next);
  return { key, ...next };
}

/**
 * Действие прервано (стр. 12) — сами оборвали, или помешали обстоятельства.
 * Длительное теряет банк целиком (unsetFlag), Расширенное — только счётчик
 * с последней точки (rules/sustained-action.mjs::interruptSustainedAction).
 */
export async function interruptSustained(actor, key) {
  const state = actor.getFlag(FLAG_SCOPE, `${FLAG_ROOT}.${key}`);
  if (!state) return;
  const next = interruptSustainedAction(state.kind);
  if (next === null) return actor.unsetFlag(FLAG_SCOPE, `${FLAG_ROOT}.${key}`);
  await actor.setFlag(FLAG_SCOPE, `${FLAG_ROOT}.${key}`, { ...state, ...next });
}

/** Завершить и убрать запись — после финального теста Длительного, либо когда всё Расширенное сделано. */
export function clearSustainedAction(actor, key) {
  return actor.unsetFlag(FLAG_SCOPE, `${FLAG_ROOT}.${key}`);
}
