// module/rules/stun-taint.mjs
//
// Порча за Ходы Оглушения пост-эффекта (Струп / Scab, Основная книга, стр. 283:
// «Если персонаж не имеет Покровительства Нургла, за каждый Ход Оглушения он
// получает 1 Порчи»). Данные живут флагом предмета-препарата
// flags.warhammer-dbc.afterEffectStunTaint = { perTurn, exemptPatron } — схема
// препарата не меняется. При наступлении пост-эффекта на актора ставится
// флаг stunTaint; в начале каждого Хода актора, пока он Оглушён, тик Состояний
// (combat/condition-ticks.mjs) начисляет Порчу. «Ход Оглушения» = Ход актора,
// начатый в Оглушении (в том числе тот, на котором счётчик Раундов дошёл до 0).
// Вне боя Ходов нет — там Порча остаётся напоминанием в карточке пост-эффекта.
//
// Здесь только чистая арифметика, без Foundry, ради теста без стенда.

export const STUN_TAINT_ITEM_FLAG = "afterEffectStunTaint";
export const STUN_TAINT_ACTOR_FLAG = "stunTaint";

/**
 * Что записать на актора при наступлении пост-эффекта.
 * @param {object} item     препарат
 * @param {object} fx       system.afterEffectSpecial препарата
 * @returns {?{perTurn:number, exemptPatron:string, source:string}} null — у препарата нет такого правила
 */
export function stunTaintFor(item, fx) {
  const raw = item?.flags?.["warhammer-dbc"]?.[STUN_TAINT_ITEM_FLAG];
  const perTurn = Math.floor(Number(raw?.perTurn)) || 0;
  if (perTurn <= 0 || fx?.grantsCondition !== "stunned") return null;
  return { perTurn, exemptPatron: String(raw.exemptPatron || ""), source: String(item.name || "") };
}

/**
 * Решение на начале Хода актора.
 * @param {?object} taint    флаг stunTaint актора
 * @param {object} state
 * @param {boolean} state.stunned    Оглушён ли актор сейчас
 * @param {boolean} state.ending     Оглушение заканчивается на этом тике (счётчик Раундов 1 → 0)
 * @param {string}  state.patronGod  Покровитель актора
 * @returns {{amount:number, clear:boolean}} amount — сколько Порчи начислить, clear — снять ли флаг
 */
export function stunTaintStep(taint, { stunned, ending, patronGod }) {
  if (!taint) return { amount: 0, clear: false };
  const exempt = !!taint.exemptPatron && patronGod === taint.exemptPatron;
  const amount = stunned && !exempt ? Math.max(0, Number(taint.perTurn) || 0) : 0;
  return { amount, clear: !stunned || !!ending };
}
