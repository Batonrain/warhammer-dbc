// module/combat/snapshot.mjs
// ════════════════════════════════════════════════════════════════════════
//  Snapshot / Выстрел Навскидку (wdbc-1rno, dodge.core.snapshot): «Если в
//  свой Ход персонаж подвигался не больше полудвижения, в конце Хода он
//  получает одно ОД как Задержкой, которое можно потратить только на
//  выстрел по брошенному предмету, игнорируя обычное ограничение на атаки
//  Задержкой» — здесь смоделирован только сам бонус: +1 к
//  system.actionPoints.value в конце Хода владельца, если
//  movement-actions.mjs::moveDegreeThisTurn не "full" (не двигался вовсе,
//  либо Полудвижение/Выход из Боя — обе SPD×1, одна физическая дистанция).
//
//  НЕ смоделировано — ограничение «только на выстрел по брошенному
//  предмету» и «игнорируя обычное ограничение на атаки Задержкой»: в
//  системе нет earmarked-подмножества ОД (пул полностью взаимозаменяем,
//  action-economy.mjs), и самого понятия «атака Задержкой» тоже нет нигде
//  в коде (Задержка — чисто нарративный приём между Ходами, ничем не
//  ограничена механически) — заводить пул под одну находку не оправдано
//  (тот же принцип, что Категория C wdbc-niv7: 1 находка не оправдывает
//  обобщение). Бонусное ОД тратится как обычное на что угодно — расхождение
//  задокументировано честно в capabilities.mjs, дух находки решает ГМ.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { hasActionEconomy } from "./action-economy.mjs";

export function hasSnapshot(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Snapshot"));
}

/** Конец Хода актора: +1 ОД, если Ход провёл без движения больше Полудвижения. */
export async function processSnapshotTurnEnd(actor) {
  if (!actor || !hasActionEconomy(actor) || !hasSnapshot(actor)) return;
  if (actor.getFlag("warhammer-dbc", "moveDegreeThisTurn") === "full") return;
  const value = Number(actor.system.actionPoints?.value) || 0;
  await actor.update({ "system.actionPoints.value": value + 1 });
}
