// module/combat/condition-ticks.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Тик Состояний по Ходам (wdbc-j3yf) — поля длительности (sheet-helpers.mjs::
//  CONDITIONS_DEF) уже существуют и пишутся с разных мест листа (weapon-
//  properties.mjs, drugs.mjs, healing.mjs), но ни один хук их не читал:
//  счётчики уменьшал и урон Кровотечения/Горения наносил игрок сам, руками.
//
//  Тайминг — из книги (core.json, «Раны и Урон», разделы «Кровотечение»/
//  «Огонь»): Кровотечение/Горение бьют «в конце своего Хода» (processTurnEnd,
//  зовётся из hooks.mjs для АКТОРА, чей Ход только что закончился), счётчики
//  длительности (Оглушение/Ослепление/Удушье) тикают «в начале своего Хода»
//  (processTurnStart, для актора, чей Ход начинается).
//
//  Паника от Горения (стр. «Раны и Урон», «Огонь») — тест W+0 в начале Хода
//  Горящего персонажа, тест Морали; провал пропускает весь Ход (обнуление ОД,
//  тот же приём, что «Подавленный в укрытии» в action-economy.mjs). Раньше
//  здесь было сознательное решение это НЕ реализовывать (игровое событие, не
//  число для тика) — отменено по прямому запросу пользователя, wdbc-zepq.
// ════════════════════════════════════════════════════════════════════════════

import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { applyWoundLoss, woundDeathThreshold } from "../rules/wounds.mjs";
import { addFatigue, conditionAdjustFields, conditionApplyFields, conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import { rollMoraleTest } from "../rules/morale-test.mjs";
import { postShockRecoveryPrompt } from "./fear.mjs";
import { applyLordOfExoditesFailPenalty } from "./lord-of-exodites.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { resolveArmorProps } from "./armor-properties.mjs";
// Морозное Сердце (wdbc-5knb): щит с записью Конструктора
// kind:"shieldVsCondition" можно бросить против ТИКА Горения, гася его
// целиком при успехе — единственная причина, по которой этот модуль вообще
// знает о combat/damage.mjs (в остальном тик состояний намеренно идёт мимо
// конвейера урона, см. шапку файла).
import { rollShieldAgainstConditionTick, burningGraceSourceItem } from "./damage.mjs";
// Состояния «N раундов», тикающие в начале Хода их обладателя — ключ
// system.conditions.<key> (bool) + system.conditions.<field> (число). Из
// реестра constants/conditions.mjs (wdbc-w88h): любое Состояние со счётчиком
// "rounds" тикает здесь само, заводить его в этом списке отдельно не нужно.
import { ROUND_TICK_CONDITIONS as ROUND_CONDITIONS, CONDITIONS_DEF } from "../constants/conditions.mjs";
import { BLESSED_FITS_PENDING_FLAG, blessedFitsRefundDue } from "../rules/blessed-fits.mjs";
import { changeActorInfamy } from "../apps/infamy-points.mjs";
// Parasite/Паразит (Трейт — общий, wdbc-ux8a): parasiticContact — тот же
// генерик-цикл, что Оглушение/Ослепление, спец-хук на 0 — тот же приём, что
// возврат Очка Бесчестия у Blessed Fits ниже (апп-слой можно звать отсюда —
// тот прецедент уже есть, changeActorInfamy тоже apps/).
import { completeInfection } from "../apps/parasite-trait.mjs";
// Срок Состояния штатной Duration эффекта (wdbc-uqco). Состояние, у которого
// срок задан, сюда не попадает вовсе: его считает Foundry, а истечение
// подметается ниже. Свой декремент остаётся ровно для тех, кому срок
// проставили старым способом — числом в поле, без эффекта.
import { sweepConditionDurations, hasConditionDuration } from "./condition-effects.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
// Смерть от Состояния (wdbc-x1nz.2.92/.94): Кровотечение «на 0 и ниже он
// умирает», Удушье «умирает от удушья через T.b Раундов» — общий путь.
import { killByCondition } from "./condition-death.mjs";
import { applyCharDamage } from "./char-damage.mjs";
// Тесты внутри тиков (T+0 против жара/удушья, W+0 Обескровливания) — с
// модификаторами персонажа, как любой тест без диалога (rules/roll-mods.mjs::
// collectTestMods): раньше тут был голый 1d100 против t.total, и штрафы
// реестра правил (−5 к T за уровень Обескровливания и т.п.) до тиков не
// доезжали.
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { isAstartes } from "../rules/legacy-weapon.mjs";
import { uselessRoundTick, SIDE_LABELS } from "../rules/useless-limbs.mjs";

const NS = "warhammer-dbc";

/**
 * Тест характеристики внутри тика — без диалога, поэтому модификаторы реестра
 * правил берутся все (collectTestMods — «для мест БЕЗ диалога»).
 * @returns {Promise<{base:number, eff:number, parts:string[], roll:Roll, rv:number, success:boolean}>}
 */
export async function rollConditionCharTest(actor, char, mod = 0) {
  const base = Number(actor?.system?.characteristics?.[char]?.total) || 0;
  const rm = collectTestMods(actor, { kind: "skill", char });
  const eff = base + (Number(mod) || 0) + rm.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const { success } = testOutcome(rv, eff);
  return { base, eff, parts: rm.parts, roll, rv, success };
}

/** «тест T+0 (<b>Порог</b>): <b>бросок</b>» — подпись модификаторов во всплывающей подсказке Порога. */
function charTestText(label, t) {
  const tip = t.parts.length ? ` title="${esc(`${t.base} (${t.parts.join(", ")})`)}"` : "";
  return `тест ${label} (<b${tip}>${t.eff}</b>): <b>${t.rv}</b>`;
}

// ── Обескровливание (стр. «Раны и Урон», «Кровотечение», wdbc-x1nz.2.92) ────
// «Если он набирает больше 5 Обескровливания (10 для десантников), раз в
// минуту (12 Ходов), начиная с Хода, когда он пересек этот предел, персонаж
// должен пройти тест W+0, или теряет сознание, пока его Обескровливание не
// опустится ниже, или пока он не получит непоглощенный урон. Персонаж снимает
// с себя 1 Обескровливания в час.»
/** Метка «без сознания ОТ ОБЕСКРОВЛИВАНИЯ» — снимается только своими причинами пробуждения. */
export const HAEMORRHAGE_FAINT_FLAG = "haemorrhageFaint";
/** Сколько своих Ходов прошло с пересечения предела (0 — Ход пересечения). */
export const HAEMORRHAGE_TURNS_FLAG = "haemorrhageTurns";
/** worldTime, от которого отсчитывается «−1 Обескровливания в час». */
export const HAEMORRHAGE_HOUR_FLAG = "haemorrhageHourAt";
/** «раз в минуту (12 Ходов)». */
export const HAEMORRHAGE_TEST_EVERY_TURNS = 12;
const SECONDS_PER_HOUR = 3600;

/** Начало отсчёта без своей метки — начало прокрутки (0 — тоже момент, не «нет»). */
function clockStart(from, now) {
  const f = Number(from);
  return Number.isFinite(f) ? f : now;
}

/** Предел Обескровливания: больше 5, у десантников больше 10. */
export function haemorrhageLimit(actor) {
  return isAstartes(actor) ? 10 : 5;
}

// ── Удушье (стр. «Раны и Урон», «Удушье», wdbc-x1nz.2.94) ─────────────────
/** Состояние задержки дыхания: {phase:"holding"} или {phase:"unconscious", left, faintAt}. */
export const SUFFOCATION_FLAG = "suffocation";
/** Режим «в покое» (T.b минут, тест раз в минуту) — иначе активный (T.b×2 Раундов, тест каждый Ход). */
export const SUFFOCATION_REST_FLAG = "suffocationRest";
/** worldTime последней засчитанной минуты режима покоя. */
export const SUFFOCATION_CLOCK_FLAG = "suffocationClockAt";
/** Раунд в секундах: книга приравнивает минуту к 12 Ходам. */
const SECONDS_PER_ROUND = 5;

/**
 * Запас задержки дыхания: T.b×2 Раундов в активности, T.b минут в покое.
 * Не меньше 1 — при T.b 0 книжные «0 Раундов» значили бы потерю сознания
 * раньше первого же теста, чего текст явно не имеет в виду.
 */
export function suffocationHoldUnits(tb, { rest = false } = {}) {
  const n = Number(tb) || 0;
  return Math.max(1, rest ? n : n * 2);
}

/** «Потерявший сознание персонаж умирает от удушья через T.b Раундов» (не меньше 1). */
export function suffocationDeathRounds(tb) {
  return Math.max(1, Number(tb) || 0);
}

/**
 * Есть ли у Без сознания другая причина, кроме снимаемой: Усталость на пороге
 * (conditions.mjs::addFatigue), Удушье без сознания, Обескровливание.
 * Пробуждение по одной причине не должно будить персонажа, которого держит другая.
 */
function otherUnconsciousCause(actor, except) {
  if (except !== HAEMORRHAGE_FAINT_FLAG && actor.getFlag?.(NS, HAEMORRHAGE_FAINT_FLAG)) return true;
  if (except !== SUFFOCATION_FLAG && actor.getFlag?.(NS, SUFFOCATION_FLAG)?.phase === "unconscious") return true;
  // Обморок от Усталости: идущий таймер пробуждения (condition-clock.mjs::
  // fatigueFaintClock) или Усталость на пороге.
  if ((Number(actor.system?.conditions?.fatigueFaintWakeAt) || 0) > 0) return true;
  const tb = Number(actor.system?.characteristics?.t?.bonus) || 0;
  const wb = Number(actor.system?.characteristics?.wp?.bonus) || 0;
  const fatigue = Number(actor.system?.fatigue?.value) || 0;
  return tb + wb > 0 && fatigue >= tb + wb;
}

/**
 * Снять причину Без сознания (метку-флаг) и само Состояние, если других причин
 * нет. false — метки не было (персонаж без сознания не от этого).
 */
export async function releaseUnconsciousCause(actor, causeFlag) {
  if (!actor?.getFlag?.(NS, causeFlag)) return false;
  const upd = { [`flags.${NS}.-=${causeFlag}`]: null };
  if (actor.system?.conditions?.unconscious && !otherUnconsciousCause(actor, causeFlag)) {
    Object.assign(upd, conditionRemoveFields("unconscious"));
  }
  await actor.update(upd);
  return true;
}

/**
 * «…пока он не получит непоглощенный урон» — зовётся из конвейера урона
 * (combat/damage.mjs, netDamage > 0) и из тика Горения ниже.
 */
export async function wakeFromHaemorrhageOnDamage(actor) {
  if (!await releaseUnconsciousCause(actor, HAEMORRHAGE_FAINT_FLAG)) return false;
  await postConditionCard(actor, [`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Обескровливание: непоглощённый урон приводит в чувство</div>`]);
  return true;
}

/**
 * Конец Хода: предел Обескровливания. Ход пересечения — нулевой, тест W+0 в
 * нём и далее каждые 12 Ходов; провал — Без сознания с меткой. Уровень
 * опустился до предела — метка и счётчик Ходов снимаются, персонаж очнулся.
 */
async function processHaemorrhageLimit(actor, lines) {
  const level = Number(actor.system?.conditions?.haemorrhagingLevel) || 0;
  const limit = haemorrhageLimit(actor);
  const turnsFlag = actor.getFlag?.(NS, HAEMORRHAGE_TURNS_FLAG);
  if (level <= limit) {
    if (turnsFlag != null) await actor.update({ [`flags.${NS}.-=${HAEMORRHAGE_TURNS_FLAG}`]: null });
    if (await releaseUnconsciousCause(actor, HAEMORRHAGE_FAINT_FLAG)) {
      lines.push(`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Обескровливание ${level} ≤ ${limit} — приходит в себя</div>`);
    }
    return;
  }
  const turns = turnsFlag == null ? 0 : (Number(turnsFlag) || 0) + 1;
  await actor.update({ [`flags.${NS}.${HAEMORRHAGE_TURNS_FLAG}`]: turns });
  if (turns % HAEMORRHAGE_TEST_EVERY_TURNS !== 0) return;
  // Уже без сознания (от этого же или по другой причине) — «или теряет
  // сознание» терять нечего, тест не бросается.
  if (actor.system?.conditions?.unconscious) return;
  const t = await rollConditionCharTest(actor, "wp");
  let outcome = `<span class="roll-success">держится</span>`;
  if (!t.success) {
    const faint = conditionApplyFields("unconscious", null, actor);
    if (Object.keys(faint).length) {
      await actor.update({ ...faint, [`flags.${NS}.${HAEMORRHAGE_FAINT_FLAG}`]: true });
      outcome = `<span class="roll-failure">провал → 😵 Без сознания (от Обескровливания)</span>`;
    } else {
      outcome = `<span class="roll-failure">провал — иммунитет к Без сознания</span>`;
    }
  }
  lines.push(`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Обескровливание ${level} > ${limit}: ${charTestText("W+0", t)} ${outcome}</div>`);
}

/**
 * «Персонаж снимает с себя 1 Обескровливания в час» — обработчик часов
 * игрового времени (combat/condition-clock.mjs, sweepConditionClock). Отсчёт
 * от момента, когда уровень стал ненулевым (метка ставится тиком
 * Кровотечения), иначе — от начала прокрутки.
 */
export async function haemorrhageHourly(actor, { from, to } = {}) {
  const level = Number(actor?.system?.conditions?.haemorrhagingLevel) || 0;
  const flagAt = Number(actor?.getFlag?.(NS, HAEMORRHAGE_HOUR_FLAG)) || 0;
  if (level <= 0) {
    if (flagAt) await actor.update({ [`flags.${NS}.-=${HAEMORRHAGE_HOUR_FLAG}`]: null });
    return;
  }
  const now = Number(to) || 0;
  const at = flagAt || clockStart(from, now);
  const hours = Math.floor((now - at) / SECONDS_PER_HOUR);
  if (hours <= 0) {
    if (!flagAt) await actor.update({ [`flags.${NS}.${HAEMORRHAGE_HOUR_FLAG}`]: at });
    return;
  }
  const next = Math.max(0, level - hours);
  const upd = conditionAdjustFields(actor, "haemorrhaging", next - level);
  if (next > 0) upd[`flags.${NS}.${HAEMORRHAGE_HOUR_FLAG}`] = at + hours * SECONDS_PER_HOUR;
  else upd[`flags.${NS}.-=${HAEMORRHAGE_HOUR_FLAG}`] = null;
  await actor.update(upd);
  const lines = [`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Обескровливание: прошло ${hours} ч — <b>${level}</b> → <b>${next}</b></div>`];
  if (next <= haemorrhageLimit(actor)) {
    if (actor.getFlag?.(NS, HAEMORRHAGE_TURNS_FLAG) != null) {
      await actor.update({ [`flags.${NS}.-=${HAEMORRHAGE_TURNS_FLAG}`]: null });
    }
    if (await releaseUnconsciousCause(actor, HAEMORRHAGE_FAINT_FLAG)) {
      lines.push(`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Обескровливание ниже предела — приходит в себя</div>`);
    }
  }
  await postConditionCard(actor, lines);
}

// ── Удушье: шаги задержки дыхания (wdbc-x1nz.2.94) ─────────────────────────
const SUFF_ICON = () => rollIcon("run", "#8fb0c4");

/**
 * Одна единица задержки (Ход в активности, минута в покое): тест T+0 (провал
 * +1 Усталости) и −1 запаса; запас кончился — Без сознания и запуск отсчёта
 * смерти. Запас 0 без начатой задержки (Состояние наложено без числа — диалог
 * «Добавить состояние», старые данные) — это ПОЛНЫЙ запас, а не пустой:
 * раньше такой персонаж начинал сразу с бесконечных тестов.
 * @param {number} [faintAt] момент потери сознания (worldTime) — для режима покоя
 */
async function stepSuffocationHold(actor, { rest = false, faintAt = null } = {}) {
  const lines = [];
  const tb = Number(actor.system?.characteristics?.t?.bonus) || 0;
  const unit = rest ? "мин." : "Раундов";
  let cur = Number(actor.system?.conditions?.suffocatingRounds) || 0;
  if (!actor.getFlag?.(NS, SUFFOCATION_FLAG)?.phase && cur <= 0) {
    cur = suffocationHoldUnits(tb, { rest });
    lines.push(`<div class="roll-threshold">${SUFF_ICON()}Удушье: задерживает дыхание — запас <b>${cur}</b> ${unit} (${rest ? "T.b в покое" : "T.b×2 в активности"})</div>`);
  }
  const t = await rollConditionCharTest(actor, "t");
  if (!t.success) await addFatigue(actor, 1);
  const testText = `${charTestText("T+0", t)} ${t.success ? `<span class="roll-success">успех</span>` : `<span class="roll-failure">провал → 😓 Усталость +1</span>`}`;
  const next = cur - 1;
  if (next > 0) {
    await actor.update({
      "system.conditions.suffocatingRounds": next,
      [`flags.${NS}.${SUFFOCATION_FLAG}`]: { phase: "holding" }
    });
    lines.push(`<div class="roll-threshold">${SUFF_ICON()}Удушье: ${testText} · запас <b>${cur}</b> → <b>${next}</b></div>`);
    return lines;
  }
  const left = suffocationDeathRounds(tb);
  await actor.update({
    "system.conditions.suffocatingRounds": 0,
    [`flags.${NS}.${SUFFOCATION_FLAG}`]: { phase: "unconscious", left, faintAt },
    ...conditionApplyFields("unconscious", null, actor)
  });
  lines.push(`<div class="roll-threshold">${SUFF_ICON()}Удушье: ${testText} · запас дыхания кончился — <span class="roll-failure">😵 Без сознания; без вздоха смерть через <b>${left}</b> Раундов</span></div>`);
  return lines;
}

/** Смерть от удушья: метка отсчёта снимается, смерть — общим путём. */
async function suffocationDeath(actor) {
  await actor.update({ [`flags.${NS}.-=${SUFFOCATION_FLAG}`]: null });
  await killByCondition(actor, "suffocating");
  return `<div class="roll-threshold">${SUFF_ICON()}Удушье: <span class="roll-failure"><b>СМЕРТЬ</b> от удушья</span></div>`;
}

/** Начало Хода в активном режиме: задержка или отсчёт смерти без сознания. */
async function stepSuffocationTurn(actor) {
  const st = actor.getFlag?.(NS, SUFFOCATION_FLAG);
  if (st?.phase !== "unconscious") return stepSuffocationHold(actor);
  const left = (Number(st.left) || 0) - 1;
  if (left <= 0) return [await suffocationDeath(actor)];
  await actor.update({ [`flags.${NS}.${SUFFOCATION_FLAG}`]: { ...st, left } });
  return [`<div class="roll-threshold">${SUFF_ICON()}Удушье: без сознания — до смерти от удушья <b>${left}</b> Раундов</div>`];
}

/**
 * Режим «в покое» — обработчик минут игрового времени (combat/condition-clock.mjs,
 * sweepConditionClock): тест T+0 каждую полную минуту с последней засчитанной,
 * запас в минутах; без сознания — смерть, когда с потери сознания прошло
 * T.b Раундов (по 5 секунд).
 */
export async function suffocationRestClock(actor, { from, to } = {}) {
  const conds = actor?.system?.conditions;
  if (!conds?.suffocating || !actor.getFlag?.(NS, SUFFOCATION_REST_FLAG)) return;
  const now = Number(to) || 0;
  let at = Number(actor.getFlag(NS, SUFFOCATION_CLOCK_FLAG)) || clockStart(from, now);
  const lines = [];
  for (;;) {
    const st = actor.getFlag(NS, SUFFOCATION_FLAG);
    if (st?.phase === "unconscious") {
      const since = Number(st.faintAt ?? at) || at;
      if (now >= since + (Number(st.left) || 1) * SECONDS_PER_ROUND) {
        lines.push(await suffocationDeath(actor));
        await actor.update({ [`flags.${NS}.-=${SUFFOCATION_CLOCK_FLAG}`]: null });
        return postConditionCard(actor, lines);
      }
      break;
    }
    if (now - at < 60) break;
    at += 60;
    lines.push(...await stepSuffocationHold(actor, { rest: true, faintAt: at }));
  }
  await actor.update({ [`flags.${NS}.${SUFFOCATION_CLOCK_FLAG}`]: at });
  await postConditionCard(actor, lines);
}

/**
 * Переключить режим Удушья (покой ↔ активность). Уже идущая задержка
 * пересчитывается той же ДОЛЕЙ запаса в единицах нового режима (половина
 * T.b×2 Раундов = половина T.b минут) — иначе смена режима давала бы полный
 * запас заново. Счёт минут покоя начинается с момента переключения.
 */
export async function setSuffocationRestMode(actor, rest) {
  const conds = actor?.system?.conditions ?? {};
  const tb = Number(actor?.system?.characteristics?.t?.bonus) || 0;
  const upd = rest
    ? { [`flags.${NS}.${SUFFOCATION_REST_FLAG}`]: true, [`flags.${NS}.${SUFFOCATION_CLOCK_FLAG}`]: Number(globalThis.game?.time?.worldTime) || 0 }
    : { [`flags.${NS}.-=${SUFFOCATION_REST_FLAG}`]: null, [`flags.${NS}.-=${SUFFOCATION_CLOCK_FLAG}`]: null };
  const cur = Number(conds.suffocatingRounds) || 0;
  const wasRest = !!actor.getFlag?.(NS, SUFFOCATION_REST_FLAG);
  if (conds.suffocating && cur > 0 && wasRest !== !!rest
      && actor.getFlag?.(NS, SUFFOCATION_FLAG)?.phase !== "unconscious") {
    const fromMax = suffocationHoldUnits(tb, { rest: wasRest });
    const toMax   = suffocationHoldUnits(tb, { rest: !!rest });
    upd["system.conditions.suffocatingRounds"] = Math.max(1, Math.ceil(cur / fromMax * toMax));
  }
  await actor.update(upd);
}

/** Кнопка листа: переключить режим и сказать в чат, какой стал. */
export async function toggleSuffocationMode(actor) {
  if (!actor?.system?.conditions?.suffocating) {
    ui.notifications?.warn?.(`${actor?.name ?? ""}: не Задыхается.`);
    return;
  }
  const rest = !actor.getFlag?.(NS, SUFFOCATION_REST_FLAG);
  await setSuffocationRestMode(actor, rest);
  await postConditionCard(actor, [`<div class="roll-threshold">${SUFF_ICON()}Удушье: режим — <b>${rest
    ? "в покое</b> (запас T.b минут, тест T+0 раз в минуту игрового времени)"
    : "активный</b> (запас T.b×2 Раундов, тест T+0 каждый Ход)"}. Запас: <b>${Number(actor.system.conditions.suffocatingRounds) || 0}</b></div>`]);
}

// ── Горение: формула урона источника (wdbc-x1nz.2.93) ─────────────────────
// «В конце каждого своего Хода Горящий персонаж получает 1d10 (некоторые
// источники пламени наносят больше урона)». burningSourceDamage — это
// ВЫПАВШЕЕ число поджигания (его сравнивает с порогом ≤10 окно Cooler и
// обнуляет при выдаче окна), а не формула: для повторного броска каждый Ход
// оно не годится. Формулу источника (рейтинг Огня, напр. Flame (2d10)) несёт
// отдельная метка актора — её ставит поджигание (setBurningDamageFormula),
// гасит тушение и крит «Загорается» (там книга даёт обычный 1d10).
export const BURNING_FORMULA_FLAG = "burningDamageFormula";
const BURNING_DEFAULT_FORMULA = "1d10";

/** Формула тика Горения: формула источника, если она есть и бросается, иначе книжный 1d10. */
export function burningTickFormula(actor) {
  const f = String(actor?.getFlag?.(NS, BURNING_FORMULA_FLAG) ?? "").trim();
  if (!f) return BURNING_DEFAULT_FORMULA;
  const validate = globalThis.Roll?.validate;
  if (typeof validate === "function" && !validate.call(globalThis.Roll, f)) return BURNING_DEFAULT_FORMULA;
  return f;
}

/** Запомнить формулу урона источника пламени (пусто/1d10 — снять метку). */
export async function setBurningDamageFormula(actor, formula) {
  const f = String(formula ?? "").trim();
  if (!f || f === BURNING_DEFAULT_FORMULA) {
    if (actor?.getFlag?.(NS, BURNING_FORMULA_FLAG)) await actor.update({ [`flags.${NS}.-=${BURNING_FORMULA_FLAG}`]: null });
    return;
  }
  await actor.update({ [`flags.${NS}.${BURNING_FORMULA_FLAG}`]: f });
}

/**
 * Строка «срок вышел» для карточки — общая с подметанием по мировому времени
 * (hooks.mjs), чтобы истечение вне боя не проходило молча: тихо исчезнувшее
 * Состояние ГМ считает багом, а не сроком.
 */
export function conditionExpiryLine(key) {
  return `<div class="roll-threshold">${CONDITIONS_DEF[key]?.label || key}: срок вышел — снято</div>`;
}

/** Карточка Состояний в чат — экспортирована ради того же подметания по времени. */
export async function postConditionCard(actor, lines) {
  if (!lines.length) return;
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("warn", "#8fd0ff")}Состояния — ${esc(actor.name)}</div>
      ${lines.join("")}
    </div>`
  }, game.settings.get("core", "rollMode")));
}

/**
 * Броня Огненного Дракона (wdbc-q0q8, ARMOR_PROPERTIES.fireproof) — точечное
 * исключение из «Горение игнорирует броню целиком»: собственное AP тела
 * ИМЕННО ЭТОГО предмета (не суммарное AP актора со всех надетых сразу —
 * книга говорит «их AP», не «броня персонажа»), удвоенное. Несколько таких
 * предметов разом — маловероятно, берём максимум, не сумму.
 */
function fireproofBurningApBonus(actor) {
  let best = 0;
  for (const item of actor?.items ?? []) {
    if (item.type !== "armor" || !item.system?.equipped) continue;
    const fireproof = resolveArmorProps(item).some(p => p.def.auto?.apVsBurningBody);
    if (fireproof) best = Math.max(best, (Number(item.system.body) || 0) * 2);
  }
  return best;
}

// Горение (wdbc-3pv5, Cooler/Охладитель + Морозное Сердце, «даёт улучшение
// Cooler, пока активен»): книжный порог «пламя, которым объят персонаж,
// наносит не больше 1d10 урона» — 10, не повторный бросок 1d10 (это разбор
// РЕЙТИНГА свойства/удара, уже посчитанного в момент поджигания, а не гонка
// с новым кубом).
const BURNING_GRACE_DAMAGE_THRESHOLD = 10;

/**
 * Даёт (если ещё не выдано и порог пройден) или продлевает чтение окна
 * «игнорировать все негативные эффекты Горения 1d5 Ходов» — Cooler/Морозное
 * Сердце (kind:"burningGrace", combat/damage.mjs::hasBurningGraceCapability).
 * ЖИВОЙ ЗАПРОС и АВТОМАТИКА разом: без кнопки и без риска отказаться зря —
 * у способности нет цены и нет исхода «хуже, чем не пробовать» (в отличие от
 * броска щита rollShieldAgainstConditionTick выше, где неудача возможна),
 * поэтому спрашивать игрока нечего, включаем сами (wdbc-3pv5, решение по
 * итогам обсуждения — реальный wdbc-5knb тоже автоматика, не кнопка).
 *
 * Идемпотентна в пределах уже открытого окна: если burningGraceRounds уже
 * >0 (выдано на этом же или предыдущем Ходу), просто возвращает текущий
 * остаток без нового броска — вызывается и из processConditionTurnStart
 * (Паника), и из processConditionTurnEnd (тик), оба должны видеть одно и то
 * же окно одного и того же пожара.
 *
 * Выдача ОДНОРАЗОВА на одно загорание: burningSourceDamage обнуляется в
 * момент выдачи (roll.total записан в burningGraceRounds) — иначе счётчик
 * ходов кончался бы, а на следующем же Ходу тут же выдавался заново на то
 * же самое (ещё не остывшее) значение urона поджигания. Новое загорание
 * (свежий Flame-удар/крит, пока горит) перезапишет burningSourceDamage
 * заново — второе окно за бой возможно, просто не за счёт СТАРОГО числа.
 *
 * sourceName (wdbc-lm83) — имя предмета, реально дающего способность СЕЙЧАS
 * (Cooler/Охладитель ИЛИ Frozen Heart/Морозное Сердце, кто на акторе есть),
 * а не жёстко «Cooler»: заметка в чате раньше звала окно Cooler даже когда
 * сработал только Frozen Heart без Cooler на акторе. Ищется заново на каждом
 * вызове, в том числе когда окно уже открыто (current > 0) — предмет мог
 * смениться (снят один, надет другой) с прошлого Хода; пустая строка, если
 * сейчас на акторе ни одного нет вовсе (окно всё равно продолжает тикать —
 * решение «убрать предмет не гасит уже открытое окно» не пересматривается
 * здесь, только подпись).
 */
export async function ensureBurningGrace(actor) {
  const conds = actor?.system?.conditions;
  if (!conds) return { rounds: 0, roll: null, sourceName: "" };
  const sourceItem = burningGraceSourceItem(actor);
  const sourceName = sourceItem?.name || "";
  const current = Number(conds.burningGraceRounds) || 0;
  if (current > 0) return { rounds: current, roll: null, sourceName };
  if (!sourceItem) return { rounds: 0, roll: null, sourceName };
  const srcDmg = Number(conds.burningSourceDamage) || 0;
  if (srcDmg <= 0 || srcDmg > BURNING_GRACE_DAMAGE_THRESHOLD) return { rounds: 0, roll: null, sourceName };
  const roll = await new Roll("1d5").evaluate();
  await actor.update({
    "system.conditions.burningGraceRounds": roll.total,
    "system.conditions.burningSourceDamage": 0
  });
  return { rounds: roll.total, roll, sourceName };
}

/**
 * Тест Паники от Горения (W+0, тест Морали) — в начале Хода Горящего
 * персонажа. Провал: персонаж проводит Ход, паникуя и воя — обнуляем ОД
 * (тот же принцип, что «Подавленный в укрытии» — action-economy.mjs), Реакции
 * не трогаем (Уклонение/Парирование — не действия ЕГО хода).
 */
export async function rollBurningPanicTest(actor) {
  const wp = actor.system.characteristics.wp?.total ?? 0;
  const { eff, parts, roll, rv, rerollNote, success, dof, usedReroll } = await rollMoraleTest(actor, wp);
  if (!success) await actor.update({ "system.actionPoints.value": 0 });
  await applyLordOfExoditesFailPenalty(actor, { dof, usedReroll });

  await postTestCard(actor, {
    icon: rollIcon("fire","#ff8a3a"), title: `Паника от Горения — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "WP", base: wp, parts, threshold: eff, rv }),
    rerollNote,
    outcome: success
      ? `<span class="roll-success">Успех — держит себя в руках</span>`
      : `<span class="roll-failure">Провал — Ход потерян в панике (ОД обнулены)</span>`
  }, { rolls: [roll] });
  return { success, rv, eff };
}

/**
 * Начало Хода актора: Паника от Горения (если Горит), декремент счётчиков
 * длительности, снятие состояния на нуле. Зовётся из hooks.mjs::updateCombat
 * рядом с resetActionEconomy (после него — панике нужно обнулить уже
 * восстановленные ОД, а не значение до сброса).
 */
export async function processConditionTurnStart(actor) {
  const conds = actor?.system?.conditions;
  if (!conds) return;
  const updates = {};
  const lines = [];
  if (conds.burning) {
    // Cooler/Морозное Сердце (wdbc-3pv5): окно «игнорировать ВСЕ негативные
    // эффекты Горения» гасит и эту Панику, не только тик урона ниже —
    // книга не разделяет «эффекты» на подвиды.
    const { rounds, roll, sourceName } = await ensureBurningGrace(actor);
    if (rounds > 0) {
      // wdbc-lm83: имя сработавшего предмета, не жёстко «Cooler» — Frozen
      // Heart без Cooler на акторе даёт то же окно.
      lines.push(`<div class="roll-threshold">${rollIcon("fire","#8fd0ff")}${esc(sourceName || "Охлаждение")}: Паника от Горения пропущена (осталось Ходов: <b>${rounds}</b>${roll ? `, выдано 1d5 = <b>${roll.total}</b>` : ""})</div>`);
    } else {
      await rollBurningPanicTest(actor);
    }
  }
  // Выход из Шока (стр. 53) — по кнопке, не автоматически (тот же приём, что
  // напоминание Подавления в конце Хода — suppression.mjs).
  if (conds.shocked) await postShockRecoveryPrompt(actor);

  // Сроки, заданные штатной Duration, истекают сами — здесь только подмести
  // истёкшие и освежить видимый остаток. Гашение самого Состояния делает мост
  // «лист ↔ токен» (см. condition-effects.mjs), поэтому строк «снято» ниже мы
  // не дублируем — только называем, что кончилось.
  const swept = await sweepConditionDurations(actor, { round: game.combat?.round, turn: game.combat?.turn });
  for (const key of swept.expired) lines.push(conditionExpiryLine(key));

  for (const { key, field, label } of ROUND_CONDITIONS) {
    // Удушье (стр. 30-31, wdbc-r5o7.6, wdbc-x1nz.2.94) — особый случай, не
    // общий приём этого цикла: у Оглушения/Ослепления «0 = снято» верно
    // (эффект кончился), а у Удушья 0 значит ровно противоположное — «запас
    // задержки дыхания кончился, персонаж теряет сознание», сам тег
    // «Задыхается» на нуле сниматься не должен (см. отдельный блок ниже).
    if (key === "suffocating") continue;
    if (!conds[key]) continue;
    // Срок ведёт Duration — свой декремент этому Состоянию не нужен и был бы
    // двойным: остаток уже пересчитан подметанием выше.
    if (hasConditionDuration(actor, key)) continue;
    const cur = Number(conds[field]) || 0;
    if (cur <= 0) continue;
    const next = cur - 1;
    Object.assign(updates, conditionAdjustFields(actor, key, -1));
    lines.push(next <= 0
      ? `<div class="roll-threshold">${label}: <b>${cur}</b> → снято</div>`
      : `<div class="roll-threshold">${label}: <b>${cur}</b> → <b>${next}</b></div>`);

    // Blessed Fits/Благословенные Припадки (Общие Мутации, wdbc-1rno):
    // Оглушение от переброшенного провала (hooks.mjs::btnReroll) естественно
    // дошло до 0 — «провёл полный Раунд в Оглушении», возвращаем списанное
    // Очко Бесчестия. Снятое ДОСРОЧНО каким-то другим путём сюда не попадёт
    // вовсе (условие этого декремента не наступает раньше срока) — метка
    // просто останется висеть без последствий, что и есть книжное «если».
    if (key === "stunned" && blessedFitsRefundDue(actor.getFlag("warhammer-dbc", BLESSED_FITS_PENDING_FLAG), next)) {
      await changeActorInfamy(actor, 1);
      updates[`flags.warhammer-dbc.-=${BLESSED_FITS_PENDING_FLAG}`] = null;
      lines.push(`<div class="roll-threshold">🥴 Благословенные Припадки: полный Раунд в Оглушении — Очко Бесчестия вернулось.</div>`);
    }

    // Parasite/Паразит (Трейт, wdbc-ux8a): контакт дотикал до 0 — заражение
    // завершено, completeInfection сама пишет свои update/флаги/карточку
    // (маршрутизация Опарыш-Паразит vs общий фьюжн). Накопленный здесь
    // updates.parasiticContact=false всё равно применится следом — не мешает.
    if (key === "parasiticContact" && next <= 0) await completeInfection(actor);
  }

  // Временно бесполезная рука/нога (крит «бесполезна на 1d10 Раундов»,
  // wdbc-x1nz.2.99) — у каждой конечности свой счётчик в system.uselessLimbs.
  const uselessTick = uselessRoundTick(actor.system);
  Object.assign(updates, uselessTick.patch);
  for (const t of uselessTick.ticks) {
    lines.push(t.to <= 0
      ? `<div class="roll-threshold">Бесполезна (${SIDE_LABELS[t.side]}): <b>${t.from}</b> → снято</div>`
      : `<div class="roll-threshold">Бесполезна (${SIDE_LABELS[t.side]}): <b>${t.from}</b> → <b>${t.to}</b></div>`);
  }

  // Удушье (книга, «Удушье», wdbc-x1nz.2.94): ВО ВРЕМЯ задержки — тест T+0
  // каждый Ход (провал +1 Усталости), запас suffocatingRounds тает на 1; не
  // вздохнул за отведённое время (запас кончился) — Без сознания; без
  // сознания — смерть через T.b Раундов. Тег «Задыхается» на нуле запаса НЕ
  // гасится общим циклом выше (там 0 = «эффект кончился»), поэтому своя ветка.
  // Режим «в покое» (T.b минут, тест раз в минуту) ведут часы игрового
  // времени — suffocationRestClock ниже; Ходы его не трогают.
  const suffState = actor.getFlag?.(NS, SUFFOCATION_FLAG);
  if (conds.suffocating && !actor.getFlag?.(NS, SUFFOCATION_REST_FLAG)) {
    lines.push(...await stepSuffocationTurn(actor));
  } else if (!conds.suffocating && suffState) {
    // Вздохнул (тег снят) — отсчёт окончен. Без сознания книга после вздоха не
    // снимает сама — остаётся на решение ГМа.
    await actor.update({ [`flags.${NS}.-=${SUFFOCATION_FLAG}`]: null });
    if (suffState.phase === "unconscious") {
      lines.push(`<div class="roll-threshold">${rollIcon("run","#8fb0c4")}Удушье снято — вздохнул, смерть от удушья отменена (Без сознания снимает ГМ)</div>`);
    }
  }

  if (!Object.keys(updates).length && !lines.length) return;
  if (Object.keys(updates).length) await actor.update(updates);
  await postConditionCard(actor, lines);
}

/**
 * Конец Хода актора: Кровотечение (1d10 − Обескровливание: 1-5 → +1
 * Обескровливания, ≤0 → смерть независимо от Ран — стр. «Раны и Урон»,
 * «Кровотечение»), предел Обескровливания (тест W+0 раз в 12 Ходов) и
 * Горение (1d10 E(Fl) или формула источника, игнорирует AP брони, T.b всё же
 * поглощает — «получает урон, игнорирующего броню»; полностью поглощённый
 * T.b урон даёт тест T+0 вместо Усталости). Смерть от Кровотечения —
 * killByCondition (combat/condition-death.mjs, wdbc-x1nz.2.92). Остановить
 * Кровотечение — режим Лечения (sheets/tabs/healing.mjs), потушить Горение —
 * combat/extinguish.mjs.
 */
export async function processConditionTurnEnd(actor) {
  const conds = actor?.system?.conditions;
  if (!conds) return;
  const lines = [];

  // Саркофаг Дредноута (стр. 57): иммунитет к Кровотечению — тело пилота
  // физически неспособно истечь кровью, поэтому сама проверка (и риск
  // случайной смерти на плохом броске) не имеет смысла, а не просто смягчена.
  const immuneBleeding = hasRuleFlag(actor, "sarcophagus.immuneBleedingFatigue");
  if (conds.bleeding && immuneBleeding) {
    lines.push(`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Кровотечение: иммунитет саркофага — урон не применяется</div>`);
  } else if (conds.bleeding) {
    const roll = await new Roll("1d10").evaluate();
    const level = Number(conds.haemorrhagingLevel) || 0;
    const eff = roll.total - level;
    if (eff <= 0) {
      lines.push(`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Кровотечение: 1d10 <b>${roll.total}</b> − Обескровливание ${level} = <b>${eff}</b> → <span class="roll-failure"><b>СМЕРТЬ</b> (независимо от количества Ран)</span></div>`);
      await killByCondition(actor, "bleeding");
    } else if (eff <= 5) {
      const newLevel = level + 1;
      const upd = conditionAdjustFields(actor, "haemorrhaging", 1);
      // Отсчёт «−1 Обескровливания в час» (haemorrhageHourly) — с момента,
      // когда уровень стал ненулевым, а не с первой прокрутки Календаря.
      if (level <= 0 && Object.keys(upd).length) {
        upd[`flags.${NS}.${HAEMORRHAGE_HOUR_FLAG}`] = Number(globalThis.game?.time?.worldTime) || 0;
      }
      await actor.update(upd);
      lines.push(`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Кровотечение: 1d10 <b>${roll.total}</b> − ${level} = <b>${eff}</b> → +1 Обескровливание (<b>${newLevel}</b>)</div>`);
    } else {
      lines.push(`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Кровотечение: 1d10 <b>${roll.total}</b> − ${level} = <b>${eff}</b> → обошлось</div>`);
    }
  }

  // Предел Обескровливания — и без Кровотечения: уровень остаётся после
  // остановки, пока не сойдёт по часу.
  if (!actor.getFlag?.(NS, "deceased")) await processHaemorrhageLimit(actor, lines);

  // Саркофаг Дредноута (стр. 57): электрошок в конце Хода снимает Оглушение
  // целиком (не декремент stunnedRounds, как в processConditionTurnStart) —
  // кроме Галлюцинаций: если Оглушение вызвано ими (conds.hallucinogenic),
  // электрошок по мозгу их не лечит.
  if (conds.stunned && !conds.hallucinogenic && hasRuleFlag(actor, "sarcophagus.autoWakeFromStun")) {
    await actor.update(conditionRemoveFields("stunned"));
    lines.push(`<div class="roll-threshold">${rollIcon("bolt", "#8fd0ff")}Электрошок саркофага снял Оглушение</div>`);
  }

  // Морозное Сердце (wdbc-5knb): щит с kind:"shieldVsCondition" на "burning"
  // можно бросить ПРОТИВ этого тика ДО того, как считать урон, — при успехе
  // Горение снимается целиком (rollShieldAgainstConditionTick сам обновляет
  // actor и постит свою карточку), и обычный тик 1d10 ниже не считается
  // вовсе. damageSubtype:"flame" даёт сработать override рейтинга
  // (kind:"shieldSubtype") того же щита — 1-75 против E(Fl), как и при
  // обычном попадании.
  const burningExtinguishedByShield = conds.burning
    && await rollShieldAgainstConditionTick(actor, "burning", { damageSubtype: "flame" });

  // Cooler/Морозное Сердце (wdbc-3pv5): окно из processConditionTurnStart
  // (или выданное только что, если загорелся уже ПОСЛЕ своего начала Хода —
  // ensureBurningGrace идемпотентна) гасит и сам тик. Расходуем ровно один
  // Ход окна здесь — processConditionTurnStart его не трогает, только читает.
  let burningGraceActive = false;
  if (conds.burning && !burningExtinguishedByShield) {
    const { rounds, roll: graceRoll, sourceName } = await ensureBurningGrace(actor);
    if (rounds > 0) {
      burningGraceActive = true;
      const next = rounds - 1;
      await actor.update({ "system.conditions.burningGraceRounds": next });
      // wdbc-lm83: имя сработавшего предмета, не жёстко «Cooler».
      lines.push(`<div class="roll-threshold">${rollIcon("fire","#8fd0ff")}${esc(sourceName || "Охлаждение")}: тик Горения пропущен${graceRoll ? ` (выдано 1d5 = <b>${graceRoll.total}</b>)` : ""} — осталось Ходов: <b>${next}</b></div>`);
    }
  }

  if (conds.burning && !burningExtinguishedByShield && !burningGraceActive) {
    // «некоторые источники пламени наносят больше урона» (wdbc-x1nz.2.93) —
    // формула источника, если поджигание её запомнило. Окно Cooler этим не
    // задето: оно сравнивает с порогом burningSourceDamage (урон поджигания),
    // а не формулу тика.
    const formula = burningTickFormula(actor);
    const roll = await new Roll(formula).evaluate();
    const tb = Number(actor.system?.characteristics?.t?.bonus) || 0;
    const fireAp = fireproofBurningApBonus(actor);
    const net = Math.max(0, roll.total - tb - fireAp);
    if (net > 0) {
      const { currentWounds, newWounds, newCritical, maxWounds, gotCritical } = await applyWoundLoss(actor, net);
      await addFatigue(actor, 1);
      const destroyed = gotCritical && newCritical >= woundDeathThreshold(maxWounds);
      lines.push(`<div class="roll-threshold">${rollIcon("fire", "#ff8a3a")}Горение: ${esc(formula)} <b>${roll.total}</b> − T.b ${tb}${fireAp ? ` − AP(×2) ${fireAp}` : ""} = <b>${net}</b> урона E(Fl)${fireAp ? "" : ", игнор брони"}. Раны: ${currentWounds} → ${newWounds}${gotCritical ? ` (крит. <b>${newCritical}</b>)` : ""} · 😓 Усталость +1${destroyed ? ` — <b>уничтожен</b>` : ""}</div>`);
      // Непоглощённый урон будит лишившегося сознания от Обескровливания.
      if (await releaseUnconsciousCause(actor, HAEMORRHAGE_FAINT_FLAG)) {
        lines.push(`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Обескровливание: непоглощённый урон приводит в чувство</div>`);
      }
    } else {
      const t = await rollConditionCharTest(actor, "t");
      if (!t.success) await addFatigue(actor, 1);
      lines.push(`<div class="roll-threshold">${rollIcon("fire", "#ff8a3a")}Горение: ${esc(formula)} <b>${roll.total}</b> целиком в T.b${fireAp ? ` + AP(×2) ${fireAp}` : ""} — ${charTestText("T+0", t)} ${t.success ? `<span class="roll-success">успех</span>` : `<span class="roll-failure">провал → 😓 Усталость +1</span>`}</div>`);
    }
  }
  // Погасшее Горение не должно отдать свою формулу следующему пожару.
  if (!conds.burning && actor.getFlag?.(NS, BURNING_FORMULA_FLAG)) {
    await actor.update({ [`flags.${NS}.-=${BURNING_FORMULA_FLAG}`]: null });
  }

  // Радиация (стр. 30-31, wdbc-r5o7.6): «периодический 1 урон в T» — фикс,
  // не бросок, в отличие от Горения выше; «при накоплении 10/20/30... — тест
  // T+0, провал даёт лучевую болезнь» — доза (radiationLevel) растёт на 1 с
  // тем же тиком, что и сам урон (книга не разводит «урон» и «дозу» по
  // разным источникам, второе — просто счётчик первого). Урон — в T
  // (system.charDamage.t, тот же ручной знаковый Мод., что у Гангрены,
  // combat/gangrene.mjs), НЕ Раны: книга прямо говорит «урон в T». Лучевая
  // болезнь — не своё Состояние из CONDITIONS_DEF (в книге это осложнение
  // Радиации, не отдельный тег листа), а флаг актора с собственным
  // worldTime-тиком раз в 8 часов, combat/radiation.mjs.
  if (conds.radiation) {
    const level  = Number(conds.radiationLevel) || 0;
    const newLevel = level + 1;
    // Единый конвейер урона в Характеристики (wdbc-x1nz.2.83).
    const { before, after } = await applyCharDamage(actor, "t", 1, { extra: conditionAdjustFields(actor, "radiation", 1) });
    let sicknessNote = "";
    if (newLevel % 10 === 0) {
      // Тот же тест T+0 с модификаторами персонажа, что у Горения/Удушья выше.
      const t = await rollConditionCharTest(actor, "t");
      const failed = !t.success;
      if (failed) await actor.setFlag("warhammer-dbc", "radiationSickness", true);
      sicknessNote = ` · Доза ${newLevel} — ${charTestText("T+0", t)} ${failed
        ? `<span class="roll-failure">провал → лучевая болезнь</span>`
        : `<span class="roll-success">успех</span>`}`;
    }
    lines.push(`<div class="roll-threshold">${rollIcon("warp", "#ffe14d")}Радиация: урон в T <b>1</b> (T ${before}→${after})${sicknessNote}</div>`);
  }

  if (lines.length) await postConditionCard(actor, lines);
}
