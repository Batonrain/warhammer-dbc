// module/rules/sturdy.mjs
// Крепкий (Sturdy) — dbc-114, 14.11.2026, чистая логика без Foundry.
//
//  «+20 на тесты сопротивления Борьбе и Оглушению; +30 на тесты сопротивления сбиванию с ног и
//  отбрасыванию.»
//
//  Подключено в встречные тесты, где Крепкий — сопротивляющаяся сторона: Захват и действия Борьбы
//  (combat/grapple.mjs), Повалить (combat/knockdown.mjs), Напролом (sheets/tabs/combat.mjs).
//  Не подключено: Оглушение — у приёма «Оглушить» нет теста сопротивления (Стальная Челюсть —
//  необязательный тест носителя); отбрасывание — принудительного сдвига токена в системе нет.

import { hasRuleFlag } from "./flags.mjs";

export const STURDY_CAP = "resist.sturdy";
export const STURDY_BONUS = Object.freeze({ grapple: 20, stun: 20, knockdown: 30, knockback: 30 });

/** Модификаторы сопротивляющегося актора в формате встречных тестов: [{label, value}] или []. */
export function sturdyResistMods(actor, kind) {
  const value = STURDY_BONUS[kind];
  return value && actor && hasRuleFlag(actor, STURDY_CAP) ? [{ label: "Крепкий", value }] : [];
}
