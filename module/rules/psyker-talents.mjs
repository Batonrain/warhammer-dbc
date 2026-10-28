// module/rules/psyker-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Таланты Псайканы главы 3, меняющие саму манифестацию (Sahara 3-28): Фокус
//  Техники, Психическая Злоба, Необременённый, Психическое Возрождение,
//  Варповый Шёпот, Исчисления, Любимец Варпа, Проводник Варпа, Штиль,
//  Пропускание — строкой в карточке (пачка I1, ниже; подсистемы Проявлений нет).
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

/**
 * Действует ли сейчас Психическое Возрождение (метка до начала следующего Хода). Метка хранит id боя,
 * в котором куплена: гасит её только начало своего Хода, а бой может кончиться раньше — тогда она
 * не должна поднимать потолок ни вне боя, ни в следующем бою. combatId — id идущего боя (null — боя нет).
 */
export function resurgenceActive(actor, combatId = null) {
  const mark = actor?.getFlag?.(NS, RESURGENCE_FLAG) ?? actor?.flags?.[NS]?.[RESURGENCE_FLAG];
  return combatId != null && mark === combatId;
}

/**
 * Потолок mPR для манифестации ЭТОЙ силы. Обычно — текущий тПР (бПР минус
 * поддержание); Необременённый и действующее Возрождение снимают штраф за
 * поддержание — потолок бПР. Без поддержания потолки совпадают.
 *
 * @param {{combatId?:string|null}} [opts] combatId — id идущего боя (см. resurgenceActive)
 * @returns {{max:number, normal:number, ignored:""|"unburdened"|"resurgence",
 *            canResurge:boolean}} canResurge — потолок можно поднять Возрождением
 *   за Очко Бесчестия (Талант есть, метки ещё нет, штраф реально есть).
 */
export function manifestPrCeiling(actor, power, { combatId = null } = {}) {
  const base = Math.max(0, Number(actor?.system?.psyker?.rating) || 0);
  const normal = Math.max(0, Number(actor?.system?.psyker?.currentRating) || 0);
  const penalty = base > normal;
  if (penalty && unburdenedApplies(actor, power)) return { max: base, normal, ignored: "unburdened", canResurge: false };
  if (penalty && resurgenceActive(actor, combatId)) return { max: base, normal, ignored: "resurgence", canResurge: false };
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

// ════════════════════════════════════════════════════════════════════════════
//  ПАЧКА I1 (Sahara 3-28, решения владельца 26.10.2026): Таланты с пулами и
//  экономикой манифестации — Пропускание, Быстрое Плетение, Текучее Плетение,
//  Ключевые Силы. Здесь — только чистая логика (без Foundry); состояние пишут
//  combat/psyker-pools.mjs и лист.
// ════════════════════════════════════════════════════════════════════════════

const flagOf = (doc, key) => doc?.getFlag?.(NS, key) ?? doc?.flags?.[NS]?.[key];
const intBonus = actor => Math.max(0, Number(actor?.system?.characteristics?.int?.bonus) || 0);
const isSurprised = actor => !!actor?.system?.conditions?.surprised;

const isChannel      = i => itemHasName(i, "Channel") || itemHasName(i, "Пропускание");
const isFastWeaving  = i => itemHasName(i, "Fast Weaving") || itemHasName(i, "Быстрое Плетение");
const isFluidWeave   = i => itemHasName(i, "Fluid Weave") || itemHasName(i, "Текучее Плетение");
const isSignatureTal = i => itemHasName(i, "Signature Powers") || itemHasName(i, "Ключевые Силы");

// ── Пропускание (Channel) ────────────────────────────────────────────────────
export function hasChannel(actor) { return talentsWhere(actor, isChannel).length > 0; }

/**
 * «Когда он манифестирует психосилу Путём Силы «Психофокус» после успешного
 * теста психофокуса, она не вызывает Проявлений Силы, если только она не
 * вызывает Феномен». Проявлений как подсистемы в игре нет (решение владельца
 * 26.10.2026) — Талант даёт строку в карточке манифестации.
 * @returns {""|"quiet"|"exposed"} "" — строки нет; "quiet" — Проявлений нет;
 *   "exposed" — Психофокус удался, но Феномен всё равно выдал силу.
 */
export function channelOutcome(actor, { path, focusPassed, phenomena }) {
  if (!hasChannel(actor) || path !== "psychofocus" || !focusPassed) return "";
  return phenomena ? "exposed" : "quiet";
}

// ── Тип «Атака» и цена действия психосилы ───────────────────────────────────
/** Метка «Атака» у психосилы: основной тип «Атака»/«Психострельба» либо доп. тип. */
export function isAttackPower(sys) {
  return sys?.powerType === "attack" || sys?.powerType === "psychicShoot"
    || (sys?.extraTypes ?? []).some(e => e?.type === "attack");
}

/**
 * Сколько ОД стоит манифестация по полю действия самой силы (system.action): Полудействие — 1,
 * Полное и Длительное — 2 (как combat/action-economy.mjs::apCostForActionType), Свободное и Реакция — 0
 * (Реакция платится Реакцией, не ОД). Поле пусто — по умолчанию Полудействие. В паке у всех 708 сил
 * поле заполнено, пустых нет; умолчание — на силы, заведённые руками.
 */
export function psychicApCost(action) {
  if (action == null || action === "") return 1;
  return action === "half" ? 1 : (action === "full" || action === "extended") ? 2 : 0;
}

// ── Быстрое Плетение (Fast Weaving) ─────────────────────────────────────────
/** «В начале боя сразу после бросков инициативы персонаж получает 2 полудействия». */
export const FAST_WEAVING_POOL = 2;
/** Метка актора с остатком пула; гаснет в начале СВОЕГО Хода (rules/turn-flags.mjs). */
export const FAST_WEAVING_FLAG = "fastWeavingAp";

export function hasFastWeaving(actor) { return talentsWhere(actor, isFastWeaving).length > 0; }

/** Что выдать в начале боя: 2 ОД, а застигнутому Врасплох и без Таланта — 0. */
export function fastWeavingStart(actor) {
  return hasFastWeaving(actor) && !isSurprised(actor) ? FAST_WEAVING_POOL : 0;
}

/** Остаток пула сейчас. «Если его застали Врасплох — не работает»: пока висит состояние, пул пуст. */
export function fastWeavingLeft(actor) {
  if (!hasFastWeaving(actor) || isSurprised(actor)) return 0;
  return Math.max(0, Math.trunc(Number(flagOf(actor, FAST_WEAVING_FLAG)) || 0));
}

const FAST_WEAVING_WHY = {
  "no-talent": "",
  surprised: "Быстрое Плетение: персонажа застали Врасплох — пул обнулён.",
  empty: "Быстрое Плетение: пул ОД пуст.",
  "own-turn": "Быстрое Плетение: пул действует только до начала своего Хода.",
  attack: "Быстрое Плетение: пул — только на психосилы без типа «Атака».",
  cost: "Быстрое Плетение: пул покрывает только ОД — у Свободного действия и Реакции платить нечем."
};

/**
 * Можно ли оплатить манифестацию силы из пула. ownTurn — идёт ли сейчас Ход
 * самого псайкера: пул выдан ДО первого Хода, с началом Хода он сбрасывается.
 * Пул не обязан покрыть всё: он уменьшает реальное списание ОД на min(цена, остаток), остальное
 * платится из обычных ОД. action — ступень действия после Пути Силы (constants/psyker.mjs::pathManifestAction).
 * @returns {{ok:boolean, code:string, reason:string, cost:number, left:number, cover:number}} cover — сколько ОД покроет пул
 */
export function fastWeavingGate(actor, power, { ownTurn = false, action = power?.system?.action } = {}) {
  const cost = psychicApCost(action);
  const left = fastWeavingLeft(actor);
  const refuse = code => ({ ok: false, code, reason: FAST_WEAVING_WHY[code], cost, left, cover: 0 });
  if (!hasFastWeaving(actor)) return refuse("no-talent");
  if (isSurprised(actor)) return refuse("surprised");
  if (left <= 0) return refuse("empty");
  if (ownTurn) return refuse("own-turn");
  if (isAttackPower(power?.system)) return refuse("attack");
  if (cost <= 0) return refuse("cost");
  return { ok: true, code: "ok", reason: "", cost, left, cover: Math.min(cost, left) };
}

// ── Текучее Плетение (Fluid Weave) ──────────────────────────────────────────
/** Метка Таланта: сколько очков Плетения уже потрачено (остаток = I.b − это). */
export const FLUID_WEAVE_SPENT_FLAG = "fluidWeaveSpent";
/** Метка актора «раз в Ход»: переплетение уже было; гаснет в начале СВОЕГО Хода. */
export const FLUID_WEAVE_TURN_FLAG = "fluidWeaveThisTurn";
/** Влияния/Призывы/Психические Клинки — книжный перечень сил, которые можно переплести. */
export const FLUID_WEAVE_TYPES = ["infusion", "summon", "psychicBlade"];

export function fluidWeaveTalent(actor) { return talentsWhere(actor, isFluidWeave)[0] ?? null; }

/** «Он получает I.b очков Текучего Плетения». */
export function fluidWeaveMax(actor) { return fluidWeaveTalent(actor) ? intBonus(actor) : 0; }

export function fluidWeaveSpent(actor) {
  const t = fluidWeaveTalent(actor);
  if (!t) return 0;
  return Math.min(fluidWeaveMax(actor), Math.max(0, Math.trunc(Number(flagOf(t, FLUID_WEAVE_SPENT_FLAG)) || 0)));
}

export function fluidWeaveLeft(actor) { return fluidWeaveMax(actor) - fluidWeaveSpent(actor); }

export function isFluidWeavePower(sys) {
  return FLUID_WEAVE_TYPES.includes(sys?.powerType)
    || (sys?.extraTypes ?? []).some(e => FLUID_WEAVE_TYPES.includes(e?.type));
}

const FLUID_WEAVE_WHY = {
  "no-talent": "Текучее Плетение: нет Таланта.",
  type: "Текучее Плетение: переплести можно только Вливание, Призыв или Психический Клинок.",
  "not-sustained": "Текучее Плетение: развеять можно только поддерживаемую сейчас силу.",
  empty: "Текучее Плетение: очки Плетения кончились (полное действие концентрации возвращает 1).",
  "used-this-turn": "Текучее Плетение: раз в Ход — в этом Ходу уже переплетали."
};

/** Можно ли переплести эту силу сейчас. inCombat — «раз в Ход» считается только в бою. */
export function fluidWeaveGate(actor, power, { inCombat = false } = {}) {
  const refuse = code => ({ ok: false, code, reason: FLUID_WEAVE_WHY[code] });
  if (!fluidWeaveTalent(actor)) return refuse("no-talent");
  if (!isFluidWeavePower(power?.system)) return refuse("type");
  if (!power?.system?.isSustained) return refuse("not-sustained");
  if (fluidWeaveLeft(actor) <= 0) return refuse("empty");
  if (inCombat && flagOf(actor, FLUID_WEAVE_TURN_FLAG)) return refuse("used-this-turn");
  return { ok: true, code: "ok", reason: "" };
}

// ── Ключевые Силы (Signature Powers) ────────────────────────────────────────
/** Метка Таланта: имена выбранных сил (английская половина имени) — их ставят галочками на листе. */
export const SIGNATURE_FLAG = "signaturePowers";

export function signatureTalent(actor) { return talentsWhere(actor, isSignatureTal)[0] ?? null; }

/**
 * I.b без урона в Характеристику: книга — «если их количество превышает I.b (кроме как от
 * урона в I), псайкер должен отмести лишние», то есть потеря от урона силы не отнимает.
 */
function intBonusIgnoringLoss(actor) {
  const b = intBonus(actor);
  const loss = Math.max(0, Number(actor?.system?.charLoss?.int) || 0);
  const total = Number(actor?.system?.characteristics?.int?.total);
  if (!loss || !Number.isFinite(total)) return b;
  return Math.max(b, Math.floor((total + loss) / 10));
}

/** «Выбрать до I.b известных психосил». */
export function signatureLimit(actor) { return signatureTalent(actor) ? intBonusIgnoringLoss(actor) : 0; }

const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

function flagNames(talent) {
  const v = flagOf(talent, SIGNATURE_FLAG);
  return Array.isArray(v) ? v.map(s => String(s).trim()).filter(Boolean) : [];
}

/** Всё выбранное: поле «Специализация»/скобки в имени Таланта, затем галочки; без повторов. */
function signatureAll(talent) {
  const out = [];
  for (const n of [...chosenPowerNames(talent), ...flagNames(talent)])
    if (!out.some(o => sameName(o, n))) out.push(n);
  return out;
}

/**
 * Действующие ключевые силы: выбранные в порядке выбора, но не больше I.b —
 * «если их количество превышает I.b, псайкер должен отмести лишние».
 */
export function signatureNames(actor) {
  const t = signatureTalent(actor);
  return t ? signatureAll(t).slice(0, signatureLimit(actor)) : [];
}

/** Эта психосила — ключевая у актора (по любой половине двуязычного имени). */
export function isSignaturePower(actor, power) {
  if (!power) return false;
  return signatureNames(actor).some(n => itemHasName(power, n));
}

/** Английская половина имени силы — так её хранит метка (имена сил двуязычны). */
export const powerKeyName = power => String(power?.name ?? "").split("/")[0].trim();

/**
 * Что сделает галочка у силы: добавить в список до I.b либо снять.
 * @returns {{ok:boolean, code:string, reason:string, names:string[]}} names —
 *   новое значение метки Таланта (только при ok)
 */
export function signatureToggle(actor, power) {
  const t = signatureTalent(actor);
  if (!t) return { ok: false, code: "no-talent", reason: "Ключевые Силы: нет Таланта.", names: [] };
  const own = flagNames(t);
  const key = powerKeyName(power);
  const inFlag = own.find(n => sameName(n, key) || itemHasName(power, n));
  if (inFlag) return { ok: true, code: "off", reason: "", names: own.filter(n => n !== inFlag) };
  if (chosenPowerNames(t).some(n => itemHasName(power, n)))
    return { ok: false, code: "spec", reason: "Ключевые Силы: эта сила записана в поле «Специализация» Таланта — снимите её там.", names: own };
  if (signatureAll(t).length >= signatureLimit(actor))
    return { ok: false, code: "limit", reason: `Ключевые Силы: уже выбрано ${signatureLimit(actor)} (I.b) — сначала снимите другую.`, names: own };
  return { ok: true, code: "on", reason: "", names: [...own, key] };
}
