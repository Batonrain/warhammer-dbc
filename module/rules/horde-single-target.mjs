// module/rules/horde-single-target.mjs
// ════════════════════════════════════════════════════════════════════════
//  «Избегает атак Орды как одиночная цель» — флаг horde.singleTargetImmune.
//  Дают его две Черты с одним и тем же книжным правилом:
//   - The Quick and The Dead / Быстрые и Мёртвые (Человек и родственные):
//     «может Избегать атак Орды и атак „Троек“ подчинённых под 2-м эффектом
//     Командного Присутствия, как если бы это были атаки одиночных
//     персонажей, а при попадании таких атак те не наносят бонусные кубики
//     урона. Если Размер персонажа становится 2+, этот Трейт теряет все
//     эффекты, кроме +2 к Инициативе»;
//   - Oteshii Physiology / Физиология Отеший (Серый Человек, wdbc-gzuf).
//
//  Три читателя одного вопроса «действует ли сейчас»:
//   - combat/damage.mjs — снимает кубы Магнитуды Орды с урона;
//   - hooks.mjs (кнопки Уклонения/Парирования) — пускает Избегать ПОПАДАНИЕ
//     Орды, которое остальным Избегать нельзя (шквал/навал);
//   - combat/attack.mjs — гасит −20 к Избеганию и +2 куба урона
//     Концентрации огня («Тройки», Присутствие эффект 2).
// ════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";

export const HORDE_SINGLE_TARGET = "horde.singleTargetImmune";

/** Итоговый Размер актора: sizeTotal, а без него — сумма base + модификаторов. */
export function sizeTotalOf(actor) {
  const sys = actor?.system ?? {};
  if (sys.sizeTotal != null) return Number(sys.sizeTotal) || 0;
  return (Number(sys.size) || 0) + (Number(sys.sizeMod) || 0) + (Number(sys.sizeModNoSpd) || 0);
}

/** Флаг есть и Размер меньше 2 — атаки Орды и «Троек» для него как одиночные. */
export function evadesHordeAsSingle(actor) {
  return !!actor && sizeTotalOf(actor) < 2 && hasRuleFlag(actor, HORDE_SINGLE_TARGET);
}

/**
 * Причина отказа Избегать ПОПАДАНИЕ Орды или "" (можно). Промах Орды Избегать
 * может любой — туда эта проверка не заходит (hordeHit = false).
 */
export function hordeHitEvasionBlock(actor, hordeHit) {
  if (!hordeHit || evadesHordeAsSingle(actor)) return "";
  return "Попадание Орды нельзя Избегать (шквал / навал) — только Быстрым и Мёртвым или Серому Человеку Размером меньше 2.";
}
