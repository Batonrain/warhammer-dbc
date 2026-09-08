// module/rules/unseen-beggar.mjs
// ════════════════════════════════════════════════════════════════════════
//  Незримый Нищий / Unseen Beggar (Дар Нургла, d100 81..84, wdbc-1rno):
//  «Если персонаж носит ТОЛЬКО снаряжение Качеством Poor.Q, он может за
//  полудействие наложить на себя чары этого дара, выглядя в глазах всех
//  наблюдателей, обладающих душами, как ещё один нищий, не стоящий их
//  внимания. Он так же за полудействие может развеять эти чары.»
//
//  Сама иллюзия — поведение наблюдателей, а не состояние актора: её движок
//  не считает и считать не должен (тот же уровень, что у Иконы
//  Богохульства). Зато считается ГЕЙТ, и он тут не формальность: «только
//  Poor.Q» игрок иначе проверяет глазами по всему инвентарю и ошибается
//  ровно на том предмете, о котором забыл. Здесь — включение просто не
//  проходит, и карточка называет виновников поимённо.
//
//  Что считается «снаряжением»: НАДЕТОЕ/взятое (system.equipped) среди типов
//  предметов, у которых Качество вообще есть, — armor, weapon, gear,
//  forcefield. Импланты (implant) намеренно НЕ считаются: книга говорит
//  «носит», а имплант вживлён, его не снять полудействием, и Poor.Q-бионика
//  запирала бы Дар навсегда без всякой связи с внешним видом нищего.
//  Ненадетое в рюкзаке тоже не считается — на вид оно не влияет.
// ════════════════════════════════════════════════════════════════════════

import { itemIs } from "./item-marker.mjs";

export const UNSEEN_BEGGAR = "gift.nurgle.unseenBeggar";
const NAME = "Unseen Beggar";

/** Типы предметов, чьё Качество видно снаружи и потому считается «снаряжением». */
export const GEAR_TYPES_WITH_QUALITY = ["armor", "weapon", "gear", "forcefield"];

/** Это Дар Нургла «Незримый Нищий»? */
export function isUnseenBeggarItem(item) {
  return itemIs(item, "mutation", UNSEEN_BEGGAR, NAME);
}

/**
 * Надетое снаряжение Качеством ЛУЧШЕ Poor.Q — то, что мешает наложить чары.
 * Пустой массив = гейт пройден.
 *
 * @param {Iterable} items предметы актора
 * @returns {Array<{name: string, quality: string}>}
 */
export function betterThanPoorEquipped(items) {
  const out = [];
  for (const item of items ?? []) {
    if (!GEAR_TYPES_WITH_QUALITY.includes(item?.type)) continue;
    if (!item?.system?.equipped) continue;
    const q = String(item.system.quality || "common");
    if (q !== "poor") out.push({ name: item.name || "(без имени)", quality: q });
  }
  return out;
}

/** Можно ли наложить чары прямо сейчас. */
export function unseenBeggarGateOk(items) {
  return betterThanPoorEquipped(items).length === 0;
}
