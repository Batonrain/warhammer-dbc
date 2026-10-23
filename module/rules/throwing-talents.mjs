// module/rules/throwing-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Таланты Метания (глава 3, группа «Метание»). Сейчас здесь один — Балеарец.
//
//  Balearic / Балеарец (A 50, Athletics+10) [книга]: «Он добавляет ½A.b (окр.▲)
//  к S.b в расчёте дальности и урона метательного и примитивного стрелкового
//  оружия.»
//
//  Сделан УРОН метательного оружия (класс «thrown» — единственный стрелковый
//  класс, который в системе получает S.b к урону, combat/attack.mjs). Дальность
//  (S.b×3 м) и «примитивное стрелковое» остаются за столом: у примитивного
//  стрелкового S.b в расчёте урона нет вовсе, добавлять не к чему (3-8318).
//
//  Чистая логика без Foundry; hasRuleFlag — единственная зависимость.
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";

/** Возможность, которую выдаёт Талант «Балеарец» (запись Конструктора в паке). */
export const BALEARIC_CAPABILITY = "throwing.core.balearic";

/**
 * Прибавка к S.b метательного оружия: ½A.b вверх. 0 — Таланта нет.
 * @param {object} actor
 * @param {number} [agilityBonus] A.b; по умолчанию с листа актора
 */
export function balearicSbBonus(actor, agilityBonus = actor?.system?.characteristics?.ag?.bonus) {
  if (!hasRuleFlag(actor, BALEARIC_CAPABILITY)) return 0;
  const ab = Number(agilityBonus) || 0;
  return ab > 0 ? Math.ceil(ab / 2) : 0;
}
