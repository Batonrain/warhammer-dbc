// module/rules/session-rewards.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СЧЁТ НАГРАД ЗА СЕССИЮ (wdbc-ce8e) — чистая часть, без Foundry.
//
//  Экран итогов сессии складывает опыт из двух источников: партийные категории
//  книги (одно число всем) и персональные (своё каждому). Плюс необязательные
//  Порча и Бесчестие — те задаются либо числом, либо формулой броска.
//
//  Здесь только арифметика и разбор ввода: бросок кубов делает вызывающий, у
//  которого есть Roll. Так эту часть можно проверить без запущенной игры — и
//  именно её проверяют тесты, а не диалог.
// ════════════════════════════════════════════════════════════════════════════

import { XP_CATEGORIES, PARTY_KEYS, EACH_KEYS } from "../constants/session-rewards.mjs";

const int = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Опыт, общий для всей партии: сумма партийных категорий.
 * @param {Record<string, number>} values ключ категории → выбранное число
 */
export function partyXp(values = {}) {
  return PARTY_KEYS.reduce((sum, key) => sum + Math.max(0, int(values[key])), 0);
}

/**
 * Опыт одного персонажа: партийная часть плюс его личные категории.
 *
 * @param {Record<string, number>} party      партийные значения
 * @param {Record<string, number>} personal   личные значения ЭТОГО персонажа
 * @param {number} [override]  число, вписанное ГМом руками вместо расчёта
 */
export function actorXp(party = {}, personal = {}, override = null) {
  if (override != null && String(override).trim() !== "") return Math.max(0, int(override));
  const own = EACH_KEYS.reduce((sum, key) => sum + Math.max(0, int(personal[key])), 0);
  return partyXp(party) + own;
}

/**
 * Разбор поля Порчи/Бесчестия: либо число, либо формула броска.
 *
 * Пустое поле — «не выдавать», и это НЕ то же самое, что ноль: ноль ГМ мог
 * вписать осознанно, и тогда в журнале появится запись «0», а при пустом поле
 * не появится ничего.
 *
 * @param {string|number} input
 * @returns {?{kind:"flat", value:number}|{kind:"roll", formula:string}}
 */
export function parseRewardAmount(input) {
  const raw = String(input ?? "").trim();
  // Пустое поле названо отдельной строкой, хотя обе проверки ниже и так его
  // отсеяли бы: это договор функции, а не ветка поведения. Мутация её не
  // ловит именно поэтому — и это правильно, а не пробел в тестах.
  if (!raw) return null;
  if (/^[+-]?\d+$/.test(raw)) return { kind: "flat", value: int(raw) };
  // Формула броска: цифры, d, пробелы, плюс-минус и скобки. Русские «д» и «к»
  // принимаются как d — за столом их набирают, не переключая раскладку.
  const formula = raw.replace(/[кд]/gi, "d");
  // Кубик обязан быть полным: «1д» без граней — это опечатка на полпути, и
  // Foundry такую формулу всё равно не бросит. Лучше сказать «непонятно», чем
  // молча начислить ноль.
  if (/^[\d\s+\-*/()d]+$/i.test(formula) && /\d*d\d+/i.test(formula))
    return { kind: "roll", formula };
  return null;
}

/**
 * Строки итогового расчёта — по одной на персонажа.
 *
 * @param {{id:string,name:string}[]} actors выбранные персонажи
 * @param {object} form состояние формы:
 *   party      — {категория: число}
 *   personal   — {actorId: {категория: число}}
 *   xpOverride — {actorId: число или ""}
 *   corruption — {actorId: строка}
 *   infamy     — {actorId: строка}
 */
export function buildRewardRows(actors, form = {}) {
  const { party = {}, personal = {}, xpOverride = {}, corruption = {}, infamy = {} } = form;
  return actors.map(a => ({
    id: a.id,
    name: a.name,
    xp: actorXp(party, personal[a.id] ?? {}, xpOverride[a.id]),
    corruption: parseRewardAmount(corruption[a.id]),
    infamy: parseRewardAmount(infamy[a.id])
  }));
}

/**
 * Награда Бесчестием растит ХАРАКТЕРИСТИКУ (Inf), а не пул Очков Бесчестия.
 *
 * Очки — расходуемая валюта, и конец сессии их и так восполняет до максимума
 * (apps/game-session.mjs, refillFatePools): выданное туда к следующей игре
 * ничего не значило бы. Растёт и остаётся навсегда именно характеристика — её
 * и выдаём, тем же полем `base`, что и Возвышение Демон-Принца. Решение
 * владельца, 07.09.2026.
 */
export const INFAMY_PATH = "system.characteristics.inf.base";

/** Потолок характеристики — тот же, на который смотрит Возвышение. */
export const INFAMY_CAP = 100;

/**
 * Сколько ещё можно прибавить к Бесчестию, не пробив потолок.
 *
 * Считается по ИТОГУ характеристики, а не по базе: сверх базы есть ещё
 * Продвижение и надбавки, и потолок по базе разрешил бы перебор.
 */
export function infamyRoom(actor) {
  const total = int(actor?.system?.characteristics?.inf?.total);
  return Math.max(0, INFAMY_CAP - total);
}

/**
 * Прибавка к Бесчестию после обрезки потолком.
 *
 * Уход в минус не обрезается: отнять ГМ может сколько угодно, потолок — только
 * сверху, а ноль снизу ставит уже сама запись.
 */
export function infamyGain(actor, amount) {
  // Отдельной ветки для минуса не нужно: запас никогда не отрицателен, и
  // Math.min от минуса с ним же и остаётся минусом. Ветка тут была бы мёртвым
  // кодом — её нельзя ни исполнить иначе, ни поймать тестом.
  return Math.min(int(amount), infamyRoom(actor));
}

/** Категории — для отрисовки формы, в порядке книги. */
export { XP_CATEGORIES, PARTY_KEYS, EACH_KEYS };
