// module/rules/morituri.mjs
// Идущие на Смерть (Morituri, Гладиатор) — dbc-114, 14.11.2026, чистая логика без Foundry.
//
//  «При получении непоглощённого урона в часть тела с AP 2 или меньше от носимой брони, уменьшает этот
//  урон (после поглощения) в 3 раза (окр. вверх). Также может тратить очки Момента, чтобы игнорировать
//  Оглушение, Кровотечение или получение Усталости (1 очко за каждый эффект).»
//  Очки Момента (Трейт Момент) в системе не заведены — вторая часть не смоделирована.

export const MORITURI_CAP = "damage.morituri";
export const MORITURI_MAX_AP = 2;
export const MORITURI_DIVISOR = 3;

/** Непоглощённый урон после Идущих на Смерть: AP носимой брони места ≤ 2 — делится на 3 (окр. вверх). */
export function morituriDamage(netDamage, wornAp) {
  const net = Number(netDamage) || 0;
  if (net <= 0) return net;
  return (Number(wornAp) || 0) <= MORITURI_MAX_AP ? Math.ceil(net / MORITURI_DIVISOR) : net;
}
