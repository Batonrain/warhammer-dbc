// module/rules/fatigue-grace.mjs
//
// Порог Усталости: сколько её уровней актор терпит, прежде чем начнёт получать
// −10 к тестам. Обычно порог равен 1 — штраф с первой же единицы; предметы
// поднимают его до Бонуса Стойкости или Воли.
//
// ЖИВОЙ запрос, как у Трудного Ландшафта: запись Конструктора kind:"fatigue"
// ничего не создаёт и не пишет при получении предмета, а читается напрямую в
// момент теста. Уйдёт предмет — порог сам вернётся к прежнему, откатывать
// нечего.
//
// Живёт отдельно от Конструктора намеренно: потребитель — расчёт штрафа на
// вкладке Состояний (sheets/tabs/conditions.mjs), и тянуть ради одной функции
// весь mechanics.mjs с его диалогами и Обозревателем незачем. Здесь чистые
// функции, проверяются без заглушки Foundry.

import { entryWhenOk } from "./mech-when.mjs";

const FLAG_SCOPE = "warhammer-dbc";

/** Механика предмета: и документ Foundry, и литерал теста. */
function mechanicsOf(item) {
  const viaFlag = item?.getFlag?.(FLAG_SCOPE, "mechanics");
  return viaFlag ?? item?.flags?.[FLAG_SCOPE]?.mechanics ?? [];
}

/**
 * Разворачивает все записи Механики в плоский список, включая вложенные
 * подгруппы (kind:"group"): запись в подгруппе действует так же, как запись
 * верхнего уровня, и пропустить её нельзя.
 */
export function flattenMechEntries(groups) {
  const out = [];
  for (const group of groups || []) {
    for (const entry of group?.entries || []) {
      out.push(entry);
      if (entry?.kind === "group" && entry.group) out.push(...flattenMechEntries([entry.group]));
    }
  }
  return out;
}

/** Заполнена ли запись «Усталость» настолько, чтобы что-то значить. */
export function isFatigueEntry(entry) {
  return entry?.kind === "fatigue"
    && entry.fatigueAction === "threshold"
    && !!entry.fatigueThresholdChar;
}

/**
 * Насколько поднят порог штрафа Усталости у актора.
 *
 * При нескольких источниках берётся МАКСИМУМ, а не сумма: это «терпимость к
 * усталости», а не складывающийся бонус, и два предмета с Бонусом Стойкости не
 * должны давать двойной запас.
 *
 * @returns {number} 0, если поднимать нечем
 */
export function fatigueGraceForActor(actor) {
  let best = 0;
  for (const item of actor?.items ?? []) {
    for (const entry of flattenMechEntries(mechanicsOf(item))) {
      if (!isFatigueEntry(entry)) continue;
      if (!entryWhenOk(actor, entry, item)) continue;
      const key = entry.fatigueThresholdChar === "wp" ? "wp" : "t";
      const grace = Number(actor?.system?.characteristics?.[key]?.bonus) || 0;
      if (grace > best) best = grace;
    }
  }
  return best;
}
