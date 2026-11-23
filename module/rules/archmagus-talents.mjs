// module/rules/archmagus-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Архимаг (Элитный архетип Тзинча) — чистая часть без Foundry. Обвязка —
//  module/combat/archmagus.mjs; окно манифестации — combat/psyker-elite-hooks.mjs.
//  Имена — литералами в itemHasName/hasTalent (их видит замер покрытия).
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

const NS = "warhammer-dbc";
/** Зеркальная Душа: метка на поддерживаемой психосиле «держит копия души». */
export const MIRROR_SOUL_FLAG = "mirrorSoul";
/** Внутренний Глаз: { deg, combatId, sceneId } на акторе. */
export const INNER_EYE_FLAG = "innerEye";
/** Савант Имматериал: на бесплатной силе — id силы, за которую она взята. */
export const SAVANT_FLAG = "savantFreeOf";

/** Экземптус: For.Lore(Psykers)−60; убит лично — штраф на 30 меньше; +5 за кубик выжигания. */
export const EXEMPTUS_BASE = -60;
export const EXEMPTUS_PERSONAL = 30;
export const EXEMPTUS_PER_BURN_DIE = 5;
/** Чародейский Посох: Good.Q/Best.Q — +5/+10 к психотестам. */
export const STAFF_QUALITY_BONUS = { good: 5, best: 10 };
/** Высший Магус: Очки Бесчестия. */
export const MAGUS_EXCLUDE_COST = 1;
export const MAGUS_TRANSFER_COST = 3;
export const MAGUS_TRANSFER_RANGE = 9;

const flagOf = (doc, key) => doc?.getFlag?.(NS, key) ?? doc?.flags?.[NS]?.[key];
const traits = actor => [...(actor?.items ?? [])].filter(i => i?.type === "trait");
const hasTalent = (actor, name) => [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, name));

export const hasMagusSupreme = actor => traits(actor).some(i => itemHasName(i, "Magus Supreme"));
export const hasMasteryOfForm = actor => traits(actor).some(i => itemHasName(i, "Mastery of Form"));
export const hasWizardStaff = actor => traits(actor).some(i => itemHasName(i, "Wizard Staff"));
export const hasExemptus = actor => hasTalent(actor, "Exemptus");
export const hasInnerEye = actor => hasTalent(actor, "Inner Eye");
export const hasMirrorSoul = actor => hasTalent(actor, "Mirror Soul");
export const hasMysticFeint = actor => hasTalent(actor, "Mystic Feint");
export const hasSavantImmaterial = actor => hasTalent(actor, "Savant Immaterial");
export const hasUnlimitedPower = actor => hasTalent(actor, "Unlimited Power");

/** Модификатор теста Экземптуса. */
export function exemptusMod({ personal = false, burnDice = 0 } = {}) {
  const dice = personal ? Math.max(0, Math.trunc(Number(burnDice) || 0)) : 0;
  return EXEMPTUS_BASE + (personal ? EXEMPTUS_PERSONAL : 0) + dice * EXEMPTUS_PER_BURN_DIE;
}

/**
 * Внутренний Глаз: Успехи последующего теста Пси-Чутья. Каждые полные 10
 * разницы модификаторов — ±1 Успех. Тест всё равно успешен (не меньше 1).
 */
export function innerEyeDeg(baseDeg, modDiff = 0) {
  const shift = Math.trunc((Number(modDiff) || 0) / 10);
  return Math.max(1, (Math.trunc(Number(baseDeg) || 0) || 1) + shift);
}

/** Действует ли Внутренний Глаз: до конца этого боя (если взят в бою) или этой сцены. */
export function innerEyeState(actor, { combatId = null, sceneId = null } = {}) {
  const st = flagOf(actor, INNER_EYE_FLAG);
  if (!st || !(Number(st.deg) > 0)) return null;
  if (st.combatId) return st.combatId === combatId ? st : null;
  return st.sceneId && st.sceneId === sceneId ? st : null;
}

/**
 * Безграничная Сила: свои Успехи ×3, затем встречный тест и контрмеры, затем
 * остаток /3 (окр.▲). Успехи от Провалов противника не делятся.
 * @returns {{tripled:number, remaining:number, final:number, won:boolean}}
 */
export function unlimitedPowerResult({ mine = 0, oppSuccesses = 0, counters = 0, oppFailures = 0 } = {}) {
  const n = v => Math.max(0, Math.trunc(Number(v) || 0));
  const tripled = n(mine) * 3;
  const remaining = tripled - n(oppSuccesses) - n(counters);
  const kept = remaining > 0 ? Math.ceil(remaining / 3) : 0;
  const final = kept + (n(oppFailures));
  return { tripled, remaining, final, won: final > 0 };
}

/** Савант Имматериал: вторая сила стоит не больше половины первой. */
export function savantAllowed(costFirst, costSecond) {
  const a = Number(costFirst) || 0, b = Number(costSecond) || 0;
  return a > 0 && b >= 0 && b * 2 <= a;
}

/**
 * Зеркальная Душа: сколько PR поддержания несёт копия души (не снижает тPR).
 * Силы, уже бесплатные по Ране в Реальности, не считаются второй раз.
 */
export function mirrorSoulCost(actor) {
  if (!hasMirrorSoul(actor)) return 0;
  let n = 0;
  for (const p of actor?.items ?? []) {
    if (p?.type !== "psychicPower" || !p.system?.isSustained) continue;
    if (!flagOf(p, MIRROR_SOUL_FLAG) || flagOf(p, "woundFree")) continue;
    n += Math.max(0, Number(p.system?.sustainCost ?? 1) || 0);
  }
  return n;
}

/** Чародейский Посох: бонус качества посоха к психотестам. */
export function staffQualityBonus(quality) {
  return STAFF_QUALITY_BONUS[String(quality ?? "").toLowerCase()] ?? 0;
}
