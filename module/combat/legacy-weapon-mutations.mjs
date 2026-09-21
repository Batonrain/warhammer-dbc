// module/combat/legacy-weapon-mutations.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Оружие Наследия — Мутации, чьё условие завязано на геометрию сцены
//  (wdbc-1rno.35). Отдельно от rules/legacy-weapon.mjs по тому же принципу,
//  что legacy-weapon-betrayal.mjs: канвас/токены здесь, чистая книжная логика
//  там (rules/legacy-weapon.mjs уже импортируется sources.mjs → collect.mjs,
//  цикл через combat/tactical-map.mjs недопустим, см. шапку sources.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { tokenRect } from "./horde-tokens.mjs";
import { tokenRelationship } from "../regions/auras.mjs";
import { measureTokens } from "./tactical-map.mjs";

/** Полные Раны (ноль урона) — «неповреждённая» цель книги. */
function isUndamaged(actor) {
  const w = actor?.system?.wounds;
  if (!w) return false;
  return (Number(w.value) || 0) >= (Number(w.max) || 0);
}

/** Ближайший НЕПОВРЕЖДЁННЫЙ враг атакующего — токен или null. */
export function nearestUndamagedEnemyToken(attackerToken) {
  const rectA = tokenRect(attackerToken);
  if (!rectA) return null;
  const attackerDoc = attackerToken?.document ?? attackerToken;
  const others = canvas?.tokens?.placeables ?? [];
  let best = null, bestDist = Infinity;
  for (const other of others) {
    const otherDoc = other.document ?? other;
    if (otherDoc === attackerDoc) continue;
    if (tokenRelationship(attackerDoc.disposition, otherDoc.disposition) !== "enemy") continue;
    if (!isUndamaged(other.actor)) continue;
    const m = measureTokens(attackerToken, other);
    if (!m) continue;
    if (m.edgeM < bestDist) { bestDist = m.edgeM; best = other; }
  }
  return best;
}

/** Текущая цель — тот самый ближайший неповреждённый враг? (Кровожадное, стрелковая) */
export function isNearestUndamagedEnemy({ attackerToken, targetToken }) {
  if (!targetToken) return false;
  const nearest = nearestUndamagedEnemyToken(attackerToken);
  if (!nearest) return false;
  return (nearest.document ?? nearest) === (targetToken.document ?? targetToken);
}
