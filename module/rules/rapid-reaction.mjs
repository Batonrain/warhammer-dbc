// module/rules/rapid-reaction.mjs
//
// Rapid Reaction / Быстрая Реакция (wdbc-1rno.3, capabilities.mjs
// general.core.rapidReaction): «Когда персонажа застали Врасплох, он может
// пройти тест на А+0, чтобы действовать обычным образом.» — реакция на
// Состояние conditions.surprised (стр. 12, «застигнут врасплох в начале
// боя»), НЕ на per-attack галочку «Цель Врасплох» (стр. 32, «Скрытная
// Атака») — решение чата 20.09.2026 (wdbc-1rno.3): это два разных
// книжных правила под одним словом, здесь только первое.

import { itemHasName } from "./predicates.mjs";

/** Есть ли у актора Rapid Reaction / Быстрая Реакция (талант или трейт). */
export function hasRapidReaction(actor) {
  return (actor?.items ?? []).some(item => (item?.type === "talent" || item?.type === "trait") &&
    (itemHasName(item, "Rapid Reaction") || itemHasName(item, "Быстрая Реакция")));
}
