// module/combat/tactical-map.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАКТИЧЕСКАЯ КАРТА (wdbc-8k0i) — обвязка чистой геометрии rules/tactical-map.mjs
//  под реальный Foundry: чтение расы/брони актора, живой ресинк размера токена,
//  перевод пары токенов сцены в измеренную дистанцию/вид контакта.
// ════════════════════════════════════════════════════════════════════════════

import { baseSizeCells, edgeDistanceMeters, centerDistanceMeters, contactType }
  from "../rules/tactical-map.mjs";
import { raceDef } from "../apps/race-library.mjs";
import { tokenRect } from "./horde-tokens.mjs";
import { tokenRelationship } from "../regions/auras.mjs";
import { pxPerMeter } from "./templates.mjs";

/** Типы акторов личного масштаба, которым автоматизируем размер Базы. */
export const BASE_SIZE_TYPES = ["character", "daemon", "demonPrince", "minion"];

/** Крупная ли раса актора (Огрин и т.п.) — по флагу расы, не по `size`/SPD. */
function raceLargeBase(actor) {
  return !!raceDef(actor?.system?.race)?.largeBase;
}

/** Надета ли сейчас броня, помеченная крупной Базой (Терминаторская и т.п.). */
function armorLargeBase(actor) {
  return !!actor?.items?.some(i => i.type === "armor" && i.system?.equipped && i.system?.largeBase);
}

/** Размер Базы актора в клетках (2 или 3) — резолвит флаги, зовёт чистое правило. */
export function actorBaseSizeCells(actor) {
  return baseSizeCells({ raceLarge: raceLargeBase(actor), armorLarge: armorLargeBase(actor) });
}

/**
 * Живой ресинк размера токена: prototypeToken (новые токены) + все активные
 * токены актора на текущей сцене (по требованию пользователя — не только
 * будущие токены, но и уже стоящие на столе меняются сразу).
 * @param {Actor} actor
 */
export async function syncTokenBaseSize(actor) {
  if (!actor || !BASE_SIZE_TYPES.includes(actor.type)) return;
  const size = actorBaseSizeCells(actor);
  const proto = actor.prototypeToken;
  if (proto && (proto.width !== size || proto.height !== size)) {
    await actor.update({ "prototypeToken.width": size, "prototypeToken.height": size });
  }
  // Пакетом по сценам: отдельный doc.update на каждый токен — это раунд-трип
  // и перерисовка канвы на каждый, updateEmbeddedDocuments делает это разом.
  const perScene = new Map();
  for (const token of actor.getActiveTokens?.(true, true) ?? []) {
    const doc = token.document ?? token;
    if (doc.width === size && doc.height === size) continue;
    if (!perScene.has(doc.parent)) perScene.set(doc.parent, []);
    perScene.get(doc.parent).push({ _id: doc.id, width: size, height: size });
  }
  for (const [scene, updates] of perScene) await scene.updateEmbeddedDocuments("Token", updates);
}

/**
 * Дистанции/контакт между двумя токенами сцены — Базы вписаны в их
 * прямоугольники (`tokenRect`, клетки), метры считаются через
 * `canvas.dimensions.distancePixels` (тот же приём, что у Шаблонов/Остаётся).
 * @param {Token} tokenA
 * @param {Token} tokenB
 * @returns {{edgeM:number, centerM:number, contact:"none"|"base"|"deep"}|null}
 */
export function measureTokens(tokenA, tokenB) {
  const rectA = tokenRect(tokenA), rectB = tokenRect(tokenB);
  if (!rectA || !rectB) return null;
  const size = canvas?.grid?.size || canvas?.scene?.grid?.size || 100;
  const cellMeters = size / pxPerMeter();
  return {
    edgeM:   edgeDistanceMeters(rectA, rectB, cellMeters),
    centerM: centerDistanceMeters(rectA, rectB, cellMeters),
    contact: contactType(rectA, rectB)
  };
}

/**
 * Число вражеских токенов сцены в Базовом/Глубоком контакте с атакующим —
 * «дерётся ли персонаж 1-на-1» (Дуэлянтское, стр. 73 Книги Аэльдари) без
 * ручного пересчёта на глаз. Не различает, отвлечён ли сам враг на кого-то
 * ещё — «никто не мешает» в книге про то, мешают ли атакующему, а не о
 * занятости противника.
 * @param {Token} attackerToken
 * @returns {number}
 */
export function meleeContactCount(attackerToken) {
  const rectA = tokenRect(attackerToken);
  if (!rectA) return 0;
  const attackerDoc = attackerToken.document ?? attackerToken;
  const others = canvas?.tokens?.placeables ?? [];
  let count = 0;
  for (const other of others) {
    if (other === attackerToken) continue;
    const otherDoc = other.document ?? other;
    if (tokenRelationship(attackerDoc.disposition, otherDoc.disposition) !== "enemy") continue;
    const rectB = tokenRect(other);
    if (!rectB) continue;
    if (contactType(rectA, rectB) !== "none") count++;
  }
  return count;
}
