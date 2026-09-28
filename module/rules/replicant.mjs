// module/rules/replicant.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Черты Репликанта (корбук, глава I «Расы», сверка 26.09.2026) — чистая
//  арифметика, без Foundry. Кто что читает — в module/constants/capabilities.mjs
//  (ключи trait.* ниже), Foundry-обвязка — combat/replicant.mjs.
//
//  Возможности выдаёт САМА Черта записью Конструктора «Возможность», а не раса:
//  сними Черту — уйдёт и правило; дай её кому-то ещё (мутацией, ГМом) — правило
//  заработает у него тоже.
//
//  Этот файл импортирует источник правил (rules/sources.mjs — блок восстановления
//  S/T при просроченной сыворотке), поэтому hasRuleFlag (rules/flags.mjs →
//  collect.mjs → sources.mjs) отсюда брать НЕЛЬЗЯ — круг импортов вешает
//  загрузку (AGENTS.md, wdbc-795h). Возможность читается напрямую с Черты
//  (item-marker.mjs::itemHasKey), как у rules/addiction.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasKey } from "./item-marker.mjs";
import { SECONDS_PER_DAY, SECONDS_PER_HOUR, formatDuration } from "../constants/imperial-calendar.mjs";

export const ALCHEM_MONSTER  = "trait.alchemMonster";
export const ENDURING        = "trait.enduring";
export const HYPNO_SCARS     = "trait.hypnoScars";
export const SERUM_HOOK      = "trait.serumHook";
export const EXPIRATION_DATE = "trait.expirationDate";
export const GENETIC_DECAY   = "trait.geneticDecay";

const NS = "warhammer-dbc";

/** Черта актора, несущая возможность `key` (или null). */
export function traitWithKey(actor, key) {
  return [...(actor?.items ?? [])].find(i => i?.type === "trait" && itemHasKey(i, key)) ?? null;
}

// ── Alchem Monster / Алхимическое Чудовище ───────────────────────────────────
// «Он удваивает длительность всех наркотиков и ядов на себя, но должен
// перебрасывать успешные тесты против ядов. Репликант удваивает лимит приёма
// наркотиков в неделю, после которого он должен бросать на Зависимость, но
// должен перебрасывать успешные тесты Зависимости.»

/** Категории Химии, чья длительность удваивается: наркотики и яды (не медикаменты/эликсиры). */
export const ALCHEM_DURATION_CATEGORIES = new Set(["narcotic", "poison"]);

/** Множитель длительности препарата на носителе Черты. */
export function alchemDurationFactor(drugCategory, hasAlchem) {
  return hasAlchem && ALCHEM_DURATION_CATEGORIES.has(String(drugCategory ?? "")) ? 2 : 1;
}

/** Недельный лимит доз до теста Зависимости. */
export function alchemDoseLimit(minDose, hasAlchem) {
  const n = Number(minDose) || 0;
  return hasAlchem ? n * 2 : n;
}

/**
 * Обязан ли бросок быть переброшен: только УСПЕШНЫЙ тест, только один раз —
 * повторный бросок окончателен (книга не велит перебрасывать переброс).
 */
export function mustRerollSuccess(success, hasAlchem, alreadyRerolled = false) {
  return !!(success && hasAlchem && !alreadyRerolled);
}

// ── Hypno-Scars / Гипно-Шрамы ────────────────────────────────────────────────
// «уменьшает Предел Критического Провала для всех тестов I на 10 (обычно до
// 86+) и при Критическом Провале теста I впадает в Ступор на 1 Раунд».
// Предел — правило critRangeMod (rules/library/replicant.mjs), Ступор — здесь.

/** Тест на Интеллекте (Характеристика или Навык на ней)? */
export function isIntTest(ctx) {
  if (!ctx || ctx.kind === "attack" || ctx.kind === "power") return false;
  return String(ctx.char ?? "").toLowerCase() === "int";
}

/** Нужно ли наложить Ступор от Гипно-Шрамов по итогу броска. */
export function hypnoScarsStun(crit, ctx, hasHypno) {
  return !!(hasHypno && crit?.failure && isIntTest(ctx));
}

// ── Serum Hook / Крючок Сывороток ────────────────────────────────────────────
// «должен хотя бы раз в неделю принимать специальные гормональные сыворотки
// (медикамент, R0). Если он их не принимает, он получает 1d5 урона в S и T
// каждые 8 часов и не может восстанавливать урон в эти Характеристики отдыхом
// и медитацией (но может с помощью эликсиров или психосил), пока не примет
// сыворотку.»
//
// Момент последнего приёма — флаг на самой Черте (flags.warhammer-dbc.
// serumTakenAt, worldTime в секундах): состояние личное для носителя, как
// дата утоления у Зависимости (rules/addiction.mjs), и не требует поля схемы.

export const SERUM_FLAG      = "serumTakenAt";
export const SERUM_PERIOD    = 7 * SECONDS_PER_DAY;
export const SERUM_TICK      = 8 * SECONDS_PER_HOUR;
export const SERUM_TARGETS   = ["s", "t"];
/** Предел тиков одного сдвига Календаря — страховка, как MAX_TICKS часов Состояний. */
const MAX_TICKS = 50;

/** Момент последнего приёма (null — ещё не отмечен). */
export function serumTakenAt(trait) {
  const v = trait?.getFlag?.(NS, SERUM_FLAG) ?? trait?.flags?.[NS]?.[SERUM_FLAG];
  return v == null || v === "" ? null : Number(v);
}

/** Просрочена ли сыворотка к моменту `now`. Не отмеченный приём — не просрочен (без штрафа задним числом). */
export function serumOverdue(takenAt, now) {
  if (takenAt == null) return false;
  return Number(now) - Number(takenAt) > SERUM_PERIOD;
}

/**
 * Моменты урона в отрезке (from, to]: каждые 8 часов после истечения недели —
 * первый через 8 ч после конца недели, затем каждые 8 ч.
 * @returns {number[]} worldTime каждого тика
 */
export function serumTicksBetween(takenAt, from, to) {
  if (takenAt == null || !(Number(to) > Number(from))) return [];
  const start = Number(takenAt) + SERUM_PERIOD;
  const out = [];
  // Первый тик строго после from: k = floor((from − start)/TICK) + 1, не меньше 1.
  let k = Math.max(1, Math.floor((Number(from) - start) / SERUM_TICK) + 1);
  for (let i = 0; i < MAX_TICKS; i++, k++) {
    const at = start + k * SERUM_TICK;
    if (at > Number(to)) break;
    if (at > Number(from)) out.push(at);
  }
  return out;
}

/** Строка статуса для листа. */
export function serumStatusLabel(takenAt, now) {
  if (takenAt == null) return "приём не отмечен";
  const left = Number(takenAt) + SERUM_PERIOD - Number(now);
  if (left >= 0) return `до следующей дозы: ${formatDuration(left)}`;
  return `просрочена: ${formatDuration(-left)}`;
}

/**
 * Правило для конвейера (источник «serumHook», rules/sources.mjs): пока доза
 * просрочена — урон в S и T не восстанавливается сам (отдых/медитация).
 * Эликсиры и психосилы лечат напрямую (healCharDamage) и этим не задеты.
 */
export function serumHookRules(actor, now) {
  const trait = traitWithKey(actor, SERUM_HOOK);
  if (!trait || !serumOverdue(serumTakenAt(trait), now)) return [];
  return [{
    id: "replicant.serumHook.noRecovery",
    label: "Serum Hook / Крючок Сывороток: сыворотка просрочена",
    when: {},
    effects: [{ kind: "charRecovery", target: SERUM_TARGETS.join(","), mode: "block" }]
  }];
}

// ── Genetic Decay / Генетическое Угасание ────────────────────────────────────
// «За каждую мутацию (но не Дар Богов) Репликант уменьшает свой максимальный
// возраст на 1 год. Каждый раз, когда он получает урон в Характеристики (в т.ч.
// из-за пропущенного приёма сыворотки), он увеличивает этот урон на +1 за каждую
// свою мутацию.»
//
// Дар Богов в паке — тот же тип "mutation", но с богом (system.god, папка
// «Дары_Богов»); у общих мутаций бог пуст.

/** Число мутаций актора без Даров Богов. */
export function mutationCountNoGifts(actor) {
  return [...(actor?.items ?? [])]
    .filter(i => i?.type === "mutation" && !String(i.system?.god ?? "").trim()).length;
}

/** Прибавка к одному урону в Характеристику. */
export function geneticDecayBonus(amount, mutations, hasDecay) {
  const n = Number(amount) || 0;
  if (!hasDecay || n <= 0) return 0;
  return Math.max(0, Number(mutations) || 0);
}

// ── Expiration Date / Срок Годности ──────────────────────────────────────────
// «Срок жизни Репликанта – 15+1d5 лет, и стартовый персонаж-Репликант наверняка
// как минимум уже прожил 5 лет.» Бросок хранится на Черте (flags.warhammer-dbc.
// lifespanYears) — один раз на жизнь, как стартовые Раны.

export const LIFESPAN_FLAG    = "lifespanYears";
export const LIFESPAN_FORMULA = "15+1d5";
export const START_AGE_MIN    = 5;

export function lifespanYears(trait) {
  const v = trait?.getFlag?.(NS, LIFESPAN_FLAG) ?? trait?.flags?.[NS]?.[LIFESPAN_FLAG];
  return v == null || v === "" ? null : Number(v);
}

/**
 * Предельный возраст с учётом Генетического Угасания.
 * @returns {?{base:number, decay:number, max:number}}
 */
export function replicantMaxAge(base, mutations, hasDecay) {
  if (base == null) return null;
  const decay = hasDecay ? Math.max(0, Number(mutations) || 0) : 0;
  return { base: Number(base), decay, max: Math.max(0, Number(base) - decay) };
}

/** Ювенант на Репликанте: «уменьшает его возраст на 1d5 лет / 1 год / 2 месяца … лимиты возраста ÷5». */
export const REPLICANT_JUVENAT_NOTE =
  "Ювенант: −1d5 лет / −1 год / −2 месяца на соответствующих лимитах возраста; все лимиты возраста для препарата ÷5. «Панацея» Биомантии — как обычно.";
