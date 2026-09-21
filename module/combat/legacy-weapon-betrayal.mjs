// module/combat/legacy-weapon-betrayal.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Наследие Предательства, Оружие Наследия (История 4, стр. 427, wdbc-1rno.35)
//  — единственный пункт записи, требующий геометрии сцены: «На нат. 100 на
//  попадание оружие попадает по случайному союзнику в той же рукопашной
//  (мельте) / в пределах 3 м от цели (стрелковая)» — само попадание УЖЕ
//  разрешено, эта функция только выбирает НОВОГО получателя урона.
//
//  Нет союзника-кандидата рядом (только цель и атакующий, некому промахнуться
//  «мимо») — книга этот случай не разбирает; честно оставляем исходное
//  попадание по исходной цели, а не выдумываем следствие.
// ════════════════════════════════════════════════════════════════════════════

import { tokenRect } from "./horde-tokens.mjs";
import { contactType } from "../rules/tactical-map.mjs";
import { tokenRelationship } from "../regions/auras.mjs";
import { measureTokens } from "./tactical-map.mjs";

const BETRAYAL_RANGED_RADIUS_M = 3;

function alliesOf(sourceToken, matches) {
  const sourceDoc = sourceToken?.document ?? sourceToken;
  if (!sourceDoc) return [];
  const others = canvas?.tokens?.placeables ?? [];
  const out = [];
  for (const other of others) {
    const otherDoc = other.document ?? other;
    // Сравнение по ДОКУМЕНТУ, не по ссылке: attackerToken сюда приходит из
    // resolveAttackerToken (facing.mjs) — это уже TokenDocument
    // (getActiveTokens(false, true)), а не сам placeable из
    // canvas.tokens.placeables, иначе атакующий не отсеялся бы от самого себя.
    if (otherDoc === sourceDoc) continue;
    if (tokenRelationship(sourceDoc.disposition, otherDoc.disposition) !== "ally") continue;
    if (matches(other)) out.push(other);
  }
  return out;
}

/** Союзники АТАКУЮЩЕГО, что в контакте с ним (рукопашная ветка Истории). */
export function alliesInMeleeContact(attackerToken) {
  const rectA = tokenRect(attackerToken);
  if (!rectA) return [];
  return alliesOf(attackerToken, other => {
    const rectB = tokenRect(other);
    return !!rectB && contactType(rectA, rectB) !== "none";
  });
}

/** Союзники ЦЕЛИ в пределах 3 м от неё (стрелковая ветка Истории). */
export function alliesNearTarget(targetToken) {
  if (!tokenRect(targetToken)) return [];
  return alliesOf(targetToken, other => {
    const m = measureTokens(targetToken, other);
    return m != null && m.edgeM <= BETRAYAL_RANGED_RADIUS_M;
  });
}

/**
 * Случайный союзник-получатель попадания вместо исходной цели.
 * @returns {Token|null} null — некого выбрать, попадание остаётся по цели.
 */
export function betrayalRandomAllyToken({ isMelee, attackerToken, targetToken }) {
  const pool = isMelee ? alliesInMeleeContact(attackerToken) : alliesNearTarget(targetToken);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
