// module/rules/morale-auto.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «АВТОМАТИЧЕСКИ ПРОХОДИТ ТЕСТЫ МОРАЛИ» — одно место на все источники.
//
//  Книга (Таланты «Смелость», корбук): Ярость, Бесстрашный (Fearless) и
//  Идолопоклонник (Idolater, пока рядом кумир) — каждый «автоматически проходит
//  тесты Морали». Образец — Ярость (rules/rage.mjs): бросок идёт как обычно,
//  но провал не засчитывается.
//
//  Раньше Ярость проверялась в четырёх местах поштучно (morale-test, fear,
//  intimidate, field-execution); третий источник означал бы третью копию в
//  каждом. Теперь они спрашивают отсюда.
//
//  Не входит: «выйти из боя или отказаться от драки» у Бесстрашного — тест W+0,
//  который решает стол (книга оставляет его в силе), и −30 Идолопоклонника на
//  встречные против Команд кумира — это галочка в окне теста (rules/courage-
//  talents.mjs), а не автоматика.
//
//  Файл НЕ импортируется источниками правил (sources.mjs): он читает
//  hasRuleFlag, то есть сам стоит выше collect.mjs, и обратного импорта быть не
//  должно (AGENTS.md, «Источники правил»).
// ════════════════════════════════════════════════════════════════════════════

import { isInRage } from "./rage.mjs";
import { hasRuleFlag } from "./flags.mjs";
import { FEARLESS_CAP, IDOLATER_CAP, isIdolNearby } from "./courage-talents.mjs";

/**
 * Проходит ли актор тесты Морали автоматически, и почему.
 * @returns {null | {by:"rage"|"fearless"|"idolater", label:string, short:string}}
 *   label — строка для списка модификаторов карточки, short — для скобки у исхода.
 */
export function moraleAutoPass(actor) {
  if (!actor) return null;
  if (isInRage(actor)) return { by: "rage", label: "😡 Ярость: автоуспех", short: "Ярость" };
  if (hasRuleFlag(actor, FEARLESS_CAP)) {
    return { by: "fearless", label: "Бесстрашный: автоуспех", short: "Бесстрашный" };
  }
  if (isIdolNearby(actor) && hasRuleFlag(actor, IDOLATER_CAP)) {
    return { by: "idolater", label: "Идолопоклонник: кумир рядом — автоуспех", short: "Идолопоклонник" };
  }
  return null;
}
