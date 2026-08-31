// module/combat/death-dance.mjs
// ════════════════════════════════════════════════════════════════════════
//  Death Dance / Смертельный Танец (Талант Аэльдари, wdbc-sk8s):
//
//  «Раз в битву после натиска, но до нанесения попаданий, персонаж может
//  добавить себе трейт Brutal Charge (+A.b). Можно использовать ещё раз
//  за 1 очко судьбы; последующее восстановление до новой битвы требует на
//  +1 очко судьбы больше.»
//
//  Реализовано НЕ как выдача предмета-трейта (пришлось бы создавать и потом
//  убирать embedded Item на каждую атаку), а как разовая прибавка к тому же
//  «Бонусу урона» (#atk-dmg-bonus), что игрок и так может вписать руками в
//  диалоге атаки (module/sheets/attack-dialog.mjs) — механически идентично
//  «+A.b урона этой атаки», раз attack.mjs суммирует dmgBonus безусловно.
//  Кнопка показывается только при выбранной Базе «Натиск» (opts.baseKey === "charge").
//
//  Счётчик использований за бой — throttleCount(actor, FLAG, "battle") из
//  module/rules/cooldown.mjs: 0 использований = следующее бесплатно, 1 = уже
//  использован раз, следующее стоит 1 ОС, и т.д. (цена = число прошлых
//  использований в ЭТОМ бою). Верхнего предела нет — incrementThrottleCount
//  вызывается с max:Infinity, единственный реальный гейт — хватает ли ОС.
// ════════════════════════════════════════════════════════════════════════

import { throttleCount, incrementThrottleCount } from "../rules/cooldown.mjs";
import { itemHasName } from "../rules/predicates.mjs";

const FLAG = "deathDance";

/** Владеет ли актор Талантом Death Dance / Смертельный Танец. */
export function hasDeathDance(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Death Dance"));
}

/** Сколько раз уже использован в ТЕКУЩЕМ бою — 0, если бой сменился или ещё не использовался. */
export function deathDanceUsedCount(actor) {
  return throttleCount(actor, FLAG, "battle");
}

/** Цена ОЧКАМИ СУДЬБЫ следующего использования — 0 для первого раза в бою. */
export function deathDanceNextCost(actor) {
  return deathDanceUsedCount(actor);
}

/** Отмечает использование потраченным в этом бою (звать ПОСЛЕ успешной траты ОС, если она требовалась). */
export async function markDeathDanceUsed(actor) {
  await incrementThrottleCount(actor, FLAG, "battle", Infinity);
}
