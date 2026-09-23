// module/rules/blindness.mjs
//
// Ослеплён (wdbc-x1nz.2.89, «Раны и Урон», «Статусы»): «Если персонаж способен
// ориентироваться и определять цели альтернативными чувствами (обычно через
// Трейты Sonar Sense и Unnatural Senses), все штрафы Ослепления
// игнорируются».
//
// Штрафы Ослепления живут в четырёх местах: тесты Навыков/Характеристик
// (rules/library/conditions.mjs, conditions.blinded — там снятие вытеснением),
// строка «Ослеплён» окна атаки (sheets/attack-dialog.mjs), Трудный Ландшафт
// (combat/movement-terrain.mjs) и «все атаки по нему Незримые»
// (combat/attack.mjs). Три последних спрашивают ЭТОТ файл — один ответ на
// вопрос «страдает ли актор от слепоты», а не три копии проверки Черт.

import { isBlindedActor, itemHasName } from "./predicates.mjs";
import { hasRuleFlag } from "./flags.mjs";
import { ALT_SENSES_TRAITS, ALT_SENSES_CAPABILITIES } from "./library/conditions.mjs";

/**
 * Есть ли у актора альтернативные чувства: Черта (или Талант/Мутация) Sonar
 * Sense / Unnatural Senses по имени — тем же сравнением, что предикат hasTrait,
 * — либо та же способность, выданная Возможностью Конструктора.
 */
export function hasAlternativeSenses(actor) {
  if (!actor) return false;
  const named = [...(actor.items ?? [])].some(i =>
    (i?.type === "trait" || i?.type === "talent" || i?.type === "mutation")
    && ALT_SENSES_TRAITS.some(name => itemHasName(i, name)));
  if (named) return true;
  return ALT_SENSES_CAPABILITIES.some(flag => hasRuleFlag(actor, flag));
}

/**
 * Ослеплён И штрафы слепоты действуют: свой флаг или оба глаза потеряны
 * (isBlindedActor), и нет альтернативных чувств. `extraBlind` — ослепление,
 * которого нет в Состояниях (щит, поднятый на голову, sheets/attack-dialog.mjs):
 * сонар снимает и его — книга говорит «все штрафы».
 */
export function suffersBlindness(actor, { extraBlind = false } = {}) {
  if (!(isBlindedActor(actor) || extraBlind)) return false;
  return !hasAlternativeSenses(actor);
}
