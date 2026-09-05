// module/rules/condition-duration.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СРОК СОСТОЯНИЯ (wdbc-uqco) — арифметика штатной Duration эффекта Foundry.
//
//  До этого срок жил своим числовым полем на акторе
//  (system.conditions.stunnedRounds и два соседних) и уменьшался вручную, в
//  начале Хода, циклом в combat/condition-ticks.mjs. Тикали ровно три
//  Состояния из тех, у кого в книге срок есть, и выразить срок можно было
//  только в раундах: «Отравлен на 1 минуту» или «Оглушён до конца сцены» ГМ
//  держал в голове.
//
//  Штатная Duration умеет и то и другое сразу: в РАУНДАХ её сверяет боевой
//  трекер, в СЕКУНДАХ — game.time.worldTime, тот самый счётчик, который
//  крутит виджет «Летоисчисление» (см. шапку apps/imperial-calendar.mjs:
//  «Foundry уже проверяет её по worldTime без отдельной интеграции»).
//
//  Здесь только ЧИСЛА — ни одного обращения к Foundry, ни одного документа:
//  срок автора → объект duration, и обратно — сколько осталось. Сторона
//  Foundry (создать эффект, подмести истёкшие) живёт отдельно, потому что
//  этот файл обязан проверяться без заглушки.
//
//  Что сюда НЕ входит и не должно: уровневые Состояния (Кровотечение,
//  Обескровливание, Горение, Радиация, потери конечностей). У них счётчик
//  означает СИЛУ, а не срок, и Duration к ним неприменима. Удушье тоже
//  остаётся своим счётчиком, хотя единица у него «раунды»: ноль у него
//  значит «запас дыхания кончился, дальше тесты», а не «срок вышел» —
//  ровно противоположное тому, что делает истёкшая Duration.
// ════════════════════════════════════════════════════════════════════════════

import { CONDITIONS } from "../constants/conditions.mjs";

/** Длина боевого Раунда в секундах — умолчание Foundry (CONFIG.time.roundTime). */
export const SECONDS_PER_ROUND = 6;

/**
 * Единицы срока, которые автор выбирает в Конструкторе. `seconds: null` у
 * раундов не опечатка: раунды считает боевой трекер, а не worldTime, и
 * переводить их в секунды нельзя — вне боя Раундов просто нет.
 */
export const DURATION_UNITS = [
  { key: "",        label: "без срока",  seconds: null },
  { key: "rounds",  label: "раундов",    seconds: null },
  { key: "minutes", label: "минут",      seconds: 60 },
  { key: "hours",   label: "часов",      seconds: 3600 },
  { key: "days",    label: "суток",      seconds: 86400 }
];

const UNIT_BY_KEY = Object.fromEntries(DURATION_UNITS.map(u => [u.key, u]));

/** Склонение единицы для подписи: 2 раунда, 5 раундов, 1 минута. */
const WORD_FORMS = {
  rounds:  ["раунд", "раунда", "раундов"],
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

/** «2 раунда», «1 минута», «" » — если срока нет. */
export function durationLabel(value, unit) {
  const n = Math.max(0, Math.round(Number(value) || 0));
  const forms = WORD_FORMS[unit];
  if (!forms || !n) return "";
  return `${n} ${plural(n, forms)}`;
}

/**
 * Срок автора → объект duration для ActiveEffect.
 *
 * `now` — снимок текущего момента игры: { round, turn, combatId, worldTime }.
 * Раунды привязываются к бою (startRound/startTurn — от них Foundry считает
 * остаток), всё остальное — к worldTime через seconds.
 *
 * @returns {?object} null, если срока нет (единица пустая или величина ⩽ 0) —
 *   такое Состояние висит до ручного снятия, как и раньше.
 */
export function durationDataFor(value, unit, now = {}) {
  const n = Math.max(0, Math.round(Number(value) || 0));
  const u = UNIT_BY_KEY[unit];
  if (!u || !n || unit === "") return null;
  if (unit === "rounds") {
    return {
      rounds: n, turns: null,
      combat: now.combatId ?? null,
      startRound: Number(now.round) || 0,
      startTurn: Number(now.turn) || 0
    };
  }
  return { seconds: n * u.seconds, startTime: Number(now.worldTime) || 0 };
}

/**
 * Сколько секунд срока осталось — только для сроков в секундах.
 * @returns {?number} null, если у этой Duration секунд нет вовсе
 */
export function remainingSeconds(duration, now = {}) {
  const seconds = Number(duration?.seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const start = Number(duration.startTime) || 0;
  const worldTime = Number(now.worldTime) || 0;
  return Math.max(0, start + seconds - worldTime);
}

/**
 * Сколько Раундов срока осталось — только для сроков в раундах.
 * @returns {?number} null, если у этой Duration раундов нет вовсе
 */
export function remainingCombatRounds(duration, now = {}) {
  const rounds = Number(duration?.rounds);
  if (!Number.isFinite(rounds) || rounds <= 0) return null;
  const start = Number(duration.startRound) || 0;
  const round = Number(now.round) || 0;
  return Math.max(0, start + rounds - round);
}

/**
 * Остаток срока, ПРИВЕДЁННЫЙ к Раундам — то число, что видит игрок на месте
 * прежнего своего счётчика. Секунды переводятся вверх (55 секунд — это ещё
 * целых 10 Раундов, а не 9): срок кончается, когда кончается, а не Раундом
 * раньше.
 *
 * @returns {?number} null, если срока у этой Duration нет вообще
 */
export function remainingRounds(duration, now = {}) {
  const byRounds = remainingCombatRounds(duration, now);
  if (byRounds !== null) return byRounds;
  const bySeconds = remainingSeconds(duration, now);
  if (bySeconds === null) return null;
  return Math.ceil(bySeconds / SECONDS_PER_ROUND);
}

/**
 * Истёк ли срок. Duration без срока НЕ истекает никогда — «висит до ручного
 * снятия» и «истёк только что» обязаны различаться, иначе подметание сняло бы
 * все бессрочные Состояния разом.
 */
export function isDurationExpired(duration, now = {}) {
  const left = remainingRounds(duration, now);
  return left !== null && left <= 0;
}

/**
 * Человекочитаемый остаток — для тега на листе и подсказки на токене.
 * Секунды показываются своими единицами, а не переведёнными в Раунды: «через
 * 40 минут» игроку понятнее, чем «через 400 Раундов».
 */
export function remainingLabel(duration, now = {}) {
  const byRounds = remainingCombatRounds(duration, now);
  if (byRounds !== null) return durationLabel(byRounds, "rounds");
  const secs = remainingSeconds(duration, now);
  if (secs === null) return "";
  if (secs >= 86400) return durationLabel(Math.ceil(secs / 86400), "days");
  if (secs >= 3600)  return durationLabel(Math.ceil(secs / 3600), "hours");
  if (secs >= 60)    return durationLabel(Math.ceil(secs / 60), "minutes");
  return durationLabel(Math.ceil(secs / SECONDS_PER_ROUND), "rounds");
}

/**
 * Срок, записанный автором в записи Конструктора kind:"condition".
 *
 * Обратная совместимость с записями, заведёнными ДО этого шага (wdbc-tl0f):
 * там единицы не было вовсе, а у Состояния со счётчиком «раунды» величина
 * condLevel и БЫЛА сроком — просто выразить его иначе как в Раундах было
 * нечем. Такие записи читаются как «столько-то раундов», и их поведение не
 * меняется ни на йоту.
 *
 * @returns {{value: (string|number), unit: string}} unit:"" — срока нет
 */
export function conditionEntryTerm(entry) {
  const unit = String(entry?.condDurationUnit || "");
  if (unit) return { value: entry.condDurationValue ?? "1", unit };
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
