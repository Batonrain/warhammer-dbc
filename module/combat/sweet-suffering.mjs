// module/combat/sweet-suffering.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Сладкое Страдание» — особая трата Очка Бесчестия при Покровительстве
//  Слаанеш (корбук 438): «когда персонаж получает Критический Эффект, он может
//  потратить Очко Бесчестия, чтобы проигнорировать все эффекты, кроме потери
//  конечностей, смерти, или Оглушения».
//
//  Кнопка стоит в блоке Критического Эффекта карточки урона. Клик тратит Очко
//  (apps/infamy-points.mjs::spendPatronAbility) и гасит кнопки применения всех
//  эффектов, которые способность отменяет (rules/patron-abilities.mjs). Кнопки
//  потери конечностей, Оглушения и «Констатировать смерть» остаются.
//
//  Гашение — на самой карточке, как и у остальных кнопок блока (el.disabled
//  живёт до перерисовки карточки): сообщение чата чужого броска игрок править
//  не может. Ответственность та же, что у «Выронить» и «Урон в Характеристику».
// ════════════════════════════════════════════════════════════════════════════

import { sweetSufferingApplies, sweetSufferingIgnores } from "../rules/patron-abilities.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

/**
 * Кнопка под Критическим Эффектом — только цели с Покровительством Слаанеш.
 * Пусто и тогда, когда в карточке нечего игнорировать, кроме смерти: способность
 * смерть не отменяет, тратить Очко было бы не на что.
 */
export function sweetSufferingHtml(actor, { pills = [], hasCharDamage = false, hasDrop = false } = {}) {
  if (!actor?.uuid || !sweetSufferingApplies(actor)) return "";
  const keys = pills.map(p => p.key);
  const hasIgnorable = keys.some(k => sweetSufferingIgnores(k, keys)) || hasCharDamage || hasDrop;
  if (!hasIgnorable) return "";
  return `<div class="wh-crit-pills">
    <button type="button" class="wh-sweet-suffering-btn" data-actor-uuid="${esc(actor.uuid)}"
      title="Покровительство Слаанеш: за Очко Бесчестия игнорировать все эффекты, кроме потери конечностей, смерти и Оглушения">
      ${rollIcon("spark", "#e85ad6")} Сладкое Страдание (−1 Очко Бесчестия)</button>
  </div>`;
}

/**
 * Погасить на карточке эффекты, которые «Сладкое Страдание» отменяет.
 * @param {Element} block  блок `.dmg-critical-block`, в котором нажали кнопку
 * @returns {number} сколько кнопок погашено
 */
export function dimIgnoredEffects(block) {
  if (!block?.querySelectorAll) return 0;
  const cardKeys = [...block.querySelectorAll(".wh-crit-apply-btn")].map(b => b.dataset.condKey);
  const dim = btn => {
    btn.disabled = true;
    btn.classList.add("wh-crit-ignored");
    btn.title = "Проигнорировано: Сладкое Страдание";
  };
  let n = 0;
  for (const btn of block.querySelectorAll(".wh-crit-apply-btn")) {
    if (sweetSufferingIgnores(btn.dataset.condKey, cardKeys)) { dim(btn); n++; }
  }
  // Урон в Характеристики и «Выронить» — тоже эффекты Критического Эффекта, не
  // потеря конечности: они гасятся. «Констатировать смерть» не трогаем.
  for (const btn of block.querySelectorAll(".wh-char-dmg-btn, .wh-crit-drop-btn")) { dim(btn); n++; }
  return n;
}
