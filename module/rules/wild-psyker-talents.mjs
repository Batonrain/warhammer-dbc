// module/rules/wild-psyker-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Дикий Псайкер (Элитный архетип, «Псайкеры и оккультисты») — чистая часть
//  без Foundry. Обвязка (карточки, кнопки, урон, начало Хода) —
//  module/combat/wild-psyker.mjs.
//
//  Щит Цепей (Черта): «Полученное попадание наносится по Щиту (бPR×3 Ран, бPR
//  AP, поглощает через W.b вместо T.b). В начале каждого Хода Щит
//  восстанавливает тPR Ран. Когда Щит теряет все Раны, он отключается, но весь
//  „лишний“ урон игнорируется; пока отключён, Псайкер получает урон как без
//  Трейта. Щит включается обратно, только когда регенерирует все Раны.
//  … При отрицательном истончении Завесы не регенерирует Раны; при истончении
//  Завесы 3+ регенерирует бPR Ран вместо тPR».
//
//  Раны Щита — пул ресурса архетипа (rules/resource-pools.mjs, ключ
//  chainShield, запись kind:"resourcePool" на Черте: максимум 3×бPR,
//  полный в начале боя). Здесь — арифметика: поглощение попадания, регенерация,
//  метки «до начала/конца своего следующего Хода» у Талантов.
//
//  Имена Черт и Талантов — литералами в itemHasName/hasItemNamed: так их
//  видит замер tools/automation-coverage.mjs.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

const NS = "warhammer-dbc";

/** Ключ пула Ран Щита Цепей (system.resourcePools.chainShield). */
export const CHAIN_SHIELD_KEY = "chainShield";
/** Метка актора «Щит отключён до полной регенерации». */
export const CHAIN_SHIELD_DOWN_FLAG = "chainShieldDown";
/** Иссушающий Заряд: AP и поглощение Щита ×2 — счётчик начал своего Хода до снятия. */
export const WITHERING_FLAG = "witheringCharge";
/** Цепи Стремительности: Hoverer ×2, W вместо A в Acrobatics/Dodge — счётчик начал Хода. */
export const ALACRITY_FLAG = "chainsOfAlacrity";
/** Отторжение Цепей: момент (worldTime), с которого считаются недели. */
export const REJECTION_FLAG = "chainRejectionFrom";
export const SECONDS_PER_WEEK = 7 * 24 * 3600;

/** Иссушающий Заряд: 2d10+5 урона в T и S. */
export const WITHERING_COST = "2d10+5";
/** Пламя Сердца: 1d5 урона в T и S, +1d5 к эPR (один кубик на всё). */
export const HEART_FIRE_DIE = "1d5";
/** Шрамы Цепей: тест Cor+10. */
export const CHAIN_SCARS_MOD = 10;
/** Пожиратель Смерти: Cor+0, +5 за каждого умершего после первого. */
export const DEATH_EATER_STEP = 5;

const flagOf = (doc, key) => doc?.getFlag?.(NS, key) ?? doc?.flags?.[NS]?.[key];
const traits = actor => [...(actor?.items ?? [])].filter(i => i?.type === "trait");
const hasTalent = (actor, name) => [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, name));

// ── Кто что умеет ──────────────────────────────────────────────────────────
export const hasBrokenChains = actor => traits(actor).some(i => itemHasName(i, "Broken Chains"));
export const hasShieldOfChains = actor => traits(actor).some(i => itemHasName(i, "Shield of Chains"));
export const hasChainRejection = actor => traits(actor).some(i => itemHasName(i, "Chain Rejection"));
export const hasChainScars = actor => hasTalent(actor, "Chain Scars");
export const hasChainsOfAlacrity = actor => hasTalent(actor, "Chains of Alacrity");
export const hasDeathEater = actor => hasTalent(actor, "Death Eater");
export const hasHeartFire = actor => hasTalent(actor, "Heart Fire");
export const hasPowerOverwhelming = actor => hasTalent(actor, "Power Overwhelming");
export const hasResidualAbsorption = actor => hasTalent(actor, "Residual Absorption");
export const hasWitheringCharge = actor => hasTalent(actor, "Withering Charge");

// ── Порванные Цепи (Черта) ──────────────────────────────────────────────────
//  «Даёт +3 бPR … но не позволяет носить жёсткую или силовую броню. Порванные
//  Цепи неуязвимы к эффектам Haywire» (иммунитет — запись Конструктора
//  weaponPropertyImmunity.haywire на Черте).

/** +3 к базовому Пси-Рейтингу (rules/character/final-pools.mjs). */
export const BROKEN_CHAINS_PR = 3;

/** Прибавка Порванных Цепей к бPR: 3 у носителя Черты, иначе 0. */
export const brokenChainsPrBonus = actor => (hasBrokenChains(actor) ? BROKEN_CHAINS_PR : 0);

/**
 * Причина запрета надеть броню или "" — можно. Жёсткая — свойство «hard»,
 * силовая — armorType «power» (тот же признак, что wearsActivePowerArmour).
 */
export function brokenChainsArmourBan(actor, item) {
  if (item?.type !== "armor" || !hasBrokenChains(actor)) return "";
  const s = item.system ?? {};
  if (s.armorType === "power") return "Порванные Цепи: силовую броню носить нельзя.";
  if ((s.properties ?? []).includes("hard")) return "Порванные Цепи: жёсткую броню носить нельзя.";
  return "";
}

// ── Числа актора ────────────────────────────────────────────────────────────
/** бPR — базовый Пси-Рейтинг. */
export const basePr = actor => Math.max(0, Math.trunc(Number(actor?.system?.psyker?.rating) || 0));
/** тPR — текущий (бPR минус поддержание). */
export const currentPr = actor => Math.max(0, Math.trunc(Number(actor?.system?.psyker?.currentRating) || 0));
/** Бонус Характеристики. */
export const charBonus = (actor, key) => Math.max(0, Math.trunc(Number(actor?.system?.characteristics?.[key]?.bonus) || 0));

/** Максимум Ран Щита: бPR×3. */
export const chainShieldMax = actor => basePr(actor) * 3;

/** Щит отключён (потерял все Раны и ещё не восстановился полностью). */
export const chainShieldDown = actor => !!flagOf(actor, CHAIN_SHIELD_DOWN_FLAG);

/** Раны Щита сейчас (хранимое, прижатое к максимуму). */
export function chainShieldValue(actor) {
  const max = chainShieldMax(actor);
  return Math.max(0, Math.min(max, Math.trunc(Number(actor?.system?.resourcePools?.[CHAIN_SHIELD_KEY]) || 0)));
}

/** Сколько Ран Щит восстанавливает в начале Хода по Завесе: <0 — 0, 3+ — бPR, иначе тPR. */
export function chainShieldRegen(actor, veilSteps = 0) {
  const v = Number(veilSteps) || 0;
  if (v < 0) return 0;
  return v >= 3 ? basePr(actor) : currentPr(actor);
}

/**
 * Итог начала Хода для Щита: новое значение и включён ли он.
 * @returns {{before:number, after:number, max:number, regen:number, wasDown:boolean, down:boolean}}
 */
export function chainShieldTurnStart(actor, veilSteps = 0) {
  const max = chainShieldMax(actor);
  const before = chainShieldValue(actor);
  const regen = chainShieldRegen(actor, veilSteps);
  const after = Math.min(max, before + regen);
  const wasDown = chainShieldDown(actor);
  // «Включается обратно, только когда регенерирует все Раны».
  const down = wasDown && after < max;
  return { before, after, max, regen, wasDown, down };
}

/** Действует ли Иссушающий Заряд (AP и поглощение ×2). */
export const witheringActive = actor => (Number(flagOf(actor, WITHERING_FLAG)) || 0) > 0;
/** Действуют ли Цепи Стремительности. */
export const alacrityActive = actor => (Number(flagOf(actor, ALACRITY_FLAG)) || 0) > 0;

/**
 * Попадание по Щиту Цепей. AP Щита = бPR (Пробитие срезает его как броню),
 * поглощение = AP + W.b. Иссушающий Заряд удваивает и AP, и W.b-часть.
 * Урон сверх оставшихся Ран Щита игнорируется («лишний»), Щит отключается.
 * @returns {{ap:number, effAp:number, wb:number, soak:number, net:number,
 *            before:number, after:number, broke:boolean, wasted:number}}
 */
export function chainShieldHit({ damage = 0, penetration = 0, pr = 0, wb = 0, pool = 0, boosted = false } = {}) {
  const mult = boosted ? 2 : 1;
  const ap = Math.max(0, Math.trunc(Number(pr) || 0)) * mult;
  const effAp = Math.max(0, ap - Math.max(0, Math.trunc(Number(penetration) || 0)));
  const wbEff = Math.max(0, Math.trunc(Number(wb) || 0)) * mult;
  const soak = effAp + wbEff;
  const net = Math.max(0, Math.trunc(Number(damage) || 0) - soak);
  const before = Math.max(0, Math.trunc(Number(pool) || 0));
  const after = Math.max(0, before - net);
  const broke = before > 0 && net >= before;
  return { ap, effAp, wb: wbEff, soak, net, before, after, broke, wasted: Math.max(0, net - before) };
}

/** Шрамы Цепей: урон в Характеристику минус Успехи теста (не ниже 0). */
export function chainScarsReduce(amount, successDeg) {
  return Math.max(0, (Number(amount) || 0) - Math.max(0, Number(successDeg) || 0));
}

/** Пожиратель Смерти: модификатор теста Cor за число умерших (+5 за каждого после первого). */
export function deathEaterMod(deaths) {
  const n = Math.max(0, Math.trunc(Number(deaths) || 0));
  return n > 1 ? (n - 1) * DEATH_EATER_STEP : 0;
}

/**
 * Цепи Стремительности: насколько W лучше A для Acrobatics/Dodge — прибавка к
 * итогу Навыка («использовать W вместо A»: худшее брать незачем).
 */
export function alacritySkillDelta(actor, chars = actor?.system?.characteristics) {
  if (!alacrityActive(actor)) return 0;
  const w = Number(chars?.wp?.total) || 0;
  const a = Number(chars?.ag?.total) || 0;
  return Math.max(0, w - a);
}

/** Навыки, которым Цепи Стремительности подменяют A на W. */
export const ALACRITY_SKILLS = ["acrobatics", "dodge"];

/** Rules/character: поправить итог Acrobatics/Dodge (зовётся после расчёта Навыков). */
export function applyAlacritySkills(actor, skills, chars) {
  const d = alacritySkillDelta(actor, chars);
  if (!d) return;
  for (const k of ALACRITY_SKILLS) if (skills?.[k] && skills[k].total != null) skills[k].total += d;
}

/** SPD полёта: Цепи Стремительности удваивают рейтинг Hoverer. null — не летит. */
export function alacrityFlightSpd(actor, spd) {
  if (spd == null) return spd;
  return alacrityActive(actor) ? spd * 2 : spd;
}

/**
 * Отторжение Цепей: сколько полных недель прошло от метки до `to`.
 * @returns {{weeks:number, next:number}} next — новая метка (кратна неделе от старой)
 */
export function rejectionWeeks(from, to) {
  const f = Number(from), t = Number(to);
  if (!Number.isFinite(f) || !Number.isFinite(t) || t <= f) return { weeks: 0, next: f };
  const weeks = Math.floor((t - f) / SECONDS_PER_WEEK);
  return { weeks, next: f + weeks * SECONDS_PER_WEEK };
}
