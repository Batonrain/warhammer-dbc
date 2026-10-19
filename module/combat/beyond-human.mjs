// module/combat/beyond-human.mjs
// ════════════════════════════════════════════════════════════════════════
//  За Гранью Человека, вторая половина (стр. 62) — Foundry-обвязка к
//  module/rules/beyond-human.mjs. [книга] «при перебросе тестов на эту
//  Характеристику может выбрать оставить первый результат, вместо того,
//  чтобы принимать второй (восстанавливая потраченное Очко Бесчестия, если
//  переброс был от его траты)».
//
//  Переброс за Очко в системе — пункт меню Очков на карточке (hooks.mjs::
//  _attachFateContextMenu): он не заменяет карточку, а кладёт рядом новую.
//  Поэтому «оставить первый» — не откат броска, а решение по двум готовым
//  карточкам:
//    • новая карточка получает кнопку «Оставить первый результат»;
//    • нажатие возвращает Очко (если переброс был за своё), гасит новую
//      карточку (кнопки отключены, сверху пометка) и объявляет, что в силе
//      остаётся первая — она никуда не девалась.
//  Это работает и для теста Навыка/Характеристики, и для атаки: у атаки
//  переброс заново бросает всю атаку (место попадания, урон, защита), и
//  гасить приходится именно её карточку.
//
//  [допущение] Очко Чемпиона, одолженное Вдохновляющим Присутствием, не
//  «своё» — первый результат оставить можно, но Очко Чемпиона не возвращается.
//  [допущение] Дальше первого переброса не идём: «первый» — результат
//  карточки, с которой переброшено.
// ════════════════════════════════════════════════════════════════════════

import { canKeepFirstResult, firstResultOutcome } from "../rules/beyond-human.mjs";
import { changeActorInfamy } from "../apps/infamy-points.mjs";
import { grantTempInfamy, tempInfamyInfo } from "../rules/temp-infamy.mjs";
import { runCardOnce } from "./card-once.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

/** Ключ флага сообщения с данными о переброске. */
export const BEYOND_HUMAN_FLAG = "beyondHumanReroll";

/**
 * Данные о переброске для флагов новой карточки. null — оставить первый
 * результат нельзя (нет Таланта на эту Характеристику), кнопки не будет.
 * @param {Actor} actor бросающий
 * @param {object} p
 * @param {string} p.charKey Характеристика теста
 * @param {number} p.firstRv первый результат d100
 * @param {?number} p.threshold Порог первого результата (null — не известен)
 * @param {?object} p.spend итог spendFromInfamyPool своего Очка; null — Очко чужое
 */
export function beyondHumanRerollData(actor, { charKey, firstRv, threshold = null, spend = null } = {}) {
  if (!actor || !canKeepFirstResult(actor, charKey)) return null;
  return {
    actorUuid: actor.uuid, charKey,
    firstRv: Number(firstRv), threshold: threshold == null ? null : Number(threshold),
    own: !!spend,
    temp: Number(spend?.tempSpent) > 0,
    tempSource: spend?.tempSource ?? "", tempRestriction: spend?.tempRestriction ?? ""
  };
}

/** Данные о переброске с сообщения (тест — в самом флаге, атака — в опциях). */
export function beyondHumanDataOf(message) {
  const f = message?.flags?.[NS] ?? {};
  return f[BEYOND_HUMAN_FLAG] ?? f.attack?.opts?.[BEYOND_HUMAN_FLAG] ?? null;
}

/** Блок с кнопкой для отрисованной карточки; пустая строка — кнопки нет. */
export function keepFirstButtonHtml(data, { used = false } = {}) {
  if (!data?.actorUuid) return "";
  const hint = data.own
    ? "Первый результат остаётся в силе, эта карточка аннулируется, потраченное Очко возвращается."
    : "Первый результат остаётся в силе, эта карточка аннулируется (Очко Чемпиона не возвращается).";
  return `<div class="roll-threshold"><button type="button" class="wh-beyond-human-keep-btn"
      ${used ? "disabled" : ""} title="${esc(hint)}"
      >↩ За Гранью Человека: оставить первый результат (${data.firstRv})</button></div>`;
}

/** Возврат Очка туда, откуда оно было списано. */
async function refundPoint(actor, data) {
  if (!data.own) return false;
  if (data.temp) {
    const info = tempInfamyInfo(actor);
    await grantTempInfamy(actor, 1, {
      source: data.tempSource || info?.source || "За Гранью Человека",
      restriction: data.tempRestriction || info?.restriction || ""
    });
    return true;
  }
  await changeActorInfamy(actor, 1);
  return true;
}

/** Содержимое аннулированной карточки: пометка сверху, кнопки отключены. */
export function voidedContent(content) {
  const banner = `<div class="roll-crit roll-crit-failure">↩ Аннулировано: оставлен первый результат (За Гранью Человека)</div>`;
  return banner + String(content ?? "").replace(/<button\b/g, "<button disabled");
}

/**
 * Обработчик кнопки. true — первый результат оставлен.
 * @param {ChatMessage} message карточка переброса (вторая)
 */
export async function keepFirstResult(message) {
  const data = beyondHumanDataOf(message);
  const actor = data?.actorUuid ? await fromUuid(data.actorUuid).catch(() => null) : null;
  if (!data || !actor) { ui.notifications?.warn("Персонаж не найден."); return false; }
  if (!actor.isOwner) { ui.notifications?.warn("Оставить первый результат может только владелец персонажа."); return false; }
  if (!canKeepFirstResult(actor, data.charKey)) {
    ui.notifications?.warn(`${actor.name}: нет Таланта «За Гранью Человека» на эту Характеристику.`);
    return false;
  }
  // Литерал ключа — белый список сокета (CARD_ONCE_FLAGS, combat/card-once.mjs).
  return runCardOnce(message, "beyondHumanKept", async () => {
    const refunded = await refundPoint(actor, data);
    try { await message.update({ content: voidedContent(message.content) }); }
    catch (e) { console.warn("Warhammer DBC | За Гранью Человека: не удалось погасить карточку переброса:", e); }

    const first = firstResultOutcome({ rv: data.firstRv, threshold: data.threshold });
    const abbr = CHARACTERISTICS[data.charKey]?.abbr ?? data.charKey;
    const outcome = first.success == null
      ? `<span class="roll-success">В силе первый результат: ${data.firstRv}</span>`
      : first.success
        ? `<span class="roll-success">В силе первый результат: Успех — ${first.deg} ${_degWord(first.deg)}</span>`
        : `<span class="roll-failure">В силе первый результат: Провал — ${first.deg} ${_degWord(first.deg)}</span>`;
    await postTestCard(actor, {
      icon: rollIcon("spark", "#4dffa6"),
      title: `За Гранью Человека (${esc(abbr)}) — ${esc(actor.name)}`,
      lines: [
        rollStatLine({ label: "Первый бросок", rv: data.firstRv, threshold: data.threshold }),
        `<div class="roll-threshold">Переброс аннулирован.${refunded ? " Потраченное Очко возвращено." : " Очко Чемпиона не возвращается."}</div>`
      ],
      outcome
    }, { sound: false, speaker: message.speaker });
    return true;
  }, "Здесь первый результат уже оставлен.");
}
