// module/rules/one-against-a-hundred.mjs
// ════════════════════════════════════════════════════════════════════════
//  One Against A Hundred / Один Против Сотни (wdbc-u0by, элитный архетип
//  «Клинковое Воинство»): «Сражаясь против Орды или Низших Миньонов врага,
//  персонаж получает Преимущество на все тесты против них (включая
//  физическое избегание их атак)».
//
//  Смоделирована только Преимущество-часть, и только для Орды: у актора
//  миньона (module/data/actor/minion.mjs) нет поля «тир» — «Низшего»
//  программно не отличить от любого другого миньона, только по имени
//  предмета-источника, что ненадёжно. Devastating (WS.b) по Орде и предел
//  непоглощённого урона 10/раунд — другие механики, не переброс/Преимущество,
//  этой находкой не покрыты (см. capabilities.mjs, gift.khorne / соотв. ключ).
//
//  Симметрична: атакующая сторона проверяет, Орда ли ЦЕЛЬ (attack-dialog.mjs),
//  защищающаяся — Орда ли АТАКУЮЩИЙ (combat/defense.mjs), тем же признаком
//  actor.type === "horde", что уже используют Storm of Lead/Свинцовый Дождь
//  и подобные находки этой сессии.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { hasAbility } from "./ability-by-key.mjs";

export function hasOneAgainstAHundred(actor) {
  return hasAbility(actor, "ability.oneAgainstAHundred", "One Against A Hundred", "talent");
}

/** Преимущество на ЭТОТ тест (атака/избегание) — противная сторона Орда И у актора есть Талант. */
export function oneAgainstAHundredAdvantage(actor, opponentIsHorde) {
  return !!opponentIsHorde && hasOneAgainstAHundred(actor);
}
