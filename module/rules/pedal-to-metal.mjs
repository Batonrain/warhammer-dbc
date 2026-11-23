// module/rules/pedal-to-metal.mjs
// Pedal to Metal / Педаль в Пол (Талант Пилота; Разобрать jqrr4). Книга: «Водитель может
// увеличить SPD машины на свой P.b, но в этот Ход машина не может поворачивать и до начала
// следующего Хода водителя не может совершать Виражи или Уклонения.»
// Метка живёт на машине: {bonus, driverUuid, combatId, round, turn}. Срок — до начала
// следующего Хода водителя (тот же счёт, что у Острия Копья). Запрет поворота ведёт стол.

import { itemHasName } from "./predicates.mjs";

export const PEDAL_FLAG = "pedalToMetal";
const NS = "warhammer-dbc";

export function hasPedalToMetal(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, "Pedal to Metal"));
}

export function pedalOf(vehicle) {
  return vehicle?.flags?.[NS]?.[PEDAL_FLAG] ?? vehicle?.getFlag?.(NS, PEDAL_FLAG) ?? null;
}

/**
 * Действует ли «Педаль в Пол» сейчас. Метка, поставленная вне боя (combatId ""), действует,
 * пока боя нет; в начатом бою её срок истёк — иначе она вечна и Вираж отказывает навсегда.
 */
export function pedalActive(mark, combat) {
  if (!mark) return false;
  if (!mark.combatId) return !combat?.started;
  if (!combat || combat.id !== mark.combatId) return false;
  const round = Number(combat.round) || 0, turn = Number(combat.turn) || 0;
  if (round === mark.round) return true;
  return round === mark.round + 1 && turn < mark.turn;
}

/** Прибавка к SPD машины сейчас. */
export function pedalSpdBonus(vehicle, combat = globalThis.game?.combat) {
  const mark = pedalOf(vehicle);
  return pedalActive(mark, combat) ? Math.max(0, Number(mark.bonus) || 0) : 0;
}

/** Метка боя истекла (или бой не тот) — её пора снять, иначе SPD держит прибавку до пересчёта листа. */
export function pedalExpired(mark, combat) {
  return !!mark && (!!mark.combatId || !!combat?.started) && !pedalActive(mark, combat);
}
