// module/rules/calm-warp.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Усмирение Варпа» (Очки Бесчестия, Cor 20+, корбук 438): перебросить 1d100
//  по таблице Феноменов или Прорывов. И Черта Беглого Псайкера «Imperial
//  Sanctioning / Имперское Санкционирование»: «Когда он тратит Очко Бесчестия
//  для переброса Феномена, если Феномен вызвал Прорыв, он может перебросить и
//  Прорыв без траты Очка Бесчестия».
//
//  Раньше «Усмирение Варпа» было только строкой на полосе Очков Бесчестия
//  (apps/infamy-points.mjs::spendInfamy — трата + описание в чат): бросать
//  заново игрок должен был сам, по таблице из книги. Теперь кнопки стоят прямо
//  на карточке манифестации (sheets/tabs/psychic.mjs), бросок и таблица —
//  здесь и в combat/calm-warp.mjs.
//
//  Чистые функции: ни game, ни Roll, ни ChatMessage — проверяются в
//  test/rules/calm-warp.test.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { DP_INFAMY_ABILITIES } from "../constants/demon-prince.mjs";
import { getPhenomenon, getPeril } from "../constants/psyker-tables.mjs";
import { hasRuleFlag } from "./flags.mjs";

/** Возможность Черты «Имперское Санкционирование» (реестр — constants/capabilities.mjs). */
export const IMPERIAL_SANCTIONING = "trait.imperialSanctioning";

/** Порог Порчи способности — из той же таблицы, что рисует полосу Очков Бесчестия. */
export const CALM_WARP_COR = DP_INFAMY_ABILITIES.find(a => a.key === "calmWarp")?.cor ?? 20;

/** Порча, по которой открываются способности Очков Бесчестия. У Демон-Принца — 100. */
export function calmWarpCor(actor) {
  if (actor?.type === "demonPrince") return 100;
  return Number(actor?.system?.corruption?.value) || 0;
}

/**
 * Можно ли потратить Очко Бесчестия на «Усмирение Варпа» — без проверки
 * самого пула (её делает трата, apps/infamy-points.mjs::spendFromInfamyPool).
 * @returns {{ok:boolean, reason:string}}
 */
export function calmWarpAllowed(actor) {
  const cor = calmWarpCor(actor);
  if (cor < CALM_WARP_COR) {
    return { ok: false, reason: `«Усмирение Варпа»: нужно Порчи ≥ ${CALM_WARP_COR} (сейчас ${cor}).` };
  }
  return { ok: true, reason: "" };
}

/** Есть ли у актора Черта «Имперское Санкционирование» (через Конструктор Черты). */
export function hasImperialSanctioning(actor) {
  return hasRuleFlag(actor, IMPERIAL_SANCTIONING);
}

/**
 * Итог переброса по таблице.
 *   table "phenomenon": phenTotal — новый бросок 1d100 уже с модификатором
 *     Феноменов; perilTotal — бросок Прорыва, если новый Феномен его вызвал.
 *   table "peril": perilTotal — новый бросок 1d100 по Прорывам.
 * @returns {{phen: object|null, peril: object|null, perilTriggered: boolean}}
 */
export function calmWarpResult(table, { phenTotal = null, perilTotal = null } = {}) {
  if (table === "peril") {
    return { phen: null, peril: getPeril(perilTotal), perilTriggered: true };
  }
  const phen = getPhenomenon(phenTotal);
  const perilTriggered = !!phen.peril;
  return { phen, peril: perilTriggered && perilTotal != null ? getPeril(perilTotal) : null, perilTriggered };
}

/**
 * Предлагать ли бесплатный переброс Прорыва (Имперское Санкционирование):
 * только после ОПЛАЧЕННОГО переброса Феномена, и только если переброшенный
 * Феномен вызвал Прорыв. Бесплатный переброс сам бесплатного не порождает.
 */
export function offerFreePerilReroll({ table, free, perilTriggered, sanctioned }) {
  return table === "phenomenon" && !free && !!perilTriggered && !!sanctioned;
}
