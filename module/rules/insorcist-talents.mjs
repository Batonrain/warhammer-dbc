// module/rules/insorcist-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Инзорцист (Элитный архетип, «Псайкеры и оккультисты») — чистая часть без
//  Foundry. Обвязка — module/combat/insorcist.mjs.
//
//  Печать Имени: ритуал W.b + Inf.b Ходов; пока печать держится — T −Inf.b
//  демона (1, если Inf нет). Инзорцизм: полудействие — призыв запечатанного
//  демона подчинённым; Inf 31+ — Inf.b непоглощаемого урона в голову;
//  держится W.b суток; рядом (не дальше W м) Нестабильность проходит сама;
//  изгнанного — снова через W.b + Inf.b часов (месяцев — после экзорцизма
//  или выжигания души). Метка Поработителя: Ненависть демонов к нему, порог
//  Пси-Чутья 3/2/1/авто по сильнейшей печати.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

const NS = "warhammer-dbc";
/** Печати на акторе: [{ id, name, inf, infB, wp, wpb, unnatural, bannedUntil, summonedUntil }]. */
export const SEALS_FLAG = "insorcistSeals";
/** Идущий ритуал Запечатывания: { targetUuid, seal, left }. */
export const SEAL_RITUAL_FLAG = "insorcistSealRitual";
/** Чёрная Рука: { targetUuid, sealId, tally }. */
export const BLACK_HAND_FLAG = "insorcistBlackHand";
/** На оружии: Мимолётная Одержимость { sealId, ownerUuid, turns, pre }. */
export const FLEETING_FLAG = "fleetingPossession";
/** На ActiveEffect печати: id печати. */
export const SEAL_EFFECT_FLAG = "insorcistSeal";

export const HOUR = 3600;
export const DAY = 24 * HOUR;
export const MONTH = 30 * DAY;
/** Демон «сильный»: Inf 31+ (урон при призыве, Демоническое Ополчение). */
export const GREATER_INF = 31;

const flagOf = (doc, key) => doc?.getFlag?.(NS, key) ?? doc?.flags?.[NS]?.[key];
const traits = actor => [...(actor?.items ?? [])].filter(i => i?.type === "trait");
const hasTalent = (actor, name) => [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, name));

export const hasInsorcism = actor => traits(actor).some(i => itemHasName(i, "Insorcism"));
export const hasNameSeal = actor => traits(actor).some(i => itemHasName(i, "Name Seal"));
export const hasMarkOfSubjugator = actor => traits(actor).some(i => itemHasName(i, "Mark of Subjugator"));
export const hasBlackHand = actor => hasTalent(actor, "Black Hand");
export const hasDaemonicLevy = actor => hasTalent(actor, "Daemonic Levy");
export const hasFleetingPossession = actor => hasTalent(actor, "Fleeting Possession");

const n = v => Math.max(0, Math.trunc(Number(v) || 0));

/** Inf и Inf.b демона (статблок Бестиария хранит total/bonus). */
export function demonInfOf(demon) {
  const c = demon?.system?.characteristics?.inf ?? {};
  const inf = n(c.total ?? c.value);
  const infB = c.bonus != null && c.bonus !== "" ? n(c.bonus) : Math.floor(inf / 10);
  return { inf, infB };
}

/** Печати актора (копия массива). */
export function sealsOf(actor) {
  const s = flagOf(actor, SEALS_FLAG);
  return Array.isArray(s) ? s.map(x => ({ ...x })) : [];
}

/** Длина ритуала Запечатывания в Ходах: W.b Инзорциста + Inf.b демона. */
export function sealRitualTurns(wpb, infB) {
  return Math.max(1, n(wpb) + n(infB));
}

/** На сколько печать снижает T: Inf.b демона, 1 — если у демона нет Inf. */
export function sealTPenalty(seal) {
  return n(seal?.inf) > 0 ? n(seal?.infB) : 1;
}

/** Суммарное снижение T от всех печатей. */
export function sealsTPenalty(seals = []) {
  return seals.reduce((s, x) => s + sealTPenalty(x), 0);
}

/** Непоглощаемый урон в голову при призыве: Inf.b демона с Inf 31+. */
export function insorcismHeadDamage(seal) {
  return n(seal?.inf) >= GREATER_INF ? n(seal?.infB) : 0;
}

/** Демоническое Ополчение: сколько свиты (до Inf.b), 0 — нельзя. */
export function levyMax(seal) {
  return n(seal?.inf) >= GREATER_INF ? n(seal?.infB) : 0;
}

/** Срок пребывания призванного: W.b Инзорциста суток. */
export function summonStaySeconds(wpb) {
  return n(wpb) * DAY;
}

/** Через сколько изгнанного можно призвать снова (секунды). severe — экзорцизм/выжигание души. */
export function banishCooldownSeconds(wpb, seal, { severe = false } = {}) {
  return (n(wpb) + n(seal?.infB)) * (severe ? MONTH : HOUR);
}

/** Сколько ещё ждать до нового призыва (секунды, 0 — можно). */
export function sealBarredRemaining(seal, now) {
  const until = Number(seal?.bannedUntil) || 0;
  return Math.max(0, until - (Number(now) || 0));
}

/** Нестабильность призванного проходит сама: не дальше W (значение) метров от Инзорциста. */
export function insorcistAnchorsInstability(distanceM, insorcistWp) {
  if (distanceM == null) return true;
  return Number(distanceM) <= n(insorcistWp);
}

/**
 * Метка Поработителя: сколько Успехов Пси-Чутья нужно, чтобы засечь Метку.
 * 3; держит печать Inf 31–50 — 2; 51–70 — 1; 71+ — 0 (автоматически).
 */
export function markDetectionNeed(seals = []) {
  const top = seals.reduce((m, s) => Math.max(m, n(s?.inf)), 0);
  if (top >= 71) return 0;
  if (top >= 51) return 1;
  if (top >= GREATER_INF) return 2;
  return 3;
}

/** Совпадает ли имя демона с печатью (любая половина «English / Русское», без регистра). */
export function sealMatchesName(seal, name) {
  const halves = s => String(s ?? "").split("/").map(h => h.trim().toLowerCase()).filter(Boolean);
  const a = halves(seal?.name), b = halves(name);
  return a.some(h => b.includes(h));
}

/** Человекочитаемая длительность (секунды → «N ч»/«N сут.»/«N мес.»). */
export function spanLabel(sec) {
  const s = n(sec);
  if (s >= MONTH) return `${Math.ceil(s / MONTH)} мес.`;
  if (s >= DAY) return `${Math.ceil(s / DAY)} сут.`;
  return `${Math.max(1, Math.ceil(s / HOUR))} ч`;
}
