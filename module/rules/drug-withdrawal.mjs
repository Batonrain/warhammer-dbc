// module/rules/drug-withdrawal.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Зависимость от наркотика: частота приёма, штраф без дозы, срыв (корбук,
//  «Наркотики: Зависимость», поля 2-4; wdbc-gyqf2). Чистая арифметика, без
//  Foundry; Foundry-обвязка — combat/drug-withdrawal.mjs (часы Календаря) и
//  sheets/tabs/drugs.mjs (бросок).
//
//  Что говорит книга:
//   • поле 2 — «Тест Зависимости. Обычно T или W, или комбинированный тест
//     обоих» (стр. 25: бросок один, против НАИМЕНЬШЕГО из Пределов);
//   • поле 3 — «Частота приема. Через какой максимальный период персонаж должен
//     принимать наркотик, чтобы удовлетворить свою зависимость»;
//   • поле 4 — «Эффект зависимости. Штраф, накладываемый на персонажа, если он
//     не удовлетворял свою зависимость. За каждый период частоты приема, что
//     персонаж провел под действием штрафа, он может пройти Тест Зависимости
//     со штрафом –50 и бонусом +10 за каждый предыдущий последовательный период,
//     проведенный под штрафом. Если он проходит этот тест, он избавляется от
//     зависимости. Иммунитет к ядам не дает иммунитета к эффектам зависимости».
//
//  Как это прочитано (книга точного момента не называет — см. отчёт wdbc-gyqf2):
//   • отсчёт идёт от последней дозы; прошла частота без новой дозы — штраф
//     включился (это начало 1-го периода под штрафом);
//   • тест на срыв открывается, когда период под штрафом ЗАКОНЧИЛСЯ, и один раз
//     на период; k-й закончившийся период даёт –50 + 10·(k−1);
//   • «в начале каждого периода частоты приема» (Тиск, Сатрофин) — в начале
//     каждого периода под штрафом, то есть на каждой границе last + j·частота;
//   • новая доза — зависимость удовлетворена: штраф снят, счёт периодов с нуля.
//
//  Состояние — флаг АКТОРА flags.warhammer-dbc.drugWithdrawal: { <название
//  препарата>: { lastDose, doneTo, tested } } (worldTime, секунды). Ключ — то же
//  название, что у недельного журнала доз (rules/drug-doses.mjs::doseKey):
//  стопки одного наркотика считаются вместе. Не поле схемы предмета: предмет
//  может кончиться и быть удалён, а зависимость остаётся.
//
//  ЛИСТ: файл импортируется из sources.mjs (правила штрафа), поэтому он не должен
//  тянуть ничего, что ведёт обратно к реестру источников (AGENTS.md, wdbc-795h):
//  только константы календаря.
// ════════════════════════════════════════════════════════════════════════════

import { SECONDS_PER_HOUR, SECONDS_PER_DAY, formatDuration } from "../constants/imperial-calendar.mjs";

const NS = "warhammer-dbc";
export const WITHDRAWAL_FLAG = "drugWithdrawal";
/** Штраф теста на срыв за первый период под штрафом. */
export const BREAK_BASE = -50;
/** Бонус за каждый предыдущий последовательный период. */
export const BREAK_STEP = 10;
/** Предел границ за один сдвиг Календаря — страховка, как MAX_TICKS остальных часов. */
const MAX_BOUNDARIES = 50;

/**
 * Ключ журнала: название препарата — тот же, что у rules/drug-doses.mjs::doseKey.
 * Точка в ключе флага расщепила бы путь обновления (Foundry разворачивает
 * «a.b» во вложенность), поэтому в самодельных названиях она заменяется; у
 * книжных препаратов точек в названиях нет, ключи совпадают с doseKey.
 */
export const drugKey = item => String(item?.name ?? "").trim().replace(/\./g, "·");

/** Модификатор со знаком для текста карточки: «−50», «+10». */
export const formatMod = n => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);
const signed = formatMod;

// ── Частота приёма ──────────────────────────────────────────────────────────

/**
 * «8 часов» / «8ч» / «12 ч» / «1 день» / «3 дня» / «6 дней» → секунды. Не
 * разобралось — null (периода нет, часы по этому препарату молчат). Кириллица
 * в регулярке — явным классом: \w её не знает (AGENTS.md).
 */
export function parseFrequency(text) {
  const m = String(text ?? "").trim().toLowerCase().match(/^(\d+)\s*([а-яё]+)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!(n > 0)) return null;
  const u = m[2];
  let unit = null;
  if (u === "ч" || u.startsWith("час")) unit = SECONDS_PER_HOUR;
  else if (u === "д" || u.startsWith("дн") || u.startsWith("ден") || u.startsWith("сут")) unit = SECONDS_PER_DAY;
  else if (u.startsWith("нед")) unit = 7 * SECONDS_PER_DAY;
  else if (u.startsWith("мин")) unit = 60;
  return unit ? n * unit : null;
}

// ── Тест Зависимости: одна или две характеристики ───────────────────────────

/**
 * Слагаемые теста Зависимости: [{ charKey, mod }], одно или два (комбинированный
 * тест — поле testChar2 непусто).
 */
export function addictionTestParts(add) {
  const parts = [{ charKey: String(add?.testChar || "t").toLowerCase(), mod: Number(add?.testMod) || 0 }];
  const second = String(add?.testChar2 ?? "").trim().toLowerCase();
  if (second) parts.push({ charKey: second, mod: Number(add?.testMod2) || 0 });
  return parts;
}

/** Индекс слагаемого с наименьшим Пределом (комбинированный тест); при равенстве — первое. */
export function lowestPart(parts) {
  let best = 0;
  for (let i = 1; i < parts.length; i++) if ((Number(parts[i].eff) || 0) < (Number(parts[best].eff) || 0)) best = i;
  return best;
}

// ── Периоды без дозы ────────────────────────────────────────────────────────

/**
 * 0 — доза в срок; k ≥ 1 — идёт k-й период под штрафом. Нет метки дозы или
 * периода — 0 (штрафа задним числом нет, как у Зависимости-Мутации).
 */
export function withdrawalPeriodIndex(lastDose, periodSec, now) {
  if (lastDose == null || !(Number(periodSec) > 0)) return 0;
  return Math.max(0, Math.floor((Number(now) - Number(lastDose)) / Number(periodSec)));
}

export const isUnderPenalty = (entry, periodSec, now) =>
  withdrawalPeriodIndex(entry?.lastDose, periodSec, now) >= 1;

/** Сколько периодов под штрафом уже ЗАКОНЧИЛОСЬ. */
export const completedPeriods = (entry, periodSec, now) =>
  Math.max(0, withdrawalPeriodIndex(entry?.lastDose, periodSec, now) - 1);

/** Модификатор теста на срыв после `completed` закончившихся периодов (+ доп. модификатор препарата). */
export function breakTestMod(completed, extra = 0) {
  return BREAK_BASE + BREAK_STEP * (Math.max(1, Number(completed) || 1) - 1) + (Number(extra) || 0);
}

/** Можно ли сейчас пройти тест на срыв: период закончился и за него ещё не пробовали. */
export function breakTestState(entry, periodSec, now) {
  const completed = completedPeriods(entry, periodSec, now);
  const tested = Number(entry?.tested) || 0;
  return { completed, tested, available: completed >= 1 && completed > tested };
}

/**
 * Границы периодов в отрезке (from, to]: last + j·период, j ≥ 1. Каждая — это
 * «начало очередного периода под штрафом» (j = 1 — штраф включился).
 * @returns {{index:number, at:number}[]}
 */
export function periodBoundaries(entry, periodSec, from, to) {
  const last = entry?.lastDose;
  const P = Number(periodSec);
  if (last == null || !(P > 0) || !(Number(to) > Number(from))) return [];
  const out = [];
  let j = Math.max(1, Math.floor((Number(from) - Number(last)) / P) + 1);
  for (let i = 0; i < MAX_BOUNDARIES; i++, j++) {
    const at = Number(last) + j * P;
    if (at > Number(to)) break;
    if (at > Number(from)) out.push({ index: j, at });
  }
  return out;
}

/** Новая запись состояния: доза принята в момент `now`. */
export const freshEntry = now => ({ lastDose: Number(now) || 0, doneTo: Number(now) || 0, tested: 0 });

/** Строка статуса для панели ЗАВИСИМОСТИ. Пусто — состояния нет (часы ещё не начали отсчёт). */
export function withdrawalStatusLabel(entry, periodSec, now, extra = 0) {
  if (entry?.lastDose == null || !(Number(periodSec) > 0)) return "";
  const idx = withdrawalPeriodIndex(entry.lastDose, periodSec, now);
  if (idx === 0) return `до штрафа: ${formatDuration(Number(entry.lastDose) + Number(periodSec) - Number(now))}`;
  const st = breakTestState(entry, periodSec, now);
  if (st.available) return `штраф идёт (${idx}-й период); тест на срыв открыт: ${signed(breakTestMod(st.completed, extra))}`;
  const next = Number(entry.lastDose) + (st.completed + 2) * Number(periodSec) - Number(now);
  return st.completed >= 1
    ? `штраф идёт (${idx}-й период); тест за ${st.completed}-й период уже был`
    : `штраф идёт (${idx}-й период); тест на срыв — через ${formatDuration(next)}`;
}

// ── Нотация штрафа ──────────────────────────────────────────────────────────

/**
 * Штраф зависимости как данные: «цель=значение; цель=значение», цель — область
 * правил (`all`, `social`, `basedon:s`, `skill:charm`); несколько целей одного
 * штрафа — через запятую («skill:charm,skill:command=-10»). Тот же приём, что
 * нотация blocksRecovery. Мусор не молчит: попадает в errors (его ловит тест
 * на данных паков).
 * @returns {{mods: {target: string|string[], value: number}[], errors: string[]}}
 */
export function parsePenaltyMods(text) {
  const mods = [], errors = [];
  for (const raw of String(text ?? "").split(";")) {
    const piece = raw.trim();
    if (!piece) continue;
    const eq = piece.lastIndexOf("=");
    if (eq < 1) { errors.push(piece); continue; }
    const targets = piece.slice(0, eq).split(",").map(s => s.trim());
    const valueText = piece.slice(eq + 1).trim().replace(/[−–]/g, "-");
    if (!/^[+-]?\d+$/.test(valueText) || !targets.every(t => /^[a-z]+(:[a-z]+)?$/.test(t))) { errors.push(piece); continue; }
    mods.push({ target: targets.length === 1 ? targets[0] : targets, value: Number(valueText) });
  }
  return { mods, errors };
}

// ── Правила штрафа для конвейера (источник «drugWithdrawal», sources.mjs) ───

/** Зависимые препараты: type drug, зависимость есть и подтверждена тестом. */
export const addictedDrugs = items =>
  [...(items ?? [])].filter(i => i?.type === "drug" && i.system?.addiction?.hasAddiction && i.system?.addiction?.isAddicted);

/**
 * Автоматические модификаторы штрафа: по одному правилу на наркотик, пока доза
 * просрочена. Стопки одного наркотика дают один штраф. Действует на каждый бросок
 * (auto: true) — не галочка игрока: «зависим ли персонаж» не решает никто.
 */
export function withdrawalPenaltyRules(items, entries, now) {
  const out = [];
  const seen = new Set();
  for (const item of addictedDrugs(items)) {
    const key = drugKey(item);
    if (seen.has(key)) continue;
    const add = item.system.addiction;
    if (!isUnderPenalty(entries?.[key], parseFrequency(add.frequency), now)) continue;
    const { mods } = parsePenaltyMods(add.penaltyMods);
    if (!mods.length) continue;
    seen.add(key);
    const label = `Зависимость (${key}): без дозы`;
    out.push({
      id: `drug.withdrawal.${item.id ?? key}`, label, when: {},
      effects: mods.map(m => ({ kind: "rollBonus", target: m.target, value: m.value, label, auto: true }))
    });
  }
  return out;
}

/** Записи состояния актора: { <ключ>: { lastDose, doneTo, tested } }. */
export function readWithdrawalEntries(actor) {
  return actor?.getFlag?.(NS, WITHDRAWAL_FLAG) ?? actor?.flags?.[NS]?.[WITHDRAWAL_FLAG] ?? {};
}

/** Источник правил: штраф зависимых препаратов актора на момент `now`. */
export function withdrawalRulesOf(actor, now) {
  return withdrawalPenaltyRules(actor?.items, readWithdrawalEntries(actor), now);
}
