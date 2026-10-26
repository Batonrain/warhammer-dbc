// module/combat/full-attack-lock.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Foundry-обвязка запрета Физических Избеганий после Полной Атаки (правила и
//  книжный текст — rules/full-attack-lock.mjs).
//
//  • markFullAttack(actor, weapon)  — attack.mjs, при каждой рукопашной атаке с
//    Базой «Полная Атака»: ставит метку fullAttackLock (гаснет в начале
//    следующего Хода актора — rules/turn-flags.mjs);
//  • markFuriousChild(actor)        — attack.mjs, успешная дополнительная атака
//    Яростного Штурма: открывает Реприз;
//  • avoidanceVerdict(actor, kind)  — defense.mjs, перед Уклонением/Парированием.
//
//  Запрет действует только в бою и только для тех, у кого есть экономика действий
//  (там же, где метку гасит начало Хода): вне боя метка не ставится, а оставшаяся
//  от закончившегося боя — игнорируется.
// ════════════════════════════════════════════════════════════════════════════

import { hasActionEconomy, isEncounterActive } from "./action-economy.mjs";
import {
  FULL_ATTACK_LOCK_FLAG, fullAttackLockOf, lockAfterFullAttack, lockAfterFuriousChild, physicalAvoidanceVerdict
} from "../rules/full-attack-lock.mjs";

const NS = "warhammer-dbc";

/** Рукопашная Полная Атака состоялась: Физические Избегания закрыты до начала следующего Хода. */
export async function markFullAttack(actor, weapon) {
  if (!isEncounterActive() || !hasActionEconomy(actor) || typeof actor?.setFlag !== "function") return false;
  const combatId = game.combat?.id ?? "";
  let prev = fullAttackLockOf(actor);
  if (prev?.combatId && prev.combatId !== combatId) prev = null;   // метка прошлого боя не копится
  await actor.setFlag(NS, FULL_ATTACK_LOCK_FLAG, { ...lockAfterFullAttack(prev, weapon), combatId });
  return true;
}

/** Успешная дополнительная атака Яростного Штурма — Реприз разрешает Парирование. */
export async function markFuriousChild(actor) {
  const prev = fullAttackLockOf(actor);
  const next = lockAfterFuriousChild(prev, actor);
  if (!next || next === prev || typeof actor?.setFlag !== "function") return false;
  await actor.setFlag(NS, FULL_ATTACK_LOCK_FLAG, next);
  return true;
}

/** Можно ли сейчас Уклоняться/Парировать: { blocked, penalty, reason, note }. */
export function avoidanceVerdict(actor, kind) {
  if (!isEncounterActive()) return { blocked: false, penalty: 0, reason: "", note: "" };
  return physicalAvoidanceVerdict(actor, kind, game.combat?.id ?? "");
}
