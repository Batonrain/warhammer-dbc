// module/rules/determination-to-fight.mjs
// ════════════════════════════════════════════════════════════════════════
//  Determination To Fight / Решительность Сражаться (wdbc-niv7, Книга
//  Аэльдари: Ответвления, Элитный архетип «Воин Троп»): «Имея отрицательные
//  раны, персонаж снижает весь получаемый урон на WP.b (после поглощения,
//  минимум 1)...» — только эта часть находки смоделирована здесь.
//
//  «Отрицательные раны» = Тир Ран "dying" (module/rules/wound-tier.mjs,
//  displayKey критического уровня). Место применения — та же точка
//  расширения incomingDamageReduction, что уже читает module/combat/
//  damage.mjs::applyDamageToActor (wdbc-ls9d) — плоское снижение ПОСЛЕ
//  поглощения, отдельно от AP/T.b.
//
//  НЕ смоделировано этой находкой (см. capabilities.mjs,
//  exodite.pathWarrior.determinationToFight): «+1 ОД» и «лимит атак до
//  двух» — эти два условны на ТО ЖЕ состояние (отрицательные раны), а
//  actionPoints.max сейчас считается только статичными ActiveEffect, не
//  по текущему состоянию Ран каждый прогон prepareDerivedData — нужен
//  отдельный примитив «динамический потолок ОД от состояния актора»,
//  которого в системе ещё нет («лимит атак» отдельно — не блокер, в
//  системе вообще нет счётчика атак за Ход, поднимать нечего). Также не
//  смоделирован пункт «если прошлый раунд был в Защитной Стойке» — нужна
//  история Стойки МЕЖДУ раундами, которой актор сейчас не хранит
//  (system.meleeStance — только текущее значение).
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

export function hasDeterminationToFight(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Determination To Fight"));
}

/** Доп. снижение входящего урона (WP.b, минимум 1) при отрицательных Ранах. */
export function determinationToFightReduction(actor) {
  if (actor?.system?.wounds?.tier !== "dying") return 0;
  if (!hasDeterminationToFight(actor)) return 0;
  return Math.max(1, Number(actor?.system?.characteristics?.wp?.bonus) || 0);
}
