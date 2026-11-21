// module/rules/medusa-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Медуза (Элитный архетип, «Книга Аэльдари: Ответвления») — чистая часть.
//  Обвязка — module/combat/medusa.mjs.
//
//  Эмпат: атаки медузы (Глазная Вспышка, Эмпатия, Кома, Вспышка, Волна
//  Эмпатии; Талантами — Эмоциональный Взрыв, Материальное Крушение) идут
//  тестом W; урон Глазной Вспышки и Волны — +бPR медузы.
//  Медуза: питание сильной эмоцией раз в месяц, наросты (пул до W.b+1),
//  пять наростов — Плод Медузы.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

/** Медуза: когда в последний раз питалась сильной эмоцией (worldTime) — на Черте. */
export const MEDUSA_FED_FLAG = "medusaFedAt";
/** Эмоциональный Взрыв: { combatId, gained, pending } на акторе. */
export const EXPLOSION_FLAG = "emotionalExplosion";
/** Экстремальные Ощущения: { combatId, killBonus } на акторе. */
export const EXTREME_FLAG = "extremeSensations";
/** Пул наростов медузы. */
export const GROWTH_POOL = "medusaGrowth";
export const FRUIT_COST = 5;
export const FEED_PERIOD = 30 * 24 * 3600;
/** У медузы бPR 3 («Медуза имеет 3 бPR»), если на листе носителя PR не выше. */
export const MEDUSA_PR = 3;

const traits = actor => [...(actor?.items ?? [])].filter(i => i?.type === "trait");
const hasTalent = (actor, name) => [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, name));
const n = v => Math.max(0, Math.trunc(Number(v) || 0));

export const hasEmpath = actor => traits(actor).some(i => itemHasName(i, "Empath"));
export const hasMedusae = actor => traits(actor).some(i => itemHasName(i, "Medusae"));
export const hasAlienConsciousness = actor => hasTalent(actor, "Alien Consciousness, Alien Powers");
export const hasEmotionalExplosion = actor => hasTalent(actor, "Emotional Explosion");
export const hasEmotionalVision = actor => hasTalent(actor, "Emotional Vision");
export const hasExtremeSensations = actor => hasTalent(actor, "Extreme Sensations");
export const hasMaterialWreck = actor => hasTalent(actor, "Material Wreck");

/** Атака медузы (идёт тестом W). Урон +бPR — у Глазной Вспышки, Волны Эмпатии и Материального Крушения. */
export function medusaAttackKind(item) {
  if (item?.type !== "weapon") return null;
  if (itemHasName(item, "Eyeburst") || itemHasName(item, "Wave of Empathy") || itemHasName(item, "Material Wreck")) return { pr: true };
  if (itemHasName(item, "Empathy") || itemHasName(item, "Coma") || itemHasName(item, "Flash")
    || itemHasName(item, "Emotional Explosion")) return { pr: false };
  return null;
}

/** бPR медузы: PR на листе, не меньше 3. */
export function medusaPr(actor) {
  return Math.max(MEDUSA_PR, n(actor?.system?.psyker?.rating));
}

/**
 * Окно атаки: атака медузы у носителя Черты Эмпат — Характеристика W, бонус
 * урона +бPR, где книга его даёт. {} — не наш случай.
 */
export function empathAttackPreset(actor, item) {
  if (!hasEmpath(actor)) return {};
  const kind = medusaAttackKind(item);
  if (!kind) return {};
  return { presetChar: "wp", presetDmgBonus: kind.pr ? medusaPr(actor) : 0 };
}

/** Эмоциональный Взрыв: модификатор теста W цели; иммунитет к Страху даёт +30 вместо иммунитета. */
export function explosionTestMod(pr, { fearImmune = false } = {}) {
  return -10 - 5 * n(pr) + (fearImmune ? 30 : 0);
}

/** Шок от Эмоционального Взрыва: 1d100 + 10 за каждый Провал сверх первого (как от Страха). */
export function explosionShockTotal(roll, dof) {
  return n(roll) + 10 * Math.max(0, n(dof) - 1);
}

/** Шок 101+ — ОД медузе в начале следующего Хода: +2, повторно в той же битве — +1. */
export function explosionApBonus(state, combatId) {
  return state?.combatId && state.combatId === combatId && state.gained ? 1 : 2;
}

/** Голодна ли медуза: с последней сильной эмоции прошло больше месяца. */
export function medusaHungry(fedAt, now) {
  if (fedAt == null) return false;
  return (Number(now) || 0) - (Number(fedAt) || 0) > FEED_PERIOD;
}
