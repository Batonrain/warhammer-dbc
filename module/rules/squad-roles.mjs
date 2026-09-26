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

import { commandBlockReason } from "./command.mjs";

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

/** Присутствие с выбранным ключом активно у этого командного узла (Отряд/сбродный Командир). */
function presenceGrants(commandNode, key) {
  return !!commandNode?.active && commandNode?.benefit === key;
}

/**
 * Маловажные NPC (стр. 34, wdbc-x1nz.2.51): «не могут наносить Экстремальный
 * Урон, но могут получить эту способность от своих командиров через эффекты
 * Командования» — Командное Присутствие, вариант «Экстремальный Урон»
 * (constants/squad.mjs::PRESENCE_BENEFITS, key "extreme").
 *
 * Два независимых источника Присутствия, ветка не эксклюзивна:
 *   1. Отряд (squad), в котором состоит миньон — system.presence
 *      (module/sheets/squad-sheet.mjs).
 *   2. «Под моим Присутствием» — сбродная команда без сведения в Отряд
 *      (module/sheets/tabs/command.mjs) — commandedBy на самом миньоне
 *      указывает на командира, у него — system.command.presence.
 *
 * Орда — та же масса Маловажных NPC: «Контроль Орды» прямо оставляет ей
 * эффект 1 Присутствия, который имеет смысл лишь тогда, когда без него
 * Экстремального Урона нет. Источники Присутствия у неё те же два.
 *
 * Прочим (персонажам, демонам, технике...) правило не адресовано вовсе —
 * функция сразу отдаёт true.
 */
export function minionCanCauseExtremeDamage(actor) {
  if (actor?.type !== "minion" && actor?.type !== "horde") return true;
  // Оглох/Без сознания — Присутствие не доходит вовсе (rules/command.mjs).
  if (commandBlockReason(actor)) return false;
  const squad = findMemberSquad(actor.uuid);
  // Проваливший Мораль боец Отряда теряет все преимущества Командования.
  const entry = (squad?.system?.members || []).find(m => m.uuid === actor.uuid);
  if (presenceGrants(squad?.system?.presence, "extreme") && !entry?.moraleLost) return true;

  // "commandedBy" — тот же флаг/скоуп, что module/sheets/tabs/command.mjs::
  // COMMANDED_BY_FLAG пишет на подчинённого при добавлении в «Под моим
  // Присутствием» (rules/ намеренно не импортирует sheets/, поэтому строка
  // ключа продублирована литералом, а не константой оттуда).
  const commandedBy = actor.getFlag?.("warhammer-dbc", "commandedBy");
  if (commandedBy?.uuid) {
    try {
      const doc = fromUuidSync(commandedBy.uuid);
      const commander = doc?.actor ?? doc ?? null;
      if (presenceGrants(commander?.system?.command?.presence, "extreme")) return true;
    } catch { /* командир недоступен/удалён */ }
  }
  return false;
}
