// module/combat/extra-turn.mjs
// ════════════════════════════════════════════════════════════════════════
//  Доп. Ход в том же бою (wdbc-1rno, инфраструктура для The Middle of the
//  Hunt/Середина Охоты — доп. Ход на раундах 3-4, Last Actor/Последний
//  Актёр — три Хода в раунде вместо одного). Foundry считает Ходы по числу
//  Combatant в отсортированном порядке инициативы, НЕ по числу уникальных
//  акторов — стандартный для Foundry-систем приём «доп. Ход» это ВТОРОЙ
//  (третий, ...) Combatant того же актора/токена в том же Combat, а не
//  особое поле счётчика. Отсюда все функции работают с `combat.combatants`
//  напрямую (Foundry Collection — Map-подобная, метод find() есть у
//  настоящего документа; тестовые подставные бои передают обычный массив,
//  у которого find() тоже есть).
//
//  Метка source (произвольная строка — "middleOfTheHunt", "lastActor" и
//  т.п.) отличает СВОИ доп.-Ходовые Combatant от чужих и от РЕАЛЬНЫХ
//  Combatant актора — без неё revokeExtraTurn мог бы случайно удалить
//  основной Combatant или чужую находку той же природы.
// ════════════════════════════════════════════════════════════════════════

const EXTRA_TURN_FLAG = "extraTurnSource";

/** Список доп.-Ходовых Combatant этого актора с данным тегом source в этом бою. */
function extraTurnCombatants(combat, actorId, source) {
  return [...(combat?.combatants ?? [])].filter(c =>
    c?.actorId === actorId && c?.getFlag?.("warhammer-dbc", EXTRA_TURN_FLAG) === source);
}

/** Есть ли уже доп. Ход этого актора с данным тегом source в этом бою. */
export function hasExtraTurn(combat, actorId, source) {
  return extraTurnCombatants(combat, actorId, source).length > 0;
}

/**
 * Сколько доп.-Ходовых Combatant этого актора с данным тегом сейчас в бою —
 * нужно находкам с фиксированным числом доп. Ходов (Last Actor — 2 доп. к
 * обычному = 3 всего), чтобы не плодить лишние при повторном вызове.
 */
export function extraTurnCount(combat, actorId, source) {
  return extraTurnCombatants(combat, actorId, source).length;
}

/**
 * Выдать один доп. Ход: создаёт ЕЩЁ ОДНОГО Combatant того же актора/токена
 * в текущем Combat с уникальной инициативой (если не задана явно —
 * `combat.combatants` уже существующего Combatant этого актора минус
 * дробная добавка, чтобы не столкнуться точным совпадением инициативы —
 * коллизия с чужим Combatant не критична, Foundry сортирует стабильно).
 * Возвращает созданный документ Combatant, или null, если combat не задан.
 */
export async function grantExtraTurn(combat, { actorId, tokenId = null, source, initiative = null }) {
  if (!combat || !actorId || !source) return null;
  const data = {
    actorId, tokenId,
    flags: { "warhammer-dbc": { [EXTRA_TURN_FLAG]: source } }
  };
  if (initiative != null) data.initiative = initiative;
  const [created] = await combat.createEmbeddedDocuments("Combatant", [data]);
  return created ?? null;
}

/** Снять ВСЕ доп. Ходы этого актора с данным тегом source (конец способности/боя). */
export async function revokeExtraTurn(combat, actorId, source) {
  const ids = extraTurnCombatants(combat, actorId, source).map(c => c.id);
  if (ids.length) await combat.deleteEmbeddedDocuments("Combatant", ids);
}
