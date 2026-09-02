// module/rules/dodge-advantage.mjs
// ════════════════════════════════════════════════════════════════════════
//  Dancing Among The Fire / Танец Среди Огня (wdbc-u0by): «Совершая
//  физическое избегание против Короткой или Длинной Очереди, персонаж
//  получает Преимущество на это избегание» — Уклонение И Парирование (оба —
//  «физическое избегание», стр. 12), только против Очереди (rofMode
//  semi/full — тот же признак burst, что уже вычисляет module/combat/
//  attack.mjs и передаёт в карточку атаки для других находок, напр. Storm
//  of Lead).
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

export function hasDancingAmongTheFire(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Dancing Among The Fire"));
}

/** Преимущество на ЭТО Уклонение/Парирование — атака была Очередью И у защищающегося есть Талант. */
export function danceOfFireAdvantage(actor, burst) {
  return !!burst && hasDancingAmongTheFire(actor);
}
