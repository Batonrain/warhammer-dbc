// module/rules/cancerous-healing.mjs
//
// Мутация «Cancerous Healing / Раковое Исцеление» (wdbc-w8ws, Дары Нургл
// d100 22…25): целительное касание, дающее ЦЕЛИ (не носителю Мутации)
// аблативные Раны динамической величиной — Конструктор Механики не умеет
// «выдай другому актору переменное количество», вся логика живёт здесь и в
// apps/cancerous-healing.mjs, тем же принципом, что Hand of Death.
//
// Собственный вклад цели в общий аблативный пул хранится на ней самой
// флагом flags.warhammer-dbc.cancerousHealingAblative и двигается ВМЕСТЕ с
// ablativeMax (module/rules/wounds.mjs::replaceAblativeContribution) — с
// #291 rules/character.mjs клэмпит ablative до ablativeMax на КАЖДЫЙ такт
// расчёта, «осиротевший пул без источника должен затухать», и без своей
// доли ablativeMax грант Ракового Исцеления исчез бы на первом же рендере.

import { itemHasName } from "./predicates.mjs";
import { replaceAblativeContribution, shrinkAblativeContributionToFit } from "./wounds.mjs";

const NAME = "Cancerous Healing";
export const CANCEROUS_HEALING_FLAG = "cancerousHealingAblative";

/** Это предмет-Мутация «Раковое Исцеление»? */
export function isCancerousHealingItem(item) {
  return item?.type === "mutation" && itemHasName(item, NAME);
}

/**
 * Новый вклад цели = недостающие Раны (RAW: «получает количество аблативных
 * Ран, равное количеству недостающих Ран») — заменяет ПРОШЛЫЙ вклад этого же
 * источника целиком (повторное касание не складывается само с собой), не
 * трогая посторонний аблатив на том же акторе. Сумма (аблатив+обычные Раны)
 * не превышает максимум автоматически: missing = max−value по построению.
 *
 * @param {object} system            targetActor.system
 * @param {number} prevContribution  текущий флаг CANCEROUS_HEALING_FLAG цели
 * @returns {{newAblative:number, newAblativeMax:number, contribution:number, missing:number}}
 */
export function cancerousHealingGrant(system, prevContribution = 0) {
  const max     = Number(system?.wounds?.max)   || 0;
  const value   = Number(system?.wounds?.value) || 0;
  const missing = Math.max(0, max - value);
  const { ablative, ablativeMax, contribution } = replaceAblativeContribution(system, prevContribution, missing);
  return { newAblative: ablative, newAblativeMax: ablativeMax, contribution, missing };
}

/**
 * Пассивный ресинк ПОСЛЕ лечения (RAW: «если восстанавливает Раны лечением,
 * лишние аблативные Раны теряются») — вклад может только СЖАТЬСЯ вслед за
 * подросшим value, не вырасти обратно от последующего урона (Math.min).
 * Вызывать при любом изменении system.wounds.value/.max цели.
 *
 * @returns {{newAblative:number, newAblativeMax:number, contribution:number}|null} null — сжимать нечего
 */
export function cancerousHealingShrinkAfterHeal(system, prevContribution) {
  const prev = Math.max(0, Number(prevContribution) || 0);
  if (prev <= 0) return null;
  const max     = Number(system?.wounds?.max)   || 0;
  const value   = Number(system?.wounds?.value) || 0;
  const missing = Math.max(0, max - value);
  const newContribution = Math.min(prev, missing);
  if (newContribution === prev) return null;
  const { ablative, ablativeMax, contribution } = replaceAblativeContribution(system, prev, newContribution);
  return { newAblative: ablative, newAblativeMax: ablativeMax, contribution };
}

/**
 * Ресинк ПОСЛЕ того, как общий ablative пул уменьшился по любой другой
 * причине (поглощение урона) — доля не может быть больше, чем реально
 * осталось в пуле; без этого ablativeMax источника завис бы на историческом
 * пике и подпитывал бы лишний пассивный реген (см. shrinkAblativeContributionToFit).
 */
export function cancerousHealingShrinkToFit(system, prevContribution) {
  return shrinkAblativeContributionToFit(system, prevContribution);
}

/**
 * Штраф A/Ловкость и S/Сила за КАЖДУЮ аблативную Рану — 2 за штуку. Книга
 * (packs-src/books/core.json, DoomBC — Основная книга, «Раковое Исцеление»,
 * d100 22…25): «...но за каждую аблативную Рану её A и S уменьшаются на 2»
 * — плоское число без упоминания Бонуса, тем же стилем, что и остальные
 * прямые характеристико-модификаторы книги (Значение/`.totalFx`, не Бонус/
 * `.bonusFx` — тот отдельно всегда подписан «Unnatural»/явно как бонус).
 */
export function cancerousHealingPenaltyValue(ablative) {
  return 2 * Math.max(0, Number(ablative) || 0);
}
