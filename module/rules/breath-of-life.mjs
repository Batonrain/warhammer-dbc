// module/rules/breath-of-life.mjs
// ════════════════════════════════════════════════════════════════════════
//  Дыхание Жизни / Breath of Life (Дар Нургла, d100 78..80, wdbc-1rno):
//  «Он может вдохнуть своё дыхание в рот трупу, умершему не более 3 дней
//  назад. Его собственные Раны при этом опускаются до 0 (если они не были
//  ниже), а труп возвращается к жизни с 0 Ран. Персонаж не может
//  использовать эту способность повторно, пока полностью не вылечит свои
//  Раны.»
//
//  Чистая арифметика — Foundry здесь не нужен; UI и цель живут в
//  module/apps/breath-of-life.mjs (тот же раздел труда, что у Неутомимого
//  Воина: rules/tireless-warrior.mjs + apps/tireless-warrior.mjs).
//
//  Про метку «уже использовано». Одного условия «Раны полны» мало: если
//  чемпион уже стоял на 0 или в минусе, цена «опустить Раны до 0» с него
//  ничего не берёт (книга прямо оговаривает «если они не были ниже»), и без
//  метки Дар можно было бы жать подряд. Метка снимать не нужно — она
//  перекрывается вторым условием: полностью вылеченные Раны возвращают
//  доступность сами.
//
//  «Не более 3 дней назад» и выбор Тзинчита/Слаанешита («остаться мёртвым
//  либо потерять покровительство своего Бога») не проверяются: понятия
//  смерти и её времени в системе нет вовсе (разбор в шапке combat/deadly-
//  effectiveness.mjs), а выбор — решение игрока цели, а не движка. И то,
//  и другое уходит в текст карточки.
// ════════════════════════════════════════════════════════════════════════

import { itemIs } from "./item-marker.mjs";

export const BREATH_OF_LIFE = "gift.nurgle.breathOfLife";
export const BREATH_SPENT_FLAG = "breathOfLifeSpent";
const NAME = "Breath of Life";

/** Это Дар Нургла «Дыхание Жизни»? */
export function isBreathOfLifeItem(item) {
  return itemIs(item, "mutation", BREATH_OF_LIFE, NAME);
}

/** Раны вылечены полностью (и отрицательных нет) — снимает запрет на повтор. */
export function woundsFullyHealed(system) {
  const max = system?.wounds?.effectiveMax ?? system?.wounds?.max ?? 0;
  const value = Number(system?.wounds?.value) || 0;
  const critical = Number(system?.wounds?.critical) || 0;
  return critical <= 0 && Number(max) > 0 && value >= Number(max);
}

/** Доступен ли Дар прямо сейчас: не потрачен, либо Раны с тех пор вылечены целиком. */
export function breathOfLifeAvailable(system, spent) {
  return !spent || woundsFullyHealed(system);
}

/**
 * Цена носителю: Раны опускаются до 0, но не поднимаются, если уже были
 * ниже («если они не были ниже» — книга). Отрицательные Раны (critical)
 * не трогаются вовсе: их не «опускают до 0», их там уже перебрали.
 *
 * @returns {?number} новое значение Ран, либо null — менять нечего
 */
export function breathOfLifeSelfWounds(system) {
  const value = Number(system?.wounds?.value) || 0;
  return value > 0 ? 0 : null;
}

/** Патч на воскрешаемый труп: 0 Ран, отрицательные сняты. */
export function revivedCorpseUpdate() {
  return { "system.wounds.value": 0, "system.wounds.critical": 0 };
}
