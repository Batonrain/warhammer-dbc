// module/rules/dance-of-pain.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Dance of Pain / Танец Боли (Черта Воина Ноты; Разобрать u6c9x). Книга: «Раз
//  в Ход, когда наносит попадание рукопашной или метательной атакой по
//  сочленению врага и пробивает его броню, может также нанести цели 1d10+A.b
//  урона в A.»
//
//  На карточке рукопашного/метательного попадания носителя — кнопка урона в A
//  цели (общая кнопка combat/char-damage-button.mjs). Сочленение и пробитие
//  брони видит игрок по исходу урона: книга оставляет это его решению, а
//  «раз в Ход» отслеживает флаг Хода DANCE_OF_PAIN_FLAG — кнопку после
//  применения в этом Ходу карточка не предлагает.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { charDamageButtonHtml } from "../combat/char-damage-button.mjs";

export const DANCE_OF_PAIN_FLAG = "danceOfPainThisTurn";

export function hasDanceOfPain(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "trait" && itemHasName(i, "Dance of Pain"));
}

export function danceOfPainOffered(actor, { isMelee, hit } = {}) {
  if (!isMelee || !hit || !hasDanceOfPain(actor)) return false;
  return !(actor?.getFlag?.("warhammer-dbc", DANCE_OF_PAIN_FLAG) ?? actor?.flags?.["warhammer-dbc"]?.[DANCE_OF_PAIN_FLAG]);
}

export function danceOfPainButtonHtml(actor, targetUuid = "") {
  const ab = Math.max(0, Number(actor?.system?.characteristics?.ag?.bonus) || 0);
  const btn = charDamageButtonHtml({ formula: `1d10+${ab}`, keys: ["ag"] }, { actorUuid: targetUuid, source: "Танец Боли" });
  return `<div class="roll-defense-note wh-dance-of-pain" data-actor-uuid="${actor?.uuid ?? ""}">Танец Боли (раз в Ход): если попадание пришлось по сочленению и пробило броню — ${btn}</div>`;
}
