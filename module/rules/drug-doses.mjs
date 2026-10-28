// module/rules/drug-doses.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Недельный счётчик доз наркотиков (корбук, «Наркотики: Зависимость», поле 1;
//  wdbc-gyqf2): «Минимальное опасное количество применений в неделю. Если
//  персонаж в неделю применял этот наркотик хотя бы это количество раз, он при
//  завершении действия наркотика должен пройти тест на Зависимость, со штрафом
//  –10 за каждое применение сверх этого числа».
//
//  Завершение действия препарата в системе ручное (таймера нет), поэтому
//  проверка идёт в момент применения (решение владельца 01.10.2026): исход
//  тот же, но не зависит от кнопки «Снять эффект». Чистая часть: журнал доз за
//  скользящую неделю игрового времени, лимит, штраф. Бросок — sheets/tabs/
//  drugs.mjs::weeklyDoseCheck.
// ════════════════════════════════════════════════════════════════════════════

import { SECONDS_PER_DAY } from "../constants/imperial-calendar.mjs";
import { itemHasName } from "./predicates.mjs";
import { hasRuleFlag } from "./flags.mjs";
import { hasTalentCapability } from "./ability-by-key.mjs";
import { alchemDoseLimit, ALCHEM_MONSTER } from "./replicant.mjs";
import { HOOK_UP_CAP } from "./medic-talents.mjs";

/** Флаг актора: { <название наркотика>: [worldTime, …] } — дозы за последнюю неделю. */
export const DRUG_DOSES_FLAG = "drugDoses";
export const DOSE_WEEK_SECONDS = 7 * SECONDS_PER_DAY;
/** Штраф теста Зависимости за каждое применение сверх лимита. */
export const OVERDOSE_PENALTY = -10;

/** Ключ журнала: название препарата (стопки одного наркотика считаются вместе). */
export const doseKey = item => String(item?.name ?? "").trim();

/** Журнал после ещё одной дозы: устаревшие (старше недели) отброшены. */
export function logDose(log, key, now) {
  const next = { ...(log ?? {}) };
  const t = Number(now) || 0;
  const recent = (next[key] ?? []).filter(x => Number(x) > t - DOSE_WEEK_SECONDS);
  next[key] = [...recent, t];
  for (const k of Object.keys(next)) {
    if (k !== key && !(next[k] ?? []).some(x => Number(x) > t - DOSE_WEEK_SECONDS)) delete next[k];
  }
  return next;
}

/** Сколько доз этого наркотика за последнюю неделю (с только что принятой). */
export function dosesThisWeek(log, key, now) {
  const t = Number(now) || 0;
  return (log?.[key] ?? []).filter(x => Number(x) > t - DOSE_WEEK_SECONDS).length;
}

/** Метка на предмете-наркотике: приготовлен с «Крючком» (Талант Медика, medic.core.hookUp; 3-dc87). */
export const HOOK_UP_FLAG = "hookUp";
/** Штраф теста крафта, который берёт на себя «Крючок». */
export const HOOK_UP_CRAFT_PENALTY = -30;

/** Приготовлен ли препарат с «Крючком» — на предмете метка flags.warhammer-dbc.hookUp. */
export function isHookedUp(item) {
  return !!(item?.getFlag?.("warhammer-dbc", HOOK_UP_FLAG) ?? item?.flags?.["warhammer-dbc"]?.[HOOK_UP_FLAG]);
}

/** Доступен ли «Крючок» проекту крафта: Талант у крафтера, режим Крафт, категория «Химия». */
export function hookUpAvailable(crafter, proj) {
  return !!crafter && proj?.mode === "craft" && proj?.categoryKey === "chem" && hasTalentCapability(crafter, HOOK_UP_CAP);
}

/** Штраф теста крафта от «Крючка»: −30, если доступен и включён галочкой проекта, иначе 0. */
export function hookUpCraftMod(crafter, proj) {
  return hookUpAvailable(crafter, proj) && proj.hookUp ? HOOK_UP_CRAFT_PENALTY : 0;
}

/**
 * «Крючок»: минимальное опасное количество применений в неделю вдвое меньше
 * (окр.▼). Ноль означал бы «лимита нет» — предел остаётся хотя бы 1 применением.
 */
export function hookUpMinDose(minDose) {
  const n = Number(minDose) || 0;
  return n > 0 ? Math.max(1, Math.floor(n / 2)) : 0;
}

/** Сколько раз взят Талант «Толерантность»: каждая копия — +1 к лимиту. */
export function toleranceRanks(actor) {
  return [...(actor?.items ?? [])].filter(i =>
    i?.type === "talent" && (itemHasName(i, "Tolerance") || itemHasName(i, "Толерантность"))).length;
}

/** Лимит доз в неделю: minDose, ×2 у Репликанта, +1 за каждую «Толерантность». */
export function weeklyDoseLimit(actor, minDose) {
  const base = Number(minDose) || 0;
  if (base <= 0) return 0;
  return alchemDoseLimit(base, hasRuleFlag(actor, ALCHEM_MONSTER)) + toleranceRanks(actor);
}

/**
 * Нужен ли тест Зависимости и с каким штрафом.
 * @returns {null|{penalty:number, over:number}} null — лимит не достигнут
 */
export function addictionCheckFor(count, limit) {
  if (!(limit > 0) || count < limit) return null;
  const over = count - limit;
  return { penalty: over ? OVERDOSE_PENALTY * over : 0, over };
}
