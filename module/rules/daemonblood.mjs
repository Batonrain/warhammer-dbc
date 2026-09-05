// module/rules/daemonblood.mjs
//
// Психосила «Daemonblood / Кровь Демонов» (wdbc-173l, остаток аудита
// «аблатив» после wdbc-w8ws): «Тратит 1-3×PR крови → столько же аблативных
// Ран (вместо своих, на участках под бронёй, кроме сочленений/глаз)».
//
// Это ЦЕНА (реальные Раны тратятся как ресурс), а не входящий урон — поэтому
// НЕ через woundLossUpdates/applyWoundLoss (module/rules/wounds.mjs): тот
// путь сперва гасит урон существующим аблативным пулом, что здесь неверно —
// трата крови должна вычитаться из ЖИВЫХ Ран напрямую, даже если у актора
// уже есть посторонний аблативный пул (Godkin и т.п.). Используется голый
// woundLossAfter (та же арифметика запаса Критических, без ablativeAbsorb).
//
// Одноразовое применение (как Cancerous Healing/Flayed) — не переоформляется
// по нажатию, пока не сброшено (кнопка на листе скрывается, пока флаг > 0).
// Зонирование (только под бронёй, не сочленения/глаза) НЕ смоделировано —
// общий пул system.wounds.ablative зон не различает вообще (тот же честный
// пробел, что у Muscle Mass).

import { itemHasName } from "./predicates.mjs";
import { itemIs } from "./item-marker.mjs";
import { woundLossAfter } from "./wounds.mjs";
import { replaceAblativeContribution, shrinkAblativeContributionToFit } from "./wounds.mjs";

const NAME = "Daemonblood";
export const DAEMONBLOOD_FLAG = "daemonbloodAblative";

/** Это предмет-психосила «Daemonblood / Кровь Демонов»? */
export function isDaemonbloodItem(item) {
  return itemIs(item, "psychicPower", "power.daemonblood", NAME);
}

/**
 * Варианты выбора (1×PR / 2×PR / 3×PR аблативных Ран за столько же живых
 * Ран), обрезанные текущим запасом живых Ран — нельзя потратить больше крови,
 * чем есть. Пустой список — Ран не осталось совсем.
 *
 * @param {number} pr             Пси-Рейтинг актора (system.psyker.rating)
 * @param {number} currentWounds  system.wounds.value
 */
export function daemonbloodOptions(pr, currentWounds) {
  const prN = Math.max(0, Number(pr) || 0);
  const wounds = Math.max(0, Number(currentWounds) || 0);
  const out = [];
  for (const mult of [1, 2, 3]) {
    const wanted = prN * mult;
    if (wanted <= 0) continue;
    const amount = Math.min(wanted, wounds);
    if (amount <= 0) continue;
    out.push({ mult, wanted, amount, capped: amount < wanted });
  }
  return out;
}

/**
 * Применить выбор: списать `amount` живых Ран НАПРЯМУЮ (не через аблативный
 * пул — см. докстринг файла), выдать `amount` аблативных Ран (заменяя
 * прошлый вклад этого источника — повторный вызов переоформляет, не
 * складывает, тем же приёмом, что Cancerous Healing/Plague Shepherd).
 *
 * @param {object} system            actor.system (ДО применения)
 * @param {number} prevContribution  флаг DAEMONBLOOD_FLAG (обычно 0 — кнопка
 *                                    скрыта, пока он не сброшен)
 * @param {number} amount            сколько живых Ран тратится (уже обрезано
 *                                    daemonbloodOptions)
 * @returns {{wounds:number, critical:number, ablative:number, ablativeMax:number, contribution:number}}
 */
export function daemonbloodGrant(system, prevContribution, amount) {
  const spend = Math.max(0, Number(amount) || 0);
  const { value: wounds, critical } = woundLossAfter(
    system?.wounds?.value, system?.wounds?.critical, spend);
  const { ablative, ablativeMax, contribution } =
    replaceAblativeContribution(system, prevContribution, spend);
  return { wounds, critical, ablative, ablativeMax, contribution };
}

/**
 * Ресинк ПОСЛЕ того, как общий ablative пул уменьшился по другой причине
 * (поглощение урона) — см. module/rules/wounds.mjs::shrinkAblativeContributionToFit.
 */
export function daemonbloodShrinkToFit(system, prevContribution) {
  return shrinkAblativeContributionToFit(system, prevContribution);
}
