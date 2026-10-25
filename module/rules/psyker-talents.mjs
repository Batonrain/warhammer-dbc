// module/rules/psyker-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Таланты Псайканы главы 3, меняющие саму манифестацию (Sahara 3-28): Фокус
//  Техники, Психическая Злоба, Необременённый, Психическое Возрождение,
//  Варповый Шёпот, Исчисления, Любимец Варпа, Проводник Варпа, Штиль,
//  Пропускание не здесь (Проявлений Силы в системе нет).
//
//  Чистый модуль без Foundry: принимает актора/предмет-силу как duck typing,
//  счёт чисел отдаёт вызывающему (sheets/tabs/psychic.mjs::executePsychotest и
//  окно манифестации). Не импортируется из sources.mjs — как rules/psyker.mjs и
//  rules/digital-hatred.mjs, чтобы не замыкать круг источников правил.
//
//  Талант опознаётся по имени (долг wdbc-iadw), имя — литералом в каждом вызове
//  itemHasName: так его находит tools/capability-reachability.mjs. Выбранная
//  при взятии сила (Фокус Техники, Необременённый) лежит в `system.specialization`
//  Таланта или в скобках его имени — как у остальных Талантов с выбором.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName, hatredTargetsOf } from "./predicates.mjs";
import { anyTargetMatches } from "./talent-targets.mjs";

const NS = "warhammer-dbc";

/** Фокус Техники: «+10 на манифестацию выбранной психосилы и −10 на все вызванные ею Феномены». */
export const TECHNIQUE_FOCUS_TEST_BONUS = 10;
export const TECHNIQUE_FOCUS_PHEN_MOD = -10;
/** Психическая Злоба: «+2 к эPR в расчёте психотеста, или дальности, или Dmg и Pen». */
export const PSYCHIC_SPITE_BONUS = 2;
/** Проводник Варпа: +1d5 к эPR эффектов в Усиленном режиме, ценой +30 к броску Феномена. */
export const WARP_CONDUIT_FORMULA = "1d5";
export const WARP_CONDUIT_PHEN_MOD = 30;
/** Ключ метки «Психическое Возрождение действует до начала следующего Хода» (rules/turn-flags.mjs). */
export const RESURGENCE_FLAG = "psychicResurgenceActive";
/** Варповый Шёпот: −10 на засекание за каждое снятое эPR. */
export const WARP_WHISPER_PER_EPR = -10;

const talentsWhere = (actor, pred) =>
  [...(actor?.items ?? [])].filter(i => i?.type === "talent" && pred(i));

const isTechniqueFocus = i => itemHasName(i, "Technique Focus") || itemHasName(i, "Фокус Техники");
const isPsychicSpite   = i => itemHasName(i, "Psychic Spite") || itemHasName(i, "Психическая Злоба");
const isUnburdened     = i => itemHasName(i, "Unburdened") || itemHasName(i, "Необременённый");
const isResurgence     = i => itemHasName(i, "Psychic Resurgence") || itemHasName(i, "Психическое Возрождение");
const isWarpWhisper    = i => itemHasName(i, "Warp Whisper") || itemHasName(i, "Варповый Шёпот");
const isInnumerations  = i => itemHasName(i, "Innumerations") || itemHasName(i, "Исчисления");
const isFavoured       = i => itemHasName(i, "Favoured by the Warp") || itemHasName(i, "Любимец Варпа");
const isWarpConduit    = i => itemHasName(i, "Warp Conduit") || itemHasName(i, "Проводник Варпа");
const isCalmWinds      = i => itemHasName(i, "Calm Winds") || itemHasName(i, "Штиль");

/** Выбранные силы Таланта: поле специализации (через запятую) и скобки в имени. */
export function chosenPowerNames(talent) {
  const spec = String(talent?.system?.specialization ?? "");
  const paren = /\(([^)]*)\)\s*$/.exec(String(talent?.name ?? ""))?.[1] ?? "";
  return `${spec},${paren}`.split(",").map(s => s.trim()).filter(Boolean);
}

/** Выбрана ли эта сила у Таланта (по любой половине двуязычного имени силы). */
export function talentCoversPower(talent, power) {
  if (!power) return false;
  return chosenPowerNames(talent).some(name => itemHasName(power, name));
}

/** Фокус Техники у актора на ЭТУ силу. */
export function techniqueFocusFor(actor, power) {
  return talentsWhere(actor, isTechniqueFocus).some(t => talentCoversPower(t, power));
}

/** Есть ли у актора Талант (любое число выбранных сил) — чтобы окно подсказало, что выбор не сделан. */
export function hasTechniqueFocus(actor) { return talentsWhere(actor, isTechniqueFocus).length > 0; }

export function hasPsychicSpite(actor) { return talentsWhere(actor, isPsychicSpite).length > 0; }
export function hasResurgence(actor) { return talentsWhere(actor, isResurgence).length > 0; }
export function hasWarpWhisper(actor) { return talentsWhere(actor, isWarpWhisper).length > 0; }
export function hasInnumerations(actor) { return talentsWhere(actor, isInnumerations).length > 0; }
export function hasFavouredByTheWarp(actor) { return talentsWhere(actor, isFavoured).length > 0; }
export function hasWarpConduit(actor) { return talentsWhere(actor, isWarpConduit).length > 0; }
export function hasCalmWinds(actor) { return talentsWhere(actor, isCalmWinds).length > 0; }

/**
 * Психическая Злоба: «Когда псайкер манифестирует психосилу на Ненавистном
 * враге» — хоть одна из целей (Foundry-таргет) подходит под цели Таланта Hatred.
 * Без выбранных целей Ненавистного нет, не из чего убедиться.
 */
export function psychicSpiteApplies(actor, targetActors) {
  if (!hasPsychicSpite(actor)) return false;
  const hated = hatredTargetsOf(actor);
  if (!hated.length) return false;
  return (targetActors ?? []).some(t => !!t && anyTargetMatches(hated, { targetActor: t }));
}

/** На что пошла надбавка Злобы: психотест, дальность либо Dmg и Pen. */
export const SPITE_CHOICES = ["test", "range", "damage"];
export const normalizeSpiteChoice = v => (SPITE_CHOICES.includes(v) ? v : "");

/**
 * Необременённый: «При манифестации выбранной психосилы игнорирует штраф к тPR
 * от поддержания психосил, если только уже не поддерживает конкретно эту силу».
 */
export function unburdenedApplies(actor, power) {
  if (power?.system?.isSustained) return false;
  return talentsWhere(actor, isUnburdened).some(t => talentCoversPower(t, power));
}

/** Действует ли сейчас Психическое Возрождение (метка до начала следующего Хода). */
export function resurgenceActive(actor) {
  return !!(actor?.getFlag?.(NS, RESURGENCE_FLAG) ?? actor?.flags?.[NS]?.[RESURGENCE_FLAG]);
}

/**
 * Потолок mPR для манифестации ЭТОЙ силы. Обычно — текущий тПР (бПР минус
 * поддержание); Необременённый и действующее Возрождение снимают штраф за
 * поддержание — потолок бПР. Без поддержания потолки совпадают.
 *
 * @returns {{max:number, normal:number, ignored:""|"unburdened"|"resurgence",
 *            canResurge:boolean}} canResurge — потолок можно поднять Возрождением
 *   за Очко Бесчестия (Талант есть, метки ещё нет, штраф реально есть).
 */
export function manifestPrCeiling(actor, power) {
  const base = Math.max(0, Number(actor?.system?.psyker?.rating) || 0);
  const normal = Math.max(0, Number(actor?.system?.psyker?.currentRating) || 0);
  const penalty = base > normal;
  if (penalty && unburdenedApplies(actor, power)) return { max: base, normal, ignored: "unburdened", canResurge: false };
  if (penalty && resurgenceActive(actor)) return { max: base, normal, ignored: "resurgence", canResurge: false };
  return { max: normal, normal, ignored: "", canResurge: penalty && hasResurgence(actor) };
}

/** Варповый Шёпот: штраф к Пси-Чутью для засекания при снятых X эPR. */
export const warpWhisperPenalty = x => WARP_WHISPER_PER_EPR * Math.max(0, Math.trunc(Number(x) || 0));

/** Исчисления: «модификатор до −2×I.b на бросок Феноменов». */
export function innumerationsMod(actor) {
  if (!hasInnumerations(actor)) return 0;
  const ib = Math.max(0, Number(actor?.system?.characteristics?.int?.bonus) || 0);
  return -2 * ib;
}

// ── Психическая Точность ─────────────────────────────────────────────────────
const isPrecision = i => itemHasName(i, "Psychic Precision") || itemHasName(i, "Психическая Точность");
export function hasPsychicPrecision(actor) { return talentsWhere(actor, isPrecision).length > 0; }

/** Цена выбора места попадания в эPR: часть тела — 2, сочленения/глаза — 4. */
export const PRECISION_COST = { part: 2, fine: 4 };

/** Стрелковая психосила: Психострельба либо «Атака … Стрельба» (подтип стрельбы, стр. 290). */
export function isPsychicShooting(powerSystem) {
  return powerSystem?.powerType === "psychicShoot" || !!powerSystem?.shootSubtype;
}

/**
 * Сколько эPR снять за точный выстрел: «уменьшить эPR силы на 2 …, или на 4 при
 * прицеливании в сочленения/глаза». Эффективный PR не опускается ниже 1: если
 * эPR не хватает на всю цену, выбор невозможен (не «частично»).
 * @returns {number} 0 — выбора нет или он невозможен
 */
export function precisionCost(choice, epr) {
  const cost = PRECISION_COST[choice] ?? 0;
  if (!cost) return 0;
  return (Number(epr) || 0) - cost >= 1 ? cost : 0;
}
