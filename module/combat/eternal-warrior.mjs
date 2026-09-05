// module/combat/eternal-warrior.mjs
// ════════════════════════════════════════════════════════════════════════
//  Eternal Warrior/Вечный Воин (Дар Кхорн, wdbc-sk8s): «Если персонаж
//  умирает, находясь в Ярости, он может один раз за сессию провести
//  Чудесное Спасение или Божественную Защиту без траты Бесчестия и
//  получения Порчи. Если он умирает от дистанционной атаки с расстояния
//  больше его дистанции Натиска, он может вместо траты этого одного заряда
//  на сессию потратить Очко Бесчестия.»
//
//  Два пути к тому же «бесплатному» спасению, применимы только в Ярости
//  (actor.system.inRage — то же поле, что читает combat/frenzy.mjs):
//    1. FREE — раз за сессию, полностью бесплатно (0 траты пула, 0 Порчи).
//       Троттлинг — module/rules/cooldown.mjs, unit "session".
//    2. FLAT — вместо расхода разового заряда, фиксированная 1 Очко
//       Бесчестия (без кубика, без Порчи). «Дистанция Натиска» нигде в
//       движке не отслеживается (нет понятия «откуда шёл последний
//       смертельный выстрел») — тот же честный компромисс, что у Deadly
//       Effectiveness: игрок сам подтверждает флажком в диалоге Смерти
//       (module/sheets/tabs/death.mjs), а не автоопределение.
//
//  Стоимость самого Спасения/Защиты в обоих случаях считает
//  module/sheets/tabs/death.mjs::_resolveFateSave (Foundry-зависимая часть,
//  бросок/запись на актора) — этот модуль отвечает только за «доступно ли
//  и в Ярости ли персонаж», как и остальные читатели wdbc-sk8s.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";
import { isThrottleReady, markThrottleUsed } from "../rules/cooldown.mjs";

const FLAG = "eternalWarrior";

/** Владеет ли актор Даром Eternal Warrior / Вечный Воин (kind:mutation). */
export function hasEternalWarrior(actor) {
  return hasAbility(actor, "ability.eternalWarrior", "Eternal Warrior", "mutation");
}

/** Дар применим прямо сейчас: есть и Ярость (оба пути требуют её). */
export function eternalWarriorEligible(actor) {
  return hasEternalWarrior(actor) && !!actor?.system?.inRage;
}

/** Путь 1 (FREE) доступен: Ярость + разовый заряд сессии ещё не потрачен. */
export function eternalWarriorFreeSaveAvailable(actor) {
  return eternalWarriorEligible(actor) && isThrottleReady(actor, FLAG, "session");
}

/** Отметить разовый заряд сессии потраченным (только путь FREE). */
export async function markEternalWarriorUsed(actor) {
  await markThrottleUsed(actor, FLAG, "session");
}
