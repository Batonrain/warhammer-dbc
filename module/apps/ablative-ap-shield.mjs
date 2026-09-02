// module/apps/ablative-ap-shield.mjs
// ════════════════════════════════════════════════════════════════════════════
//  wdbc-bxw6 — Аблативный AP-щит (Роба Чемпиона + 5 бестиарных копий, стр.
//  434): «В начале своего хода персонаж может разменивать 1 тPR на 2
//  аблативных AP... В начале каждого нового раунда щит становится слабее на
//  1d5+1 AP и теряет 1 AP после каждого попадания, независимо от урона».
//
//  Сама трата 1 тPR (Threshold PR — толкание Психического Рейтинга через
//  порог) НЕ автоматизирована: в проекте нет схемного поля/теста под этот
//  конкретный психический размен, решение и издержки — за столом у ГМа
//  (тот же уровень честности, что у Reactive Plates/Reformation Song/
//  Ablative Hardening — см. их notes). activateAblativeApShield ниже — то,
//  что вызывается ПОСЛЕ того, как размен состоялся (вручную/макросом на
//  старте Хода владельца).
//
//  Угасание 1d5+1/Раунд и −1/попадание — уже полностью автоматизированы:
//  первое отсюда (вызывается из hooks.mjs::updateCombat на смену Раунда),
//  второе — module/combat/damage.mjs (тот же примитив, что и аблативные
//  моды брони, см. module/rules/ablative-ap.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { ablativeApAfterDecay } from "../rules/ablative-ap.mjs";

/** Активация: поднимает щит до amount (Роба Чемпиона — 2 аблативных AP). */
export async function activateAblativeApShield(actor, amount = 2) {
  await actor.update({
    "system.ablativeApShield.value": amount,
    "system.ablativeApShield.max":   amount
  });
}

/**
 * Угасание 1d5+1 в начале нового Раунда — для каждого комбатанта с ненулевым
 * щитом. Вызывается из hooks.mjs::updateCombat (тот же триггер "новый
 * Раунд", что и сброс счётчиков урона Орд рядом).
 */
export async function decayAblativeApShieldOnNewRound(combat) {
  for (const combatant of combat.combatants ?? []) {
    const actor = combatant.actor;
    const current = Number(actor?.system?.ablativeApShield?.value) || 0;
    if (current <= 0) continue;
    const roll = await new Roll("1d5+1").evaluate();
    await actor.update({ "system.ablativeApShield.value": ablativeApAfterDecay(current, roll.total) });
  }
}
