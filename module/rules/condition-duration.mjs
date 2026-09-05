// module/rules/condition-duration.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СРОК СОСТОЯНИЯ (wdbc-uqco) — тонкая прослойка над штатной Duration
//  ActiveEffect в Foundry v14.
//
//  До этого срок жил своим числовым полем на акторе
//  (system.conditions.stunnedRounds и два соседних) и уменьшался вручную, в
//  начале Хода, циклом в combat/condition-ticks.mjs. Тикали ровно три
//  Состояния из тех, у кого в книге срок есть, и выразить срок можно было
//  только в раундах: «Отравлен на 1 минуту» ГМ держал в голове.
//
//  ── Считает Foundry, а не мы (переписано после живой проверки, wdbc-xjce/
//     wdbc-8ij2) ───────────────────────────────────────────────────────────
//  Первая версия этого файла считала остаток срока сама, по полям
//  {rounds, startRound, seconds, startTime}. Такой формы в v14 НЕТ: схема
//  duration это {value, units, expiry, expired} (common/documents/
//  active-effect.mjs), момент начала лежит отдельно, в effect.start, и
//  проставляется ядром само при создании эффекта на акторе (_preCreate).
//  Ядро же на каждой подготовке данных считает duration.remaining (в СВОИХ
//  единицах эффекта), duration.secondsRemaining и duration.expired —
//  и для раундов по боевому трекеру, и для минут/часов по game.time.worldTime.
//
//  Поэтому здесь не осталось никакой арифметики срока: только перевод
//  «что выбрал автор» → {value, units} и чтение готового остатка обратно.
//  Единицы автора СОВПАДАЮТ с единицами Foundry (CONST.ACTIVE_EFFECT_DURATION_
//  UNITS) — переводить нечего, и это тоже сознательно: свой перевод и был
//  причиной обоих багов.
//
//  Что сюда НЕ входит и не должно: уровневые Состояния (Кровотечение,
//  Обескровливание, Горение, Радиация, потери конечностей). У них счётчик
//  означает СИЛУ, а не срок. Удушье тоже остаётся своим счётчиком, хотя
//  единица у него «раунды»: ноль у него значит «запас дыхания кончился,
//  дальше тесты», а не «срок вышел» — противоположное истёкшей Duration.
// ════════════════════════════════════════════════════════════════════════════

import { CONDITIONS } from "../constants/conditions.mjs";

/** Длина боевого Раунда в секундах — умолчание Foundry (CONFIG.time.roundTime). */
export const SECONDS_PER_ROUND = 6;

/**
 * Единицы срока, которые автор выбирает в Конструкторе. Значения — ровно те,
 * что понимает Foundry (CONST.ACTIVE_EFFECT_DURATION_UNITS): «rounds» сверяет
 * боевой трекер, остальные — game.time.worldTime, тот же счётчик, который
 * крутит виджет «Летоисчисление».
 */
export const DURATION_UNITS = [
  { key: "",        label: "без срока" },
  { key: "rounds",  label: "раундов" },
  { key: "minutes", label: "минут" },
  { key: "hours",   label: "часов" },
  { key: "days",    label: "суток" }
];

const UNIT_KEYS = new Set(DURATION_UNITS.map(u => u.key).filter(Boolean));

/** Склонение единицы для подписи: 2 раунда, 5 раундов, 1 минута. */
const WORD_FORMS = {
  rounds:  ["раунд", "раунда", "раундов"],
  turns:   ["ход", "хода", "ходов"],
  seconds: ["секунда", "секунды", "секунд"],
  minutes: ["минута", "минуты", "минут"],
  hours:   ["час", "часа", "часов"],
  days:    ["сутки", "суток", "суток"]
};

/** [один, два, пять] — обычное русское согласование числа с существительным. */
function plural(n, [one, few, many]) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1)          return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

/** «2 раунда», «1 минута», «» — если срока нет. */
export function durationLabel(value, unit) {
  const n = Math.max(0, Math.round(Number(value) || 0));
  const forms = WORD_FORMS[unit];
  if (!forms || !n) return "";
  return `${n} ${plural(n, forms)}`;
}

/**
 * Срок автора → данные duration для ActiveEffect (Foundry v14).
 *
 * Момент начала здесь НЕ проставляется: ядро само пишет effect.start при
 * создании эффекта на акторе, и подделывать его руками значило бы разойтись
 * с тем, по чему ядро потом считает остаток.
 *
 * @returns {?{value: number, units: string}} null, если срока нет — такое
 *   Состояние висит до ручного снятия, как и раньше.
 */
export function durationDataFor(value, unit) {
  const n = Math.max(0, Math.round(Number(value) || 0));
  if (!UNIT_KEYS.has(unit) || !n) return null;
  return { value: n, units: unit };
}

/**
 * Остаток срока в СОБСТВЕННЫХ единицах эффекта — как его посчитало ядро.
 * @returns {?number} null, если срока нет или он бесконечен
 */
export function remainingOf(duration) {
  const left = Number(duration?.remaining);
  return Number.isFinite(left) ? left : null;
}

/**
 * Истёк ли срок. Решаем по остатку, а не по одному флагу expired: остаток
 * ядро пересчитывает на каждой подготовке данных, а флаг проставляется
 * отдельным механизмом слежения — если он почему-то не сработал, Состояние
 * не должно повиснуть навсегда. Флаг остаётся запасным ответом там, где
 * остатка нет.
 *
 * Бессрочное НЕ истекает никогда: «висит до ручного снятия» и «истекло
 * только что» обязаны различаться, иначе подметание сняло бы всё разом.
 */
export function isDurationExpired(duration) {
  const left = remainingOf(duration);
  if (left !== null) return left <= 0;
  // value === null у Foundry значит «бессрочно», а Number(null) это 0 —
  // проверять через Number() тут нельзя, ноль прошёл бы как конечный срок.
  return !!duration?.expired && typeof duration?.value === "number" && Number.isFinite(duration.value);
}

/**
 * Остаток, приведённый к Раундам — то число, что видит игрок на месте
 * прежнего своего счётчика. Секунды переводятся ВВЕРХ (55 секунд — это ещё
 * целых 10 Раундов, а не 9): срок кончается, когда кончается, а не Раундом
 * раньше.
 *
 * @returns {?number} null, если срока у этого эффекта нет вообще
 */
export function remainingRounds(duration) {
  const left = remainingOf(duration);
  if (left === null) return null;
  if (duration.units === "rounds" || duration.units === "turns") return Math.max(0, left);
  const secs = Number(duration.secondsRemaining);
  if (!Number.isFinite(secs)) return Math.max(0, left);
  return Math.max(0, Math.ceil(secs / SECONDS_PER_ROUND));
}

/**
 * Остаток словами — для тега на листе и подсказки на токене. Показывается
 * СВОИМИ единицами, а не переведённым в Раунды: «через 40 минут» игроку
 * понятнее, чем «через 400 Раундов».
 */
export function remainingLabel(duration) {
  const left = remainingOf(duration);
  if (left === null || left <= 0) return "";
  return durationLabel(left, duration.units) || `${left}`;
}

/**
 * Срок, записанный автором в записи Конструктора kind:"condition".
 *
 * Обратная совместимость с записями, заведёнными ДО этого шага (wdbc-tl0f):
 * там поля единицы не было ВООБЩЕ, а у Состояния со счётчиком «раунды»
 * величина condLevel и БЫЛА сроком — выразить его иначе как в Раундах было
 * нечем. Признак такой записи — ОТСУТСТВИЕ ключа condDurationUnit, а не
 * пустая строка в нём (wdbc-5zu5): у новой записи ключ всегда есть и пуст,
 * и принимать это за «старую запись» значило бы тихо навешивать всем срок в
 * 1 раунд там, где автор срока не просил.
 *
 * @returns {{value: (string|number), unit: string}} unit:"" — срока нет
 */
export function conditionEntryTerm(entry) {
  if (entry?.condDurationUnit !== undefined) {
    const unit = String(entry.condDurationUnit || "");
    return { value: entry.condDurationValue ?? "1", unit };
  }
  if (CONDITIONS[entry?.condKey]?.counter === "rounds" && entry?.condLevel != null && entry.condLevel !== "") {
    return { value: entry.condLevel, unit: "rounds" };
  }
  return { value: 0, unit: "" };
}

/**
 * Есть ли у Состояния СИЛА, которую автор задаёт отдельно от срока. Счётчик
 * «раунды» — это срок, а не сила, и величину для него спрашивать незачем:
 * её место занимает поле срока (см. conditionEntryTerm выше).
 */
export function conditionHasLevelInput(key) {
  const counter = CONDITIONS[key]?.counter;
  return counter === "level" || counter === "count";
}
