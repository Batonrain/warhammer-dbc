// module/combat/actor-combat.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Этот бой» для цели — начатый бой, в котором она участвует (game-combat-rad).
//
//  Не game.combat: это бой, открытый в трекере у нажавшего кнопку
//  (ui.combat.viewed), и у ГМа он может быть чужим подготовленным
//  столкновением. Правило, которое помнит что-то «за этот бой», запомнило бы
//  попадание под чужим боем — и в своём бою не сработало бы.
//
//  Читатели: Rad (X) — счёт «10+ урона в T за бой» (combat/radiation.mjs) и
//  «Бич Чемпионов» — враг, уже ранивший в этом бою
//  (combat/strange-invulnerability.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { actorIdentityUuids } from "./command-state.mjs";

/**
 * Начатый бой, где актор — участник, и актор бойца из трекера.
 * Сравнение по набору uuid личности (мировой актор + актор токена): токены
 * персонажей по умолчанию НЕсвязанные, и мировой Actor.x не равен
 * Scene.s.Token.t.Actor.x из трекера боя (combat/command-state.mjs).
 * @returns {{combat: Combat, actor: Actor}|null}
 */
export function combatEntryOf(actor) {
  const mine = actorIdentityUuids(actor);
  if (!mine.size) return null;
  for (const c of globalThis.game?.combats ?? []) {
    if (!c.started) continue;
    for (const cb of c.combatants ?? []) {
      if ([...actorIdentityUuids(cb.actor)].some(u => mine.has(u))) return { combat: c, actor: cb.actor };
    }
  }
  return null;
}

/** Начатый бой, где актор участвует, или null. */
export const combatOfActor = actor => combatEntryOf(actor)?.combat ?? null;
