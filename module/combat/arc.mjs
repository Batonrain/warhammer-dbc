// module/combat/arc.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  Свойство оружия Дуга (Arc, стр. 166-170 + Книга Аэльдари): «На X+ на урон
//  выпускает молнию в другую цель» — если урон первого попадания достиг
//  порога X (arcRating), дуга бьёт Y(El) Dmg, Pen Y (arcDamage) по ближайшему
//  ДРУГОМУ токену в 5м от поражённой цели (module/constants/weapon-
//  properties.mjs — уже сведённый Y и для урона, и для Pen, оба значения
//  из одного rating2). Тикет wdbc-wlwf: не хватало только геометрии «кто
//  ближайший» — порог и вычисление Y уже были в aggregateAuto().
// ─────────────────────────────────────────────────────────────────────────────

import { tokenDistance } from "./facing.mjs";

/**
 * Ближайший другой токен (с актором) в пределах `maxMeters` от `originToken`.
 * @param {Token} originToken           Токен уже поражённой цели.
 * @param {Token[]} candidateTokens     Кандидаты на «вторую цель» (обычно
 *                                      canvas.tokens.placeables, без стрелка
 *                                      и без originToken).
 * @param {number} [maxMeters]          Радиус Дуги — 5м по книге.
 * @returns {Token|null}
 */
export function findArcTarget(originToken, candidateTokens, maxMeters = 5) {
  if (!originToken) return null;
  let best = null, bestDist = Infinity;
  for (const t of candidateTokens ?? []) {
    if (!t?.actor || t === originToken) continue;
    const d = tokenDistance(originToken, t);
    if (d == null || d > maxMeters) continue;
    if (d < bestDist) { bestDist = d; best = t; }
  }
  return best;
}
