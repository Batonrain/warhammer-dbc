// module/apps/cybernetic-excellence.mjs
//
// Foundry-часть автоматизации Таланта «Cybernetic Excellence / Кибернетическое
// Превосходство» (см. rules/cybernetic-excellence.mjs для чистых функций):
// держит Трейт «Multiple Arms / Многорукий (X)» актора в согласии с числом
// покупок Таланта — заводит его при первой покупке, поднимает/снимает рейтинг
// при повторных покупках/продаже, не трогает вклад ДРУГИХ источников того же
// Трейта (раса, мутации, импланты и т.п.).
//
// Идемпотентно: собственный вклад этой синхронизации хранится флагом
// ceContribution НА САМОМ ТРЕЙТЕ (не на Таланте — тот может быть удалён,
// а Трейт с чужим вкладом должен остаться).

import { rescaleTraitByRating } from "./mechanics.mjs";
import { cyberneticExcellencePurchases, isMultipleArmsTrait } from "../rules/cybernetic-excellence.mjs";

const FLAG = "warhammer-dbc";
const CONTRIB_FLAG = "ceContribution";
const BASE_ARMS = 2;   // обычные руки без Трейта — «X» шаблона считает их частью общего числа.

/** Черта-шаблон «Multiple Arms» из компендиума Трейтов, если есть. */
async function fetchMultipleArmsTemplate() {
  const pack = game.packs?.get("warhammer-dbc.traits");
  if (!pack) return null;
  const index = await pack.getIndex();
  const hit = index.find(e => isMultipleArmsTrait({ type: "trait", name: e.name }));
  return hit ? pack.getDocument(hit._id) : null;
}

/**
 * Подгоняет рейтинг Трейта «Multiple Arms» под текущее число покупок
 * Cybernetic Excellence. Вызывается из createItem/updateItem/deleteItem —
 * безопасно вызывать чаще, чем нужно: при отсутствии изменений ничего не пишет.
 */
export async function syncCyberneticExcellenceArms(actor) {
  if (!actor || !(actor instanceof Actor)) return;

  const purchases = cyberneticExcellencePurchases(actor.items);
  const trait = [...actor.items].find(isMultipleArmsTrait) || null;
  const prevContribution = trait ? (Number(trait.getFlag(FLAG, CONTRIB_FLAG)) || 0) : 0;
  if (purchases === prevContribution) return;

  // Ничего не куплено, и своего Трейта у нас никогда не было — нечего делать.
  if (purchases === 0 && !trait) return;

  if (!trait) {
    const src = await fetchMultipleArmsTemplate();
    if (!src) return;   // пак ещё не готов/недоступен — тихо выходим, следующий вызов подхватит
    const data = src.toObject();
    delete data._id;
    const rating = BASE_ARMS + purchases;
    rescaleTraitByRating(data, rating);
    data.system.hasRating = true;
    data.system.rating = rating;
    data.flags = { ...(data.flags || {}), [FLAG]: { ...(data.flags?.[FLAG] || {}), [CONTRIB_FLAG]: purchases } };
    await actor.createEmbeddedDocuments("Item", [data]);
    return;
  }

  const nextRating = Math.max(0, (Number(trait.system?.rating) || 0) - prevContribution + purchases);
  // <= BASE_ARMS, не только <= 0: если своего вклада не осталось и рейтинг
  // упал ровно до «обычных 2 рук», сам Трейт больше ничего не сообщает — на
  // сброшенном Таланте оставлять его дальше незачем (никто не держит на
  // листе «Multiple Arms (2)» просто чтобы отметить норму).
  if (nextRating <= BASE_ARMS && purchases === 0) {
    await trait.delete();
    return;
  }
  await trait.update({ "system.rating": nextRating, [`flags.${FLAG}.${CONTRIB_FLAG}`]: purchases });
}
