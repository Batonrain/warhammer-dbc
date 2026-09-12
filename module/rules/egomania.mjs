// module/rules/egomania.mjs
// ════════════════════════════════════════════════════════════════════════
//  Egomania / Эгомания (Слаанеш, wdbc-1rno, d100 13…15): «Он автоматически
//  побеждает в любом встречном тесте против социальных взаимодействий... Он
//  также может получать преимущества Командования, даже нарушая прямые
//  приказы своего командира, самостоятельно меняя цели, на которые он хотел
//  бы получить бонусы от Командования.»
//
//  Реализована ТОЛЬКО половина «встречный социальный тест» (isSocialSkill,
//  тот же признак apt2:"social", что уже отбирает область testMod modScope:
//  "social" у других находок этого тикета — resolve-test.mjs::isSocialSkill).
//
//  Половина «Командование» НЕ реализована — проверено (12.09.2026, не по
//  памяти): rules/command.mjs целиком про то, КАКОЙ ТИП актора получает
//  преимущества Присутствия (Орда/Оглох), а не про «следование приказу» или
//  «выбор цели, назначенной командиром» — такого гейта в коде нет вовсе ни
//  для одного подчинённого. Снимать нечего: система и так не проверяет,
//  чью цель выбрал подчинённый, получая бонус Командования — честно
//  «уже верно», как и «свободное действие» у Танца Обмана (wdbc-1rno).
// ════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";
import { isSocialSkill } from "./resolve-test.mjs";

export const EGOMANIA_CAPABILITY = "gift.slaanesh.egomania";

/** Автопобеда доступна: Дар есть, и тест — навык социальной группы (apt2:"social"). */
export function egomaniaAutoWins(actor, skillKey) {
  return hasRuleFlag(actor, EGOMANIA_CAPABILITY) && isSocialSkill(skillKey);
}

/**
 * Подменяет исход встречного сравнения победой актора, если применимо.
 * `side` — как actor называется в СВОЁМ сравнении ("mine" в kind-outcome.mjs,
 * где actor всегда бросающий; "theirs" в actor-sheet.mjs::
 * _maybePostOpposedComparison, где this.actor — отвечающая сторона).
 * Margin сохраняется (по модулю, не меньше 1) — только сторона победы
 * меняется, реальные числа обеих сторон никуда не делись.
 */
export function egomaniaOverrideResult(actor, skillKey, side, result) {
  if (!egomaniaAutoWins(actor, skillKey)) return result;
  return { winner: side, margin: Math.max(1, Math.abs(result?.margin) || 1) };
}
