// module/rules/squad-roles.mjs
// ════════════════════════════════════════════════════════════════════════
//  Роль актора в Отряде (squad) — вынесено из module/apps/mechanics.mjs
//  (было приватно там, служило только reconcileCohesionForActor) в общий
//  модуль, т.к. понадобилось и находкам Реестра Возможностей, завязанным
//  на «моего Командира» (Adjutant/Адъютант, Voice of God/Глас Божий,
//  wdbc-sk8s) — Foundry-версия mechanics.mjs эти функции по-прежнему
//  импортирует отсюда, а не дублирует.
//
//  Источник правды — flags/поля самого Отряда: system.posts.{leader,
//  commander,coordinator}.uuid + system.members[].uuid (Конструктор
//  kind:"cohesion" читает те же поля, см. COHESION_ROLE_OPTIONS в
//  mechanics.mjs).
// ════════════════════════════════════════════════════════════════════════

/** Роль актора (по uuid) в конкретном Отряде — null, если не состоит вовсе. */
export function squadRoleOf(squad, actorUuid) {
  if (!squad || !actorUuid) return null;
  const posts = squad.system?.posts || {};
  if (posts.leader?.uuid === actorUuid)      return "leader";
  if (posts.commander?.uuid === actorUuid)   return "commander";
  if (posts.coordinator?.uuid === actorUuid) return "coordinator";
  const inMembers = (squad.system?.members || []).some(m => m.uuid === actorUuid);
  return inMembers ? "subordinate" : null;
}

/** Отряд, в котором состоит актор (первый найденный — обычно он один). */
export function findMemberSquad(actorUuid) {
  if (!actorUuid) return null;
  return game.actors.find(a => a.type === "squad" && squadRoleOf(a, actorUuid) !== null) || null;
}

/**
 * Актор-Командир Отряда, в котором состоит данный актор — null, если актор
 * не в Отряде, в Отряде нет назначенного Командира, или Командир САМ и есть
 * этот актор (нет смысла быть «своим собственным Командиром» для находок
 * вида Adjutant/Voice of God, которым нужен ИМЕННО кто-то другой).
 */
export function commanderOf(actor) {
  const squad = findMemberSquad(actor?.uuid);
  const uuid = squad?.system?.posts?.commander?.uuid;
  if (!uuid || uuid === actor?.uuid) return null;
  // Тот же приём разрешения uuid → актор, что squad-sheet.mjs:176 (пост может
  // ссылаться на Токен — тогда нужен именно .actor, не сам документ Токена).
  try {
    const doc = fromUuidSync(uuid);
    return doc?.actor ?? doc ?? null;
  } catch {
    return null;
  }
}
