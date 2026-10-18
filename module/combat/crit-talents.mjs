// module/combat/crit-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Таланты Стойкости на карточке Критического Эффекта (глава 3) — РАЗМЕТКА и
//  гашение кнопок. Сами действия (тесты, трата Очка) — combat/crit-talents-actions.mjs.
//
//    Final Push / Последний Рывок — «Когда он получает Критические Эффекты, он
//      может пройти тест на Т+0, чтобы отложить их применение до конца своего Хода.»
//    Never Die / Не Умирать — «Когда персонаж получает Критический Эффект, он может
//      выбрать потратить Очко Бесчестия, чтобы проигнорировать все его эффекты.
//      Это не предотвращает урон.»
//    Pain Is an Illusion / Боль — Лишь Иллюзия — «Когда персонаж получает
//      Критический Эффект, он может пройти тест на W+0 и уменьшить эффект на Успехи,
//      до минимума в 1.»
//
//  Образец — combat/sweet-suffering.mjs: кнопки стоят в блоке `.dmg-critical-block`
//  карточки урона и только у носителя Таланта; гашение — на самой карточке, а чтобы
//  оно переживало перерисовку, итог пишется ещё и флагом сообщения (card-once.mjs),
//  который applyCritTalentState перечитывает при каждом показе карточки.
//
//  Модуль лёгкий (только rules/ и helpers/): его импортирует damage.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { hasResilienceTalent } from "../rules/resilience-talents.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

/** Кнопки-«эффекты» блока Критического Эффекта: то, что Таланты гасят или откладывают. */
export const CRIT_EFFECT_SELECTOR =
  ".wh-crit-apply-btn, .wh-char-dmg-btn, .wh-crit-drop-btn, .wh-crit-death-btn, .wh-shock-death-btn";

/** Кнопки самих Талантов. */
export const CRIT_TALENT_SELECTOR = ".wh-final-push-btn, .wh-never-die-btn, .wh-pain-illusion-btn";

/** Флаги сообщения (все — в белом списке card-once.mjs::CARD_ONCE_FLAGS). */
export const CRIT_TALENT_FLAGS = {
  finalPushUsed: "finalPushUsed", neverDieUsed: "neverDieUsed", painIllusionUsed: "painIllusionUsed",
  finalPushApplied: "finalPushApplied"
};

/**
 * Кнопки Талантов под Критическим Эффектом — только носителю; пусто, если Талантов нет.
 * @param {Actor} actor цель карточки
 * @param {object} o
 * @param {number} o.level      Отрицательные Раны (строка таблицы), с которых считан эффект
 * @param {string} o.damageType вид урона (ключ таблицы)
 * @param {string} o.hitLocation метка места (после переносов Прикрытием Головы и т. п.)
 * @param {number} [o.netDamage] непоглощённый урон удара — для пилюли «Загорается» в пересчитанном эффекте
 */
export function critTalentsHtml(actor, { level = 0, damageType = "", hitLocation = "", netDamage = 0 } = {}) {
  if (!actor?.uuid) return "";
  const uuid = esc(actor.uuid);
  const btns = [];
  if (hasResilienceTalent(actor, "finalPush")) {
    btns.push(`<button type="button" class="wh-final-push-btn" data-actor-uuid="${uuid}"
      title="Последний Рывок: тест T+0 — при успехе Критические Эффекты откладываются до конца Хода">
      ${rollIcon("run", "#ffb84d")} Последний Рывок (T+0)</button>`);
  }
  if (hasResilienceTalent(actor, "neverDie")) {
    btns.push(`<button type="button" class="wh-never-die-btn" data-actor-uuid="${uuid}"
      title="Не Умирать: за Очко Бесчестия игнорировать все эффекты Критического Эффекта (урон остаётся)">
      ${rollIcon("spark", "#ff6b6b")} Не Умирать (−1 Очко Бесчестия)</button>`);
  }
  if (hasResilienceTalent(actor, "painIsAnIllusion")) {
    btns.push(`<button type="button" class="wh-pain-illusion-btn" data-actor-uuid="${uuid}"
      data-level="${Number(level) || 0}" data-damage-type="${esc(damageType)}"
      data-hit-location="${esc(hitLocation)}" data-net-damage="${Number(netDamage) || 0}"
      title="Боль — Лишь Иллюзия: тест W+0 — эффект слабеет на число Успехов (не ниже уровня 1)">
      ${rollIcon("shield", "#8fd0ff")} Боль — Лишь Иллюзия (W+0)</button>`);
  }
  return btns.length ? `<div class="wh-crit-pills wh-crit-talents">${btns.join("")}</div>` : "";
}

/** Погасить кнопку: disabled, класс, подсказка с причиной. */
function dim(btn, reason) {
  btn.disabled = true;
  btn.classList?.add("wh-crit-ignored");
  btn.title = reason;
}

/**
 * Погасить на карточке ВСЕ эффекты Критического Эффекта (Не Умирать, Последний Рывок,
 * Боль — Лишь Иллюзия) и кнопки Талантов.
 * @param {Element} block блок `.dmg-critical-block`
 * @returns {number} сколько кнопок-эффектов погашено
 */
export function dimCritEffects(block, reason) {
  if (!block?.querySelectorAll) return 0;
  let n = 0;
  for (const btn of block.querySelectorAll(CRIT_EFFECT_SELECTOR)) {
    if (!btn.disabled) n++;
    dim(btn, reason);
  }
  for (const btn of block.querySelectorAll(CRIT_TALENT_SELECTOR)) dim(btn, reason);
  return n;
}

/** Класс кнопки-эффекта → вид отложенного эффекта. */
const KIND_BY_CLASS = [
  ["wh-crit-apply-btn", "apply"], ["wh-char-dmg-btn", "charDmg"], ["wh-crit-drop-btn", "drop"],
  ["wh-crit-death-btn", "death"], ["wh-shock-death-btn", "shockDeath"]
];

const kindOfButton = btn => KIND_BY_CLASS.find(([cls]) => btn.classList?.contains?.(cls))?.[1] ?? null;

/**
 * Снять с блока описания ещё не применённых кнопок-эффектов (для Последнего Рывка:
 * что отложить). Погашенные (проигнорированные Сладким Страданием, уже нажатые)
 * пропускаются.
 * @returns {Array<{kind:string, data:object, html:string}>} html — сама кнопка, чтобы
 *   напоминание в конце Хода показало ту же, живую
 */
export function collectCritEffects(block) {
  const out = [];
  if (!block?.querySelectorAll) return out;
  for (const btn of block.querySelectorAll(CRIT_EFFECT_SELECTOR)) {
    if (btn.disabled) continue;
    const kind = kindOfButton(btn);
    if (!kind) continue;
    const html = String(btn.outerHTML ?? "").replace(/\sdisabled(?:="[^"]*")?/g, "");
    out.push({ kind, data: { ...btn.dataset }, html });
  }
  return out;
}

/**
 * Привести показанную карточку в соответствие с флагами сообщения: что уже потрачено,
 * отложено или заменено. Зовётся на каждый показ карточки (hooks.mjs, renderChatMessageHTML).
 * @param {ChatMessage} message
 * @param {Element} root корень показанной карточки
 */
export function applyCritTalentState(message, root) {
  if (!message?.getFlag || !root?.querySelectorAll) return;
  const NS = "warhammer-dbc";
  const flag = k => !!message.getFlag(NS, k);
  for (const block of root.querySelectorAll(".dmg-critical-block")) {
    if (flag(CRIT_TALENT_FLAGS.neverDieUsed)) dimCritEffects(block, "Проигнорировано: Не Умирать");
    else if (flag(CRIT_TALENT_FLAGS.finalPushUsed)) dimCritEffects(block, "Отложено до конца Хода: Последний Рывок");
    else if (flag(CRIT_TALENT_FLAGS.painIllusionUsed)) dimCritEffects(block, "Эффект ослаблен: Боль — Лишь Иллюзия");
  }
  // Напоминание конца Хода (Последний Рывок): «Применить отложенные эффекты» нажата — раз на карточку.
  if (flag(CRIT_TALENT_FLAGS.finalPushApplied)) {
    for (const b of root.querySelectorAll(".wh-final-push-apply-btn, .wh-final-push-deferred .wh-crit-apply-btn, .wh-final-push-deferred .wh-char-dmg-btn, .wh-final-push-deferred .wh-crit-drop-btn"))
      dim(b, "Отложенные эффекты уже применены");
  }
}
