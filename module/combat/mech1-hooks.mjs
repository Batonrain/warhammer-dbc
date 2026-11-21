// module/combat/mech1-hooks.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Точки входа Черт и Талантов Архимагоса, Лакрималлуса, Малагры и Монарха в
//  общие хуки (module/hooks.mjs): одна строка регистрации и одна строка в
//  начале Хода, чтобы не дописывать hooks.mjs на каждую способность.
//
//   • processMech1TurnStart(actor) — начало Хода носителя (активный ГМ, после
//     resetActionEconomy): Астральный Конвертер +1 заряд Катушки, Совершенная
//     Катушка гаснет, Вэнефактор +1 ОД и +1 Реакция, вассалы Короны +1 ОД;
//   • registerMech1Hooks() — Лик Гнева: Страх снимается вместе с выключением
//     Таланта (конец боя/сцены).
//  Импорт combat/archmagos.mjs здесь же загружает его источник правил
//  «archmagosConcordax» (самозапись, rules/source-registry.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { onVisioIraeItemUpdate } from "./archmagos.mjs";
import { itemHasName } from "../rules/predicates.mjs";

/** Обработчики начала Хода по архетипам. */
const TURN_START = [];

export async function processMech1TurnStart(actor) {
  if (!actor) return;
  try {
    for (const fn of TURN_START) await fn(actor);
  } catch (e) { console.error("warhammer-dbc | mech1 turn start", e); }
}

export function registerMech1Hooks() {
  Hooks.on("updateItem", async (item, changes, _opts, userId) => {
    if (game.user?.id !== userId || item?.type !== "talent" || !itemHasName(item, "Visio Irae")) return;
    if (!changes?.flags?.["warhammer-dbc"]) return;
    await onVisioIraeItemUpdate(item);
  });
}
