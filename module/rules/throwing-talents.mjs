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
import { hasAbility } from "./ability-by-key.mjs";

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

// ── Гренадер ────────────────────────────────────────────────────────────────

export const GRENADIER = Object.freeze({ key: "throwing.core.grenadier", name: "Grenadier" });

/**
 * Гренадер (core.json, «Метание», Sahara 3-8318): «Если брошенная им граната
 * промахнулась, он может уменьшить дистанцию смещения на BS.b. Если после этого
 * взрыв не задевает ни одного врага, или задевает союзные цели, персонаж может
 * перебросить направление смещения».
 *
 * Здесь — только «чей это бросок и на сколько можно уменьшить»: BS.b для броска
 * гранаты стрелковым оружием-гранатой, иначе 0. Сами кнопки — на карточке атаки
 * (смещение бывает только у Взрывного «под цель», attack.mjs); «не задел врагов /
 * задел союзников» решает стол — в системе у смещённого взрыва нет списка накрытых.
 * Не моделируется: «не получает штрафов на попадание при броске рикошетом»
 * (рикошета броска гранаты в системе нет).
 */
export function grenadierScatterReduce(actor, { sys, isMelee, bsBonus }) {
  if (isMelee || sys?.weaponType !== "grenade") return 0;
  if (!hasAbility(actor, GRENADIER.key, GRENADIER.name, "talent")) return 0;
  return Math.max(0, Number(bsBonus) || 0);
}

/** Дистанция смещения после уменьшения (не ниже 0). */
export const reducedScatterDistance = (distance, reduce) => Math.max(0, (Number(distance) || 0) - (Number(reduce) || 0));
