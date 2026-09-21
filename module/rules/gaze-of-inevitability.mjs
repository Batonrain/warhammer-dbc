// module/rules/gaze-of-inevitability.mjs
//
// Gaze of Inevitability / Взор Неизбежности (Дар Нургла, wdbc-1rno.3) —
// ПАССИВНАЯ половина, недостающая часть capability gift.nurgle.
// gazeOfInevitability (активная половина — концентрация на W−30 через
// kind:"script" — уже реализована, см. capabilities.mjs).
//
// Книжный текст (packs-src/mutations/Дары_Богов/Нургл/Gaze_of_Inevitability):
// «Противники, что могут видеть глаза персонажа (или визоры его брони),
// должны комбинировать любой тест на Избегание ОТ ЕГО АТАК с тестом на
// W−10. Если они проваливают этот тест, они теряют все свои Реакции.»
//
// «От его атак» — узкое условие: НЕ любое Избегание где угодно на сцене, а
// только когда носитель Дара — АТАКУЮЩИЙ в этой конкретной атаке. Решение
// чата 20.09.2026 (wdbc-1rno.3): «Комбинированный» — обычные правила этой
// системы для комбинированных тестов (rules/test-kind.mjs::combinedThreshold,
// уже применяются у theResolveKindOutcome «Комбинированный» — Math.min из
// двух Порогов, один бросок d100). Подключено в module/combat/defense.mjs
// (_performDodge/_performParry) — единственное место, где известны и
// защищающийся, и attackerActor одновременно.

import { itemIs } from "./item-marker.mjs";

const CAPABILITY_KEY = "gift.nurgle.gazeOfInevitability";
const NAME = "Gaze of Inevitability";

/** Это предмет-Дар «Gaze of Inevitability / Взор Неизбежности»? */
export function isGazeOfInevitabilityItem(item) {
  return itemIs(item, "mutation", CAPABILITY_KEY, NAME);
}

/** Несёт ли актор этот Дар. */
export function hasGazeOfInevitability(actor) {
  return (actor?.items ?? []).some(isGazeOfInevitabilityItem);
}
