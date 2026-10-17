// module/rules/beyond-human.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Beyond Human / За Гранью Человека (Общие Таланты, корбук стр. 62).
//  [книга] «Он получает Трейт Unnatural Characteristic (+1) для соответствующей
//  Характеристики и при перебросе тестов на эту Характеристику может выбрать
//  оставить первый результат, вместо того, чтобы принимать второй
//  (восстанавливая потраченное Очко Бесчестия, если переброс был от его
//  траты)». Требование — «Характеристика 70», специализации — WS, BS, S, T, A,
//  I, P, W, F (Влияния в списке нет).
//
//  «Соответствующая Характеристика» — та, к которой Талант привязан при
//  покупке (пикер кладёт её ключ в system.aptSource, подпись — в
//  system.specialization; тот же механизм, что у Mastery). Здесь только чистая
//  логика без Foundry: какие Характеристики усилены и на сколько.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { testOutcome } from "./roll-outcome.mjs";

/** Девять специализаций из книги — без Влияния. */
export const BEYOND_HUMAN_CHARS = ["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel"];

/** Порог требования «Характеристика 70». */
export const BEYOND_HUMAN_MIN_CHAR = 70;

/** Рейтинг Unnatural, который даёт одна привязка. */
export const BEYOND_HUMAN_UNNATURAL = 1;

/** Это Талант «За Гранью Человека»? */
export function isBeyondHuman(item) {
  return item?.type === "talent"
    && (itemHasName(item, "Beyond Human") || itemHasName(item, "За Гранью Человека"));
}

const norm = s => String(s ?? "").trim().toLowerCase();

/**
 * Характеристика, к которой привязан этот Талант, либо "" (привязки нет).
 * Ключ берётся из aptSource; у старых копий без него — по подписи
 * specialization («Сила», «S», «Силa (S)»).
 */
export function beyondHumanCharKey(item) {
  const apt = norm(item?.system?.aptSource);
  if (BEYOND_HUMAN_CHARS.includes(apt)) return apt;
  const label = norm(item?.system?.specialization);
  if (!label) return "";
  return BEYOND_HUMAN_CHARS.find(k => {
    const c = CHARACTERISTICS[k];
    return norm(c.label) === label || norm(c.abbr) === label
      || label.includes(`(${norm(c.abbr)})`) || label.startsWith(`${norm(c.label)} `);
  }) ?? "";
}

/**
 * Усиленные Характеристики актора. Две покупки на одну Характеристику не
 * складываются: книга даёт «Трейт Unnatural Characteristic (+1)» за привязку,
 * а не за каждую копию Таланта.
 * @param {Iterable<object>} items предметы актора
 * @returns {Set<string>} ключи Характеристик
 */
export function beyondHumanChars(items) {
  const out = new Set();
  for (const item of items ?? []) {
    if (!isBeyondHuman(item)) continue;
    const key = beyondHumanCharKey(item);
    if (key) out.add(key);
  }
  return out;
}

/** Рейтинг Unnatural от «За Гранью Человека» для одной Характеристики (0 или 1). */
export function beyondHumanRating(actor, charKey) {
  if (!charKey) return 0;
  return beyondHumanChars(actor?.items).has(charKey) ? BEYOND_HUMAN_UNNATURAL : 0;
}

/**
 * Можно ли оставить первый результат: у актора есть Талант на ту
 * Характеристику, которой бросали. Тест без Характеристики (charKey пуст) —
 * нет.
 */
export function canKeepFirstResult(actor, charKey) {
  return beyondHumanRating(actor, charKey) > 0;
}

/**
 * Итог «оставить первый»: какой из двух результатов остаётся в силе.
 * Возвращает описание первого результата для карточки.
 * @param {{rv:number, threshold:?number}} first
 */
export function firstResultOutcome({ rv, threshold }) {
  if (threshold == null || !Number.isFinite(Number(threshold))) return { success: null, deg: null };
  return testOutcome(rv, Number(threshold));
}
