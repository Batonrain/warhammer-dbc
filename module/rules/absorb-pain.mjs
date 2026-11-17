// module/rules/absorb-pain.mjs
// «Через Боль» (Through the Pain, друкхари) — dbc-114, 14.11.2026, чистая логика без Foundry.
//
//  «За Реакцию впитывает страдания … — копит Очки Боли (макс. W.b; 1/раунд с цели).»
//  Радиус — P.b метров (как у эффекта боли). Очки Боли — пул fate у друкхари (rules/character.mjs).
//  Не смоделированы: условие «крит. эффект боли / болезненная смерть» цели — решает стол; траты Боли вместо Бесчестья.

export const ABSORB_PAIN_CAP = "pain.absorb";
export const ABSORB_PAIN_FLAG = "absorbPainRounds";

/** Ключ Раунда боя; вне боя — пустая строка (ограничения нет). */
export const absorbPainRoundKey = combat => (combat?.id ? `${combat.id}:${Number(combat.round) || 0}` : "");

/** Можно ли впитать боль с этой цели в этом Раунде: map — { uuid цели: ключ Раунда }. */
export function absorbPainAvailable(map, targetUuid, combat) {
  const key = absorbPainRoundKey(combat);
  return !key || (map ?? {})[targetUuid] !== key;
}

/** Цель в радиусе P.b метров (расстояние неизвестно — не блокируем, решает стол). */
export function absorbPainInRange(distanceM, perceptionBonus) {
  if (distanceM == null) return true;
  return Number(distanceM) <= Math.max(0, Number(perceptionBonus) || 0);
}

/** Новое значение пула Боли: +1, но не выше максимума. Возвращает { value, gained }. */
export function absorbPainGain(current, max) {
  const cur = Number(current) || 0;
  const cap = Number(max) || 0;
  const value = Math.min(cap, cur + 1);
  return { value, gained: value > cur };
}
