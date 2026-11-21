// module/rules/heavy-body.mjs
// ════════════════════════════════════════════════════════════════════════
//  ТЯЖЁЛОЕ ТЕЛО — запреты движения и брони у Черт, которые делают тело
//  слишком тяжёлым для обычного передвижения (Sahara 2, 5, 576-51a6):
//
//   • Fleshmetal Body / Тело Из Плотеметалла (Облитератор): «Не способен
//     носить броню … не может совершать Прыжки или Бег, скорость Натиска
//     уменьшается до скорости Полного Движения»;
//   • Lumbering Giant / Громыхающий Гигант (Секутор): «не может совершать
//     Бег, Прыжки или движение со SPD×3 в Ход (кроме телепортации)».
//
//  Что считает система:
//   • Бег и Прыжок — кнопки отказывают (combat/movement-actions.mjs);
//   • Натиск — не дальше Полного Движения (SPD×2), Бег на листе урезан до
//     той же дальности (rules/character/movement.mjs, heavyBodyMovementCap) —
//     у Гиганта именно так и выходит «не больше SPD×3 в Ход»;
//   • броня — Облитератору нельзя надеть никакую, кроме поглощённой
//     Самоперековыванием (метка Живого Арсенала на броне) — sheets/tabs/
//     gear.mjs::equipItem; уже надетую на старых листах не снимаем;
//   • Расчленитель (Талант Облитератора) в режиме ближнего боя «убирает
//     ограничение на Бег и скорость Натиска» — Прыжки остаются запрещены.
//
//  Чистый модуль без Foundry.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { mutilatorActive, ARSENAL_FLAG } from "./obliterator-talents.mjs";

export const HEAVY_BODIES = Object.freeze([
  { names: ["Fleshmetal Body", "Тело Из Плотеметалла"], label: "Тело Из Плотеметалла", noArmour: true, mutilator: true },
  { names: ["Lumbering Giant", "Громыхающий Гигант"], label: "Громыхающий Гигант", noArmour: false, mutilator: false }
]);

/** Черта тяжёлого тела у актора (первая найденная) или null. */
export function heavyBodyOf(actor) {
  const traits = [...(actor?.items ?? [])].filter(i => i?.type === "trait");
  return HEAVY_BODIES.find(b => traits.some(i => b.names.some(n => itemHasName(i, n)))) ?? null;
}

/** Ограничены ли Бег и Натиск: тяжёлое тело и Расчленитель не снял ограничение. */
export function heavyBodyLimitsRun(actor) {
  const body = heavyBodyOf(actor);
  return !!body && !(body.mutilator && mutilatorActive(actor));
}

/** Натиск и Бег — не дальше Полного Движения. */
export function heavyBodyMovementCap({ halfMove, move, charge, run }) {
  return { halfMove, move, charge: Math.min(charge, move), run: Math.min(run, move) };
}

/**
 * Причина запрета действия или "" — можно.
 * @param {"run"|"jump"} what  Бег (Расчленитель снимает запрет) или Прыжок (не снимает)
 */
export function heavyBodyMoveBan(actor, what) {
  const body = heavyBodyOf(actor);
  if (!body) return "";
  if (what === "run" && !heavyBodyLimitsRun(actor)) return "";
  return `${body.label}: ${what === "run" ? "Бег" : "Прыжки"} невозможн${what === "run" ? "ен" : "ы"}.`;
}

/** Причина запрета надеть этот предмет брони или "" — можно. */
export function heavyBodyArmourBan(actor, item) {
  if (item?.type !== "armor") return "";
  if (item.flags?.["warhammer-dbc"]?.[ARSENAL_FLAG] ?? item.getFlag?.("warhammer-dbc", ARSENAL_FLAG)) return "";
  const body = heavyBodyOf(actor);
  return body?.noArmour ? `${body.label}: броню носить нельзя — Облитератор формирует её из собственного тела.` : "";
}
