// module/rules/aoe-target.mjs
// ════════════════════════════════════════════════════════════════════════
//  Разовая выборка «все токены в радиусе N м от кастера» — для АКТИВНЫХ
//  одноразовых эффектов вида «Костяная Песнь: техника в радиусе W м, либо
//  вся техника в радиусе 10 м» (wdbc-sk8s), НЕ для живых Аур
//  (module/regions/auras.mjs — Region-движок, continuous re-check по хукам).
//  Здесь — разовый снимок сцены в момент применения способности, дальше не
//  живёт и никак не подписан на движение токенов.
//
//  Переиспользует ЧИСТУЮ функцию замера module/regions/auras.mjs::
//  tokenDocDistance (документная дистанция, центр-к-центру, с учётом
//  высоты) — второй копии той же формулы в проекте по возможности быть не
//  должно.
// ════════════════════════════════════════════════════════════════════════

import { tokenDocDistance } from "../regions/auras.mjs";

/**
 * Токены сцены каст-токена в радиусе N метров, с актором.
 * @param {TokenDocument} casterToken
 * @param {number} radiusMeters
 * @param {{includeSelf?: boolean, actorType?: string|null, includeHidden?: boolean}} [opts]
 *   includeSelf — включать ли сам casterToken (по умолчанию нет);
 *   actorType — фильтр по actor.type (напр. "vehicle" — техника), null = любой;
 *   includeHidden — включать ли скрытых токенов (по умолчанию нет: цель
 *     разового эффекта должна быть видна кастеру, тем же приёмом, что
 *     sweepAurasOnScene в auras.mjs фильтрует visible для целей выдачи).
 * @returns {TokenDocument[]}
 */
export function tokensWithinRadius(casterToken, radiusMeters, opts = {}) {
  const { includeSelf = false, actorType = null, includeHidden = false } = opts;
  const scene = casterToken?.parent;
  if (!scene) return [];
  return scene.tokens.contents.filter(t => {
    if (!includeHidden && t.hidden) return false;
    if (!t.actor) return false;
    const isSelf = t.id === casterToken.id;
    if (isSelf && !includeSelf) return false;
    if (actorType && t.actor.type !== actorType) return false;
    const distance = isSelf ? 0 : tokenDocDistance(casterToken, t, scene.grid);
    return distance <= (Number(radiusMeters) || 0);
  });
}
