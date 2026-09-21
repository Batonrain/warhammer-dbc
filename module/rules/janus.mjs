// module/rules/janus.mjs
//
// Janus / Янус (мутация, «Общие мутации», wdbc-1rno.3): «Дополнительные
// глаза могут обеспечивать ему обзор сзади или за углом» — раньше честно
// нечем было обходить (facing/слепая зона не считались нигде в системе),
// с wdbc-1rno.3 появился реальный примитив (combat/facing.mjs::
// isOutsideDefenderView, «Скрытная Атака» стр. 32), и Janus — первый
// потребитель: носитель не должен попадать под авто-детект «вне обзора»
// по геометрии, у него практически круговой обзор.
//
// Книга не требует АКТИВАЦИИ доп. глаз для самого факта обзора (полудействие
// нужно только чтобы ПЕРЕМЕСТИТЬ их в другую точку тела) — трактуется как
// постоянный пассивный эффект, пока предмет есть на акторе, тот же уровень
// честности, что у других пассивных мутаций в проекте.

import { itemIs } from "./item-marker.mjs";

const CAPABILITY_KEY = "mutation.janus";
const NAME = "Janus";

export function isJanusItem(item) {
  return itemIs(item, "mutation", CAPABILITY_KEY, NAME);
}

/** Несёт ли актор Janus — практически круговой обзор для целей facing/слепой зоны. */
export function hasJanusRearVision(actor) {
  return (actor?.items ?? []).some(isJanusItem);
}
