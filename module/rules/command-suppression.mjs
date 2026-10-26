// module/rules/command-suppression.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЗАПРЕТ КОМАНДОВАНИЯ ОТ «РИСОВКИ» (Талант «Рукопашных» Show-Off, Sahara 3-8dc5).
//
//  Книга: «Если он побеждает, цели до начала его следующего Хода теряют все преимущества
//  Командования и не могут получать новых.»
//
//  Метка лежит на ЦЕЛИ (flags.warhammer-dbc.commandSuppressed = {giverUuid, combatId, round})
//  и несёт, чьего Хода ждать: снимает её НЕ Ход цели (общий реестр rules/turn-flags.mjs гасит
//  метки на Ходу их носителя — здесь срок чужой), а начало следующего Хода Рисующегося
//  (combat/command-state.mjs::expireCommandsAtTurnStart) или конец боя. Пока метка действует,
//  над целью нет ни одного узла командования (commandNodesFor) и не работает Концентрация
//  Огня — то есть ни одно преимущество Командования до неё не доходит.
//
//  Чистый модуль без импортов: его читает источник правил «command», круга быть не должно.
// ════════════════════════════════════════════════════════════════════════════

/** Ключ флага цели. */
export const COMMAND_SUPPRESSED_FLAG = "commandSuppressed";

/** Метка: кто наложил (uuid Рисующегося), в каком бою и Раунде. */
export function commandSuppression(giverUuid, combat) {
  return { giverUuid: String(giverUuid ?? ""), combatId: combat?.id ?? "", round: Number(combat?.round) || 0 };
}

/** Действует ли метка сейчас: есть и относится к текущему бою. */
export function commandSuppressedNow(flag, combat) {
  return !!flag && !!combat && !!flag.combatId && flag.combatId === combat.id;
}

/**
 * Пора ли снять метку на старте Хода. Снимается, когда начался Ход того, кто её наложил, и
 * Раунд уже позже наложения («до начала его следующего Хода», а не того же); метка прошлого
 * боя истекла всегда.
 * @param {object} flag
 * @param {{combat:object, isGiver:(uuid:string)=>boolean}} p  isGiver — «это Ход этого бойца»
 */
export function commandSuppressionExpired(flag, { combat, isGiver }) {
  if (!flag) return false;
  if (!combat || flag.combatId !== combat.id) return true;
  return !!isGiver?.(flag.giverUuid) && Number(combat.round) > Number(flag.round);
}
